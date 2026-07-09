/**
 * JWT sign/verify utilities
 * Extracted from routes/auth.js for reuse across middleware + routes.
 * Same algorithm (HS256), same secret, same payload format.
 */

import type { JwtPayload } from '../types/api';

const JWT_DEFAULT_TTL_SECONDS = 86400 * 7; // 7 days

function validateJWTSecret(secret: string): void {
  if (!secret || typeof secret !== 'string' || secret.length < 16) {
    throw new Error('JWT_SECRET must be at least 16 characters');
  }
}

function base64UrlEncode(str: string): string {
  return btoa(encodeURIComponent(str).replace(/%([0-9A-F]{2})/g, (_, p1: string) => String.fromCharCode(parseInt(p1, 16))))
    .replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, '');
}

function base64UrlEncodeBinary(uint8Array: Uint8Array): string {
  let binaryString = '';
  for (let i = 0; i < uint8Array.length; i++) {
    binaryString += String.fromCharCode(uint8Array[i]);
  }
  return btoa(binaryString).replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, '');
}

function base64UrlDecode(s: string): string {
  if (typeof s !== 'string') {
    throw new Error('base64UrlDecode expects string');
  }
  let b64 = s.replace(/-/g, '+').replace(/_/g, '/');
  const pad = b64.length % 4;
  if (pad === 2) {
    b64 += '==';
  } else if (pad === 3) {
    b64 += '=';
  } else if (pad === 1) {
    throw new Error('Invalid base64url: length % 4 == 1');
  }
  return atob(b64);
}

export async function generateJWT(
  payload: JwtPayload,
  secret: string,
  ttlSeconds?: string | number
): Promise<string> {
  validateJWTSecret(secret);
  const encoder = new TextEncoder();
  const header = { alg: 'HS256', typ: 'JWT' };
  const ttl = Number.isFinite(Number(ttlSeconds)) && Number(ttlSeconds) > 0
    ? Number(ttlSeconds)
    : JWT_DEFAULT_TTL_SECONDS;

  const headerBase64 = base64UrlEncode(JSON.stringify(header));
  const payloadBase64 = base64UrlEncode(
    JSON.stringify({
      ...payload,
      iat: Math.floor(Date.now() / 1000),
      exp: Math.floor(Date.now() / 1000) + ttl
    })
  );

  const signatureInput = `${headerBase64}.${payloadBase64}`;

  const keyData = encoder.encode(secret);
  const key = await crypto.subtle.importKey(
    'raw',
    keyData,
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  );

  const signature = await crypto.subtle.sign('HMAC', key, encoder.encode(signatureInput));
  const signatureBase64 = base64UrlEncodeBinary(new Uint8Array(signature));

  return `${signatureInput}.${signatureBase64}`;
}

export async function verifyJWT(
  token: string,
  secret: string
): Promise<JwtPayload | null> {
  validateJWTSecret(secret);
  try {
    const encoder = new TextEncoder();
    const parts = token.split('.');
    if (parts.length !== 3) {
      return null;
    }

    const [headerBase64, payloadBase64, signatureBase64] = parts;
    const signatureInput = `${headerBase64}.${payloadBase64}`;

    const key = await crypto.subtle.importKey(
      'raw',
      encoder.encode(secret),
      { name: 'HMAC', hash: 'SHA-256' },
      false,
      ['verify']
    );

    const signature = Uint8Array.from(base64UrlDecode(signatureBase64), c => c.charCodeAt(0));
    const isValid = await crypto.subtle.verify('HMAC', key, signature, encoder.encode(signatureInput));

    if (!isValid) {
      return null;
    }

    const payload = JSON.parse(base64UrlDecode(payloadBase64)) as JwtPayload;

    if (payload.exp && payload.exp < Date.now() / 1000) {
      return null;
    }

    return payload;
  } catch {
    return null;
  }
}

export function getAuthToken(request: Request): string | null {
  const authHeader = request.headers.get('Authorization');
  if (authHeader && authHeader.startsWith('Bearer ')) {
    return authHeader.substring(7);
  }
  return null;
}

// ── Password hashing (PBKDF2 + legacy SHA-256) ──

async function legacyHashPassword(password: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(password);
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  return Array.from(new Uint8Array(hashBuffer))
    .map(b => b.toString(16).padStart(2, '0')).join('');
}

export async function hashPassword(password: string): Promise<string> {
  const enc = new TextEncoder();
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const iterations = 100000;
  const keyMat = await crypto.subtle.importKey(
    'raw', enc.encode(password), { name: 'PBKDF2' }, false, ['deriveBits']
  );
  const bits = await crypto.subtle.deriveBits(
    { name: 'PBKDF2', salt, iterations, hash: 'SHA-256' }, keyMat, 256
  );
  const hex = (buf: ArrayBuffer | Uint8Array) => Array.from(new Uint8Array(buf))
    .map(b => b.toString(16).padStart(2, '0')).join('');
  return `pbkdf2$${iterations}$${hex(salt)}$${hex(bits)}`;
}

export async function verifyPassword(password: string, stored: string): Promise<boolean> {
  if (typeof stored !== 'string') {
    return false;
  }
  if (stored.startsWith('pbkdf2$')) {
    const [, iterStr, saltHex, hashHex] = stored.split('$');
    const iter = parseInt(iterStr, 10);
    const salt = new Uint8Array(saltHex.match(/.{2}/g)!.map(h => parseInt(h, 16)));
    const enc = new TextEncoder();
    const keyMat = await crypto.subtle.importKey(
      'raw', enc.encode(password), { name: 'PBKDF2' }, false, ['deriveBits']
    );
    const bits = await crypto.subtle.deriveBits(
      { name: 'PBKDF2', salt, iterations: iter, hash: 'SHA-256' }, keyMat, 256
    );
    const computed = Array.from(new Uint8Array(bits))
      .map(b => b.toString(16).padStart(2, '0')).join('');
    if (computed.length !== hashHex.length) {
      return false;
    }
    let diff = 0;
    for (let i = 0; i < computed.length; i++) {
      diff |= computed.charCodeAt(i) ^ hashHex.charCodeAt(i);
    }
    return diff === 0;
  }
  const legacy = await legacyHashPassword(password);
  return legacy === stored;
}
