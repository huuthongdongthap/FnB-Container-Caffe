/**
 * QR Code Signature — Web Crypto API (Cloudflare Workers compatible)
 * Replaces Node's crypto.createHash for edge runtime.
 */

export const WINDOW_SECONDS = 300;

async function sha256Hex(data: string): Promise<string> {
  const encoder = new TextEncoder();
  const buffer = await crypto.subtle.digest('SHA-256', encoder.encode(data));
  return Array.from(new Uint8Array(buffer))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

export async function signQRUrl(slug: string, secret: string, baseUrl: string): Promise<string> {
  const ts = Math.floor(Date.now() / 1000);
  const sig = await sha256Hex(`${ts}|${slug}|${secret}`);
  return `${baseUrl}/api/qr/${slug}?ts=${ts}&sig=${sig}`;
}

export async function verifyQRSignature(slug: string, ts: number, sig: string, secret: string): Promise<boolean> {
  const now = Math.floor(Date.now() / 1000);
  if (Math.abs(now - ts) > WINDOW_SECONDS) return false;
  const expected = await sha256Hex(`${ts}|${slug}|${secret}`);
  return sig === expected;
}