export function formatTime(iso: string): string {
  return new Date(iso).toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' });
}

export function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString('vi-VN');
}

export function formatHours(hours: number | null): string {
  if (hours === null) return '--';
  return hours.toFixed(1) + 'h';
}
