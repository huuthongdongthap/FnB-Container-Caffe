/**
 * Mautic Bridge — Campaign enrollment tracking
 * Extracted from routes/mautic-bridge.ts to tree/mautic/.
 */

import type { D1Database } from '@cloudflare/workers-types';

export async function trackEnrollment(
  db: D1Database,
  customerId: string,
  campaignType: string,
  campaignId: string,
  mauticContactId: number,
  status: string
): Promise<string> {
  const id = `ce_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
  await db.prepare(
    `INSERT INTO campaign_enrollments (id, customer_id, campaign_type, campaign_id, created_at, mautic_contact_id, status)
     VALUES (?, ?, ?, ?, ?, ?, ?)`
  ).bind(id, customerId, campaignType, campaignId, new Date().toISOString(), String(mauticContactId), status).run();
  return id;
}

export async function isAlreadyEnrolled(
  db: D1Database,
  customerId: string,
  campaignType: string,
  days: number
): Promise<boolean> {
  const since = new Date(Date.now() - days * 86400000).toISOString();
  const row = await db.prepare(
    'SELECT 1 FROM campaign_enrollments WHERE customer_id = ? AND campaign_type = ? AND created_at >= ? LIMIT 1'
  ).bind(customerId, campaignType, since).first();
  return !!row;
}
