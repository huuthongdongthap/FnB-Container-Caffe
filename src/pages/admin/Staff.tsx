import { useSubmissionSession } from '@/lib/server-confirmed-submission';
import { useAuthStore } from '@/hooks/stores/use-auth-store';
import { useEffect, useState } from 'react';
import { apiFetch } from '@/lib/api-client';
import { useTranslation } from 'react-i18next';
import { HelmetHead } from '@/components/seo/HelmetHead';
import { StaffListTab } from './staff-list-tab';
import { ShiftsTab } from './staff-shifts-tab';
import { RecruitmentTab } from './staff-recruitment-tab';

export type { StaffTab, RecruitmentApplication } from './staff-types';
export { StaffListTab } from './staff-list-tab';
export { ShiftsTab } from './staff-shifts-tab';
export { RecruitmentTab } from './staff-recruitment-tab';
export { formatTime, formatDate, formatHours } from './staff-utils';

import type { StaffTab } from './staff-types';

export default function StaffPage() {
  const session = useSubmissionSession();
  return <StaffSession key={session} />;
}

function StaffSession() {
  const canRecruit = useAuthStore(state => ['owner', 'manager'].includes(state.user?.role || ''));
  const { t } = useTranslation();
  const [tab, setTab] = useState<StaffTab>('list');
  const userId = useAuthStore(state => state.user?.id);
  const userRole = useAuthStore(state => state.user?.role);
  const [attendanceAvailable, setAttendanceAvailable] = useState(false);
  const [attendanceMessage, setAttendanceMessage] = useState('');

  useEffect(() => {
    let cancelled = false;
    setAttendanceAvailable(false);
    setAttendanceMessage('');
    setTab('list');
    if (!userId) return;
    // Operational staff cannot read management profiles; use their self-scoped shifts route.
    const canReadProfile = ['owner', 'manager', 'supervisor', 'admin'].includes(userRole || '');
    const path = canReadProfile ? `/api/staff/${encodeURIComponent(userId)}` : '/api/staff/shifts?limit=1';
    apiFetch<unknown>(path).then(response => {
      if (cancelled) return;
      const data = response && typeof response === 'object' && 'data' in response ? response.data : null;
      const capability = data && typeof data === 'object' && 'shifts_availability' in data ? data.shifts_availability : null;
      const available = !canReadProfile
        ? Boolean(response && typeof response === 'object' && 'success' in response && response.success === true)
        : Boolean(capability && typeof capability === 'object' && 'available' in capability && capability.available === true);
      setAttendanceAvailable(available);
      setAttendanceMessage(available ? '' : 'Chấm công chưa khả dụng cho cửa hàng này. / Attendance is not available for this store.');
    }).catch(() => {
      if (!cancelled) setAttendanceMessage('Không thể tải quyền chấm công. Vui lòng tải lại. / Unable to load attendance access. Please reload.');
    });
    return () => { cancelled = true; };
  }, [userId, userRole]);

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
          disabled={!attendanceAvailable}
          onClick={() => setTab('shifts')}
          className={`px-4 py-2 text-sm font-medium rounded-t-lg transition-colors ${
            tab === 'shifts'
              ? 'bg-surface text-foreground border-b-2 border-primary'
              : 'text-muted hover:text-foreground'
          }`}
        >
          {t('adminStaff.shifts')}
        </button>
        {canRecruit && <button
          onClick={() => setTab('recruitment')}
          className={`px-4 py-2 text-sm font-medium rounded-t-lg transition-colors ${
            tab === 'recruitment'
              ? 'bg-surface text-foreground border-b-2 border-primary'
              : 'text-muted hover:text-foreground'
          }`}
        >
          {t('adminStaff.recruitment', 'Tuyển dụng')}
        </button>}
      </div>

      {tab === 'list' && <StaffListTab />}
      {attendanceMessage && <p role="status">{attendanceMessage}</p>}
      {tab === 'shifts' && attendanceAvailable && <ShiftsTab />}
      {canRecruit && tab === 'recruitment' && <RecruitmentTab />}
    </div>
  );
}
