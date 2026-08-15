import { Badge } from '@/components/ui/badge';
import type { PendingCheckin } from './CheckinApprove-types';

interface CheckinHistoryListProps {
  checkins: PendingCheckin[];
  t: (key: string) => string;
}

export function CheckinHistoryList({ checkins, t }: CheckinHistoryListProps) {
  if (checkins.length === 0) return null;

  return (
    <div className="mt-8">
      <h2 className="text-sm font-medium text-muted uppercase tracking-wider mb-3">
        {t('historyTitle')}
      </h2>
      <div className="space-y-2">
        {checkins.map((checkin) => (
          <div
            key={checkin.id}
            className="flex items-center justify-between p-3 rounded-lg bg-white border border-border"
          >
            <div className="flex items-center gap-3">
              <span className="text-sm">{checkin.memberName}</span>
              <span className="text-xs text-muted font-mono">{checkin.memberPhone}</span>
            </div>
            <Badge variant={checkin.status === 'approved' ? 'success' : 'destructive'}>
              {checkin.status === 'approved' ? t('approvedLabel') : t('rejectedLabel')}
            </Badge>
          </div>
        ))}
      </div>
    </div>
  );
}
