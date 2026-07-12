'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { useMobileAuth } from '@/hooks/use-mobile-auth';
import { API_BASE } from '@/lib/api-client';

/* ── Types ────────────────────────────────────────────────────────── */

interface LoginUser {
  id: string;
  name: string;
  role: string;
  device_id: string;
}

interface LoginResponse {
  success: boolean;
  user: LoginUser;
  token: string;
  expires_in: number;
}

interface MobileLoginProps {
  
}

/* ── Static styles ──────────────────────────────────────────────────*/

const wrap: React.CSSProperties = { minHeight: '100vh', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', background: '#f8f7f4', fontFamily: "'Space Grotesk', sans-serif", padding: 16 };
const card: React.CSSProperties = { width: '100%', maxWidth: 380, background: '#ffffff', borderRadius: 16, padding: '32px 24px', boxShadow: '0 1px 3px rgba(0,0,0,0.06), 0 6px 24px rgba(0,0,0,0.04)' };
const logo: React.CSSProperties = { fontSize: 28, fontWeight: 700, color: '#F97316', textAlign: 'center', marginBottom: 4, letterSpacing: '-0.5px' };
const subtitle: React.CSSProperties = { fontSize: 14, color: '#6b7280', textAlign: 'center', marginBottom: 32 };
const label: React.CSSProperties = { display: 'block', fontSize: 13, fontWeight: 600, color: '#1a1a2e', marginBottom: 6 };
const input: React.CSSProperties = { width: '100%', boxSizing: 'border-box', padding: '12px 14px', fontSize: 16, border: '1.5px solid #e5e7eb', borderRadius: 10, outline: 'none', background: '#f9fafb', color: '#1a1a2e', fontFamily: "'Space Grotesk', sans-serif", transition: 'border-color 0.15s' };
const pinRow: React.CSSProperties = { display: 'flex', gap: 10, justifyContent: 'center', margin: '8px 0 24px' };
const errorBox: React.CSSProperties = { marginTop: 16, padding: '10px 14px', background: '#fef2f2', border: '1px solid #fecaca', borderRadius: 10, color: '#dc2626', fontSize: 13, textAlign: 'center' };

/* ── Factory functions ──────────────────────────────────────────────*/

function pinBoxStyle(focused: boolean): React.CSSProperties {
  return {
    width: 52, height: 60, textAlign: 'center', fontSize: 24, fontWeight: 600,
    border: focused ? '2px solid #F97316' : '2px solid #e5e7eb', borderRadius: 12,
    background: '#f9fafb', color: '#1a1a2e', outline: 'none',
    boxShadow: focused ? '0 0 0 3px rgba(249,115,22,0.15)' : 'none',
    fontFamily: "'Space Grotesk', sans-serif", caretColor: '#F97316',
  };
}

function submitStyle(disabled: boolean): React.CSSProperties {
  return {
    width: '100%', padding: '14px 0', fontSize: 16, fontWeight: 600, border: 'none', borderRadius: 12,
    background: '#F97316', color: '#ffffff', cursor: 'pointer', fontFamily: "'Space Grotesk', sans-serif",
    transition: 'opacity 0.15s', marginTop: 8, opacity: disabled ? 0.7 : 1,
  };
}

/* ── Component ────────────────────────────────────────────────────── */

export default function MobileLogin() {
  const { login } = useMobileAuth();
  const { t } = useTranslation();
  // Unchecked-indexed-access-safe accessor: valid indices 0-3, use non-null assertion at access points
  const pinRef0 = useRef<HTMLInputElement>(null);
  const pinRef1 = useRef<HTMLInputElement>(null);
  const pinRef2 = useRef<HTMLInputElement>(null);
  const pinRef3 = useRef<HTMLInputElement>(null);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const refs = [pinRef0, pinRef1, pinRef2, pinRef3] as any;

  const [deviceToken, setDeviceToken] = useState<string>('');
  const [pin, setPin] = useState<[string, string, string, string]>(['', '', '', '']);
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [focusedIdx, setFocusedIdx] = useState<number>(0);

  useEffect(() => {
    const stored = localStorage.getItem('aura_device_token');
    if (stored) setDeviceToken(stored);
  }, []);

  const updatePin = useCallback((idx: number, val: string) => {
    const digit = val.replace(/\D/g, '').slice(-1);
    const next: [string, string, string, string] = [...pin] as [string, string, string, string];
    next[idx] = digit;
    setPin(next);
    setError(null);
    if (digit && idx < 3) {
      setTimeout(() => { refs[idx + 1].current?.focus(); }, 50);
    }
  // cast safe: refs is a fixed-length tuple of exactly 4 non-nullable RefObjects
  // eslint-disable-next-line react-hooks/exhaustive-deps -- refs is a stable tuple
  }, [pin]);

  const handlePinKeyDown = useCallback((idx: number, e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Backspace' && !pin[idx] && idx > 0) {
      refs[idx - 1].current?.focus();
    }
    if (e.key === 'ArrowLeft' && idx > 0) {
      refs[idx - 1].current?.focus();
    }
    if (e.key === 'ArrowRight' && idx < 3) {
      refs[idx + 1].current?.focus();
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps -- refs is a stable tuple
  }, [pin]);

  const handleSubmit = useCallback(async () => {
    const fullPin = pin.join('');
    if (fullPin.length < 4) {
      setError('Vui lòng nhập đủ 4 chữ số PIN / Please enter 4-digit PIN');
      return;
    }
    if (!deviceToken.trim()) {
      setError('Vui lòng nhập mã thiết bị / Please enter device token');
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`${API_BASE}/mobile/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ device_token: deviceToken.trim(), pin: fullPin }),
      });
      const body = (await res.json()) as LoginResponse;
      if (!res.ok || !body.success) {
        setError('Đăng nhập thất bại — kiểm tra mã PIN / Login failed');
        return;
      }
      localStorage.setItem('aura_device_token', deviceToken.trim());
      localStorage.setItem('aura_auth_token', body.token);
      localStorage.setItem('aura_user_data', JSON.stringify(body.user));
       // login already stored in hook
    window.location.hash = '#/mobile';
    } catch {
      setError('Không kết nối được máy chủ / Server connection error');
    } finally {
      setLoading(false);
    }
  }, [pin, deviceToken]);

  return (
    <div style={wrap}>
      <div style={card}>
        <div style={logo}>AURA Mobile</div>
        <div style={subtitle}>{t('staffLogin.subtitle', 'Đăng nhập nhân viên / Staff Login')}</div>

        <label style={{ ...label, marginTop: 8 }} htmlFor="device-token">
          {t('staffLogin.deviceToken', 'Mã thiết bị / Device Token')}
        </label>
        <input id="device-token" type="text" style={input}
          value={deviceToken} onChange={(e) => setDeviceToken(e.target.value)}
          placeholder="VD: tablet-bep-01" autoComplete="off" />

        <label style={{ ...label, marginTop: 18 }} htmlFor="pin-0">
          {t('staffLogin.pin', 'Mã PIN')}
        </label>
        <div style={pinRow}>
          {pin.map((d, i) => (
            <input key={i} ref={refs[i]} id={`pin-${i}`}
              type={d ? 'text' : 'password'} inputMode="numeric" maxLength={1}
              style={pinBoxStyle(focusedIdx === i)}
              value={d} onChange={(e) => updatePin(i, e.target.value)}
              onFocus={() => setFocusedIdx(i)} onBlur={() => setFocusedIdx(-1)}
              onKeyDown={(e) => handlePinKeyDown(i, e)}
            />
          ))}
        </div>

        <button style={submitStyle(loading)} disabled={loading} onClick={handleSubmit}
          onMouseDown={(e) => e.preventDefault()}>
          {loading ? (t('common.loading', 'Đang tải...') ?? '...') : (t('staffLogin.submit', 'Đăng nhập / Login'))}
        </button>

        {error && <div style={errorBox}>{error}</div>}
      </div>
    </div>
  );
}
