/**
 * AES-256-GCM Secret Encryption for Per-Tenant Merchant Credentials.
 *
 * Uses Web Crypto API (standard in Cloudflare Workers & Node 20+).
 * Master key is provided via `env.TENANT_SECRETS_KEY` (base64 or hex 32-byte key).
 * Output format: `v{keyVersion}:{iv_b64}:{ciphertext_b64}`.
 */

const CURRENT_KEY_VERSION = 1;

function bytesToBase64(bytes: Uint8Array): string {
  let binary = '';
  for (let i = 0; i < bytes.length; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary);
}

function base64ToBytes(b64: string): Uint8Array {
  const binary = atob(b64);
  const out = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    out[i] = binary.charCodeAt(i);
  }
  return out;
}

function hexToBytes(hex: string): Uint8Array {
  const out = new Uint8Array(hex.length / 2);
  for (let i = 0; i < out.length; i++) {
    out[i] = parseInt(hex.slice(i * 2, i * 2 + 2), 16);
  }
  return out;
}

async function importMasterKey(rawKey: string | undefined): Promise<CryptoKey> {
  const clean = String(rawKey || '').trim();
  if (!clean) {
    throw new Error('TENANT_SECRETS_KEY is not configured');
  }

  let keyBytes: Uint8Array<ArrayBuffer>;
  if (/^[0-9a-fA-F]{64}$/.test(clean)) {
    keyBytes = new Uint8Array(hexToBytes(clean));
  } else {
    try {
      keyBytes = new Uint8Array(base64ToBytes(clean));
    } catch {
      // Fallback: derive deterministic 32-byte key via SHA-256 if caller passed a passphrase
      const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(clean));
      keyBytes = new Uint8Array(digest);
    }
  }

  if (keyBytes.byteLength !== 32) {
    const digest = await crypto.subtle.digest('SHA-256', keyBytes);
    keyBytes = new Uint8Array(digest);
  }

  return crypto.subtle.importKey('raw', keyBytes, { name: 'AES-GCM' }, false, [
    'encrypt',
    'decrypt',
  ]);
}

export async function encryptTenantSecret(
  plaintext: string,
  masterKey: string | undefined,
  keyVersion: number = CURRENT_KEY_VERSION,
  aad?: string
): Promise<string> {
  const key = await importMasterKey(masterKey);
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const encoded = new TextEncoder().encode(plaintext);
  const additionalData = aad ? new TextEncoder().encode(aad) : undefined;
  const cipherBuffer = await crypto.subtle.encrypt(
    additionalData ? { name: 'AES-GCM', iv, additionalData } : { name: 'AES-GCM', iv },
    key,
    encoded
  );
  const prefix = additionalData ? `v${keyVersion}a` : `v${keyVersion}`;
  return `${prefix}:${bytesToBase64(iv)}:${bytesToBase64(new Uint8Array(cipherBuffer))}`;
}

export async function decryptTenantSecret(
  payload: string,
  masterKey: string | undefined,
  aad?: string
): Promise<string> {
  const parts = String(payload || '').split(':');
  if (parts.length !== 3 || !/^v\d+a?$/.test(parts[0])) {
    throw new Error('Malformed encrypted tenant secret payload');
  }
  const usesAad = parts[0].endsWith('a');
  if (usesAad && !aad) {
    throw new Error('Missing AAD context for authenticated tenant secret');
  }
  const key = await importMasterKey(masterKey);
  const iv = new Uint8Array(base64ToBytes(parts[1]));
  const cipherBytes = new Uint8Array(base64ToBytes(parts[2]));
  const plainBuffer = await crypto.subtle.decrypt(
    usesAad ? { name: 'AES-GCM', iv, additionalData: new TextEncoder().encode(aad) } : { name: 'AES-GCM', iv },
    key,
    cipherBytes
  );
  return new TextDecoder().decode(plainBuffer);
}

export function isEncryptedTenantSecret(value: string | null | undefined): boolean {
  if (typeof value !== 'string') return false;
  const parts = value.split(':');
  return parts.length === 3 && /^v\d+a?$/.test(parts[0]);
}

export async function decryptTenantSecretOrPlaintext(
  value: string,
  masterKey: string | undefined,
  aad?: string
): Promise<string> {
  if (!isEncryptedTenantSecret(value)) {
    return value;
  }
  return decryptTenantSecret(value, masterKey, aad);
}

export function maskSecretValue(value: string | null | undefined): string {
  const clean = String(value || '').trim();
  if (!clean) return '';
  if (clean.length <= 6) return '••••••';
  return `${clean.slice(0, 3)}••••${clean.slice(-3)}`;
}

/**
 * Compute HMAC-SHA256 hex digest (used for PayOS webhook verification).
 */
export async function computeHmacSha256Hex(secret: string, data: string): Promise<string> {
  const key = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  );
  const sig = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(data));
  return Array.from(new Uint8Array(sig))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

/**
 * Constant-time string comparison to prevent timing side-channels on HMAC signatures.
 */
export function timingSafeEqualHex(a: string, b: string): boolean {
  const left = String(a || '').toLowerCase();
  const right = String(b || '').toLowerCase();
  if (!left || left.length !== right.length) return false;
  let diff = 0;
  for (let i = 0; i < left.length; i++) {
    diff |= left.charCodeAt(i) ^ right.charCodeAt(i);
  }
  return diff === 0;
}

/**
 * Canonical PayOS payload signature builder: sort keys alphabetically and join as `key=value&...`.
 */
export function canonicalizePayosData(data: Record<string, unknown>): string {
  return Object.keys(data)
    .sort()
    .map((key) => {
      const val = data[key];
      const str = val === null || val === undefined ? '' : String(val);
      return `${key}=${str}`;
    })
    .join('&');
}

export async function verifyPayosSignature(
  data: Record<string, unknown>,
  providedSignature: string,
  checksumKey: string
): Promise<boolean> {
  if (!providedSignature || !checksumKey) return false;
  const canonical = canonicalizePayosData(data);
  const expected = await computeHmacSha256Hex(checksumKey, canonical);
  return timingSafeEqualHex(expected, providedSignature);
}
