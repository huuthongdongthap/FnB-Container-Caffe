/**
 * Shift Reminder — checks staff_shifts for upcoming shifts (within reminder window)
 * Sends push notification to staff subscribers by role.
 * Called by the scheduled worker (every 5 min via wrangler.toml crons).
 */

import { createLogger } from '../../../middleware/logger.js';
import { sendPushToStaff } from '../../../tree/push/notifier.js';

const log = createLogger({ route: 'reminders-shifts' });

// Reminder window: notify 30 min before shift starts
const REMINDER_MINUTES = 30;

export async function sendShiftReminders(env: Record<string, unknown>): Promise<{ checked: number; notified: number; errors: number }> {
  try {
    const db = env.AURA_DB as import('@cloudflare/workers-types').D1Database;

    const now = new Date();
    const windowEnd = new Date(now.getTime() + REMINDER_MINUTES * 60_000).toISOString();

    // staff_shifts has: staff_name, role, clock_in, clock_in_planned, is_active
    const { results: shifts } = await db
      .prepare(
        `SELECT id, staff_name, role, clock_in_planned
         FROM staff_shifts
         WHERE clock_in_planned IS NOT NULL
           AND clock_in_planned >= ?
           AND clock_in_planned <= ?
           AND is_active = 1
           AND (reminder_sent IS NULL OR reminder_sent = 0)
        `
      )
      .bind(now.toISOString(), windowEnd)
      .all<{ id: string; staff_name: string; role: string; clock_in_planned: string }>();

    if (!shifts.length) {
      log.debug('No upcoming shifts in reminder window');
      return { checked: 0, notified: 0, errors: 0 };
    }

    log.info('Found shifts to remind', { count: shifts.length });

    let notified = 0;
    let errors = 0;

    for (const shift of shifts) {
      try {
        // Map staff role to push role (role in staff_shifts maps to push_subscriptions.role)
        const pushRole = shift.role.startsWith('staff-') ? shift.role : `staff-${shift.role}`;

        // @ts-ignore
      const result = await sendPushToStaff(env, {
          title: '⏰ Nhắc ca làm việc',
          body: `${shift.staff_name} — Ca bắt đầu lúc ${formatTime(shift.clock_in_planned)}`,
          data: { url: '/schedule', shiftId: shift.id },
        }, pushRole);

        if (result.sent > 0) {
          notified++;
        }

        // Mark reminder_sent = 1 regardless — don't spam
        await db
          .prepare('UPDATE staff_shifts SET reminder_sent = 1, updated_at = ? WHERE id = ?')
          .bind(now.toISOString(), shift.id)
          .run();

        log.info('Shift reminder processed', {
          staffName: shift.staff_name,
          shiftId: shift.id,
          sent: result.sent,
        });
      } catch (e) {
        errors++;
        log.error('Shift reminder error', { shiftId: shift.id, message: (e as Error).message });
      }
    }

    return { checked: shifts.length, notified, errors };
  } catch (err) {
    log.error('sendShiftReminders failed', { message: (err as Error).message });
    return { checked: 0, notified: 0, errors: 1 };
  }
}

function formatTime(iso: string): string {
  try {
    return new Date(iso).toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' });
  } catch {
    return iso;
  }
}
