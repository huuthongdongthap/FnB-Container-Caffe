import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Skeleton } from '@/components/ui/skeleton';
import { Card } from '@/components/ui/card';
import { HelmetHead } from '@/components/seo/HelmetHead';
import { StatCard } from './subscription-stats-card';
import { formatCurrency } from './subscription-api';
import { useSubscriptionPlans } from './use-subscription-plans';
import { useSubscriptions } from './use-subscriptions';
import { SubscriptionsTable } from './subscriptions-table';
import { PlansTable } from './plans-table';
import { PlanModal } from './plan-modal';
import { CancelSubModal } from './cancel-sub-modal';

export default function SubscriptionsManagerPage() {
  const { t } = useTranslation('adminSubscriptions');
  const [activeTab, setActiveTab] = useState<'subscriptions' | 'plans' | 'invoices'>('subscriptions');

  const plans = useSubscriptionPlans(t);
  const subs = useSubscriptions();

  return (
    <>
      <HelmetHead
        title="Quản lý gói thuê bao — Subscription Management — AURA CAFE"
        description="Quản lý gói thuê bao container và đăng ký dịch vụ tại AURA CAFE. Subscription plans & container rental management."
      />
      <div className="min-h-screen bg-background p-6">
        <div className="mx-auto max-w-7xl">
          <div className="mb-6 flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-display font-bold">{t('title')}</h1>
              <p className="text-sm text-muted/60">{t('subtitle')}</p>
            </div>
          </div>

          {/* Stats Cards */}
          {subs.statsQuery.isLoading ? (
            <div className="mb-6 grid grid-cols-2 gap-4 md:grid-cols-4">
              {[1, 2, 3, 4].map((i) => (
                <Skeleton key={i} className="h-24 w-full rounded-xl" />
              ))}
            </div>
          ) : subs.statsQuery.isError ? (
            <div className="mb-6 rounded-xl bg-red-500/10 p-3 text-sm text-red-800">
              {t('statsError')}{' '}
              <button onClick={() => subs.statsQuery.refetch()} className="underline">{t('statsRetry')}</button>
            </div>
          ) : subs.stats ? (
            <div className="mb-6 grid grid-cols-2 gap-4 md:grid-cols-4">
              <StatCard label={t('statsMrrLabel')} value={formatCurrency(subs.stats.mrr_vnd) + '₫'} sub={t('statsMrrSub', { value: formatCurrency(subs.stats.arr_vnd) })} />
              <StatCard label={t('statsActiveLabel')} value={String(subs.stats.active_subscriptions)} sub={subs.stats.active_subscriptions > 0 ? t('statsActiveSub', { value: formatCurrency(subs.stats.avg_contract_value_vnd) }) : ''} />
              <StatCard label={t('statsNewLabel')} value={String(subs.stats.new_this_month)} sub={t('statsNewSub', { count: subs.stats.churned_this_month, pct: subs.stats.churn_rate_pct })} />
              <StatCard label={t('statsTotalLabel')} value={String(subs.stats.total_contracts)} sub={t('statsTotalSub', { count: subs.stats.pending_count })} />
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

          {activeTab === 'subscriptions' && (
            <SubscriptionsTable
              subscriptions={subs.subscriptions}
              isLoading={subs.subsQuery.isLoading}
              isError={subs.subsQuery.isError}
              onRefetch={() => subs.subsQuery.refetch()}
              onCancel={(id) => { subs.setCancelSubId(id); subs.setCancelReason(''); }}
              t={t}
            />
          )}

          {activeTab === 'plans' && (
            <PlansTable
              plans={plans.plans}
              isLoading={plans.query.isLoading}
              isError={plans.query.isError}
              onRefetch={() => plans.query.refetch()}
              onEdit={plans.openEditModal}
              onDelete={(id) => plans.setDeletePlanId(id)}
              onAdd={plans.openAddModal}
              t={t}
            />
          )}

          {activeTab === 'invoices' && (
            <Card className="p-10 text-center">
              <p className="text-sm text-muted/60">{t('invoicesPlaceholder')}</p>
              <p className="mt-1 text-xs text-muted/40">{t('invoicesHint')}</p>
            </Card>
          )}
        </div>

        <PlanModal
          open={plans.modalOpen}
          editing={plans.editingPlan}
          form={plans.form}
          errors={plans.errors}
          onChange={plans.handleFormChange}
          onSave={plans.handleSave}
          onClose={plans.closeModal}
          saving={plans.saveMutation.isPending}
          t={t}
        />

        <CancelSubModal
          open={subs.cancelSubId !== null}
          reason={subs.cancelReason}
          errors={plans.errors}
          onReasonChange={subs.setCancelReason}
          onConfirm={() => {
            if (subs.cancelSubId !== null) subs.cancelMutation.mutate({ id: subs.cancelSubId, reason: subs.cancelReason });
          }}
          onClose={() => { subs.setCancelSubId(null); subs.setCancelReason(''); }}
          loading={subs.cancelMutation.isPending}
          t={t}
        />
      </div>
    </>
  );
}
