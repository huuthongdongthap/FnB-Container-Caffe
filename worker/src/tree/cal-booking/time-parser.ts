const ICT_OFFSET_MS = 7 * 3_600_000;

function currentIctDateTime(now = new Date()): { date: string; time: string } {
  const ictIso = new Date(now.getTime() + ICT_OFFSET_MS).toISOString();
  return {
    date: ictIso.slice(0, 10),
    time: '00:00',
  };
}

/**
 * Parse a Cal.com ISO startTime into Vietnam ICT (Asia/Ho_Chi_Minh, +07:00) date and HH:MM strings.
 */
export function parseBookingTime(startTime: string): { date: string; time: string } {
  if (typeof startTime !== 'string' || !startTime.trim()) {
    return currentIctDateTime();
  }
  const trimmed = startTime.trim();
  const hasExplicitTz = /(?:Z|[+-]\d{2}:?\d{2})$/i.test(trimmed);
  if (hasExplicitTz) {
    const parsed = new Date(trimmed);
    if (!Number.isNaN(parsed.getTime())) {
      const ictIso = new Date(parsed.getTime() + ICT_OFFSET_MS).toISOString();
      return {
        date: ictIso.slice(0, 10),
        time: ictIso.slice(11, 16),
      };
    }
  }
  const naiveMatch = /^(\d{4}-\d{2}-\d{2})[T ](\d{2}:\d{2})/.exec(trimmed);
  if (naiveMatch) {
    return {
      date: naiveMatch[1]!,
      time: naiveMatch[2]!,
    };
  }
  return {
    date: trimmed.slice(0, 10) || currentIctDateTime().date,
    time: trimmed.slice(11, 16) || '00:00',
  };
}
