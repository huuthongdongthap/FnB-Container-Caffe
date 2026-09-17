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
import { computeFrequencyBand, DEFAULT_BAND_POLICY, type BandPolicy } from './frequency-band';

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
}

const MS_PER_DAY = 86_400_000;

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
): Promise<SegmentDefinition[]> {
  if (!kv) return DEFAULT_SEGMENTS;
  try {
    const raw = await kv.get('crm:segments');
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
async function scanCustomers(db: D1Database): Promise<
  Array<{
    id: string;
    name: string | null;
    phone: string | null;
    tier: string;
    lifetime_points: number;
    last_order_at: string | null;
  }>
> {
  try {
    const { results } = await db
      .prepare(
        `SELECT c.id, c.name, c.phone, c.loyalty_tier, c.lifetime_points,
                MAX(o.created_at) as last_order_at
         FROM customers c
         LEFT JOIN orders o ON o.customer_phone = c.phone
         GROUP BY c.id`,
      )
      .all<{
        id: string;
        name: string | null;
        phone: string | null;
        loyalty_tier: string;
        lifetime_points: number;
        last_order_at: string | null;
      }>();
    return results ?? [];
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
  },
  policy: BandPolicy,
  now: Date,
): string {
  if (!row.last_order_at) return 'dormant';
  return computeFrequencyBand(
    {
      firstOrderAt: row.last_order_at,
      lastOrderAt: row.last_orderAt ?? row.last_order_at,
      orderCount: 0,
    },
    policy,
    now,
  );
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
  const definitions = await loadSegmentDefinitions(kv);
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

  const policy = DEFAULT_BAND_POLICY;
  const all = await scanCustomers(db);
  const matched: SegmentRow[] = [];

  for (const row of all) {
    const band = classify(row, policy, now);
    const daysSinceLast = row.last_order_at
      ? (now.getTime() - new Date(row.last_order_at).getTime()) / MS_PER_DAY
      : Infinity;

    let inSegment = false;
    switch (key) {
      case 'new_first_week':
        inSegment = daysSinceLast <= 7;
        break;
      case 'regular':
        inSegment = band === 'regular' || band === 'resurrected';
        break;
      case 'regular_high_value':
        inSegment =
          (band === 'regular' || band === 'resurrected') &&
          (row.lifetime_points * 10000) >= (def.highValueThresholdVnd ?? 1_000_000);
        break;
      case 'lapsing_30d':
        inSegment = band === 'lapsing';
        break;
      case 'dormant_60d':
        inSegment = band === 'dormant';
        break;
      default:
        inSegment = false;
    }

    if (inSegment) {
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
 * List all segment definitions with their counts (no member list).
 * Useful for the segment dashboard overview.
 */
export async function listSegments(
  db: D1Database,
  kv?: KVNamespace,
  now: Date = new Date(),
): Promise<Array<SegmentResult>> {
  const definitions = await loadSegmentDefinitions(kv);
  const results: SegmentResult[] = [];
  for (const def of definitions) {
    const full = await buildSegment(db, def.key, kv, { limit: 0 }, now);
    results.push(full);
  }
  return results;
}
