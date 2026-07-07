import { useState, useEffect, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { Bell, BellOff, Volume2, VolumeX, AlertCircle } from 'lucide-react';
import { Card, CardHeader, CardBody } from '@/components/ui/card';
import { Switch } from '@/components/ui/switch';
import { usePushNotifications } from '@/hooks/use-push-notifications';
import { API_BASE } from '@/lib/api-client';

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

/*

Do not write any .md or summary file. Include status block at the end.
*/
type ToggleKey = keyof StaffNotificationPreferences;

interface StaffNotificationPreferences {
  orderAlertsEnabled: boolean;
  shiftRemindersEnabled: boolean;
}

export function StaffNotificationSettings() {
  const { t, i18n } = useTranslation();
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
        const res = await fetch(`${API_BASE}/api/auth/me`, { credentials: 'omit' });
        if (!res.ok) return;
        const json = (await res.json().catch(() => ({}))) as { role?: string };
        if (cancelled) return;
        // Normalize: backend uses staff-kitchen / staff-cashier / staff-* prefixes
        setStaffRole(json.role ?? 'staff-kitchen');
      } catch {
        // best-effort role
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const applySubscriptions = useCallback(
    async (next: StaffNotificationPreferences) => {
      setError(null);
      const roleToUse = staffRole ?? 'staff-kitchen';
      const desiredSubscribed = next.orderAlertsEnabled || next.shiftRemindersEnabled;

      try {
        if (desiredSubscribed && !isSubscribed && permission !== 'denied') {
          const ok = await subscribe(undefined, roleToUse);
          if (!ok) throw new Error('subscribe_failed');
        } else if (!desiredSubscribed && isSubscribed) {
          await unsubscribe();
        }
      } catch (e) {
        setError(e instanceof Error ? e.message : 'Loi ket noi');
      }
    },
    [isSubscribed, permission, staffRole, subscribe, unsubscribe],
  );

  const handleToggle = useCallback(
    async (key: ToggleKey) => {
      setSaving(true);
      setSavedAt(null);
      const next = {
        ...preferences,
        [key]: !preferences[key],
      } as StaffNotificationPreferences;
      setPreferences(next);
      try {
        await applySubscriptions(next);
        await fetch(`${API_BASE}/api/staff/notification-settings`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ [key]: next[key] }),
        }).catch(() => undefined);
        setSavedAt(new Date().toLocaleTimeString());
      } catch {
        setPreferences((prev) => ({ ...prev, [key]: !(next as Record<ToggleKey, boolean>)[key] }));
        setError(isVi ? 'Khong the luu cai dat' : 'Could not save setting');
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
          <div className="flex items-center gap-2 rounded-lg border border-amber-400/40 bg-amber-50 p-3 text-sm text-amber-800 dark:bg-amber-900/20 dark:text-amber-200">
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
            disabled={saving || !supported || permission === 'denied'}
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
            disabled={saving || !supported}
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
