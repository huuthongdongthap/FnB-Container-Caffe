import { useState, useEffect, useCallback } from 'react';
import type { PendingCheckin } from './CheckinApprove-types';
import { MOCK_CHECKINS } from './CheckinApprove-constants';
import { useAuthStore } from '@/hooks/stores/use-auth-store';
import { API_BASE } from '@/lib/api-client';

export function useCheckinApprovals() {
  const [checkins, setCheckins] = useState<PendingCheckin[]>([]);
  const [selectedCheckin, setSelectedCheckin] = useState<PendingCheckin | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [actingId, setActingId] = useState<string | null>(null);

  const fetchPendingCheckins = useCallback(async () => {
    const { token } = useAuthStore.getState();
    if (!token) {
      setLoading(false);
      setCheckins(MOCK_CHECKINS);
      return;
    }

    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`${API_BASE}/api/admin/checkins`, {
        headers: { Authorization: `Bearer ${token}` },
      });

      if (res.ok) {
        const body = await res.json();
        setCheckins(body.checkins || body);
      } else if (res.status === 401) {
        useAuthStore.getState().logout();
        setCheckins(MOCK_CHECKINS);
      } else {
        setCheckins(MOCK_CHECKINS);
      }
    } catch {
      setCheckins(MOCK_CHECKINS);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchPendingCheckins();
  }, [fetchPendingCheckins]);

  const handleApprove = useCallback(async (id: string) => {
    setActingId(id);
    const { token } = useAuthStore.getState();

    if (token) {
      try {
        const res = await fetch(`${API_BASE}/api/admin/checkins/${id}/approve`, {
          method: 'PATCH',
          headers: { Authorization: `Bearer ${token}` },
        });
        if (res.ok) {
          setCheckins((prev) =>
            prev.map((c) => (c.id === id ? { ...c, status: 'approved' as const } : c))
          );
          setSelectedCheckin(null);
          setActingId(null);
          return;
        }
      } catch {
        // Fall through to local update
      }
    }

    setCheckins((prev) =>
      prev.map((c) => (c.id === id ? { ...c, status: 'approved' as const } : c))
    );
    setSelectedCheckin(null);
    setActingId(null);
  }, []);

  const handleReject = useCallback(async (id: string) => {
    setActingId(id);
    const { token } = useAuthStore.getState();

    if (token) {
      try {
        const res = await fetch(`${API_BASE}/api/admin/checkins/${id}/reject`, {
          method: 'PATCH',
          headers: { Authorization: `Bearer ${token}` },
        });
        if (res.ok) {
          setCheckins((prev) =>
            prev.map((c) => (c.id === id ? { ...c, status: 'rejected' as const } : c))
          );
          setSelectedCheckin(null);
          setActingId(null);
          return;
        }
      } catch {
        // Fall through to local update
      }
    }

    setCheckins((prev) =>
      prev.map((c) => (c.id === id ? { ...c, status: 'rejected' as const } : c))
    );
    setSelectedCheckin(null);
    setActingId(null);
  }, []);

  const pendingCheckins = checkins.filter((c) => c.status === 'pending');
  const completedCheckins = checkins.filter((c) => c.status !== 'pending');

  return {
    checkins,
    selectedCheckin,
    setSelectedCheckin,
    loading,
    error,
    actingId,
    pendingCheckins,
    completedCheckins,
    fetchPendingCheckins,
    handleApprove,
    handleReject,
  };
}
