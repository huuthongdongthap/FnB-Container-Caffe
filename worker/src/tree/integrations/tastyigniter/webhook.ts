/**
 * TastyIgniter Webhook Handler (tree layer)
 * Processes incoming order events from TastyIgniter POS/Online ordering.
 */

import { createLogger } from '../../../middleware/logger';

const log = createLogger({ route: 'ti-webhook' });

export interface TIWebhookPayload {
  event: string;
  order_id?: string | number;
  ti_order_id?: string | number;
  local_order_id?: string;
  status?: string;
  data?: Record<string, unknown>;
  timestamp?: string;
}

export function mapTIStatusToLocal(tiStatus: string): string {
  const normalized = tiStatus.toLowerCase().trim();
  switch (normalized) {
    case 'received':
    case 'pending':
      return 'confirmed';
    case 'preparing':
    case 'in_progress':
      return 'preparing';
    case 'ready':
      return 'ready';
    case 'delivered':
    case 'completed':
      return 'completed';
    case 'cancelled':
    case 'canceled':
      return 'cancelled';
    default:
      return normalized;
  }
}

export async function processTIWebhook(
  env: Record<string, unknown>,
  payload: TIWebhookPayload
): Promise<{ success: boolean; mapped_status: string; local_order_id?: string; bridge_id?: string; updated: boolean }> {
  const db = (env.AURA_DB ?? env.DB) as import('@cloudflare/workers-types').D1Database | undefined;
  if (!db) {
    throw new Error('D1 database binding missing');
  }

  const rawTiId = payload.ti_order_id ?? payload.order_id;
  const tiOrderId = rawTiId !== undefined ? String(rawTiId) : undefined;
  const rawStatus = payload.status ?? (payload.event ? payload.event.replace(/^order\./, '') : 'received');
  const mappedStatus = mapTIStatusToLocal(rawStatus);

  // Look for existing bridge record by ti_order_id or local_order_id
  let bridgeRow: { id: string; local_order_id: string } | null = null;

  if (tiOrderId) {
    bridgeRow = await db
      .prepare('SELECT id, local_order_id FROM ti_order_bridge WHERE ti_order_id = ? LIMIT 1')
      .bind(tiOrderId)
      .first<{ id: string; local_order_id: string }>();
  }

  if (!bridgeRow && payload.local_order_id) {
    bridgeRow = await db
      .prepare('SELECT id, local_order_id FROM ti_order_bridge WHERE local_order_id = ? LIMIT 1')
      .bind(payload.local_order_id)
      .first<{ id: string; local_order_id: string }>();
  }

  let bridgeId: string;
  let localOrderId: string | undefined;

  if (bridgeRow) {
    bridgeId = bridgeRow.id;
    localOrderId = bridgeRow.local_order_id;
    await db
      .prepare(
        'UPDATE ti_order_bridge SET status = ?, ti_order_id = COALESCE(?, ti_order_id), synced_at = datetime("now") WHERE id = ?'
      )
      .bind(mappedStatus, tiOrderId ?? null, bridgeId)
      .run();
  } else {
    bridgeId = crypto.randomUUID();
    localOrderId = payload.local_order_id ?? `ti-auto-${tiOrderId ?? bridgeId.slice(0, 8)}`;
    await db
      .prepare(
        'INSERT INTO ti_order_bridge (id, local_order_id, ti_order_id, status, synced_at, created_at) VALUES (?, ?, ?, ?, datetime("now"), datetime("now"))'
      )
      .bind(bridgeId, localOrderId, tiOrderId ?? null, mappedStatus)
      .run();
  }

  // Update local orders table if localOrderId matches
  if (localOrderId) {
    try {
      await db
        .prepare('UPDATE orders SET status = ?, updated_at = datetime("now") WHERE id = ?')
        .bind(mappedStatus, localOrderId)
        .run();
    } catch {
      // Fallback in case orders table does not have updated_at column
      try {
        await db
          .prepare('UPDATE orders SET status = ? WHERE id = ?')
          .bind(mappedStatus, localOrderId)
          .run();
      } catch (err) {
        log.warn('local_order_status_sync_skipped', { localOrderId, error: (err as Error).message });
      }
    }
  }

  log.info('ti_webhook_processed', { bridgeId, localOrderId, tiOrderId, mappedStatus });

  return {
    success: true,
    mapped_status: mappedStatus,
    local_order_id: localOrderId,
    bridge_id: bridgeId,
    updated: Boolean(bridgeRow)
  };
}
