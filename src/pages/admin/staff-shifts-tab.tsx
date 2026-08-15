import { useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardBody, CardHeader } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { useAdminStaffStore } from '@/hooks/stores/admin/use-admin-staff-store';
import { useAdminShiftsStore, type ShiftRecord } from '@/hooks/stores/admin/use-admin-shifts-store';
import { formatTime, formatDate, formatHours } from './staff-utils';

function ActiveStaffRow({
  staff,
  todayShifts,
  t,
}: {
  staff: { id: string; name: string }[];
  todayShifts: ShiftRecord[];
  t: (key: string) => string;
}) {
  const activeShifts = todayShifts.filter((s) => !s.clock_out);

  if (staff.length === 0) return null;

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
            {activeShifts.map((s) => (
              <div key={s.id} className="flex items-center justify-between p-3 rounded-lg bg-surface border border-border">
                <div>
                  <p className="font-medium">{staff.find((m) => m.id === s.staff_id)?.name || s.staff_id}</p>
                  <p className="text-xs text-muted">{t('adminStaff.clockedIn')} {formatTime(s.clock_in)}</p>
                </div>
                <Badge color="success">{t('adminStaff.active')}</Badge>
              </div>
            ))}
          </div>
        )}
      </CardBody>
    </Card>
  );
}

export function ShiftsTab() {
  const { t } = useTranslation();
  const { staff, fetchStaff } = useAdminStaffStore();
  const { todayShifts, historyShifts, loading, error, fetchToday, fetchHistory } = useAdminShiftsStore();

  useEffect(() => {
    fetchStaff();
    fetchToday();
    fetchHistory();
  }, [fetchStaff, fetchToday, fetchHistory]);

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
    return acc;
  }, 0);

  return (
    <>
      <ActiveStaffRow staff={staff} todayShifts={todayShifts} t={t} />

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
                    <p className="font-medium">{staff.find((m) => m.id === s.staff_id)?.name || s.staff_id}</p>
                    <p className="text-xs text-muted">
                      {formatDate(s.date)} | {formatTime(s.clock_in)} {s.clock_out ? `- ${formatTime(s.clock_out)}` : `(${t('adminStaff.active')})`}
                    </p>
                  </div>
                  <Badge>{s.hours_worked ? formatHours(s.hours_worked) : '--'}</Badge>
                </div>
              ))}
            </div>
          )}
        </CardBody>
      </Card>
    </>
  );
}
