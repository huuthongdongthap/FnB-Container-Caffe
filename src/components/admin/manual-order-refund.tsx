import { useRef, useState } from 'react';
import { apiFetch } from '@/lib/api-client';
import { useClientSessionScope } from '@/lib/client-session';
import { useSubmissionSession } from '@/lib/server-confirmed-submission';
import type { AdminOrder } from '@/hooks/use-admin';

type RefundOrder = AdminOrder & { payment_id?: string; payment_method?: string; payment_status?: string; payment_amount?: number; refund_amount?: number; refund_status?: string };

export function ManualOrderRefund({ order, onRecorded }: { order: AdminOrder; onRecorded: () => void }) {
  const session = useSubmissionSession();
  return <RefundSession key={`${session}:${order.id}:${(order as RefundOrder).refund_amount ?? 0}`} order={order} onRecorded={onRecorded} />;
}

function RefundSession({ order, onRecorded }: { order: AdminOrder; onRecorded: () => void }) {
  const { role } = useClientSessionScope();
  const payment = order as RefundOrder;
  const paid = Number(payment.payment_amount);
  const refunded = Number(payment.refund_amount ?? 0);
  const remaining = paid - refunded;
  const [open, setOpen] = useState(false);
  const [amount, setAmount] = useState('');
  const [reason, setReason] = useState('');
  const [reference, setReference] = useState('');
  const [confirmed, setConfirmed] = useState(false);
  const [status, setStatus] = useState<'idle' | 'pending' | 'recorded' | 'error'>('idle');
  const [error, setError] = useState('');
  const locked = useRef(false);
  const isFullyRefunded = Boolean(payment.payment_id) && payment.payment_method === 'payos'
    && (payment.refund_status === 'completed' || payment.refund_status === 'refunded' || payment.payment_status === 'refunded');
  if (isFullyRefunded) {
    return <div className="mb-3 rounded border border-border/70 bg-surface/60 px-3 py-2 text-xs text-muted">
      Đã hoàn tiền toàn bộ / Fully refunded{Number.isSafeInteger(refunded) && refunded > 0 ? `: ${refunded.toLocaleString('vi-VN')}₫` : ''}
    </div>;
  }
  if (!role || !['owner', 'manager', 'admin'].includes(role)) return null;
  const eligible = Boolean(payment.payment_id) && payment.payment_method === 'payos'
    && ['paid', 'completed', 'partially_refunded'].includes(payment.payment_status ?? '')
    && (!payment.refund_status || payment.refund_status === 'partial')
    && Number.isSafeInteger(paid) && Number.isSafeInteger(refunded) && refunded >= 0 && remaining > 0;
  if (!eligible) return payment.refund_status ? <p role="status">Cần đối soát hoàn tiền / Refund reconciliation required</p> : null;
  const valid = Number.isSafeInteger(Number(amount)) && Number(amount) > 0 && Number(amount) <= remaining
    && Boolean(reason.trim()) && Boolean(reference.trim()) && confirmed;
  async function submit(event: React.FormEvent) {
    event.preventDefault();
    if (!valid || locked.current) return;
    locked.current = true;
    setStatus('pending');
    try {
      const response = await apiFetch<{ success?: boolean; data?: { paymentId?: string; amount?: number; refund_status?: string; manual_transfer_ref?: string } }>('/api/payments/refund', {
        method: 'POST', body: JSON.stringify({ paymentId: payment.payment_id, orderId: order.id, amount: Number(amount), reason: reason.trim(), manual_transfer_ref: reference.trim() }),
      });
      const data = response.data;
      if (response.success !== true || !data || data.paymentId !== payment.payment_id
        || data.amount !== Number(amount) || data.manual_transfer_ref !== reference.trim()
        || !['partial', 'completed'].includes(data.refund_status ?? '')) throw new Error('Chưa xác nhận ghi nhận / Recording not confirmed');
      setStatus('recorded');
      onRecorded();
    } catch (failure) {
      setError(failure instanceof Error ? failure.message : 'Không thể xác nhận / Cannot confirm');
      setStatus('error');
      // An uncertain financial write remains locked until reconciliation and reload.
    }
  }
  return <div className="mt-3 text-sm">
    {refunded > 0 && <p role="status">Đã hoàn một phần / Partially refunded: {refunded.toLocaleString('vi-VN')}₫</p>}
    {!open ? <button type="button" className="text-amber-300 underline" onClick={() => { setAmount(String(remaining)); setOpen(true); }}>Ghi nhận hoàn tiền / Record refund</button> :
      <form onSubmit={submit} className="space-y-3 rounded-lg border border-border p-3" aria-label={`Hoàn tiền / Refund ${order.id}`}>
        <p>Đã thu / Paid: {paid.toLocaleString('vi-VN')}₫ · Đã hoàn / Refunded: {refunded.toLocaleString('vi-VN')}₫ · Còn lại / Remaining: {remaining.toLocaleString('vi-VN')}₫</p>
        <p>Chỉ ghi nhận tiền đã chuyển thủ công. PayOS không tự chuyển tiền. / Records an existing manual transfer only; PayOS does not transfer funds.</p>
        <label className="block">Số tiền / Amount<input className="block w-full bg-surface p-2" type="number" min="1" max={remaining} step="1" required value={amount} disabled={locked.current} onChange={e => setAmount(e.target.value)} /></label>
        <label className="block">Lý do / Reason<input className="block w-full bg-surface p-2" required maxLength={500} value={reason} disabled={locked.current} onChange={e => setReason(e.target.value)} /></label>
        <label className="block">Mã chuyển khoản / Transfer reference<input className="block w-full bg-surface p-2" required maxLength={200} value={reference} disabled={locked.current} onChange={e => setReference(e.target.value)} /></label>
        <label className="block"><input type="checkbox" checked={confirmed} disabled={locked.current} onChange={e => setConfirmed(e.target.checked)} /> Tôi xác nhận khách đã nhận tiền / I confirm funds were transferred to the customer</label>
        {status === 'pending' && <p role="status">Đang chờ xác nhận / Awaiting confirmation</p>}
        {status === 'recorded' && <p role="status">Đã ghi nhận / Recorded</p>}
        {status === 'error' && <p role="alert">{error} — Cần đối soát, tải lại trước khi thử tiếp. / Reconcile and reload before another attempt.</p>}
        <button type="submit" disabled={!valid || status !== 'idle'} className="rounded border border-border p-2 disabled:opacity-50">Xác nhận ghi nhận / Confirm recording</button>
        <button type="button" className="ml-3 underline" disabled={status !== 'idle'} onClick={() => setOpen(false)}>Đóng / Close</button>
      </form>}
  </div>;
}
