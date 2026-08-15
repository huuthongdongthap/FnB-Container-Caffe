import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { HelmetHead } from '@/components/seo/HelmetHead';
import { StaffListTab } from './staff-list-tab';
import { ShiftsTab } from './staff-shifts-tab';

export type { StaffTab } from './staff-types';
export { StaffListTab } from './staff-list-tab';
export { ShiftsTab } from './staff-shifts-tab';
export { formatTime, formatDate, formatHours } from './staff-utils';

import type { StaffTab } from './staff-types';

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
