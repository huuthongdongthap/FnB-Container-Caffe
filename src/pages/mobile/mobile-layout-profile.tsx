'use client';

import { useTranslation } from 'react-i18next';
import type { MobileUser } from './mobile-layout-types';
import { NOTIF_CARD, PROFILE_AVATAR, PROFILE_NAME, PROFILE_ROLE, PROFILE_ID } from './mobile-layout-styles';

export default function ProfileScreen({ user, onLogout }: { user: MobileUser; onLogout: () => void }) {
  const { t } = useTranslation();
  return (
    <div style={{ padding: '16px 16px 24px' }}>
      <div style={{ ...NOTIF_CARD, textAlign: 'center', boxShadow: '0 1px 3px rgba(0,0,0,0.04)' }}>
        <div style={PROFILE_AVATAR}>{user.name.charAt(0).toUpperCase()}</div>
        <div style={PROFILE_NAME}>{user.name}</div>
        <div style={PROFILE_ROLE}>{user.role}</div>
        <div style={PROFILE_ID}>ID: {user.id.slice(0, 8)}</div>
      </div>
      <button
        onClick={onLogout}
        style={{ width: '100%', marginTop: 16, padding: '14px 0', fontSize: 15, fontWeight: 600, border: '2px solid #fecaca', borderRadius: 12, background: '#fff', color: '#dc2626', cursor: 'pointer', fontFamily: "'Space Grotesk', sans-serif" }}
      >
        {t('auth.logout', 'Đăng xuất / Logout')}
      </button>
    </div>
  );
}
