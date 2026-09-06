import { describe, it, expect, vi, afterEach } from 'vitest';
import { createLogger, redact } from '../../middleware/logger';

describe('redact()', () => {
  it('masks secret-named fields at any nesting depth', () => {
    const out = redact({
      signature: 'abc',
      nested: { checksumKey: undefined, token: 't' }
    }) as Record<string, unknown>;
    // note: checksumKey is not in the key list; token is
    expect(out.signature).toBe('[REDACTED]');
    expect((out.nested as Record<string, unknown>).token).toBe('[REDACTED]');
  });

  it('masks customer phone/email field names', () => {
    const out = redact({ customer_phone: '0918xxxxxx', email: 'a@b.c' }) as Record<string, unknown>;
    expect(out.customer_phone).toBe('[REDACTED]');
    expect(out.email).toBe('[REDACTED]');
  });

  it('masks bare VN phone numbers passed as plain string values', () => {
    expect(redact('0901234567')).toBe('[REDACTED]');
    expect(redact('order r_abc123')).toBe('order r_abc123');
  });

  it('caps arrays at 20 entries and depth at 4 levels', () => {
    const arr = redact(Array.from({ length: 50 }, (_, i) => ({ v: i }))) as unknown[];
    expect(arr.length).toBe(20);
    // 5th nesting level exceeds the cap → leaf replaced by the marker
    expect(redact({ a: { b: { c: { d: { e: 1 } } } } })).toEqual({
      a: { b: { c: { d: { e: '[DEPTH_LIMIT]' } } } }
    });
  });
});

describe('logger redaction integration', () => {
  let lines: string[] = [];
  const origLog = console.log;

  afterEach(() => {
    console.log = origLog;
  });

  it('never emits sensitive extra fields verbatim', () => {
    console.log = (line: unknown) => { lines.push(String(line)); };
    const log = createLogger({ route: 'test' });
    log.info('payos_webhook', {
      signature: 'SECRET',
      customer_phone: '0901234567'
    });
    const emitted = lines.join('\n');
    expect(emitted).not.toContain('SECRET');
    expect(emitted).not.toContain('0901234567');
    expect(emitted).toContain('[REDACTED]');
  });
});
