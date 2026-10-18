// Extracted helper functions from routes/subscriptions.ts

export function generateId(prefix: string, len = 8): string {
  return prefix + Date.now().toString(36) + Math.random().toString(36).slice(2, 2 + len);
}

export function today(): string {
  return new Date().toISOString().slice(0, 10);
}
export function nowStr(): string {
  return new Date().toISOString();
}

export function addMonths(dateStr: string, months: number): string {
  const parts = dateStr.slice(0, 10).split('-').map(Number);
  const year = parts[0];
  const month = parts[1] - 1;
  const day = parts[2];

  const targetDate = new Date(Date.UTC(year, month + months, 1));
  const targetYear = targetDate.getUTCFullYear();
  const targetMonth = targetDate.getUTCMonth();

  const maxDays = new Date(Date.UTC(targetYear, targetMonth + 1, 0)).getUTCDate();
  const targetDay = Math.min(day, maxDays);

  const y = targetYear;
  const m = String(targetMonth + 1).padStart(2, '0');
  const d = String(targetDay).padStart(2, '0');
  return `${y}-${m}-${d}`;
}
