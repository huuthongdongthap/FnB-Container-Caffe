/**
 * StitchOrderMgmtNew Top App Bar
 * Fixed top bar with hamburger menu, title, notifications, and admin avatar.
 */
import { useTranslation } from 'react-i18next';
import { cn } from '@/lib/cn';
import { Bell, HelpCircle, Menu } from 'lucide-react';

/* ─── Props ──────────────────────────────────────────────────────────── */

interface TopBarProps {
  headerTitle: string;
  headerSubtitle: string;
  adminName: string;
  adminAvatarUrl: string;
  onToggleSidebar: () => void;
}

/* ─── Top App Bar Component ──────────────────────────────────────────── */

export function StitchOrderMgmtTopBar({
  headerTitle,
  headerSubtitle,
  adminName,
  adminAvatarUrl,
  onToggleSidebar,
}: Readonly<TopBarProps>) {
  const { t } = useTranslation();
  const tTerminal = (key: string) => t(`terminal.${key}`);

  return (
    <header
      className={cn(
        'fixed right-0 top-0 z-30 flex h-16 items-center justify-between border-b border-white/10 bg-[var(--aura-bg-page, #0A1A2E)]/60 px-4 backdrop-blur-md md:px-6',
        'left-0 md:left-[280px]',
      )}
      aria-label={tTerminal('topBar')}
    >
      <div className="flex items-center gap-4">
        {/* Mobile hamburger */}
        <button
          className="text-[var(--aura-text-secondary, #a0a8b0)] transition-colors hover:text-[var(--aura-primary, #c6c6c7)] md:hidden"
          onClick={onToggleSidebar}
          aria-label={tTerminal('openSidebar')}
        >
          <Menu size={24} />
        </button>

        <span className="font-sans text-xl font-semibold text-[var(--aura-primary, #c6c6c7)]">
          {headerTitle}
        </span>

        <span className="hidden h-4 w-px bg-white/10 md:block" aria-hidden="true" />

        <span className="hidden font-sans text-[12px] font-bold uppercase tracking-[0.1em] text-[var(--aura-text-secondary, #a0a8b0)] md:block">
          {headerSubtitle}
        </span>
      </div>

      {/* Right actions */}
      <div className="flex items-center gap-4 md:gap-6">
        <button
          className="text-[var(--aura-text-secondary, #a0a8b0)] transition-all hover:text-[var(--aura-primary, #c6c6c7)]"
          aria-label={tTerminal('notifications')}
        >
          <Bell size={20} />
        </button>
        <button
          className="text-[var(--aura-text-secondary, #a0a8b0)] transition-all hover:text-[var(--aura-primary, #c6c6c7)]"
          aria-label={tTerminal('help')}
        >
          <HelpCircle size={20} />
        </button>
        {/* Admin avatar */}
        <div
          className="flex h-8 w-8 items-center justify-center overflow-hidden rounded-full border border-white/10 bg-[#292a2c]"
          aria-label={tTerminal('adminAvatar')}
        >
          {adminAvatarUrl ? (
            <img
              className="h-full w-full object-cover"
              src={adminAvatarUrl}
              alt={tTerminal('adminAvatar')}
            />
          ) : (
            <span className="text-xs font-bold text-[var(--aura-text-secondary, #a0a8b0)]">
              {adminName.charAt(0).toUpperCase()}
            </span>
          )}
        </div>
      </div>
    </header>
  );
}
