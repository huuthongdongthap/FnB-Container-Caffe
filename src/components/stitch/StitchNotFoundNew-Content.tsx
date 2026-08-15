import { useTranslation } from 'react-i18next';
import { Search, HelpCircle, Home } from 'lucide-react';
import { cn } from '@/lib/cn';
import { glassPanelClasses } from './StitchNotFoundNew-constants';
import type { StitchNotFoundNewProps } from './StitchNotFoundNew-types';

type ContentProps = Pick<StitchNotFoundNewProps, 'onNavigateHome' | 'onSearch' | 'onHelp'>;

export function Content({ onNavigateHome, onSearch, onHelp }: ContentProps) {
  const { t } = useTranslation();

  return (
    <main className="flex-grow flex items-center justify-center min-h-screen px-6 pt-20 pb-5">
      <div
        className={cn(
          glassPanelClasses,
          'max-w-lg w-full py-16 px-8 text-center rounded-lg relative overflow-hidden group',
        )}
      >
        {/* Subtle highlight shine on hover */}
        <div className="absolute inset-0 bg-gradient-to-tr from-transparent via-white/[0.05] to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-700 pointer-events-none" />

        {/* 404 hero */}
        <div className="mb-1">
          <h2
            className="font-['EB_Garamond'] text-[120px] md:text-[180px] leading-none tracking-tighter opacity-90 select-none"
            style={{
              color: 'var(--aura-chrome-bright)',
              textShadow: '0 0 20px rgba(198, 198, 199, 0.2)',
            }}
          >
            404
          </h2>
        </div>

        {/* Message cluster */}
        <div className="space-y-2 mb-12">
          <p className="font-['Space_Grotesk'] text-[24px] font-bold leading-tight text-[var(--aura-text-primary)] uppercase tracking-widest">
            {t('notFound.title', 'Page not found')}
          </p>
          <p className="font-['Space_Grotesk'] text-[16px] leading-relaxed italic text-[var(--aura-chrome-soft)]">
            {t('notFound.subtitle', 'Khong tim thay trang')}
          </p>
        </div>

        {/* Call to action */}
        <div className="flex flex-col items-center gap-6">
          <button
            onClick={onNavigateHome}
            className="inline-flex items-center justify-center gap-3 bg-[var(--aura-bronze-shimmer)] text-[var(--aura-text-primary)] px-8 py-4 font-['Space_Grotesk'] text-[12px] font-semibold tracking-[0.1em] uppercase rounded-sm transition-transform active:scale-95 hover:brightness-110 overflow-hidden relative group/btn"
          >
            <Home className="w-4 h-4" />
            {t('notFound.returnHome', 'Return Home / Quay ve trang chu')}
          </button>

          <div className="w-12 h-px bg-[var(--aura-chrome-soft)]/30" />

          <div className="flex gap-8">
            <button
              onClick={onSearch}
              className="text-[var(--aura-chrome-soft)] hover:text-[var(--aura-chrome-bright)] transition-colors duration-300"
              aria-label="Search"
            >
              <Search className="w-5 h-5" />
            </button>
            <button
              onClick={onHelp}
              className="text-[var(--aura-chrome-soft)] hover:text-[var(--aura-chrome-bright)] transition-colors duration-300"
              aria-label="Help"
            >
              <HelpCircle className="w-5 h-5" />
            </button>
          </div>
        </div>
      </div>
    </main>
  );
}
