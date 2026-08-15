import { useTranslation } from 'react-i18next';
import { Card, CardBody } from '@/components/ui/card';
import { Package } from 'lucide-react';

export function TrackOrderEmptyCard() {
  const { t } = useTranslation('trackOrder');

  return (
    <Card>
      <CardBody>
        <div className="text-center py-8 text-[color:var(--aura-chrome-bright)]">
          <p className="mb-2 flex justify-center"><Package size={40} className="text-chrome-light/50" /></p>
          <p className="font-medium">{t('emptyTitle')}</p>
          <p className="text-sm mt-1">{t('emptyDesc')}</p>
        </div>
      </CardBody>
    </Card>
  );
}
