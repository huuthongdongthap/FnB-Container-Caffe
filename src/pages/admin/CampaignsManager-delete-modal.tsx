import { useTranslation } from 'react-i18next';
import { Button } from '@/components/ui/button';
import { Modal } from '@/components/ui/modal';
import { TRIGGER_LABEL_KEYS } from './CampaignsManager-constants';
import type { CampaignTrigger } from '@/hooks/use-campaigns-admin';

interface DeleteModalProps {
  trigger: CampaignTrigger | null;
  onConfirm: () => void;
  onClose: () => void;
  isDeleting: boolean;
}

export function DeleteConfirmModal({
  trigger,
  onConfirm,
  onClose,
  isDeleting,
}: DeleteModalProps) {
  const { t } = useTranslation();

  return (
    <Modal
      open={trigger !== null}
      onClose={onClose}
      title={t('campaigns.deleteConfirmTitle')}
    >
      <div className="space-y-4">
        <p className="text-sm text-muted">
          {t('campaigns.deleteConfirmMsg', {
            name: trigger ? t(TRIGGER_LABEL_KEYS[trigger]) : '',
          })}
        </p>
        {isDeleting && (
          <p className="text-sm text-muted">{t('campaigns.deleting')}</p>
        )}
        <div className="flex justify-end gap-3">
          <Button variant="secondary" onClick={onClose}>
            {t('campaigns.cancel')}
          </Button>
          <Button
            variant="destructive"
            onClick={onConfirm}
            loading={isDeleting}
            disabled={isDeleting}
          >
            {t('campaigns.confirmDelete')}
          </Button>
        </div>
      </div>
    </Modal>
  );
}
