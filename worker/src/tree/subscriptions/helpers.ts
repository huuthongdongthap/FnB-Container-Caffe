// Extracted helper functions from routes/subscriptions.ts

export function generateId(prefix: string, len = 8): string {
  return prefix + Date.now().toString(36) + Math.random().toString(36).slice(2, 2 + len);
}

export function today(): string { return new Date().toISOString().slice(0, 10); }
export function nowStr(): string { return new Date().toISOString(); }

export function addMonths(dateStr: string, months: number): string {
  const d = new Date(dateStr + 'T00:00:00');
  d.setMonth(d.getMonth() + months);
  return d.toISOString().slice(0, 10);
}
