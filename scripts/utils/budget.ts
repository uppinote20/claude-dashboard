/**
 * Budget tracking utilities
 * Tracks daily spending and compares against user-defined budget limits.
 *
 * Strategy: Each status line invocation reports the current session's total cost.
 * We store per-session "last seen cost" to compute the delta (new spending since last check),
 * then add that delta to the daily total. This prevents double-counting when the
 * status line runs multiple times per session.
 * @handbook 3.3-widget-data-sources
 * @tested scripts/__tests__/widgets.test.ts
 */

import { readFile, mkdir, writeFile } from 'fs/promises';
import { join } from 'path';
import { homedir } from 'os';
import { debugLog } from './debug.js';

const BUDGET_DIR = join(homedir(), '.cache', 'claude-dashboard');
const BUDGET_FILE = join(BUDGET_DIR, 'budget.json');

interface BudgetState {
  /** ISO date string (YYYY-MM-DD) for the current tracking day */
  date: string;
  /** Total cost accumulated today across all sessions */
  dailyTotal: number;
  /** Per-session last-seen cost to compute deltas */
  sessions: Record<string, number>;
}

/**
 * In-memory cache to avoid repeated file I/O within a single process
 */
let budgetCache: BudgetState | null = null;

/** Track whether BUDGET_DIR has been created */
let dirEnsured = false;

/** Deduplicate concurrent calls within the same render cycle */
let pendingRecordDaily: Promise<number> | null = null;

/**
 * Get today's date as YYYY-MM-DD
 */
function getToday(): string {
  return new Date().toISOString().slice(0, 10);
}

/**
 * Load budget state from disk, resetting if the date has changed
 */
async function loadBudgetState(): Promise<BudgetState> {
  const today = getToday();

  if (budgetCache && budgetCache.date === today) {
    return budgetCache;
  }

  const fresh: BudgetState = { date: today, dailyTotal: 0, sessions: {} };

  try {
    const content = await readFile(BUDGET_FILE, 'utf-8');
    const state = JSON.parse(content) as BudgetState;

    if (
      state.date !== today ||
      !Number.isFinite(state.dailyTotal) ||
      !state.sessions || typeof state.sessions !== 'object'
    ) {
      return fresh;
    }

    budgetCache = state;
    return state;
  } catch {
    return fresh;
  }
}

/**
 * Save budget state to disk (fire-and-forget safe)
 */
async function saveBudgetState(state: BudgetState): Promise<void> {
  try {
    if (!dirEnsured) {
      await mkdir(BUDGET_DIR, { recursive: true });
      dirEnsured = true;
    }
    await writeFile(BUDGET_FILE, JSON.stringify(state), 'utf-8');
    budgetCache = state;
  } catch (error) {
    debugLog('budget', 'Failed to save budget state', error);
  }
}

/**
 * Record session cost and return current daily total.
 * Uses delta tracking to prevent double-counting.
 *
 * @param sessionId - Current session identifier
 * @param sessionCost - Total cost for this session so far
 * @returns Current daily total cost
 */
export async function recordCostAndGetDaily(
  sessionId: string,
  sessionCost: number,
): Promise<number> {
  // Deduplicate concurrent calls (budget + todayCost widgets render in same Promise.all).
  // Assumes all concurrent callers in a single render cycle pass the same sessionId/sessionCost.
  if (pendingRecordDaily) return pendingRecordDaily;
  pendingRecordDaily = recordCostAndGetDailyImpl(sessionId, sessionCost);
  try {
    return await pendingRecordDaily;
  } finally {
    pendingRecordDaily = null;
  }
}

async function recordCostAndGetDailyImpl(
  sessionId: string,
  sessionCost: number,
): Promise<number> {
  const state = await loadBudgetState();

  // Skip zero-cost sessions to prevent unbounded map growth
  if (sessionCost <= 0 && !(sessionId in state.sessions)) {
    return state.dailyTotal;
  }

  const lastSeen = state.sessions[sessionId] ?? 0;
  const delta = Math.max(0, sessionCost - lastSeen);

  // Skip save when nothing changed
  if (delta === 0) return state.dailyTotal;

  state.dailyTotal += delta;
  state.sessions[sessionId] = sessionCost;

  // Save asynchronously (don't block rendering)
  saveBudgetState(state).catch(() => {});

  return state.dailyTotal;
}
