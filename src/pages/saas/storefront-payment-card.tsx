import { useEffect, useRef, useState, type ReactNode } from 'react';
import { MD3Button, MD3Card } from '@/components/md3';
import { buildStorefrontVietQrUrl } from '@/lib/vietqr';

export type StorefrontPaymentMethod = 'cod' | 'vietqr' | 'payos';

export interface StorefrontPaymentConfig {
  provider: string;
  hasPayos?: boolean;
  hasBankTransfer: boolean;
  bankName: string | null;
  bankBin?: string | null;
  bankAccountNo?: string | null;
  bankAccountName?: string | null;
}

export interface StorefrontOrderResult {
  orderId: string;
  orderNumber: string;
  total: number;
  tableLabel: string;
  method: StorefrontPaymentMethod;
  payosCheckoutUrl?: string | null;
  payosOrderCode?: number | null;
  paymentError?: string | null;
}

interface StorefrontPaymentCardProps {
  order: StorefrontOrderResult;
  payment: StorefrontPaymentConfig;
  accentColor: string;
  onDismiss: () => void;
}

const ERROR_BANNER_CLASS =
  'rounded-[var(--md-sys-shape-corner-small)] border border-[var(--md-sys-color-error)] bg-[var(--md-sys-color-error-container)] px-3.5 py-2.5 m3-body-small text-[var(--md-sys-color-on-error-container)]';

export function StorefrontPaymentCard({
  order,
  payment,
  accentColor,
  onDismiss,
}: StorefrontPaymentCardProps): ReactNode {
  const [copiedField, setCopiedField] = useState<'account' | 'memo' | null>(null);
  const [copyError, setCopyError] = useState<string | null>(null);
  const copyTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => () => {
    if (copyTimerRef.current) clearTimeout(copyTimerRef.current);
  }, []);

  const transferMemo = `DH ${order.orderNumber}`;
  const vietQrUrl = buildStorefrontVietQrUrl({
    bankBin: payment.bankBin,
    bankAccountNo: payment.bankAccountNo,
    bankAccountName: payment.bankAccountName,
    amountVnd: order.total,
    description: transferMemo,
  });
  const safePayosUrl =
    typeof order.payosCheckoutUrl === 'string' && /^https?:\/\//i.test(order.payosCheckoutUrl.trim())
      ? order.payosCheckoutUrl.trim()
      : null;
  const showVietQr =
    Boolean(vietQrUrl) && (order.method === 'vietqr' || (order.method === 'payos' && !safePayosUrl));

  async function copyValue(value: string, field: 'account' | 'memo') {
    const trimmed = value.trim();
    if (!trimmed) return;
    setCopyError(null);
    if (!navigator?.clipboard?.writeText) {
      setCopiedField(null);
      setCopyError('Trình duyệt không hỗ trợ sao chép tự động. Vui lòng chọn và sao chép thủ công.');
      return;
    }
    try {
      await navigator.clipboard.writeText(trimmed);
      setCopiedField(field);
      if (copyTimerRef.current) clearTimeout(copyTimerRef.current);
      copyTimerRef.current = setTimeout(() => setCopiedField(null), 2000);
    } catch {
      setCopiedField(null);
      setCopyError('Không thể sao chép tự động. Vui lòng chọn và sao chép thủ công.');
    }
  }

  return (
    <MD3Card
      variant="outlined"
      className="p-5 space-y-4 bg-[var(--md-sys-color-surface-container-low)] text-[var(--md-sys-color-on-surface)]"
    >
      <div className="flex items-start justify-between gap-3">
        <div className="space-y-1">
          <div className="m3-title-small text-[var(--md-sys-color-on-surface)]">
            ✓ Đã gửi đơn #{order.orderNumber} thành công!
          </div>
          <div className="m3-body-small text-[var(--md-sys-color-on-surface-variant)]">
            Tổng cộng:{' '}
            <strong className="text-[var(--md-sys-color-on-surface)] tabular-nums">
              {order.total.toLocaleString('vi-VN')}đ
            </strong>{' '}
            — <strong className="text-[var(--md-sys-color-on-surface)]">{order.tableLabel}</strong>
          </div>
        </div>
        <MD3Button type="button" variant="outlined" size="compact" onClick={onDismiss}>
          Đóng
        </MD3Button>
      </div>

      {order.method === 'payos' && safePayosUrl && (
        <MD3Card variant="filled" className="p-4 space-y-3 bg-[var(--md-sys-color-surface-container)]">
          <div className="m3-label-large text-[var(--md-sys-color-on-surface)]">
            Cổng thanh toán PayOS đã sẵn sàng{order.payosOrderCode ? ` (Mã GD: ${order.payosOrderCode})` : ''}
          </div>
          <a
            href={safePayosUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center justify-center rounded-[var(--md-sys-shape-corner-full)] px-5 py-2.5 m3-label-large text-[var(--md-sys-color-on-primary)] bg-[var(--md-sys-color-primary)]"
            style={accentColor ? { backgroundColor: accentColor } : undefined}
          >
            Mở cổng thanh toán PayOS →
          </a>
        </MD3Card>
      )}

      {order.paymentError && <div role="alert" className={ERROR_BANNER_CLASS}>{order.paymentError}</div>}

      {showVietQr && vietQrUrl && (
        <MD3Card
          variant="outlined"
          className="p-4 flex flex-col sm:flex-row items-center gap-4 bg-[var(--md-sys-color-surface-container)]"
        >
          <img
            src={vietQrUrl}
            alt={`Mã VietQR thanh toán đơn ${order.orderNumber}`}
            className="w-48 h-48 rounded-[var(--md-sys-shape-corner-medium)] bg-[var(--md-sys-color-inverse-surface)] p-1.5 object-contain shrink-0"
            loading="eager"
          />
          <div className="space-y-2 m3-body-small text-[var(--md-sys-color-on-surface-variant)] w-full">
            <div className="m3-title-small text-[var(--md-sys-color-on-surface)]">
              Quét mã VietQR bằng ứng dụng ngân hàng
            </div>
            {payment.bankName && (
              <div>Ngân hàng: <strong className="text-[var(--md-sys-color-on-surface)]">{payment.bankName}</strong></div>
            )}
            {payment.bankAccountName && (
              <div>Chủ tài khoản: <strong className="text-[var(--md-sys-color-on-surface)]">{payment.bankAccountName}</strong></div>
            )}
            {payment.bankAccountNo && (
              <div className="flex items-center gap-2 flex-wrap">
                <span>
                  Số TK: <strong className="font-mono text-[var(--md-sys-color-on-surface)] tabular-nums">{payment.bankAccountNo}</strong>
                </span>
                <MD3Button type="button" variant="tonal" size="compact" onClick={() => void copyValue(payment.bankAccountNo || '', 'account')}>
                  {copiedField === 'account' ? 'Đã sao chép' : 'Sao chép'}
                </MD3Button>
              </div>
            )}
            <div className="flex items-center gap-2 flex-wrap">
              <span>
                Nội dung CK: <strong className="font-mono text-[var(--md-sys-color-on-surface)]">{transferMemo}</strong>
              </span>
              <MD3Button type="button" variant="tonal" size="compact" onClick={() => void copyValue(transferMemo, 'memo')}>
                {copiedField === 'memo' ? 'Đã sao chép' : 'Sao chép'}
              </MD3Button>
            </div>
            {copyError && <div role="alert" className={ERROR_BANNER_CLASS}>{copyError}</div>}
          </div>
        </MD3Card>
      )}

      {order.method === 'cod' && (
        <div className="m3-body-small text-[var(--md-sys-color-on-surface-variant)]">
          Vui lòng thanh toán trực tiếp tại quầy khi nhận món.
        </div>
      )}
    </MD3Card>
  );
}
