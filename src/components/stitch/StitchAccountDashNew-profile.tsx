/**
 * DashProfileSection — profile header card for StitchAccountDashNew
 */
import { useTranslation } from 'react-i18next';
import type { DashAccountProfile } from './StitchAccountDashNew-types';
import { BODY_FONT, DISPLAY_FONT } from './StitchAccountDashNew-constants';

interface DashProfileSectionProps {
  profile: DashAccountProfile;
  setGlassCardRef: (el: HTMLElement | null) => void;
}

export function DashProfileSection({ profile, setGlassCardRef }: DashProfileSectionProps) {
  const { t } = useTranslation();
  return (
    <section
      ref={setGlassCardRef}
      className="relative rounded-xl px-6 py-6 overflow-hidden bg-[rgba(30,41,59,0.4)] backdrop-blur-xl border border-white/10 shadow-[inset_0_1px_0_0_rgba(205,127,50,0.3)]"
      aria-label={t('stitch.accountDashboard.profileSectionAriaLabel') || 'Profile'}
    >
      <div
        className="absolute top-0 right-0 w-32 h-32 opacity-20 pointer-events-none"
        aria-hidden="true"
      />
      <div className="flex items-center gap-4">
        <div className="relative">
          <div
            className="w-20 h-20 rounded-full overflow-hidden border-2"
            style={{ borderColor: 'rgba(255,183,121,0.3)' }}
          >
            <img
              className="w-full h-full object-cover"
              src={profile.avatar}
              alt={t('stitch.accountDashboard.avatarAlt', { name: profile.name }) || profile.name}
              loading="lazy"
            />
          </div>
          <div
            className="absolute -bottom-1 -right-1 bg-[var(--aura-chrome-bright)] text-[var(--aura-noir-deep)] px-2 py-0.5 rounded-full text-[8px] font-bold tracking-widest uppercase"
            style={{ fontFamily: BODY_FONT, lineHeight: '1' }}
          >
            {profile.tier}
          </div>
        </div>
        <div>
          <h2
            className="text-[24px] text-[var(--aura-chrome-bright)]"
            style={{ fontFamily: DISPLAY_FONT, lineHeight: '1.4', fontWeight: 500 }}
          >
            {profile.name}
          </h2>
          <p
            className="text-[10px] font-bold tracking-widest uppercase text-[var(--aura-chrome-bright)]"
            style={{ fontFamily: BODY_FONT, lineHeight: '1' }}
          >
            {t('stitch.accountDashboard.tierMember', { tier: profile.tier }) || `${profile.tier} Tier Member`}
          </p>
        </div>
      </div>
    </section>
  );
}
