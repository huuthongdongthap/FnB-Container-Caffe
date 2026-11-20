import { useEffect, useState, type ReactNode } from 'react';
import { useSearchParams } from 'react-router-dom';
import { API_BASE } from '@/lib/api-client';
import { MD3Button, MD3Card } from '@/components/md3';
import { getStorefrontOrderToken } from './storefront-helpers';

interface StorefrontPaymentReturnProps {
  tenant: { id: string; slug: string };
}

type ReturnStatus = 'checking' | 'verified_paid' | 'pending' | 'unverified' | 'cancelled';

const PAID_STATUSES = new Set(['paid', 'completed']);
const CANCELLED_STATUSES = new Set(['cancelled', 'failed', 'expired']);

function getBannerCopy(status: ReturnStatus, orderRef: string) {
  switch (status) {
    case 'verified_paid':
      return {
        badge: 'Xác thực từ máy chủ',
        title: `Đã xác nhận thanh toán đơn ${orderRef}`.trim(),
        body: 'Hệ thống cửa hàng đã ghi nhận giao dịch PayOS cho đơn hàng này.',
      };
    case 'checking':
      return {
        badge: 'Đang đối chiếu',
        title: 'Đang kiểm tra trạng thái thanh toán...',
        body: 'Vui lòng chờ hệ thống đối chiếu dữ liệu giao dịch từ máy chủ cửa hàng.',
      };
    case 'cancelled':
      return {
        badge: 'Chưa hoàn tất',
        title: 'Thanh toán PayOS chưa hoàn tất',
        body: orderRef
          ? `Giao dịch cho đơn ${orderRef} đã bị hủy hoặc chưa hoàn tất. Bạn có thể chọn món lại hoặc thanh toán tại quầy.`
          : 'Giao dịch PayOS đã bị hủy hoặc chưa hoàn tất. Bạn có thể chọn món lại hoặc thanh toán tại quầy.',
      };
    case 'pending':
      return {
        badge: 'Chờ xác nhận',
        title: orderRef ? `Đơn ${orderRef} đang chờ xác nhận thanh toán` : 'Đơn hàng đang chờ xác nhận thanh toán',
        body: 'Hệ thống cửa hàng chưa ghi nhận hoàn tất giao dịch PayOS. Vui lòng đợi ít giây rồi kiểm tra lại hoặc xác nhận tại quầy.',
      };
    default:
      return {
        badge: 'Chưa xác thực',
        title: 'Đã quay lại từ PayOS — đang chờ xác nhận',
        body: orderRef
          ? `Tham số trả về cho đơn ${orderRef} chưa đủ để xác thực giao dịch. Vui lòng kiểm tra xác nhận với nhân viên tại quầy.`
          : 'Tham số trả về từ đường dẫn chưa đủ để xác thực giao dịch. Vui lòng kiểm tra xác nhận với nhân viên tại quầy.',
      };
  }
}

export function StorefrontPaymentReturn({ tenant }: StorefrontPaymentReturnProps): ReactNode {
  const [searchParams, setSearchParams] = useSearchParams();
  const [checkTick, setCheckTick] = useState(0);

  const rawPayment = (searchParams.get('payment') || '').trim().toLowerCase();
  const rawOrderId = (searchParams.get('order_id') || '').trim();
  const hasUrlOrderToken = searchParams.has('order_token');
  const isRecognizedReturn = rawPayment === 'success' || rawPayment === 'cancelled';
  const token = isRecognizedReturn && rawOrderId
    ? getStorefrontOrderToken(tenant.id, tenant.slug, rawOrderId)
    : null;

  const [verification, setVerification] = useState<{ status: ReturnStatus; orderNumber: string }>(() => ({
    status: rawPayment === 'cancelled' ? 'cancelled' : token ? 'checking' : 'unverified',
    orderNumber: rawOrderId,
  }));

  // Strip any stray order_token query param without dropping table or other context.
  useEffect(() => {
    if (!hasUrlOrderToken) return;
    setSearchParams(
      (prev) => {
        if (!prev.has('order_token')) return prev;
        const next = new URLSearchParams(prev);
        next.delete('order_token');
        return next;
      },
      { replace: true },
    );
  }, [hasUrlOrderToken, setSearchParams]);

  useEffect(() => {
    if (!isRecognizedReturn) return;
    if (!token || !rawOrderId) {
      setVerification({
        status: rawPayment === 'cancelled' ? 'cancelled' : 'unverified',
        orderNumber: rawOrderId,
      });
      return;
    }

    let cancelled = false;
    const controller = new AbortController();
    setVerification({ status: 'checking', orderNumber: rawOrderId });

    void fetch(
      `${API_BASE}/api/orders/${encodeURIComponent(rawOrderId)}?store=${encodeURIComponent(tenant.slug)}`,
      {
        method: 'GET',
        credentials: 'omit',
        signal: controller.signal,
        headers: {
          'X-Tenant-Slug': tenant.slug,
          'X-Tenant-ID': tenant.id,
          'X-Order-Token': token,
        },
      },
    )
      .then(async (resp) => {
        const json = (await resp.json().catch(() => ({}))) as {
          success?: boolean;
          data?: {
            orderNumber?: string;
            order_number?: string;
            paymentStatus?: string;
            payment_status?: string;
          };
        };
        if (cancelled) return;
        if (!resp.ok || json.success === false || !json.data) {
          setVerification({
            status: rawPayment === 'cancelled' ? 'cancelled' : 'unverified',
            orderNumber: rawOrderId,
          });
          return;
        }
        const resolvedNumber = String(json.data.orderNumber ?? json.data.order_number ?? '').trim() || rawOrderId;
        const paymentStatus = String(json.data.paymentStatus ?? json.data.payment_status ?? '').trim().toLowerCase();
        if (PAID_STATUSES.has(paymentStatus)) {
          setVerification({ status: 'verified_paid', orderNumber: resolvedNumber });
        } else if (CANCELLED_STATUSES.has(paymentStatus) || rawPayment === 'cancelled') {
          setVerification({ status: 'cancelled', orderNumber: resolvedNumber });
        } else {
          setVerification({ status: 'pending', orderNumber: resolvedNumber });
        }
      })
      .catch(() => {
        if (!cancelled) {
          setVerification({
            status: rawPayment === 'cancelled' ? 'cancelled' : 'unverified',
            orderNumber: rawOrderId,
          });
        }
      });

    return () => {
      cancelled = true;
      controller.abort();
    };
  }, [isRecognizedReturn, rawPayment, rawOrderId, tenant.id, tenant.slug, token, checkTick]);

  if (!isRecognizedReturn) return null;

  function handleDismiss() {
    setSearchParams(
      (prev) => {
        const next = new URLSearchParams(prev);
        next.delete('payment');
        next.delete('order_id');
        return next;
      },
      { replace: true },
    );
  }

  const orderRef = verification.orderNumber ? `#${verification.orderNumber}` : '';
  const canRecheck = Boolean(token) && (verification.status === 'pending' || verification.status === 'unverified');
  const copy = getBannerCopy(verification.status, orderRef);

  return (
    <MD3Card
      variant="outlined"
      role="status"
      aria-live="polite"
      data-payment-return-state={verification.status}
      className="p-4 space-y-3 bg-[var(--md-sys-color-surface-container-low)] text-[var(--md-sys-color-on-surface)] border-[var(--md-sys-color-outline)]"
    >
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div className="space-y-1 flex-1 min-w-[200px]">
          <span className="inline-block rounded-[var(--md-sys-shape-corner-small)] bg-[var(--md-sys-color-secondary-container)] px-2.5 py-0.5 m3-label-small text-[var(--md-sys-color-on-secondary-container)]">
            {copy.badge}
          </span>
          <h2 className="m3-title-small text-[var(--md-sys-color-on-surface)]">{copy.title}</h2>
          <p className="m3-body-small text-[var(--md-sys-color-on-surface-variant)]">{copy.body}</p>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          {canRecheck && (
            <MD3Button type="button" variant="tonal" size="compact" className="min-w-[44px]" onClick={() => setCheckTick((n) => n + 1)}>
              Kiểm tra lại
            </MD3Button>
          )}
          <MD3Button type="button" variant="outlined" size="compact" className="min-w-[44px]" onClick={handleDismiss}>
            Đóng
          </MD3Button>
        </div>
      </div>
    </MD3Card>
  );
}
