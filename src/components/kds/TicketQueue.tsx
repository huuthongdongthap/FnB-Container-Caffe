import { cn } from '@/lib/cn';
import { OrderTicket } from '@/components/kds/OrderTicket';
import type { KDSOrder } from '@/hooks/use-kds';
import { Check } from 'lucide-react';

interface TicketQueueProps {
  orders: KDSOrder[];
  station: string;
  onComplete?: (orderId: string) => void;
  loading?: boolean;
}

export function TicketQueue({ orders, station, onComplete, loading }: TicketQueueProps) {
  const sortedOrders = [...orders].sort(
    (a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
  );

  if (loading) {
    return (
      <div data-testid="skeleton" className="space-y-3">
        {[1, 2, 3].map((i) => (
          <div
            key={i}
            className="rounded-lg border border-gray-200 p-4 animate-pulse bg-[var(--aura-bg-surface)]"
          >
            <div className="h-4 bg-gray-200 rounded w-1/3 mb-3" />
            <div className="h-3 bg-gray-200 rounded w-2/3 mb-2" />
            <div className="h-3 bg-gray-200 rounded w-1/2" />
          </div>
        ))}
      </div>
    );
  }

  if (sortedOrders.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-16 text-gray-500">
        <span className="text-5xl mb-4 opacity-50"><Check size={36} className="block mx-auto opacity-50" /></span>
        <p className="text-base font-medium">Không có đơn hàng chờ xử lý</p>
        <p className="text-sm mt-1 text-gray-600">Tất cả đơn đã hoàn thành</p>
      </div>
    );
  }

  const pendingCount = sortedOrders.filter((o) => o.status === 'pending').length;
  const preparingCount = sortedOrders.filter((o) => o.status === 'preparing').length;
  const readyCount = sortedOrders.filter((o) => o.status === 'ready').length;
  const servedCount = sortedOrders.filter((o) => o.status === 'served').length;

  if (station === 'all') {
    return (
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <QueueColumn
          title="Chờ xác nhận"
          count={pendingCount}
          colorClass="border-amber-400 bg-amber-50"
          dataCol="pending"
        >
          {sortedOrders
            .filter((o) => o.status === 'pending')
            .map((order) => (
              <OrderTicket
                key={order.id}
                order={order}
                onComplete={onComplete}
              />
            ))}
        </QueueColumn>

        <QueueColumn
          title="Đang chuẩn bị"
          count={preparingCount}
          colorClass="border-blue-400 bg-blue-50"
          dataCol="preparing"
        >
          {sortedOrders
            .filter((o) => o.status === 'preparing')
            .map((order) => (
              <OrderTicket key={order.id} order={order} />
            ))}
        </QueueColumn>

        <QueueColumn
          title="Sẵn sàng"
          count={readyCount}
          colorClass="border-green-400 bg-green-50"
          dataCol="ready"
        >
          {sortedOrders
            .filter((o) => o.status === 'ready')
            .map((order) => (
              <OrderTicket key={order.id} order={order} />
            ))}
        </QueueColumn>

        <QueueColumn
          title="Đã phục vụ"
          count={servedCount}
          colorClass="border-gray-300 bg-[var(--aura-bg-surface)]"
          dataCol="served"
        >
          {sortedOrders
            .filter((o) => o.status === 'served')
            .map((order) => (
              <OrderTicket key={order.id} order={order} />
            ))}
        </QueueColumn>
      </div>
    );
  }

  // Single station view
  return (
    <div className="space-y-3">
      {sortedOrders.map((order) => (
        <OrderTicket
          key={order.id}
          order={order}
          onComplete={onComplete}
        />
      ))}
    </div>
  );
}

interface QueueColumnProps {
  title: string;
  count: number;
  colorClass: string;
  dataCol: string;
  children: React.ReactNode;
}

function QueueColumn({ title, count, colorClass, dataCol, children }: QueueColumnProps) {
  return (
    <div
      className={cn(
        'rounded-lg border-t-4 p-3 min-h-[200px]',
        colorClass
      )}
      data-col={dataCol}
    >
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-sm font-semibold">{title}</h3>
        <span className="text-xs font-mono bg-[var(--aura-bg-elevated)] px-2 py-0.5 rounded-full border">
          {count}
        </span>
      </div>
      <div className="space-y-2">
        {children}
      </div>
    </div>
  );
}
