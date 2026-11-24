import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { X, AlertCircle, CheckCircle2, Clock, Wallet } from 'lucide-react';
import { apiFetch, ApiClientError } from '@/lib/api-client';
import { useAuthStore } from '@/hooks/stores/use-auth-store';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import type {
  CashDenominationEntry,
  ShiftRecord,
  ShiftReconciliationRecord,
  SingleShiftResponse,
  TodayResponse,
} from '@/hooks/stores/admin/admin-shifts-store-types';

import { deriveShiftSlotLabel, formatTime } from '@/pages/admin/staff-utils';

const VND_DENOMINATIONS = [500_000, 200_000, 100_000, 50_000, 20_000, 10_000, 5_000, 2_000, 1_000] as const;
const MANAGER_ROLES = new Set(['owner', 'manager', 'supervisor', 'admin']);
const CASH_DRAWER_ROLES = new Set(['owner', 'admin', 'manager', 'supervisor', 'cashier', 'waiter', 'shipper']);

interface ReconciliationResponse {
  success: boolean;
  data: ShiftReconciliationRecord;
}

export interface ShiftHandoverModalProps {
  isOpen: boolean;
  onClose: () => void;
  initialShiftId?: string;
  mode?: 'open' | 'close' | 'auto';
  onCompleted?: () => void;
}

function vietnamBusinessDate(now = new Date()): string {
  return new Date(now.getTime() + 7 * 3_600_000).toISOString().slice(0, 10);
}

function formatVnd(amount: number): string {
  return `${Math.round(amount).toLocaleString('vi-VN')} ₫`;
}

function formatClockTime(iso: string | null): string {
  if (!iso) return '--:--';
  return formatTime(iso);
}

function getErrorInfo(err: unknown, fallback: string): { status: number; code?: string; message: string } {
  if (err instanceof ApiClientError) {
    return { status: err.status, code: err.code, message: err.message || fallback };
  }
  if (err instanceof Error) {
    return { status: 0, message: err.message || fallback };
  }
  return { status: 0, message: fallback };
}

function makeEmptyCounts(): Record<number, number> {
  const counts: Record<number, number> = {};
  for (const denom of VND_DENOMINATIONS) {
    counts[denom] = 0;
  }
  return counts;
}

export function ShiftHandoverModal({
  isOpen,
  onClose,
  initialShiftId,
  mode = 'auto',
  onCompleted,
}: ShiftHandoverModalProps) {
  const user = useAuthStore((s) => s.user);
  const canManage = MANAGER_ROLES.has(user?.role || '');

  const [loading, setLoading] = useState(false);
  const [loadingReconciliation, setLoadingReconciliation] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [loadError, setLoadError] = useState<{ status: number; message: string } | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);

  const [todayShifts, setTodayShifts] = useState<ShiftRecord[]>([]);
  const [selectedShiftId, setSelectedShiftId] = useState<string>('');
  const [selectedScheduledId, setSelectedScheduledId] = useState<string>('');
  const [openingCashInput, setOpeningCashInput] = useState<string>('0');
  const [clockInNotes, setClockInNotes] = useState<string>('');

  const [counts, setCounts] = useState<Record<number, number>>(makeEmptyCounts);
  const [handoverNotes, setHandoverNotes] = useState<string>('');
  const [remittedCashInput, setRemittedCashInput] = useState<string>('0');

  const [reconciliation, setReconciliation] = useState<ShiftReconciliationRecord | null>(null);
  const [reconciliationDisabled, setReconciliationDisabled] = useState(false);
  const [openedShift, setOpenedShift] = useState<ShiftRecord | null>(null);
  const [completedShift, setCompletedShift] = useState<ShiftRecord | null>(null);
  const [confirmZeroCash, setConfirmZeroCash] = useState(false);
  const [payouts, setPayouts] = useState<Array<{ id: string; amount: number; reason: string | null; created_at: string }>>([]);
  const [payoutAmount, setPayoutAmount] = useState('');
  const [payoutReason, setPayoutReason] = useState('');
  const [payoutSubmitting, setPayoutSubmitting] = useState(false);

  const submittingRef = useRef(false);

  const scopedShifts = useMemo(() => {
    if (canManage || !user?.id) return todayShifts;
    return todayShifts.filter((s) => s.staff_id === user.id);
  }, [todayShifts, canManage, user?.id]);

  const activeShifts = useMemo(
    () => scopedShifts.filter((s) => Boolean(s.clock_in) && !s.clock_out),
    [scopedShifts],
  );

  const scheduledShifts = useMemo(
    () =>
      scopedShifts.filter(
        (s) => !s.clock_in && !s.clock_out && (s.attendance_state === 'scheduled' || s.status === 'scheduled'),
      ),
    [scopedShifts],
  );

  const selectedShift = useMemo(
    () => activeShifts.find((s) => s.id === selectedShiftId) ?? activeShifts[0] ?? null,
    [activeShifts, selectedShiftId],
  );

  const isOvernightShift = useMemo(() => {
    if (!selectedShift?.date) return false;
    return selectedShift.date < vietnamBusinessDate();
  }, [selectedShift?.date]);

  const countedTotal = useMemo(
    () => VND_DENOMINATIONS.reduce((sum, denom) => sum + denom * (counts[denom] || 0), 0),
    [counts],
  );

  const activeReconRequestRef = useRef(0);
  const requiresCashForShift = useCallback(
    (shift: ShiftRecord | null | undefined): boolean => {
      if (!shift) return CASH_DRAWER_ROLES.has(String(user?.role || '').toLowerCase());
      const shiftRole = String(shift.role || '').toLowerCase();
      if (CASH_DRAWER_ROLES.has(shiftRole)) return true;
      if (typeof shift.opening_cash === 'number' && shift.opening_cash > 0) return true;
      return false;
    },
    [user?.role],
  );
  const isCashDrawerRole = requiresCashForShift(selectedShift);

  const fetchShiftPayouts = useCallback(async (shiftId: string, requestId: number) => {
    try {
      const res = await apiFetch<{ success: boolean; data?: Array<{ id: string; amount: number; reason: string | null; created_at: string }> }>(
        `/api/shifts/${encodeURIComponent(shiftId)}/payouts`,
        { silent: true },
      );
      if (activeReconRequestRef.current !== requestId) return;
      setPayouts(Array.isArray(res?.data) ? res.data : []);
    } catch {
      if (activeReconRequestRef.current !== requestId) return;
      setPayouts([]);
    }
  }, []);

  const fetchExistingReconciliation = useCallback(async (shiftId: string, targetShift?: ShiftRecord | null) => {
    const requestId = ++activeReconRequestRef.current;
    setReconciliation(null);
    setReconciliationDisabled(false);
    setConfirmZeroCash(false);
    setPayouts([]);
    if (!requiresCashForShift(targetShift)) {
      setLoadingReconciliation(false);
      return;
    }
    setLoadingReconciliation(true);
    void fetchShiftPayouts(shiftId, requestId);
    try {
      const res = await apiFetch<ReconciliationResponse>(`/api/shifts/${encodeURIComponent(shiftId)}/reconciliation`, {
        silent: true,
      });
      if (activeReconRequestRef.current !== requestId) return;
      if (res?.data) {
        setReconciliation(res.data);
      }
    } catch (err) {
      if (activeReconRequestRef.current !== requestId) return;
      const info = getErrorInfo(err, '');
      if (info.status === 404) {
        return;
      }
      if (info.status === 501 || info.code === 'PILOT_CASH_RECONCILIATION_DISABLED') {
        setReconciliationDisabled(true);
        setActionError(info.message || 'Đối soát tiền mặt chưa được bật cho cửa hàng này.');
        return;
      }
      if (info.status === 401 || info.status === 403) {
        setLoadError({ status: info.status, message: info.message || 'Không có quyền truy cập đối soát ca.' });
      }
    } finally {
      if (activeReconRequestRef.current === requestId) {
        setLoadingReconciliation(false);
      }
    }
  }, [fetchShiftPayouts, requiresCashForShift]);

  const loadShifts = useCallback(async () => {
    setLoading(true);
    setLoadError(null);
    setActionError(null);
    setCompletedShift(null);
    setReconciliation(null);
    setReconciliationDisabled(false);
    try {
      const res = await apiFetch<TodayResponse>('/api/shifts/today', { silent: true });
      const rows = Array.isArray(res?.data) ? res.data : [];
      setTodayShifts(rows);

      const visible = canManage || !user?.id ? rows : rows.filter((s) => s.staff_id === user.id);
      const visibleActive = visible.filter((s) => Boolean(s.clock_in) && !s.clock_out);
      const visibleScheduled = visible.filter(
        (s) => !s.clock_in && !s.clock_out && (s.attendance_state === 'scheduled' || s.status === 'scheduled'),
      );

      const preferred =
        mode === 'open'
          ? null
          : (initialShiftId && visibleActive.find((s) => s.id === initialShiftId)) ||
            visibleActive.find((s) => s.staff_id === user?.id) ||
            visibleActive[0] ||
            null;

      if (preferred) {
        setSelectedShiftId(preferred.id);
        await fetchExistingReconciliation(preferred.id, preferred);
      } else {
        setSelectedShiftId('');
        const ownScheduled = visibleScheduled.find((s) => s.staff_id === user?.id) ?? visibleScheduled[0];
        setSelectedScheduledId(ownScheduled?.id ?? '');
        setOpeningCashInput(
          typeof ownScheduled?.opening_cash === 'number' && Number.isFinite(ownScheduled.opening_cash)
            ? String(ownScheduled.opening_cash)
            : '0',
        );
      }
    } catch (err) {
      const info = getErrorInfo(err, 'Không thể tải thông tin ca làm việc.');
      setLoadError({ status: info.status, message: info.message });
    } finally {
      setLoading(false);
    }
  }, [canManage, fetchExistingReconciliation, initialShiftId, mode, user?.id]);

  useEffect(() => {
    if (!isOpen) return;
    setCounts(makeEmptyCounts());
    setHandoverNotes('');
    setRemittedCashInput('0');
    setOpeningCashInput('0');
    setClockInNotes('');
    setOpenedShift(null);
    setCompletedShift(null);
    void loadShifts();
  }, [isOpen, loadShifts]);

  if (!isOpen) return null;

  const handleSelectActiveShift = async (shiftId: string) => {
    const nextShift = activeShifts.find((s) => s.id === shiftId) ?? null;
    setSelectedShiftId(shiftId);
    setCounts(makeEmptyCounts());
    setHandoverNotes('');
    setRemittedCashInput('0');
    setPayoutAmount('');
    setPayoutReason('');
    setConfirmZeroCash(false);
    setActionError(null);
    setCompletedShift(null);
    await fetchExistingReconciliation(shiftId, nextShift);
  };

  const handleClockIn = async () => {
    if (submittingRef.current || !user?.id) return;
    const parsedOpening = Number(openingCashInput);
    if (!Number.isFinite(parsedOpening) || parsedOpening < 0) {
      setActionError('Tiền đầu ca phải là số không âm. / Opening cash must be a non-negative number.');
      return;
    }

    const scheduledTarget = scheduledShifts.find((s) => s.id === selectedScheduledId);
    const targetStaffId = scheduledTarget?.staff_id || user.id;
    const presetOpeningCash =
      typeof scheduledTarget?.opening_cash === 'number' && Number.isFinite(scheduledTarget.opening_cash)
        ? scheduledTarget.opening_cash
        : 0;
    const lockPresetOpeningCash = !canManage && Boolean(scheduledTarget) && presetOpeningCash > 0;

    submittingRef.current = true;
    setSubmitting(true);
    setActionError(null);
    try {
      const payload: Record<string, unknown> = {
        staff_id: targetStaffId,
      };
      if (!lockPresetOpeningCash) {
        payload.opening_cash = parsedOpening;
      }
      if (selectedScheduledId) payload.scheduled_shift_id = selectedScheduledId;
      if (clockInNotes.trim()) payload.notes = clockInNotes.trim();

      const res = await apiFetch<SingleShiftResponse>('/api/shifts/clock-in', {
        method: 'POST',
        body: JSON.stringify(payload),
      });
      if (res?.data) {
        setOpenedShift(res.data);
        onCompleted?.();
      }
    } catch (err) {
      const info = getErrorInfo(err, 'Không thể mở ca. Vui lòng thử lại.');
      setActionError(info.message);
    } finally {
      submittingRef.current = false;
      setSubmitting(false);
    }
  };

  const performClockOut = async (shift: ShiftRecord): Promise<boolean> => {
    const payload: Record<string, unknown> = { staff_id: shift.staff_id, shift_id: shift.id };
    if (handoverNotes.trim()) payload.notes = handoverNotes.trim();

    const clockOutRes = await apiFetch<SingleShiftResponse>('/api/shifts/clock-out', {
      method: 'POST',
      body: JSON.stringify(payload),
    });
    if (clockOutRes?.data) {
      setCompletedShift(clockOutRes.data);
      onCompleted?.();
      return true;
    }
    return false;
  };

  const handleClockOutOnly = async () => {
    if (submittingRef.current || !selectedShift || completedShift) return;
    submittingRef.current = true;
    setSubmitting(true);
    setActionError(null);
    try {
      await performClockOut(selectedShift);
    } catch (err) {
      const info = getErrorInfo(err, 'Kết ca thất bại. Vui lòng thử lại.');
      setActionError(info.message);
    } finally {
      submittingRef.current = false;
      setSubmitting(false);
    }
  };

  const handleAddPayout = async () => {
    if (!selectedShift || payoutSubmitting || reconciliation) return;
    const amount = Number(payoutAmount);
    const reason = payoutReason.trim();
    if (!Number.isFinite(amount) || amount <= 0) {
      setActionError('Số tiền chi phải lớn hơn 0.');
      return;
    }
    if (!reason) {
      setActionError('Vui lòng nhập lý do chi tiền mặt.');
      return;
    }
    setPayoutSubmitting(true);
    setActionError(null);
    try {
      await apiFetch(`/api/shifts/${encodeURIComponent(selectedShift.id)}/payouts`, {
        method: 'POST',
        body: JSON.stringify({ amount, reason }),
      });
      setPayoutAmount('');
      setPayoutReason('');
      await fetchShiftPayouts(selectedShift.id, activeReconRequestRef.current);
    } catch (err) {
      const info = getErrorInfo(err, 'Không thể ghi phiếu chi tiền mặt.');
      setActionError(info.message);
    } finally {
      setPayoutSubmitting(false);
    }
  };

  const handleReconcileAndClockOut = async (bypassZeroConfirm = false) => {
    if (submittingRef.current || loadingReconciliation || !selectedShift || completedShift || reconciliationDisabled) return;
    const matchedRecon =
      reconciliation && String(reconciliation.shift_id) === String(selectedShift.id) ? reconciliation : null;
    if (!matchedRecon && countedTotal === 0 && !bypassZeroConfirm && !confirmZeroCash) {
      setConfirmZeroCash(true);
      return;
    }
    setConfirmZeroCash(false);

    submittingRef.current = true;
    setSubmitting(true);
    setActionError(null);

    try {
      let activeRecon = matchedRecon;

      if (!activeRecon) {
        const denominations: CashDenominationEntry[] = VND_DENOMINATIONS.filter(
          (denom) => (counts[denom] || 0) > 0,
        ).map((denom) => ({
          denomination: denom,
          count: counts[denom] || 0,
        }));
        let remittedCash = 0;
        if (remittedCashInput.trim() !== '') {
          const parsedRemitted = Number(remittedCashInput);
          if (!Number.isFinite(parsedRemitted) || parsedRemitted < 0 || parsedRemitted > countedTotal) {
            setActionError(
              `Tiền nộp chủ phải nằm trong khoảng 0 đến ${countedTotal.toLocaleString('vi-VN')} ₫. / Remitted cash must be between 0 and ${countedTotal.toLocaleString('vi-VN')} ₫.`,
            );
            return;
          }
          remittedCash = parsedRemitted;
        }
        const closingFloat = countedTotal - remittedCash;

        try {
          const reconRes = await apiFetch<ReconciliationResponse>(
            `/api/shifts/${encodeURIComponent(selectedShift.id)}/reconcile`,
            {
              method: 'POST',
              body: JSON.stringify({
                opening_float: selectedShift.opening_cash ?? 0,
                denominations: { denominations },
                remitted_cash: remittedCash,
                closing_float: closingFloat,
                ...(handoverNotes.trim() ? { notes: handoverNotes.trim() } : {}),
              }),
            },
          );
          activeRecon = reconRes.data;
          setReconciliation(activeRecon);
        } catch (err) {
          const info = getErrorInfo(err, 'Đối soát tiền mặt thất bại. Ca làm việc chưa được đóng.');
          if (info.status === 501 || info.code === 'PILOT_CASH_RECONCILIATION_DISABLED') {
            setReconciliationDisabled(true);
          }
          if (info.status === 409 && info.message.toLowerCase().includes('already been reconciled')) {
            await fetchExistingReconciliation(selectedShift.id, selectedShift);
            setActionError(
              'Ca này đã được đối soát trước đó. Kiểm tra số liệu và bấm Hoàn tất kết ca. / Shift was already reconciled; review totals and click Complete Clock-Out.',
            );
            return;
          }
          setActionError(info.message);
          return;
        }
      }

      try {
        await performClockOut(selectedShift);
      } catch (err) {
        const info = getErrorInfo(err, 'Đã đối soát tiền mặt nhưng kết ca thất bại. Hãy bấm Thử lại kết ca.');
        setActionError(info.message);
      }
    } finally {
      submittingRef.current = false;
      setSubmitting(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-[110] flex items-center justify-center bg-black/60 p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="shift-handover-title"
      data-testid="shift-handover-modal"
    >
      <div className="w-full max-w-lg max-h-[90vh] overflow-y-auto rounded-xl bg-surface text-foreground border border-border shadow-2xl">
        <div className="flex items-center justify-between px-5 py-4 border-b border-border">
          <div className="flex items-center gap-2">
            <Wallet className="w-5 h-5 text-primary" />
            <h2 id="shift-handover-title" className="text-base font-semibold">
              {mode === 'open' || openedShift || (!selectedShift && !completedShift)
                ? 'Mở ca làm việc / Open Shift'
                : 'Bàn giao & Kết ca / Shift Handover'}
            </h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close shift handover modal"
            className="p-1.5 rounded-lg text-muted hover:text-foreground hover:bg-surface-hover"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-5 space-y-4">
          {loading ? (
            <p className="text-sm text-muted py-6 text-center" data-testid="handover-loading">
              Đang tải thông tin ca làm việc... / Loading shift state...
            </p>
          ) : loadError ? (
            <div className="rounded-lg border border-destructive/40 bg-destructive/10 p-4 space-y-3" role="alert">
              <div className="flex items-start gap-2 text-destructive">
                <AlertCircle className="w-5 h-5 shrink-0 mt-0.5" />
                <p className="text-sm font-medium">{loadError.message}</p>
              </div>
              <div className="flex justify-end gap-2">
                <Button variant="secondary" size="sm" onClick={() => void loadShifts()}>
                  Thử lại / Retry
                </Button>
                <Button variant="secondary" size="sm" onClick={onClose}>
                  Đóng / Close
                </Button>
              </div>
            </div>
          ) : openedShift ? (
            <div className="space-y-4" data-testid="handover-opened">
              <div className="rounded-lg border border-emerald-500/40 bg-emerald-500/10 p-4 flex items-start gap-3">
                <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0 mt-0.5" />
                <div className="space-y-1 text-sm">
                  <p className="font-semibold text-emerald-700">
                    Đã mở ca thành công / Shift Opened
                  </p>
                  <p className="text-muted">
                    {deriveShiftSlotLabel(openedShift.clock_in, openedShift.shift)} — {openedShift.staff_name || openedShift.staff_id} (ID #{openedShift.id})
                  </p>
                  <p className="text-muted">
                    Vào ca / Clock-in: {formatClockTime(openedShift.clock_in)} &bull; Quỹ đầu ca: {formatVnd(openedShift.opening_cash ?? 0)}
                  </p>
                </div>
              </div>
              <div className="flex justify-end">
                <Button onClick={onClose}>Bắt đầu bán hàng / Đóng</Button>
              </div>
            </div>
          ) : completedShift ? (
            <div className="space-y-4" data-testid="handover-completed">
              <div className="rounded-lg border border-emerald-500/40 bg-emerald-500/10 p-4 flex items-start gap-3">
                <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0 mt-0.5" />
                <div className="space-y-1 text-sm">
                  <p className="font-semibold text-emerald-700">
                    Đã bàn giao &amp; kết ca thành công / Shift Handover Completed
                  </p>
                  <p className="text-muted">
                    {deriveShiftSlotLabel(completedShift.clock_in, completedShift.shift)} — {completedShift.staff_name || completedShift.staff_id} (ID #{completedShift.id})
                  </p>
                  {completedShift.hours_worked !== null && (
                    <p className="text-muted">Số giờ làm việc / Hours worked: {completedShift.hours_worked}h</p>
                  )}
                </div>
              </div>

              {reconciliation && (
                <div className="grid grid-cols-3 gap-3 text-sm rounded-lg border border-border p-3 bg-background/50">
                  <div>
                    <p className="text-xs text-muted">Kỳ vọng / Expected</p>
                    <p className="font-semibold">{formatVnd(reconciliation.expected_cash)}</p>
                  </div>
                  <div>
                    <p className="text-xs text-muted">Thực đếm / Actual</p>
                    <p className="font-semibold">{formatVnd(reconciliation.actual_cash)}</p>
                  </div>
                  <div>
                    <p className="text-xs text-muted">Chênh lệch / Variance</p>
                    <p className="font-semibold">
                      {formatVnd(reconciliation.variance)} ({reconciliation.variance_status})
                    </p>
                  </div>
                </div>
              )}

              <div className="flex justify-end">
                <Button onClick={onClose}>Hoàn tất / Done</Button>
              </div>
            </div>
          ) : !selectedShift ? (
            <div className="space-y-4" data-testid="handover-no-active-shift">
              <div className="rounded-lg border border-border bg-background/50 p-4 space-y-1">
                <p className="text-sm font-semibold">Chưa có ca đang mở / No Active Shift</p>
                <p className="text-xs text-muted">
                  Bạn cần mở ca với tiền quỹ đầu ca trước khi có thể bàn giao và kết ca.
                </p>
              </div>

              {actionError && (
                <div className="rounded-lg border border-destructive/40 bg-destructive/10 p-3 text-sm text-destructive" role="alert">
                  {actionError}
                </div>
              )}

              {scheduledShifts.length > 0 && (
                <div className="space-y-1.5">
                  <label htmlFor="handover-scheduled-shift" className="block text-xs font-medium text-muted">
                    Ca đã lên lịch hôm nay / Scheduled Shift (optional)
                  </label>
                  <select
                    id="handover-scheduled-shift"
                    value={selectedScheduledId}
                    onChange={(e) => {
                      const nextId = e.target.value;
                      setSelectedScheduledId(nextId);
                      const nextScheduled = scheduledShifts.find((s) => s.id === nextId);
                      setOpeningCashInput(
                        typeof nextScheduled?.opening_cash === 'number' && Number.isFinite(nextScheduled.opening_cash)
                          ? String(nextScheduled.opening_cash)
                          : '0',
                      );
                    }}
                    className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm"
                  >
                    <option value="">Mở ca ngoài lịch / Ad-hoc shift</option>
                    {scheduledShifts.map((s) => (
                      <option key={s.id} value={s.id}>
                        #{s.id} — {s.staff_name || s.staff_id} ({s.start_time || s.date})
                      </option>
                    ))}
                  </select>
                </div>
              )}

              {(() => {
                const selectedScheduled = scheduledShifts.find((s) => s.id === selectedScheduledId);
                const presetFloat =
                  typeof selectedScheduled?.opening_cash === 'number' && Number.isFinite(selectedScheduled.opening_cash)
                    ? selectedScheduled.opening_cash
                    : 0;
                const openingCashLocked = !canManage && Boolean(selectedScheduled) && presetFloat > 0;
                return (
                  <div className="space-y-1.5">
                    <label htmlFor="handover-opening-cash" className="block text-xs font-medium text-muted">
                      Tiền đầu ca (VND) / Opening Cash Float
                    </label>
                    <input
                      id="handover-opening-cash"
                      type="number"
                      min={0}
                      step={1000}
                      value={openingCashInput}
                      disabled={openingCashLocked}
                      onChange={(e) => setOpeningCashInput(e.target.value)}
                      className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm disabled:opacity-60"
                    />
                  </div>
                );
              })()}

              <div className="space-y-1.5">
                <label htmlFor="handover-clockin-notes" className="block text-xs font-medium text-muted">
                  Ghi chú mở ca / Clock-in Notes (optional)
                </label>
                <input
                  id="handover-clockin-notes"
                  type="text"
                  maxLength={500}
                  value={clockInNotes}
                  onChange={(e) => setClockInNotes(e.target.value)}
                  placeholder="VD: Nhận bàn giao quỹ sáng"
                  className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm"
                />
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <Button variant="secondary" onClick={onClose}>
                  Hủy / Cancel
                </Button>
                <Button disabled={submitting || !user?.id} onClick={() => void handleClockIn()}>
                  {submitting ? 'Đang mở ca...' : 'Mở ca / Clock In'}
                </Button>
              </div>
            </div>
          ) : (
            <div className="space-y-4">
              {canManage && activeShifts.length > 1 && (
                <div className="space-y-1.5">
                  <label htmlFor="handover-shift-select" className="block text-xs font-medium text-muted">
                    Chọn ca đang mở / Select Active Shift
                  </label>
                  <select
                    id="handover-shift-select"
                    value={selectedShift.id}
                    onChange={(e) => void handleSelectActiveShift(e.target.value)}
                    className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm"
                  >
                    {activeShifts.map((s) => (
                      <option key={s.id} value={s.id}>
                        #{s.id} — {s.staff_name || s.staff_id} ({s.date})
                      </option>
                    ))}
                  </select>
                </div>
              )}

              <div className="rounded-lg border border-border bg-background/50 p-3 space-y-2 text-sm">
                <div className="flex items-center justify-between gap-2">
                  <div className="font-semibold">
                    {deriveShiftSlotLabel(selectedShift.clock_in, selectedShift.shift)} — {selectedShift.staff_name || selectedShift.staff_id} (ID #{selectedShift.id})
                  </div>
                  <div className="flex items-center gap-1.5">
                    {isOvernightShift && (
                      <Badge color="warning" data-testid="overnight-shift-badge">
                        Ca qua đêm / Overnight ({selectedShift.date})
                      </Badge>
                    )}
                    <Badge color="success">Đang mở / Active</Badge>
                  </div>
                </div>
                <div className="flex flex-wrap items-center gap-4 text-xs text-muted">
                  <span className="inline-flex items-center gap-1">
                    <Clock className="w-3.5 h-3.5" />
                    Vào ca / Clock-in: {formatClockTime(selectedShift.clock_in)} ({selectedShift.date})
                  </span>
                  <span>
                    Quỹ đầu ca / Opening Float: <strong>{formatVnd(selectedShift.opening_cash ?? 0)}</strong>
                  </span>
                </div>
              </div>

              {actionError && (
                <div className="rounded-lg border border-destructive/40 bg-destructive/10 p-3 text-sm text-destructive flex items-start gap-2" role="alert">
                  <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                  <span>{actionError}</span>
                </div>
              )}

              {!isCashDrawerRole ? (
                <div
                  className="rounded-lg border border-border bg-background/50 p-3 text-xs text-muted"
                  data-testid="non-cash-handover-notice"
                >
                  Vai trò hiện tại không giữ quỹ tiền mặt — bạn có thể chốt ca trực tiếp. / Non-cash role: clock out directly without cash drawer reconciliation.
                </div>
              ) : reconciliation ? (
                <div className="rounded-lg border border-emerald-500/40 bg-emerald-500/10 p-3 space-y-2" data-testid="reconciliation-recorded">
                  <p className="text-xs font-semibold text-emerald-700">
                    Tiền mặt đã được đối soát / Cash Reconciled (ID: {reconciliation.id})
                  </p>
                  <div className="grid grid-cols-3 gap-2 text-xs">
                    <div>
                      <span className="text-muted block">Kỳ vọng / Expected</span>
                      <strong>{formatVnd(reconciliation.expected_cash)}</strong>
                    </div>
                    <div>
                      <span className="text-muted block">Thực đếm / Actual</span>
                      <strong>{formatVnd(reconciliation.actual_cash)}</strong>
                    </div>
                    <div>
                      <span className="text-muted block">Chênh lệch / Variance</span>
                      <strong>{formatVnd(reconciliation.variance)}</strong>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <p className="text-xs font-medium text-muted">Kiểm đếm mệnh giá / Cash Denomination Count</p>
                    <p className="text-sm font-semibold" data-testid="counted-cash-total">
                      Tổng đếm / Counted: {formatVnd(countedTotal)}
                    </p>
                  </div>
                  <div className="grid grid-cols-3 gap-2">
                    {VND_DENOMINATIONS.map((denom) => (
                      <label
                        key={denom}
                        className="flex flex-col gap-1 rounded-lg border border-border bg-background px-2.5 py-2 text-xs"
                      >
                        <span className="text-muted font-medium">{denom.toLocaleString('vi-VN')} ₫</span>
                        <input
                          type="number"
                          min={0}
                          inputMode="numeric"
                          aria-label={`Denomination ${denom}`}
                          value={counts[denom] || 0}
                          onChange={(e) => {
                            const val = Math.max(0, Math.floor(Number(e.target.value) || 0));
                            setCounts((prev) => ({ ...prev, [denom]: val }));
                          }}
                          disabled={submitting || reconciliationDisabled}
                          className="w-full rounded border border-border bg-surface px-2 py-1 text-sm font-medium"
                        />
                      </label>
                    ))}
                  </div>

                  <div className="grid grid-cols-2 gap-2 pt-2">
                    <label className="flex flex-col gap-1 rounded-lg border border-border bg-background px-2.5 py-2 text-xs">
                      <span className="text-muted font-medium">Tiền nộp chủ / Remitted Cash (₫)</span>
                      <input
                        type="number"
                        min={0}
                        max={countedTotal}
                        inputMode="numeric"
                        aria-label="Tiền nộp chủ / Remitted Cash"
                        data-testid="remitted-cash-input"
                        value={remittedCashInput}
                        onChange={(e) => setRemittedCashInput(e.target.value)}
                        disabled={submitting || reconciliationDisabled}
                        className="w-full rounded border border-border bg-surface px-2 py-1 text-sm font-medium"
                      />
                    </label>
                    <div className="flex flex-col justify-between rounded-lg border border-border bg-background px-2.5 py-2 text-xs">
                      <span className="text-muted font-medium">Tiền để lại ca sau / Closing Float</span>
                      <span className="text-sm font-semibold" data-testid="closing-float-display">
                        {(() => {
                          if (remittedCashInput.trim() === '') {
                            return `${countedTotal.toLocaleString('vi-VN')} ₫`;
                          }
                          const parsed = Number(remittedCashInput);
                          if (!Number.isFinite(parsed) || parsed < 0 || parsed > countedTotal) {
                            return 'Không hợp lệ / Invalid';
                          }
                          return `${(countedTotal - parsed).toLocaleString('vi-VN')} ₫`;
                        })()}
                      </span>
                    </div>
                  </div>
                </div>
              )}

              <div className="space-y-1.5">
                <label htmlFor="handover-notes" className="block text-xs font-medium text-muted">
                  Ghi chú bàn giao / Handover Notes (optional)
                </label>
                <input
                  id="handover-notes"
                  type="text"
                  maxLength={500}
                  value={handoverNotes}
                  onChange={(e) => setHandoverNotes(e.target.value)}
                  disabled={submitting}
                  placeholder="VD: Bàn giao quỹ ca chiều"
                  className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm"
                />
              </div>

              {isCashDrawerRole && !reconciliation && !reconciliationDisabled && (
                <div className="space-y-2 rounded-lg border border-border bg-background p-3">
                  <p className="text-xs font-medium text-muted">Phiếu chi tiền mặt trong ca / Cash Payouts</p>
                  <div className="flex gap-2">
                    <input
                      type="number"
                      min={1000}
                      step={1000}
                      placeholder="Số tiền (₫)"
                      aria-label="Cash payout amount"
                      value={payoutAmount}
                      onChange={(e) => setPayoutAmount(e.target.value)}
                      disabled={payoutSubmitting || submitting}
                      className="w-32 rounded border border-border bg-surface px-2 py-1 text-xs"
                    />
                    <input
                      type="text"
                      maxLength={300}
                      placeholder="Lý do (VD: mua đá, sữa)"
                      aria-label="Cash payout reason"
                      value={payoutReason}
                      onChange={(e) => setPayoutReason(e.target.value)}
                      disabled={payoutSubmitting || submitting}
                      className="flex-1 rounded border border-border bg-surface px-2 py-1 text-xs"
                    />
                    <Button
                      variant="secondary"
                      size="sm"
                      disabled={payoutSubmitting || submitting}
                      onClick={() => void handleAddPayout()}
                      data-testid="add-payout-btn"
                    >
                      {payoutSubmitting ? '...' : 'Ghi chi'}
                    </Button>
                  </div>
                  {payouts.length > 0 && (
                    <ul className="space-y-1 text-xs text-muted" data-testid="shift-payouts-list">
                      {payouts.map((p) => (
                        <li key={p.id} className="flex justify-between">
                          <span>{p.reason || 'Chi tiền mặt'}</span>
                          <strong className="text-foreground">-{formatVnd(p.amount)}</strong>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              )}

              {confirmZeroCash && !reconciliation && !reconciliationDisabled && (
                <div
                  role="alert"
                  data-testid="zero-cash-confirm-banner"
                  className="rounded-lg border border-amber-500/40 bg-amber-500/10 p-3 text-xs space-y-2"
                >
                  <p className="font-medium text-amber-700 dark:text-amber-300">
                    Tổng tiền mặt đếm được đang là 0 ₫. Bạn có chắc chắn muốn chốt đối soát với 0 ₫ không?
                  </p>
                  <div className="flex justify-end gap-2">
                    <Button
                      variant="secondary"
                      size="sm"
                      onClick={() => setConfirmZeroCash(false)}
                      disabled={submitting}
                    >
                      Kiểm tra lại
                    </Button>
                    <Button
                      size="sm"
                      onClick={() => void handleReconcileAndClockOut(true)}
                      disabled={submitting}
                      data-testid="confirm-zero-cash-btn"
                    >
                      Xác nhận 0 ₫ &amp; Kết ca
                    </Button>
                  </div>
                </div>
              )}

              <div className="flex justify-end gap-2 pt-2">
                <Button variant="secondary" onClick={onClose} disabled={submitting}>
                  Hủy / Cancel
                </Button>
                {(!isCashDrawerRole || reconciliationDisabled) && (
                  <Button
                    disabled={submitting}
                    onClick={() => void handleClockOutOnly()}
                    data-testid="clock-out-only-btn"
                  >
                    {submitting ? 'Đang xử lý...' : 'Chốt ca không cần đối soát / Clock out only'}
                  </Button>
                )}
                {isCashDrawerRole && (
                  <Button
                    disabled={submitting || reconciliationDisabled}
                    onClick={() => void handleReconcileAndClockOut(false)}
                    data-testid="submit-handover-btn"
                  >
                    {submitting
                      ? 'Đang xử lý...'
                      : reconciliation
                        ? 'Hoàn tất kết ca / Complete Clock-Out'
                        : 'Đối soát & Kết ca / Reconcile & End Shift'}
                  </Button>
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
