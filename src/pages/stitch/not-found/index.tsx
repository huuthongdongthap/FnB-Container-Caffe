import { useState } from 'react';
import { StitchShell } from '../StitchBase';
import { PageHeader, PageFooter } from '@/components/stitch/StitchLayout';
import { HelmetHead } from '@/components/seo/HelmetHead';
import { Utensils, CalendarDays, PhoneCall, Home } from 'lucide-react';

const ICON_SEARCH = '\u{1F50D}';
const ICON_HELP = '\u{2753}';

export default function NotFoundNew() {
  const [mousePos, setMousePos] = useState({ x: 0, y: 0 });

  const handleMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    setMousePos({ x: e.clientX, y: e.clientY });
  };

  const handleWander = (e: React.MouseEvent<HTMLDivElement>) => {
    const factor = (e.currentTarget.dataset.idx || '0') as '0' | '1';
    const f = parseInt(factor, 10) * 20;
    const orb = e.currentTarget;
    orb.style.transform = `translate(${mousePos.x * f / window.innerWidth}px, ${mousePos.y * f / window.innerHeight}px)`;
  };

  return (
    <StitchShell>
      <HelmetHead
        title="404 — Không Tìm Thấy Trang | AURA CAFE"
        description="Trang bạn tìm kiếm không tồn tại hoặc đã được chuyển dời. Quay về trang chủ AURA CAFE Sa Đéc."
      />
      <div
        className="noise-overlay fixed inset-0 pointer-events-none opacity-[0.03] z-50"
        style={{
          backgroundImage:
            "url(\"data:image/svg+xml,%3Csvg viewBox='0 0 200 200' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noiseFilter'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.65' numOctaves='3' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noiseFilter)'/%3E%3C/svg%3E\")",
        }}
        aria-hidden="true"
      />
      <div
        className="floating-orb fixed w-[400px] h-[400px] rounded-full z-[-1]"
        style={{
          background: 'radial-gradient(circle, rgba(212,165,116,0.08) 0%, rgba(8,20,37,0) 70%)',
          filter: 'blur(8px)',
          animation: 'drift 20s infinite alternate ease-in-out',
          top: '-100px',
          left: '-100px',
        }}
        onMouseMove={handleWander}
      />
      <div
        className="floating-orb fixed w-[400px] h-[400px] rounded-full z-[-1]"
        style={{
          background: 'radial-gradient(circle, rgba(212,165,116,0.08) 0%, rgba(8,20,37,0) 70%)',
          filter: 'blur(8px)',
          animation: 'drift 20s infinite alternate ease-in-out',
          bottom: '-100px',
          right: '-100px',
          animationDelay: '-10s',
        }}
        onMouseMove={handleWander}
      />

      {/* Background atmosphere */}
      <div
        className="fixed inset-0 -z-20 opacity-20 grayscale pointer-events-none"
        aria-hidden="true"
      >
        <div
          className="w-full h-full bg-cover bg-center"
          role="img"
          aria-label="A cinematic, low-angle shot of a high-end industrial cafe interior at night. The scene features raw concrete walls, exposed dark metal beams, and polished black floors. Minimalist bronze lighting fixtures cast soft, amber glows against the deep navy shadows. Large frosted glass partitions create a sense of depth and mystery in the background."
          style={{
            backgroundImage:
              "url('/photos/IMG_6703.webp')",
          }}
        />
      </div>

      {/* Top Navigation */}
      <PageHeader brand="AURA CAFE" scrollEffect />

      {/* Main Content */}
      <main className="flex-grow flex items-center justify-center px-4 sm:px-6 pt-24 pb-20 min-h-screen overflow-x-hidden">
        <div className="glass-panel max-w-xl w-full py-12 px-6 sm:px-10 text-center rounded-2xl relative overflow-hidden group border border-white/10 shadow-2xl backdrop-blur-md">
          <div className="absolute inset-0 bg-gradient-to-tr from-transparent via-white/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-700 pointer-events-none" />

          <div className="mb-2">
            <h2 className="font-display text-[110px] md:text-[160px] leading-none text-[var(--aura-chrome-bright)] tracking-tighter opacity-90 select-none">
              404
            </h2>
          </div>

          <div className="space-y-2 mb-8">
            <p className="font-headline-md text-headline-md text-on-surface uppercase tracking-widest font-semibold">
              Page not found
            </p>
            <p className="font-body-md text-body-md text-on-surface-variant italic text-sm sm:text-base">
              Không tìm thấy trang — Đường dẫn có thể đã thay đổi hoặc không tồn tại.
            </p>
          </div>

          <div className="flex flex-col items-center gap-5 w-full">
            <a
              href="/"
              className="btn-hover-effect inline-flex items-center justify-center gap-2 bg-[var(--aura-chrome-bright)] text-[#0A1A2E] px-8 py-3.5 min-h-[44px] font-bold text-xs uppercase tracking-wider rounded-full transition-transform active:scale-95 shadow-lg w-full sm:w-auto"
            >
              <Home className="w-4 h-4" /> Return Home / Quay về trang chủ
            </a>

            {/* Quick Links for F&B customer journeys */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 w-full pt-3 border-t border-white/10">
              <a
                href="/menu"
                className="inline-flex items-center justify-center gap-2 px-4 py-3 min-h-[44px] rounded-xl bg-white/5 border border-white/10 text-xs font-semibold text-[var(--aura-chrome-bright)] hover:bg-white/10 hover:border-white/20 transition-all active:scale-95"
              >
                <Utensils className="w-3.5 h-3.5 text-[#4A7C59]" /> Thực đơn
              </a>
              <a
                href="/table-reservation"
                className="inline-flex items-center justify-center gap-2 px-4 py-3 min-h-[44px] rounded-xl bg-white/5 border border-white/10 text-xs font-semibold text-[var(--aura-chrome-bright)] hover:bg-white/10 hover:border-white/20 transition-all active:scale-95"
              >
                <CalendarDays className="w-3.5 h-3.5 text-[var(--aura-chrome-mid)]" /> Đặt bàn
              </a>
              <a
                href="/contact"
                className="inline-flex items-center justify-center gap-2 px-4 py-3 min-h-[44px] rounded-xl bg-white/5 border border-white/10 text-xs font-semibold text-[var(--aura-chrome-bright)] hover:bg-white/10 hover:border-white/20 transition-all active:scale-95"
              >
                <PhoneCall className="w-3.5 h-3.5 text-[var(--aura-chrome-bright)]" /> Liên hệ
              </a>
            </div>

            <div className="w-12 h-px bg-outline-variant/30 mt-2" />
            <div className="flex gap-4">
              <button
                type="button"
                className="min-h-[44px] min-w-[44px] flex items-center justify-center text-on-surface-variant hover:text-[var(--aura-chrome-bright)] hover:bg-white/5 rounded-full transition-colors duration-300"
                aria-label="Search"
              >
                <span className="text-lg">{ICON_SEARCH}</span>
              </button>
              <button
                type="button"
                className="min-h-[44px] min-w-[44px] flex items-center justify-center text-on-surface-variant hover:text-[var(--aura-chrome-bright)] hover:bg-white/5 rounded-full transition-colors duration-300"
                aria-label="Help"
              >
                <span className="text-lg">{ICON_HELP}</span>
              </button>
            </div>
          </div>
        </div>
      </main>

      {/* Footer */}
      <PageFooter
        brand="{'©'} 2024 AURA CAFE. INDUSTRIAL LUXURY."
        socialSize="sm"
      />

      <style>{`
        @keyframes drift {
          from { transform: translate(-10%, -10%); }
          to { transform: translate(10%, 10%); }
        }
        .btn-hover-effect {
          position: relative;
          overflow: hidden;
          transition: all 0.3s ease;
        }
        .btn-hover-effect::after {
          content: '';
          position: absolute;
          top: 0;
          left: -100%;
          width: 100%;
          height: 100%;
          background: linear-gradient(90deg, transparent, rgba(255,255,255,0.2), transparent);
          transition: 0.5s;
        }
        .btn-hover-effect:hover::after {
          left: 100%;
        }
      `}</style>
    </StitchShell>
  );
}
