/**
 * Orders — Helpers (generateId, parseJSON)
 * Extracted from routes/orders.ts to tree/orders/.
 */

export function generateId(prefix = 'ID_') {
  const bytes = new Uint8Array(6);
  crypto.getRandomValues(bytes);
  return prefix + Date.now().toString(36) + Array.from(bytes, b => b.toString(16).padStart(2, '0')).join('');
}

export async function parseJSON(request: Request): Promise<Record<string, unknown>> {
  try {
    return await request.json();
  } catch {
    throw new Error('Invalid JSON body');
  }
}
