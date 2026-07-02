import { useState, useEffect } from 'react';
import { Card, CardBody } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { useAuthStore } from '@/hooks/stores/use-auth-store';
import { usePlans, useMyActiveSubscription, useSubscribe, type Plan, type CreateSubscriptionInput } from '@/hooks/use-subscriptions';
import { Link } from 'react-router-dom';

// ── Helpers ──────────────────────────────────────────────────────────

function formatVND(value: number): string {
  return value.toLocaleString('vi-VN') + '₫';
}

function statusBadge(status: string) {
  const colors: Record<string, string> = {
    active: 'bg-green-100 text-green-800',
    paused: 'bg-amber-100 text-amber-800',
    cancelled: 'bg-red-100 text-red-800',
    pending: 'bg-blue-100 text-blue-800',
  };
  const labels: Record<string, string> = {
    active: 'Đang hoạt động',
    paused: 'Tạm dừng',
    cancelled: 'Đã huỷ',
    pending: 'Chờ kích hoạt',
  };
  return (
    <span
      className={`inline-block rounded-full px-2.5 py-0.5 text-xs font-medium ${
        colors[status] || 'bg-gray-100 text-gray-800'
      }`}
    >
      {labels[status] || status}
    </span>
  );
}

// ── PlanCard ─────────────────────────────────────────────────────────

interface PlanCardProps {
  plan: Plan;
  isCurrentPlan: boolean;
  isLoggedIn: boolean;
  subscribe: (input: CreateSubscriptionInput) => void;
  subscribing: boolean;
}

function PlanCard({ plan, isCurrentPlan, isLoggedIn, subscribe, subscribing }: PlanCardProps) {
  const user = useAuthStore((s) => s.user);

  function handleSubscribe() {
    if (!user) return;
    subscribe({
      plan_id: plan.id,
      customer_name: user.name,
      customer_email: user.email,
      customer_phone: '',
    });
  }

  return (
    <div
      className={`relative flex flex-col rounded-2xl border transition-all duration-300 ${
        plan.is_popular
          ? 'border-accent/60 bg-accent/[0.04] shadow-xl shadow-accent/10 scale-[1.02]'
          : 'border-border bg-white/40 hover:border-accent/30 hover:shadow-lg'
      } backdrop-blur-sm`}
    >
      {/* Popular badge */}
      {plan.is_popular ? (
        <div className="absolute -top-3 left-1/2 -translate-x-1/2">
          <span className="inline-block rounded-full bg-accent px-4 py-1 text-[10px] font-bold uppercase tracking-widest text-white shadow-md">
            Phổ biến nhất
          </span>
        </div>
      ) : null}

      <div className="flex flex-col p-6 pt-8">
        {/* Plan name */}
        <h3 className="font-display text-xl font-bold text-foreground">{plan.name}</h3>
        <p className="mt-1 text-sm text-muted/60">{plan.description}</p>

        {/* Price */}
        <div className="mt-5">
          <span className="font-display text-4xl font-bold text-foreground">
            {formatVND(plan.monthly_price_vnd)}
          </span>
          <span className="ml-1 text-sm text-muted/50">/thang</span>
        </div>

        {/* Deposit */}
        {plan.deposit_vnd > 0 && (
          <p className="mt-1 text-xs text-muted/40">
            Tien coc: {formatVND(plan.deposit_vnd)}
          </p>
        )}

        {/* Container size */}
        <p className="mt-3 text-xs font-medium uppercase tracking-wider text-muted/50">
          Container {plan.container_size}
          {plan.max_occupants > 0 ? ` · ${plan.max_occupants} nguoi` : ''}
        </p>

        {/* Features */}
        <ul className="mt-4 flex-1 space-y-2.5">
          {plan.features.map((feat, i) => (
            <li key={i} className="flex items-start gap-2 text-sm text-foreground/80">
              <svg className="mt-0.5 h-4 w-4 shrink-0 text-accent" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
                <path fillRule="evenodd" d="M16.704 4.153a.75.75 0 01.143 1.052l-8 10.5a.75.75 0 01-1.127.075l-4.5-4.5a.75.75 0 011.06-1.06l3.894 3.893 7.48-9.817a.75.75 0 011.05-.143z" clipRule="evenodd" />
              </svg>
              <span>{feat}</span>
            </li>
          ))}
        </ul>

        {/* CTA */}
        <div className="mt-6">
          {isCurrentPlan ? (
            <div className="text-center">
              {statusBadge('active')}
              <p className="mt-1.5 text-xs text-muted/50">Goi dang su dung</p>
            </div>
          ) : !isLoggedIn ? (
            <Link to="/menu">
              <Button variant="secondary" className="w-full" size="md">
                Dang nhap de dang ky
              </Button>
            </Link>
          ) : (
            <Button
              className="w-full"
              size="md"
              onClick={handleSubscribe}
              loading={subscribing}
              disabled={subscribing}
            >
              {subscribing ? 'Dang dang ky...' : 'Dang ky ngay'}
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}

// ── Main Component ───────────────────────────────────────────────────

export default function SubscriptionsPage() {
  const user = useAuthStore((s) => s.user);
  const { data: plans, isLoading, isError, refetch } = usePlans();
  const { data: currentSub } = useMyActiveSubscription();
  const subscribeMutation = useSubscribe();
  const [subscribeError, setSubscribeError] = useState<string | null>(null);

  useEffect(() => {
    document.title = 'Goi thue Container - AURA CAFE';
  }, []);

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
      <main className="mx-auto max-w-6xl px-4 py-24">
        {/* Hero */}
        <section className="mb-12 text-center">
          <div className="mb-4 inline-flex rounded-full bg-accent/10 px-4 py-1 text-xs font-bold uppercase tracking-wider text-accent">
            AURA Subscription
          </div>
          <h1 className="font-display text-4xl font-bold md:text-5xl">
            Goi thue <span className="text-accent">Container</span>
          </h1>
          <p className="mx-auto mt-3 max-w-lg text-muted/70">
            Lua chon goi thue container phu hop voi nhu cau kinh doanh cua ban.
            Linh hoat nang cap, huy bat cu luc nao.
          </p>
        </section>

        {/* Loading State */}
        {isLoading && (
          <div className="grid grid-cols-1 gap-8 md:grid-cols-2 lg:grid-cols-3">
            {[1, 2, 3].map((i) => (
              <div key={i} className="rounded-2xl border border-border p-6">
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
            <h3 className="font-display text-lg font-bold">Khong the tai goi dang ky</h3>
            <p className="mb-4 text-sm text-muted/60">Vui long thu lai sau.</p>
            <Button variant="secondary" onClick={() => refetch()}>
              Thu lai
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
            <p className="text-sm text-muted/60">
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
                  <p className="text-xs font-semibold uppercase tracking-wider text-accent">
                    Goi hien tai
                  </p>
                  <p className="mt-1 font-display text-lg font-bold">
                    {currentSub.plan_name || 'Container ' + (currentSub.container_number || '')}
                  </p>
                  <div className="mt-1 flex items-center gap-3 text-sm text-muted/60">
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
                  <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-accent/10 text-lg font-bold text-accent">
                    1
                  </div>
                  <h3 className="font-display text-base font-bold">Linh hoat</h3>
                  <p className="mt-1 text-xs text-muted/60">
                    Nang cap hoac huy bat cu luc nao, khong rang buoc
                  </p>
                </div>
                <div>
                  <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-accent/10 text-lg font-bold text-accent">
                    2
                  </div>
                  <h3 className="font-display text-base font-bold">Tien ich day du</h3>
                  <p className="mt-1 text-xs text-muted/60">
                    Container duoc trang bi day du noi that, dieu hoa, wifi
                  </p>
                </div>
                <div>
                  <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-accent/10 text-lg font-bold text-accent">
                    3
                  </div>
                  <h3 className="font-display text-base font-bold">Ho tro 24/7</h3>
                  <p className="mt-1 text-xs text-muted/60">
                    Doi ngu van hanh san sang ho tro ban moi luc
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
