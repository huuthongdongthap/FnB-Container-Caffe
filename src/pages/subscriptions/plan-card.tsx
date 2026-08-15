import { useTranslation } from 'react-i18next';
import { Button } from '@/components/ui/button';
import { useAuthStore } from '@/hooks/stores/use-auth-store';
import { type Plan, type CreateSubscriptionInput } from '@/hooks/use-subscriptions';
import { Link } from 'react-router-dom';
import { formatVND, statusBadge } from './subscriptions-helpers';

export interface PlanCardProps {
  plan: Plan;
  isCurrentPlan: boolean;
  isLoggedIn: boolean;
  subscribe: (input: CreateSubscriptionInput) => void;
  subscribing: boolean;
}

export function PlanCard({ plan, isCurrentPlan, isLoggedIn, subscribe, subscribing }: PlanCardProps) {
  const { t } = useTranslation();
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
          ? 'border-white/[0.3] bg-[color:var(--aura-chrome-bright)]/[0.04] shadow-xl shadow-accent/10 scale-[1.02]'
          : 'border-white/[0.08] bg-white/[0.03] backdrop-blur-md hover:border-white/[0.15] hover:shadow-lg'
      } backdrop-blur-sm`}
    >
      {plan.is_popular ? (
        <div className="absolute -top-3 left-1/2 -translate-x-1/2">
          <span className="inline-block rounded-full bg-[color:var(--aura-chrome-bright)] px-4 py-1 text-[10px] font-bold uppercase tracking-widest text-[color:var(--aura-chrome-bright)] shadow-md">
            Phổ biến nhất
          </span>
        </div>
      ) : null}

      <div className="flex flex-col p-6 pt-8">
        <h3 className="font-display text-xl font-bold text-[color:var(--aura-chrome-bright)]">{plan.name}</h3>
        <p className="mt-1 text-sm text-[color:var(--aura-chrome-bright)]/60">{plan.description}</p>

        <div className="mt-5">
          <span className="font-display text-4xl font-bold text-[color:var(--aura-chrome-bright)]">
            {formatVND(plan.monthly_price_vnd)}
          </span>
          <span className="ml-1 text-sm text-[color:var(--aura-chrome-bright)]/50">{t('subsPage.perMonth')}</span>
        </div>

        {plan.deposit_vnd > 0 && (
          <p className="mt-1 text-xs text-[color:var(--aura-chrome-bright)]/40">
            {t('subsPage.deposit')}: {formatVND(plan.deposit_vnd)}
          </p>
        )}

        <p className="mt-3 text-xs font-medium uppercase tracking-wider text-[color:var(--aura-chrome-bright)]/50">
          Container {plan.container_size}
          {plan.max_occupants > 0 ? ` · ${plan.max_occupants} nguoi` : ''}
        </p>

        <ul className="mt-4 flex-1 space-y-2.5">
          {plan.features.map((feat, i) => (
            <li key={i} className="flex items-start gap-2 text-sm text-[color:var(--aura-chrome-bright)]/80">
              <svg className="mt-0.5 h-4 w-4 shrink-0 text-[color:var(--aura-chrome-bright)]" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
                <path fillRule="evenodd" d="M16.704 4.153a.75.75 0 01.143 1.052l-8 10.5a.75.75 0 01-1.127.075l-4.5-4.5a.75.75 0 011.06-1.06l3.894 3.893 7.48-9.817a.75.75 0 011.05-.143z" clipRule="evenodd" />
              </svg>
              <span>{feat}</span>
            </li>
          ))}
        </ul>

        <div className="mt-6">
          {isCurrentPlan ? (
            <div className="text-center">
              {statusBadge('active')}
              <p className="mt-1.5 text-xs text-[color:var(--aura-chrome-bright)]/50">{t('subsPage.currentPlan')}</p>
            </div>
          ) : !isLoggedIn ? (
            <Link to="/menu">
              <Button variant="secondary" className="w-full" size="md">
                {t('subsPage.loginToSubscribe')}
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
              {subscribing ? t('subsPage.subscribing') : t('subsPage.subscribeNow')}
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}
