import { useTranslation } from 'react-i18next';
import { Badge } from '@/components/ui/badge';
import type { SyncLogEntry } from './erpnext-sync-types';
import { formatRelativeTime } from './erpnext-sync-utils';

interface SyncLogListProps {
  logs: SyncLogEntry[];
}

export function SyncLogList({ logs }: SyncLogListProps) {
  const { t } = useTranslation('erpnextSync');

  if (logs.length === 0) {
    return <p className="text-sm text-muted text-center py-4">{t('noSyncHistory')}</p>;
  }

  return (
    <div className="space-y-2">
      {logs.map((log) => (
        <div
          key={log.id}
          className="flex items-start gap-3 p-3 rounded-lg bg-muted/10 text-sm"
        >
          <Badge variant={log.status === 'success' ? 'success' : 'destructive'}>
            {log.status === 'success' ? t('badgeOk') : t('badgeErr')}
          </Badge>
          <div className="flex-1">
            <p className="font-medium text-xs">
              {log.entity} &mdash; {log.action}
            </p>
            <p className="text-xs text-muted">{log.message}</p>
          </div>
          <span className="text-xs text-muted shrink-0">
            {formatRelativeTime(t, log.timestamp)}
          </span>
        </div>
      ))}
    </div>
  );
}
