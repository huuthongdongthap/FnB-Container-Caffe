/**
 * Hook for managing staff push notification subscriptions.
 * Handles fetching, adding, removing, and test-sending.
 */

import { useState, useEffect, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { apiFetch } from '@/lib/api-client';
import { isSameSessionSnapshot, readSessionSnapshot, subscribeSessionChange } from '@/lib/client-session';
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
    const snap = readSessionSnapshot();
    setLoading(true);
    setFetchError(null);
    try {
      const resp = await apiFetch<{
        success: boolean;
        subscriptions?: StaffSubscription[];
      }>('/api/push/list-subscriptions', { method: 'GET' });
      if (!isSameSessionSnapshot(snap, readSessionSnapshot())) return;
      if (resp.success && resp.subscriptions) {
        setSubscriptions(resp.subscriptions);
      } else {
        setSubscriptions([]);
      }
    } catch (err) {
      if (!isSameSessionSnapshot(snap, readSessionSnapshot())) return;
      setFetchError(err instanceof Error ? err.message : 'Fetch failed');
      setSubscriptions([]);
    } finally {
      if (isSameSessionSnapshot(snap, readSessionSnapshot())) {
        setLoading(false);
      }
    }
  }, []);

  useEffect(() => {
    void fetchSubscriptions();
    return subscribeSessionChange(() => {
      setSubscriptions([]);
      setFetchError(null);
      setTestSending(null);
      setTestResults({});
      void fetchSubscriptions();
    });
  }, [fetchSubscriptions]);

  const addSubscription = async (
    name: string,
    role: StaffSubscription['role'],
  ): Promise<boolean> => {
    const snap = readSessionSnapshot();
    try {
      const trimmedName = name.trim();
      const resp = await apiFetch<{ success: boolean; message?: string }>(
        '/api/push/subscribe',
        {
          method: 'POST',
          body: JSON.stringify({ name: trimmedName, role }),
        },
      );
      if (!isSameSessionSnapshot(snap, readSessionSnapshot())) return false;
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
    const snap = readSessionSnapshot();
    try {
      await apiFetch('/api/push/subscribe', {
        method: 'DELETE',
        body: JSON.stringify({ name }),
      });
      if (!isSameSessionSnapshot(snap, readSessionSnapshot())) return;
      setSubscriptions((prev) => prev.filter((s) => s.name !== name));
    } catch {
      // noop
    }
  };

  const testSend = async (name: string, role: StaffSubscription['role']) => {
    const snap = readSessionSnapshot();
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
      if (!isSameSessionSnapshot(snap, readSessionSnapshot())) return;
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
      if (!isSameSessionSnapshot(snap, readSessionSnapshot())) return;
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
      if (isSameSessionSnapshot(snap, readSessionSnapshot())) {
        setTestSending(null);
      }
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
