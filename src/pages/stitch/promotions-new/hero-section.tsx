import { Clock, Sparkles, ArrowRight } from 'lucide-react';
import type { CardOffer } from './types';

interface HeroSectionProps {
  offer: CardOffer;
  timer: number;
  formatTime: (sec: number) => string;
}

export function HeroSection({ offer, timer, formatTime }: HeroSectionProps) {
  return (
    <section className="px-4 sm:px-6 pt-2 pb-6 max-w-7xl mx-auto">
      <div className="relative overflow-hidden group rounded-3xl border border-[var(--aura-chrome-mid)]/20 shadow-2xl min-h-[460px] flex flex-col justify-end">
        {/* Background Image — Luxury Welcome Set */}
        <div className="absolute inset-0 z-0">
          <img
            className="w-full h-full object-cover transition-transform duration-1000 ease-out group-hover:scale-105"
            alt={offer.title}
            src={offer.image}
          />
          {/* Multi-layered cinematic gradient */}
          <div
            className="absolute inset-0"
            style={{
              background:
                'linear-gradient(180deg, rgba(10,26,46,0.3) 0%, rgba(10,26,46,0.7) 50%, rgba(10,26,46,0.98) 100%)',
            }}
            aria-hidden="true"
          />
        </div>

        {/* Content Glass Panel */}
        <div className="relative z-10 p-6 sm:p-10 max-w-3xl">
          <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
            <div
              className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-full text-xs font-bold uppercase tracking-[0.18em] shadow-md backdrop-blur-md"
              style={{
                background: 'rgba(10, 26, 46, 0.8)',
                border: '1px solid var(--aura-bronze-shimmer, #C9A96E)',
                color: 'var(--aura-bronze-shimmer, #C9A96E)',
              }}
            >
              <Sparkles className="w-3.5 h-3.5" aria-hidden="true" />
              <span>Ưu Đãi Đặc Biệt</span>
            </div>

            <div
              className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full backdrop-blur-md text-xs font-semibold tabular-nums"
              style={{
                background: 'rgba(10, 26, 46, 0.8)',
                border: '1px solid rgba(201, 214, 223, 0.25)',
                color: 'var(--aura-chrome-bright, #E8EEF3)',
              }}
            >
              <Clock className="w-3.5 h-3.5 text-[var(--aura-bronze-shimmer,#C9A96E)] animate-spin-slow" aria-hidden="true" />
              <span>Thời gian còn lại: <strong className="text-[var(--aura-bronze-shimmer,#C9A96E)]">{formatTime(timer)}</strong></span>
            </div>
          </div>

          <h2
            className="text-2xl sm:text-4xl md:text-5xl font-bold leading-tight mb-4 tracking-tight"
            style={{
              color: 'var(--aura-chrome-bright, #E8EEF3)',
              fontFamily: 'var(--aura-font-display)',
            }}
          >
            {offer.title}
          </h2>

          <p
            className="text-sm sm:text-base leading-relaxed mb-6 max-w-2xl font-light"
            style={{ color: 'var(--aura-chrome-soft, rgba(232,238,243,0.85))' }}
          >
            {offer.desc}
          </p>

          <div className="flex flex-wrap items-center gap-4">
            <a
              href="/menu"
              className="inline-flex items-center gap-2 px-8 py-3.5 rounded-full text-xs font-bold uppercase tracking-[0.18em] transition-all active:scale-95 hover:brightness-110 shadow-lg group/btn cursor-pointer"
              style={{
                background: 'linear-gradient(135deg, #C9A96E 0%, #E2D4B7 50%, #C9A96E 100%)',
                color: '#0A1A2E',
              }}
            >
              <span>Nhận Ưu Đãi Ngay</span>
              <ArrowRight className="w-4 h-4 transition-transform group-hover/btn:translate-x-1" />
            </a>

            <span className="text-xs text-[var(--aura-chrome-mid)] font-light">
              * Áp dụng tự động tại quầy hoặc khi gọi món trực tuyến
            </span>
          </div>
        </div>
      </div>
    </section>
  );
}
