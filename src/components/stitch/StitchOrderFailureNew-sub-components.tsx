/**
 * StitchOrderFailureNew — Upper sub-components
 */
'use client';

import { useTranslation } from 'react-i18next';
import { cn } from '@/lib/cn';
import {
  ArrowLeft,
  UserCircle,
  AlertCircle,
  Wallet,
  Banknote,
  ChevronRight,
} from 'lucide-react';
import { GLASS_CARD_CLASSES } from './StitchOrderFailureNew-constants';
import type { PaymentOptionProps } from './StitchOrderFailureNew-types';

/* ─── Glass option row ──────────────────────────────────────────── */

export function PaymentOption({
  icon: Icon,
  title,
  description,
  onClick,
}: PaymentOptionProps) {
  return (
    <button
      onClick={onClick}
      className={cn(
        GLASS_CARD_CLASSES,
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

/* ─── TopAppBar ─────────────────────────────────────────────────── */

export function TopAppBar({
  onNavigate,
}: {
  onNavigate?: (path: string) => void;
}) {
  const { t } = useTranslation();
  return (
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
  );
}

/* ─── Error Hero Section ────────────────────────────────────────── */

export function ErrorHeroSection() {
  const { t } = useTranslation();
  return (
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
  );
}

/* ─── Retry Button ──────────────────────────────────────────────── */

export function RetryButton({
  onRetry,
  isProcessing,
}: {
  onRetry?: () => void;
  isProcessing?: boolean;
}) {
  const { t } = useTranslation();
  return (
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
  );
}

/* ─── Payment Options Section ───────────────────────────────────── */

export function PaymentOptionsSection({
  onPayOS,
  onCOD,
}: {
  onPayOS?: () => void;
  onCOD?: () => void;
}) {
  const { t } = useTranslation();
  return (
    <section className="w-full space-y-6">
      <div className="flex items-center gap-3">
        <div className="h-px flex-1 bg-white/10" />
        <span className="font-['Space_Grotesk'] text-[12px] font-semibold tracking-[0.1em] uppercase text-[var(--aura-chrome-soft)]">
          {t('orderFailure.otherOptions', 'Other Options')}
        </span>
        <div className="h-px flex-1 bg-white/10" />
      </div>
      <div className="space-y-3">
        <PaymentOption
          icon={Wallet}
          title={t('orderFailure.payos', 'PayOS')}
          description={t('orderFailure.payosDesc', 'Fast & Secure Transfer')}
          onClick={onPayOS}
        />
        <PaymentOption
          icon={Banknote}
          title={t('orderFailure.cod', 'Cash on Delivery')}
          description={t('orderFailure.codDesc', 'Pay at your doorstep')}
          onClick={onCOD}
        />
      </div>
    </section>
  );
}
