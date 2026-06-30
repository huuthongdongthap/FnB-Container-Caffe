/**
 * Mautic Contact Sync Bridge — pushes Aura D1 customer data to Mautic.
 *
 * Runs via CF Worker cron. Maps loyalty tiers, recency, and birthdays
 * to Mautic segments.
 *
 * Usage (cron):
 *   import { syncMauticContacts } from './routes/mautic-bridge.js';
 *   await syncMauticContacts(env);
 *
 * Segment env vars (wrangler.toml [vars]):
 *   MAUTIC_SEGMENT_LOYALTY_BRONZE, _SILVER, _GOLD, _PLATINUM
 *   MAUTIC_SEGMENT_ACTIVE, _AT_RISK, _INACTIVE
 *   MAUTIC_SEGMENT_BIRTHDAY_THIS_MONTH
 */

import { createMauticClient } from '../lib/mautic-client.js';
import { createLogger } from '../utils/logger.js';

const log = createLogger({ route: 'mautic-bridge' });

const BATCH_SIZE = 50;
const PHONE_DOMAIN = '@aura-cafe.internal';

// ---------------------------------------------------------------------------
// Contact Transformation
// ---------------------------------------------------------------------------

/**
 * Transform a D1 customer row into Mautic contact payload.
 * Custom fields (loyalty_tier, birthday, etc.) are flattened to top-level
 * keys, matching Mautic custom field aliases.
 *
 * @param {Object} customer - D1 customers row with joined order aggregates
 * @param {string} customer.phone - Customer phone (primary identifier)
 * @param {string} [customer.name] - Customer display name
 * @param {string} [customer.email] - Customer email (may be null)
 * @param {string} [customer.loyalty_tier] - Loyalty tier (bronze/silver/gold/platinum)
 * @param {string} [customer.last_order_date] - ISO date of most recent order
 * @param {string} [customer.birthday] - Birthday date string
 * @param {number} [customer.total_orders] - Total order count
 * @returns {Object} Mautic contact object
 */
export function toMauticContact(customer) {
  return {
    email: customer.email || `${customer.phone}${PHONE_DOMAIN}`,
    firstname: customer.name || 'Khách',
    phone: customer.phone,
    // Custom fields at top level — Mautic maps by alias
    loyalty_tier: customer.loyalty_tier || 'bronze',
    last_order_date: customer.last_order_date || null,
    birthday: customer.birthday || null,
    total_orders: customer.total_orders || 0,
  };
}

// ---------------------------------------------------------------------------
// Main Sync
// ---------------------------------------------------------------------------

/**
 * Incremental sync: query D1 customers updated since last KV cursor,
 * batch-upsert to Mautic, then apply segment membership.
 *
 * KV key: mautic_last_sync_ts (ISO string)
 *
 * @param {Object} env - CF Worker env (AURA_DB, AUTH_KV, MAUTIC_*)
 * @returns {Promise<{synced: number, skipped?: boolean, timestamp?: string}>}
 */
export async function syncMauticContacts(env) {
  const client = createMauticClient(env);
  if (!client) {
    log.info('[MAUTIC] Not configured, skipping sync');
    return { synced: 0, skipped: true };
  }

  const db = env.AURA_DB;

  // Get last sync cursor from KV; default to epoch start for first run
  const lastSync = await env.AUTH_KV.get('mautic_last_sync_ts')
    || '1970-01-01T00:00:00.000Z';

  // Query customers updated since last sync, joined with order aggregates
  const { results: customers } = await db.prepare(`
    SELECT c.*,
      (SELECT MAX(o.created_at) FROM orders o WHERE o.customer_phone = c.phone) as last_order_date,
      (SELECT COUNT(*) FROM orders o WHERE o.customer_phone = c.phone) as total_orders
    FROM customers c
    WHERE c.updated_at > ?
    ORDER BY c.updated_at ASC
  `).bind(lastSync).all();

  if (!customers || customers.length === 0) {
    log.info('[MAUTIC] No customers to sync');
    return { synced: 0 };
  }

  // Transform D1 rows to Mautic contact format
  const contacts = customers.map(toMauticContact);

  // Batch upsert in groups of 50 (Mautic API limit)
  let synced = 0;
  let anyBatchSucceeded = false;
  const allBatchResults = [];

  for (let i = 0; i < contacts.length; i += BATCH_SIZE) {
    const batch = contacts.slice(i, i + BATCH_SIZE);
    try {
      const result = await client.batchUpsertContacts(batch);
      const batchSuccess = (result.created?.length || 0) + (result.updated?.length || 0);
      synced += batchSuccess;
      anyBatchSucceeded = true;
      allBatchResults.push(result);
      log.info('[MAUTIC] Batch synced', { batchIndex: i / BATCH_SIZE, count: batch.length, ok: batchSuccess });
    } catch (err) {
      log.error('[MAUTIC] Batch sync error', { batchIndex: i / BATCH_SIZE, error: err.message });
      // Continue with next batch — partial sync is better than total failure
      allBatchResults.push({ created: [], updated: [], errors: [] });
    }
  }

  // Build email → contactId map from batch responses for segment mapping
  const contactIdMap = {};
  for (const result of allBatchResults) {
    for (const contact of [...result.created, ...result.updated]) {
      if (contact.id && contact.email) {
        contactIdMap[contact.email] = contact.id;
      }
    }
  }

  // Only advance KV cursor if at least one batch succeeded.
  // If all batches fail (e.g. Mautic downtime), cursor stays put so the next
  // cron run re-attempts the same customers.
  const now = new Date().toISOString();
  if (anyBatchSucceeded) {
    await env.AUTH_KV.put('mautic_last_sync_ts', now);
  }

  // Apply segment membership based on tier, recency, and birthday
  await syncSegments(env, client, customers, contactIdMap);

  log.info('[MAUTIC] Sync complete', { synced, timestamp: now });
  return { synced, timestamp: now };
}

// ---------------------------------------------------------------------------
// Segment Mapping
// ---------------------------------------------------------------------------

/**
 * Assign customers to Mautic segments based on loyalty tier, order recency,
 * and birthday month.
 *
 * Segment IDs are read from env vars (wrangler.toml [vars]).
 * Contacts are looked up via the email→contactId map built during upsert.
 *
 * @param {Object} env - CF Worker env with MAUTIC_SEGMENT_* vars
 * @param {Object} client - MauticClient instance
 * @param {Array<Object>} customers - Original D1 customer rows
 * @param {Object<string, number>} contactIdMap - email → Mautic contactId
 * @returns {Promise<number>} Number of segment assignments made
 */
export async function syncSegments(env, client, customers, contactIdMap) {
  const segMap = buildSegmentConfig(env);
  const now = new Date();
  const currentMonth = now.getMonth(); // 0-indexed (0=January)

  let assigned = 0;

  for (const customer of customers) {
    const email = customer.email || `${customer.phone}${PHONE_DOMAIN}`;
    const contactId = contactIdMap[email];
    if (!contactId) {
      continue; // Contact not in batch response; skip segment assignment
    }

    // ── Tier-based segment ────────────────────────────────────────────
    const tierSegKey = getTierSegmentKey(customer.loyalty_tier);
    if (tierSegKey && segMap[tierSegKey]) {
      await client.addContactToSegment(contactId, segMap[tierSegKey]);
      assigned++;
    }

    // ── Recency-based segment ─────────────────────────────────────────
    const recencySegKey = getRecencySegment(customer.last_order_date, now);
    if (recencySegKey && segMap[recencySegKey]) {
      await client.addContactToSegment(contactId, segMap[recencySegKey]);
      assigned++;
    }

    // ── Birthday segment (month matches current) ──────────────────────
    if (customer.birthday && segMap.birthday_this_month) {
      const bdayMonth = new Date(customer.birthday).getMonth();
      if (bdayMonth === currentMonth) {
        await client.addContactToSegment(contactId, segMap.birthday_this_month);
        assigned++;
      }
    }
  }

  log.info('[MAUTIC] Segments assigned', { assigned });
  return assigned;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Build segment ID map from env vars.
 * Only includes keys that are configured (truthy).
 *
 * @param {Object} env
 * @returns {Object<string, number|string>}
 */
function buildSegmentConfig(env) {
  const map = {
    loyalty_bronze: env.MAUTIC_SEGMENT_LOYALTY_BRONZE,
    loyalty_silver: env.MAUTIC_SEGMENT_LOYALTY_SILVER,
    loyalty_gold: env.MAUTIC_SEGMENT_LOYALTY_GOLD,
    loyalty_platinum: env.MAUTIC_SEGMENT_LOYALTY_PLATINUM,
    recency_active: env.MAUTIC_SEGMENT_ACTIVE,
    recency_at_risk: env.MAUTIC_SEGMENT_AT_RISK,
    recency_inactive: env.MAUTIC_SEGMENT_INACTIVE,
    birthday_this_month: env.MAUTIC_SEGMENT_BIRTHDAY_THIS_MONTH,
  };
  // Strip unset keys
  const result = {};
  for (const [key, val] of Object.entries(map)) {
    if (val != null) { result[key] = val; }
  }
  return result;
}

/**
 * Map loyalty tier string to segment config key.
 * Normalizes to lowercase — D1 stores 'bronze'/'silver'/'gold'/'platinum'.
 *
 * @param {string} tier - bronze | silver | gold | platinum (case-insensitive)
 * @returns {string|null} Segment config key or null if unknown
 */
function getTierSegmentKey(tier) {
  const normalized = (tier || '').toLowerCase();
  const map = {
    bronze: 'loyalty_bronze',
    silver: 'loyalty_silver',
    gold: 'loyalty_gold',
    platinum: 'loyalty_platinum',
  };
  return map[normalized] || null;
}

/**
 * Determine recency segment key based on days since last order.
 *
 * - Active: <= 30 days
 * - At-risk: 31–60 days
 * - Inactive: > 60 days, or no orders (null last_order_date)
 *
 * @param {string|null} lastOrderDate - ISO date string or null
 * @param {Date} referenceDate - Reference date for calculation
 * @returns {string} Segment config key
 */
function getRecencySegment(lastOrderDate, referenceDate) {
  if (!lastOrderDate) { return 'recency_inactive'; }

  const orderDate = new Date(lastOrderDate);
  const diffMs = referenceDate.getTime() - orderDate.getTime();
  const daysDiff = Math.floor(diffMs / (1000 * 60 * 60 * 24));

  if (daysDiff <= 30) { return 'recency_active'; }
  if (daysDiff <= 60) { return 'recency_at_risk'; }
  return 'recency_inactive';
}

// ═══════════════════════════════════════════════════════════════════════════
// Campaign Enrollment Triggers (Phase 04 — Mautic Marketing Automation)
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Generate a short unique ID for campaign_enrollment rows.
 * Portable across Cloudflare Workers and Node.js (no crypto dependency).
 */
function enrollmentId() {
  return 'ce_' + Date.now().toString(36) + '_' + Math.random().toString(36).slice(2, 10);
}

// ── Helpers ────────────────────────────────────────────────────────────────

/**
 * Check whether a customer has been enrolled in a given campaign type within
 * a rolling window. Used for dedup — prevents re-enrolling the same customer
 * before the window expires.
 *
 * @param {import('@cloudflare/workers-types').D1Database} db
 * @param {string} customerId
 * @param {string} campaignType  — 'winback' | 'birthday' | 'promo'
 * @param {number} [windowDays=30]
 * @returns {Promise<boolean>}
 */
export async function isAlreadyEnrolled(db, customerId, campaignType, windowDays = 30) {
  if (!customerId || !campaignType) {return false;}
  const cutoff = new Date(Date.now() - windowDays * 86_400_000).toISOString();
  try {
    const row = await db.prepare(`
      SELECT 1 FROM campaign_enrollments
      WHERE customer_id = ? AND campaign_type = ? AND created_at >= ?
      LIMIT 1
    `).bind(customerId, campaignType, cutoff).first();
    return !!row;
  } catch (err) {
    log.error('[ENROLLMENT] check error', { customerId, campaignType, error: err.message });
    return false;
  }
}

/**
 * Persist a campaign enrollment row for dedup, audit, and Mautic contact
 * ID tracking.
 *
 * @param {import('@cloudflare/workers-types').D1Database} db
 * @param {string} customerId
 * @param {string} campaignType
 * @param {string} campaignId
 * @param {number|string} contactId
 * @param {'enrolled'|'failed'} status
 * @returns {Promise<string>} Enrollment row ID
 */
export async function trackEnrollment(db, customerId, campaignType, campaignId, contactId, status) {
  const id = enrollmentId();
  const now = new Date().toISOString();
  try {
    await db.prepare(`
      INSERT INTO campaign_enrollments
        (id, customer_id, campaign_type, campaign_id, enrolled_at, mautic_contact_id, status, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `).bind(id, customerId, campaignType, campaignId, now, String(contactId), status, now).run();
    log.info('[ENROLLMENT] tracked', { id, customerId, campaignType, status });
  } catch (err) {
    log.error('[ENROLLMENT] insert error', { customerId, campaignType, error: err.message });
  }
  return id;
}

/**
 * Resolve the Mautic contact ID for a customer. Checks previously stored
 * mappings from campaign_enrollments first; falls back to createOrUpdateContact
 * upsert which always returns a valid contact ID.
 *
 * @param {import('../lib/mautic-client.js').MauticClient} client
 * @param {import('@cloudflare/workers-types').D1Database} db
 * @param {Object} customer — D1 customer row with id, name, phone, email, loyalty_tier
 * @returns {Promise<number>} Mautic contact ID
 */
async function resolveMauticContactId(client, db, customer) {
  // Check existing mapping from prior enrollments
  try {
    const row = await db.prepare(`
      SELECT mautic_contact_id FROM campaign_enrollments
      WHERE customer_id = ? AND mautic_contact_id IS NOT NULL
      ORDER BY enrolled_at DESC LIMIT 1
    `).bind(customer.id).first();
    if (row && row.mautic_contact_id) {
      return Number(row.mautic_contact_id);
    }
  } catch {
    // Fall through to upsert if lookup fails
  }

  // Upsert to Mautic to get/create the contact
  const contact = toMauticContact(customer);
  return await client.createOrUpdateContact({
    email: contact.email,
    firstname: contact.firstname,
    phone: contact.phone,
    customFields: { loyalty_tier: contact.loyalty_tier },
  });
}

// ── Win-Back Trigger ─────────────────────────────────────────────────────

/**
 * Detect customers whose last order was 30–31 days ago and enroll them in
 * the Mautic win-back campaign. Skips customers already enrolled in the
 * last 30 days.
 *
 * Env required: MAUTIC_CAMPAIGN_WINBACK
 *
 * @param {Object} env — CF Worker env (AURA_DB, MAUTIC_*)
 * @returns {Promise<{detected: number, enrolled: number}>}
 */
export async function detectWinbackCandidates(env) {
  const client = createMauticClient(env);
  if (!client) {
    log.info('[WINBACK] Mautic not configured, skipping');
    return { detected: 0, enrolled: 0 };
  }

  const db = env.AURA_DB;
  const campaignId = env.MAUTIC_CAMPAIGN_WINBACK;
  if (!campaignId) {
    log.warn('[WINBACK] MAUTIC_CAMPAIGN_WINBACK env var not set, skipping');
    return { detected: 0, enrolled: 0 };
  }

  let candidates;
  try {
    const { results } = await db.prepare(`
      SELECT c.id, c.name, c.phone, c.email, c.loyalty_tier
      FROM customers c
      WHERE c.phone IS NOT NULL
        AND c.id NOT IN (
          SELECT ce.customer_id FROM campaign_enrollments ce
          WHERE ce.campaign_type = 'winback'
            AND ce.created_at >= datetime('now', '-30 days')
        )
        AND (
          SELECT MAX(o.created_at) FROM orders o WHERE o.customer_phone = c.phone
        ) BETWEEN datetime('now', '-31 days') AND datetime('now', '-30 days')
    `).all();
    candidates = results || [];
  } catch (err) {
    log.error('[WINBACK] Query error', { error: err.message });
    return { detected: 0, enrolled: 0 };
  }

  log.info('[WINBACK] Candidates found', { detected: candidates.length });

  let enrolled = 0;
  for (const customer of candidates) {
    try {
      const contactId = await resolveMauticContactId(client, db, customer);
      const ok = await client.addContactToCampaign(contactId, Number(campaignId));
      await trackEnrollment(db, customer.id, 'winback', String(campaignId), contactId, ok ? 'enrolled' : 'failed');
      if (ok) {enrolled++;}
    } catch (err) {
      log.error('[WINBACK] Enrollment error', { customerId: customer.id, error: err.message });
      await trackEnrollment(db, customer.id, 'winback', String(campaignId), 0, 'failed').catch(() => {});
    }
  }

  log.info('[WINBACK] Complete', { detected: candidates.length, enrolled });
  return { detected: candidates.length, enrolled };
}

// ── Birthday Trigger ────────────────────────────────────────────────────

/**
 * Detect customers whose birthday falls in the current month and enroll them
 * in the Mautic birthday campaign. Skips customers already enrolled this
 * month and those who have already used their birthday discount.
 *
 * Env required: MAUTIC_CAMPAIGN_BIRTHDAY
 *
 * @param {Object} env — CF Worker env (AURA_DB, MAUTIC_*)
 * @returns {Promise<{detected: number, enrolled: number}>}
 */
export async function detectBirthdayCandidates(env) {
  const client = createMauticClient(env);
  if (!client) {
    log.info('[BIRTHDAY] Mautic not configured, skipping');
    return { detected: 0, enrolled: 0 };
  }

  const db = env.AURA_DB;
  const campaignId = env.MAUTIC_CAMPAIGN_BIRTHDAY;
  if (!campaignId) {
    log.warn('[BIRTHDAY] MAUTIC_CAMPAIGN_BIRTHDAY env var not set, skipping');
    return { detected: 0, enrolled: 0 };
  }

  const currentMonth = String(new Date().getMonth() + 1).padStart(2, '0');

  let candidates;
  try {
    const { results } = await db.prepare(`
      SELECT c.id, c.name, c.phone, c.email, c.loyalty_tier, c.date_of_birth AS birthday
      FROM customers c
      WHERE c.phone IS NOT NULL
        AND c.date_of_birth IS NOT NULL
        AND substr(c.date_of_birth, 6, 2) = ?
        AND c.id NOT IN (
          SELECT ce.customer_id FROM campaign_enrollments ce
          WHERE ce.campaign_type = 'birthday'
            AND strftime('%Y-%m', ce.created_at) = strftime('%Y-%m', 'now')
        )
        AND c.id NOT IN (
          SELECT l.customer_id FROM loyalty_audit_log l
          WHERE l.action = 'birthday_discount_used'
            AND strftime('%Y-%m', l.created_at) = strftime('%Y-%m', 'now')
        )
    `).bind(currentMonth).all();
    candidates = results || [];
  } catch (err) {
    log.error('[BIRTHDAY] Query error', { error: err.message });
    return { detected: 0, enrolled: 0 };
  }

  log.info('[BIRTHDAY] Candidates found', { detected: candidates.length });

  let enrolled = 0;
  for (const customer of candidates) {
    try {
      const contactId = await resolveMauticContactId(client, db, customer);
      const ok = await client.addContactToCampaign(contactId, Number(campaignId));
      await trackEnrollment(db, customer.id, 'birthday', String(campaignId), contactId, ok ? 'enrolled' : 'failed');
      if (ok) {enrolled++;}
    } catch (err) {
      log.error('[BIRTHDAY] Enrollment error', { customerId: customer.id, error: err.message });
      await trackEnrollment(db, customer.id, 'birthday', String(campaignId), 0, 'failed').catch(() => {});
    }
  }

  log.info('[BIRTHDAY] Complete', { detected: candidates.length, enrolled });
  return { detected: candidates.length, enrolled };
}

// ── Promo Campaign Trigger ─────────────────────────────────────────────

/**
 * Manually trigger a promotional campaign enrollment. Supports filtering by
 * customer segment (loyalty tier or recency bucket).
 *
 * @param {Object} env — CF Worker env (AURA_DB, MAUTIC_CAMPAIGN_PROMO)
 * @param {Object} [opts]
 * @param {Object} [opts.segment] — Segment filter, e.g. { tier: 'GOLD' } or { recency: 'inactive' }
 * @param {string} [opts.templateName] — Template name for metadata
 * @param {string} [opts.promoTitle] — Promo title for metadata
 * @param {string} [opts.promoDesc] — Promo description for metadata
 * @returns {Promise<{enrolled: number}>}
 */
export async function triggerPromoCampaign(env, { segment, templateName, promoTitle, promoDesc } = {}) {
  const client = createMauticClient(env);
  if (!client) {
    log.info('[PROMO] Mautic not configured, skipping');
    return { enrolled: 0 };
  }

  const db = env.AURA_DB;
  const campaignId = env.MAUTIC_CAMPAIGN_PROMO;
  if (!campaignId) {
    log.warn('[PROMO] MAUTIC_CAMPAIGN_PROMO env var not set, skipping');
    return { enrolled: 0 };
  }

  // Build WHERE clause from optional segment filter
  const conditions = ['c.phone IS NOT NULL'];
  const params = [];

  if (segment && segment.tier) {
    conditions.push('c.loyalty_tier = ?');
    params.push((segment.tier || '').toLowerCase());
  }

  if (segment && segment.recency) {
    if (segment.recency === 'active') {
      conditions.push(`(
        SELECT MAX(o.created_at) FROM orders o WHERE o.customer_phone = c.phone
      ) >= datetime('now', '-30 days')`);
    } else if (segment.recency === 'at_risk') {
      conditions.push(`(
        SELECT MAX(o.created_at) FROM orders o WHERE o.customer_phone = c.phone
      ) BETWEEN datetime('now', '-60 days') AND datetime('now', '-31 days')`);
    } else if (segment.recency === 'inactive') {
      conditions.push(`(
        (SELECT MAX(o.created_at) FROM orders o WHERE o.customer_phone = c.phone) IS NULL
        OR (SELECT MAX(o.created_at) FROM orders o WHERE o.customer_phone = c.phone) < datetime('now', '-60 days')
      )`);
    }
  }

  const sql = `SELECT c.id, c.name, c.phone, c.email, c.loyalty_tier
    FROM customers c
    WHERE ${conditions.join(' AND ')}`;

  let candidates;
  try {
    const stmt = db.prepare(sql);
    const bound = params.length > 0 ? stmt.bind(...params) : stmt;
    const { results } = await bound.all();
    candidates = results || [];
  } catch (err) {
    log.error('[PROMO] Query error', { error: err.message });
    return { enrolled: 0 };
  }

  log.info('[PROMO] Candidates found', { detected: candidates.length, templateName: templateName || '' });

  let enrolled = 0;
  for (const customer of candidates) {
    try {
      const contactId = await resolveMauticContactId(client, db, customer);
      const ok = await client.addContactToCampaign(contactId, Number(campaignId));
      await trackEnrollment(db, customer.id, 'promo', String(campaignId), contactId, ok ? 'enrolled' : 'failed');
      if (ok) {enrolled++;}
    } catch (err) {
      log.error('[PROMO] Enrollment error', { customerId: customer.id, error: err.message });
      await trackEnrollment(db, customer.id, 'promo', String(campaignId), 0, 'failed').catch(() => {});
    }
  }

  log.info('[PROMO] Complete', { enrolled, templateName, promoTitle, promoDesc });
  return { enrolled, templateName, promoTitle, promoDesc };
}
