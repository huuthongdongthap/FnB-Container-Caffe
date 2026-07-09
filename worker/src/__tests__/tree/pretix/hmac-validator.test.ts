import { describe, it, expect } from 'vitest';
import { validateWebhookSignature } from '../../../tree/pretix/hmac-validator.js';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Mirror the implementation to produce a valid HMAC-SHA-256 hex for tests */
async function computeValidHmac(body: string, secret: string): Promise<string> {
  const enc = new TextEncoder();
  const key = await crypto.subtle.importKey(
    'raw',
    enc.encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  );
  const sig = await crypto.subtle.sign('HMAC', key, enc.encode(body));
  return Array.from(new Uint8Array(sig))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('validateWebhookSignature', () => {
  const BODY = '{"event":"order.placed","id":1}';
  const SECRET = 'test-webhook-secret';

  // --- Happy path ---

  it('returns true for a valid HMAC-SHA-256 signature', async() => {
    const expected = await computeValidHmac(BODY, SECRET);
    const result = await validateWebhookSignature(BODY, expected, SECRET);
    expect(result).toBe(true);
  });

  // --- Missing/invalid inputs ---

  it('returns false when signature header is missing', async() => {
    const result = await validateWebhookSignature(BODY, undefined, SECRET);
    expect(result).toBe(false);
  });

  it('returns false when secret is missing (no secret configured)', async() => {
    const result = await validateWebhookSignature(BODY, 'some-sig', undefined);
    expect(result).toBe(false);
  });

  it('returns false for an invalid HMAC signature', async() => {
    const result = await validateWebhookSignature(
      BODY,
      '0000000000000000000000000000000000000000000000000000000000000000',
      SECRET
    );
    expect(result).toBe(false);
  });

  it('returns false for a signature computed with a different hash algorithm (raw SHA-256 instead of HMAC)', async() => {
    // Compute a plain SHA-256 of the body (not HMAC) — wrong algorithm
    const rawHash = await crypto.subtle.digest(
      'SHA-256',
      new TextEncoder().encode(BODY)
    );
    const wrongSig = Array.from(new Uint8Array(rawHash))
      .map((b) => b.toString(16).padStart(2, '0'))
      .join('');

    const result = await validateWebhookSignature(BODY, wrongSig, SECRET);
    expect(result).toBe(false);
  });

  it('returns false for a malformed (non-hex) signature', async() => {
    const result = await validateWebhookSignature(
      BODY,
      'not-a-valid-hex-signature!!!',
      SECRET
    );
    expect(result).toBe(false);
  });

  it('returns false for an empty string signature', async() => {
    const result = await validateWebhookSignature(BODY, '', SECRET);
    expect(result).toBe(false);
  });

  it('returns false for a signature with wrong length', async() => {
    const result = await validateWebhookSignature(BODY, 'abc123', SECRET);
    expect(result).toBe(false);
    const longResult = await validateWebhookSignature(
      BODY,
      'a'.repeat(100),
      SECRET
    );
    expect(longResult).toBe(false);
  });

  it('returns false when body is empty but signature was computed from non-empty body', async() => {
    const expected = await computeValidHmac(BODY, SECRET);
    const result = await validateWebhookSignature('', expected, SECRET);
    expect(result).toBe(false);
  });

  it('returns false when secret does not match (different secret than used to sign)', async() => {
    const wrongSecretSuffix = '-wrong';
    const expected = await computeValidHmac(
      BODY,
      SECRET + wrongSecretSuffix
    );
    const result = await validateWebhookSignature(BODY, expected, SECRET);
    expect(result).toBe(false);
  });

  it('returns false on garbage body input', async() => {
    const garbage = '\x00\xff\xfe garbage bytes';
    const result = await validateWebhookSignature(garbage, 'abc', SECRET);
    expect(result).toBe(false);
  });
});
