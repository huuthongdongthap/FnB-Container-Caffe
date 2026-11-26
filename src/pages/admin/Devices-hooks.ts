import { useState, useEffect } from 'react';
import { apiFetch } from '@/lib/api-client';
import type { DeviceRow, StaffOption } from './Devices-types';

const ROLE_ALIASES: Record<string, string> = {
  bep: 'kitchen',
  rider: 'shipper',
  phuc_vu: 'waiter',
};

function normalizeDeviceRoleForApi(rawRole: string): string {
  const clean = rawRole.trim().toLowerCase();
  return ROLE_ALIASES[clean] || clean;
}

export function useDevices() {

  const [devices, setDevices] = useState<DeviceRow[]>([]);
  const [staffList, setStaffList] = useState<StaffOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [actionLoading, setActionLoading] = useState(false);

  // Modal state
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
      const body = await apiFetch<{ devices?: DeviceRow[] }>('/mobile/devices');
      setDevices(body.devices || []);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Lỗi kết nối tới server');
    }
  }

  async function fetchStaff(): Promise<void> {
    try {
      const body = await apiFetch<{ staff?: StaffOption[]; users?: StaffOption[] }>('/api/auth/staff');
      setStaffList(body.staff || body.users || []);
    } catch { /* non-critical */ }
  }

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    Promise.all([fetchDevices(), fetchStaff()]).finally(() => {
      if (!cancelled) setLoading(false);
    });
    return () => { cancelled = true; };
  }, []);

  const refresh = () => {
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

  const handleStaffIdChange = (nextStaffId: string) => {
    setRegStaffId(nextStaffId);
    const selected = staffList.find((s) => s.id === nextStaffId);
    if (selected?.role) {
      setRegRole(selected.role);
    }
  };

  const handleRegister = async (): Promise<void> => {
    if (!regStaffId || !regPin) { setRegisterError('Vui lòng chọn nhân viên và nhập PIN'); return; }
    setActionLoading(true); setRegisterError(null);
    const effectiveToken = regDeviceToken.trim() || `dev-${crypto.randomUUID().slice(0, 12)}`;
    const selectedStaff = staffList.find((s) => s.id === regStaffId);
    const accountRole = selectedStaff?.role ? normalizeDeviceRoleForApi(selectedStaff.role) : undefined;
    const requestedRole = regRole ? normalizeDeviceRoleForApi(regRole) : accountRole;
    const shouldSendExplicitRole = Boolean(
      requestedRole && (!accountRole || accountRole === 'staff' || requestedRole === accountRole)
    );
    try {
      await apiFetch('/mobile/devices/register', {
        method: 'POST',
        body: JSON.stringify({
          device_token: effectiveToken,
          device_name: regDeviceName || undefined,
          staff_id: regStaffId,
          ...(shouldSendExplicitRole ? { role: requestedRole } : {}),
          pin: regPin,
        }),
      });
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
      await apiFetch(`/mobile/devices/${revokeTarget.id}`, { method: 'DELETE' });
      setShowRevoke(false); setRevokeTarget(null);
      refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Hủy thất bại');
    } finally { setActionLoading(false); }
  };

  return {
    devices, staffList, loading, error, actionLoading,
    showRegister, setShowRegister, showRevoke, setShowRevoke, revokeTarget, setRevokeTarget,
    regDeviceToken, setRegDeviceToken, regDeviceName, setRegDeviceName,
    regStaffId, setRegStaffId: handleStaffIdChange, regRole, setRegRole, regPin, setRegPin,
    registerError,
    refresh, openRegister, openRevoke, handleRegister, handleRevoke,
  };
}
