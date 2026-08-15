import { useState, useEffect, useCallback } from 'react';
import type { PendingCheckin } from './CheckinApprove-types';
import { MOCK_CHECKINS } from './CheckinApprove-constants';
import { apiFetch } from '@/lib/api-client';

export function useCheckinApprovals() {
  const [checkins, setCheckins] = useState<PendingCheckin[]>([]);
  const [selectedCheckin, setSelectedCheckin] = useState<PendingCheckin | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [actingId, setActingId] = useState<string | null>(null);

  const fetchPendingCheckins = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const body = await apiFetch<{ checkins?: PendingCheckin[] } | PendingCheckin[]>('/api/admin/checkins');
      setCheckins(Array.isArray(body) ? body : (body.checkins || []));
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
    try {
      await apiFetch(`/api/admin/checkins/${id}/approve`, { method: 'PATCH' });
      setCheckins((prev) =>
        prev.map((c) => (c.id === id ? { ...c, status: 'approved' as const } : c))
      );
    } catch {
      // Fall through to local update
    } finally {
      setSelectedCheckin(null);
      setActingId(null);
    }
  }, []);

  const handleReject = useCallback(async (id: string) => {
    setActingId(id);
    try {
      await apiFetch(`/api/admin/checkins/${id}/reject`, { method: 'PATCH' });
      setCheckins((prev) =>
        prev.map((c) => (c.id === id ? { ...c, status: 'rejected' as const } : c))
      );
    } catch {
      // Fall through to local update
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
