import { createHash } from 'crypto';

/** Time window for QR signature validity (5 minutes) */
export const WINDOW_SECONDS = 300;

export function signQRUrl(slug: string, secret: string, baseUrl: string): string {
  const ts = Math.floor(Date.now() / 1000);
  const sig = createHash('sha256')
    .update(`${ts}|${slug}`)
    .update(secret)
    .digest('hex');
  return `${baseUrl}/api/qr/${slug}?ts=${ts}&sig=${sig}`;
}

export function verifyQRSignature(
  slug: string,
  ts: number,
  sig: string,
  secret: string
): boolean {
  const now = Math.floor(Date.now() / 1000);
  if (Math.abs(now - ts) > WINDOW_SECONDS) {
    return false;
  }

  const expected = createHash('sha256')
    .update(`${ts}|${slug}`)
    .update(secret)
    .digest('hex');

  return sig === expected;
}
