import { useTranslation } from 'react-i18next';
import { Button } from '@/components/ui/button';
import { Modal } from '@/components/ui/modal';

interface ConfirmDeleteModalProps {
  open: boolean;
  title: string;
  message: string;
  onConfirm: () => void;
  onClose: () => void;
  loading: boolean;
}

export function ConfirmDeleteModal({
  open,
  title,
  message,
  onConfirm,
  onClose,
  loading,
}: ConfirmDeleteModalProps) {
  const { t } = useTranslation();
  return (
    <Modal open={open} onClose={onClose} title={title}>
      <div className="space-y-4">
        <p className="text-sm text-muted">{message}</p>
        <div className="flex justify-end gap-3">
          <Button variant="secondary" onClick={onClose}>{t('common.cancel')}</Button>
          <Button variant="destructive" onClick={onConfirm} loading={loading} disabled={loading}>
            {t('common.delete')}
          </Button>
        </div>
      </div>
    </Modal>
  );
}
