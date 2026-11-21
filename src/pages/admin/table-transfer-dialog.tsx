import { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { apiFetch } from '@/lib/api-client';
import { isSameSessionSnapshot, readSessionSnapshot, type SessionSnapshot } from '@/lib/client-session';
import { useDialogFocusTrap } from '@/components/menu/use-dialog-focus-trap';
import type { CafeTableRow, TableSessionRow, TableTransferFeedback } from './TableManagement-types';

interface Props {
  source: CafeTableRow;
  session: SessionSnapshot;
  onClose: () => void;
  onResult: (feedback: TableTransferFeedback) => void;
}

export function TableTransferDialog({ source, session, onClose, onResult }: Props) {
  const { i18n } = useTranslation();
  const vi = i18n.language?.startsWith('vi');
  const copy = (vn: string, en: string) => vi ? vn : en;
  const dialog = useRef<HTMLDivElement>(null);
  const submitting = useRef(false);
  const [loading, setLoading] = useState(true);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState('');
  const [tables, setTables] = useState<CafeTableRow[]>([]);
  const [activeSession, setActiveSession] = useState<TableSessionRow | null>(null);
  const [destinationId, setDestinationId] = useState('');
  const [reservation, setReservation] = useState(false);
  const [confirmed, setConfirmed] = useState(false);
  const [attempt, setAttempt] = useState(0);
  const close = () => { if (!submitting.current) onClose(); };
  useDialogFocusTrap(dialog, true, close);

  useEffect(() => {
    const previous = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => { document.body.style.overflow = previous; };
  }, []);

  useEffect(() => {
    let alive = true;
    setLoading(true);
    setError('');
    setDestinationId('');
    setConfirmed(false);
    setActiveSession(null);
    void Promise.all([
      apiFetch<{ success: boolean; data: CafeTableRow[]; error?: string }>('/api/tables'),
      apiFetch<{ success: boolean; data: TableSessionRow[]; error?: string }>(`/api/table-sessions?table_id=${encodeURIComponent(source.id)}`),
    ]).then(([tableResponse, sessionResponse]) => {
      if (!alive || !isSameSessionSnapshot(readSessionSnapshot(), session)) return;
      if (!tableResponse.success || !sessionResponse.success) {
        throw new Error(tableResponse.error || sessionResponse.error || copy('Không tải được dữ liệu bàn.', 'Unable to load table details.'));
      }
      const sessions = sessionResponse.data.filter(row => row.table_id === source.id && ['active', 'ordering'].includes(row.status.toLowerCase()));
      if (sessions.length !== 1 || (source.current_session_id && sessions[0]?.id !== source.current_session_id)) {
        throw new Error(copy('Không tìm thấy một phiên phục vụ hợp lệ. Làm mới trước khi chuyển.', 'A single transferable session could not be identified. Refresh before transferring.'));
      }
      setActiveSession(sessions[0]!);
      setTables(tableResponse.data);
    }).catch((cause: unknown) => {
      if (!alive || !isSameSessionSnapshot(readSessionSnapshot(), session)) return;
      const message = cause instanceof Error ? cause.message : copy('Không tải được dữ liệu bàn.', 'Unable to load table details.');
      setError(message);
      onResult({ kind: 'error', message });
    }).finally(() => { if (alive) setLoading(false); });
    return () => { alive = false; };
    // Source and account scope are immutable for this mounted dialog.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [attempt, source.id]);

  const requiredCapacity = Number(activeSession?.guest_count ?? activeSession?.covers ?? source.capacity);
  const destinations = tables.filter(table => table.id !== source.id
    && table.status.toLowerCase() === 'available' && table.is_active !== 0 && table.is_active !== false
    && !table.current_session_id && table.capacity >= requiredCapacity
    && (!source.tenant_id || !table.tenant_id || source.tenant_id === table.tenant_id));
  const destination = destinations.find(table => table.id === destinationId);

  const transfer = async () => {
    if (submitting.current || !activeSession || !destination || !confirmed || !isSameSessionSnapshot(readSessionSnapshot(), session)) return;
    submitting.current = true;
    setPending(true);
    setError('');
    try {
      const result = await apiFetch<{ success: boolean; error?: string }>(`/api/table-sessions/${encodeURIComponent(activeSession.id)}/transfer`, {
        method: 'POST',
        body: JSON.stringify({ source_table_id: source.id, destination_table_id: destination.id, transfer_reservation: reservation }),
      });
      if (!isSameSessionSnapshot(readSessionSnapshot(), session)) return;
      if (!result?.success) throw new Error(result?.error || copy('Không chuyển được bàn.', 'Unable to transfer table.'));
      onResult({ kind: 'success', message: copy(
        `Đã chuyển bàn ${source.table_number} → ${destination.table_number}: phiên phục vụ và đơn đang mở${reservation ? ', kèm đặt bàn đã nhận khách' : '; giữ nguyên đặt bàn'}.`,
        `Transferred table ${source.table_number} → ${destination.table_number}: session and active orders${reservation ? ', including the seated reservation' : '; reservation unchanged'}.`,
      ) });
    } catch (cause: unknown) {
      if (!isSameSessionSnapshot(readSessionSnapshot(), session)) return;
      const detail = cause instanceof Error ? cause.message : copy('Không chuyển được bàn.', 'Unable to transfer table.');
      const message = `${copy('Chuyển bàn thất bại. Làm mới và kiểm tra trước khi thử lại.', 'Transfer failed. Refresh and verify before retrying.')} ${detail}`;
      setError(message);
      setConfirmed(false);
      setActiveSession(null);
      onResult({ kind: 'error', message });
    } finally {
      submitting.current = false;
      setPending(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-md-scrim/32 p-4">
      <div ref={dialog} role="dialog" aria-modal="true" aria-labelledby="table-transfer-title" aria-describedby="table-transfer-scope"
        tabIndex={-1} aria-busy={pending} className="w-full max-w-lg max-h-[90dvh] overflow-y-auto rounded-xl border border-border bg-surface text-foreground p-6 space-y-4">
        <h2 id="table-transfer-title" className="text-xl font-semibold">{copy('Chuyển bàn', 'Transfer table')}</h2>
        <p>{copy('Bàn nguồn', 'Source table')}: {source.table_number} · {source.zone}</p>
        <p id="table-transfer-scope" className="text-sm">{copy('Chuyển phiên phục vụ hiện tại và tất cả đơn đang mở. Đây không phải chọn bàn cho đơn mới. Đơn đã hoàn tất và thanh toán không thay đổi.', 'Move the current session and all active orders. This is not table selection for a new order. Completed orders and payments remain unchanged.')}</p>
        {loading && <p role="status">{copy('Đang tải bàn trống…', 'Loading available tables…')}</p>}
        {error && <p role="alert" className="text-sm break-words">{error}</p>}
        {!loading && activeSession && <>
          <label className="block space-y-2">
            <span>{copy('Bàn đích còn trống', 'Available destination table')}</span>
            <select value={destinationId} disabled={pending} onChange={event => { setDestinationId(event.target.value); setConfirmed(false); }} className="w-full rounded-lg border border-border bg-background p-3">
              <option value="">{copy('Chọn bàn đích', 'Choose destination')}</option>
              {destinations.map(table => <option key={table.id} value={table.id}>{table.table_number} · {table.zone} · {table.capacity} {copy('chỗ', 'seats')}</option>)}
            </select>
          </label>
          {destinations.length === 0 && <p>{copy('Không có bàn trống đủ chỗ. Làm mới để kiểm tra lại.', 'No available table has enough seats. Refresh to check again.')}</p>}
          <label className="flex items-start gap-3"><input type="checkbox" checked={reservation} disabled={pending} onChange={event => { setReservation(event.target.checked); setConfirmed(false); }} className="mt-1" />
            <span>{copy('Chuyển cả đặt bàn đã nhận khách hôm nay (chỉ chọn nếu có).', 'Also move today’s seated reservation (select only if one exists).')}</span>
          </label>
          {!reservation && <p className="text-sm">{copy('Đặt bàn được giữ ở bàn nguồn.', 'The reservation stays at the source table.')}</p>}
          {destination && <label className="flex items-start gap-3"><input type="checkbox" checked={confirmed} disabled={pending} onChange={event => setConfirmed(event.target.checked)} className="mt-1" />
            <span>{copy(`Xác nhận chuyển bàn ${source.table_number} → ${destination.table_number}, gồm phiên phục vụ, đơn đang mở${reservation ? ' và đặt bàn đã nhận khách' : '; không chuyển đặt bàn'}.`, `Confirm transfer ${source.table_number} → ${destination.table_number}, including session, active orders${reservation ? ' and seated reservation' : '; without moving the reservation'}.`)}</span>
          </label>}
        </>}
        <div className="flex flex-wrap justify-end gap-3">
          <button type="button" onClick={close} disabled={pending} className="rounded-lg border border-border px-4 py-3 disabled:opacity-50">{copy('Hủy', 'Cancel')}</button>
          <button type="button" disabled={pending || loading} onClick={() => setAttempt(value => value + 1)} className="rounded-lg border border-border px-4 py-3 disabled:opacity-50">{copy('Làm mới', 'Refresh')}</button>
          <button type="button" disabled={loading || pending || !destination || !activeSession || !confirmed} onClick={() => void transfer()} className="rounded-lg bg-primary text-primary-foreground px-4 py-3 disabled:opacity-50">
            {pending ? copy('Đang chuyển…', 'Transferring…') : copy('Xác nhận chuyển', 'Confirm transfer')}
          </button>
        </div>
      </div>
    </div>
  );
}
