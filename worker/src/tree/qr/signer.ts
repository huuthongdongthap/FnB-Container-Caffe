/**
 * QR Code Signature — Web Crypto API (Cloudflare Workers compatible)
 * Replaces Node's crypto.createHash for edge runtime.
 */

export const WINDOW_SECONDS = 300;

async function hmacSha256Hex(message: string, secret: string): Promise<string> {
  const encoder = new TextEncoder();
  const key = await crypto.subtle.importKey(
    'raw',
    encoder.encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  );
  const buffer = await crypto.subtle.sign('HMAC', key, encoder.encode(message));
  return Array.from(new Uint8Array(buffer))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

export async function signQRUrl(slug: string, secret: string, baseUrl: string): Promise<string> {
  const ts = Math.floor(Date.now() / 1000);
  const sig = await hmacSha256Hex(`${ts}|${slug}`, secret);
  return `${baseUrl}/api/qr/${slug}?ts=${ts}&sig=${sig}`;
}

export async function verifyQRSignature(slug: string, ts: number, sig: string, secret: string): Promise<boolean> {
  if (!Number.isFinite(ts)) return false;
  const now = Math.floor(Date.now() / 1000);
  if (Math.abs(now - ts) > WINDOW_SECONDS) return false;
  const expected = await hmacSha256Hex(`${ts}|${slug}`, secret);
  if (typeof sig !== 'string' || sig.length !== expected.length) return false;
  let diff = 0;
  for (let i = 0; i < expected.length; i++) {
    diff |= expected.charCodeAt(i) ^ sig.charCodeAt(i);
  }
  return diff === 0;
}
