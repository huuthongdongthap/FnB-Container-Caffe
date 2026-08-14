export function todayStr(): string {
  return new Date().toISOString().slice(0, 10);
}

export function daysAgo(n: number): string {
  return new Date(Date.now() - n * 86400000).toISOString().slice(0, 10);
}

export function periodDates(
  period: '24h' | '7d' | '30d' | 'custom',
  customStart: string,
  customEnd: string,
): { from: string; to: string } {
  const now = todayStr();
  switch (period) {
    case '24h':
      return { from: now, to: now };
    case '7d':
      return { from: daysAgo(6), to: now };
    case '30d':
      return { from: daysAgo(29), to: now };
    default:
      return {
        from: customStart || daysAgo(6),
        to: customEnd || now,
      };
  }
}

export function previousPeriodDates(from: string, to: string): { from: string; to: string } {
  const rangeMs = new Date(to).getTime() - new Date(from).getTime();
  const shiftMs = rangeMs + 86400000;
  return {
    from: new Date(new Date(from).getTime() - shiftMs).toISOString().slice(0, 10),
    to: new Date(new Date(to).getTime() - shiftMs).toISOString().slice(0, 10),
  };
}
