import { Button } from '@/components/ui/button';
import { Modal } from '@/components/ui/modal';
import type { DeviceRow } from './Devices-types';

interface Props {
  open: boolean;
  onClose: () => void;
  target: DeviceRow | null;
  actionLoading: boolean;
  onConfirm: () => void;
}

export function DevicesRevokeModal({ open, onClose, target, actionLoading, onConfirm }: Props) {
  return (
    <Modal open={open} onClose={onClose} title="Hủy đăng ký thiết bị">
      <p className="text-sm">Hủy đăng ký thiết bị <strong>{target?.device_name || target?.id}</strong>?</p>
      <p className="text-xs text-muted mt-1">Nhân viên không thể đăng nhập bằng thiết bị này nữa. Mã PIN được dùng lại khi đăng ký lại.</p>
      <div className="flex gap-3 justify-end pt-4">
        <Button variant="secondary" onClick={onClose} disabled={actionLoading}>Giữ lại</Button>
        <Button variant="destructive" onClick={onConfirm} loading={actionLoading}>Hủy đăng ký</Button>
      </div>
    </Modal>
  );
}
