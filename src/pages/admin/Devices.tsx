import { useState, useEffect, useMemo } from 'react';
import { useTranslations } from 'next-intl';
import { Button } from '@/components/ui/button';
import { Card, CardBody, CardHeader } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Modal } from '@/components/ui/modal';
import { Skeleton } from '@/components/ui/skeleton';
import { HelmetHead } from '@/components/seo/HelmetHead';
import { useAuthStore } from '@/hooks/stores/use-auth-store';
import { API_BASE } from '@/lib/api-client';
import { Plus, Trash2, MonitorSmartphone, RefreshCw, Shield, KeyRound } from 'lucide-react';

interface DeviceRow {
  id: string;
  staff_id: string;
  device_name: string | null;
  role: string;
  last_login_at: string | null;
  created_at: string;
}

const ROLE_LABEL: Record<string, string> = {
  owner: 'Chủ quán / Owner',
  manager: 'Quản lý / Manager',
  kitchen: 'Bếp / Kitchen',
  bep: 'Bếp / Kitchen',
  waiter: 'Phục vụ / Waiter',
  phuc_vu: 'Phục vụ / Waiter',
  staff: 'Nhân viên / Staff',
};

function fmtDate(iso: string | null): string {
  if (!iso) return '--';
  return new Date(iso).toLocaleString('vi-VN', {
    day: '2-digit', month: '2-digit',
    hour: '2-digit', minute: '2-digit',
  });
}

function fmtDeviceId(sid: string): string {
  if (sid.startsWith('staff-')) return sid.slice(0, 18) + '…';
  return sid.slice(0, 10) + '…';
}

function relativeTime(iso: string | null): string {
  if (!iso) return 'Chưa đăng nhập';
  const diff = Date.now() - new Date(iso).getTime();
  if (diff < 60000) return 'Vừa xong';
  if (diff < 3600000) return `${Math.floor(diff / 60000)} phút trước`;
  if (diff < 86400000) return `${Math.floor(diff / 3600000)} giờ trước`;
  return `${Math.floor(diff / 86400000)} ngày trước`;
}

export default function AdminDevicesPage() {
  const t = useTranslations('admin');
  const { token } = useAuthStore();

  const [devices, setDevices] = useState<DeviceRow[]>([]);
  const [staffList, setStaffList] = useState<{ id: string; name: string; role: string }[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [actionLoading, setActionLoading] = useState(false);

  // Modals
  const [showRegister, setShowRegister] = useState(false);
  const [showRevoke, setShowRevoke] = useState(false);
  const [revokeTarget, setRevokeTarget] = useState<DeviceRow | null>(null);

  // Register form
  const [regDeviceToken, setRegDeviceToken] = useState('');
  const [regDeviceName, setRegDeviceName] = useState('');
  const [regStaffId, setRegStaffId] = useState('');
  const [regRole, setRegRole] = useState('staff');
  const [regPin, setRegPin] = useState('');
  const [registerError, setRegisterError] = useState<string | null>(null);

  async function fetchDevices(): Promise<void> {
    setError(null);
    try {
      const res = await fetch(`${API_BASE}/mobile/devices`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.status === 401) {
        setError('Phiên đăng nhập hết hạn. Vui lòng đăng nhập lại.');
        return;
      }
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error || body.message || `HTTP ${res.status}`);
      }
      const body = await res.json();
      setDevices(body.devices || []);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Lỗi kết nối tới server');
    }
  }

  async function fetchStaff(): Promise<void> {
    try {
      const res = await fetch(`${API_BASE}/api/auth/staff`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        const body = await res.json();
        setStaffList(body.staff || body || []);
      }
    } catch { /* non-critical */ }
  }

  useEffect(() => {
    if (!token) return;
    let cancelled = false;
    setLoading(true);
    Promise.all([fetchDevices(), fetchStaff()]).finally(() => {
      if (!cancelled) setLoading(false);
    });
    return () => { cancelled = true; };
  }, [token]);

  const refresh = () => {
    if (!token) return;
    setLoading(true);
    Promise.all([fetchDevices(), fetchStaff()]).finally(() => setLoading(false));
  };

  const openRegister = () => {
    setRegDeviceToken(''); setRegDeviceName(''); setRegStaffId('');
    setRegRole('staff'); setRegPin(''); setRegisterError(null);
    setShowRegister(true);
  };

  const openRevoke = (d: DeviceRow) => {
    setRevokeTarget(d); setShowRevoke(true);
  };

  const handleRegister = async (): Promise<void> => {
    if (!regStaffId || !regPin) { setRegisterError('Vui lòng chọn nhân viên và nhập PIN'); return; }
    setActionLoading(true); setRegisterError(null);
    try {
      const res = await fetch(`${API_BASE}/mobile/devices/register`, {
        method: 'POST', headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ device_token: regDeviceToken || undefined, device_name: regDeviceName || undefined, staff_id: regStaffId, role: regRole, pin: regPin }),
      });
      const body = await res.json();
      if (!res.ok) throw new Error(body.error || body.message || `HTTP ${res.status}`);
      setShowRegister(false);
      refresh();
    } catch (err) {
      setRegisterError(err instanceof Error ? err.message : 'Đăng ký thất bại');
    } finally { setActionLoading(false); }
  };

  const handleRevoke = async (): Promise<void> => {
    if (!revokeTarget) return;
    setActionLoading(true);
    try {
      const res = await fetch(`${API_BASE}/mobile/devices/${revokeTarget.id}`, {
        method: 'DELETE', headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      });
      const body = await res.json();
      if (!res.ok) throw new Error(body.error || body.message || `HTTP ${res.status}`);
      setShowRevoke(false); setRevokeTarget(null);
      refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Hủy thất bại');
    } finally { setActionLoading(false); }
  };

  const roleFilteredStaff = staffList;

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
              <Button variant="secondary" onClick={refresh} className="gap-2">
                <RefreshCw className="h-4 w-4" /> Làm mới
              </Button>
              <Button onClick={openRegister} className="gap-2">
                <Plus className="h-4 w-4" /> Đăng ký thiết bị
              </Button>
            </div>
          </div>

          {/* Error */}
          {error && (
            <div className="bg-red-50 border border-red-200 rounded-xl p-4 mb-6 text-red-700 text-sm">
              {error}
              <button onClick={refresh} className="ml-3 underline hover:no-underline">Thử lại</button>
            </div>
          )}

          {/* Stats */}
          {!loading && (
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
          )}

          {/* Table */}
          {loading ? (
            <Card><CardBody className="p-6 space-y-3">
              <Skeleton className="h-8 w-full" />
              <Skeleton className="h-8 w-full" />
              <Skeleton className="h-8 w-full" />
            </CardBody></Card>
          ) : devices.length === 0 ? (
            <Card><CardBody className="py-16 text-center">
              <MonitorSmartphone className="h-12 w-12 text-muted mx-auto mb-3 opacity-30" />
              <h3 className="text-lg font-medium">Chưa có thiết bị nào</h3>
              <p className="text-sm text-muted mt-1">Nhấn "Đăng ký thiết bị" để thêm tablet đầu tiên cho nhân viên</p>
            </CardBody></Card>
          ) : (
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
                              onClick={() => openRevoke(d)}
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
          )}

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

      {/* ── Register Modal ── */}
      <Modal open={showRegister} onClose={() => setShowRegister(false)} title="Đăng ký thiết bị mới">
        <div className="space-y-4">
          {registerError && <div className="text-red-600 text-xs">{registerError}</div>}
          <Input label="Tên thiết bị (lưu đăng nhập)" value={regDeviceToken} onChange={e => setRegDeviceToken(e.target.value)} placeholder="VD: tablet-bep-01" />
          <Input label="Tên hiển thị" value={regDeviceName} onChange={e => setRegDeviceName(e.target.value)} placeholder="VD: Tablet Bếp A" />
          {staffList.length === 0 ? (
            <div className="bg-amber-50 rounded-lg p-3 text-xs text-amber-700">Hãy thêm nhân viên ở trang <strong>Nhân viên</strong> trước khi đăng ký thiết bị.</div>
          ) : (
            <div>
              <label className="block text-sm font-medium mb-1.5">Chọn nhân viên</label>
              <select value={regStaffId} onChange={e => setRegStaffId(e.target.value)} className="w-full h-10 px-3 rounded-lg border border-border bg-white text-sm">
                <option value="">-- Chọn nhân viên --</option>
                {staffList.map(s => (<option key={s.id} value={s.id}>{s.name} ({ROLE_LABEL[s.role] || s.role})</option>))}
              </select>
            </div>
          )}
          <div>
            <label className="block text-sm font-medium mb-1.5">Vai trò trên thiết bị</label>
            <select value={regRole} onChange={e => setRegRole(e.target.value)} className="w-full h-10 px-3 rounded-lg border border-border bg-white text-sm">
              <option value="staff">Nhân viên / Staff</option>
              <option value="waiter">Phục vụ / Waiter</option>
              <option value="kitchen">Bếp / Kitchen</option>
            </select>
          </div>
          <Input label="Mã PIN 4 chữ số *" value={regPin} onChange={e => setRegPin(e.target.value.replace(/\D/g, '').slice(0, 4))} placeholder="VD: 1234" inputMode="numeric" maxLength={4} />
          <div className="flex gap-3 justify-end pt-2">
            <Button variant="secondary" onClick={() => setShowRegister(false)} disabled={actionLoading}>Huỷ</Button>
            <Button onClick={handleRegister} loading={actionLoading}>Đăng ký</Button>
          </div>
        </div>
      </Modal>

      {/* ── Revoke Confirm Modal ── */}
      <Modal open={showRevoke} onClose={() => { setShowRevoke(false); setRevokeTarget(null); }} title="Hủy đăng ký thiết bị">
        <p className="text-sm">Hủy đăng ký thiết bị <strong>{revokeTarget?.device_name || revokeTarget?.id}</strong>?</p>
        <p className="text-xs text-muted mt-1">Nhân viên không thể đăng nhập bằng thiết bị này nữa. Mã PIN được dùng lại khi đăng ký lại.</p>
        <div className="flex gap-3 justify-end pt-4">
          <Button variant="secondary" onClick={() => { setShowRevoke(false); setRevokeTarget(null); }} disabled={actionLoading}>Giữ lại</Button>
          <Button variant="destructive" onClick={handleRevoke} loading={actionLoading}>Hủy đăng ký</Button>
        </div>
      </Modal>
    </>
  );
}
