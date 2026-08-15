/**
 * StitchCheckinNew — Hero glass card section
 */

import { useTranslation } from 'react-i18next';
import { cn } from '@/lib/cn';
import { glassCardClasses } from './StitchCheckinNew-constants';

export function HeroCard() {
  const { t } = useTranslation();

  return (
    <section className={cn(glassCardClasses, 'rounded-xl p-8 mb-8 relative overflow-hidden')}>
      <div className="relative z-10">
        <p className="font-['Space_Grotesk'] text-[12px] font-semibold tracking-[0.1em] uppercase text-[var(--aura-bronze-shimmer)] mb-2">
          {t('checkin.loyaltyProgram', 'LOYALTY PROGRAM')}
        </p>
        <h2 className="text-[24px] font-bold leading-tight font-['EB_Garamond'] text-[var(--aura-chrome-bright)] mb-4">
          {t('checkin.title', 'Check-In')}
        </h2>
        <p className="font-['Space_Grotesk'] text-[16px] leading-relaxed text-[var(--aura-chrome-soft)]">
          {t('checkin.description', 'Welcome back to Aura. Enter your mobile number to earn')}{' '}
          <span className="text-[var(--aura-bronze-shimmer)] font-bold">Aura Points</span>{' '}
          {t('checkin.forVisit', 'for your visit today.')}
        </p>
      </div>
      <div className="absolute right-0 top-0 h-full w-1 bg-gradient-to-b from-transparent via-[var(--aura-bronze-shimmer)]/20 to-transparent" />
    </section>
  );
}
