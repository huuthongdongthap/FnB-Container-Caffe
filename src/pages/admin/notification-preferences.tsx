/**
 * Toggle switches for push notification preferences
 * (new order alerts, sound alerts).
 */

import { useTranslation } from 'react-i18next';
import { Card, CardHeader, CardBody } from '@/components/ui/card';
import { Bell, Volume2, VolumeX, CheckCircle2 } from 'lucide-react';
import type { PushSettings } from './notification-settings-types';

type Props = {
  settings: PushSettings;
  saving: boolean;
  saved: boolean;
  onToggle: (key: keyof Pick<PushSettings, 'autoNotifyNewOrder' | 'soundAlerts'>) => void;
};

function ToggleSwitch({
  enabled,
  disabled,
  onClick,
}: {
  enabled: boolean;
  disabled: boolean;
  onClick: () => void;
}) {
  return (
    <button
      role="switch"
      aria-checked={enabled}
      onClick={onClick}
      disabled={disabled}
      className={`
        relative h-8 w-14 rounded-full transition-colors duration-200
        ${enabled ? 'bg-[var(--aura-primary)]' : 'bg-gray-300 dark:bg-gray-600'}
      `}
    >
      <span
        className={`
          absolute top-1 inline-block h-6 w-6 rounded-full bg-white shadow transition-transform duration-200
          ${enabled ? 'translate-x-7' : 'translate-x-1'}
        `}
      />
    </button>
  );
}

export function NotificationPreferences({
  settings,
  saving,
  saved,
  onToggle,
}: Props) {
  const { i18n } = useTranslation();
  const isVi = i18n.language === 'vi';

  return (
    <Card>
      <CardHeader>
        <h2 className="flex items-center gap-2 text-lg font-display font-semibold text-[var(--aura-chrome-bright)]">
          <Bell size={20} aria-hidden="true" className="text-[var(--aura-forest-primary)]" />
          {isVi ? 'Cài Đặt Thông Báo' : 'Notification Preferences'}
        </h2>
      </CardHeader>
      <CardBody className="space-y-4">
        {/* Auto-notify on new order */}
        <div className="flex items-center justify-between rounded-lg border border-border bg-[var(--aura-bg-elevated)] p-4 dark:bg-gray-800/40">
          <div className="flex items-center gap-3">
            <div className={`rounded-lg p-2 ${settings.autoNotifyNewOrder ? 'bg-[var(--aura-primary)]/10' : 'bg-muted/20'}`}>
              <Bell
                size={20}
                className={settings.autoNotifyNewOrder ? 'text-[var(--aura-primary)]' : 'text-muted'}
                aria-hidden="true"
              />
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
          <ToggleSwitch
            enabled={settings.autoNotifyNewOrder}
            disabled={saving}
            onClick={() => onToggle('autoNotifyNewOrder')}
          />
        </div>

        {/* Sound alerts */}
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
          <ToggleSwitch
            enabled={settings.soundAlerts}
            disabled={saving}
            onClick={() => onToggle('soundAlerts')}
          />
        </div>

        {/* Save indicator */}
        {saved && (
          <div className="flex items-center gap-2 rounded-lg bg-green-50 p-3 text-sm text-green-800 dark:bg-green-900/20 dark:text-green-300">
            <CheckCircle2 size={16} aria-hidden="true" />
            {isVi ? 'Đã lưu cài đặt' : 'Settings saved'}
          </div>
        )}
      </CardBody>
    </Card>
  );
}
