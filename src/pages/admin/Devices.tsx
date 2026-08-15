import { useTranslation } from 'react-i18next';
import { Button } from '@/components/ui/button';
import { Card, CardBody } from '@/components/ui/card';
import { HelmetHead } from '@/components/seo/HelmetHead';
import { Plus, RefreshCw, KeyRound } from 'lucide-react';
import { useDevices } from './Devices-hooks';
import { DevicesStats } from './Devices-stats';
import { DevicesTable } from './Devices-table';
import { DevicesRegisterModal } from './Devices-register-modal';
import { DevicesRevokeModal } from './Devices-revoke-modal';

export type { DeviceRow, StaffOption } from './Devices-types';

export default function AdminDevicesPage() {
  const d = useDevices();

  return (
    <>
      <HelmetHead
        title="Quản lý thiết bị — Device Management — AURA CAFE"
        description="Đăng ký, theo dõi và quản lý thiết bị của nhân viên. Register and manage staff mobile devices."
      />
      <div className="min-h-screen bg-background p-6">
        <div className="max-w-5xl mx-auto">
          {/* Header */}
          <div className="flex items-center justify-between mb-6">
            <div>
              <h1 className="text-2xl font-display font-bold">Quản lý thiết bị</h1>
              <p className="text-sm text-muted mt-1">Đăng ký và theo dõi thiết bị di động của nhân viên</p>
            </div>
            <div className="flex gap-2">
              <Button variant="secondary" onClick={d.refresh} className="gap-2">
                <RefreshCw className="h-4 w-4" /> Làm mới
              </Button>
              <Button onClick={d.openRegister} className="gap-2">
                <Plus className="h-4 w-4" /> Đăng ký thiết bị
              </Button>
            </div>
          </div>

          {/* Error */}
          {d.error && (
            <div className="bg-red-50 border border-red-200 rounded-xl p-4 mb-6 text-red-700 text-sm">
              {d.error}
              <button onClick={d.refresh} className="ml-3 underline hover:no-underline">Thử lại</button>
            </div>
          )}

          {/* Stats */}
          {!d.loading && <DevicesStats devices={d.devices} />}

          {/* Table */}
          <DevicesTable devices={d.devices} loading={d.loading} onRevoke={d.openRevoke} />

          {/* PIN Tip */}
          <Card className="mt-6 border-dashed">
            <CardBody className="flex items-start gap-3 text-xs text-muted">
              <KeyRound className="h-4 w-4 shrink-0 mt-0.5" />
              <div>
                <strong>Mã PIN thiết bị:</strong> Nhân viên dùng 4 chữ số này để đăng nhập vào app AURA Mobile.
                Chọn PIN ngẫu nhiên 4 số và cung cấp cho nhân viên khi giao máy.
              </div>
            </CardBody>
          </Card>
        </div>
      </div>

      {/* Register Modal */}
      <DevicesRegisterModal
        open={d.showRegister} onClose={() => d.setShowRegister(false)}
        staffList={d.staffList} actionLoading={d.actionLoading}
        registerError={d.registerError}
        regDeviceToken={d.regDeviceToken} regDeviceName={d.regDeviceName}
        regStaffId={d.regStaffId} regRole={d.regRole} regPin={d.regPin}
        onDeviceTokenChange={d.setRegDeviceToken} onDeviceNameChange={d.setRegDeviceName}
        onStaffIdChange={d.setRegStaffId} onRoleChange={d.setRegRole}
        onPinChange={d.setRegPin} onSubmit={d.handleRegister}
      />

      {/* Revoke Modal */}
      <DevicesRevokeModal
        open={d.showRevoke}
        onClose={() => { d.setShowRevoke(false); d.setRevokeTarget(null); }}
        target={d.revokeTarget} actionLoading={d.actionLoading}
        onConfirm={d.handleRevoke}
      />
    </>
  );
}
