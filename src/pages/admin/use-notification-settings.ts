/**
 * Hook for fetching and toggling push notification settings.
 */

import { useState, useEffect, useRef } from 'react';
import { apiFetch } from '@/lib/api-client';
import { useAuthStore } from '@/hooks/stores/use-auth-store';
import type { PushSettings } from './notification-settings-types';

const DEFAULT_SETTINGS: PushSettings = {
  autoNotifyNewOrder: false,
  soundAlerts: false,
};

export function useNotificationSettings() {
  const user = useAuthStore((s) => s.user);
  const sessionVersion = useAuthStore((s) => s.sessionVersion);
  const [settings, setSettings] = useState<PushSettings>(DEFAULT_SETTINGS);
  const settingsRef = useRef<PushSettings>(DEFAULT_SETTINGS);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const savedTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    settingsRef.current = settings;
  }, [settings]);

  useEffect(() => {
    return () => {
      if (savedTimerRef.current) {
        clearTimeout(savedTimerRef.current);
      }
    };
  }, []);

  useEffect(() => {
    settingsRef.current = DEFAULT_SETTINGS;
    setSettings(DEFAULT_SETTINGS);
    setSaved(false);
    const controller = new AbortController();
    void (async () => {
      try {
        const resp = await apiFetch<PushSettings & { ok?: boolean; success?: boolean; data?: PushSettings }>(
          '/api/admin/notification-settings',
          { signal: controller.signal },
        );
        if (resp && resp.ok !== false && resp.success !== false && !controller.signal.aborted) {
          const source = resp.data ?? resp;
          const nextSettings: PushSettings = {
            autoNotifyNewOrder: Boolean(source.autoNotifyNewOrder),
            soundAlerts: Boolean(source.soundAlerts),
          };
          settingsRef.current = nextSettings;
          setSettings(nextSettings);
        }
      } catch {
        // Use defaults on failure
      }
    })();
    return () => controller.abort();
  }, [user?.id, user?.tenantId, sessionVersion]);

  const toggle = async (
    key: keyof Pick<PushSettings, 'autoNotifyNewOrder' | 'soundAlerts'>,
  ) => {
    const previousValue = settingsRef.current[key];
    const nextValue = !previousValue;
    const optimistic = { ...settingsRef.current, [key]: nextValue };
    settingsRef.current = optimistic;
    setSettings((prev) => ({ ...prev, [key]: nextValue }));
    setSaving(true);
    setSaved(false);
    if (savedTimerRef.current) {
      clearTimeout(savedTimerRef.current);
      savedTimerRef.current = null;
    }
    try {
      const res = await apiFetch<{ ok?: boolean; success?: boolean }>('/api/admin/notification-settings', {
        method: 'PATCH',
        body: JSON.stringify({ [key]: nextValue }),
      });
      if (!res || res.ok === false || res.success === false) {
        throw new Error('Failed to save notification settings');
      }
      setSaved(true);
      savedTimerRef.current = setTimeout(() => {
        setSaved(false);
        savedTimerRef.current = null;
      }, 2000);
    } catch {
      setSaved(false);
      settingsRef.current = { ...settingsRef.current, [key]: previousValue };
      setSettings((prev) => ({ ...prev, [key]: previousValue }));
    } finally {
      setSaving(false);
    }
  };

  return { settings, saving, saved, toggle };
}
