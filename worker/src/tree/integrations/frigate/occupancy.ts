/**
 * Frigate CCTV AI Occupancy Analytics (tree layer)
 * Computes real-time occupancy, peak hour distribution, and camera breakdown.
 */

import { createLogger } from '../../../middleware/logger';
import { createFrigateClient } from '../../../clients/frigate-client';

const log = createLogger({ route: 'frigate-occupancy' });

export interface CameraOccupancy {
  camera: string;
  active_count: number;
  last_seen: string | null;
}

export interface PeakHourBucket {
  hour: number;
  count: number;
}

export interface FrigateOccupancyReport {
  current_occupancy: number;
  peak_hours: PeakHourBucket[];
  camera_breakdown: CameraOccupancy[];
  mock?: boolean;
  computed_at: string;
}

export async function getOccupancyAnalytics(
  env: Record<string, unknown>
): Promise<FrigateOccupancyReport> {
  const db = (env.AURA_DB ?? env.DB) as import('@cloudflare/workers-types').D1Database | undefined;
  const client = createFrigateClient(env as { FRIGATE_URL?: string; FRIGATE_API_KEY?: string; FRIGATE_SYNC_ENABLED?: string });

  const now = new Date();
  const nowIso = now.toISOString();

  // If no DB or mock mode requested when Frigate is unconfigured
  if (!db || !client) {
    // Generate realistic synthetic occupancy data for dev/mock mode
    const syntheticBreakdown: CameraOccupancy[] = [
      { camera: 'dining_area', active_count: 8, last_seen: nowIso },
      { camera: 'patio', active_count: 3, last_seen: nowIso },
      { camera: 'counter', active_count: 2, last_seen: nowIso }
    ];

    const syntheticPeakHours: PeakHourBucket[] = Array.from({ length: 24 }, (_, i) => {
      // Cafe curve: peaks at 8-9am, 12-1pm, 7-8pm
      let count = 2;
      if (i >= 7 && i <= 9) count = 18;
      else if (i >= 11 && i <= 13) count = 24;
      else if (i >= 18 && i <= 20) count = 20;
      else if (i >= 10 && i <= 17) count = 12;
      return { hour: i, count };
    });

    return {
      current_occupancy: 13,
      peak_hours: syntheticPeakHours,
      camera_breakdown: syntheticBreakdown,
      mock: true,
      computed_at: nowIso
    };
  }

  try {
    const fiveMinutesAgoSec = Math.floor(Date.now() / 1000) - 300;
    const twentyFourHoursAgoSec = Math.floor(Date.now() / 1000) - 86400;

    // 1. Current active person detections (last 5 minutes)
    const activeRows = await db
      .prepare(
        `SELECT camera, COUNT(*) as count, MAX(received_at) as last_seen
         FROM frigate_events
         WHERE label = 'person' AND start_time >= ?
         GROUP BY camera`
      )
      .bind(fiveMinutesAgoSec)
      .all<{ camera: string; count: number; last_seen: string | null }>();

    const breakdown: CameraOccupancy[] = (activeRows.results ?? []).map(r => ({
      camera: r.camera,
      active_count: Number(r.count),
      last_seen: r.last_seen
    }));

    const currentOccupancy = breakdown.reduce((sum, b) => sum + b.active_count, 0);

    // 2. Peak hours in the last 24h
    // In SQLite, strftime('%H', datetime(start_time, 'unixepoch')) extracts the hour (00-23)
    const hourlyRows = await db
      .prepare(
        `SELECT CAST(strftime('%H', datetime(start_time, 'unixepoch')) AS INTEGER) as hour, COUNT(*) as count
         FROM frigate_events
         WHERE label = 'person' AND start_time >= ?
         GROUP BY hour
         ORDER BY hour ASC`
      )
      .bind(twentyFourHoursAgoSec)
      .all<{ hour: number; count: number }>();

    const hourMap = new Map<number, number>();
    (hourlyRows.results ?? []).forEach(r => {
      hourMap.set(Number(r.hour), Number(r.count));
    });

    const peakHours: PeakHourBucket[] = Array.from({ length: 24 }, (_, h) => ({
      hour: h,
      count: hourMap.get(h) ?? 0
    }));

    return {
      current_occupancy: currentOccupancy,
      peak_hours: peakHours,
      camera_breakdown: breakdown,
      computed_at: nowIso
    };
  } catch (err) {
    log.error('occupancy_analytics_error', { error: (err as Error).message });
    throw err;
  }
}
