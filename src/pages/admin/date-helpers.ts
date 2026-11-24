const ICT_OFFSET_MS = 7 * 3600_000;

export function todayStr(nowMs = Date.now()): string {
  return new Date(nowMs + ICT_OFFSET_MS).toISOString().slice(0, 10);
}

export function daysAgo(n: number, nowMs = Date.now()): string {
  return new Date(nowMs + ICT_OFFSET_MS - n * 86400000).toISOString().slice(0, 10);
}

export function periodDates(
  period: '24h' | '7d' | '30d' | 'custom',
  customStart: string,
  customEnd: string,
  nowMs = Date.now(),
): { from: string; to: string } {
  const now = todayStr(nowMs);
  switch (period) {
    case '24h':
      return { from: now, to: now };
    case '7d':
      return { from: daysAgo(6, nowMs), to: now };
    case '30d':
      return { from: daysAgo(29, nowMs), to: now };
    default: {
      const rawFrom = customStart || daysAgo(6, nowMs);
      const rawTo = customEnd || now;
      if (rawFrom > rawTo) {
        return { from: rawTo, to: rawFrom };
      }
      return { from: rawFrom, to: rawTo };
    }
  }
}

export function previousPeriodDates(from: string, to: string): { from: string; to: string } {
  const startMs = Date.parse(`${from}T00:00:00.000Z`);
  const endMs = Date.parse(`${to}T00:00:00.000Z`);
  if (!Number.isFinite(startMs) || !Number.isFinite(endMs)) {
    return { from, to };
  }
  const safeStartMs = Math.min(startMs, endMs);
  const safeEndMs = Math.max(startMs, endMs);
  const rangeMs = safeEndMs - safeStartMs;
  const shiftMs = rangeMs + 86400000;
  return {
    from: new Date(safeStartMs - shiftMs).toISOString().slice(0, 10),
    to: new Date(safeEndMs - shiftMs).toISOString().slice(0, 10),
  };
}
