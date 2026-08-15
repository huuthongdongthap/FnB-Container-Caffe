/**
 * StitchOrderFailureNew — Lower sub-components (support, filler, nav)
 */
'use client';

import { useTranslation } from 'react-i18next';
import { cn } from '@/lib/cn';
import {
  MessageCircle,
  Phone,
  UtensilsCrossed,
  UserPlus,
  Award,
  User,
} from 'lucide-react';
import { GLASS_CARD_CLASSES } from './StitchOrderFailureNew-constants';

/* ─── Support Section ───────────────────────────────────────────── */

export function SupportSection({
  onChatSupport,
  onCallSupport,
}: {
  onChatSupport?: () => void;
  onCallSupport?: () => void;
}) {
  const { t } = useTranslation();
  return (
    <section className={cn(GLASS_CARD_CLASSES, 'w-full relative p-6 overflow-hidden')}>
      <div className="absolute top-0 left-0 w-full h-[2px] bg-[var(--aura-bronze-shimmer)]" />
      <h3 className="font-['Space_Grotesk'] text-[12px] font-semibold tracking-[0.1em] uppercase text-[var(--aura-bronze-shimmer)] mb-2">
        {t('orderFailure.helpTitle', 'Need Help?')}
      </h3>
      <p className="font-['Space_Grotesk'] text-[14px] leading-relaxed text-[var(--aura-chrome-soft)] mb-6">
        {t('orderFailure.helpDesc', 'Our concierge team is available 24/7 to assist with your order issues.')}
      </p>
      <div className="flex flex-col gap-3">
        <button
          onClick={onChatSupport}
          className="flex items-center gap-3 text-[var(--aura-chrome-bright)] font-['Space_Grotesk'] text-[14px] py-2 border-b border-white/10 hover:text-[var(--aura-bronze-shimmer)] transition-colors text-left"
        >
          <MessageCircle className="w-5 h-5" />
          {t('orderFailure.chat', 'Chat with Support')}
        </button>
        <button
          onClick={onCallSupport}
          className="flex items-center gap-3 text-[var(--aura-chrome-bright)] font-['Space_Grotesk'] text-[14px] py-2 border-b border-white/10 hover:text-[var(--aura-bronze-shimmer)] transition-colors text-left"
        >
          <Phone className="w-5 h-5" />
          {t('orderFailure.call', 'Call Us')}
        </button>
      </div>
    </section>
  );
}

/* ─── Aesthetic Filler Card ─────────────────────────────────────── */

export function AestheticFillerCard() {
  return (
    <section className="w-full opacity-50">
      <div className={cn(GLASS_CARD_CLASSES, 'relative w-full h-32 overflow-hidden group')}>
        <div className="absolute inset-0 grayscale contrast-125 mix-blend-overlay">
          <div
            className="w-full h-full bg-cover bg-center"
            style={{
              backgroundImage:
                'url("https://lh3.googleusercontent.com/aida-public/AB6AXuCMgjaZCyvu05sO2AteEOFB1vDffkWR_d6JWjo-yc2y7-aS95SQPrQtgD2BoAHS5tZtx5n_AZDmiHJAu2enZmqQHgCt2hsGR5S6snToKaN3Rhu29AXrE6FkZH3a8vspLdZgwp8SDTllaNnSmSfqhJyR1rfCngRiXcdwoHOdc96jivsTa7dEVsH8KzAVxcU6Jy6ilyTwyUKZ1XEIpT2-ANDZQCKH9kywZBqjIetybB0gX0s0WW36Pgl6ApYSbrvvUnRtnmdHuthx5Ds")',
            }}
          />
        </div>
        <div className="absolute inset-0 flex items-center justify-center">
          <span className="font-['EB_Garamond'] text-[40px] text-white/5 uppercase tracking-tighter select-none">
            AURA CAFE
          </span>
        </div>
      </div>
    </section>
  );
}

/* ─── BottomNavBar ──────────────────────────────────────────────── */

export function BottomNavBar({
  onNavigate,
}: {
  onNavigate?: (path: string) => void;
}) {
  const { t } = useTranslation();
  return (
    <nav className="fixed bottom-0 left-0 w-full flex justify-around items-center h-20 px-2 pb-4 bg-[var(--aura-surface-dim)]/60 backdrop-blur-xl border-t border-white/10 z-50">
      <button
        onClick={() => onNavigate?.('/menu')}
        className="flex flex-col items-center justify-center text-[var(--aura-chrome-soft)] hover:bg-white/5 px-4 py-1 transition-all"
      >
        <UtensilsCrossed className="w-6 h-6 mb-1" />
        <span className="font-['Space_Grotesk'] text-[10px] font-semibold">{t('nav.menu', 'Menu')}</span>
      </button>
      <button
        onClick={() => onNavigate?.('/referrals')}
        className="flex flex-col items-center justify-center text-[var(--aura-chrome-soft)] hover:bg-white/5 px-4 py-1 transition-all"
      >
        <UserPlus className="w-6 h-6 mb-1" />
        <span className="font-['Space_Grotesk'] text-[10px] font-semibold">{t('nav.referrals', 'Referrals')}</span>
      </button>
      <button
        onClick={() => onNavigate?.('/rewards')}
        className="flex flex-col items-center justify-center text-[var(--aura-chrome-soft)] hover:bg-white/5 px-4 py-1 transition-all"
      >
        <Award className="w-6 h-6 mb-1" />
        <span className="font-['Space_Grotesk'] text-[10px] font-semibold">{t('nav.rewards', 'Rewards')}</span>
      </button>
      <button
        onClick={() => onNavigate?.('/profile')}
        className="flex flex-col items-center justify-center text-[var(--aura-chrome-soft)] hover:bg-white/5 px-4 py-1 transition-all"
      >
        <User className="w-6 h-6 mb-1" />
        <span className="font-['Space_Grotesk'] text-[10px] font-semibold">{t('nav.profile', 'Profile')}</span>
      </button>
    </nav>
  );
}
