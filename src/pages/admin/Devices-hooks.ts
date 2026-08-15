import { useState, useEffect } from 'react';
import { apiFetch } from '@/lib/api-client';
import type { DeviceRow, StaffOption } from './Devices-types';

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
      const body = await apiFetch<{ staff?: StaffOption[] }>('/api/auth/staff');
      setStaffList(body.staff || []);
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

  const handleRegister = async (): Promise<void> => {
    if (!regStaffId || !regPin) { setRegisterError('Vui lòng chọn nhân viên và nhập PIN'); return; }
    setActionLoading(true); setRegisterError(null);
    try {
      await apiFetch('/mobile/devices/register', {
        method: 'POST',
        body: JSON.stringify({ device_token: regDeviceToken || undefined, device_name: regDeviceName || undefined, staff_id: regStaffId, role: regRole, pin: regPin }),
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
    regStaffId, setRegStaffId, regRole, setRegRole, regPin, setRegPin,
    registerError,
    refresh, openRegister, openRevoke, handleRegister, handleRevoke,
  };
}
