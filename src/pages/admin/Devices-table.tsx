import { Button } from '@/components/ui/button';
import { Card, CardBody } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { MonitorSmartphone, RefreshCw, Shield, Trash2 } from 'lucide-react';
import { ROLE_LABEL } from './Devices-constants';
import { fmtDate, fmtDeviceId, relativeTime } from './Devices-utils';
import type { DeviceRow } from './Devices-types';

interface Props {
  devices: DeviceRow[];
  loading: boolean;
  onRevoke: (d: DeviceRow) => void;
}

export function DevicesTable({ devices, loading, onRevoke }: Props) {
  if (loading) {
    return (
      <Card><CardBody className="p-6 space-y-3">
        <Skeleton className="h-8 w-full" />
        <Skeleton className="h-8 w-full" />
        <Skeleton className="h-8 w-full" />
      </CardBody></Card>
    );
  }

  if (devices.length === 0) {
    return (
      <Card><CardBody className="py-16 text-center">
        <MonitorSmartphone className="h-12 w-12 text-muted mx-auto mb-3 opacity-30" />
        <h3 className="text-lg font-medium">Chưa có thiết bị nào</h3>
        <p className="text-sm text-muted mt-1">Nhấn "Đăng ký thiết bị" để thêm tablet đầu tiên cho nhân viên</p>
      </CardBody></Card>
    );
  }

  return (
    <Card>
      <CardBody className="p-0">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border text-left text-muted text-xs uppercase tracking-wider">
                <th className="px-5 py-3 font-medium">NV</th>
                <th className="px-5 py-3 font-medium">Tên thiết bị</th>
                <th className="px-5 py-3 font-medium">Vai trò</th>
                <th className="px-5 py-3 font-medium">Đăng nhập cuối</th>
                <th className="px-5 py-3 font-medium">Đăng ký lúc</th>
                <th className="px-5 py-3 font-medium w-24">Thao tác</th>
              </tr>
            </thead>
            <tbody>
              {devices.map(d => (
                <tr key={d.id} className="border-b border-border/50 hover:bg-muted/5">
                  <td className="px-5 py-3">
                    <div className="flex items-center gap-2">
                      <RefreshCw className="h-4 w-4 text-muted shrink-0" />
                      <div>
                        <p className="font-medium text-xs">{d.staff_id}</p>
                        <p className="text-xs text-muted">{fmtDeviceId(d.staff_id)}</p>
                      </div>
                    </div>
                  </td>
                  <td className="px-5 py-3">
                    <div className="flex items-center gap-2">
                      <MonitorSmartphone className="h-4 w-4 text-muted shrink-0" />
                      <span>{d.device_name || `Thiết bị ${d.id.slice(0, 8)}`}</span>
                    </div>
                  </td>
                  <td className="px-5 py-3">
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-amber-50 text-amber-700 text-xs font-medium">
                      <Shield className="h-3 w-3" />
                      {ROLE_LABEL[d.role] || d.role}
                    </span>
                  </td>
                  <td className="px-5 py-3 text-xs">
                    <span title={d.last_login_at || ''}>{relativeTime(d.last_login_at)}</span>
                  </td>
                  <td className="px-5 py-3 text-xs text-muted">{fmtDate(d.created_at)}</td>
                  <td className="px-5 py-3">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => onRevoke(d)}
                      className="text-red-500 hover:text-red-700 hover:bg-red-50 p-1"
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </CardBody>
    </Card>
  );
}
