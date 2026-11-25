import { brandConfig } from '@/config/brand-types';

export interface ThermalReceiptItem {
  name: string;
  quantity: number;
  price?: number;
  notes?: string;
  modifiers?: string[];
}

export interface ThermalReceiptData {
  orderId: string;
  orderNumber?: string;
  isProForma?: boolean;
  createdAt?: string;
  orderType?: string;
  tableName?: string;
  customerName?: string;
  customerPhone?: string;
  customerAddress?: string;
  cashierName?: string;
  items: ThermalReceiptItem[];
  subtotal?: number;
  shippingFee?: number;
  serviceFee?: number;
  discount?: number;
  cashbackUsed?: number;
  total: number;
  paymentMethod?: string;
  paymentStatus?: string;
  notes?: string;
  storeName?: string;
  storeAddress?: string;
  storePhone?: string;
  receiptFooter?: string;
}

const DEFAULT_RECEIPT_FOOTER = 'Cảm ơn quý khách! Hẹn gặp lại.';

function formatVnd(amount: number): string {
  return `${Math.round(amount).toLocaleString('vi-VN')} ₫`;
}

function sanitizeReceiptNotes(raw?: string): string | undefined {
  if (typeof raw !== 'string') return undefined;
  const cleaned = raw
    .split('|')
    .map((part) => part.replace(/\[OVERDUE\]/gi, '').trim())
    .filter(Boolean)
    .join(' | ');
  return cleaned || undefined;
}

function formatReceiptTime(iso?: string): string {
  const normalized = iso && /^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}$/.test(iso.trim())
    ? `${iso.trim().replace(' ', 'T')}Z`
    : iso;
  const d = normalized ? new Date(normalized) : new Date();
  if (Number.isNaN(d.getTime())) return iso || '';
  return d.toLocaleString('vi-VN', {
    timeZone: 'Asia/Ho_Chi_Minh',
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function formatChannelLabel(orderType?: string, tableName?: string): string {
  if (orderType === 'delivery') return 'Giao hàng';
  if (orderType === 'takeaway') return 'Mang đi';
  if (tableName) return `Tại quán — ${tableName}`;
  return 'Tại quán';
}

function formatPaymentMethodLabel(method?: string): string {
  const m = String(method || '').trim().toLowerCase();
  if (m === 'payos') return 'PayOS / Chuyển khoản';
  if (m === 'cod') return 'COD (Thu hộ)';
  if (m === 'cash') return 'Tiền mặt';
  if (m === 'bank_transfer' || m === 'qr') return 'Chuyển khoản QR';
  return method || 'Tiền mặt';
}

function formatPaymentStatusLabel(status?: string): string {
  const s = String(status || '').trim().toLowerCase();
  if (s === 'paid' || s === 'completed') return 'Đã thanh toán';
  if (s === 'partially_refunded') return 'Hoàn một phần';
  if (s === 'refunded') return 'Đã hoàn tiền';
  if (s === 'unpaid' || s === 'pending') return 'Chưa thanh toán';
  return status || '';
}

export function ThermalReceipt({ receipt }: { receipt: ThermalReceiptData | null }) {
  if (!receipt) return null;

  const storeName = receipt.storeName || brandConfig.brand.name;
  const storeAddress = receipt.storeAddress || brandConfig.brand.address;
  const storePhone = receipt.storePhone || brandConfig.brand.phone;
  const footer = receipt.receiptFooter?.trim() || DEFAULT_RECEIPT_FOOTER;
  const title = receipt.isProForma ? 'PHIẾU TẠM TÍNH' : 'HÓA ĐƠN BÁN HÀNG';

  const computedSubtotal =
    receipt.subtotal ??
    receipt.items.reduce(
      (sum, item) => sum + (typeof item.price === 'number' ? item.price * item.quantity : 0),
      0,
    );
  const showSubtotal =
    computedSubtotal > 0 &&
    ((receipt.shippingFee ?? 0) > 0 ||
      (receipt.serviceFee ?? 0) > 0 ||
      (receipt.discount ?? 0) > 0 ||
      (receipt.cashbackUsed ?? 0) > 0);

  return (
    <section
      id="aura-thermal-receipt"
      aria-label={title}
      className="aura-thermal-receipt hidden print:block"
    >
      <style>{`
        @media print {
          @page {
            size: 80mm auto;
            margin: 2mm;
          }
          html, body {
            background: #ffffff !important;
            color: #000000 !important;
            height: auto !important;
            min-height: 0 !important;
            overflow: visible !important;
            margin: 0 !important;
            padding: 0 !important;
          }
          .aura-thermal-receipt {
            display: block !important;
            width: 76mm !important;
            max-width: 76mm !important;
            margin: 0 auto !important;
            padding: 2mm 0 !important;
            background: #ffffff !important;
            color: #000000 !important;
            font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace !important;
            font-size: 11px !important;
            line-height: 1.35 !important;
            page-break-after: avoid !important;
            break-after: avoid !important;
          }
          .aura-thermal-receipt * {
            color: #000000 !important;
            background: transparent !important;
            box-shadow: none !important;
          }
        }
      `}</style>

      <div className="text-center border-b border-dashed border-black pb-2 mb-2">
        <div className="text-sm font-bold uppercase tracking-wide">{storeName}</div>
        {storeAddress && <div className="text-[10px] mt-0.5">{storeAddress}</div>}
        {storePhone && <div className="text-[10px]">ĐT: {storePhone}</div>}
        <div className="text-xs font-bold uppercase mt-2 tracking-wider">{title}</div>
      </div>

      <div className="space-y-0.5 text-[10px] border-b border-dashed border-black pb-2 mb-2">
        <div className="flex justify-between gap-2">
          <span>Mã đơn:</span>
          <span className="font-bold">#{(receipt.orderNumber || receipt.orderId).replace(/^#/, '')}</span>
        </div>
        <div className="flex justify-between gap-2">
          <span>Thời gian:</span>
          <span>{formatReceiptTime(receipt.createdAt)}</span>
        </div>
        <div className="flex justify-between gap-2">
          <span>Kênh:</span>
          <span>{formatChannelLabel(receipt.orderType, receipt.tableName)}</span>
        </div>
        {receipt.cashierName && (
          <div className="flex justify-between gap-2">
            <span>Thu ngân:</span>
            <span>{receipt.cashierName}</span>
          </div>
        )}
        {receipt.customerName && (
          <div className="flex justify-between gap-2">
            <span>Khách hàng:</span>
            <span>{receipt.customerName}</span>
          </div>
        )}
        {receipt.customerPhone && (
          <div className="flex justify-between gap-2">
            <span>SĐT:</span>
            <span>{receipt.customerPhone}</span>
          </div>
        )}
        {receipt.customerAddress && (
          <div className="flex justify-between gap-2">
            <span>Địa chỉ:</span>
            <span className="text-right">{receipt.customerAddress}</span>
          </div>
        )}
      </div>

      <table className="w-full text-[10px] border-b border-dashed border-black pb-2 mb-2">
        <thead>
          <tr className="border-b border-black text-left">
            <th className="py-1 font-bold">Món</th>
            <th className="py-1 text-center font-bold">SL</th>
            <th className="py-1 text-right font-bold">T.Tiền</th>
          </tr>
        </thead>
        <tbody>
          {receipt.items.map((item, idx) => {
            const lineTotal =
              typeof item.price === 'number' && Number.isFinite(item.price)
                ? item.price * item.quantity
                : null;
            return (
              <tr key={`${item.name}-${idx}`} className="align-top">
                <td className="py-1 pr-1">
                  <div className="font-semibold">{item.name}</div>
                  {typeof item.price === 'number' && Number.isFinite(item.price) && (
                    <div className="text-[9px]">ĐG: {formatVnd(item.price)}</div>
                  )}
                  {item.modifiers && item.modifiers.length > 0 && (
                    <div className="text-[9px]">+ {item.modifiers.join(', ')}</div>
                  )}
                  {item.notes && <div className="text-[9px] italic">Ghi chú: {item.notes}</div>}
                </td>
                <td className="py-1 text-center">{item.quantity}</td>
                <td className="py-1 text-right whitespace-nowrap">
                  {lineTotal !== null ? formatVnd(lineTotal) : '—'}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>

      <div className="space-y-0.5 text-[10px] border-b border-dashed border-black pb-2 mb-2">
        {showSubtotal && (
          <div className="flex justify-between">
            <span>Tạm tính:</span>
            <span>{formatVnd(computedSubtotal)}</span>
          </div>
        )}
        {(receipt.shippingFee ?? 0) > 0 && (
          <div className="flex justify-between">
            <span>Phí giao hàng:</span>
            <span>+{formatVnd(receipt.shippingFee!)}</span>
          </div>
        )}
        {(receipt.serviceFee ?? 0) > 0 && (
          <div className="flex justify-between">
            <span>Phí dịch vụ:</span>
            <span>+{formatVnd(receipt.serviceFee!)}</span>
          </div>
        )}
        {(receipt.discount ?? 0) > 0 && (
          <div className="flex justify-between">
            <span>Giảm giá:</span>
            <span>-{formatVnd(receipt.discount!)}</span>
          </div>
        )}
        {(receipt.cashbackUsed ?? 0) > 0 && (
          <div className="flex justify-between">
            <span>Hoàn tiền (Cashback):</span>
            <span>-{formatVnd(receipt.cashbackUsed!)}</span>
          </div>
        )}
        <div className="flex justify-between text-xs font-bold pt-1">
          <span>TỔNG CỘNG:</span>
          <span>{formatVnd(receipt.total)}</span>
        </div>
        <div className="flex justify-between pt-1">
          <span>Thanh toán:</span>
          <span>
            {formatPaymentMethodLabel(receipt.paymentMethod)}
            {receipt.paymentStatus ? ` (${formatPaymentStatusLabel(receipt.paymentStatus)})` : ''}
          </span>
        </div>
        {sanitizeReceiptNotes(receipt.notes) && (
          <div className="pt-1 text-[9px] italic">Ghi chú: {sanitizeReceiptNotes(receipt.notes)}</div>
        )}
      </div>

      <div className="text-center text-[10px] pt-1 whitespace-pre-line">{footer}</div>
    </section>
  );
}
