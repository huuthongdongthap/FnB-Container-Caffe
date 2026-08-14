import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Modal } from '@/components/ui/modal';

interface CancelSubModalProps {
  open: boolean;
  reason: string;
  errors: Record<string, string>;
  onReasonChange: (value: string) => void;
  onConfirm: () => void;
  onClose: () => void;
  loading: boolean;
  t: (key: string, options?: Record<string, unknown>) => string;
}

export function CancelSubModal({
  open,
  reason,
  errors,
  onReasonChange,
  onConfirm,
  onClose,
  loading,
  t,
}: CancelSubModalProps) {
  return (
    <Modal open={open} onClose={onClose} title={t('cancelSubTitle')}>
      <div className="space-y-4">
        <p className="text-sm text-muted">{t('cancelSubMsg')}</p>
        <Input
          label={t('fieldCancelReason')}
          placeholder={t('fieldCancelReasonPlaceholder')}
          value={reason}
          onChange={(e) => onReasonChange(e.target.value)}
        />
        {errors._form && (
          <div className="rounded-lg bg-red-500/10 p-3 text-sm text-red-800">{errors._form}</div>
        )}
        <div className="flex justify-end gap-3">
          <Button variant="secondary" onClick={onClose}>{t('cancel')}</Button>
          <Button
            variant="destructive"
            onClick={onConfirm}
            loading={loading}
            disabled={loading}
          >
            {t('confirmCancel')}
          </Button>
        </div>
      </div>
    </Modal>
  );
}
