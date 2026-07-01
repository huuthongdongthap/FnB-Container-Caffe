import { useState, useEffect } from 'react';
import { cn } from '@/lib/cn';
import type { KDSOrder } from '@/hooks/use-kds';

interface OrderTicketProps {
  order: KDSOrder;
  onComplete?: (orderId: string) => void;
}

export function OrderTicket({ order, onComplete }: OrderTicketProps) {
  const [elapsedMinutes, setElapsedMinutes] = useState(() => calcElapsedMinutes(order.createdAt));
  const [showConfirm, setShowConfirm] = useState(false);

  useEffect(() => {
    const interval = setInterval(() => {
      setElapsedMinutes(calcElapsedMinutes(order.createdAt));
    }, 60_000);

    return () => clearInterval(interval);
  }, [order.createdAt]);

  const isOverdue = elapsedMinutes >= 15;

  return (
    <div
      data-testid="order-ticket"
      className={cn(
        'rounded-lg border p-4 mb-3 shadow-sm transition-colors',
        isOverdue
          ? 'bg-red-50 border-red-300'
          : 'bg-white border-gray-200'
      )}
    >
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-2">
          <span className="text-lg font-bold font-display">
            Bàn {order.table}
          </span>
          <span className="text-xs text-gray-500 font-mono">
            #{order.id}
          </span>
        </div>
        <div className="flex items-center gap-2">
          <span
            className={cn(
              'text-sm font-mono font-bold',
              isOverdue ? 'text-red-600' : 'text-gray-600'
            )}
          >
            {elapsedMinutes}m
          </span>
          {order.station && (
            <span className="text-xs px-2 py-0.5 rounded bg-gray-100 text-gray-600 uppercase">
              {order.station}
            </span>
          )}
        </div>
      </div>

      <div className="space-y-1.5">
        {order.items.map((item, idx) => (
          <div key={idx} className="flex items-start justify-between">
            <div className="flex-1">
              <span className="text-sm font-medium">
                {item.name}
              </span>
              {item.quantity > 1 && (
                <span className="text-xs text-gray-500 ml-1">
                  x{item.quantity}
                </span>
              )}
              {item.modifiers && item.modifiers.length > 0 && (
                <div className="text-xs text-gray-500 ml-2">
                  {item.modifiers.map((m, mi) => (
                    <span key={mi} className="mr-1">
                      {m}
                    </span>
                  ))}
                </div>
              )}
              {item.notes && (
                <p className="text-xs text-amber-600 ml-2 mt-0.5">
                  Ghi chú: {item.notes}
                </p>
              )}
            </div>
          </div>
        ))}
      </div>

      {onComplete && order.status === 'pending' && (
        <div className="mt-3 pt-3 border-t border-gray-100">
          {showConfirm ? (
            <div className="flex gap-2">
              <button
                onClick={() => {
                  onComplete(order.id);
                  setShowConfirm(false);
                }}
                className="flex-1 px-3 py-1.5 text-xs font-medium rounded bg-green-600 text-white hover:bg-green-700 transition-colors"
              >
                &#10003; Xác nhận
              </button>
              <button
                onClick={() => setShowConfirm(false)}
                className="px-3 py-1.5 text-xs font-medium rounded bg-gray-200 text-gray-700 hover:bg-gray-300 transition-colors"
              >
                Hủy
              </button>
            </div>
          ) : (
            <button
              onClick={() => setShowConfirm(true)}
              className="w-full px-3 py-1.5 text-xs font-medium rounded bg-blue-600 text-white hover:bg-blue-700 transition-colors"
            >
              Hoàn thành
            </button>
          )}
        </div>
      )}
    </div>
  );
}

function calcElapsedMinutes(createdAt: string): number {
  const created = new Date(createdAt).getTime();
  const now = Date.now();
  return Math.floor((now - created) / 60_000);
}
