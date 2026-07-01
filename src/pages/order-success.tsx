import { useSearchParams, Link } from 'react-router-dom';
import { useEffect, useState, useRef } from 'react';
import { CheckCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useOrderStore } from '@/hooks/stores/use-order-store';
import { StatusProgressBar } from '@/components/order/status-progress-bar';
import { NextSteps } from '@/components/order/next-steps';

function formatPrice(price: number): string {
  return new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND' }).format(price);
}

const STATUS_STEPS = [
  { key: 'pending', label: 'Chờ' },
  { key: 'confirmed', label: 'Xác nhận' },
  { key: 'preparing', label: 'Chế biến' },
  { key: 'ready', label: 'Sẵn sàng' },
  { key: 'delivered', label: 'Giao' },
];

const STATUS_MESSAGES: Record<string, string> = {
  pending: 'Đơn đã ghi nhận, chờ xác nhận',
  pending_payment: 'Thanh toán đang chờ xác nhận',
  awaiting_payment: 'Thanh toán đang chờ xác nhận',
  payment_pending: 'Thanh toán đang chờ xác nhận',
  paid: 'Thanh toán thành công',
  confirmed: 'Nhà hàng đã xác nhận',
  preparing: 'Đang chuẩn bị',
  ready: 'Sẵn sàng giao',
  delivering: 'Đang giao hàng',
  completed: 'Hoàn thành',
  cancelled: 'Đã hủy',
};

export function OrderSuccessPage() {
  const [searchParams] = useSearchParams();
  const orderId = searchParams.get('order_id');
  const pollingRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const POLL_TIMEOUT_MS = 10 * 60 * 1000; // 10 min

  const { currentOrder, fetchOrder } = useOrderStore();

  const [pendingOrder, setPendingOrder] = useState<{
    id?: string;
    status?: string;
    total?: number;
    payment_method?: string;
  } | null>(null);

  const [pollingTimedOut, setPollingTimedOut] = useState(false);

  // Load cached pending order from localStorage
  useEffect(() => {
    try {
      const raw = localStorage.getItem('pendingOrder');
      if (raw) {
        const parsed = JSON.parse(raw) as Record<string, unknown>;
        setPendingOrder({
          id: String(parsed.id ?? ''),
          status: String(parsed.status ?? ''),
          total: Number(parsed.total ?? 0),
          payment_method: String(parsed.payment_method ?? ''),
        });
        localStorage.removeItem('pendingOrder');
      }
    } catch { /* ignore */ }
  }, []);

  // Fetch order + poll every 5s with 10-min timeout
  useEffect(() => {
    if (!orderId) return;

    fetchOrder(orderId);

    pollingRef.current = setInterval(() => {
      fetchOrder(orderId);
    }, 5000);

    // Stop polling after 10 min
    timeoutRef.current = setTimeout(() => {
      setPollingTimedOut(true);
      if (pollingRef.current) {
        clearInterval(pollingRef.current);
        pollingRef.current = null;
      }
    }, POLL_TIMEOUT_MS);

    return () => {
      if (pollingRef.current) {
        clearInterval(pollingRef.current);
      }
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
    };
  }, [orderId, fetchOrder]);

  const order = currentOrder;
  const status = order?.status || pendingOrder?.status || 'pending';
  const currentStepIndex = STATUS_STEPS.findIndex((s) => s.key === status);

  return (
    <div className="min-h-screen bg-gradient-to-b from-[#050D1A] via-[#0A1A2E] to-[#0F172A]">
      <div className="mx-auto max-w-2xl px-4 py-12">
        {/* Success card */}
        <div className="rounded-2xl border border-chrome-light/10 bg-gradient-to-br from-[#0A1A2E]/80 to-[#050D1A]/90 p-8 text-center backdrop-blur-sm">
          {/* Icon */}
          <div className="mx-auto mb-6 flex h-20 w-20 items-center justify-center rounded-full bg-green-500/10">
            <CheckCircle className="h-10 w-10 text-green-400" />
          </div>

          <h1 className="mb-2 font-display text-3xl font-bold text-chrome-bright">
            {order?.payment_method === 'payos' && status !== 'paid'
              ? 'Đơn hàng đang chờ thanh toán PayOS'
              : 'Đặt hàng thành công!'}
          </h1>
          <p className="mb-6 text-chrome-light/70">
            {order?.payment_method === 'payos' && status !== 'paid'
              ? 'Vui lòng hoàn tất thanh toán PayOS. Đơn chỉ được xác nhận sau khi webhook báo đã thanh toán.'
              : 'Cảm ơn bạn đã đặt hàng tại AURA CAFE. Chúng tôi sẽ liên hệ xác nhận trong vòng 5 phút.'}
          </p>

          {/* Polling timeout warning */}
          {pollingTimedOut && order?.payment_method === 'payos' && status !== 'paid' && (
            <div className="mb-6 rounded-lg border border-amber-300 bg-amber-50/10 p-4 text-center">
              <p className="text-sm font-medium text-amber-400">
                ⏳ Đã quá 10 phút chưa nhận được xác nhận thanh toán
              </p>
              <p className="mt-1 text-xs text-amber-400/70">
                Nếu bạn đã thanh toán, vui lòng liên hệ hỗ trợ để được kiểm tra.
                Đơn hàng của bạn vẫn được ghi nhận.
              </p>
            </div>
          )}

          {/* Order info */}
          <div className="mb-8 rounded-xl border border-chrome-light/10 bg-[#0A1A2E]/50 p-6 text-left">
            <div className="space-y-3">
              <div className="flex justify-between">
                <span className="text-sm text-chrome-light/50">Mã đơn hàng</span>
                <span className="text-sm font-semibold text-chrome-bright">
                  #{order?.id || pendingOrder?.id || '---'}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-sm text-chrome-light/50">Tổng cộng</span>
                <span className="text-sm font-semibold text-chrome-bright">
                  {order ? formatPrice(order.total) : pendingOrder?.total ? formatPrice(Number(pendingOrder.total)) : '---'}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-sm text-chrome-light/50">Phương thức</span>
                <span className="text-sm text-chrome-light/80">
                  {order?.payment_method === 'cod' ? 'Tiền mặt (COD)' : order?.payment_method === 'payos' ? 'PayOS' : '---'}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-sm text-chrome-light/50">Trạng thái</span>
                <span className="text-sm text-chrome-light/80">
                  {STATUS_MESSAGES[status] || status || 'Đang xử lý'}
                </span>
              </div>
            </div>
          </div>

          <StatusProgressBar currentStep={currentStepIndex} steps={STATUS_STEPS} />

          <NextSteps />

          {/* Actions */}
          <div className="flex flex-wrap justify-center gap-3">
            <Link to="/menu">
              <Button variant="secondary">Đặt thêm</Button>
            </Link>
            <Link to="/">
              <Button variant="primary">Về trang chủ</Button>
            </Link>
            {orderId && (
              <Link to={`/track-order?id=${orderId}`}>
                <Button variant="ghost">Theo dõi đơn</Button>
              </Link>
            )}
          </div>

          {/* Contact */}
          <div className="mt-8 border-t border-chrome-light/10 pt-6">
            <p className="mb-3 text-xs text-chrome-light/50">Chưa nhận xác nhận? Liên hệ ngay:</p>
            <div className="flex flex-wrap justify-center gap-3">
              <a
                href="tel:0946013633"
                className="inline-flex items-center gap-2 rounded-lg border border-chrome-light/30 px-4 py-2 text-xs font-semibold text-chrome-light transition-colors hover:bg-chrome-light/10"
              >
                📞 Gọi
              </a>
              <a
                href="https://zalo.me/0946013633"
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-2 rounded-lg border border-blue-500/30 px-4 py-2 text-xs font-semibold text-blue-400 transition-colors hover:bg-blue-500/10"
              >
                💬 Zalo
              </a>
              <a
                href={`sms:0946013633?body=${encodeURIComponent('AURA CAFE - Mã đơn ' + (order?.id || ''))}`}
                className="inline-flex items-center gap-2 rounded-lg border border-green-500/30 px-4 py-2 text-xs font-semibold text-green-400 transition-colors hover:bg-green-500/10"
              >
                ✉️ SMS
              </a>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
