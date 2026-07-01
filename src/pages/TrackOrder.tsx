import { useState, useEffect, useCallback } from 'react';
import { useOrderStore } from '@/hooks/stores/use-order-store';
import { OrderTimeline } from '@/components/tracking/OrderTimeline';
import { StatusBadge, type OrderStatus } from '@/components/tracking/StatusBadge';
import { EstimatedTime } from '@/components/tracking/EstimatedTime';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardHeader, CardBody } from '@/components/ui/card';

const STATUS_STEPS = [
  { status: 'confirmed', label: 'Đã xác nhận' },
  { status: 'preparing', label: 'Đang chế biến' },
  { status: 'ready', label: 'Sẵn sàng' },
  { status: 'delivering', label: 'Đang giao' },
  { status: 'delivered', label: 'Đã giao' },
];

export default function TrackOrderPage() {
  const [orderId, setOrderId] = useState('');
  const [activeOrderId, setActiveOrderId] = useState<string | null>(null);

  const order = useOrderStore((s) => s.currentOrder);
  const loading = useOrderStore((s) => s.loading);
  const error = useOrderStore((s) => s.error);
  const fetchOrder = useOrderStore((s) => s.fetchOrder);
  const startPolling = useOrderStore((s) => s.startPolling);
  const stopPolling = useOrderStore((s) => s.stopPolling);

  // Cleanup polling on unmount
  useEffect(() => () => stopPolling(), [stopPolling]);

  const handleTrack = useCallback((e: React.FormEvent) => {
    e.preventDefault();
    const id = orderId.trim();
    if (!id) return;
    setActiveOrderId(id);
    fetchOrder(id).then(() => startPolling(id));
  }, [orderId, fetchOrder, startPolling]);

  const handleRetry = useCallback(() => {
    setActiveOrderId(null);
    setOrderId('');
    stopPolling();
  }, [stopPolling]);

  const buildTimelineSteps = () => {
    if (!order) return [];
    return STATUS_STEPS.map((step) => ({
      ...step,
      time: getStatusTime(order, step.status),
    }));
  };

  const orderStatus = order?.status ?? 'pending';
  const orderDate = order?.created_at
    ? new Date(order.created_at).toLocaleDateString('vi-VN')
    : null;

  return (
    <div className="min-h-screen bg-background py-12 px-4">
      <div className="max-w-2xl mx-auto">
        <div className="text-center mb-8">
          <h1 className="text-3xl font-display font-bold mb-2">
            &#128230; Theo Dõi Đơn Hàng
          </h1>
          <p className="text-muted text-sm">
            Nhập mã đơn hàng để theo dõi trạng thái — tự động cập nhật mỗi 15s
          </p>
        </div>

        {/* Search Card */}
        <Card className="mb-6">
          <CardBody>
            <form onSubmit={handleTrack} className="flex gap-2">
              <div className="flex-1">
                <Input
                  placeholder="Nhập mã đơn hàng (VD: ORD-001)"
                  value={orderId}
                  onChange={(e) => setOrderId(e.target.value)}
                  maxLength={20}
                />
              </div>
              <Button type="submit" disabled={!orderId.trim() || loading}>
                {loading ? 'Đang tìm...' : '🔍 Theo dõi'}
              </Button>
            </form>
            <p className="text-xs text-muted mt-2">
              Nhập mã đơn từ email xác nhận hoặc tin nhắn Zalo
            </p>
          </CardBody>
        </Card>

        {/* Loading */}
        {loading && activeOrderId && !order && (
          <Card className="mb-6">
            <CardBody>
              <div className="flex items-center justify-center py-8">
                <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
                <span className="ml-3 text-sm text-muted">Đang tìm kiếm đơn hàng...</span>
              </div>
            </CardBody>
          </Card>
        )}

        {/* Error */}
        {error && activeOrderId && !order && (
          <Card className="mb-6 border-destructive">
            <CardBody>
              <div className="text-center py-4">
                <p className="text-3xl mb-2">&#9888;&#65039;</p>
                <h3 className="font-semibold mb-1">Không tìm thấy đơn hàng</h3>
                <p className="text-sm text-muted mb-4">{error}</p>
                <Button variant="secondary" onClick={handleRetry}>
                  &#128269; Thử lại
                </Button>
              </div>
            </CardBody>
          </Card>
        )}

        {/* Order Status */}
        {order && !error && activeOrderId && (
          <Card className="mb-6">
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="font-display text-lg font-semibold">
                    Đơn hàng #{order.id}
                  </h3>
                  {orderDate && (
                    <p className="text-xs text-muted">Đặt ngày {orderDate}</p>
                  )}
                </div>
                <StatusBadge status={orderStatus as OrderStatus} />
              </div>
            </CardHeader>
            <CardBody>
              <OrderTimeline
                currentStatus={orderStatus}
                steps={buildTimelineSteps()}
              />

              {order.created_at && (
                <div className="mt-4 pt-4 border-t border-border">
                  <EstimatedTime estimatedAt={order.created_at} />
                </div>
              )}

              {/* Order details */}
              <div className="mt-4 pt-4 border-t border-border">
                <h4 className="text-sm font-semibold mb-2">Thông tin đơn hàng</h4>
                <div className="grid grid-cols-2 gap-2 text-sm">
                  {order.customer_name && (
                    <>
                      <span className="text-muted">Khách hàng:</span>
                      <span>{order.customer_name}</span>
                    </>
                  )}
                  {order.customer_phone && (
                    <>
                      <span className="text-muted">Số điện thoại:</span>
                      <span>{order.customer_phone}</span>
                    </>
                  )}
                  {order.customer_address && (
                    <>
                      <span className="text-muted">Địa chỉ:</span>
                      <span>{order.customer_address}</span>
                    </>
                  )}
                  {order.total !== undefined && (
                    <>
                      <span className="text-muted">Tổng cộng:</span>
                      <span className="font-semibold">
                        {order.total.toLocaleString('vi-VN')}₫
                      </span>
                    </>
                  )}
                  {order.payment_method && (
                    <>
                      <span className="text-muted">Thanh toán:</span>
                      <span className="capitalize">
                        {order.payment_method === 'cod' ? 'COD' : order.payment_method}
                      </span>
                    </>
                  )}
                </div>

                {/* Items list */}
                {order.items && order.items.length > 0 && (
                  <div className="mt-4 pt-4 border-t border-border">
                    <h4 className="text-sm font-semibold mb-2">Món đã đặt</h4>
                    <ul className="space-y-1">
                      {order.items.map((item, i) => (
                        <li key={i} className="flex justify-between text-sm">
                          <span>{item.quantity}x {item.name}</span>
                          <span className="text-muted">
                            {(item.price * item.quantity).toLocaleString('vi-VN')}₫
                          </span>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>

              {/* Auto-refresh indicator */}
              <div className="mt-4 text-center text-xs text-muted">
                <span className="inline-block w-2 h-2 rounded-full bg-green-500 mr-1 animate-pulse" />
                Tự động cập nhật mỗi 15 giây
              </div>
            </CardBody>
          </Card>
        )}

        {/* Empty state */}
        {!activeOrderId && (
          <Card>
            <CardBody>
              <div className="text-center py-8 text-muted">
                <p className="text-4xl mb-2">&#128230;</p>
                <p className="font-medium">Chưa có đơn hàng nào</p>
                <p className="text-sm mt-1">Thực hiện đơn hàng đầu tiên của bạn</p>
              </div>
            </CardBody>
          </Card>
        )}
      </div>
    </div>
  );
}

function getStatusTime(
  order: { created_at?: string; status?: string },
  status: string,
): string | undefined {
  // API returns status fields; use created_at as fallback for confirmed
  if (status === 'confirmed') return order.created_at;
  return undefined;
}
