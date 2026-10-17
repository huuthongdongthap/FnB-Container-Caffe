'use client';

import { useState, useEffect, useCallback } from 'react';
import { apiFetch } from '@/lib/api-client';
import { useMobileAuth } from '@/hooks/use-mobile-auth';
import { PushNotificationToggle } from '@/components/pwa/push-notification-toggle';
import { NOTIF_CARD, NOTIF_UNREAD, NOTIF_READ, NOTIF_TITLE, NOTIF_MSG, NOTIF_TIME, notifEmpty } from './mobile-layout-styles';

declare module '@/components/pwa/push-notification-toggle-types' {
  interface PushNotificationToggleProps {
    role?: string;
  }
}

interface NotifItem {
  id: string;
  title: string;
  message: string;
  created_at: string;
  read: boolean;
}

export default function NotificationsScreen() {
  const { user: staff } = useMobileAuth();
  const [notifs, setNotifs] = useState<NotifItem[]>([]);

  useEffect(() => {
    apiFetch<{ success: boolean; notifications: unknown[] }>('/mobile/notifications').then((b) => {
      if (b.success) {
        setNotifs(b.notifications.map((n: unknown) => {
          const nb = n as Record<string, unknown>;
          return {
            id: String(nb.id),
            title: (nb.title_vi as string) || (nb.title_en as string) || (nb.title as string) || '',
            message: (nb.body_vi as string) || (nb.body_en as string) || (nb.message as string) || '',
            created_at: String(nb.created_at ?? ''),
            read: nb.read_at != null ? true : ((nb.read as boolean) ?? false),
          };
        }));
      }
    }).catch(() => { /* silent */ });
  }, []);

  const markAsRead = useCallback((id: string, alreadyRead: boolean) => {
    if (alreadyRead) return;
    setNotifs((prev) => prev.map((item) => (item.id === id ? { ...item, read: true } : item)));
    apiFetch(`/mobile/notifications/${id}/read`, { method: 'POST' }).catch(() => { /* silent */ });
  }, []);

  return (
    <div style={{ padding: '12px 14px' }}>
      <PushNotificationToggle role={staff?.role || 'staff'} />
      <div style={{ height: 12 }} />
      {notifs.length === 0 ? (
        <div style={notifEmpty}>
          <div style={{ fontSize: 36 }}>🔔</div>
          <div>Không có thông báo</div>
          <div style={{ fontSize: 12 }}>No notifications</div>
        </div>
      ) : notifs.map((n) => (
        <div
          key={n.id}
          onClick={() => markAsRead(n.id, n.read)}
          style={{ ...NOTIF_CARD, ...(n.read ? NOTIF_READ : NOTIF_UNREAD), cursor: n.read ? 'default' : 'pointer' }}
        >
          <div style={NOTIF_TITLE}>{n.title}</div>
          <div style={NOTIF_MSG}>{n.message}</div>
          <div style={NOTIF_TIME}>{new Date(n.created_at).toLocaleString('vi-VN')}</div>
        </div>
      ))}
    </div>
  );
}
