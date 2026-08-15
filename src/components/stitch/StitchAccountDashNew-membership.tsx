/**
 * DashMembershipCard — membership card for StitchAccountDashNew
 */
import { useTranslation } from 'react-i18next';
import { CreditCard } from 'lucide-react';
import type { DashAccountProfile } from './StitchAccountDashNew-types';
import { BODY_FONT, DISPLAY_FONT } from './StitchAccountDashNew-constants';

interface DashMembershipCardProps {
  profile: DashAccountProfile;
}

export function DashMembershipCard({ profile }: DashMembershipCardProps) {
  const { t } = useTranslation();
  return (
    <section className="pt-4">
      <div
        className="relative w-full rounded-2xl overflow-hidden border border-white/10 group"
        style={{ aspectRatio: '1.6/1' }}
        aria-label={t('stitch.accountDashboard.memberCard', 'Membership Card')}
      >
        {/* Card background gradient */}
        <div className="absolute inset-0 bg-gradient-to-br from-[var(--aura-bg-high)] to-[var(--aura-bg-page)]" />

        {/* Texture overlay */}
        <div
          className="absolute inset-0 opacity-60 mix-blend-overlay bg-cover bg-center"
          style={{
            backgroundImage: 'url("https://lh3.googleusercontent.com/aida-public/AB6AXuD0ldGu_qcqMXjXQnmt1JmIllxnBsu6SKMlLfZRY9Xt87lWvWROEWcoqzwB3AvNRVR96MEQ89_PvOwhogedyMW8J1lDYtOTw4L1jIQ5o-GPoc0_EYHIHOi4sLwZ6Rs-6Jlw-XMJlgtS1WxInAUVI55oekXIPhc9vn-Ve4XUVEMbs_SseLo0FTvkEEBrjKkb6P5J-Ca3A-OSIadHROpyLWsXlmgtWXOe7nSH_rkhenHjGFhXF7NY4JVWyBbA_iZt8DHDQoZ2FeTtygo")',
          }}
          aria-hidden="true"
        />

        {/* Card content */}
        <div className="absolute inset-0 p-8 flex flex-col justify-between">
          <div className="flex items-start justify-between">
            <span
              className="text-[20px] tracking-widest font-bold bg-gradient-to-b from-white to-[#94A3B8] bg-clip-text text-transparent"
              style={{ fontFamily: DISPLAY_FONT, lineHeight: '1.2', letterSpacing: '-0.01em' }}
            >
              AURA
            </span>
            <CreditCard className="w-[30px] h-[30px] text-[var(--aura-chrome-bright)]/60" />
          </div>

          <div className="space-y-1">
            <p
              className="text-[12px] tracking-[0.3em] font-bold uppercase text-[var(--aura-chrome-bright)]"
              style={{ fontFamily: BODY_FONT, lineHeight: '1' }}
            >
              {profile.name.toUpperCase()}
            </p>
            <p
              className="text-[10px] tracking-wider text-[var(--aura-chrome-soft)]/40"
              style={{ fontFamily: BODY_FONT, lineHeight: '1', letterSpacing: '0.1em', fontWeight: 700 }}
            >
              {t('stitch.accountDashboard.memberSince', 'MEMBER SINCE {{year}}', { year: profile.memberSince })}
            </p>
          </div>
        </div>
      </div>
    </section>
  );
}
