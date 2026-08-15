export function formatRelativeTime(
  t: (key: string, params?: Record<string, string | number>) => string,
  iso: string
): string {
  const diff = Date.now() - new Date(iso).getTime();
  const minutes = Math.floor(diff / 60_000);
  if (minutes < 1) return t('justNow');
  if (minutes < 60) return t('minutesAgo', { minutes });
  const hours = Math.floor(minutes / 60);
  return t('hoursAgo', { hours });
}
