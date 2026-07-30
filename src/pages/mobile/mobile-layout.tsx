'use client';

import { useState, useCallback, useMemo, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { useMobileAuth } from '@/hooks/use-mobile-auth';
import { API_BASE } from '@/lib/api-client';
import KitchenDisplay from './kitchen-display';
import WaiterOrders from './waiter-orders';
import TableManager from './table-manager';
import { PushNotificationToggle } from '@/components/pwa/push-notification-toggle';

/* ── Types ────────────────────────────────────────────────────────── */

interface MobileUser {
  id: string;
  name: string;
  role: string;
}

type Tab = 'kds' | 'orders' | 'tables' | 'notifications' | 'profile';

/* ── Static styles ──────────────────────────────────────────────────*/

const wrap: React.CSSProperties = { minHeight: '100vh', display: 'flex', flexDirection: 'column', background: '#f8f7f4', fontFamily: "'Space Grotesk', sans-serif" };
const topBar: React.CSSProperties = { display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 16px', background: '#ffffff', borderBottom: '1px solid #e5e7eb', position: 'sticky', top: 0, zIndex: 10 };
const brand: React.CSSProperties = { fontSize: 17, fontWeight: 700, color: '#F97316', letterSpacing: '-0.3px' };
const userInfo: React.CSSProperties = { display: 'flex', alignItems: 'center', gap: 8 };
const userName: React.CSSProperties = { fontSize: 13, fontWeight: 600, color: '#374151', maxWidth: 90, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' };
const roleBadge: React.CSSProperties = { fontSize: 10, fontWeight: 600, padding: '2px 7px', borderRadius: 10, background: '#fef3c7', color: '#92400e' };
const logoutBtn: React.CSSProperties = { fontSize: 12, fontWeight: 600, padding: '6px 10px', border: '1px solid #e5e7eb', borderRadius: 8, background: '#fff', color: '#dc2626', cursor: 'pointer', fontFamily: "'Space Grotesk', sans-serif" };
const content: React.CSSProperties = { flex: 1 };
const tabBar: React.CSSProperties = { display: 'flex', background: '#ffffff', borderTop: '1px solid #e5e7eb', paddingBottom: 'env(safe-area-inset-bottom, 0px)', position: 'fixed', bottom: 0, left: 0, right: 0, zIndex: 20 };
const tabIconWrap: React.CSSProperties = { width: 22, height: 22, display: 'flex', alignItems: 'center', justifyContent: 'center' };

const PROFILE_AVATAR: React.CSSProperties = { width: 64, height: 64, borderRadius: '50%', background: '#F97316', color: '#fff', fontSize: 26, fontWeight: 700, display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 12px' };
const PROFILE_NAME: React.CSSProperties = { fontSize: 17, fontWeight: 700, color: '#1a1a2e' };
const PROFILE_ROLE: React.CSSProperties = { fontSize: 12, color: '#6b7280', textTransform: 'capitalize', marginTop: 4 };
const PROFILE_ID: React.CSSProperties = { fontSize: 11, color: '#9ca3af', marginTop: 4 };
const NOTIF_CARD: React.CSSProperties = { background: '#ffffff', borderRadius: 12, padding: '12px 14px', marginBottom: 8, boxShadow: '0 1px 2px rgba(0,0,0,0.03)' };
const NOTIF_UNREAD: React.CSSProperties = { borderLeft: '3px solid #F97316' };
const NOTIF_READ: React.CSSProperties = { borderLeft: '3px solid #e5e7eb' };
const NOTIF_TITLE: React.CSSProperties = { fontSize: 14, fontWeight: 600, color: '#1a1a2e' };
const NOTIF_MSG: React.CSSProperties = { fontSize: 13, color: '#6b7280', marginTop: 3 };
const NOTIF_TIME: React.CSSProperties = { fontSize: 11, color: '#9ca3af', marginTop: 4 };
const notifEmpty: React.CSSProperties = { display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '50vh', color: '#9ca3af', textAlign: 'center', gap: 4 };
const empty: React.CSSProperties = { display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '60vh', color: '#9ca3af', fontSize: 14, textAlign: 'center' };

/* ── Factory functions ──────────────────────────────────────────────*/

function tabStyle(active: boolean): React.CSSProperties {
  return {
    flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
    padding: '8px 4px 10px', cursor: 'pointer', color: active ? '#F97316' : '#9ca3af', fontSize: 10,
    fontWeight: active ? 700 : 500, background: 'none', border: 'none', gap: 3, lineHeight: 1.2,
    fontFamily: "'Space Grotesk', sans-serif",
  };
}

/* ── Role-based access ─────────────────────────────────────────────*/

const ROLE_ACCESS: Record<Tab, string[]> = {
  kds: ['kitchen', 'bep', 'manager', 'owner', 'admin'],
  orders: ['waiter', 'phuc_vu', 'manager', 'owner', 'admin'],
  tables: ['waiter', 'phuc_vu', 'kitchen', 'bep', 'manager', 'owner', 'admin'],
  notifications: ['waiter', 'phuc_vu', 'kitchen', 'bep', 'manager', 'owner', 'admin'],
  profile: ['waiter', 'phuc_vu', 'kitchen', 'bep', 'manager', 'owner', 'admin'],
};

const TABS: Array<{ id: Tab; label: string; icon: string }> = [
  { id: 'kds', label: 'Bếp', icon: '🍳' },
  { id: 'orders', label: 'Đơn', icon: '📋' },
  { id: 'tables', label: 'Bàn', icon: '🪑' },
  { id: 'notifications', label: 'Thông báo', icon: '🔔' },
  { id: 'profile', label: 'Cá nhân', icon: '👤' },
];

function canAccess(tab: Tab, role: string): boolean {
  return ROLE_ACCESS[tab].some((a) => role.toLowerCase().includes(a));
}

/* ── Sub-screens ─────────────────────────────────────────────────── */

function NotificationsScreen({ token }: { token: string }) {
  const [notifs, setNotifs] = useState<Array<{ id: string; title: string; message: string; created_at: string; read: boolean }>>([]);

  useEffect(() => {
    fetch(`${API_BASE}/mobile/notifications`, {
      headers: { Authorization: `Bearer ${token}` },
    })
    .then((r) => r.json())
    .then((b: { success: boolean; notifications: unknown[] }) => {
      if (b.success) {
        setNotifs(b.notifications.map((n: unknown) => {
          const nb = n as Record<string, unknown>;
          return {
            id: String(nb.id),
            title: String(nb.title ?? ''),
            message: String(nb.message ?? ''),
            created_at: String(nb.created_at ?? ''),
            read: (nb.read as boolean) ?? true,
          };
        }));
      }
    })
    .catch(() => { /* silent */ });
  }, [token]);

  const notifEmpty: React.CSSProperties = { display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '50vh', color: '#9ca3af', textAlign: 'center', gap: 4 };

  return (
    <div style={{ padding: '12px 14px' }}>
  <PushNotificationToggle token={token} />
  <div style={{ height: 12 }} />
      {notifs.length === 0 ? (
        <div style={notifEmpty}>
          <div style={{ fontSize: 36 }}>🔔</div>
          <div>Không có thông báo</div>
          <div style={{ fontSize: 12 }}>No notifications</div>
        </div>
      ) : notifs.map((n) => (
        <div key={n.id} style={{ ...NOTIF_CARD, ...(n.read ? NOTIF_READ : NOTIF_UNREAD) }}>
          <div style={NOTIF_TITLE}>{n.title}</div>
          <div style={NOTIF_MSG}>{n.message}</div>
          <div style={NOTIF_TIME}>{new Date(n.created_at).toLocaleString('vi-VN')}</div>
        </div>
      ))}
    </div>
  );
}

function ProfileScreen({ user, onLogout }: { user: MobileUser; onLogout: () => void }) {
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

/* ── Main App Shell ─────────────────────────────────────────────────*/

export default function MobileAppShell() {
  const { token, user, logout } = useMobileAuth();
  const { t } = useTranslation();
  const [currentTab, setCurrentTab] = useState<Tab>('orders');
  const safeUser = (user || { id: '', name: '', role: 'staff' }) as MobileUser;
  const safeToken = token || '';
  const visibleTabs = useMemo(() => TABS.filter((t) => canAccess(t.id, safeUser.role)), [safeUser.role]);

  // Redirect if current tab is no longer accessible (e.g. role changed)
  useEffect(() => {
    if (!visibleTabs.find((t) => t.id === currentTab) && visibleTabs.length > 0) {
      setCurrentTab(visibleTabs[0]!.id);
    }
  }, [visibleTabs, currentTab]);

  const renderContent = () => {
    switch (currentTab) {
      case 'kds':
        return <KitchenDisplay />;
      case 'orders':
        return <WaiterOrders />;
      case 'tables':
        return <TableManager />;
      case 'notifications':
        return <NotificationsScreen token={safeToken} />;
      case 'profile':
        return <ProfileScreen user={safeUser} onLogout={logout} />;
      default:
        return null;
    }
  };

  return (
    <div style={wrap}>
      <div style={topBar}>
        <span style={brand}>AURA Mobile</span>
        <div style={userInfo}>
          <span style={{ ...userName, maxWidth: 80 }}>{safeUser.name?.split(' ').pop() ?? safeUser.name}</span>
          <span style={roleBadge}>{safeUser.role}</span>
        </div>
      </div>
      <div style={content}>{renderContent()}</div>
      <div style={tabBar}>
        {visibleTabs.map((t) => (
          <button key={t.id} style={tabStyle(currentTab === t.id)} onClick={() => setCurrentTab(t.id)}>
            <span style={tabIconWrap}>{t.icon}</span>
            {t.label}
          </button>
        ))}
      </div>
    </div>
  );
}
