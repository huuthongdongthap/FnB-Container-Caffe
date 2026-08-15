import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { HelmetHead } from '@/components/seo/HelmetHead';
import { Card, CardBody } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { useAuthStore } from '@/hooks/stores/use-auth-store';
import { usePlans, useMyActiveSubscription, useSubscribe, type Plan, type CreateSubscriptionInput } from '@/hooks/use-subscriptions';
import { Link } from 'react-router-dom';
import { formatVND, statusBadge } from './subscriptions-helpers';
import { PlanCard } from './plan-card';

// ── Re-exports for backward compatibility ────────────────────────────
export { formatVND, statusBadge } from './subscriptions-helpers';
export { PlanCard } from './plan-card';
export type { PlanCardProps } from './plan-card';

// ── Main Component ───────────────────────────────────────────────────

export default function SubscriptionsPage() {
  const { t } = useTranslation();
  const user = useAuthStore((s) => s.user);
  const { data: plans, isLoading, isError, refetch } = usePlans();
  const { data: currentSub } = useMyActiveSubscription();
  const subscribeMutation = useSubscribe();
  const [subscribeError, setSubscribeError] = useState<string | null>(null);

  function handleSubscribe(input: CreateSubscriptionInput) {
    setSubscribeError(null);
    subscribeMutation.mutate(input, {
      onError: (err: Error) => {
        setSubscribeError(err.message);
      },
    });
  }

  return (
    <>
      <HelmetHead
        title={t('subsPage.pageTitle', 'Container Rental - AURA CAFE')}
        description={t('subsPage.seoDescription', 'Rent container spaces at AURA CAFE Sa Dec. Flexible monthly plans with full amenities for your business needs.')}
        canonical="/subscriptions"
      />
      <main className="bg-[color:var(--aura-noir-deep)] text-[color:var(--aura-chrome-bright)] mx-auto max-w-6xl px-4 py-24">
        {/* Hero */}
        <section className="mb-12 text-center">
          <div className="mb-4 inline-flex rounded-full bg-[color:var(--aura-chrome-bright)]/10 px-4 py-1 text-xs font-bold uppercase tracking-wider text-[color:var(--aura-chrome-bright)]">
            AURA Subscription
          </div>
          <h1 className="font-display text-4xl font-bold md:text-5xl">
            Goi thue <span className="text-[color:var(--aura-chrome-bright)]">Container</span>
          </h1>
          <p className="mx-auto mt-3 max-w-lg text-[color:var(--aura-chrome-bright)]/70">
            Lua chon goi thue container phu hop voi nhu cau kinh doanh cua ban.
            Linh hoat nang cap, huy bat cu luc nao.
          </p>
        </section>

        {/* Loading State */}
        {isLoading && (
          <div className="grid grid-cols-1 gap-8 md:grid-cols-2 lg:grid-cols-3">
            {[1, 2, 3].map((i) => (
              <div key={i} className="rounded-2xl border border-white/[0.08] p-6">
                <Skeleton className="mb-3 h-6 w-32" />
                <Skeleton className="mb-5 h-10 w-40" />
                <div className="space-y-2">
                  <Skeleton className="h-4 w-full" />
                  <Skeleton className="h-4 w-3/4" />
                  <Skeleton className="h-4 w-5/6" />
                  <Skeleton className="h-4 w-2/3" />
                </div>
                <Skeleton className="mt-6 h-12 w-full rounded-lg" />
              </div>
            ))}
          </div>
        )}

        {/* Error State */}
        {isError && (
          <Card className="p-10 text-center">
            <span className="mb-3 block text-4xl">&#9888;&#65039;</span>
            <h3 className="font-display text-lg font-bold">{t('subsPage.loadError')}</h3>
            <p className="mb-4 text-sm text-[color:var(--aura-chrome-bright)]/60">{t('subsPage.retryLater')}</p>
            <Button variant="secondary" onClick={() => refetch()}>
              {t('subsPage.retry')}
            </Button>
          </Card>
        )}

        {/* Subscribe Error */}
        {subscribeError && (
          <div className="mb-6 mx-auto max-w-md">
            <div className="rounded-xl bg-red-50 p-4 text-center">
              <p className="text-sm text-red-800">{subscribeError}</p>
            </div>
          </div>
        )}

        {/* Empty State */}
        {!isLoading && !isError && (!plans || plans.length === 0) && (
          <Card className="p-10 text-center">
            <span className="mb-3 block text-4xl">&#128722;</span>
            <h3 className="font-display text-lg font-bold">Chua co goi thue nao</h3>
            <p className="text-sm text-[color:var(--aura-chrome-bright)]/60">
              Hien tai chua co goi thue container nao. Quay lai sau nhe!
            </p>
          </Card>
        )}

        {/* Current subscription banner */}
        {!isLoading && !isError && currentSub && (
          <Card className="mb-8">
            <CardBody>
              <div className="flex flex-col items-center gap-3 md:flex-row md:justify-between">
                <div className="text-center md:text-left">
                  <p className="text-xs font-semibold uppercase tracking-wider text-[color:var(--aura-chrome-bright)]">
                    Goi hien tai
                  </p>
                  <p className="mt-1 font-display text-lg font-bold">
                    {currentSub.plan_name || 'Container ' + (currentSub.container_number || '')}
                  </p>
                  <div className="mt-1 flex items-center gap-3 text-sm text-[color:var(--aura-chrome-bright)]/60">
                    <span>{formatVND(currentSub.amount_vnd)}/thang</span>
                    <span>·</span>
                    <span>{currentSub.zone}</span>
                    <span>·</span>
                    {statusBadge(currentSub.status)}
                  </div>
                </div>
                <div className="flex gap-2">
                  <Link to="/account">
                    <Button variant="secondary" size="sm">
                      Quan ly goi
                    </Button>
                  </Link>
                </div>
              </div>
            </CardBody>
          </Card>
        )}

        {/* Plans Grid */}
        {!isLoading && !isError && plans && plans.length > 0 && (
          <div className="grid grid-cols-1 gap-8 md:grid-cols-2 lg:grid-cols-3">
            {plans.map((plan) => (
              <PlanCard
                key={plan.id}
                plan={plan}
                isCurrentPlan={currentSub?.plan_id === plan.id}
                isLoggedIn={!!user}
                subscribe={handleSubscribe}
                subscribing={subscribeMutation.isPending}
              />
            ))}
          </div>
        )}

        {/* Info section */}
        {!isLoading && !isError && plans && plans.length > 0 && (
          <section className="mt-16">
            <Card className="p-8 text-center">
              <h2 className="mb-6 font-display text-2xl font-bold">Tai sao chon AURA?</h2>
              <div className="mx-auto grid max-w-3xl grid-cols-1 gap-6 md:grid-cols-3">
                <div>
                  <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-[color:var(--aura-chrome-bright)]/10 text-lg font-bold text-[color:var(--aura-chrome-bright)]">
                    1
                  </div>
                  <h3 className="font-display text-base font-bold">Linh hoat</h3>
                  <p className="mt-1 text-xs text-[color:var(--aura-chrome-bright)]/60">
                    Nang cap hoac huy bat cu luc nao, khong rang buoc
                  </p>
                </div>
                <div>
                  <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-[color:var(--aura-chrome-bright)]/10 text-lg font-bold text-[color:var(--aura-chrome-bright)]">
                    2
                  </div>
                  <h3 className="font-display text-base font-bold">Tien ich day du</h3>
                  <p className="mt-1 text-xs text-[color:var(--aura-chrome-bright)]/60">
                    Container duoc trang bi day du noi that, dieu hoa, wifi
                  </p>
                </div>
                <div>
                  <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-[color:var(--aura-chrome-bright)]/10 text-lg font-bold text-[color:var(--aura-chrome-bright)]">
                    3
                  </div>
                  <h3 className="font-display text-base font-bold">{t('subsPage.support247')}</h3>
                  <p className="mt-1 text-xs text-[color:var(--aura-chrome-bright)]/60">
                    {t('subsPage.supportDesc')}
                  </p>
                </div>
              </div>
            </Card>
          </section>
        )}
      </main>
    </>
  );
}
