import { useEffect, useRef, useState } from 'react';
import { apiFetch } from '@/lib/api-client';
import { createSubmissionKey, requireConfirmation, submissionError } from '@/lib/server-confirmed-submission';
import { useClientSessionScope } from '@/lib/client-session';
import type { AdminCustomer } from '@/hooks/use-admin';

type Detail = {
  customerId: string;
  account: null | { name: string | null; phone: string | null; email: string | null; tier: string; points: number; recentOrders: { id: string; totalCents: number; status: string; placedAt: string }[] };
  tier: { name: string; cashbackRate: number; pointMultiplier: number };
  recentEvents: { events: { id: string; source: string; timestamp: string; payload: Record<string, unknown> }[] };
};

export function CustomerDetail({ customer, onClose }: { customer: AdminCustomer; onClose: () => void }) {
  const { role } = useClientSessionScope();
  const [detail, setDetail] = useState<Detail | null>(null);
  const [error, setError] = useState('');
  const [revision, setRevision] = useState(0);
  const [points, setPoints] = useState('');
  const [reason, setReason] = useState('');
  const [confirmed, setConfirmed] = useState(false);
  const [pending, setPending] = useState(false);
  const [notice, setNotice] = useState('');
  const key = useRef(createSubmissionKey());
  const lock = useRef(false);
  const mounted = useRef(true);
  useEffect(() => { mounted.current = true; return () => { mounted.current = false; }; }, []);
  useEffect(() => {
    let active = true;
    setError('');
    setDetail(null);
    apiFetch<{ success: boolean; data: Detail }>(`/api/crm/customers/${encodeURIComponent(customer.id)}/360?eventLimit=100`).then(body => {
      if (body.success !== true || body.data?.customerId !== customer.id || !Array.isArray(body.data.recentEvents?.events)) throw new Error('Hồ sơ không hợp lệ / Invalid profile');
      if (active) setDetail(body.data);
    }).catch(failure => { if (active) setError(submissionError(failure)); });
    return () => { active = false; };
  }, [customer.id, revision]);
  async function adjust(event: React.FormEvent) {
    event.preventDefault();
    if (lock.current || !confirmed || !reason.trim() || !Number.isSafeInteger(Number(points)) || Number(points) === 0) return;
    lock.current = true; setPending(true); setNotice('');
    const payload = { customerId: customer.id, points: Number(points), reason: reason.trim() };
    try {
      const response = await apiFetch('/api/loyalty/admin/adjust-points', { method: 'POST', body: JSON.stringify({ ...payload, idempotencyKey: key.current.forPayload(payload) }) });
      requireConfirmation(response);
      if (!mounted.current) return;
      key.current.clear(); setPoints(''); setReason(''); setConfirmed(false);
      setNotice('Đã ghi nhận điều chỉnh / Adjustment recorded'); setRevision(value => value + 1);
    } catch (failure) { if (mounted.current) setNotice(submissionError(failure)); }
    finally { lock.current = false; if (mounted.current) setPending(false); }
  }
  return <section role="dialog" aria-modal="true" aria-label="Hồ sơ khách hàng / Customer profile" className="fixed inset-0 z-50 overflow-y-auto bg-background/95 p-6">
    <div className="mx-auto max-w-3xl space-y-4 rounded-xl border border-border bg-surface p-6">
      <button type="button" onClick={onClose} className="underline">Đóng / Close</button>
      <h2 className="text-xl">{customer.name} — Hồ sơ / Profile</h2>
      <p>{customer.phone} · {customer.tier} · {customer.totalOrders} đơn / orders · {customer.totalSpent.toLocaleString('vi-VN')}₫</p>
      {error && <p role="alert">{error} <button type="button" onClick={() => setRevision(v => v + 1)}>Thử lại / Retry</button></p>}
      {!detail && !error && <p role="status">Đang tải / Loading</p>}
      {detail && <>
        <p>Email: {detail.account?.email || '—'} · Điểm / Points: {detail.account?.points ?? 'Chưa có dữ liệu / Unavailable'}</p>
        <p>Quyền lợi / Benefits: {detail.tier.name} · Cashback {detail.tier.cashbackRate < 1 ? Math.round(detail.tier.cashbackRate * 100) : Math.round(detail.tier.cashbackRate)}% · x{detail.tier.pointMultiplier} điểm / points</p>
        <h3>Đơn gần đây / Recent orders</h3>
        <ul>{detail.account?.recentOrders.map(order => <li key={order.id}>{order.id} · {order.status} · {order.totalCents.toLocaleString('vi-VN')}₫ · {order.placedAt}</li>)}</ul>
        <h3>Lịch sử điểm gần đây / Recent point history</h3>
        <ul>{detail.recentEvents.events.filter(event => event.source === 'loyalty').map(event => <li key={event.id}>{event.timestamp} · {String(event.payload.points ?? '')} · {String(event.payload.reason ?? '')}</li>)}</ul>
        {['owner', 'admin', 'manager'].includes(role ?? '') && <form onSubmit={adjust} className="space-y-3 border-t border-border pt-3">
          <h3>Điều chỉnh điểm / Adjust points</h3>
          <label className="block">Điểm (+/-) / Points<input className="block bg-background p-2" type="number" step="1" required value={points} disabled={pending} onChange={e => setPoints(e.target.value)} /></label>
          <label className="block">Lý do / Reason<input className="block w-full bg-background p-2" required maxLength={200} value={reason} disabled={pending} onChange={e => setReason(e.target.value)} /></label>
          <label className="block"><input type="checkbox" checked={confirmed} disabled={pending} onChange={e => setConfirmed(e.target.checked)} /> Xác nhận điều chỉnh / Confirm adjustment</label>
          <button type="submit" disabled={pending || !confirmed || !reason.trim() || !Number.isSafeInteger(Number(points)) || Number(points) === 0} className="rounded border border-border p-2 disabled:opacity-50">{pending ? 'Đang lưu / Saving' : 'Lưu điểm / Save points'}</button>
        </form>}
        {notice && <p role="status">{notice}</p>}
      </>}
    </div>
  </section>;
}
