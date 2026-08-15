/**
 * DashBottomNav — bottom navigation bar for StitchAccountDashNew
 */
import type React from 'react';
import { useTranslation } from 'react-i18next';
import { clsx } from 'clsx';
import { User, Medal, ReceiptText, Armchair } from 'lucide-react';
import { BODY_FONT } from './StitchAccountDashNew-constants';

/* ─── Bottom Navigation Item ────────────────────────────────── */
function DashBottomNavItem({
  icon,
  label,
  active,
  href,
}: {
  icon: React.ReactNode;
  label: string;
  active?: boolean;
  href?: string;
}) {
  const Tag = href ? 'a' : 'button';
  const linkProps = href ? { href, target: '_self' as const } : {};
  return (
    <Tag
      type={href ? undefined : 'button'}
      className={clsx(
        'flex flex-col items-center justify-center',
        active
          ? 'text-[var(--aura-chrome-bright)] font-bold active:scale-90 transition-transform'
          : 'text-[var(--aura-chrome-soft)] hover:text-[var(--aura-chrome-bright)] transition-colors active:scale-90 transition-transform',
      )}
      aria-current={active ? 'page' : undefined}
      aria-label={label}
      {...linkProps}
    >
      {icon}
      <span
        className="mt-1 text-[10px] font-bold tracking-wider uppercase"
        style={{ fontFamily: BODY_FONT, lineHeight: '1' }}
      >
        {label}
      </span>
    </Tag>
  );
}

/* ─── Bottom Navigation Bar ─────────────────────────────────── */
export function DashBottomNav() {
  const { t } = useTranslation();
  return (
    <nav
      className="fixed bottom-0 left-0 right-0 z-50 flex items-center justify-around h-20 px-4 bg-[var(--aura-surface-dim)]/90 backdrop-blur-2xl border-t border-white/10"
      aria-label={t('stitch.accountDashboard.navAriaLabel') || 'Main navigation'}
    >
      <DashBottomNavItem
        icon={<Armchair className="w-6 h-6" />}
        label={t('stitch.accountDashboard.navReserve', 'Reserve')}
        href="/menu"
      />
      <DashBottomNavItem
        icon={<ReceiptText className="w-6 h-6" />}
        label={t('stitch.accountDashboard.navOrders', 'Orders')}
        href="/menu"
      />
      <DashBottomNavItem
        icon={<Medal className="w-6 h-6" />}
        label={t('stitch.accountDashboard.navLoyalty', 'Loyalty')}
        href="/menu"
      />
      <DashBottomNavItem
        icon={<User className="w-6 h-6" />}
        label={t('stitch.accountDashboard.navAccount', 'Account')}
        active
      />
    </nav>
  );
}
