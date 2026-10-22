/** Canonicalization for payment-requests (not the distinct PayOS payouts API). */
export function canonicalPayOSData(data: Record<string, unknown>): string {
  return Object.keys(data).sort().filter((key) => data[key] !== undefined).map((key) => {
    let value = data[key];
    if (Array.isArray(value)) {
      value = JSON.stringify(value.map((entry) => entry && typeof entry === 'object'
        ? Object.fromEntries(Object.keys(entry).sort().map((field) => [field, entry[field]])) : entry));
    }
    if (value === null || value === undefined || value === 'null' || value === 'undefined') value = '';
    return `${key}=${value}`;
  }).join('&');
}

export async function signPayOSData(data: Record<string, unknown>, checksumKey: string): Promise<string> {
  const encoder = new TextEncoder();
  const key = await crypto.subtle.importKey('raw', encoder.encode(checksumKey),
    { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  const signed = await crypto.subtle.sign('HMAC', key, encoder.encode(canonicalPayOSData(data)));
  return Array.from(new Uint8Array(signed), (byte) => byte.toString(16).padStart(2, '0')).join('');
}

export async function verifyPayOSSignature(data: Record<string, unknown>, signature: unknown, checksumKey: string): Promise<boolean> {
  if (typeof signature !== 'string' || !/^[a-fA-F0-9]{64}$/.test(signature)) return false;
  const computed = await signPayOSData(data, checksumKey);
  const normalized = signature.toLowerCase();
  let difference = 0;
  for (let index = 0; index < computed.length; index++) difference |= computed.charCodeAt(index) ^ normalized.charCodeAt(index);
  return difference === 0;
}
