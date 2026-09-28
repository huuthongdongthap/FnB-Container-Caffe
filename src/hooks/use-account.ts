import { useState, useEffect, useCallback } from 'react';
import { useAuthStore } from '@/hooks/stores/use-auth-store';
import { apiFetch } from '@/lib/api-client';
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
  success: boolean;
  data: { orders: CustomerOrder[]; meta: { page: number; limit: number; total: number; totalPages: number } };
  error?: string;
  message?: string;
}

interface ProfileUpdate {
  name?: string;
  phone?: string;
}

export function useAccount() {
  const user = useAuthStore((s) => s.user);
  const [profile, setProfile] = useState<CustomerProfile | null>(null);
  const [orders, setOrders] = useState<OrderSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [ordersLoading, setOrdersLoading] = useState(true);
  const [ordersError, setOrdersError] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [updateLoading, setUpdateLoading] = useState(false);

  const fetchProfile = useCallback(async () => {
    if (!user) { setLoading(false); return; }
    try {
      const profileData = await apiFetch<{ success: boolean; data: CustomerProfile; error?: string; message?: string }>('/api/customers/me');
      if (profileData.success) setProfile(profileData.data);
      else setError(profileData.error || profileData.message || 'Không thể tải thông tin');
    } catch {
      setError('Lỗi kết nối');
    } finally {
      setLoading(false);
    }
  }, [user]);

  const fetchOrders = useCallback(async () => {
    if (!user) { setOrdersLoading(false); return; }
    setOrdersError(null);
    try {
      const ordersData = await apiFetch<OrdersListResponse>('/api/orders?limit=50&sort=created_at&order=desc');
      if (ordersData.success) setOrders(ordersData.data?.orders || []);
      else setOrdersError(ordersData.error || ordersData.message || 'Không thể tải đơn hàng');
    } catch {
      setOrdersError('Lỗi kết nối mạng');
    } finally {
      setOrdersLoading(false);
    }
  }, [user]);

  const updateProfile = useCallback(async (data: ProfileUpdate): Promise<boolean> => {
    if (!user) return false;
    setUpdateLoading(true);
    try {
      const profileData = await apiFetch<{ success: boolean; data: CustomerProfile }>('/api/customers/me', {
        method: 'PATCH',
        body: JSON.stringify(data),
      });
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
  }, [user]);

  useEffect(() => { fetchProfile(); }, [fetchProfile]);
  useEffect(() => { fetchOrders(); }, [fetchOrders]);

  return {
    profile, orders, loading, ordersLoading, ordersError, error, updateLoading,
    refetchProfile: fetchProfile, refetchOrders: fetchOrders, updateProfile,
  };
}
