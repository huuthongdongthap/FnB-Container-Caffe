/**
 * StitchNotFoundNew — 404 error screen for AURA CAFE
 *
 * Regenerated from the original Stitch HTML export:
 *   stitch-exports/new-screens/404-not-found.html
 *
 * Design tokens mapped to --aura-* CSS variables:
 *   --aura-surface-dim    -> main bg (#081425)
 *   --aura-chrome-bright  -> bright text (#c6c6c7)
 *   --aura-chrome-soft    -> muted text (#a0a0a0)
 *   --aura-bronze-shimmer -> CTA/accent (#d4a574)
 *   Display font: 'EB Garamond', serif
 *   Body font: 'Space Grotesk', sans-serif
 */
'use client';

import { useTranslation } from 'react-i18next';
import { HelmetHead } from '@/components/seo/HelmetHead';
import { cn } from '@/lib/cn';
import { Search, HelpCircle, Home } from 'lucide-react';

/* ─── Glass panel style — matches original stitch glass-panel ─── */

const glassPanelClasses =
  'bg-[rgba(16,20,23,0.6)] backdrop-blur-[20px] border border-[rgba(198,198,199,0.1)]';

/* ─── Props ─────────────────────────────────────────────────────── */

export interface StitchNotFoundNewProps {
  onNavigateHome?: () => void;
  onSearch?: () => void;
  onHelp?: () => void;
  onNavigate?: (path: string) => void;
}

/* ─── Component ──────────────────────────────────────────────────── */

export function StitchNotFoundNew({
  onNavigateHome,
  onSearch,
  onHelp,
  onNavigate,
}: StitchNotFoundNewProps) {
  const { t } = useTranslation();

  return (
    <>
      <HelmetHead
        title="Not Found"
        description="Page not found — Không tìm thấy trang. Return to AURA CAFE homepage."
      />

      {/* Noise overlay — matches original noise-overlay */}
      <div
        className="fixed inset-0 pointer-events-none opacity-[0.03] z-50"
        style={{
          backgroundImage:
            'url("data:image/svg+xml,%3Csvg viewBox=\'0 0 200 200\' xmlns=\'http://www.w3.org/2000/svg\'%3E%3Cfilter id=\'noiseFilter\'%3E%3CfeTurbulence type=\'fractalNoise\' baseFrequency=\'0.65\' numOctaves=\'3\' stitchTiles=\'stitch\'/%3E%3C/filter%3E%3Crect width=\'100%25\' height=\'100%25\' filter=\'url(%23noiseFilter)\'/%3E%3C/svg%3E")',
        }}
      />

      {/* Ambient floating orbs — matches original floating-orb */}
      <div className="fixed top-[-100px] left-[-100px] w-[400px] h-[400px] rounded-full pointer-events-none -z-10"
        style={{
          background: 'radial-gradient(circle, rgba(212, 165, 116, 0.08) 0%, rgba(8, 20, 37, 0) 70%)',
          filter: 'blur(60px)',
          animation: 'aura-orb-drift-404 20s infinite alternate ease-in-out',
        }}
      />
      <div className="fixed bottom-[-100px] right-[-100px] w-[400px] h-[400px] rounded-full pointer-events-none -z-10"
        style={{
          background: 'radial-gradient(circle, rgba(212, 165, 116, 0.06) 0%, rgba(8, 20, 37, 0) 70%)',
          filter: 'blur(60px)',
          animation: 'aura-orb-drift-404 20s infinite alternate-reverse ease-in-out 10s',
        }}
      />

      {/* Background atmospheric image */}
      <div className="fixed inset-0 -z-20 opacity-20 grayscale pointer-events-none">
        <div
          className="w-full h-full bg-cover bg-center"
          style={{
            backgroundImage:
              'url("https://lh3.googleusercontent.com/aida-public/AB6AXuDloQ_C_dQR_slTZga2tQ9VSEjVJudYi6IPeLpnwnC7hDfuqVEcjpXJsgWXOGRIK4L5UsfTo6dkaUBJqnWKhmIufoXxYtSXMMmlTkFKcGC0ZAreqadMGwJLnILh5y39wDCXGjl0mDpIL1f0zGjOa1Y-sYD8qHTG2YHH3PvebfGCNmvFOpl8ng2JZkdA-0XrdqEkE7XC8TP56cnAl_yPI_Wcp_P55FVtONwTJPpIgpKfvzUGH126MnsPZVcksY76m9ZDU8wZnnywXR4")',
          }}
        />
      </div>

      {/* Top Navigation Bar */}
      <header className="fixed top-0 w-full backdrop-blur-md bg-[var(--aura-surface-dim)]/40 flex items-center justify-between px-5 h-20 z-40">
        <button
          onClick={() => onNavigate?.('/menu')}
          className="text-[var(--aura-chrome-bright)] cursor-pointer hover:opacity-80 transition-opacity"
          aria-label="Menu"
        >
          <MenuIcon />
        </button>
        <div className="absolute left-1/2 -translate-x-1/2">
          <h1 className="font-['EB_Garamond'] text-[40px] leading-none tracking-tighter text-[var(--aura-chrome-bright)]">
            AURA CAFE
          </h1>
        </div>
        <div className="w-8" />
      </header>

      {/* Main Content */}
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
              {t('notFound.subtitle', 'Không tìm thấy trang')}
            </p>
          </div>

          {/* Call to action */}
          <div className="flex flex-col items-center gap-6">
            <button
              onClick={onNavigateHome}
              className="inline-flex items-center justify-center gap-3 bg-[var(--aura-bronze-shimmer)] text-[var(--aura-text-primary)] px-8 py-4 font-['Space_Grotesk'] text-[12px] font-semibold tracking-[0.1em] uppercase rounded-sm transition-transform active:scale-95 hover:brightness-110 overflow-hidden relative group/btn"
            >
              <Home className="w-4 h-4" />
              {t('notFound.returnHome', 'Return Home / Quay về trang chủ')}
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

      {/* Footer */}
      <footer className="fixed bottom-0 w-full flex flex-col items-center gap-1 pb-5 z-40">
        <div className="flex gap-6 mb-2">
          {[
            { label: 'Privacy', path: '/privacy' },
            { label: 'Terms', path: '/terms' },
            { label: 'Contact', path: '/contact' },
          ].map((link) => (
            <button
              key={link.label}
              onClick={() => onNavigate?.(link.path)}
              className="font-['Space_Grotesk'] text-[12px] font-semibold tracking-[0.1em] uppercase text-[var(--aura-chrome-soft)] hover:text-[var(--aura-bronze-shimmer)] transition-colors"
            >
              {link.label}
            </button>
          ))}
        </div>
        <p className="font-['Space_Grotesk'] text-[12px] font-semibold tracking-[0.2em] text-[var(--aura-bronze-shimmer)]">
          &copy; 2024 AURA CAFE. INDUSTRIAL LUXURY.
        </p>
      </footer>

      {/* Keyframes for orb drift */}
      <style>{`
        @keyframes aura-orb-drift-404 {
          from { transform: translate(-10%, -10%); }
          to { transform: translate(10%, 10%); }
        }
      `}</style>
    </>
  );
}

/* ─── Inline menu icon (three horizontal bars) ──────────────────── */

function MenuIcon() {
  return (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <line x1="4" y1="6" x2="20" y2="6" />
      <line x1="4" y1="12" x2="20" y2="12" />
      <line x1="4" y1="18" x2="20" y2="18" />
    </svg>
  );
}
