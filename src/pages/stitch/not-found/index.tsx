import { useState } from 'react';
import { StitchShell } from '../StitchBase';
import { PageHeader, PageFooter } from '@/components/stitch/StitchLayout'

const ICON_SEARCH = '\u{1F50D}';
const ICON_HELP = '\u{2753}';
const ICON_BACK = '\u{2190}';

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
          filter: 'blur(60px)',
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
          filter: 'blur(60px)',
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
              "url('https://lh3.googleusercontent.com/aida-public/AB6AXuDloQ_C_dQR_slTZga2tQ9VSEjVJudYi6IPeLpnwnC7hDfuqVEcjpXJsgWXOGRIK4L5UsfTo6dkaUBJqnWKhmIufoXxYtSXMMmlTkFKcGC0ZAreqadMGwJLnILh5y39wDCXGjl0mDpIL1f0zGjOa1Y-sYD8qHTG2YHH3PvebfGCNmvFOpl8ng2JZkdA-0XrdqEkE7XC8TP56cnAl_yPI_Wcp_P55FVtONwTJPpIgpKfvzUGH126MnsPZVcksY76m9ZDU8wZnnywXR4')",
          }}
        />
      </div>

      {/* Top Navigation */}
<PageHeader brand="AURA CAFE" scrollEffect />

      {/* Main Content */}
      <main className="flex-grow flex items-center justify-center px-6 pt-20 pb-20 min-h-screen">
        <div className="glass-panel max-w-lg w-full py-16 px-8 text-center rounded-lg relative overflow-hidden group">
          <div className="absolute inset-0 bg-gradient-to-tr from-transparent via-white/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-700 pointer-events-none" />

          <div className="mb-4">
            <h2 className="font-display text-[120px] md:text-[180px] leading-none text-[var(--aura-chrome-bright)] tracking-tighter opacity-90 select-none">
              404
            </h2>
          </div>

          <div className="space-y-2 mb-12">
            <p className="font-headline-md text-headline-md text-on-surface uppercase tracking-widest">
              Page not found
            </p>
            <p className="font-body-md text-body-md text-on-surface-variant italic">
              Không tìm thấy trang
            </p>
          </div>

          <div className="flex flex-col items-center gap-6">
            <a
              href="/"
              className="btn-hover-effect inline-flex items-center justify-center bg-[var(--aura-tertiary)] text-[var(--aura-noir-deep)] px-8 py-4 font-label-caps text-label-caps rounded-sm transition-transform active:scale-95"
            >
              Return Home / Quay về trang chủ
            </a>
            <div className="w-12 h-px bg-outline-variant/30" />
            <div className="flex gap-8">
              <button
                type="button"
                className="text-on-surface-variant hover:text-[var(--aura-tertiary)] transition-colors duration-300"
                aria-label="Search"
              >
                {ICON_SEARCH}
              </button>
              <button
                type="button"
                className="text-on-surface-variant hover:text-[var(--aura-tertiary)] transition-colors duration-300"
                aria-label="Help"
              >
                {ICON_HELP}
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
