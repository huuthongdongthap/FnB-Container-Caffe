/**
 * Scheduled Cron Handler for Cloudflare Worker
 */

import { pruneOldMetrics } from './lib/metrics-collector';
import { dispatchAlerts } from './lib/alert-dispatcher';
import { withPrimarySession } from './lib/db';
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
  const primaryDb = env.AURA_DB ? withPrimarySession(env.AURA_DB) : env.AURA_DB;
  const primaryEnv: Env = env.AURA_DB ? { ...env, AURA_DB: primaryDb } : env;

  const safeWait = (promise: Promise<unknown>) => {
    ctx.waitUntil(promise.catch(() => {}));
  };

  safeWait(checkOverdueOrders(primaryEnv as unknown as Record<string, unknown>));
  safeWait(runPaymentReconciliation(primaryEnv as unknown as Record<string, unknown>));
  safeWait(pruneOldMetrics(primaryDb, 7));
  safeWait(processErpnextRetryQueue(primaryEnv as unknown as Record<string, unknown>));
  safeWait(processErpnextProductSync(primaryEnv as unknown as Record<string, unknown>));
  safeWait((async () => {
    try {
      await syncMauticContacts(primaryEnv as unknown as Record<string, unknown>);
    } catch {
      // Non-blocking scheduled sync
    }
    await Promise.allSettled([
      detectWinbackCandidates(primaryEnv as unknown as Record<string, unknown>),
      detectBirthdayCandidates(primaryEnv as unknown as Record<string, unknown>),
    ]);
  })());
  safeWait(autoPostDailySpecials(primaryEnv as unknown as Record<string, unknown>));
  safeWait(autoPostNewPromotions(primaryEnv as unknown as Record<string, unknown>));
  safeWait(autoPostWeeklyHighlights(primaryEnv as unknown as Record<string, unknown>));
  safeWait(runCampaignTriggers(primaryEnv as unknown as Record<string, unknown>));
  safeWait(runSopReminders(primaryEnv as unknown as Record<string, unknown>));
  safeWait(sendShiftReminders(primaryEnv as unknown as Record<string, unknown>));
  safeWait(dispatchAlerts(primaryEnv));
}
