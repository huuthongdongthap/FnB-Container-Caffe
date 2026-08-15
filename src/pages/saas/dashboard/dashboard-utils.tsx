import React from 'react';

const STATUS_STYLES: Record<string, string> = {
  active: 'bg-green-100 text-green-800',
  pending: 'bg-blue-100 text-blue-800',
  paid: 'bg-green-100 text-green-800',
  failed: 'bg-red-100 text-red-800',
  overdue: 'bg-amber-100 text-amber-800',
  processing: 'bg-blue-100 text-blue-800',
  manual: 'bg-amber-100 text-amber-800',
  cancelled: 'bg-red-100 text-red-800',
};

const STATUS_LABELS: Record<string, string> = {
  active: 'Đang hoạt động',
  pending: 'Chờ thanh toán',
  paid: 'Đã thanh toán',
  failed: 'Thất bại',
  overdue: 'Quá hạn',
  processing: 'Đang xử lý',
  manual: 'Thanh toán thủ công',
  cancelled: 'Đã huỷ',
};

export function formatVND(value: number): string {
  return value.toLocaleString('vi-VN') + '₫';
}

export function StatusBadge({ status }: { status: string }) {
  const color = STATUS_STYLES[status] || 'bg-gray-100 text-gray-800';
  const label = STATUS_LABELS[status] || status;

  return (
    <span className={`inline-block rounded-full px-2.5 py-0.5 text-xs font-medium ${color}`}>
      {label}
    </span>
  );
}
