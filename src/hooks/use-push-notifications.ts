import { useState, useEffect, useCallback } from 'react';
import { API_BASE } from '@/lib/api-client';


function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = '='.repeat((4 - base64String.length % 4) % 4);
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
  const rawData = window.atob(base64);
  const outputArray = new Uint8Array(rawData.length);
  for (let i = 0; i < rawData.length; ++i) {
    outputArray[i] = rawData.charCodeAt(i);
  }
  return outputArray;
}

export function usePushNotifications() {
  const [permission, setPermission] = useState<NotificationPermission | 'unsupported'>('default');
  const [isSubscribed, setIsSubscribed] = useState(false);
  const [subscribing, setSubscribing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!('Notification' in window)) {
      setPermission('unsupported');
      return;
    }
    setPermission(Notification.permission);

    // Check if already subscribed
    if ('serviceWorker' in navigator && 'PushManager' in window) {
      navigator.serviceWorker.ready.then(reg => {
        reg.pushManager.getSubscription().then(sub => {
          setIsSubscribed(!!sub);
        });
      });
    }
  }, []);

  const subscribe = useCallback(async (customerId?: string, role: string = 'customer') => {
    if (!('serviceWorker' in navigator) || !('PushManager' in window)) {
      setError('Trinh duyet khong ho tro thong bao');
      return false;
    }

    setSubscribing(true);
    setError(null);

    try {
      // Request permission
      const perm = await Notification.requestPermission();
      setPermission(perm);
      if (perm !== 'granted') {
        setError('Ban da tu choi nhan thong bao');
        setSubscribing(false);
        return false;
      }

      // Get VAPID public key
      const keyRes = await fetch(`${API_BASE}/api/push/public-key`);
      const keyData = await keyRes.json();
      if (!keyData.success || !keyData.publicKey) {
        setError('He thong thong bao chua duoc cau hinh');
        setSubscribing(false);
        return false;
      }

      // Register service worker if not already
      const reg = await navigator.serviceWorker.register('/sw.js');
      await navigator.serviceWorker.ready;

      // Subscribe
      const subscription = await reg.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(keyData.publicKey) as unknown as BufferSource,
      });

      // Send to backend
      const subData = subscription.toJSON();
      const subscribeRes = await fetch(`${API_BASE}/api/push/subscribe`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          endpoint: subData.endpoint,
          auth_key: subData.keys?.auth || '',
          p256dh_key: subData.keys?.p256dh || '',
          customer_id: customerId || null,
          user_agent: navigator.userAgent,
    role,
        }),
      });

      const result = await subscribeRes.json();
      if (result.success) {
        setIsSubscribed(true);
        setSubscribing(false);
        return true;
      } else {
        setError('Khong the dang ky thong bao');
        setSubscribing(false);
        return false;
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Loi dang ky thong bao');
      setSubscribing(false);
      return false;
    }
  }, []);

  const unsubscribe = useCallback(async () => {
    try {
      if ('serviceWorker' in navigator) {
        const reg = await navigator.serviceWorker.ready;
        const sub = await reg.pushManager.getSubscription();
        if (sub) {
          await sub.unsubscribe();

          // Notify backend
          const subData = sub.toJSON();
          await fetch(`${API_BASE}/api/push/unsubscribe`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ endpoint: subData.endpoint }),
          });
        }
      }
      setIsSubscribed(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Loi huy dang ky');
    }
  }, []);

  return {
    permission,
    isSubscribed,
    subscribing,
    error,
    subscribe,
    unsubscribe,
    supported: permission !== 'unsupported',
  };
}
