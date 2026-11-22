import type { D1Database } from '@cloudflare/workers-types';
import { MixpostApiError } from '../../lib/mixpost-client';

const cadence = {
  'daily-specials': 7,
  'new-promotions': 8,
  'weekly-highlights': 9,
} as const;

type AutoPostJob = keyof typeof cadence;

export function autoPostPeriod(job: AutoPostJob, now: Date): string | undefined {
  // Vietnam is UTC+7; use UTC getters on the shifted date to avoid the host time zone.
  const local = new Date(now.getTime() + 7 * 60 * 60 * 1000);
  if (local.getUTCHours() !== cadence[job] || local.getUTCMinutes() >= 5) return;

  if (job !== 'weekly-highlights') return local.toISOString().slice(0, 10);
  if (local.getUTCDay() !== 1) return;

  // The Thursday of an ISO week determines its week-year.
  local.setUTCDate(local.getUTCDate() + 3);
  local.setUTCHours(0, 0, 0, 0);
  const year = local.getUTCFullYear();
  const week = 1 + Math.floor((local.getTime() - Date.UTC(year, 0, 1)) / (7 * 86_400_000));
  return `${year}-W${String(week).padStart(2, '0')}`;
}

export async function createClaimedAutoPost(
  db: D1Database,
  job: AutoPostJob,
  tenantId: string,
  key: string,
  now: Date,
  createPost: () => Promise<Record<string, unknown>>,
): Promise<boolean> {
  const jobId = `mixpost:${job}:v1`;
  const id = `${jobId}:${JSON.stringify([tenantId, key])}`;
  const claim = await db.prepare(
    "INSERT OR IGNORE INTO cron_runs (id, tenant_id, job_id, status, payload, started_at) VALUES (?, ?, ?, 'claimed', ?, ?)"
  ).bind(id, tenantId, jobId, JSON.stringify({ key }), now.toISOString()).run();
  if (claim.meta.changes !== 1) return false;

  let postId: string | number;
  try {
    const post = await createPost();
    if ((typeof post.id !== 'string' || !post.id.trim()) && typeof post.id !== 'number') {
      throw new Error('Mixpost response did not include a post ID');
    }
    postId = post.id;
  } catch (error) {
    // Authentication and validation rejections cannot have created a post.
    if (error instanceof MixpostApiError && [401, 403, 422].includes(error.status)) {
      await db.prepare("DELETE FROM cron_runs WHERE id = ? AND status = 'claimed'")
        .bind(id).run();
      return false;
    }
    // Network and server errors can arrive after creation; retain these claims.
    await db.prepare("UPDATE cron_runs SET status = 'unknown', error = ? WHERE id = ?")
      .bind('Mixpost did not confirm creation with a post ID', id).run();
    return false;
  }

  // If the completion write fails, the original claim still prevents another POST.
  await db.prepare("UPDATE cron_runs SET status = 'completed', completed_at = ?, output = ? WHERE id = ?")
    .bind(new Date().toISOString(), JSON.stringify({ postId }), id).run();
  return true;
}
