import { describe, it, expect } from 'vitest';
import { sessionIdWidget, sessionIdFullWidget } from '../widgets/session-id.js';
import type { WidgetContext, StdinInput } from '../types.js';
import { MOCK_TRANSLATIONS, MOCK_CONFIG, MOCK_STDIN } from './fixtures.js';

function createStdin(overrides: Partial<StdinInput> = {}): StdinInput {
  return { ...MOCK_STDIN, ...overrides };
}

function createContext(stdinOverrides: Partial<StdinInput> = {}): WidgetContext {
  return {
    stdin: createStdin(stdinOverrides),
    config: MOCK_CONFIG,
    translations: MOCK_TRANSLATIONS,
    rateLimits: null,
  };
}

describe('sessionIdWidget', () => {
  it('should have correct id and name', () => {
    expect(sessionIdWidget.id).toBe('sessionId');
    expect(sessionIdWidget.name).toBe('Session ID (Short)');
  });

  it('should return null when session_id is missing', async () => {
    const ctx = createContext({ session_id: undefined });
    const data = await sessionIdWidget.getData(ctx);
    expect(data).toBeNull();
  });

  it('should extract shortId and sessionId from stdin', async () => {
    const ctx = createContext();
    const data = await sessionIdWidget.getData(ctx);

    expect(data).not.toBeNull();
    expect(data?.shortId).toBe('a1b2c3d4');
    expect(data?.sessionId).toBe('a1b2c3d4-e5f6-7890-abcd-ef1234567890');
  });

  it('should render key emoji and 8-char short ID', () => {
    const ctx = createContext();
    const data = { sessionId: 'a1b2c3d4-e5f6-7890-abcd-ef1234567890', shortId: 'a1b2c3d4' };
    const result = sessionIdWidget.render(data, ctx);

    expect(result).toContain('\u{1F511}');
    expect(result).toContain('a1b2c3d4');
    expect(result).not.toContain('e5f6');
  });

  it('should handle short session_id (less than 8 chars)', async () => {
    const ctx = createContext({ session_id: 'abc' });
    const data = await sessionIdWidget.getData(ctx);

    expect(data).not.toBeNull();
    expect(data?.shortId).toBe('abc');
    expect(data?.sessionId).toBe('abc');
  });
});

describe('sessionIdFullWidget', () => {
  it('should have correct id and name', () => {
    expect(sessionIdFullWidget.id).toBe('sessionIdFull');
    expect(sessionIdFullWidget.name).toBe('Session ID (Full)');
  });

  it('should return null when session_id is missing', async () => {
    const ctx = createContext({ session_id: undefined });
    const data = await sessionIdFullWidget.getData(ctx);
    expect(data).toBeNull();
  });

  it('should extract full sessionId from stdin', async () => {
    const ctx = createContext();
    const data = await sessionIdFullWidget.getData(ctx);

    expect(data).not.toBeNull();
    expect(data?.sessionId).toBe('a1b2c3d4-e5f6-7890-abcd-ef1234567890');
  });

  it('should render key emoji and full UUID', () => {
    const ctx = createContext();
    const data = { sessionId: 'a1b2c3d4-e5f6-7890-abcd-ef1234567890', shortId: 'a1b2c3d4' };
    const result = sessionIdFullWidget.render(data, ctx);

    expect(result).toContain('\u{1F511}');
    expect(result).toContain('a1b2c3d4-e5f6-7890-abcd-ef1234567890');
  });
});
