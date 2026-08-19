/**
 * Hook for fetching and toggling push notification settings.
 */

import { useState, useEffect } from 'react';
import { apiFetch } from '@/lib/api-client';
import type { PushSettings } from './notification-settings-types';

export function useNotificationSettings() {
  const [settings, setSettings] = useState<PushSettings>({
    autoNotifyNewOrder: false,
    soundAlerts: false,
  });
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    const controller = new AbortController();
    void (async () => {
      try {
        const resp = await apiFetch<PushSettings>(
          '/api/admin/notification-settings',
          { signal: controller.signal },
        );
        if (resp) setSettings(resp);
      } catch {
        // Use defaults on failure
      }
    })();
    return () => controller.abort();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const toggle = async (
    key: keyof Pick<PushSettings, 'autoNotifyNewOrder' | 'soundAlerts'>,
  ) => {
    const next = { ...settings, [key]: !settings[key] };
    setSettings(next);
    setSaving(true);
    setSaved(false);
    try {
      await apiFetch('/api/admin/notification-settings', {
        method: 'PATCH',
        body: JSON.stringify({ [key]: next[key] }),
      });
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    } catch {
      setSettings((prev) => ({ ...prev, [key]: !prev[key] }));
    } finally {
      setSaving(false);
    }
  };

  return { settings, saving, saved, toggle };
}
