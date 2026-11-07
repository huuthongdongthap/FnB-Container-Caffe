import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiFetch } from '@/lib/api-client';
import { useClientSessionScope } from '@/lib/client-session';

// ── Types ────────────────────────────────────────────────────────────

export interface Plan {
  id: string;
  name: string;
  slug: string;
  description: string;
  container_size: string;
  monthly_price_vnd: number;
  deposit_vnd: number;
  features: string[];
  max_occupants: number;
  is_popular: number;
  is_active: number;
  sort_order: number;
}

export interface Subscription {
  id: string;
  plan_id: string;
  customer_id: string | null;
  customer_name: string;
  customer_email: string;
  customer_phone: string;
  container_number: string | null;
  zone: string;
  status: string;
  billing_cycle: string;
  current_period_start: string;
  current_period_end: string;
  next_billing_date: string;
  amount_vnd: number;
  deposit_paid: number;
  deposit_vnd: number;
  notes: string;
  cancelled_at: string | null;
  cancellation_reason: string | null;
  paused_at: string | null;
  plan_name?: string;
  plan_slug?: string;
  container_size?: string;
  plan_price?: number;
  plan_features?: string[];
  features?: string[];
}

interface ApiListResponse<T> {
  success: boolean;
  data: T[];
}

interface ApiSingleResponse<T> {
  success: boolean;
  data: T;
}

export interface Invoice {
  id: string;
  subscription_id: string;
  invoice_number: string;
  period_start: string;
  period_end: string;
  amount_vnd: number;
  status: string;
  paid_at: string | null;
  payment_method: string | null;
  receipt_url: string | null;
}

// ── Invoices ──────────────────────────────────────────────────────────

export function useMyInvoices() {
  const session = useClientSessionScope();
  return useQuery<Invoice[]>({
    queryKey: ['my-invoices', session.tenantId, session.userScope],
    queryFn: async () => {
      try {
        const res = await apiFetch<ApiListResponse<Invoice>>('/api/subscriptions/invoices/list');
        return res.data;
      } catch {
        const res = await apiFetch<ApiListResponse<Invoice>>('/api/subscriptions/invoices');
        return res.data;
      }
    },
    staleTime: 30_000,
    retry: false,
  });
}

export interface CreateSubscriptionInput {
  plan_id: string;
  customer_name: string;
  customer_email: string;
  customer_phone: string;
  container_number?: string;
  zone?: string;
  billing_cycle?: string;
  amount_vnd?: number;
  notes?: string;
}

// ── Queries ──────────────────────────────────────────────────────────

export function usePlans() {
  const session = useClientSessionScope();
  return useQuery<Plan[]>({
    queryKey: ['subscription-plans', session.tenantId],
    queryFn: async () => {
      const res = await apiFetch<ApiListResponse<Plan>>('/api/subscriptions/plans');
      return res.data;
    },
    staleTime: 60_000,
  });
}

export function useMySubscriptions() {
  const session = useClientSessionScope();
  return useQuery<Subscription[]>({
    queryKey: ['my-subscriptions', session.tenantId, session.userScope],
    queryFn: async () => {
      const res = await apiFetch<ApiListResponse<Subscription>>('/api/subscriptions');
      return res.data;
    },
    staleTime: 30_000,
    retry: false,
  });
}

export function useMyActiveSubscription() {
  const { data: subs, ...rest } = useMySubscriptions();
  const active = (subs || []).find(
    (s) => s.status === 'active' || s.status === 'paused',
  );
  return { data: active || null, ...rest };
}

// ── Mutations ────────────────────────────────────────────────────────

export function useSubscribe() {
  const queryClient = useQueryClient();
  const session = useClientSessionScope();

  return useMutation({
    mutationFn: async (input: CreateSubscriptionInput) => {
      const res = await apiFetch<ApiSingleResponse<Subscription>>(
        '/api/subscriptions',
        {
          method: 'POST',
          body: JSON.stringify(input),
        },
      );
      return res.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['my-subscriptions', session.tenantId, session.userScope] });
      queryClient.invalidateQueries({ queryKey: ['subscription-plans', session.tenantId] });
    },
  });
}

export function useCancelSubscription() {
  const queryClient = useQueryClient();
  const session = useClientSessionScope();

  return useMutation({
    mutationFn: async ({ id, reason }: { id: string; reason?: string }) => {
      return apiFetch<{ success: boolean; message: string }>(
        `/api/subscriptions/${id}/cancel`,
        {
          method: 'POST',
          body: JSON.stringify({ reason: reason || '' }),
        },
      );
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['my-subscriptions', session.tenantId, session.userScope] });
    },
  });
}
