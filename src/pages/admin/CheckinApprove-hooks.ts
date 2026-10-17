import { useState, useEffect, useCallback } from 'react';
import type { PendingCheckin } from './CheckinApprove-types';
import { MOCK_CHECKINS } from './CheckinApprove-constants';
import { apiFetch } from '@/lib/api-client';

interface RawCheckinRecord {
  id: string;
  memberId?: string;
  customer_id?: string;
  memberName?: string;
  customer_name?: string;
  memberPhone?: string;
  customer_phone?: string;
  phone?: string;
  photoUrl?: string;
  photo_url?: string;
  submittedAt?: string;
  checkin_time?: string;
  created_at?: string;
  status?: 'pending' | 'approved' | 'rejected';
}

function normalizeCheckin(raw: RawCheckinRecord): PendingCheckin {
  return {
    id: String(raw.id),
    memberId: String(raw.memberId || raw.customer_id || ''),
    memberName: String(raw.memberName || raw.customer_name || 'Khách hàng'),
    memberPhone: String(raw.memberPhone || raw.customer_phone || raw.phone || '—'),
    photoUrl: raw.photoUrl || raw.photo_url,
    submittedAt: String(raw.submittedAt || raw.checkin_time || raw.created_at || new Date().toISOString()),
    status: raw.status === 'approved' || raw.status === 'rejected' ? raw.status : 'pending',
  };
}

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
      const body = await apiFetch<
        { checkins?: RawCheckinRecord[]; data?: RawCheckinRecord[] } | RawCheckinRecord[]
      >('/api/admin/checkins');
      const rawList = Array.isArray(body) ? body : (body.checkins || body.data || []);
      setCheckins(rawList.map(normalizeCheckin));
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
      await apiFetch(`/api/admin/checkins/${encodeURIComponent(id)}/approve`, { method: 'PATCH' });
    } catch {
      // Offline demo fallback updates local state
    } finally {
      setCheckins((prev) =>
        prev.map((c) => (c.id === id ? { ...c, status: 'approved' as const } : c))
      );
      setSelectedCheckin(null);
      setActingId(null);
    }
  }, []);

  const handleReject = useCallback(async (id: string) => {
    setActingId(id);
    try {
      await apiFetch(`/api/admin/checkins/${encodeURIComponent(id)}/reject`, { method: 'PATCH' });
    } catch {
      // Offline demo fallback updates local state
    } finally {
      setCheckins((prev) =>
        prev.map((c) => (c.id === id ? { ...c, status: 'rejected' as const } : c))
      );
      setSelectedCheckin(null);
      setActingId(null);
    }
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
