import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Modal } from '@/components/ui/modal';
import { ROLE_LABEL } from './Devices-constants';
import type { StaffOption } from './Devices-types';

interface Props {
  open: boolean;
  onClose: () => void;
  staffList: StaffOption[];
  actionLoading: boolean;
  registerError: string | null;
  regDeviceToken: string;
  regDeviceName: string;
  regStaffId: string;
  regRole: string;
  regPin: string;
  onDeviceTokenChange: (v: string) => void;
  onDeviceNameChange: (v: string) => void;
  onStaffIdChange: (v: string) => void;
  onRoleChange: (v: string) => void;
  onPinChange: (v: string) => void;
  onSubmit: () => void;
}

export function DevicesRegisterModal({
  open, onClose, staffList, actionLoading, registerError,
  regDeviceToken, regDeviceName, regStaffId, regRole, regPin,
  onDeviceTokenChange, onDeviceNameChange, onStaffIdChange, onRoleChange, onPinChange,
  onSubmit,
}: Props) {
  return (
    <Modal open={open} onClose={onClose} title="Đăng ký thiết bị mới">
      <div className="space-y-4">
        {registerError && <div className="text-red-600 text-xs">{registerError}</div>}
        <Input label="Tên thiết bị (lưu đăng nhập)" value={regDeviceToken} onChange={e => onDeviceTokenChange(e.target.value)} placeholder="VD: tablet-bep-01" />
        <Input label="Tên hiển thị" value={regDeviceName} onChange={e => onDeviceNameChange(e.target.value)} placeholder="VD: Tablet Bếp A" />
        {staffList.length === 0 ? (
          <div className="bg-amber-50 rounded-lg p-3 text-xs text-amber-700">Hãy thêm nhân viên ở trang <strong>Nhân viên</strong> trước khi đăng ký thiết bị.</div>
        ) : (
          <div>
            <label className="block text-sm font-medium mb-1.5">Chọn nhân viên</label>
            <select value={regStaffId} onChange={e => onStaffIdChange(e.target.value)} className="w-full h-10 px-3 rounded-lg border border-border bg-white text-sm">
              <option value="">-- Chọn nhân viên --</option>
              {staffList.map(s => (<option key={s.id} value={s.id}>{s.name} ({ROLE_LABEL[s.role] || s.role})</option>))}
            </select>
          </div>
        )}
        <div>
          <label className="block text-sm font-medium mb-1.5">Vai trò trên thiết bị</label>
          <select value={regRole} onChange={e => onRoleChange(e.target.value)} className="w-full h-10 px-3 rounded-lg border border-border bg-white text-sm">
            <option value="staff">Nhân viên / Staff</option>
            <option value="waiter">Phục vụ / Waiter</option>
            <option value="kitchen">Bếp / Kitchen</option>
          </select>
        </div>
        <Input label="Mã PIN 4 chữ số *" value={regPin} onChange={e => onPinChange(e.target.value.replace(/\D/g, '').slice(0, 4))} placeholder="VD: 1234" inputMode="numeric" maxLength={4} />
        <div className="flex gap-3 justify-end pt-2">
          <Button variant="secondary" onClick={onClose} disabled={actionLoading}>Huỷ</Button>
          <Button onClick={onSubmit} loading={actionLoading}>Đăng ký</Button>
        </div>
      </div>
    </Modal>
  );
}
