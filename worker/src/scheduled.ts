/**
 * Scheduled Cron Handler for Cloudflare Worker
 */

import { pruneOldMetrics } from './lib/metrics-collector';
import type { Env } from './types/env';
import {
  checkOverdueOrders,
  processErpnextRetryQueue,
  processErpnextProductSync,
  syncMauticContacts,
  detectWinbackCandidates,
  detectBirthdayCandidates,
  runCampaignTriggers,
} from './routes/cron';
import {
  autoPostDailySpecials,
  autoPostNewPromotions,
  autoPostWeeklyHighlights,
} from './routes/mixpost';
import { sendShiftReminders } from './routes/reminders/shifts/route';

export async function handleScheduled(
  _controller: ScheduledController,
  env: Env,
  ctx: ExecutionContext
): Promise<void> {
  ctx.waitUntil(checkOverdueOrders(env as unknown as Record<string, unknown>));
  ctx.waitUntil(pruneOldMetrics(env.AURA_DB, 7));
  ctx.waitUntil(processErpnextRetryQueue(env as unknown as Record<string, unknown>));
  ctx.waitUntil(processErpnextProductSync(env as unknown as Record<string, unknown>));
  ctx.waitUntil((async () => {
    await syncMauticContacts(env as unknown as Record<string, unknown>);
    await Promise.all([
      detectWinbackCandidates(env as unknown as Record<string, unknown>),
      detectBirthdayCandidates(env as unknown as Record<string, unknown>),
    ]);
  })());
  ctx.waitUntil(autoPostDailySpecials(env as unknown as Record<string, unknown>));
  ctx.waitUntil(autoPostNewPromotions(env as unknown as Record<string, unknown>));
  ctx.waitUntil(autoPostWeeklyHighlights(env as unknown as Record<string, unknown>));
  ctx.waitUntil(runCampaignTriggers(env as unknown as Record<string, unknown>));
  ctx.waitUntil(sendShiftReminders(env as unknown as Record<string, unknown>));
}
