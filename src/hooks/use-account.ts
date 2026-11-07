import { useState, useEffect, useCallback } from 'react';
import { useAuthStore } from '@/hooks/stores/use-auth-store';
import { apiFetch } from '@/lib/api-client';
import { isSameSessionSnapshot, readSessionSnapshot, useClientSessionScope } from '@/lib/client-session';
import type { CustomerOrder } from '@/hooks/stores/order-store-types';

export interface CustomerProfile {
  id: string;
  name: string;
  phone: string;
  email: string;
  loyalty_tier: string;
  loyalty_points: number;
  lifetime_points: number;
  cashback_balance: number;
  total_spent: number;
  total_earned: number;
  visit_count: number;
  created_at: string;
}

/* Canonical customer-facing order projection from GET /api/orders.
   See worker/src/schemas/orders.ts (CustomerOrderResponseSchema). */
export type OrderSummary = CustomerOrder;

interface OrdersListResponse {
  success?: boolean;
  orders?: CustomerOrder[];
  data?: { orders?: CustomerOrder[]; meta?: { page: number; limit: number; total: number; totalPages: number } };
  error?: string;
  message?: string;
}

interface ProfileUpdate {
  name?: string;
  phone?: string;
}

export function useAccount() {
  const user = useAuthStore((s) => s.user);
  const session = useClientSessionScope();
  const [profile, setProfile] = useState<CustomerProfile | null>(null);
  const [orders, setOrders] = useState<OrderSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [ordersLoading, setOrdersLoading] = useState(true);
  const [ordersError, setOrdersError] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [updateLoading, setUpdateLoading] = useState(false);

  useEffect(() => {
    setProfile(null);
    setOrders([]);
    setError(null);
    setOrdersError(null);
  }, [user?.id, session.tenantId, session.userScope]);

  const fetchProfile = useCallback(async () => {
    if (!user) {
      setProfile(null);
      setError(null);
      setLoading(false);
      return;
    }
    const snap = readSessionSnapshot();
    try {
      const profileData = await apiFetch<{ success: boolean; data: CustomerProfile; error?: string; message?: string }>('/api/customers/me');
      if (useAuthStore.getState().user?.id !== user.id || !isSameSessionSnapshot(snap, readSessionSnapshot())) return;
      if (profileData.success) setProfile(profileData.data);
      else setError(profileData.error || profileData.message || 'Không thể tải thông tin');
    } catch {
      if (useAuthStore.getState().user?.id !== user.id || !isSameSessionSnapshot(snap, readSessionSnapshot())) return;
      setError('Lỗi kết nối');
    } finally {
      if (useAuthStore.getState().user?.id === user.id && isSameSessionSnapshot(snap, readSessionSnapshot())) {
        setLoading(false);
      }
    }
  }, [user, session.tenantId, session.userScope]);

  const fetchOrders = useCallback(async () => {
    if (!user) {
      setOrders([]);
      setOrdersError(null);
      setOrdersLoading(false);
      return;
    }
    const snap = readSessionSnapshot();
    setOrdersError(null);
    try {
      const ordersData = await apiFetch<OrdersListResponse>('/api/orders?limit=50&sort=created_at&order=desc');
      if (useAuthStore.getState().user?.id !== user.id || !isSameSessionSnapshot(snap, readSessionSnapshot())) return;
      const resolvedOrders = Array.isArray(ordersData.data?.orders)
        ? ordersData.data.orders
        : Array.isArray(ordersData.orders)
          ? ordersData.orders
          : null;
      if (ordersData.success || resolvedOrders !== null) {
        setOrders(resolvedOrders ?? []);
      } else {
        setOrdersError(ordersData.error || ordersData.message || 'Không thể tải đơn hàng');
      }
    } catch {
      if (useAuthStore.getState().user?.id !== user.id || !isSameSessionSnapshot(snap, readSessionSnapshot())) return;
      setOrdersError('Lỗi kết nối mạng');
    } finally {
      if (useAuthStore.getState().user?.id === user.id && isSameSessionSnapshot(snap, readSessionSnapshot())) {
        setOrdersLoading(false);
      }
    }
  }, [user, session.tenantId, session.userScope]);

  const updateProfile = useCallback(async (data: ProfileUpdate): Promise<boolean> => {
    if (!user) return false;
    const snap = readSessionSnapshot();
    setUpdateLoading(true);
    try {
      const profileData = await apiFetch<{ success: boolean; data: CustomerProfile }>('/api/customers/me', {
        method: 'PATCH',
        body: JSON.stringify(data),
      });
      if (useAuthStore.getState().user?.id !== user.id || !isSameSessionSnapshot(snap, readSessionSnapshot())) {
        return false;
      }
      if (profileData.success) {
        setProfile(profileData.data);
        return true;
      }
      return false;
    } catch {
      return false;
    } finally {
      setUpdateLoading(false);
    }
  }, [user, session.tenantId, session.userScope]);

  useEffect(() => { fetchProfile(); }, [fetchProfile]);
  useEffect(() => { fetchOrders(); }, [fetchOrders]);

  return {
    profile, orders, loading, ordersLoading, ordersError, error, updateLoading,
    refetchProfile: fetchProfile, refetchOrders: fetchOrders, updateProfile,
  };
}
