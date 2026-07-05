/**
 * StitchOrderFailureNew — Payment failure screen for AURA CAFE
 *
 * Regenerated from the original Stitch HTML export:
 *   stitch-exports/new-screens/order-failure.html
 *
 * Design tokens mapped to --aura-* CSS variables:
 *   --aura-surface-dim    -> main bg (#081425)
 *   --aura-chrome-bright  -> bright text (#c6c6c7)
 *   --aura-chrome-soft    -> muted text (#a0a0a0)
 *   --aura-bronze-shimmer -> CTA/accent (#d4a574)
 *   Display font: 'EB Garamond', serif
 *   Body font: 'Space Grotesk', sans-serif
 */
'use client';

import { useTranslation } from 'react-i18next';
import { HelmetHead } from '@/components/seo/HelmetHead';
import { cn } from '@/lib/cn';
import {
  ArrowLeft,
  UserCircle,
  AlertCircle,
  Wallet,
  Banknote,
  ChevronRight,
  MessageCircle,
  Phone,
  UtensilsCrossed,
  UserPlus,
  Award,
  User,
} from 'lucide-react';

/* ─── Glass card style ──────────────────────────────────────────── */

const glassCardClasses =
  'bg-[rgba(198,198,199,0.1)] backdrop-blur-[24px] border-t border-l border-[rgba(198,198,199,0.3)] border-r border-b border-[var(--aura-chrome-bright)]/50';

/* ─── Props ─────────────────────────────────────────────────────── */

export interface StitchOrderFailureNewProps {
  onRetry?: () => void;
  onPayOS?: () => void;
  onCOD?: () => void;
  onChatSupport?: () => void;
  onCallSupport?: () => void;
  onNavigate?: (path: string) => void;
  isProcessing?: boolean;
}

/* ─── Glass option row ──────────────────────────────────────────── */

function PaymentOption({
  icon: Icon,
  title,
  description,
  onClick,
}: {
  icon: React.ElementType;
  title: string;
  description: string;
  onClick?: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className={cn(
        glassCardClasses,
        'w-full p-6 flex justify-between items-center group active:scale-[0.98] transition-transform',
      )}
    >
      <div className="flex items-center gap-6">
        <Icon className="w-6 h-6 text-[var(--aura-chrome-bright)]" />
        <div className="text-left">
          <p className="font-['Space_Grotesk'] text-[14px] leading-relaxed text-[var(--aura-chrome-bright)] font-bold">
            {title}
          </p>
          <p className="font-['Space_Grotesk'] text-[10px] font-semibold uppercase tracking-[0.1em] text-[var(--aura-chrome-soft)]">
            {description}
          </p>
        </div>
      </div>
      <ChevronRight className="w-5 h-5 text-[var(--aura-chrome-soft)] group-hover:text-[var(--aura-bronze-shimmer)] transition-colors" />
    </button>
  );
}

/* ─── Component ─────────────────────────────────────────────────── */

export function StitchOrderFailureNew({
  onRetry,
  onPayOS,
  onCOD,
  onChatSupport,
  onCallSupport,
  onNavigate,
  isProcessing,
}: StitchOrderFailureNewProps) {
  const { t } = useTranslation();

  return (
    <>
      <HelmetHead
        title="Order Failed"
        description="Payment failed. Please check your card details or try another method for your AURA CAFE order."
      />

      {/* TopAppBar */}
      <header className="fixed top-0 w-full z-50 bg-[var(--aura-surface-dim)]/60 backdrop-blur-xl border-b border-white/20 flex justify-between items-center px-6 h-16">
        <button
          onClick={() => onNavigate?.('/cart')}
          className="active:scale-95 transition-transform text-[var(--aura-chrome-bright)]"
          aria-label="Go back"
        >
          <ArrowLeft className="w-6 h-6" />
        </button>
        <h1 className="font-['Space_Grotesk'] text-[20px] font-bold leading-tight uppercase tracking-widest text-[var(--aura-chrome-bright)]">
          {t('orderFailure.title', 'ORDER FAILED')}
        </h1>
        <button
          onClick={() => onNavigate?.('/account')}
          className="active:scale-95 transition-transform text-[var(--aura-chrome-bright)]"
          aria-label="Account"
        >
          <UserCircle className="w-6 h-6" />
        </button>
      </header>

      <main className="pt-24 px-6 flex flex-col items-start gap-12 min-h-screen pb-32"
        style={{
          background: 'radial-gradient(circle at 50% 50%, #0c1a2d 0%, var(--aura-surface-dim) 100%)',
        }}
      >
        {/* Error Hero Section */}
        <section className="w-full flex flex-col items-start space-y-6">
          <div className="relative inline-block">
            <AlertCircle
              className="text-[var(--aura-bronze-shimmer)]"
              style={{ width: 64, height: 64, strokeWidth: 1 }}
            />
            <div
              className="absolute -inset-2 rounded-full -z-10"
              style={{
                background: 'var(--aura-bronze-shimmer)',
                opacity: 0.1,
                filter: 'blur(16px)',
              }}
            />
          </div>
          <div className="space-y-2">
            <h2 className="font-['EB_Garamond'] text-[36px] leading-none tracking-tighter uppercase text-[var(--aura-chrome-bright)]">
              {t('orderFailure.heading', 'Payment Failed')}
            </h2>
            <p className="font-['Space_Grotesk'] text-[18px] leading-relaxed text-[var(--aura-chrome-soft)] max-w-[280px]">
              {t('orderFailure.description', "The transaction couldn't be processed. Please check your card details or try another method.")}
            </p>
          </div>
        </section>

        {/* Primary Action */}
        <section className="w-full">
          <button
            onClick={onRetry}
            disabled={isProcessing}
            className="w-full bg-[var(--aura-bronze-shimmer)] text-white font-['Space_Grotesk'] text-[12px] font-semibold tracking-[0.1em] uppercase py-6 transition-all hover:brightness-110 active:scale-[0.98] disabled:opacity-60 disabled:cursor-not-allowed"
            style={{ boxShadow: '0 0 20px 0 rgba(212, 165, 116, 0.15)' }}
          >
            {isProcessing ? (
              <span className="inline-flex items-center gap-2">
                <span className="inline-block w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                {t('orderFailure.processing', 'PROCESSING...')}
              </span>
            ) : (
              t('orderFailure.retry', 'Retry Payment')
            )}
          </button>
        </section>

        {/* Alternative Payment Methods */}
        <section className="w-full space-y-6">
          <div className="flex items-center gap-3">
            <div className="h-px flex-1 bg-white/10" />
            <span className="font-['Space_Grotesk'] text-[12px] font-semibold tracking-[0.1em] uppercase text-[var(--aura-chrome-soft)]">
              {t('orderFailure.otherOptions', 'Other Options')}
            </span>
            <div className="h-px flex-1 bg-white/10" />
          </div>

          <div className="space-y-3">
            {/* PayOS Option */}
            <PaymentOption
              icon={Wallet}
              title={t('orderFailure.payos', 'PayOS')}
              description={t('orderFailure.payosDesc', 'Fast & Secure Transfer')}
              onClick={onPayOS}
            />
            {/* COD Option */}
            <PaymentOption
              icon={Banknote}
              title={t('orderFailure.cod', 'Cash on Delivery')}
              description={t('orderFailure.codDesc', 'Pay at your doorstep')}
              onClick={onCOD}
            />
          </div>
        </section>

        {/* Support Section */}
        <section className={cn(glassCardClasses, 'w-full relative p-6 overflow-hidden')}>
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

        {/* Aesthetic Filler Card */}
        <section className="w-full opacity-50">
          <div className={cn(glassCardClasses, 'relative w-full h-32 overflow-hidden group')}>
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
      </main>

      {/* BottomNavBar */}
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
    </>
  );
}
