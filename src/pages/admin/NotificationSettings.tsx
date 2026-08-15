/**
 * NotificationSettings — Admin push notification settings
 * Manage staff push subscriptions and notification preferences.
 * Dark theme, bilingual VN/EN.
 */

import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { HelmetHead } from '@/components/seo/HelmetHead';
import { Button } from '@/components/ui/button';
import { Bell, AlertCircle, RefreshCw } from 'lucide-react';
import { useNotificationSubscriptions } from './use-notification-subscriptions';
import { useNotificationSettings } from './use-notification-settings';
import { SubscriptionAddForm } from './subscription-add-form';
import { SubscriptionTable } from './subscription-table';
import { SubscriptionTestResults } from './subscription-test-results';
import { NotificationPreferences } from './notification-preferences';

export default function NotificationSettingsPage() {
  const { i18n } = useTranslation();
  const isVi = i18n.language === 'vi';

  const subs = useNotificationSubscriptions();
  const prefs = useNotificationSettings();

  const [showAddForm, setShowAddForm] = useState(false);

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
          {/* Page header */}
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
              {isVi ? 'Đang hoạt động' : 'Active'}:{' '}
              <strong className="text-[var(--aura-forest-primary)]">
                {subs.activeCount}
              </strong>{' '}
              / {subs.subscriptions.length}
            </span>
          </div>

          {/* Error banner */}
          {subs.fetchError && (
            <div className="rounded-lg border border-red-500/30 bg-red-50 p-3 text-sm text-red-800 dark:bg-red-900/20 dark:text-red-300">
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <AlertCircle size={16} aria-hidden="true" />
                  <span>{subs.fetchError}</span>
                </div>
                <Button size="sm" variant="ghost" onClick={subs.fetchSubscriptions}>
                  <RefreshCw size={14} className="mr-1" aria-hidden="true" />
                  {isVi ? 'Thử lại' : 'Retry'}
                </Button>
              </div>
            </div>
          )}

          {/* Section 1: Staff Subscriptions */}
          {showAddForm && (
            <SubscriptionAddForm
              onAdd={subs.addSubscription}
              onCancel={() => setShowAddForm(false)}
            />
          )}

          <SubscriptionTable
            subscriptions={subs.subscriptions}
            loading={subs.loading}
            testSending={subs.testSending}
            onTestSend={subs.testSend}
            onRemove={subs.removeSubscription}
            onShowAddForm={() => setShowAddForm(true)}
          />

          <SubscriptionTestResults results={subs.testResults} />

          {/* Section 2: Notification Preferences */}
          <NotificationPreferences
            settings={prefs.settings}
            saving={prefs.saving}
            saved={prefs.saved}
            onToggle={prefs.toggle}
          />
        </div>
      </div>
    </>
  );
}
