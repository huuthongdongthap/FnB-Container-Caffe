/**
 * NotificationSettings — Admin push notification settings
 * Manage staff push subscriptions and notification preferences.
 * Dark theme, bilingual VN/EN.
 */

import { useState, useEffect, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { HelmetHead } from '@/components/seo/HelmetHead';
import { Card, CardHeader, CardBody, CardFooter } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Modal } from '@/components/ui/modal';
import { apiFetch } from '@/lib/api-client';
import {
  Bell,
  Send,
  Plus,
  Trash2,
  CheckCircle2,
  XCircle,
  AlertCircle,
  Volume2,
  VolumeX,
  RefreshCw,
  UserCog,
  Wifi,
  WifiOff,
} from 'lucide-react';

/* ── Types ─────────────────────────────────────────────── */

interface StaffSubscription {
  name: string;
  role: 'owner' | 'staff' | 'all';
  endpoint: string;
  subscribed: boolean;
  createdAt?: string;
}

interface PushSettings {
  autoNotifyNewOrder: boolean;
  soundAlerts: boolean;
}

/* ── Constants ─────────────────────────────────────────── */

const ROLE_OPTIONS: { value: StaffSubscription['role']; labelVn: string; labelEn: string }[] = [
  { value: 'owner', labelVn: 'Chủ cửa hàng', labelEn: 'Owner' },
  { value: 'staff', labelVn: 'Nhân viên', labelEn: 'Staff' },
  { value: 'all', labelVn: 'Tất cả', labelEn: 'All' },
];

/* ── Component ─────────────────────────────────────────── */

export default function NotificationSettingsPage() {
  const { t, i18n } = useTranslation();
  const isVi = i18n.language === 'vi';

  // ── Staff subscriptions ──
  const [subscriptions, setSubscriptions] = useState<StaffSubscription[]>([]);
  const [loading, setLoading] = useState(true);
  const [fetchError, setFetchError] = useState<string | null>(null);
  const [testSending, setTestSending] = useState<string | null>(null);
  const [testResults, setTestResults] = useState<Record<string, { ok: boolean; msg: string }>>({});

  // ── Add subscription form ──
  const [showAddForm, setShowAddForm] = useState(false);
  const [newName, setNewName] = useState('');
  const [newRole, setNewRole] = useState<StaffSubscription['role']>('staff');
  const [adding, setAdding] = useState(false);

  // ── Settings ──
  const [settings, setSettings] = useState<PushSettings>({
    autoNotifyNewOrder: false,
    soundAlerts: false,
  });
  const [savingSettings, setSavingSettings] = useState(false);
  const [settingsSaved, setSettingsSaved] = useState(false);

  /* ── Fetch subscriptions ── */

  const fetchSubscriptions = useCallback(async () => {
    setLoading(true);
    setFetchError(null);
    try {
      // Use send-staff endpoint with role=all to enumerate subscribers
      const resp = await apiFetch<{ success: boolean; subscriptions?: StaffSubscription[] }>(
        '/api/push/list-subscriptions',
        { method: 'GET' },
      );
      if (resp.success && resp.subscriptions) {
        setSubscriptions(resp.subscriptions);
      } else {
        setSubscriptions([]);
      }
    } catch (err) {
      setFetchError(err instanceof Error ? err.message : 'Fetch failed');
      setSubscriptions([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void fetchSubscriptions();
  }, [fetchSubscriptions]);

  /* ── Fetch settings ── */

  useEffect(() => {
    void (async () => {
      try {
        const resp = await apiFetch<PushSettings>('/api/admin/notification-settings');
        if (resp) setSettings(resp);
      } catch {
        // Use defaults on failure
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  /* ── Handlers ── */

  const handleAddSubscription = async () => {
    if (!newName.trim()) return;
    setAdding(true);
    try {
      const resp = await apiFetch<{ success: boolean; message?: string }>(
        '/api/push/subscribe',
        {
          method: 'POST',
          body: JSON.stringify({ name: newName.trim(), role: newRole }),
        },
      );
      if (resp.success) {
        setSubscriptions((prev) => [
          ...prev,
          { name: newName.trim(), role: newRole, endpoint: '', subscribed: true },
        ]);
        setNewName('');
        setNewRole('staff');
        setShowAddForm(false);
      }
    } catch {
      // Silently fail inline
    } finally {
      setAdding(false);
    }
  };

  const handleRemove = async (name: string) => {
    try {
      await apiFetch(
        '/api/push/subscribe',
        {
          method: 'DELETE',
          body: JSON.stringify({ name }),
        },
      );
      setSubscriptions((prev) => prev.filter((s) => s.name !== name));
    } catch {
      // noop
    }
  };

  const handleTestSend = async (name: string, role: StaffSubscription['role']) => {
    setTestSending(name);
    setTestResults((prev) => ({ ...prev, [name]: { ok: false, msg: t('notificationSettings.testing') || 'Testing...' } }));
    try {
      const resp = await apiFetch<{ success: boolean; message?: string }>(
        '/api/push/send-staff',
        {
          method: 'POST',
          body: JSON.stringify({ targetRole: role, name }),
        },
      );
      if (resp.success) {
        setTestResults((prev) => ({
          ...prev,
          [name]: { ok: true, msg: isVi ? 'Đã gửi thử' : 'Sent' },
        }));
      } else {
        setTestResults((prev) => ({
          ...prev,
          [name]: { ok: false, msg: resp.message || (isVi ? 'Gửi thất bại' : 'Send failed') },
        }));
      }
    } catch (err) {
      setTestResults((prev) => ({
        ...prev,
        [name]: { ok: false, msg: err instanceof Error ? err.message : (isVi ? 'Lỗi' : 'Error') },
      }));
    } finally {
      setTestSending(null);
    }
  };

  const handleToggleSetting = async (key: keyof Pick<PushSettings, 'autoNotifyNewOrder' | 'soundAlerts'>) => {
    const next = { ...settings, [key]: !settings[key] };
    setSettings(next);
    setSavingSettings(true);
    setSettingsSaved(false);
    try {
      await apiFetch('/api/admin/notification-settings', {
        method: 'PATCH',
        body: JSON.stringify({ [key]: next[key] }),
      });
      setSettingsSaved(true);
      setTimeout(() => setSettingsSaved(false), 2000);
    } catch {
      // Revert on failure
      setSettings((prev) => ({ ...prev, [key]: !prev[key] }));
    } finally {
      setSavingSettings(false);
    }
  };

  /* ── Helpers ── */

  const roleLabel = (r: StaffSubscription['role']) =>
    isVi
      ? ROLE_OPTIONS.find((o) => o.value === r)?.labelVn ?? r
      : ROLE_OPTIONS.find((o) => o.value === r)?.labelEn ?? r;

  const activeCount = subscriptions.filter((s) => s.subscribed).length;

  /* ── Render ── */

  return (
    <>
      <HelmetHead
        title={
          isVi
            ? 'Cài Đặt Thông Báo Push — AURA SPACE'
            : 'Push Notification Settings — AURA SPACE'
        }
        description={
          isVi
            ? 'Quản lý đăng ký thông báo push cho nhân viên'
            : 'Manage staff push notification subscriptions'
        }
      />

      <div className="min-h-screen bg-background p-4 lg:p-6 dark:bg-gray-950">
        <div className="mx-auto space-y-6">
          {/* ── Page header ── */}
          <div className="flex flex-col gap-1 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <h1 className="flex items-center gap-2 text-2xl font-display font-bold text-[var(--aura-chrome-bright)]">
                <Bell size={26} aria-hidden="true" className="text-[var(--aura-primary)]" />
                {isVi ? 'Thông Báo Push' : 'Push Notifications'}
              </h1>
              <p className="mt-1 text-sm text-muted">
                {isVi
                  ? 'Quản lý đăng ký thông báo cho nhân viên và tùy chọn thông báo'
                  : 'Manage staff notification subscriptions and notification preferences'}
              </p>
            </div>
            <span className="text-sm text-muted">
              {isVi ? 'Đang hoạt động' : 'Active'}: <strong className="text-[var(--aura-forest-primary)]">{activeCount}</strong> / {subscriptions.length}
            </span>
          </div>

          {/* ── Error banner ── */}
          {fetchError && (
            <div className="rounded-lg border border-red-500/30 bg-red-50 p-3 text-sm text-red-800 dark:bg-red-900/20 dark:text-red-300">
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <AlertCircle size={16} aria-hidden="true" />
                  <span>{fetchError}</span>
                </div>
                <Button size="sm" variant="ghost" onClick={fetchSubscriptions}>
                  <RefreshCw size={14} className="mr-1" aria-hidden="true" />
                  {isVi ? 'Thử lại' : 'Retry'}
                </Button>
              </div>
            </div>
          )}

          {/* ════════════════════════════════════════════════════
              SECTION 1 — Staff Subscription Management
          ════════════════════════════════════════════════════ */}

          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <h2 className="flex items-center gap-2 text-lg font-display font-semibold text-[var(--aura-chrome-bright)]">
                  <UserCog size={20} aria-hidden="true" className="text-[var(--aura-primary)]" />
                  {isVi ? 'Đăng Ký Nhân Viên' : 'Staff Subscriptions'}
                </h2>
                <Button size="sm" onClick={() => setShowAddForm(true)}>
                  <Plus size={16} className="mr-1" aria-hidden="true" />
                  {isVi ? 'Thêm' : 'Add'}
                </Button>
              </div>
            </CardHeader>
            <CardBody>
              {/* ── Add subscription inline form ── */}
              {showAddForm && (
                <div className="mb-4 rounded-lg border border-border bg-[var(--aura-bg-elevated)] p-4 dark:bg-gray-800/50">
                  <p className="mb-3 text-sm font-medium text-[var(--aura-chrome-bright)]">
                    {isVi ? 'Đăng ký nhân viên mới' : 'Register new staff member'}
                  </p>
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
                    <div className="flex-1">
                      <label className="mb-1 block text-xs font-medium text-muted">
                        {isVi ? 'Tên nhân viên' : 'Staff name'}
                      </label>
                      <Input
                        value={newName}
                        onChange={(e) => setNewName(e.target.value)}
                        placeholder={isVi ? 'Nhập tên...' : 'Enter name...'}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') void handleAddSubscription();
                        }}
                      />
                    </div>
                    <div className="w-full sm:w-48">
                      <label className="mb-1 block text-xs font-medium text-muted">
                        {isVi ? 'Vai trò' : 'Role'}
                      </label>
                      <select
                        value={newRole}
                        onChange={(e) => setNewRole(e.target.value as StaffSubscription['role'])}
                        className="h-10 w-full rounded-lg border border-border bg-white px-3 text-sm text-foreground focus:border-transparent focus:outline-none focus:ring-2 focus:ring-accent dark:bg-gray-800"
                      >
                        {ROLE_OPTIONS.map((o) => (
                          <option key={o.value} value={o.value}>
                            {isVi ? o.labelVn : o.labelEn}
                          </option>
                        ))}
                      </select>
                    </div>
                    <div className="flex gap-2">
                      <Button size="sm" onClick={handleAddSubscription} disabled={!newName.trim() || adding}>
                        {adding ? (isVi ? 'Đang thêm...' : 'Adding...') : (isVi ? 'Đăng ký' : 'Subscribe')}
                      </Button>
                      <Button size="sm" variant="secondary" onClick={() => setShowAddForm(false)}>
                        {isVi ? 'Hủy' : 'Cancel'}
                      </Button>
                    </div>
                  </div>
                </div>
              )}

              {/* ── Table ── */}
              {loading ? (
                <div className="space-y-3">
                  {[0, 1, 2].map((i) => (
                    <div key={i} className="h-14 animate-pulse rounded-lg bg-muted/30" />
                  ))}
                </div>
              ) : subscriptions.length === 0 ? (
                <div className="flex flex-col items-center gap-3 py-10 text-center">
                  <Bell size={40} className="text-muted" aria-hidden="true" />
                  <p className="text-sm text-muted">
                    {isVi ? 'Chưa có đăng ký nào' : 'No subscriptions yet'}
                  </p>
                  <Button size="sm" onClick={() => setShowAddForm(true)}>
                    <Plus size={16} className="mr-1" aria-hidden="true" />
                    {isVi ? 'Thêm nhân viên' : 'Add staff'}
                  </Button>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-sm">
                    <thead>
                      <tr className="border-b border-border text-xs uppercase text-muted">
                        <th className="pb-2 pr-4 font-medium">{isVi ? 'Tên' : 'Name'}</th>
                        <th className="pb-2 pr-4 font-medium">{isVi ? 'Vai trò' : 'Role'}</th>
                        <th className="pb-2 pr-4 font-medium">{isVi ? 'Trạng thái' : 'Status'}</th>
                        <th className="pb-2 pr-4 font-medium">{isVi ? 'Endpoint' : 'Endpoint'}</th>
                        <th className="pb-2 pl-4 text-right font-medium">{isVi ? 'Thao tác' : 'Actions'}</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border/50">
                      {subscriptions.map((sub) => (
                        <tr key={sub.name}>
                          <td className="py-3 pr-4">
                            <span className="font-medium text-[var(--aura-chrome-bright)]">
                              {sub.name}
                            </span>
                          </td>
                          <td className="py-3 pr-4">
                            <span className="inline-flex rounded-full bg-[var(--aura-primary)]/10 px-2.5 py-0.5 text-xs font-medium text-[var(--aura-primary)]">
                              {roleLabel(sub.role)}
                            </span>
                          </td>
                          <td className="py-3 pr-4">
                            {sub.subscribed ? (
                              <span className="inline-flex items-center gap-1 text-xs text-green-600 dark:text-green-400">
                                <Wifi size={14} aria-hidden="true" />
                                {isVi ? 'Đã kết nối' : 'Active'}
                              </span>
                            ) : (
                              <span className="inline-flex items-center gap-1 text-xs text-amber-600 dark:text-amber-400">
                                <WifiOff size={14} aria-hidden="true" />
                                {isVi ? 'Chưa kết nối' : 'Inactive'}
                              </span>
                            )}
                          </td>
                          <td className="py-3 pr-4">
                            <span className="text-muted">
                              {sub.endpoint
                                ? sub.endpoint.length > 40
                                  ? sub.endpoint.slice(0, 40) + '...'
                                  : sub.endpoint
                                : (isVi ? 'Không có' : 'None')}
                            </span>
                          </td>
                          <td className="py-3 pl-4">
                            <div className="flex items-center justify-end gap-1">
                              <Button
                                size="sm"
                                variant="ghost"
                                onClick={() => handleTestSend(sub.name, sub.role)}
                                disabled={testSending === sub.name}
                                aria-label={isVi ? 'Gửi thử' : 'Test send'}
                              >
                                {testSending === sub.name ? (
                                  <RefreshCw size={16} className="animate-spin" aria-hidden="true" />
                                ) : (
                                  <Send size={16} aria-hidden="true" />
                                )}
                              </Button>
                              <Button
                                size="sm"
                                variant="ghost"
                                onClick={() => handleRemove(sub.name)}
                                aria-label={isVi ? 'Xóa' : 'Remove'}
                                className="text-red-400 hover:text-red-300"
                              >
                                <Trash2 size={16} aria-hidden="true" />
                              </Button>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}

              {/* ── Test results ── */}
              {Object.keys(testResults).length > 0 && (
                <div className="mt-3 space-y-1">
                  {Object.entries(testResults)
                    .filter(([, r]) => Object.keys(testResults).length > 0)
                    .map(([name, res]) => (
                      <div
                        key={name}
                        className={`inline-flex items-center gap-2 rounded-lg px-3 py-1.5 text-xs ${
                          res.ok
                            ? 'bg-green-50 text-green-800 dark:bg-green-900/20 dark:text-green-300'
                            : 'bg-red-50 text-red-800 dark:bg-red-900/20 dark:text-red-300'
                        }`}
                      >
                        {res.ok ? (
                          <CheckCircle2 size={14} aria-hidden="true" />
                        ) : (
                          <XCircle size={14} aria-hidden="true" />
                        )}
                        <span className="font-medium">{name}</span>
                        <span>— {res.msg}</span>
                      </div>
                    ))}
                </div>
              )}
            </CardBody>
            <CardFooter>
              <p className="text-xs text-muted">
                {isVi
                  ? 'API endpoint: POST /api/push/subscribe, POST /api/push/send-staff'
                  : 'API endpoints: POST /api/push/subscribe, POST /api/push/send-staff'}
              </p>
            </CardFooter>
          </Card>

          {/* ════════════════════════════════════════════════════
              SECTION 2 — Notification Settings
          ════════════════════════════════════════════════════ */}

          <Card>
            <CardHeader>
              <h2 className="flex items-center gap-2 text-lg font-display font-semibold text-[var(--aura-chrome-bright)]">
                <Bell size={20} aria-hidden="true" className="text-[var(--aura-forest-primary)]" />
                {isVi ? 'Cài Đặt Thông Báo' : 'Notification Preferences'}
              </h2>
            </CardHeader>
            <CardBody className="space-y-4">
              {/* ── Auto-notify on new order ── */}
              <div className="flex items-center justify-between rounded-lg border border-border bg-[var(--aura-bg-elevated)] p-4 dark:bg-gray-800/40">
                <div className="flex items-center gap-3">
                  <div className={`rounded-lg p-2 ${settings.autoNotifyNewOrder ? 'bg-[var(--aura-primary)]/10' : 'bg-muted/20'}`}>
                    <Bell size={20} className={settings.autoNotifyNewOrder ? 'text-[var(--aura-primary)]' : 'text-muted'} aria-hidden="true" />
                  </div>
                  <div>
                    <p className="font-medium text-[var(--aura-chrome-bright)]">
                      {isVi ? 'Thông báo đơn hàng mới' : 'New order notifications'}
                    </p>
                    <p className="text-xs text-muted">
                      {isVi
                        ? 'Gửi thông báo push khi có đơn hàng mới'
                        : 'Send push notification when a new order is placed'}
                    </p>
                  </div>
                </div>
                <button
                  role="switch"
                  aria-checked={settings.autoNotifyNewOrder}
                  onClick={() => handleToggleSetting('autoNotifyNewOrder')}
                  disabled={savingSettings}
                  className={`
                    relative h-8 w-14 rounded-full transition-colors duration-200
                    ${settings.autoNotifyNewOrder ? 'bg-[var(--aura-primary)]' : 'bg-gray-300 dark:bg-gray-600'}
                  `}
                >
                  <span
                    className={`
                      absolute top-1 inline-block h-6 w-6 rounded-full bg-white shadow transition-transform duration-200
                      ${settings.autoNotifyNewOrder ? 'translate-x-7' : 'translate-x-1'}
                    `}
                  />
                </button>
              </div>

              {/* ── Sound alerts ── */}
              <div className="flex items-center justify-between rounded-lg border border-border bg-[var(--aura-bg-elevated)] p-4 dark:bg-gray-800/40">
                <div className="flex items-center gap-3">
                  <div className={`rounded-lg p-2 ${settings.soundAlerts ? 'bg-[var(--aura-primary)]/10' : 'bg-muted/20'}`}>
                    {settings.soundAlerts ? (
                      <Volume2 size={20} className="text-[var(--aura-primary)]" aria-hidden="true" />
                    ) : (
                      <VolumeX size={20} className="text-muted" aria-hidden="true" />
                    )}
                  </div>
                  <div>
                    <p className="font-medium text-[var(--aura-chrome-bright)]">
                      {isVi ? 'Âm thanh cảnh báo' : 'Sound alerts'}
                    </p>
                    <p className="text-xs text-muted">
                      {isVi
                        ? 'Phát âm thanh khi nhận thông báo'
                        : 'Play sound when a notification arrives'}
                    </p>
                  </div>
                </div>
                <button
                  role="switch"
                  aria-checked={settings.soundAlerts}
                  onClick={() => handleToggleSetting('soundAlerts')}
                  disabled={savingSettings}
                  className={`
                    relative h-8 w-14 rounded-full transition-colors duration-200
                    ${settings.soundAlerts ? 'bg-[var(--aura-primary)]' : 'bg-gray-300 dark:bg-gray-600'}
                  `}
                >
                  <span
                    className={`
                      absolute top-1 inline-block h-6 w-6 rounded-full bg-white shadow transition-transform duration-200
                      ${settings.soundAlerts ? 'translate-x-7' : 'translate-x-1'}
                    `}
                  />
                </button>
              </div>

              {/* ── Save indicator ── */}
              {settingsSaved && (
                <div className="flex items-center gap-2 rounded-lg bg-green-50 p-3 text-sm text-green-800 dark:bg-green-900/20 dark:text-green-300">
                  <CheckCircle2 size={16} aria-hidden="true" />
                  {isVi ? 'Đã lưu cài đặt' : 'Settings saved'}
                </div>
              )}
            </CardBody>
          </Card>
        </div>
      </div>
    </>
  );
}
