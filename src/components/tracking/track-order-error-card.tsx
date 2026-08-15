import { useTranslation } from 'react-i18next';
import { Button } from '@/components/ui/button';
import { Card, CardBody } from '@/components/ui/card';
import { Search, TriangleAlert } from 'lucide-react';

interface TrackOrderErrorCardProps {
  error: string;
  onRetry: () => void;
}

export function TrackOrderErrorCard({ error, onRetry }: TrackOrderErrorCardProps) {
  const { t } = useTranslation('trackOrder');

  return (
    <Card className="mb-6 border-destructive">
      <CardBody>
        <div className="text-center py-4">
          <p className="mb-2 flex justify-center"><TriangleAlert size={36} className="text-destructive" /></p>
          <h3 className="font-semibold mb-1">{t('notFound')}</h3>
          <p className="text-sm text-[color:var(--aura-chrome-bright)] mb-4">{error}</p>
          <Button variant="secondary" onClick={onRetry}>
            <Search size={20} className="inline" /> {t('retry')}
          </Button>
        </div>
      </CardBody>
    </Card>
  );
}
