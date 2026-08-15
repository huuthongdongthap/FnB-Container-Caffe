import { useTranslation } from 'react-i18next';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardBody } from '@/components/ui/card';

interface TrackOrderSearchCardProps {
  orderId: string;
  loading: boolean;
  onOrderIdChange: (value: string) => void;
  onSubmit: (e: React.FormEvent) => void;
}

export function TrackOrderSearchCard({
  orderId,
  loading,
  onOrderIdChange,
  onSubmit,
}: TrackOrderSearchCardProps) {
  const { t } = useTranslation('trackOrder');

  return (
    <Card className="mb-6">
      <CardBody>
        <form onSubmit={onSubmit} className="flex gap-2">
          <div className="flex-1">
            <Input
              placeholder={t('placeholder')}
              value={orderId}
              onChange={(e) => onOrderIdChange(e.target.value)}
              maxLength={20}
            />
          </div>
          <Button type="submit" disabled={!orderId.trim() || loading}>
            {loading ? t('searching') : 'search'}
          </Button>
        </form>
        <p className="text-xs text-[color:var(--aura-chrome-bright)] mt-2">
          {t('helper')}
        </p>
      </CardBody>
    </Card>
  );
}
