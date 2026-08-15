export function fmtDate(iso: string | null): string {
  if (!iso) return '--';
  return new Date(iso).toLocaleString('vi-VN', {
    day: '2-digit', month: '2-digit',
    hour: '2-digit', minute: '2-digit',
  });
}

export function fmtDeviceId(sid: string): string {
  if (sid.startsWith('staff-')) return sid.slice(0, 18) + '…';
  return sid.slice(0, 10) + '…';
}

export function relativeTime(iso: string | null): string {
  if (!iso) return 'Chưa đăng nhập';
  const diff = Date.now() - new Date(iso).getTime();
  if (diff < 60000) return 'Vừa xong';
  if (diff < 3600000) return `${Math.floor(diff / 60000)} phút trước`;
  if (diff < 86400000) return `${Math.floor(diff / 3600000)} giờ trước`;
  return `${Math.floor(diff / 86400000)} ngày trước`;
}
