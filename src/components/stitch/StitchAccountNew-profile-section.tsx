/**
 * Profile section for StitchAccountNew.
 * Extracted from StitchAccountNew.tsx to keep individual files under 200 LOC.
 */

'use client';

import { useTranslation } from 'react-i18next';
import type { AccountProfileNew } from './StitchAccountNew-types';

const glassCardStyle = {
  background: 'rgba(30, 41, 59, 0.4)',
  backdropFilter: 'blur(24px)',
  WebkitBackdropFilter: 'blur(24px)',
  border: '1px solid rgba(255, 255, 255, 0.1)',
} as const;

/* ─── Profile Section ─────────────────────────────────────────── */

export function AccountNewProfileSection({
  profile,
}: {
  profile: AccountProfileNew;
}) {
  const { t } = useTranslation();
  return (
    <section
      className="relative rounded-xl p-6 overflow-hidden"
      style={glassCardStyle}
      aria-label={t('stitch.accountDashboard.profileSectionAriaLabel') || 'Profile'}
    >
      {/* Decorative glow */}
      <div
        className="absolute top-0 right-0 w-32 h-32 rounded-full pointer-events-none"
        style={{
          background: 'radial-gradient(circle, rgba(212,165,116,0.15), transparent 70%)',
          transform: 'translate(20%, -20%)',
        }}
      />

      <div className="flex items-center gap-5 relative z-10">
        <div className="relative">
          <div className="w-20 h-20 rounded-full border-2 border-[#d4a574] p-1">
            <img
              className="w-full h-full rounded-full object-cover"
              src={profile.avatar}
              alt={t('stitch.accountDashboard.avatarAlt', { name: profile.name })}
              loading="lazy"
            />
          </div>
          <div
            className="absolute -bottom-1 -right-1 px-2 py-0.5 rounded-full text-[8px] font-bold uppercase tracking-widest"
            style={{
              background: 'linear-gradient(135deg, #CD7F32 0%, #A0522D 100%)',
              color: '#1a1a2e',
            }}
          >
            {profile.tier}
          </div>
        </div>
        <div>
          <h2
            className="text-[clamp(1.1rem,3vw,1.5rem)] font-semibold"
            style={{ fontFamily: "var(--aura-font-display)" }}
          >
            {profile.name}
          </h2>
          <p className="text-[10px] font-bold tracking-widest uppercase mt-1 text-[#d4a574]">
            {t('stitch.accountDashboard.tierMember', { tier: profile.tier })}
          </p>
        </div>
      </div>
    </section>
  );
}
