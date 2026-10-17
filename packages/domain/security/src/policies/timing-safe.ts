/**
 * Timing-Safe Operations & Web Crypto HMAC Verification
 * Defends against side-channel timing attacks on signatures and secrets.
 */

export async function timingSafeEqual(a: string, b: string): Promise<boolean> {
  const encoder = new TextEncoder();
  const bufA = encoder.encode(a);
  const bufB = encoder.encode(b);

  if (bufA.length !== bufB.length) {
    return false;
  }

  let mismatch = 0;
  for (let i = 0; i < bufA.length; i++) {
    mismatch |= (bufA[i]! ^ bufB[i]!);
  }
  return mismatch === 0;
}

export async function computeHmacSha256(data: string, secret: string): Promise<string> {
  const encoder = new TextEncoder();
  const key = await crypto.subtle.importKey(
    'raw',
    encoder.encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  );
  const signatureBuffer = await crypto.subtle.sign('HMAC', key, encoder.encode(data));
  return Array.from(new Uint8Array(signatureBuffer))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

export async function verifyHmacSha256(
  data: string,
  receivedSignature: string,
  secret: string
): Promise<boolean> {
  if (!data || !receivedSignature || !secret) {
    return false;
  }
  const expectedSignature = await computeHmacSha256(data, secret);
  return timingSafeEqual(expectedSignature.toLowerCase(), receivedSignature.toLowerCase());
}
