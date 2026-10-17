import React from 'react';

const STATUS_STYLES: Record<string, string> = {
  active: 'bg-emerald-500/10 border border-emerald-500/30 text-emerald-300',
  pending: 'bg-sky-500/10 border border-sky-500/30 text-sky-300',
  paid: 'bg-emerald-500/10 border border-emerald-500/30 text-emerald-300',
  failed: 'bg-red-500/10 border border-red-500/30 text-red-300',
  overdue: 'bg-amber-500/10 border border-amber-500/30 text-amber-300',
  processing: 'bg-sky-500/10 border border-sky-500/30 text-sky-300',
  manual: 'bg-amber-500/10 border border-amber-500/30 text-amber-300',
  cancelled: 'bg-red-500/10 border border-red-500/30 text-red-300',
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
  const color = STATUS_STYLES[status] || 'bg-white/5 border border-white/10 text-muted';
  const label = STATUS_LABELS[status] || status;

  return (
    <span className={`inline-block rounded-full px-2.5 py-0.5 text-xs font-medium ${color}`}>
      {label}
    </span>
  );
}
