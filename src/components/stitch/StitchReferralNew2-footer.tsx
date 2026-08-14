/**
 * Bottom navigation bar (mobile only) for the referral page.
 * Displays nav links with icons for menu, referrals, rewards, and profile.
 */

import { useTranslation } from 'react-i18next';
import { BODY_FONT } from './StitchReferralNew2-constants';
import { MenuIcon, GroupAddIcon, MedalIcon, PersonIcon } from './StitchReferralNew2-icons';

const NAV_LINKS = [
  { key: 'menu', href: '#menu', labelKey: 'stitch.referral.navMenu', icon: MenuIcon, active: false },
  { key: 'referrals', href: '#referrals', labelKey: 'stitch.referral.navReferrals', icon: GroupAddIcon, active: true },
  { key: 'rewards', href: '#rewards', labelKey: 'stitch.referral.navRewards', icon: MedalIcon, active: false },
  { key: 'profile', href: '#profile', labelKey: 'stitch.referral.navProfile', icon: PersonIcon, active: false },
];

export function ReferralFooter() {
  const { t } = useTranslation();
  return (
    <nav
      className="fixed bottom-0 z-50 flex h-20 w-full items-center justify-around border-t border-white/10 bg-[#061c35]/60 px-2 pb-4 backdrop-blur-xl md:hidden"
      role="navigation"
      aria-label={t('stitch.referral.navAria')}
    >
      {NAV_LINKS.map((link) => {
        const IconComp = link.icon;
        const isActive = link.active;
        const label = t(link.labelKey);
        return (
          <a
            key={link.key}
            href={link.href}
            className={`flex flex-col items-center justify-center transition-all duration-200 active:scale-90 ${
              isActive
                ? 'rounded-full bg-[#39475e]/40 px-4 py-1 text-[#efbd8a]'
                : 'text-[var(--aura-text-secondary, #a0a8b0)]'
            }`}
            aria-label={label}
            aria-current={isActive ? 'page' : undefined}
          >
            <IconComp className="h-6 w-6" />
            <span className={`${BODY_FONT} mt-1 text-[10px] font-medium`}>{label}</span>
          </a>
        );
      })}
    </nav>
  );
}
