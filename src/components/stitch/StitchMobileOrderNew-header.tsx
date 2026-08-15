/**
 * Fixed header with back button, table title, and toggleable inline search bar.
 */
import { useTranslation } from 'react-i18next';
import { clsx } from 'clsx';
import { Search, ArrowLeft } from 'lucide-react';

interface OrderHeaderProps {
  tableId: string;
  showSearch: boolean;
  searchQuery: string;
  onBack?: () => void;
  onToggleSearch: () => void;
  onSearchChange: (query: string) => void;
}

export function OrderHeader({
  tableId,
  showSearch,
  searchQuery,
  onBack,
  onToggleSearch,
  onSearchChange,
}: Readonly<OrderHeaderProps>) {
  const { t } = useTranslation();

  return (
    <header
      className="fixed top-0 left-0 w-full z-50"
      style={{
        background: 'rgba(10, 26, 46, 0.6)',
        backdropFilter: 'blur(24px)',
        WebkitBackdropFilter: 'blur(24px)',
        borderBottom: '0.5px solid rgba(229, 228, 226, 0.15)',
      }}
    >
      <div className="flex items-center justify-between px-5 h-12">
        <button
          type="button"
          onClick={onBack}
          className="active:scale-95 transition-transform text-[#ffb779]"
          aria-label={t('stitch.ordering.back', { defaultValue: 'Go back' })}
        >
          <ArrowLeft className="w-5 h-5" />
        </button>
        <h1 className="font-display text-[18px] text-[var(--aura-text-primary, #e8e8e8)] font-medium">
          {t('stitch.ordering.tableTitle', {
            tableId,
            defaultValue: `Table ${tableId} — Dining in`,
          })}
        </h1>
        <button
          type="button"
          onClick={onToggleSearch}
          className={clsx(
            'active:scale-95 transition-transform',
            showSearch ? 'text-[var(--aura-text-primary, #e8e8e8)]' : 'text-[#ffb779]',
          )}
          aria-label={t('stitch.ordering.toggleSearch', {
            defaultValue: showSearch ? 'Close search' : 'Open search',
          })}
        >
          <Search className="w-5 h-5" />
        </button>
      </div>

      {showSearch && (
        <div className="px-5 pb-3">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[var(--aura-text-secondary, #a0a8b0)]" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => onSearchChange(e.target.value)}
              placeholder={t('stitch.ordering.searchPlaceholder', {
                defaultValue: 'Search menu...',
              })}
              className="w-full pl-10 pr-4 py-2.5 rounded-xl text-[13px] font-body bg-[rgba(255,255,255,0.05)] border border-[rgba(255,255,255,0.08)] text-[var(--aura-text-primary, #e8e8e8)] placeholder:text-[var(--aura-text-secondary, #a0a8b0)] focus:outline-none focus:border-[rgba(198,198,199,0.3)] focus:ring-1 focus:ring-[rgba(198,198,199,0.1)] transition-all"
              aria-label={t('stitch.ordering.searchInput', {
                defaultValue: 'Search menu items',
              })}
              autoFocus
            />
          </div>
        </div>
      )}
    </header>
  );
}
