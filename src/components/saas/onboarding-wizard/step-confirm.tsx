import React from 'react';

interface Props {
  businessName: string;
  containerSize: string;
  zone: string;
  loading: boolean;
  onConfirm: () => void;
}

export default function StepConfirmation({ businessName, containerSize, zone, loading, onConfirm }: Props) {
  return (
    <div className="space-y-4">
      <div className="rounded-xl border border-white/10 bg-white/5 p-6">
        <h2 className="font-display text-lg font-bold">Xác nhận / Confirmation</h2>
        <ul className="mt-3 space-y-2 text-sm">
          <li>Doanh nghiệp: <strong>{businessName}</strong></li>
          <li>Container: <strong>{containerSize}</strong></li>
          <li>Zone: <strong>{zone}</strong></li>
        </ul>
      </div>
      <button
        onClick={onConfirm}
        disabled={loading}
        className="rounded-lg bg-green-600 px-6 py-3 font-bold hover:bg-green-500 disabled:opacity-40"
      >
        {loading ? 'Đang tạo...' : 'Bắt đầu dùng thử (14 ngày)'}
      </button>
    </div>
  );
}
