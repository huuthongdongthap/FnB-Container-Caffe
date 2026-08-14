import { useTranslation } from 'react-i18next';
import { Card, CardBody } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';

interface CheckinRowProps {
  checkin: {
    id: string;
    memberName: string;
    memberPhone: string;
    submittedAt: string;
    status: string;
  };
  isSelected: boolean;
  onClick: () => void;
}

export function CheckinRow({ checkin, isSelected, onClick }: CheckinRowProps) {
  const { t } = useTranslation();
  return (
    <Card
      className={`cursor-pointer transition-all ${isSelected ? 'ring-2 ring-blue-500' : ''}`}
      onClick={onClick}
    >
      <CardBody>
        <div className="flex items-start gap-3">
          <div className="w-12 h-12 rounded-full bg-gray-200 flex items-center justify-center text-lg shrink-0">
            &#128100;
          </div>
          <div className="flex-1 min-w-0">
            <p className="font-medium text-sm">{checkin.memberName}</p>
            <p className="text-xs text-muted font-mono">{checkin.memberPhone}</p>
            <p className="text-xs text-muted mt-1">
              {formatRelativeTime(checkin.submittedAt, t)}
            </p>
          </div>
          <Badge>{checkin.status}</Badge>
        </div>
      </CardBody>
    </Card>
  );
}

function formatRelativeTime(iso: string, t: (key: string, options?: Record<string, unknown>) => string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const minutes = Math.floor(diff / 60_000);
  if (minutes < 1) return t('adminCheckin.justNow');
  if (minutes < 60) return t('adminCheckin.minutesAgo', { count: minutes });
  const hours = Math.floor(minutes / 60);
  return t('adminCheckin.hoursAgo', { count: hours });
}
