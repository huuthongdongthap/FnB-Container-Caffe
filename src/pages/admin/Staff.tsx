import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardBody, CardHeader } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Modal } from '@/components/ui/modal';
import { Skeleton } from '@/components/ui/skeleton';
import { HelmetHead } from '@/components/seo/HelmetHead';
import { useAdminStaffStore } from '@/hooks/stores/admin/use-admin-staff-store';
import { useAdminShiftsStore, type ShiftRecord } from '@/hooks/stores/admin/use-admin-shifts-store';

type StaffTab = 'list' | 'shifts';

function formatTime(iso: string): string {
  return new Date(iso).toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' });
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString('vi-VN');
}

function formatHours(hours: number | null): string {
  if (hours === null) return '--';
  return hours.toFixed(1) + 'h';
}

/* ──────────────────────── Staff List Tab ──────────────────────── */

function StaffListTab() {
  const { t } = useTranslation();
  const { staff, loading, error, fetchStaff, registerStaff } = useAdminStaffStore();
  const [showAddModal, setShowAddModal] = useState(false);
  const [newStaff, setNewStaff] = useState({ name: '', role: '', phone: '', email: '', password: '' });
  const [registerError, setRegisterError] = useState<string | null>(null);

  useEffect(() => {
    fetchStaff();
  }, [fetchStaff]);

  const handleToggleActive = (_id: string) => {
    // Placeholder for toggle active endpoint
  };

  const handleAdd = async () => {
    if (!newStaff.name || !newStaff.role) return;
    setRegisterError(null);
    try {
      await registerStaff({
        name: newStaff.name,
        role: newStaff.role,
        phone: newStaff.phone,
        email: newStaff.email,
        password: newStaff.password,
      });
      setShowAddModal(false);
      setNewStaff({ name: '', role: '', phone: '', email: '', password: '' });
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Register failed';
      setRegisterError(msg);
    }
  };

  if (loading) {
    return (
      <div className="space-y-3">
        {[...Array(3)].map((_, i) => (
          <Skeleton key={i} className="h-20 w-full" />
        ))}
      </div>
    );
  }

  if (error) {
    return (
      <div className="text-center py-8">
        <p className="text-sm text-destructive mb-2">{error}</p>
        <Button variant="secondary" size="sm" onClick={() => fetchStaff()}>
          {t('common.retry')}
        </Button>
      </div>
    );
  }

  const activeStaff = staff.filter((m) => m.isActive);
  const inactiveStaff = staff.filter((m) => !m.isActive);

  return (
    <>
      <HelmetHead title={`${t('adminStaff.title')} — AURA CAFE`} description={t('adminStaff.subtitle')} />

      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold">{t('adminStaff.title')}</h1>
          <p className="text-sm text-muted mt-1">{t('adminStaff.subtitle')}</p>
        </div>
        <Button onClick={() => setShowAddModal(true)}>{t('adminStaff.addStaff')}</Button>
      </div>

      {staff.length === 0 ? (
        <Card>
          <CardBody className="text-center py-12">
            <p className="text-sm text-muted">{t('adminStaff.emptyTitle')}</p>
            <p className="text-xs text-muted mt-1">{t('adminStaff.emptyHint')}</p>
          </CardBody>
        </Card>
      ) : (
        <div className="space-y-6">
          <div>
            <h2 className="text-sm font-medium text-muted uppercase tracking-wider mb-3">
              {t('adminStaff.title')} ({activeStaff.length})
            </h2>
            <div className="space-y-2">
              {activeStaff.map((member) => (
                <Card key={member.id}>
                  <CardBody className="flex items-center justify-between p-4">
                    <div className="flex items-center gap-3">
                      <div>
                        <p className="font-medium">{member.name}</p>
                        <p>{member.phone}</p>
                        <p>{member.email}</p>
                        <p>{new Date(member.startedAt).toLocaleDateString('vi-VN')}</p>
                      </div>
                    </div>
                    <div className="mt-3 pt-3 border-t border-border">
                      <Button
                        variant="ghost"
                        size="sm"
                        className="w-full text-xs text-muted"
                        onClick={() => handleToggleActive(member.id)}
                      >
                        {t('adminStaff.deactivate')}
                      </Button>
                    </div>
                  </CardBody>
                </Card>
              ))}
            </div>
          </div>

          {inactiveStaff.length > 0 && (
            <div>
              <h2 className="text-sm font-medium text-muted uppercase tracking-wider mb-3">
                {t('adminStaff.inactive')} ({inactiveStaff.length})
              </h2>
              <div className="space-y-2">
                {inactiveStaff.map((member) => (
                  <div
                    key={member.id}
                    className="flex items-center justify-between p-3 rounded-lg bg-white border border-border opacity-60"
                  >
                    <div className="flex items-center gap-3">
                      <span className="text-sm">{member.name}</span>
                      <Badge>{member.role}</Badge>
                    </div>
                    <Button variant="ghost" size="sm" onClick={() => handleToggleActive(member.id)}>
                      {t('adminStaff.reactivate')}
                    </Button>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      <Modal open={showAddModal} onClose={() => setShowAddModal(false)}>
        <div className="p-6 space-y-4">
          <h2 className="text-lg font-semibold">{t('adminStaff.addStaff')}</h2>
          {registerError && <div className="text-red-600 text-xs">{registerError}</div>}
          <Input
            label={t('adminStaff.fieldName')}
            value={newStaff.name}
            onChange={(e) => setNewStaff((prev) => ({ ...prev, name: e.target.value }))}
          />
          <Input
            label={t('adminStaff.fieldRole')}
            value={newStaff.role}
            onChange={(e) => setNewStaff((prev) => ({ ...prev, role: e.target.value }))}
            placeholder={t('adminStaff.fieldRolePlaceholder')}
          />
          <Input
            label={t('adminStaff.fieldPhone')}
            value={newStaff.phone}
            onChange={(e) => setNewStaff((prev) => ({ ...prev, phone: e.target.value }))}
          />
          <Input
            label={t('adminStaff.fieldEmail')}
            type="email"
            value={newStaff.email}
            onChange={(e) => setNewStaff((prev) => ({ ...prev, email: e.target.value }))}
          />
          <Input
            label={t('adminStaff.fieldPassword')}
            type="password"
            value={newStaff.password}
            onChange={(e) => setNewStaff((prev) => ({ ...prev, password: e.target.value }))}
          />
          <div className="flex gap-3 justify-end pt-2">
            <Button variant="secondary" onClick={() => setShowAddModal(false)}>
              {t('common.cancel')}
            </Button>
            <Button onClick={handleAdd}>{t('common.confirm')}</Button>
          </div>
        </div>
      </Modal>
    </>
  );
}

/* ──────────────────────── Shifts Tab ──────────────────────── */

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

function ShiftsTab() {
  const { t } = useTranslation();
  const { staff, fetchStaff } = useAdminStaffStore();
  const { shifts, loading, error, fetchShifts } = useAdminShiftsStore();

  useEffect(() => {
    fetchStaff();
    fetchShifts();
  }, [fetchStaff, fetchShifts]);

  if (loading) {
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
        <Button variant="secondary" size="sm" onClick={() => fetchShifts()}>
          {t('common.retry')}
        </Button>
      </div>
    );
  }

  const todayStr = new Date().toISOString().split('T')[0];
  const todayShifts = shifts.filter((s) => s.date === todayStr);
  const previousShifts = shifts.filter((s) => s.date !== todayStr).slice(0, 50);

  const totalHoursToday = todayShifts.reduce((acc, s) => {
    if (s.total_hours) return acc + s.total_hours;
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
          {previousShifts.length === 0 ? (
            <p className="text-sm text-muted">{t('adminStaff.noRecentShifts')}</p>
          ) : (
            <div className="space-y-2">
              {previousShifts.map((s) => (
                <div key={s.id} className="flex items-center justify-between p-3 rounded-lg bg-surface border border-border">
                  <div>
                    <p className="font-medium">{staff.find((m) => m.id === s.staff_id)?.name || s.staff_id}</p>
                    <p className="text-xs text-muted">
                      {formatDate(s.date)} | {formatTime(s.clock_in)} {s.clock_out ? `- ${formatTime(s.clock_out)}` : `(${t('adminStaff.active')})`}
                    </p>
                  </div>
                  <Badge>{s.total_hours ? formatHours(s.total_hours) : '--'}</Badge>
                </div>
              ))}
            </div>
          )}
        </CardBody>
      </Card>
    </>
  );
}

/* ──────────────────────── Main Export ──────────────────────── */

export default function StaffPage() {
  const { t } = useTranslation();
  const [tab, setTab] = useState<StaffTab>('list');

  return (
    <div className="space-y-6">
      <HelmetHead title={`${t('adminStaff.title')} — AURA CAFE`} description={t('adminStaff.subtitle')} />

      <div className="flex gap-2 border-b border-border pb-2">
        <button
          onClick={() => setTab('list')}
          className={`px-4 py-2 text-sm font-medium rounded-t-lg transition-colors ${
            tab === 'list'
              ? 'bg-surface text-foreground border-b-2 border-primary'
              : 'text-muted hover:text-foreground'
          }`}
        >
          {t('adminStaff.title')}
        </button>
        <button
          onClick={() => setTab('shifts')}
          className={`px-4 py-2 text-sm font-medium rounded-t-lg transition-colors ${
            tab === 'shifts'
              ? 'bg-surface text-foreground border-b-2 border-primary'
              : 'text-muted hover:text-foreground'
          }`}
        >
          {t('adminStaff.shifts')}
        </button>
      </div>

      {tab === 'list' ? <StaffListTab /> : <ShiftsTab />}
    </div>
  );
}
