/**
 * Scheduled Cron Handler for Cloudflare Worker
 */

import { pruneOldMetrics } from './lib/metrics-collector';
import { dispatchAlerts } from './lib/alert-dispatcher';
import type { Env } from './types/env';
import {
  checkOverdueOrders,
  processErpnextRetryQueue,
  processErpnextProductSync,
  syncMauticContacts,
  detectWinbackCandidates,
  detectBirthdayCandidates,
  runCampaignTriggers,
  runSopReminders,
  runPaymentReconciliation,
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
  const safeWait = (promise: Promise<unknown>) => {
    ctx.waitUntil(promise.catch(() => {}));
  };

  safeWait(checkOverdueOrders(env as unknown as Record<string, unknown>));
  safeWait(runPaymentReconciliation(env as unknown as Record<string, unknown>));
  safeWait(pruneOldMetrics(env.AURA_DB, 7));
  safeWait(processErpnextRetryQueue(env as unknown as Record<string, unknown>));
  safeWait(processErpnextProductSync(env as unknown as Record<string, unknown>));
  safeWait((async () => {
    try {
      await syncMauticContacts(env as unknown as Record<string, unknown>);
    } catch {
      // Non-blocking scheduled sync
    }
    await Promise.allSettled([
      detectWinbackCandidates(env as unknown as Record<string, unknown>),
      detectBirthdayCandidates(env as unknown as Record<string, unknown>),
    ]);
  })());
  safeWait(autoPostDailySpecials(env as unknown as Record<string, unknown>));
  safeWait(autoPostNewPromotions(env as unknown as Record<string, unknown>));
  safeWait(autoPostWeeklyHighlights(env as unknown as Record<string, unknown>));
  safeWait(runCampaignTriggers(env as unknown as Record<string, unknown>));
  safeWait(runSopReminders(env as unknown as Record<string, unknown>));
  safeWait(sendShiftReminders(env as unknown as Record<string, unknown>));
  safeWait(dispatchAlerts(env));
}
