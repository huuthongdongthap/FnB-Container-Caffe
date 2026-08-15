import { useTranslation } from 'react-i18next';
import { Modal } from '@/components/ui/modal';
import { Button } from '@/components/ui/button';

interface SuccessModalProps {
  open: boolean;
  onClose: () => void;
  successDetails: Record<string, string>;
}

export function SuccessModal({ open, onClose, successDetails }: SuccessModalProps) {
  const { t } = useTranslation('reservations');

  const successLabels: Record<string, string> = {
    table: t('successTable'),
    zone: t('successZone'),
    date: t('successDate'),
    time: t('successTime'),
    guests: t('successGuests'),
  };

  return (
    <Modal open={open} onClose={onClose} title={t('successTitle')}>
      <div className="text-center mb-4">
        <div className="w-16 h-16 mx-auto mb-2 bg-green-100 rounded-full flex items-center justify-center">
          <svg className="w-8 h-8 text-green-600" viewBox="0 0 24 24" fill="none">
            <polyline points="4 12 10 18 20 6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </div>
      </div>
      <div className="space-y-2 text-sm">
        {Object.entries(successDetails).map(([key, value]) => (
          <div key={key} className="flex justify-between">
            <span className="text-[color:var(--aura-chrome-bright)]">{successLabels[key] || key}:</span>
            <span className="font-medium">{value}</span>
          </div>
        ))}
      </div>
      <div className="mt-6">
        <Button className="w-full" onClick={onClose}>
          {t('goHome')}
        </Button>
      </div>
    </Modal>
  );
}
