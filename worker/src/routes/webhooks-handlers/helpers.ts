import { createLogger } from '../../middleware/logger';

export const log = createLogger({ route: 'webhooks' });

export async function verifySignature(data: Record<string, unknown>, receivedSignature: string, checksumKey: string): Promise<boolean> {
  const encoder = new TextEncoder();
  const key = await crypto.subtle.importKey(
    'raw', encoder.encode(checksumKey), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']
  );

  const sortedData = Object.keys(data).sort().map((k) => `${k}=${data[k]}`).join('&');
  const computed = await crypto.subtle.sign('HMAC', key, encoder.encode(sortedData));
  const computedHex = Array.from(new Uint8Array(computed)).map((b) => b.toString(16).padStart(2, '0')).join('');

  // Constant-time comparison to prevent timing attacks
  const a = new TextEncoder().encode(computedHex);
  const b = new TextEncoder().encode(receivedSignature);
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a[i] ^ b[i];
  return diff === 0;
}