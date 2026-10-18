/**
 * Hook for managing staff push notification subscriptions.
 * Handles fetching, adding, removing, and test-sending.
 */

import { useState, useEffect, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { apiFetch } from '@/lib/api-client';
import type { StaffSubscription } from './notification-settings-types';

export function useNotificationSubscriptions() {
  const { t, i18n } = useTranslation();
  const isVi = i18n.language === 'vi';

  const [subscriptions, setSubscriptions] = useState<StaffSubscription[]>([]);
  const [loading, setLoading] = useState(true);
  const [fetchError, setFetchError] = useState<string | null>(null);
  const [testSending, setTestSending] = useState<string | null>(null);
  const [testResults, setTestResults] = useState<
    Record<string, { ok: boolean; msg: string }>
  >({});

  const fetchSubscriptions = useCallback(async () => {
    setLoading(true);
    setFetchError(null);
    try {
      const resp = await apiFetch<{
        success: boolean;
        subscriptions?: StaffSubscription[];
      }>('/api/push/list-subscriptions', { method: 'GET' });
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

  const addSubscription = async (
    name: string,
    role: StaffSubscription['role'],
  ): Promise<boolean> => {
    try {
      const trimmedName = name.trim();
      const resp = await apiFetch<{ success: boolean; message?: string }>(
        '/api/push/subscribe',
        {
          method: 'POST',
          body: JSON.stringify({ name: trimmedName, role }),
        },
      );
      if (resp.success) {
        setSubscriptions((prev) => [
          ...prev.filter((s) => s.name !== trimmedName),
          { name: trimmedName, role, endpoint: '', subscribed: true },
        ]);
        return true;
      }
      return false;
    } catch {
      return false;
    }
  };

  const removeSubscription = async (name: string) => {
    try {
      await apiFetch('/api/push/subscribe', {
        method: 'DELETE',
        body: JSON.stringify({ name }),
      });
      setSubscriptions((prev) => prev.filter((s) => s.name !== name));
    } catch {
      // noop
    }
  };

  const testSend = async (name: string, role: StaffSubscription['role']) => {
    setTestSending(name);
    setTestResults((prev) => ({
      ...prev,
      [name]: {
        ok: false,
        msg: t('notificationSettings.testing', isVi ? 'Đang gửi thử...' : 'Testing...'),
      },
    }));
    try {
      const resp = await apiFetch<{
        success: boolean;
        message?: string;
        sent?: number;
        data?: { sent?: number };
      }>(
        '/api/push/send-staff',
        {
          method: 'POST',
          body: JSON.stringify({ targetRole: role, name }),
        },
      );
      const sentCount = resp.data?.sent ?? resp.sent;
      if (resp.success && (sentCount === undefined || sentCount > 0)) {
        setTestResults((prev) => ({
          ...prev,
          [name]: { ok: true, msg: isVi ? 'Đã gửi thử' : 'Sent' },
        }));
      } else {
        setTestResults((prev) => ({
          ...prev,
          [name]: {
            ok: false,
            msg:
              resp.message ||
              (sentCount === 0
                ? isVi
                  ? 'Không có thiết bị nhận'
                  : 'No active subscribers'
                : isVi
                  ? 'Gửi thất bại'
                  : 'Send failed'),
          },
        }));
      }
    } catch (err) {
      setTestResults((prev) => ({
        ...prev,
        [name]: {
          ok: false,
          msg:
            err instanceof Error
              ? err.message
              : isVi
                ? 'Lỗi'
                : 'Error',
        },
      }));
    } finally {
      setTestSending(null);
    }
  };

  const activeCount = subscriptions.filter((s) => s.subscribed).length;

  return {
    subscriptions,
    loading,
    fetchError,
    testSending,
    testResults,
    activeCount,
    fetchSubscriptions,
    addSubscription,
    removeSubscription,
    testSend,
  };
}
