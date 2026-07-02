import { useEffect } from 'react';
import { useSearchParams, Link } from 'react-router-dom';
import { XCircle } from 'lucide-react';
import { useOrderStore } from '@/hooks/stores/use-order-store';
import { Button } from '@/components/ui/button';

const ERROR_MESSAGES: Record<string, string> = {
  '24': 'Giao dịch bị hủy bởi khách hàng',
  '51': 'Số dư không đủ',
  '85': 'Thẻ/số điện thoại không hợp lệ',
  '99': 'Lỗi hệ thống ngân hàng',
  '100': 'Giao dịch quá thời gian chờ',
  FAIL: 'Thanh toán thất bại',
};

function getErrorMessage(code: string | null): string {
  if (!code) return 'Không xác định được';
  return ERROR_MESSAGES[code] || `Mã lỗi: ${code}`;
}

export function OrderFailurePage() {
  const [searchParams] = useSearchParams();
  const orderId = searchParams.get('order_id');
  const errorCode = searchParams.get('error');
  const responseCode = searchParams.get('responseCode');

  const { currentOrder, fetchOrder } = useOrderStore();

  // Fetch order details if orderId present
  useEffect(() => {
    if (orderId) {
      fetchOrder(orderId);
    }
  }, [orderId, fetchOrder]);

  const reason = responseCode
    ? getErrorMessage(responseCode)
    : errorCode
      ? decodeURIComponent(errorCode)
      : 'Không xác định được';

  const handleRetry = () => {
    const target = orderId ? `/checkout?retry=true&order_id=${orderId}` : '/menu';
    window.location.href = target;
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-[#050D1A] via-[#0A1A2E] to-[#0F172A]">
      <div className="mx-auto max-w-2xl px-4 py-12">
        {/* Failure card */}
        <div className="rounded-2xl border border-red-500/10 bg-gradient-to-br from-[#0A1A2E]/80 to-[#050D1A]/90 p-8 text-center backdrop-blur-sm">
          {/* Icon */}
          <div className="mx-auto mb-6 flex h-20 w-20 items-center justify-center rounded-full bg-red-500/10">
            <XCircle className="h-10 w-10 text-red-400" />
          </div>

          <h1 className="mb-2 font-[EB_Garamond,serif] text-3xl font-bold text-chrome-bright">
            Thanh toán thất bại
          </h1>
          <p className="mb-4 text-chrome-light/70">
            Rất tiếc, thanh toán thất bại. Bạn có thể thử lại ngay, hệ thống chỉ ghi nhận
            khi thanh toán thành công.
          </p>
          <p className="mb-6 text-sm text-chrome-light/50">
            ⏱️ Hỗ trợ phản hồi trong 5 phút qua hotline/Zalo nếu cần kiểm tra giao dịch.
          </p>

          {/* Error reason */}
          <div className="mb-8 rounded-xl border border-red-500/10 bg-red-500/5 p-4">
            <p className="text-sm text-red-300">
              Nguyên nhân: <span className="font-semibold">{reason}</span>
            </p>
          </div>

          {/* Order info */}
          {(orderId || currentOrder) && (
            <div className="mb-8 rounded-xl border border-chrome-light/10 bg-[#0A1A2E]/50 p-6 text-left">
              <div className="space-y-3">
                <div className="flex justify-between">
                  <span className="text-sm text-chrome-light/50">Mã đơn hàng</span>
                  <span className="text-sm font-semibold text-chrome-bright">#{currentOrder?.id || orderId}</span>
                </div>
                {currentOrder && (
                  <>
                    <div className="flex justify-between">
                      <span className="text-sm text-chrome-light/50">Tổng cộng</span>
                      <span className="text-sm font-semibold text-chrome-bright">
                        {new Intl.NumberFormat('vi-VN').format(currentOrder.total) + '₫'}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-sm text-chrome-light/50">Trạng thái</span>
                      <span className="text-sm text-chrome-light/80">
                        {currentOrder.status === 'pending' ? 'Chờ thanh toán' : currentOrder.status}
                      </span>
                    </div>
                  </>
                )}
              </div>
            </div>
          )}

          {/* Actions */}
          <div className="mb-8 flex flex-wrap justify-center gap-3">
            <Button variant="primary" onClick={handleRetry}>
              Thử lại
            </Button>
            <Link to="/menu">
              <Button variant="secondary">Quay lại Menu</Button>
            </Link>
            <Link to="/">
              <Button variant="ghost">Trang chủ</Button>
            </Link>
          </div>

          {/* Common causes */}
          <div className="mb-8 rounded-xl border border-chrome-light/10 bg-[#0A1A2E]/50 p-6 text-left">
            <h3 className="mb-4 font-[EB_Garamond,serif] text-lg font-semibold text-chrome-bright">
              Nguyên nhân phổ biến
            </h3>
            <div className="space-y-3">
              <div className="flex gap-3">
                <span className="mt-0.5 shrink-0 text-chrome-light">💳</span>
                <p className="text-sm text-chrome-light/70">
                  Thẻ/số dư không đủ hoặc đã hết hạn
                </p>
              </div>
              <div className="flex gap-3">
                <span className="mt-0.5 shrink-0 text-chrome-light">📡</span>
                <p className="text-sm text-chrome-light/70">
                  Kết nối mạng không ổn định trong lúc thanh toán
                </p>
              </div>
              <div className="flex gap-3">
                <span className="mt-0.5 shrink-0 text-chrome-light">⏰</span>
                <p className="text-sm text-chrome-light/70">
                  Phiên thanh toán đã hết thời gian chờ
                </p>
              </div>
              <div className="flex gap-3">
                <span className="mt-0.5 shrink-0 text-chrome-light">🔒</span>
                <p className="text-sm text-chrome-light/70">
                  Xác thực OTP không thành công
                </p>
              </div>
            </div>
          </div>

          {/* Contact support */}
          <div className="border-t border-chrome-light/10 pt-6">
            <p className="mb-3 text-sm font-semibold text-chrome-light/80">Cần hỗ trợ?</p>
            <div className="flex flex-wrap justify-center gap-4">
              <a
                href="tel:0946013633"
                className="text-sm text-chrome-light/60 hover:text-chrome-bright transition-colors"
              >
                📞 0946 013 633
              </a>
              <a
                href="https://zalo.me/0946013633"
                target="_blank"
                rel="noopener noreferrer"
                className="text-sm text-chrome-light/60 hover:text-chrome-bright transition-colors"
              >
                💬 Zalo
              </a>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
