'use client';

import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ShiftHandoverModal } from '@/components/admin/ShiftHandoverModal';
import { useMobileAuth } from '@/hooks/use-mobile-auth';
import type { MobileUser } from './mobile-layout-types';
import { NOTIF_CARD, PROFILE_AVATAR, PROFILE_NAME, PROFILE_ROLE, PROFILE_ID } from './mobile-layout-styles';

export default function ProfileScreen({ user, onLogout }: { user: MobileUser; onLogout: () => void }) {
  const { t } = useTranslation();
  const { forgetDevice } = useMobileAuth();
  const [shiftOpen, setShiftOpen] = useState(false);
  return (
    <div style={{ padding: '16px 16px 24px' }}>
      <div style={{ ...NOTIF_CARD, textAlign: 'center', boxShadow: 'var(--md-sys-elevation-level1)' }}>
        <div style={PROFILE_AVATAR}>{user.name.charAt(0).toUpperCase()}</div>
        <div style={PROFILE_NAME}>{user.name}</div>
        <div style={PROFILE_ROLE}>{user.role}</div>
        <div style={PROFILE_ID}>ID: {user.id.slice(0, 8)}</div>
      </div>
      {user.id && (
        <button
          type="button"
          onClick={() => setShiftOpen(true)}
          data-testid="mobile-profile-shift-btn"
          style={{ width: '100%', marginTop: 16, padding: '14px 0', fontSize: 15, fontWeight: 600, border: '1.5px solid var(--md-sys-color-primary)', borderRadius: 12, background: 'var(--aura-noir-mid)', color: 'var(--md-sys-color-primary)', cursor: 'pointer', fontFamily: 'var(--aura-font-body)' }}
        >
          Mở ca / Chấm công &amp; Bàn giao / Shift Clock-In &amp; Out
        </button>
      )}
      <button
        type="button"
        onClick={onLogout}
        style={{ width: '100%', marginTop: 12, padding: '14px 0', fontSize: 15, fontWeight: 600, border: '1.5px solid var(--md-sys-color-error)', borderRadius: 12, background: 'var(--aura-noir-mid)', color: 'var(--md-sys-color-error)', cursor: 'pointer', fontFamily: 'var(--aura-font-body)' }}
      >
        {t('auth.logout', 'Đăng xuất / Logout')}
      </button>
      <button type="button" onClick={forgetDevice} style={{ width: '100%', marginTop: 12, padding: 12 }}>
        {t('auth.forgetDevice', 'Quên thiết bị này')}
      </button>
      {shiftOpen && (
        <ShiftHandoverModal
          isOpen={shiftOpen}
          onClose={() => setShiftOpen(false)}
          actorOverride={user}
        />
      )}
    </div>
  );
}
