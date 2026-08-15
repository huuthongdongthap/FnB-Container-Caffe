'use client';

import { useState, useEffect } from 'react';
import { API_BASE } from '@/lib/api-client';
import { PushNotificationToggle } from '@/components/pwa/push-notification-toggle';
import { NOTIF_CARD, NOTIF_UNREAD, NOTIF_READ, NOTIF_TITLE, NOTIF_MSG, NOTIF_TIME, notifEmpty } from './mobile-layout-styles';

interface NotifItem {
  id: string;
  title: string;
  message: string;
  created_at: string;
  read: boolean;
}

export default function NotificationsScreen({ token }: { token: string }) {
  const [notifs, setNotifs] = useState<NotifItem[]>([]);

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
