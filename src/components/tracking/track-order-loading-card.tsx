import { useTranslation } from 'react-i18next';
import { Card, CardBody } from '@/components/ui/card';

export function TrackOrderLoadingCard() {
  const { t } = useTranslation('trackOrder');

  return (
    <Card className="mb-6">
      <CardBody>
        <div className="flex items-center justify-center py-8">
          <div className="w-8 h-8 border-2 border-white/[0.08] border-t-transparent rounded-full animate-spin" />
          <span className="ml-3 text-sm text-[color:var(--aura-chrome-bright)]">{t('loading')}</span>
        </div>
      </CardBody>
    </Card>
  );
}
