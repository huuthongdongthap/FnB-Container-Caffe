/**
 * Orders — Get latest order timestamp handler
 * Extracted from routes/orders.ts to tree/orders/.
 */

import { jsonResponse, errorResponse } from '../../middleware/cors';

export async function getLatestOrderTimestamp(request: Request, env: Record<string, unknown>) {
  try {
    const ts = env.AUTH_KV
      ? await (env.AUTH_KV as import('@cloudflare/workers-types').KVNamespace).get('latest_order_ts')
      : null;
    return jsonResponse({ success: true, ts });
  } catch (error) {
    return errorResponse(`Failed to get latest timestamp: ${(error as Error).message}`, 500);
  }
}
