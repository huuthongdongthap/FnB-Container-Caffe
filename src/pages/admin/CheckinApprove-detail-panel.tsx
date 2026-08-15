import { Button } from '@/components/ui/button';
import { Card, CardBody } from '@/components/ui/card';
import { AuraImage } from '@/components/ui/AuraImage';
import type { PendingCheckin } from './CheckinApprove-types';
import { formatRelativeTime } from './CheckinApprove-utils';

interface CheckinDetailPanelProps {
  checkin: PendingCheckin | null;
  actingId: string | null;
  onApprove: (id: string) => void;
  onReject: (id: string) => void;
  t: (key: string, params?: Record<string, string | number>) => string;
}

export function CheckinDetailPanel({
  checkin,
  actingId,
  onApprove,
  onReject,
  t,
}: CheckinDetailPanelProps) {
  if (!checkin) {
    return (
      <div className="text-center py-12 text-muted text-sm border border-dashed border-border rounded-xl">
        {t('selectPrompt')}
      </div>
    );
  }

  return (
    <Card>
      <CardBody>
        <div className="text-center mb-4">
          <div className="w-20 h-20 rounded-full bg-gray-200 flex items-center justify-center text-3xl mx-auto mb-3">
            &#128100;
          </div>
          <h3 className="font-semibold">{checkin.memberName}</h3>
          <p className="text-sm text-muted font-mono">{checkin.memberPhone}</p>
          <p className="text-xs text-muted mt-1">
            {formatRelativeTime(t, checkin.submittedAt)}
          </p>
        </div>

        {checkin.photoUrl ? (
          <div className="mb-4 rounded-lg overflow-hidden bg-gray-100 aspect-video flex items-center justify-center">
            <AuraImage src={checkin.photoUrl} alt="Check-in photo" className="w-full h-full object-cover" />
          </div>
        ) : (
          <div className="mb-4 p-8 rounded-lg bg-muted/10 border border-dashed border-border/50 text-center text-muted text-sm">
            {t('noPhoto')}
          </div>
        )}

        <div className="flex gap-3">
          <Button
            variant="destructive"
            className="flex-1"
            disabled={actingId === checkin.id}
            onClick={() => onReject(checkin.id)}
          >
            {actingId === checkin.id ? '...' : t('reject')}
          </Button>
          <Button
            className="flex-1"
            disabled={actingId === checkin.id}
            onClick={() => onApprove(checkin.id)}
          >
            {actingId === checkin.id ? '...' : t('approve')}
          </Button>
        </div>
      </CardBody>
    </Card>
  );
}
