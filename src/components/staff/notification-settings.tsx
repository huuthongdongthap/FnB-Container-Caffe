import { useState, useEffect, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { Bell, BellOff, Volume2, VolumeX, AlertCircle } from 'lucide-react';
import { Card, CardHeader, CardBody } from '@/components/ui/card';
import { Switch } from '@/components/ui/switch';
import { usePushNotifications } from '@/hooks/use-push-notifications';
import { apiFetch } from '@/lib/api-client';

/* ── Bilingual label map (used inside toggle switch) ── */

const TOGGLE_LABELS_VN: Record<string, string> = {
  'orderAlertsEnabled': 'Thông báo đơn hàng mới',
  'shiftRemindersEnabled': 'Nhắc lịch làm việc',
};

const TOGGLE_LABELS_EN: Record<string, string> = {
  'orderAlertsEnabled': 'New order alerts',
  'shiftRemindersEnabled': 'Shift reminders',
};

const TOGGLE_DESC_VN: Record<string, string> = {
  'orderAlertsEnabled': 'Nhận thông báo khi có đơn hàng mới vào bếp.',
  'shiftRemindersEnabled': 'Nhắc ca làm việc 30 phút trước khi bắt đầu.',
};

const TOGGLE_DESC_EN: Record<string, string> = {
  'orderAlertsEnabled': 'Get notified when a new order comes in.',
  'shiftRemindersEnabled': 'Remind 30 minutes before your shift starts.',
};

type ToggleKey = keyof StaffNotificationPreferences;

interface StaffNotificationPreferences {
  orderAlertsEnabled: boolean;
  shiftRemindersEnabled: boolean;
}

export function StaffNotificationSettings() {
  const { t: _t, i18n } = useTranslation();
  const isVi = i18n.language === 'vi';

  const {
    subscribe,
    unsubscribe,
    isSubscribed,
    permission,
    supported,
  } = usePushNotifications();

  const [preferences, setPreferences] = useState<StaffNotificationPreferences>({
    orderAlertsEnabled: true,
    shiftRemindersEnabled: true,
  });
  const [saving, setSaving] = useState(false);
  const [savedAt, setSavedAt] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Role derived from current user session (outside auth scope: treat null as staff-kitchen).
  const [staffRole, setStaffRole] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const meJson = await apiFetch<{ role?: string; user?: { role?: string } }>('/api/auth/me').catch(() => null);
        if (!cancelled && meJson) {
          setStaffRole(meJson.role ?? meJson.user?.role ?? 'staff-kitchen');
        }
      } catch {
        // best-effort role
      }
      try {
        const currentPrefs = await apiFetch<{
          orderAlertsEnabled?: boolean;
          shiftRemindersEnabled?: boolean;
          data?: { orderAlertsEnabled?: boolean; shiftRemindersEnabled?: boolean };
        }>('/api/staff/notification-settings');
        if (!cancelled && currentPrefs) {
          const source = currentPrefs.data ?? currentPrefs;
          setPreferences({
            orderAlertsEnabled: source.orderAlertsEnabled !== false,
            shiftRemindersEnabled: source.shiftRemindersEnabled !== false,
          });
        }
      } catch {
        // Use default true/true when unauthenticated or endpoint unreachable
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const applySubscriptions = useCallback(
    async (next: StaffNotificationPreferences) => {
      const roleToUse = staffRole ?? 'staff-kitchen';
      const desiredSubscribed = next.orderAlertsEnabled || next.shiftRemindersEnabled;

      if (!supported) return;
      if (desiredSubscribed && !isSubscribed && permission !== 'denied') {
        const ok = await subscribe(undefined, roleToUse);
        if (!ok) {
          throw new Error(isVi ? 'Không thể đăng ký thông báo trên trình duyệt' : 'Browser push subscription failed');
        }
      } else if (!desiredSubscribed && isSubscribed) {
        await unsubscribe();
      }
    },
    [isSubscribed, isVi, permission, staffRole, subscribe, supported, unsubscribe],
  );

  const handleToggle = useCallback(
    async (key: ToggleKey) => {
      setSaving(true);
      setSavedAt(null);
      setError(null);
      const previousValue = preferences[key];
      const next = {
        ...preferences,
        [key]: !previousValue,
      } as StaffNotificationPreferences;
      setPreferences(next);
      try {
        await applySubscriptions(next);
        const res = await apiFetch<{
          success?: boolean;
          ok?: boolean;
          error?: string;
          message?: string;
        }>('/api/staff/notification-settings', {
          method: 'PATCH',
          body: JSON.stringify({ [key]: next[key] }),
        });
        if (!res || res.success === false || res.ok === false || res.error) {
          throw new Error(res?.error || res?.message || (isVi ? 'Không thể lưu cài đặt' : 'Could not save setting'));
        }
        setSavedAt(new Date().toLocaleTimeString());
      } catch (err) {
        setPreferences((prev) => ({ ...prev, [key]: previousValue }));
        setError(err instanceof Error ? err.message : (isVi ? 'Không thể lưu cài đặt' : 'Could not save setting'));
      } finally {
        setSaving(false);
      }
    },
    [applySubscriptions, isVi, preferences],
  );

  /* ── Render ── */
  const labelFor = (key: ToggleKey) => (isVi ? TOGGLE_LABELS_VN[key] : TOGGLE_LABELS_EN[key]);
  const descFor = (key: ToggleKey) => (isVi ? TOGGLE_DESC_VN[key] : TOGGLE_DESC_EN[key]);

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center gap-2">
          <Bell size={18} aria-hidden="true" />
          <h2 className="text-lg font-semibold">
            {isVi ? 'Cài đặt thông báo' : 'Notification Settings'}
          </h2>
        </div>
        <p className="text-xs text-muted">
          {isVi ? 'Tùy chỉnh thông báo đẩy trên thiết bị của bạn' : 'Customize push notifications on your device'}
        </p>
      </CardHeader>
      <CardBody className="space-y-4">
        {error && (
          <div className="flex items-center gap-2 rounded-lg border border-amber-500/30 bg-amber-500/10 p-3 text-sm text-amber-300">
            <AlertCircle size={16} aria-hidden="true" />
            {error}
          </div>
        )}

        <div className="flex items-center justify-between rounded-lg border border-border bg-[var(--aura-bg-elevated)] p-4 dark:bg-gray-800/40">
          <div className="flex items-center gap-3">
            <div className={`rounded-lg p-2 ${preferences.orderAlertsEnabled ? 'bg-[var(--aura-primary)]/10' : 'bg-muted/20'}`}>
              {preferences.orderAlertsEnabled ? <Bell size={20} className="text-[var(--aura-primary)]" aria-hidden="true" /> : <BellOff size={20} className="text-muted" aria-hidden="true" />}
            </div>
            <div>
              <p className="font-medium text-[var(--aura-chrome-bright)]">{labelFor('orderAlertsEnabled')}</p>
              <p className="text-xs text-muted">{descFor('orderAlertsEnabled')}</p>
            </div>
          </div>
          <Switch
            checked={preferences.orderAlertsEnabled}
            onCheckedChange={() => void handleToggle('orderAlertsEnabled')}
            disabled={saving || permission === 'denied'}
            aria-label={labelFor('orderAlertsEnabled')}
          />
        </div>

        <div className="flex items-center justify-between rounded-lg border border-border bg-[var(--aura-bg-elevated)] p-4 dark:bg-gray-800/40">
          <div className="flex items-center gap-3">
            <div className={`rounded-lg p-2 ${preferences.shiftRemindersEnabled ? 'bg-[var(--aura-primary)]/10' : 'bg-muted/20'}`}>
              {preferences.shiftRemindersEnabled ? <Volume2 size={20} className="text-[var(--aura-primary)]" aria-hidden="true" /> : <VolumeX size={20} className="text-muted" aria-hidden="true" />}
            </div>
            <div>
              <p className="font-medium text-[var(--aura-chrome-bright)]">{labelFor('shiftRemindersEnabled')}</p>
              <p className="text-xs text-muted">{descFor('shiftRemindersEnabled')}</p>
            </div>
          </div>
          <Switch
            checked={preferences.shiftRemindersEnabled}
            onCheckedChange={() => void handleToggle('shiftRemindersEnabled')}
            disabled={saving}
            aria-label={labelFor('shiftRemindersEnabled')}
          />
        </div>

        {savedAt && (
          <p className="text-xs text-muted">
            {isVi ? 'Đã lưu' : 'Saved'} {savedAt}
          </p>
        )}
      </CardBody>
    </Card>
  );
}
