'use client';

import { useState, useMemo, useEffect } from 'react';
import { useMobileAuth } from '@/hooks/use-mobile-auth';
import KitchenDisplay from './kitchen-display';
import WaiterOrders from './waiter-orders';
import TableManager from './table-manager';
import NotificationsScreen from './mobile-layout-notifications';
import ProfileScreen from './mobile-layout-profile';
import { wrap, topBar, brand, userInfo, userName, roleBadge, content, tabBar, tabIconWrap, tabStyle } from './mobile-layout-styles';
import { TABS, canAccess } from './mobile-layout-constants';
import type { MobileUser, Tab } from './mobile-layout-types';

/* ── Re-export types for backward compatibility ─────────────────────── */
export type { MobileUser, Tab } from './mobile-layout-types';

/* ── Main App Shell ───────────────────────────────────────────────────*/

export default function MobileAppShell() {
  const { token, user, logout } = useMobileAuth();
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
