import React from 'react';

export function formatVND(value: number): string {
  return value.toLocaleString('vi-VN') + '₫';
}

export function statusBadge(status: string) {
  const colors: Record<string, string> = {
    active: 'bg-green-100 text-green-800',
    paused: 'bg-amber-100 text-amber-800',
    cancelled: 'bg-red-100 text-red-800',
    pending: 'bg-blue-100 text-blue-800',
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
        colors[status] || 'bg-gray-100 text-gray-800'
      }`}
    >
      {labels[status] || status}
    </span>
  );
}
