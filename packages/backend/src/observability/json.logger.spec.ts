import {afterEach, describe, expect, it, vi} from 'vitest';
import {JsonLogger} from './json.logger';

/** Captures stdout writes so we can assert on the emitted lines. */
function captureStdout(): {lines: () => string[]; restore: () => void} {
  const written: string[] = [];
  const spy = vi
    .spyOn(process.stdout, 'write')
    .mockImplementation((chunk: unknown) => {
      written.push(String(chunk));
      return true;
    });
  return {lines: () => written, restore: () => spy.mockRestore()};
}

describe('JsonLogger', () => {
  afterEach(() => vi.restoreAllMocks());

  it('emits one parseable JSON object per line', () => {
    const out = captureStdout();
    new JsonLogger().log('Backend listening on port 3000', 'Bootstrap');
    const lines = out.lines();
    out.restore();

    expect(lines).toHaveLength(1);
    expect(lines[0].endsWith('\n')).toBe(true);
    const record = JSON.parse(lines[0]) as Record<string, unknown>;
    expect(record.message).toBe('Backend listening on port 3000');
    expect(record.context).toBe('Bootstrap');
    expect(record.level).toBe('log');
    expect(typeof record.timestamp).toBe('string');
  });

  it('contains no ANSI escape codes, which would break log-store parsing', () => {
    const out = captureStdout();
    new JsonLogger().warn('degraded', 'Llm');
    const [line] = out.lines();
    out.restore();

    // ESC built from its char code so this source file stays plain ASCII - a
    // raw control character in a tracked file is exactly what the repo's
    // unicode lint exists to prevent.
    const esc = String.fromCharCode(27);
    expect(line).not.toContain(`${esc}[`);
  });

  it('serializes an Error into structured fields instead of "[object Object]"', () => {
    const out = captureStdout();
    new JsonLogger().error(new Error('pool exhausted'), undefined, 'Database');
    const lines = out.lines();
    out.restore();

    const record = JSON.parse(lines[0]) as {message: {message?: string}};
    expect(record.message.message).toBe('pool exhausted');
  });
});
