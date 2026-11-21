import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardBody, CardHeader } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { ShiftHandoverModal } from '@/components/admin/ShiftHandoverModal';
import { useAuthStore } from '@/hooks/stores/use-auth-store';
import { useAdminStaffStore } from '@/hooks/stores/admin/use-admin-staff-store';
import { useAdminShiftsStore, type ShiftRecord } from '@/hooks/stores/admin/use-admin-shifts-store';
import { formatTime, formatDate, formatHours } from './staff-utils';

const MANAGER_ROLES = new Set(['owner', 'manager', 'supervisor', 'admin']);

function vietnamBusinessDate(now = new Date()): string {
  return new Date(now.getTime() + 7 * 3_600_000).toISOString().slice(0, 10);
}

function formatVnd(amount: number): string {
  return `${Math.round(amount).toLocaleString('vi-VN')} ₫`;
}

function ActiveStaffRow({
  staff,
  todayShifts,
  t,
  onStartHandover,
}: {
  staff: { id: string; name: string }[];
  todayShifts: ShiftRecord[];
  t: (key: string) => string;
  onStartHandover: (shiftId: string) => void;
}) {
  const activeShifts = todayShifts.filter((s) => Boolean(s.clock_in) && !s.clock_out);
  const todayBizDate = vietnamBusinessDate();

  if (staff.length === 0 && activeShifts.length === 0) return null;

  return (
    <Card className="mb-6">
      <CardHeader>
        <h2 className="text-lg font-semibold">{t('adminStaff.activeNow')}</h2>
      </CardHeader>
      <CardBody>
        {activeShifts.length === 0 ? (
          <p className="text-sm text-muted">{t('adminStaff.noActive')}</p>
        ) : (
          <div className="space-y-2">
            {activeShifts.map((s) => {
              const isOvernight = Boolean(s.date && s.date < todayBizDate);
              return (
                <div
                  key={s.id}
                  className="flex flex-wrap items-center justify-between gap-3 p-3 rounded-lg bg-surface border border-border"
                >
                  <div>
                    <p className="font-medium">{staff.find((m) => m.id === s.staff_id)?.name || s.staff_name || s.staff_id}</p>
                    <p className="text-xs text-muted">
                      {t('adminStaff.clockedIn')} {formatTime(s.clock_in || '')}
                      {isOvernight ? ` (${s.date})` : ''}
                      {typeof s.opening_cash === 'number' ? ` · Float: ${formatVnd(s.opening_cash)}` : ''}
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    {isOvernight && <Badge color="warning">Ca qua đêm / Overnight</Badge>}
                    <Badge color="success">{t('adminStaff.active')}</Badge>
                    <Button
                      size="sm"
                      variant="secondary"
                      onClick={() => onStartHandover(s.id)}
                      data-testid={`end-shift-btn-${s.id}`}
                    >
                      Bàn giao &amp; Kết ca / End Shift
                    </Button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </CardBody>
    </Card>
  );
}

export function ShiftsTab() {
  const { t } = useTranslation();
  const user = useAuthStore((s) => s.user);
  const canManage = MANAGER_ROLES.has(user?.role || '');
  const { staff, fetchStaff } = useAdminStaffStore();
  const { todayShifts, historyShifts, loading, error, fetchToday, fetchHistory, clockIn } = useAdminShiftsStore();

  const [selectedStaffId, setSelectedStaffId] = useState<string>('');
  const [selectedScheduledId, setSelectedScheduledId] = useState<string>('');
  const [openingCashInput, setOpeningCashInput] = useState<string>('0');
  const [clockInNotes, setClockInNotes] = useState<string>('');
  const [formError, setFormError] = useState<string | null>(null);

  const [handoverShiftId, setHandoverShiftId] = useState<string | undefined>(undefined);
  const [handoverOpen, setHandoverOpen] = useState(false);

  useEffect(() => {
    fetchStaff();
    fetchToday();
    fetchHistory();
  }, [fetchStaff, fetchToday, fetchHistory]);

  const defaultManageStaffId =
    (user?.id && staff.some((m) => m.id === user.id) ? user.id : staff[0]?.id) || user?.id || '';
  const effectiveStaffId = canManage ? selectedStaffId || defaultManageStaffId : user?.id || '';
  const scheduledShifts = todayShifts.filter(
    (s) => !s.clock_in && !s.clock_out && (s.attendance_state === 'scheduled' || s.status === 'scheduled'),
  );
  const matchingScheduledShifts = scheduledShifts.filter(
    (s) => !effectiveStaffId || s.staff_id === effectiveStaffId,
  );

  const selectedScheduled = scheduledShifts.find((s) => s.id === selectedScheduledId);
  const presetScheduledFloat =
    typeof selectedScheduled?.opening_cash === 'number' && Number.isFinite(selectedScheduled.opening_cash)
      ? selectedScheduled.opening_cash
      : 0;
  const openingCashLocked = !canManage && Boolean(selectedScheduled) && presetScheduledFloat > 0;

  const handleClockIn = async () => {
    setFormError(null);
    const parsedOpening = Number(openingCashInput);
    if (!openingCashLocked && (!Number.isFinite(parsedOpening) || parsedOpening < 0)) {
      setFormError('Tiền đầu ca phải là số không âm. / Opening cash must be a non-negative number.');
      return;
    }
    const targetStaffId = selectedScheduled?.staff_id || effectiveStaffId;
    if (!targetStaffId) {
      setFormError('Vui lòng chọn nhân viên để mở ca. / Select a staff member to clock in.');
      return;
    }
    const staffName = staff.find((m) => m.id === targetStaffId)?.name || user?.name || targetStaffId;
    const created = await clockIn(targetStaffId, staffName, {
      openingCash: openingCashLocked ? undefined : parsedOpening,
      scheduledShiftId: selectedScheduledId || undefined,
      notes: clockInNotes.trim() || undefined,
    });
    if (created) {
      setSelectedScheduledId('');
      setClockInNotes('');
      setOpeningCashInput('0');
    }
  };

  if (loading.today || loading.history) {
    return (
      <div className="space-y-3">
        {[...Array(4)].map((_, i) => (
          <Skeleton key={i} className="h-16 w-full" />
        ))}
      </div>
    );
  }

  if (error) {
    return (
      <div className="text-center py-8">
        <p className="text-sm text-destructive mb-2">{error}</p>
        <Button variant="secondary" size="sm" onClick={() => { fetchToday(); fetchHistory(); }}>
          {t('common.retry')}
        </Button>
      </div>
    );
  }

  const totalHoursToday = todayShifts.reduce((acc: number, s: ShiftRecord) => {
    if (s.hours_worked) return acc + s.hours_worked;
    if (!s.clock_out && s.clock_in) {
      const startTime = new Date(s.clock_in).getTime();
      if (!Number.isNaN(startTime)) {
        const elapsed = Math.max(0, (Date.now() - startTime) / 3_600_000);
        return acc + Math.round(elapsed * 10) / 10;
      }
    }
    return acc;
  }, 0);

  return (
    <>
      <ActiveStaffRow
        staff={staff}
        todayShifts={todayShifts}
        t={t}
        onStartHandover={(shiftId) => {
          setHandoverShiftId(shiftId);
          setHandoverOpen(true);
        }}
      />

      <Card className="mb-6">
        <CardHeader>
          <h2 className="text-lg font-semibold">Mở ca / Clock In</h2>
        </CardHeader>
        <CardBody>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-3 items-end">
            {canManage && staff.length > 0 && (
              <div>
                <label htmlFor="shifts-tab-staff" className="block text-xs font-medium text-muted mb-1">
                  Nhân viên / Staff
                </label>
                <select
                  id="shifts-tab-staff"
                  value={effectiveStaffId}
                  onChange={(e) => {
                    setSelectedStaffId(e.target.value);
                    setSelectedScheduledId('');
                  }}
                  className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm"
                >
                  {staff.map((m) => (
                    <option key={m.id} value={m.id}>
                      {m.name}
                    </option>
                  ))}
                </select>
              </div>
            )}

            <div>
              <label htmlFor="shifts-tab-scheduled" className="block text-xs font-medium text-muted mb-1">
                Ca đã lên lịch / Scheduled Shift
              </label>
              <select
                id="shifts-tab-scheduled"
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
                <option value="">Ca ngoài lịch / Ad-hoc</option>
                {matchingScheduledShifts.map((s) => (
                  <option key={s.id} value={s.id}>
                    #{s.id} ({s.start_time || s.date})
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label htmlFor="shifts-tab-opening-cash" className="block text-xs font-medium text-muted mb-1">
                Quỹ đầu ca (VND) / Opening Cash
              </label>
              <input
                id="shifts-tab-opening-cash"
                type="number"
                min={0}
                step={1000}
                value={openingCashInput}
                disabled={openingCashLocked}
                onChange={(e) => setOpeningCashInput(e.target.value)}
                className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm disabled:opacity-60"
              />
            </div>

            <div>
              <Button
                className="w-full"
                disabled={loading.clockIn}
                onClick={() => void handleClockIn()}
                data-testid="shifts-tab-clock-in-btn"
              >
                {loading.clockIn ? 'Đang mở ca...' : 'Mở ca / Clock In'}
              </Button>
            </div>
          </div>

          <div className="mt-3">
            <input
              type="text"
              maxLength={500}
              value={clockInNotes}
              onChange={(e) => setClockInNotes(e.target.value)}
              placeholder="Ghi chú mở ca (tùy chọn) / Optional clock-in notes"
              aria-label="Clock-in notes"
              className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm"
            />
          </div>

          {formError && (
            <p className="mt-2 text-xs text-destructive" role="alert">
              {formError}
            </p>
          )}
        </CardBody>
      </Card>

      <Card className="mb-6">
        <CardHeader>
          <h2 className="text-lg font-semibold">{t('adminStaff.todaySummary')}</h2>
        </CardHeader>
        <CardBody>
          <div className="grid grid-cols-3 gap-4 text-center">
            <div>
              <p className="text-2xl font-bold">{todayShifts.length}</p>
              <p className="text-xs text-muted">{t('adminStaff.shifts')}</p>
            </div>
            <div>
              <p className="text-2xl font-bold">{formatHours(totalHoursToday)}</p>
              <p className="text-xs text-muted">{t('adminStaff.totalHours')}</p>
            </div>
            <div>
              <p className="text-2xl font-bold">{new Set(todayShifts.map((s) => s.staff_id)).size}</p>
              <p className="text-xs text-muted">{t('adminStaff.staffWorking')}</p>
            </div>
          </div>
        </CardBody>
      </Card>

      <Card>
        <CardHeader>
          <h2 className="text-lg font-semibold">{t('adminStaff.recentShifts')}</h2>
        </CardHeader>
        <CardBody>
          {historyShifts.length === 0 ? (
            <p className="text-sm text-muted">{t('adminStaff.noRecentShifts')}</p>
          ) : (
            <div className="space-y-2">
              {historyShifts.slice(0, 50).map((s) => (
                <div key={s.id} className="flex items-center justify-between p-3 rounded-lg bg-surface border border-border">
                  <div>
                    <p className="font-medium">{staff.find((m) => m.id === s.staff_id)?.name || s.staff_name || s.staff_id}</p>
                    <p className="text-xs text-muted">
                      {formatDate(s.date)} | {s.clock_in ? formatTime(s.clock_in) : '--:--'}{' '}
                      {s.clock_out ? `- ${formatTime(s.clock_out)}` : s.clock_in ? `(${t('adminStaff.active')})` : '(Scheduled)'}
                    </p>
                  </div>
                  <Badge>{s.hours_worked ? formatHours(s.hours_worked) : '--'}</Badge>
                </div>
              ))}
            </div>
          )}
        </CardBody>
      </Card>

      <ShiftHandoverModal
        isOpen={handoverOpen}
        initialShiftId={handoverShiftId}
        onClose={() => {
          setHandoverOpen(false);
          setHandoverShiftId(undefined);
        }}
        onCompleted={() => {
          void fetchToday();
          void fetchHistory();
        }}
      />
    </>
  );
}
