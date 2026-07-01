/**
 * Orders — Helpers (generateId, parseJSON)
 * Extracted from routes/orders.ts to tree/orders/.
 */

export function generateId(prefix = 'ID_') {
  return prefix + Date.now().toString(36) + Math.random().toString(36).substr(2, 5);
}

export async function parseJSON(request: Request): Promise<Record<string, unknown>> {
  try {
    return await request.json();
  } catch {
    throw new Error('Invalid JSON body');
  }
}
