/**
 * CRM — Declarative customer segments.
 *
 * Segments are read-only views over the customer + orders tables.
 * Each segment is a predicate over 360-fields (band, lifetimePoints,
 * lastOrderAt). Definitions live in KV (`crm:segments`) with code
 * defaults for the 5 core segments.
 *
 * Counts + member lists are computed on read via post-filter: D1 lacks
 * the band column, so we evaluate the predicate in-memory against a
 * lightweight customer scan (id, tier, lifetime_points, last_order_at).
 */

import type { D1Database } from '@cloudflare/workers-types';
import type { KVNamespace } from '@cloudflare/workers-types';
import { createLogger } from 'worker/src/middleware/logger';
import { computeFrequencyBand, resolveBandPolicy, type BandPolicy } from './frequency-band';

const log = createLogger({ route: 'crm.segments' });

export type SegmentKey =
  | 'new_first_week'
  | 'regular'
  | 'regular_high_value'
  | 'lapsing_30d'
  | 'dormant_60d'
  | string;

export interface SegmentDefinition {
  key: SegmentKey;
  labelVi: string;
  labelEn: string;
  description: string;
  /** Optional high-value threshold (VND lifetime spend) for band+spend segments. */
  highValueThresholdVnd?: number;
}

export interface SegmentRow {
  id: string;
  name: string | null;
  phone: string | null;
  tier: string;
  lifetimePoints: number;
  lastOrderAt: string | null;
  band: string;
}

export interface SegmentResult {
  key: SegmentKey;
  labelVi: string;
  labelEn: string;
  description: string;
  count: number;
  customers: SegmentRow[];
}

export interface BuildOptions {
  limit?: number;
  offset?: number;
  tenantId?: string;
}

const MS_PER_DAY = 86_400_000;

export const CUSTOM_SEGMENTS_KV_KEY = 'crm:segments';
export const BAND_POLICY_KV_KEY = 'crm:band_policy';

export function getSegmentsKvKey(tenantId?: string): string {
  const clean = tenantId && tenantId.trim() ? tenantId.trim() : 'default';
  return clean === 'default' || clean === '*' || clean.toLowerCase() === 'hq' ? CUSTOM_SEGMENTS_KV_KEY : `${CUSTOM_SEGMENTS_KV_KEY}:${clean}`;
}

export function getBandPolicyKvKey(tenantId?: string): string {
  const clean = tenantId && tenantId.trim() ? tenantId.trim() : 'default';
  return clean === 'default' || clean === '*' || clean.toLowerCase() === 'hq' ? BAND_POLICY_KV_KEY : `${BAND_POLICY_KV_KEY}:${clean}`;
}

export const DEFAULT_SEGMENTS: SegmentDefinition[] = [
  {
    key: 'new_first_week',
    labelVi: 'Khách hàng mới',
    labelEn: 'New customers',
    description: 'First order within the last 7 days',
  },
  {
    key: 'regular',
    labelVi: 'Khách thường xuyên',
    labelEn: 'Regular',
    description: 'Ordered within the last 60 days',
  },
  {
    key: 'regular_high_value',
    labelVi: 'Khách VIP',
    labelEn: 'High-value regular',
    description: 'Ordered within 60 days and lifetime spend ≥ 1,000,000 VND',
    highValueThresholdVnd: 1_000_000,
  },
  {
    key: 'lapsing_30d',
    labelVi: 'Sắp rời bỏ',
    labelEn: 'Lapsing',
    description: 'No order in 60–120 days',
  },
  {
    key: 'dormant_60d',
    labelVi: 'Khách ngủ quên',
    labelEn: 'Dormant',
    description: 'No order in 120+ days',
  },
];

/**
 * Resolve segment definitions: KV override replaces defaults entirely
 * (merge is not supported — owner controls the full list). Bad JSON or
 * missing key → defaults.
 */
export async function loadSegmentDefinitions(
  kv?: KVNamespace,
  tenantId?: string,
): Promise<SegmentDefinition[]> {
  if (!kv) return DEFAULT_SEGMENTS;
  try {
    const tenantKey = getSegmentsKvKey(tenantId);
    const raw = (await kv.get(tenantKey)) ?? (tenantKey !== CUSTOM_SEGMENTS_KV_KEY ? await kv.get(CUSTOM_SEGMENTS_KV_KEY) : null);
    if (!raw) return DEFAULT_SEGMENTS;
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed) || parsed.length === 0) return DEFAULT_SEGMENTS;
    // Minimal shape guard: each entry must have key + label.
    const valid = parsed.every(
      (s) => s && typeof s.key === 'string' && (typeof s.labelVi === 'string' || typeof s.labelEn === 'string'),
    );
    return valid ? (parsed as SegmentDefinition[]) : DEFAULT_SEGMENTS;
  } catch {
    return DEFAULT_SEGMENTS;
  }
}

/**
 * Lightweight customer scan: id, tier, lifetime_points, last_order_at.
 * Used to evaluate segment predicates in-memory.
 */
async function scanCustomers(db: D1Database, tenantId?: string): Promise<
  Array<{
    id: string;
    name: string | null;
    phone: string | null;
    tier: string;
    lifetime_points: number;
    last_order_at: string | null;
    first_order_at?: string | null;
    order_count?: number;
  }>
> {
  try {
    const normTenant = typeof tenantId === 'string' && tenantId.trim() ? tenantId.trim() : tenantId;
    const hasTenantFilter = Boolean(normTenant && normTenant !== '*' && String(normTenant).toLowerCase() !== 'hq');
    const whereClause = hasTenantFilter
      ? "WHERE COALESCE(NULLIF(c.tenant_id, ''), 'default') = ? OR COALESCE(NULLIF(TRIM(c.tenant_id), ''), 'default') = ?1"
      : '';
    try {
      const stmt = db.prepare(
        `SELECT c.id, c.name, c.phone, c.loyalty_tier as tier, c.lifetime_points, c.tenant_id,
                MAX(o.created_at) as last_order_at,
                MIN(o.created_at) as first_order_at,
                COUNT(o.id) as order_count
         FROM customers c
         LEFT JOIN orders o
           ON (o.customer_id = c.id OR (c.phone IS NOT NULL AND c.phone != '' AND o.customer_phone = c.phone))
          AND o.status != 'cancelled'
          AND (COALESCE(NULLIF(o.tenant_id, ''), 'default') = COALESCE(NULLIF(c.tenant_id, ''), 'default') OR COALESCE(NULLIF(TRIM(o.tenant_id), ''), 'default') = COALESCE(NULLIF(TRIM(c.tenant_id), ''), 'default'))
         ${whereClause}
         GROUP BY c.id
         LIMIT 1000`,
      );
      const bound = hasTenantFilter && typeof stmt.bind === 'function' ? stmt.bind(normTenant!) : stmt;
      const { results } = await bound.all<{
        id: string;
        name: string | null;
        phone: string | null;
        tier: string;
        lifetime_points: number;
        last_order_at: string | null;
        first_order_at?: string | null;
        order_count?: number;
        tenant_id?: string | null;
      }>();
      const rows = results ?? [];
      return hasTenantFilter
        ? rows.filter((r) => !('tenant_id' in r) || r.tenant_id === undefined || ((String(r.tenant_id ?? '').trim() || 'default') === normTenant))
        : rows;
    } catch {
      if (hasTenantFilter) {
        try {
          const stmt = db.prepare(
            `SELECT c.id, c.name, c.phone, c.loyalty_tier as tier, c.lifetime_points, c.tenant_id,
                    MAX(o.created_at) as last_order_at,
                    MIN(o.created_at) as first_order_at,
                    COUNT(o.id) as order_count
             FROM customers c
             LEFT JOIN orders o
               ON (o.customer_id = c.id OR (c.phone IS NOT NULL AND TRIM(c.phone) != '' AND o.customer_phone = c.phone))
              AND o.status != 'cancelled'
              AND COALESCE(NULLIF(TRIM(o.tenant_id), ''), 'default') = COALESCE(NULLIF(TRIM(c.tenant_id), ''), 'default')
             WHERE COALESCE(NULLIF(TRIM(c.tenant_id), ''), 'default') = ?
             GROUP BY c.id
             LIMIT 1000`,
          );
          const bound = typeof stmt.bind === 'function' ? stmt.bind(normTenant!) : stmt;
          const { results } = await bound.all<{
            id: string;
            name: string | null;
            phone: string | null;
            tier: string;
            lifetime_points: number;
            last_order_at: string | null;
            first_order_at?: string | null;
            order_count?: number;
            tenant_id?: string | null;
          }>();
          return results ?? [];
        } catch {
          try {
            const stmt = db.prepare(
              `SELECT c.id, c.name, c.phone, c.loyalty_tier as tier, c.lifetime_points, c.tenant_id,
                      MAX(o.created_at) as last_order_at,
                      MIN(o.created_at) as first_order_at,
                      COUNT(o.id) as order_count
               FROM customers c
               LEFT JOIN orders o
                 ON (o.customer_id = c.id OR (c.phone IS NOT NULL AND TRIM(c.phone) != '' AND o.customer_phone = c.phone))
                AND o.status != 'cancelled'
               WHERE COALESCE(NULLIF(TRIM(c.tenant_id), ''), 'default') = ?
               GROUP BY c.id
               LIMIT 1000`,
            );
            const bound = typeof stmt.bind === 'function' ? stmt.bind(normTenant!) : stmt;
            const { results } = await bound.all<{
              id: string;
              name: string | null;
              phone: string | null;
              tier: string;
              lifetime_points: number;
              last_order_at: string | null;
              first_order_at?: string | null;
              order_count?: number;
              tenant_id?: string | null;
            }>();
            return results ?? [];
          } catch {
            if (normTenant !== 'default') {
              return [];
            }
          }
        }
      }
      const { results } = await db
        .prepare(
          `SELECT c.id, c.name, c.phone, c.loyalty_tier as tier, c.lifetime_points, c.tenant_id,
                  MAX(o.created_at) as last_order_at,
                  MIN(o.created_at) as first_order_at,
                  COUNT(o.id) as order_count
           FROM customers c
           LEFT JOIN orders o
             ON (o.customer_id = c.id OR (c.phone IS NOT NULL AND TRIM(c.phone) != '' AND o.customer_phone = c.phone))
            AND o.status != 'cancelled'
            AND COALESCE(NULLIF(TRIM(o.tenant_id), ''), 'default') = COALESCE(NULLIF(TRIM(c.tenant_id), ''), 'default')
           GROUP BY c.id
           LIMIT 1000`,
        )
        .all<{
          id: string;
          name: string | null;
          phone: string | null;
          tier: string;
          lifetime_points: number;
          last_order_at: string | null;
          first_order_at?: string | null;
          order_count?: number;
          tenant_id?: string | null;
        }>()
        .catch(() =>
          db
            .prepare(
              `SELECT c.id, c.name, c.phone, c.loyalty_tier as tier, c.lifetime_points,
                      MAX(o.created_at) as last_order_at,
                      MIN(o.created_at) as first_order_at,
                      COUNT(o.id) as order_count
               FROM customers c
               LEFT JOIN orders o ON (o.customer_id = c.id OR (c.phone IS NOT NULL AND TRIM(c.phone) != '' AND o.customer_phone = c.phone)) AND o.status != 'cancelled'
               GROUP BY c.id
               LIMIT 1000`,
            )
            .all<{
              id: string;
              name: string | null;
              phone: string | null;
              tier: string;
              lifetime_points: number;
              last_order_at: string | null;
              first_order_at?: string | null;
              order_count?: number;
              tenant_id?: string | null;
            }>(),
        );
      const rows = results ?? [];
      return hasTenantFilter
        ? rows.filter((r) => !('tenant_id' in r) || r.tenant_id === undefined || ((String(r.tenant_id ?? '').trim() || 'default') === normTenant))
        : rows;
    }
  } catch (err) {
    log.error('segment_scan_failed', { error: String(err) });
    return [];
  }
}

/**
 * Classify a single customer row into a band, then test against the
 * segment predicate. Shared by count + member-list paths.
 */
function classify(
  row: {
    id: string;
    name: string | null;
    phone: string | null;
    tier: string;
    lifetime_points: number;
    last_order_at: string | null;
    first_order_at?: string | null;
    order_count?: number;
  },
  policy: BandPolicy,
  now: Date,
): string {
  if (!row.last_order_at) return 'dormant';
  return computeFrequencyBand(
    {
      firstOrderAt: row.first_order_at ?? row.last_order_at,
      lastOrderAt: row.last_order_at,
      orderCount: Number(row.order_count ?? 1),
    },
    policy,
    now,
  );
}

function matchesSegmentKey(
  key: SegmentKey,
  row: { lifetime_points: number },
  band: string,
  daysSinceFirst: number,
  highValueThresholdVnd?: number,
): boolean {
  switch (key) {
    case 'new_first_week':
      return daysSinceFirst <= 7;
    case 'regular':
      return band === 'regular' || band === 'resurrected';
    case 'regular_high_value':
      return (
        (band === 'regular' || band === 'resurrected') &&
        row.lifetime_points * 10000 >= (highValueThresholdVnd ?? 1_000_000)
      );
    case 'lapsing_30d':
      return band === 'lapsing';
    case 'dormant_60d':
      return band === 'dormant';
    default:
      return false;
  }
}

/**
 * Build a segment: count + paginated member list. `key` must match a
 * loaded definition.
 */
export async function buildSegment(
  db: D1Database,
  key: SegmentKey,
  kv?: KVNamespace,
  options: BuildOptions = {},
  now: Date = new Date(),
): Promise<SegmentResult> {
  const definitions = await loadSegmentDefinitions(kv, options.tenantId);
  const def = definitions.find((d) => d.key === key);
  if (!def) {
    return {
      key,
      labelVi: key,
      labelEn: key,
      description: '',
      count: 0,
      customers: [],
    };
  }

  const policy = await resolveBandPolicy(kv, options.tenantId);
  const all = await scanCustomers(db, options.tenantId);
  const matched: SegmentRow[] = [];

  for (const row of all) {
    const band = classify(row, policy, now);
    const daysSinceLast = row.last_order_at
      ? (now.getTime() - new Date(row.last_order_at).getTime()) / MS_PER_DAY
      : Infinity;
    const daysSinceFirst = row.first_order_at
      ? (now.getTime() - new Date(row.first_order_at).getTime()) / MS_PER_DAY
      : daysSinceLast;

    if (matchesSegmentKey(key, row, band, daysSinceFirst, def.highValueThresholdVnd)) {
      matched.push({
        id: row.id,
        name: row.name,
        phone: row.phone,
        tier: row.tier,
        lifetimePoints: row.lifetime_points,
        lastOrderAt: row.last_order_at,
        band,
      });
    }
  }

  const offset = options.offset ?? 0;
  const limit = options.limit ?? 50;
  // limit=0 means "no limit" — return all matches
  const paginated = limit === 0 ? matched : matched.slice(offset, offset + limit);

  return {
    key: def.key,
    labelVi: def.labelVi,
    labelEn: def.labelEn,
    description: def.description,
    count: matched.length,
    customers: paginated,
  };
}

/**
 * List all segment definitions with their counts and bounded customer samples
 * evaluated in a single customer scan pass.
 */
export async function listSegments(
  db: D1Database,
  kv?: KVNamespace,
  now: Date = new Date(),
  options: BuildOptions = {},
): Promise<Array<SegmentResult>> {
  const definitions = await loadSegmentDefinitions(kv, options.tenantId);
  const policy = await resolveBandPolicy(kv, options.tenantId);
  const all = await scanCustomers(db, options.tenantId);
  const sampleLimit = options.limit ?? 25;

  const results: SegmentResult[] = definitions.map((def) => ({
    key: def.key,
    labelVi: def.labelVi,
    labelEn: def.labelEn,
    description: def.description,
    count: 0,
    customers: [],
  }));

  for (const row of all) {
    const band = classify(row, policy, now);
    const daysSinceLast = row.last_order_at
      ? (now.getTime() - new Date(row.last_order_at).getTime()) / MS_PER_DAY
      : Infinity;
    const daysSinceFirst = row.first_order_at
      ? (now.getTime() - new Date(row.first_order_at).getTime()) / MS_PER_DAY
      : daysSinceLast;

    for (let i = 0; i < definitions.length; i++) {
      const def = definitions[i];
      if (matchesSegmentKey(def.key, row, band, daysSinceFirst, def.highValueThresholdVnd)) {
        results[i].count += 1;
        if (sampleLimit === 0 || results[i].customers.length < sampleLimit) {
          results[i].customers.push({
            id: row.id,
            name: row.name,
            phone: row.phone,
            tier: row.tier,
            lifetimePoints: row.lifetime_points,
            lastOrderAt: row.last_order_at,
            band,
          });
        }
      }
    }
  }

  return results;
}
