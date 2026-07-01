/**
 * Parse a Cal.com ISO startTime into date and time strings.
 */
export function parseBookingTime(startTime: string): { date: string; time: string } {
  return {
    date: startTime?.slice(0, 10) || new Date().toISOString().slice(0, 10),
    time: startTime?.slice(11, 16) || '00:00',
  };
}
