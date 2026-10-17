import { useState } from 'react';

interface OrderCompleteButtonProps {
  orderId: string;
  onConfirm: (orderId: string) => void;
}

export function OrderCompleteButton({ orderId, onConfirm }: OrderCompleteButtonProps) {
  const [showConfirm, setShowConfirm] = useState(false);

  if (showConfirm) {
    return (
      <div className="flex gap-2 items-center">
        <span className="text-xs text-muted">Xác nhận hoàn thành?</span>
        <button
          onClick={() => {
            onConfirm(orderId);
            setShowConfirm(false);
          }}
          className="px-3 py-1 text-xs font-medium rounded bg-green-600 text-white hover:bg-green-700 transition-colors"
        >
          Xác nhận
        </button>
        <button
          onClick={() => setShowConfirm(false)}
          className="px-3 py-1 text-xs font-medium rounded bg-muted/20 text-foreground hover:bg-muted/30 transition-colors"
        >
          Hủy
        </button>
      </div>
    );
  }

  return (
    <button
      onClick={() => setShowConfirm(true)}
      className="px-3 py-1 text-xs font-medium rounded bg-blue-600 text-white hover:bg-blue-700 transition-colors"
    >
      Hoàn thành
    </button>
  );
}
