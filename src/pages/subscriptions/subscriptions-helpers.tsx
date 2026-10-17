import React from 'react';

export function formatVND(value: number): string {
  return value.toLocaleString('vi-VN') + '₫';
}

export function statusBadge(status: string) {
  const colors: Record<string, string> = {
    active: 'bg-emerald-500/15 text-emerald-300 border border-emerald-500/30',
    paused: 'bg-amber-500/15 text-amber-300 border border-amber-500/30',
    cancelled: 'bg-red-500/15 text-red-300 border border-red-500/30',
    pending: 'bg-sky-500/15 text-sky-300 border border-sky-500/30',
  };
  const labels: Record<string, string> = {
    active: 'Đang hoạt động',
    paused: 'Tạm dừng',
    cancelled: 'Đã huỷ',
    pending: 'Chờ kích hoạt',
  };
  return (
    <span
      className={`inline-block rounded-full px-2.5 py-0.5 text-xs font-medium ${
        colors[status] || 'bg-surface text-foreground border border-border'
      }`}
    >
      {labels[status] || status}
    </span>
  );
}
