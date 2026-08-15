import { useTranslation } from 'react-i18next';
import { Button } from '@/components/ui/button';
import type { SyncLogEntry } from './erpnext-sync-types';

interface SyncEntityCardProps {
  entity: string;
  syncingEntity: string | null;
  syncLogs: SyncLogEntry[];
  onSync: (entity: string) => void;
}

export function SyncEntityCard({ entity, syncingEntity, syncLogs, onSync }: SyncEntityCardProps) {
  const { t } = useTranslation('erpnextSync');

  const lastLog = syncLogs.find((l) => l.entity === entity);
  const statusLabel = lastLog
    ? lastLog.status === 'success' ? t('lastSuccess') : t('lastError')
    : t('notSynced');

  return (
    <div className="flex items-center justify-between p-3 rounded-lg border border-border bg-white">
      <div>
        <p className="text-sm font-medium">{entity}</p>
        <p className="text-xs text-muted">{statusLabel}</p>
      </div>
      <Button
        size="sm"
        loading={syncingEntity === entity}
        disabled={syncingEntity === entity}
        onClick={() => onSync(entity)}
      >
        &#8635; {t('sync')}
      </Button>
    </div>
  );
}
