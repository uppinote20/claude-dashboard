/**
 * @handbook 8.1-test-structure
 * @covers scripts/utils/history-parser.ts
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { mkdir, writeFile, rm } from 'fs/promises';
import path from 'path';
import os from 'os';

const TEST_DIR = path.join(os.tmpdir(), 'claude-dashboard-history-test-' + process.pid);
const CLAUDE_DIR = path.join(TEST_DIR, '.claude');
const HISTORY_FILE = path.join(CLAUDE_DIR, 'history.jsonl');

vi.mock('os', async (importOriginal) => {
  const actual = await importOriginal<typeof import('os')>();
  return { ...actual, homedir: () => TEST_DIR };
});

describe('history-parser', () => {
  beforeEach(async () => {
    vi.resetModules();
    await mkdir(CLAUDE_DIR, { recursive: true });
  });

  afterEach(async () => {
    try {
      await rm(TEST_DIR, { recursive: true, force: true });
    } catch { /* ignore */ }
  });

  describe('getLastUserPrompt', () => {
    it('should return null when history file does not exist', async () => {
      const { getLastUserPrompt } = await import('../utils/history-parser.js');
      const result = await getLastUserPrompt('test-session');
      expect(result).toBeNull();
    });

    it('should return last prompt for matching session', async () => {
      const entries = [
        JSON.stringify({ sessionId: 'sess-1', display: 'First prompt', timestamp: '2024-01-01T10:00:00Z' }),
        JSON.stringify({ sessionId: 'sess-1', display: 'Second prompt', timestamp: '2024-01-01T10:05:00Z' }),
        JSON.stringify({ sessionId: 'sess-2', display: 'Other session', timestamp: '2024-01-01T10:06:00Z' }),
      ].join('\n');
      await writeFile(HISTORY_FILE, entries);

      const { getLastUserPrompt } = await import('../utils/history-parser.js');
      const result = await getLastUserPrompt('sess-1');

      expect(result).not.toBeNull();
      expect(result?.text).toBe('Second prompt');
      expect(result?.timestamp).toBe('2024-01-01T10:05:00Z');
    });

    it('should return null for non-matching session', async () => {
      await writeFile(HISTORY_FILE, JSON.stringify({
        sessionId: 'sess-1', display: 'Hello', timestamp: '2024-01-01T10:00:00Z',
      }));

      const { getLastUserPrompt } = await import('../utils/history-parser.js');
      const result = await getLastUserPrompt('sess-999');
      expect(result).toBeNull();
    });

    it('should collapse whitespace in display text', async () => {
      await writeFile(HISTORY_FILE, JSON.stringify({
        sessionId: 'sess-1', display: '  Hello\n  World  ', timestamp: '2024-01-01T10:00:00Z',
      }));

      const { getLastUserPrompt } = await import('../utils/history-parser.js');
      const result = await getLastUserPrompt('sess-1');
      expect(result?.text).toBe('Hello World');
    });

    it('should skip entries without display or timestamp', async () => {
      const entries = [
        JSON.stringify({ sessionId: 'sess-1', timestamp: '2024-01-01T10:00:00Z' }),
        JSON.stringify({ sessionId: 'sess-1', display: '', timestamp: '2024-01-01T10:01:00Z' }),
        JSON.stringify({ sessionId: 'sess-1', display: 'Valid', timestamp: '2024-01-01T10:02:00Z' }),
      ].join('\n');
      await writeFile(HISTORY_FILE, entries);

      const { getLastUserPrompt } = await import('../utils/history-parser.js');
      const result = await getLastUserPrompt('sess-1');
      expect(result?.text).toBe('Valid');
    });

    it('should resolve [Pasted text] placeholders from pastedContents', async () => {
      await writeFile(HISTORY_FILE, JSON.stringify({
        sessionId: 'sess-1',
        display: '[Pasted text #1 +4 lines]',
        pastedContents: { '1': { content: 'Line one\nLine two\nLine three\nLine four' } },
        timestamp: '2024-01-01T10:00:00Z',
      }));

      const { getLastUserPrompt } = await import('../utils/history-parser.js');
      const result = await getLastUserPrompt('sess-1');
      expect(result?.text).toBe('Line one Line two Line three Line four');
    });

    it('should resolve pasted text mixed with typed text', async () => {
      await writeFile(HISTORY_FILE, JSON.stringify({
        sessionId: 'sess-1',
        display: 'Here is [Pasted text #1 +2 lines] and some more text',
        pastedContents: { '1': { content: 'pasted\ncontent' } },
        timestamp: '2024-01-01T10:00:00Z',
      }));

      const { getLastUserPrompt } = await import('../utils/history-parser.js');
      const result = await getLastUserPrompt('sess-1');
      expect(result?.text).toBe('Here is pasted content and some more text');
    });

    it('should keep placeholder when pastedContents is missing', async () => {
      await writeFile(HISTORY_FILE, JSON.stringify({
        sessionId: 'sess-1',
        display: '[Pasted text #1 +3 lines]',
        pastedContents: {},
        timestamp: '2024-01-01T10:00:00Z',
      }));

      const { getLastUserPrompt } = await import('../utils/history-parser.js');
      const result = await getLastUserPrompt('sess-1');
      expect(result?.text).toBe('[Pasted text #1 +3 lines]');
    });

    it('should use cached result when file size unchanged', async () => {
      await writeFile(HISTORY_FILE, JSON.stringify({
        sessionId: 'sess-1', display: 'Cached prompt', timestamp: '2024-01-01T10:00:00Z',
      }));

      const { getLastUserPrompt } = await import('../utils/history-parser.js');

      const first = await getLastUserPrompt('sess-1');
      expect(first?.text).toBe('Cached prompt');

      // Second call should hit cache (file unchanged)
      const second = await getLastUserPrompt('sess-1');
      expect(second?.text).toBe('Cached prompt');
    });
  });
});
