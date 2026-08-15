/**
 * Bottom navigation components for StitchAccountNew.
 * Extracted from StitchAccountNew.tsx to keep individual files under 200 LOC.
 */

'use client';

import { useTranslation } from 'react-i18next';
import { clsx } from 'clsx';
import {
  User,
  Menu as MenuIcon,
  Medal,
  ReceiptText,
} from 'lucide-react';

/* ─── Bottom Navigation Item ──────────────────────────────────── */

function BottomNavItem({
  icon,
  label,
  active,
}: {
  icon: React.ReactNode;
  label: string;
  active?: boolean;
}) {
  return (
    <button
      type="button"
      className={clsx(
        'flex flex-col items-center justify-center gap-1 transition-all active:scale-90 min-w-[48px] min-h-[48px] rounded-full px-4 py-1',
        active
          ? 'text-[#d4a574] bg-[rgba(212,165,116,0.1)]'
          : 'text-[#5a6270] hover:text-[var(--aura-text-secondary, #a0a8b0)] hover:bg-white/5',
      )}
      aria-current={active ? 'page' : undefined}
      aria-label={label}
    >
      {icon}
      <span className="text-[10px] font-bold tracking-wider uppercase">{label}</span>
    </button>
  );
}

/* ─── Bottom Navigation Bar ───────────────────────────────────── */

export function AccountNewBottomNav() {
  const { t } = useTranslation();
  return (
    <nav
      className="fixed bottom-0 left-0 right-0 z-50 flex items-center justify-around px-6 py-3 pb-8"
      style={{
        background: 'rgba(21, 32, 49, 0.4)',
        backdropFilter: 'blur(24px)',
        WebkitBackdropFilter: 'blur(24px)',
        borderTop: '1px solid rgba(255,255,255,0.1)',
      }}
      aria-label={t('stitch.accountDashboard.navAriaLabel') || 'Main navigation'}
    >
      <BottomNavItem
        icon={<MenuIcon className="w-5 h-5" />}
        label={t('stitch.accountDashboard.navReserve')}
      />
      <BottomNavItem
        icon={<ReceiptText className="w-5 h-5" />}
        label={t('stitch.accountDashboard.navOrders')}
      />
      <BottomNavItem
        icon={<Medal className="w-5 h-5" />}
        label={t('stitch.accountDashboard.navLoyalty')}
      />
      <BottomNavItem
        icon={<User className="w-5 h-5" />}
        label={t('stitch.accountDashboard.navAccount')}
        active
      />
    </nav>
  );
}
