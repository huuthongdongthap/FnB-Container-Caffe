import { Card, CardBody } from '@/components/ui/card';
import type { DeviceRow } from './Devices-types';

interface Props {
  devices: DeviceRow[];
}

export function DevicesStats({ devices }: Props) {
  return (
    <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
      <Card><CardBody className="text-center">
        <div className="text-2xl font-bold">{devices.length}</div>
        <div className="text-xs text-muted mt-1">Tổng thiết bị</div>
      </CardBody></Card>
      <Card><CardBody className="text-center">
        <div className="text-2xl font-bold">{new Set(devices.map(d => d.staff_id)).size}</div>
        <div className="text-xs text-muted mt-1">Nhân viên đã đăng ký</div>
      </CardBody></Card>
      <Card><CardBody className="text-center">
        <div className="text-2xl font-bold">{devices.filter(d => d.last_login_at && Date.now() - new Date(d.last_login_at).getTime() < 86400000).length}</div>
        <div className="text-xs text-muted mt-1">Hoạt động hôm nay</div>
      </CardBody></Card>
      <Card><CardBody className="text-center">
        <div className="text-2xl font-bold">{devices.filter(d => !d.last_login_at).length}</div>
        <div className="text-xs text-muted mt-1">Chưa đăng nhập</div>
      </CardBody></Card>
    </div>
  );
}
