import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Modal } from '@/components/ui/modal';
import { useAuthStore } from '@/hooks/stores/use-auth-store';
import { API_BASE } from '@/lib/api-client';

// ── Types ────────────────────────────────────────────────────────────

interface PlanRecord {
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
  created_at: string;
  updated_at: string;
}

interface SubscriptionRecord {
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
  created_at: string;
  plan_name?: string;
  plan_slug?: string;
  container_size?: string;
}

interface SubscriptionStats {
  mrr_vnd: number;
  arr_vnd: number;
  active_subscriptions: number;
  total_contracts: number;
  new_this_month: number;
  churned_this_month: number;
  churn_rate_pct: number;
  avg_contract_value_vnd: number;
  pending_count: number;
  by_zone: { zone: string; count: number; revenue: number }[];
  by_plan: { name: string; slug: string; count: number; revenue: number }[];
  mrr_buckets: {
    under_1m: number;
    from_1m_to_3m: number;
    from_3m_to_5m: number;
    above_5m: number;
  };
}

interface PlanFormData {
  name: string;
  slug: string;
  description: string;
  container_size: string;
  monthly_price_vnd: string;
  deposit_vnd: string;
  features: string;
  max_occupants: string;
  is_popular: boolean;
  is_active: boolean;
  sort_order: string;
}

// ── Helpers ──────────────────────────────────────────────────────────

function authHeaders(): Record<string, string> {
  const token = useAuthStore.getState().token;
  return {
    'Content-Type': 'application/json',
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
  };
}

async function apiFetch<T>(path: string, options?: RequestInit): Promise<T> {
  const res = await fetch(`${API_BASE}${path}`, {
    ...options,
    headers: { ...authHeaders(), ...(options?.headers as Record<string, string>) },
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || data.message || `Request failed: ${res.status}`);
  return data;
}

function formatCurrency(value: number): string {
  return value.toLocaleString('vi-VN');
}

function formatDate(dateStr: string | null): string {
  if (!dateStr) return '—';
  return new Date(dateStr).toLocaleDateString('vi-VN', {
    year: 'numeric', month: '2-digit', day: '2-digit',
  });
}

function statusColor(status: string): 'success' | 'warning' | 'destructive' | 'info' | 'default' {
  switch (status) {
    case 'active': return 'success';
    case 'paused': return 'warning';
    case 'cancelled': return 'destructive';
    case 'pending': return 'info';
    default: return 'default';
  }
}

function statusLabel(status: string, t: (key: string) => string): string {
  const labels: Record<string, string> = {
    active: t('statusActive'),
    paused: t('statusPaused'),
    cancelled: t('statusCancelled'),
    pending: t('statusPending'),
  };
  return labels[status] || status;
}

// ── Empty Form ───────────────────────────────────────────────────────

const EMPTY_PLAN_FORM: PlanFormData = {
  name: '',
  slug: '',
  description: '',
  container_size: '20ft',
  monthly_price_vnd: '',
  deposit_vnd: '0',
  features: '',
  max_occupants: '1',
  is_popular: false,
  is_active: true,
  sort_order: '0',
};

// ── MRR Stat Card ────────────────────────────────────────────────────

function StatCard({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <div className="rounded-xl border border-border bg-[var(--aura-bg-elevated)]/40 p-4 backdrop-blur-sm">
      <p className="text-xs font-medium uppercase tracking-wider text-muted/60">{label}</p>
      <p className="mt-1 font-display text-2xl font-bold">{value}</p>
      {sub && <p className="text-xs text-muted/40">{sub}</p>}
    </div>
  );
}

// ── Components ───────────────────────────────────────────────────────

export default function SubscriptionsManagerPage() {
  const queryClient = useQueryClient();
  const { t } = useTranslation('adminSubscriptions');

  // Modal state
  const [planModalOpen, setPlanModalOpen] = useState(false);
  const [editingPlan, setEditingPlan] = useState<PlanRecord | null>(null);
  const [form, setForm] = useState<PlanFormData>(EMPTY_PLAN_FORM);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [deletePlanId, setDeletePlanId] = useState<string | null>(null);
  const [cancelSubId, setCancelSubId] = useState<string | null>(null);
  const [cancelReason, setCancelReason] = useState('');
  const [activeTab, setActiveTab] = useState<'subscriptions' | 'plans' | 'invoices'>('subscriptions');

  // ── Queries ──────────────────────────────────────────────────────

  const statsQuery = useQuery<{ success: boolean; data: SubscriptionStats }>({
    queryKey: ['admin-subscription-stats'],
    queryFn: () => apiFetch('/api/subscriptions/stats'),
  });

  const subsQuery = useQuery<{ success: boolean; data: SubscriptionRecord[] }>({
    queryKey: ['admin-subscriptions'],
    queryFn: () => apiFetch('/api/subscriptions?all=1'),
  });

  const plansQuery = useQuery<{ success: boolean; data: PlanRecord[] }>({
    queryKey: ['admin-subscription-plans'],
    queryFn: () => apiFetch('/api/subscriptions/plans?all=1'),
  });

  // ── Mutations ────────────────────────────────────────────────────

  const savePlanMutation = useMutation({
    mutationFn: async (formData: PlanFormData) => {
      const features = formData.features
        .split('\n')
        .map((f) => f.trim())
        .filter(Boolean);

      const body: Record<string, unknown> = {
        name: formData.name,
        slug: formData.slug || formData.name.toLowerCase().replace(/\s+/g, '-'),
        description: formData.description,
        container_size: formData.container_size,
        monthly_price_vnd: Number(formData.monthly_price_vnd),
        deposit_vnd: Number(formData.deposit_vnd),
        features,
        max_occupants: Number(formData.max_occupants),
        is_popular: formData.is_popular,
        is_active: formData.is_active,
        sort_order: Number(formData.sort_order),
      };

      if (editingPlan) {
        return apiFetch(`/api/subscriptions/plans/${editingPlan.id}`, {
          method: 'PUT',
          body: JSON.stringify(body),
        });
      }
      return apiFetch('/api/subscriptions/plans', {
        method: 'POST',
        body: JSON.stringify(body),
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-subscription-plans'] });
      queryClient.invalidateQueries({ queryKey: ['subscription-plans'] });
      closePlanModal();
    },
    onError: (err: Error) => {
      setErrors({ _form: err.message });
    },
  });

  const cancelSubMutation = useMutation({
    mutationFn: ({ id, reason }: { id: string; reason: string }) =>
      apiFetch(`/api/subscriptions/${id}/cancel`, {
        method: 'POST',
        body: JSON.stringify({ reason }),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-subscriptions'] });
      queryClient.invalidateQueries({ queryKey: ['admin-subscription-stats'] });
      setCancelSubId(null);
      setCancelReason('');
    },
    onError: (err: Error) => {
      setErrors({ _form: err.message });
    },
  });

  // ── Modal handlers ───────────────────────────────────────────────

  function openAddPlanModal() {
    setEditingPlan(null);
    setForm(EMPTY_PLAN_FORM);
    setErrors({});
    setPlanModalOpen(true);
  }

  function openEditPlanModal(plan: PlanRecord) {
    setEditingPlan(plan);
    setForm({
      name: plan.name,
      slug: plan.slug,
      description: plan.description || '',
      container_size: plan.container_size,
      monthly_price_vnd: String(plan.monthly_price_vnd),
      deposit_vnd: String(plan.deposit_vnd),
      features: (plan.features || []).join('\n'),
      max_occupants: String(plan.max_occupants),
      is_popular: plan.is_popular === 1,
      is_active: plan.is_active === 1,
      sort_order: String(plan.sort_order),
    });
    setErrors({});
    setPlanModalOpen(true);
  }

  function closePlanModal() {
    setPlanModalOpen(false);
    setEditingPlan(null);
    setForm(EMPTY_PLAN_FORM);
    setErrors({});
  }

  function handleFormChange(field: keyof PlanFormData, value: string | boolean) {
    setForm((prev) => ({ ...prev, [field]: value }));
    setErrors((prev) => {
      const next = { ...prev };
      delete next[field];
      delete next._form;
      return next;
    });
  }

  function validatePlanForm(): boolean {
    const errs: Record<string, string> = {};
    if (!editingPlan && !form.name.trim()) {
      errs.name = t('validationNameRequired');
    }
    if (!form.monthly_price_vnd || Number(form.monthly_price_vnd) <= 0) {
      errs.monthly_price_vnd = t('validationPricePositive');
    }
    setErrors(errs);
    return Object.keys(errs).length === 0;
  }

  function handleSavePlan() {
    if (!validatePlanForm()) return;
    savePlanMutation.mutate(form);
  }

  // ── Data ─────────────────────────────────────────────────────────

  const stats = statsQuery.data?.data;
  const subscriptions = subsQuery.data?.data ?? [];
  const plans = plansQuery.data?.data ?? [];

  // ── Render helpers ───────────────────────────────────────────────

  function renderSkeletonRows(cols: number, rows = 5) {
    return Array.from({ length: rows }).map((_, i) => (
      <tr key={i}>
        {Array.from({ length: cols }).map((__, j) => (
          <td key={j} className="px-4 py-3">
            <Skeleton className={j === cols - 1 ? 'h-8 w-20' : 'h-4 w-full'} />
          </td>
        ))}
      </tr>
    ));
  }

  // ── Render ───────────────────────────────────────────────────────

  return (
    <div className="min-h-screen bg-background p-6">
      <div className="mx-auto max-w-7xl">
        <div className="mb-6 flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-display font-bold">{t('title')}</h1>
            <p className="text-sm text-muted/60">{t('subtitle')}</p>
          </div>
        </div>

        {/* Stats Cards */}
        {statsQuery.isLoading ? (
          <div className="mb-6 grid grid-cols-2 gap-4 md:grid-cols-4">
            {[1, 2, 3, 4].map((i) => (
              <Skeleton key={i} className="h-24 w-full rounded-xl" />
            ))}
          </div>
        ) : statsQuery.isError ? (
          <div className="mb-6 rounded-xl bg-red-500/10 p-3 text-sm text-red-800">
            {t('statsError')}{' '}
            <button onClick={() => statsQuery.refetch()} className="underline">
              {t('statsRetry')}
            </button>
          </div>
        ) : stats ? (
          <div className="mb-6 grid grid-cols-2 gap-4 md:grid-cols-4">
            <StatCard
              label={t('statsMrrLabel')}
              value={formatCurrency(stats.mrr_vnd) + '₫'}
              sub={t('statsMrrSub', { value: formatCurrency(stats.arr_vnd) })}
            />
            <StatCard
              label={t('statsActiveLabel')}
              value={String(stats.active_subscriptions)}
              sub={stats.active_subscriptions > 0 ? t('statsActiveSub', { value: formatCurrency(stats.avg_contract_value_vnd) }) : ''}
            />
            <StatCard
              label={t('statsNewLabel')}
              value={String(stats.new_this_month)}
              sub={t('statsNewSub', { count: stats.churned_this_month, pct: stats.churn_rate_pct })}
            />
            <StatCard
              label={t('statsTotalLabel')}
              value={String(stats.total_contracts)}
              sub={t('statsTotalSub', { count: stats.pending_count })}
            />
          </div>
        ) : null}

        {/* Tab bar */}
        <div className="mb-4 flex gap-1 rounded-xl bg-[var(--aura-bg-elevated)]/5 p-1">
          {(['subscriptions', 'plans', 'invoices'] as const).map((tab) => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`flex-1 rounded-lg px-4 py-2 text-sm font-medium transition-all ${
                activeTab === tab
                  ? 'bg-accent text-white shadow-sm'
                  : 'text-muted/60 hover:text-muted/80'
              }`}
            >
              {tab === 'subscriptions' ? t('tabSubscriptions') : tab === 'plans' ? t('tabPlans') : t('tabInvoices')}
            </button>
          ))}
        </div>

        {/* ── Subscriptions Tab ── */}
        {activeTab === 'subscriptions' && (
          <Card>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-border bg-muted/5">
                    <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-muted">{t('colCustomer')}</th>
                    <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-muted">{t('colPlan')}</th>
                    <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-muted">{t('colContainer')}</th>
                    <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-muted">{t('colValue')}</th>
                    <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-muted">{t('colStatus')}</th>
                    <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-muted">{t('colPeriod')}</th>
                    <th className="px-4 py-3 text-right text-xs font-medium uppercase tracking-wider text-muted">{t('colActions')}</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {subsQuery.isLoading && renderSkeletonRows(7)}

                  {subsQuery.isError && (
                    <tr>
                      <td colSpan={7} className="px-4 py-8 text-center">
                        <div className="flex flex-col items-center gap-3">
                          <p className="text-sm text-destructive">{t('subsLoadError')}</p>
                          <Button size="sm" variant="secondary" onClick={() => subsQuery.refetch()}>
                            {t('subsRetry')}
                          </Button>
                        </div>
                      </td>
                    </tr>
                  )}

                  {!subsQuery.isLoading && !subsQuery.isError && subscriptions.length === 0 && (
                    <tr>
                      <td colSpan={7} className="px-4 py-12 text-center text-sm text-muted">
                        <p className="mb-2">{t('subsEmptyTitle')}</p>
                      </td>
                    </tr>
                  )}

                  {!subsQuery.isLoading && !subsQuery.isError && subscriptions.map((sub) => (
                    <tr key={sub.id} className="hover:bg-muted/5 transition-colors">
                      <td className="px-4 py-3">
                        <p className="text-sm font-medium">{sub.customer_name}</p>
                        <p className="text-xs text-muted">{sub.customer_email || sub.customer_phone}</p>
                      </td>
                      <td className="px-4 py-3 text-sm">{sub.plan_name || sub.plan_slug || '—'}</td>
                      <td className="px-4 py-3 text-sm text-muted">
                        {sub.container_number ? (
                          <span className="font-mono text-xs">{sub.container_number}</span>
                        ) : '—'}
                      </td>
                      <td className="px-4 py-3 text-sm font-medium">
                        {formatCurrency(sub.amount_vnd)}₫
                        <span className="text-xs text-muted">/{sub.billing_cycle === 'yearly' ? t('billingYearly') : sub.billing_cycle === 'quarterly' ? t('billingQuarterly') : t('billingMonthly')}</span>
                      </td>
                      <td className="px-4 py-3">
                        <Badge variant={statusColor(sub.status)}>
                          {statusLabel(sub.status, t)}
                        </Badge>
                      </td>
                      <td className="px-4 py-3 text-sm text-muted">
                        {formatDate(sub.current_period_end)}
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center justify-end gap-2">
                          {sub.status === 'active' && (
                            <Button
                              size="sm"
                              variant="destructive"
                              onClick={() => { setCancelSubId(sub.id); setCancelReason(''); }}
                            >
                              {t('cancelSub')}
                            </Button>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Card>
        )}

        {/* ── Plans Tab ── */}
        {activeTab === 'plans' && (
          <>
            <div className="mb-4 flex items-center justify-between">
              <p className="text-sm text-muted">
                {plansQuery.isLoading ? t('plansLoading') : t('plansCount', { count: plans.length })}
              </p>
              <Button onClick={openAddPlanModal}>{t('addPlan')}</Button>
            </div>

            <Card>
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="border-b border-border bg-muted/5">
                      <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-muted">{t('colPlanName')}</th>
                      <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-muted">{t('colPrice')}</th>
                      <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-muted">{t('colContainer')}</th>
                      <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-muted">{t('colDeposit')}</th>
                      <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-muted">{t('colPopular')}</th>
                      <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-muted">{t('colPlanStatus')}</th>
                      <th className="px-4 py-3 text-right text-xs font-medium uppercase tracking-wider text-muted">{t('colPlanActions')}</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {plansQuery.isLoading && renderSkeletonRows(7)}

                    {plansQuery.isError && (
                      <tr>
                        <td colSpan={7} className="px-4 py-8 text-center">
                          <div className="flex flex-col items-center gap-3">
                            <p className="text-sm text-destructive">{t('plansLoadError')}</p>
                            <Button size="sm" variant="secondary" onClick={() => plansQuery.refetch()}>
                              {t('plansRetry')}
                            </Button>
                          </div>
                        </td>
                      </tr>
                    )}

                    {!plansQuery.isLoading && !plansQuery.isError && plans.length === 0 && (
                      <tr>
                        <td colSpan={7} className="px-4 py-12 text-center text-sm text-muted">
                          <p className="mb-2">{t('plansEmptyTitle')}</p>
                          <Button size="sm" variant="secondary" onClick={openAddPlanModal}>
                            {t('createFirstPlan')}
                          </Button>
                        </td>
                      </tr>
                    )}

                    {!plansQuery.isLoading && !plansQuery.isError && plans.map((plan) => (
                      <tr key={plan.id} className="hover:bg-muted/5 transition-colors">
                        <td className="px-4 py-3">
                          <p className="text-sm font-semibold">{plan.name}</p>
                          <p className="text-xs text-muted">{plan.slug}</p>
                        </td>
                        <td className="px-4 py-3 text-sm font-medium">
                          {formatCurrency(plan.monthly_price_vnd)}₫
                        </td>
                        <td className="px-4 py-3 text-sm text-muted">
                          {plan.container_size}
                          {plan.max_occupants > 0 ? t('occupants', { count: plan.max_occupants }) : ''}
                        </td>
                        <td className="px-4 py-3 text-sm text-muted">
                          {plan.deposit_vnd > 0 ? formatCurrency(plan.deposit_vnd) + '₫' : '—'}
                        </td>
                        <td className="px-4 py-3">
                          <Badge variant={plan.is_popular ? 'success' : 'default'}>
                            {plan.is_popular ? 'Popular' : '—'}
                          </Badge>
                        </td>
                        <td className="px-4 py-3">
                          <Badge variant={plan.is_active ? 'success' : 'destructive'}>
                            {plan.is_active ? t('planActiveLabel') : t('planInactiveLabel')}
                          </Badge>
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex items-center justify-end gap-2">
                            <Button size="sm" variant="ghost" onClick={() => openEditPlanModal(plan)}>
                              {t('editPlan')}
                            </Button>
                            <Button size="sm" variant="destructive" onClick={() => setDeletePlanId(plan.id)}>
                              {t('deletePlan')}
                            </Button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </Card>
          </>
        )}

        {/* ── Invoices Tab ── */}
        {activeTab === 'invoices' && (
          <Card className="p-10 text-center">
            <p className="text-sm text-muted/60">{t('invoicesPlaceholder')}</p>
            <p className="mt-1 text-xs text-muted/40">{t('invoicesHint')}</p>
          </Card>
        )}
      </div>

      {/* ─────────────── Plan Create / Edit Modal ─────────────── */}
      <Modal
        open={planModalOpen}
        onClose={closePlanModal}
        title={editingPlan ? t('editPlanTitle') : t('addPlanTitle')}
      >
        <div className="max-h-[70vh] space-y-4 overflow-y-auto">
          {errors._form && (
            <div className="rounded-lg bg-red-500/10 p-3 text-sm text-red-800">
              {errors._form}
            </div>
          )}

          <Input
            label={t('fieldPlanName')}
            placeholder={t('fieldPlanNamePlaceholder')}
            value={form.name}
            onChange={(e) => handleFormChange('name', e.target.value)}
            error={errors.name}
          />

          <Input
            label={t('fieldSlug')}
            placeholder={t('fieldSlugPlaceholder')}
            value={form.slug}
            onChange={(e) => handleFormChange('slug', e.target.value)}
          />

          <Input
            label={t('fieldDescription')}
            placeholder={t('fieldDescriptionPlaceholder')}
            value={form.description}
            onChange={(e) => handleFormChange('description', e.target.value)}
          />

          <div className="grid grid-cols-2 gap-3">
            <Input
              label={t('fieldContainerSize')}
              placeholder={t('fieldContainerSizePlaceholder')}
              value={form.container_size}
              onChange={(e) => handleFormChange('container_size', e.target.value)}
            />
            <Input
              label={t('fieldMaxOccupants')}
              type="number"
              min={1}
              value={form.max_occupants}
              onChange={(e) => handleFormChange('max_occupants', e.target.value)}
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <Input
              label={t('fieldMonthlyPrice')}
              type="number"
              min={0}
              placeholder={t('fieldMonthlyPricePlaceholder')}
              value={form.monthly_price_vnd}
              onChange={(e) => handleFormChange('monthly_price_vnd', e.target.value)}
              error={errors.monthly_price_vnd}
            />
            <Input
              label={t('fieldDeposit')}
              type="number"
              min={0}
              placeholder={t('fieldDepositPlaceholder')}
              value={form.deposit_vnd}
              onChange={(e) => handleFormChange('deposit_vnd', e.target.value)}
            />
          </div>

          <div className="flex flex-col gap-1.5">
            <label className="text-sm font-medium text-foreground">
              {t('fieldFeaturesLabel')}
            </label>
            <textarea
              className="min-h-[100px] rounded-lg border border-border bg-[var(--aura-bg-elevated)] px-4 py-2.5 text-base text-foreground placeholder:text-muted focus:outline-none focus:ring-2 focus:ring-accent focus:border-transparent"
              placeholder={t('fieldFeaturesPlaceholder')}
              value={form.features}
              onChange={(e) => handleFormChange('features', e.target.value)}
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <Input
              label={t('fieldSortOrder')}
              type="number"
              min={0}
              value={form.sort_order}
              onChange={(e) => handleFormChange('sort_order', e.target.value)}
              helperText={t('helperSortOrder')}
            />
          </div>

          <div className="flex items-center justify-between">
            <label className="text-sm font-medium text-foreground">{t('labelPopular')}</label>
            <button
              type="button"
              role="switch"
              aria-checked={form.is_popular}
              onClick={() => handleFormChange('is_popular', !form.is_popular)}
              className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer items-center rounded-full transition-colors duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 ${
                form.is_popular ? 'bg-accent' : 'bg-muted/50'
              }`}
            >
              <span
                className={`inline-block h-5 w-5 transform rounded-full bg-[var(--aura-bg-elevated)] shadow-sm ring-0 transition-transform duration-200 ${
                  form.is_popular ? 'translate-x-[22px]' : 'translate-x-[2px]'
                }`}
              />
            </button>
          </div>

          <div className="flex items-center justify-between">
            <label className="text-sm font-medium text-foreground">{t('labelActivePlan')}</label>
            <button
              type="button"
              role="switch"
              aria-checked={form.is_active}
              onClick={() => handleFormChange('is_active', !form.is_active)}
              className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer items-center rounded-full transition-colors duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 ${
                form.is_active ? 'bg-green-500' : 'bg-muted/50'
              }`}
            >
              <span
                className={`inline-block h-5 w-5 transform rounded-full bg-[var(--aura-bg-elevated)] shadow-sm ring-0 transition-transform duration-200 ${
                  form.is_active ? 'translate-x-[22px]' : 'translate-x-[2px]'
                }`}
              />
            </button>
          </div>

          <div className="flex justify-end gap-3 pt-2">
            <Button variant="secondary" onClick={closePlanModal}>
              {t('cancel')}
            </Button>
            <Button
              onClick={handleSavePlan}
              loading={savePlanMutation.isPending}
              disabled={savePlanMutation.isPending}
            >
              {editingPlan ? t('saveChanges') : t('addPlan')}
            </Button>
          </div>
        </div>
      </Modal>

      {/* ─────────────── Confirm Cancel Subscription ─────────────── */}
      <Modal
        open={cancelSubId !== null}
        onClose={() => { setCancelSubId(null); setCancelReason(''); }}
        title={t('cancelSubTitle')}
      >
        <div className="space-y-4">
          <p className="text-sm text-muted">{t('cancelSubMsg')}</p>
          <Input
            label={t('fieldCancelReason')}
            placeholder={t('fieldCancelReasonPlaceholder')}
            value={cancelReason}
            onChange={(e) => setCancelReason(e.target.value)}
          />
          {errors._form && (
            <div className="rounded-lg bg-red-500/10 p-3 text-sm text-red-800">{errors._form}</div>
          )}
          <div className="flex justify-end gap-3">
            <Button variant="secondary" onClick={() => { setCancelSubId(null); setCancelReason(''); }}>
              {t('cancel')}
            </Button>
            <Button
              variant="destructive"
              onClick={() => {
                if (cancelSubId !== null) cancelSubMutation.mutate({ id: cancelSubId, reason: cancelReason });
              }}
              loading={cancelSubMutation.isPending}
              disabled={cancelSubMutation.isPending}
            >
              {t('confirmCancel')}
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
