import { useState, useEffect, useCallback } from 'react';
import { useAuthStore } from '@/hooks/stores/use-auth-store';
import { API_BASE } from '@/lib/api-client';


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

export interface OrderSummary {
  id: string;
  customer_name: string;
  items: string;
  total: number;
  status: string;
  payment_method: string;
  created_at: string;
}

interface ProfileUpdate {
  name?: string;
  phone?: string;
}

export function useAccount() {
  const token = useAuthStore((s) => s.token);
  const [profile, setProfile] = useState<CustomerProfile | null>(null);
  const [orders, setOrders] = useState<OrderSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [ordersLoading, setOrdersLoading] = useState(true);
  const [ordersError, setOrdersError] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [updateLoading, setUpdateLoading] = useState(false);

  const fetchProfile = useCallback(async () => {
    if (!token) { setLoading(false); return; }
    try {
      const res = await fetch(`${API_BASE}/api/customers/me`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const body = await res.json();
      if (body.success) setProfile(body.data);
      else setError(body.error || 'Không thể tải thông tin');
    } catch {
      setError('Lỗi kết nối');
    } finally {
      setLoading(false);
    }
  }, [token]);

  const fetchOrders = useCallback(async () => {
    if (!token) { setOrdersLoading(false); return; }
    setOrdersError(null);
    try {
      const res = await fetch(`${API_BASE}/api/orders/my-orders`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const body = await res.json();
      if (body.success) setOrders(body.data || []);
      else setOrdersError(body.error || 'Không thể tải đơn hàng');
    } catch {
      setOrdersError('Lỗi kết nối mạng');
    } finally {
      setOrdersLoading(false);
    }
  }, [token]);

  const updateProfile = useCallback(async (data: ProfileUpdate): Promise<boolean> => {
    if (!token) return false;
    setUpdateLoading(true);
    try {
      const res = await fetch(`${API_BASE}/api/customers/me`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify(data),
      });
      const body = await res.json();
      if (body.success) {
        setProfile(body.data);
        return true;
      }
      return false;
    } catch {
      return false;
    } finally {
      setUpdateLoading(false);
    }
  }, [token]);

  useEffect(() => { fetchProfile(); }, [fetchProfile]);
  useEffect(() => { fetchOrders(); }, [fetchOrders]);

  return {
    profile, orders, loading, ordersLoading, ordersError, error, updateLoading,
    refetchProfile: fetchProfile, refetchOrders: fetchOrders, updateProfile,
  };
}
