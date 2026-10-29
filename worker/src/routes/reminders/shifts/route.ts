/**
 * Shift reminders are gated during the pilot: the former role-wide push path
 * cannot guarantee the recipient's store and the canonical schedule has no
 * delivery ledger. Callers receive an explicit disabled state.
 */
import { createLogger } from '../../../middleware/logger.js';
const log = createLogger({ route: 'reminders-shifts' });
export async function sendShiftReminders(_env: Record<string, unknown>): Promise<{
  checked: number; notified: number; errors: number; skipped: string;
}> {
  const skipped = 'PILOT_SHIFT_REMINDERS_DISABLED';
  log.info('Shift reminders disabled pending store-scoped delivery', { code: skipped });
  return { checked: 0, notified: 0, errors: 0, skipped };
}
