/**
 * Orders — Helpers (generateId, parseJSON)
 * Extracted from routes/orders.ts to tree/orders/.
 */

const SHORT_CODE_ALPHABET = '23456789ABCDEFGHJKLMNPQRSTUVWXYZ';

export function generateId(prefix = 'ID_') {
  const bytes = new Uint8Array(6);
  crypto.getRandomValues(bytes);
  return prefix + Date.now().toString(36) + Array.from(bytes, b => b.toString(16).padStart(2, '0')).join('');
}

export function generateOrderNumber(prefix = 'ORD-'): string {
  // 12 base-32 symbols provide 60 bits of entropy, preventing sequential/brute-force enumeration
  const bytes = new Uint8Array(12);
  crypto.getRandomValues(bytes);
  let code = '';
  for (let i = 0; i < bytes.length; i++) {
    code += SHORT_CODE_ALPHABET[bytes[i]! % SHORT_CODE_ALPHABET.length];
  }
  return `${prefix}${code}`;
}

export function sanitizeOrderNotes(raw: unknown): string | null {
  if (typeof raw !== 'string') return null;
  const cleaned = raw
    .split('|')
    .map((part) => part.replace(/\[OVERDUE\]/gi, '').trim())
    .filter(Boolean)
    .join(' | ');
  return cleaned || null;
}

export async function parseJSON(request: Request): Promise<Record<string, unknown>> {
  try {
    return await request.json();
  } catch {
    throw new Error('Invalid JSON body');
  }
}
