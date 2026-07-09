/**
 * Unit tests for JWT utilities (sign, verify, password hashing).
 */

import { describe, it, expect } from 'vitest';
import { generateJWT, verifyJWT, getAuthToken, hashPassword, verifyPassword } from '../../lib/jwt';

const SECRET = 'test-jwt-secret-at-least-16-chars';

describe('generateJWT', () => {
  it('generates a valid 3-part JWT token', async() => {
    const token = await generateJWT({ email: 'test@test.com', name: 'Test', id: 'USR_1', role: 'customer' }, SECRET);
    expect(token).toBeTruthy();
    expect(token.split('.')).toHaveLength(3);
  });

  it('uses provided TTL', async() => {
    const token = await generateJWT({ email: 'test@test.com', name: 'T', id: 'USR_1', role: 'customer' }, SECRET, '60');
    expect(token).toBeTruthy();
  });

  it('throws on short secret', async() => {
    await expect(generateJWT({ email: 'a@b.com', name: 'T', id: 'USR_1', role: 'customer' }, 'short')).rejects.toThrow();
  });
});

describe('verifyJWT', () => {
  it('verifies a valid token', async() => {
    const token = await generateJWT({ email: 'a@b.com', name: 'A', id: 'USR_1', role: 'customer' }, SECRET);
    const payload = await verifyJWT(token, SECRET);
    expect(payload).not.toBeNull();
    expect(payload!.email).toBe('a@b.com');
  });

  it('returns null for invalid token', async() => {
    await expect(verifyJWT('invalid.token.format', SECRET)).resolves.toBeNull();
  });

  it('returns null for malformed token', async() => {
    await expect(verifyJWT('not-a-jwt', SECRET)).resolves.toBeNull();
  });

  it('returns null for wrong secret', async() => {
    const token = await generateJWT({ email: 'a@b.com', name: 'A', id: 'USR_1', role: 'customer' }, SECRET);
    await expect(verifyJWT(token, 'different-secret-16-chars!!')).resolves.toBeNull();
  });
});

describe('getAuthToken', () => {
  it('extracts Bearer token from Authorization header', () => {
    const req = new Request('https://test.com', { headers: { Authorization: 'Bearer mytoken123' } });
    expect(getAuthToken(req)).toBe('mytoken123');
  });

  it('returns null when no Authorization header', () => {
    const req = new Request('https://test.com');
    expect(getAuthToken(req)).toBeNull();
  });

  it('returns null for non-Bearer auth', () => {
    const req = new Request('https://test.com', { headers: { Authorization: 'Basic xyz' } });
    expect(getAuthToken(req)).toBeNull();
  });
});

describe('hashPassword / verifyPassword', () => {
  it('hashes and verifies PBKDF2', async() => {
    const hash = await hashPassword('testpass123');
    expect(hash).toContain('pbkdf2$');
    await expect(verifyPassword('testpass123', hash)).resolves.toBe(true);
    await expect(verifyPassword('wrongpass', hash)).resolves.toBe(false);
  });

  it('supports legacy SHA-256 fallback', async() => {
    const enc = new TextEncoder();
    const hashBuffer = await crypto.subtle.digest('SHA-256', enc.encode('legacypass'));
    const hexHash = Array.from(new Uint8Array(hashBuffer)).map(b => b.toString(16).padStart(2, '0')).join('');
    await expect(verifyPassword('legacypass', hexHash)).resolves.toBe(true);
    await expect(verifyPassword('wrong', hexHash)).resolves.toBe(false);
  });
});
