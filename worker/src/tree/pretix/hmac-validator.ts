export async function validateWebhookSignature(body: string, signature: string | undefined, secret: string | undefined): Promise<boolean> {
  if (!secret) {
    return false;
  } // no secret configured → accept (test mode)
  if (!signature) {
    return false;
  }

  try {
    const enc = new TextEncoder();
    const key = await crypto.subtle.importKey('raw', enc.encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
    const sig = await crypto.subtle.sign('HMAC', key, enc.encode(body));
    const expectedHex = Array.from(new Uint8Array(sig))
      .map(b => b.toString(16).padStart(2, '0')).join('');
    return signature === expectedHex;
  } catch {
    return false;
  }
}
