import { Link } from 'react-router-dom';
import { useState, useEffect, useCallback, type MouseEvent } from 'react';
import { Button } from '@/components/ui/button';

export function HeroSection() {
  const [cursorPos, setCursorPos] = useState({ x: 0, y: 0 });

  const handleMouseMove = useCallback(
    (e: MouseEvent) => {
      setCursorPos({ x: e.clientX, y: e.clientY });
    },
    [],
  );

  // Water ripple canvas animation
  useEffect(() => {
    const canvas = document.getElementById('water-ripple-canvas') as HTMLCanvasElement | null;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let animationId: number;
    let ripples: Array<{ x: number; y: number; radius: number; alpha: number }> = [];

    function resize() {
      const parent = canvas!.parentElement;
      if (parent) {
        canvas!.width = parent.offsetWidth;
        canvas!.height = parent.offsetHeight;
      }
    }

    function addRipple(x: number, y: number) {
      ripples.push({ x, y, radius: 0, alpha: 0.3 });
      if (ripples.length > 10) ripples.shift();
    }

    function animate() {
      ctx!.clearRect(0, 0, canvas!.width, canvas!.height);
      ripples = ripples.filter((r) => r.alpha > 0);
      for (const r of ripples) {
        r.radius += 0.8;
        r.alpha -= 0.005;
        ctx!.beginPath();
        ctx!.arc(r.x, r.y, r.radius, 0, Math.PI * 2);
        ctx!.strokeStyle = `rgba(201, 214, 223, ${r.alpha})`;
        ctx!.lineWidth = 1;
        ctx!.stroke();
      }
      animationId = requestAnimationFrame(animate);
    }

    resize();
    window.addEventListener('resize', resize);
    canvas.addEventListener('mousemove', (e) => {
      addRipple(e.offsetX, e.offsetY);
    });
    animate();

    return () => {
      cancelAnimationFrame(animationId);
      window.removeEventListener('resize', resize);
    };
  }, []);

  return (
    <section
      className="relative flex min-h-[90vh] items-center justify-center overflow-hidden bg-gradient-to-b from-[#050D1A] via-[#0A1A2E] to-[#0F172A]"
      onMouseMove={handleMouseMove}
      aria-label="AURA CAFE — Rooftop Container Café"
    >
      {/* Ambient orbs */}
      <div className="pointer-events-none absolute -left-[10%] -top-[10%] h-[300px] w-[300px] rounded-full bg-chrome-mid/10 blur-[80px] animate-float sm:h-[400px] sm:w-[400px] md:h-[500px] md:w-[500px]" aria-hidden="true" />
      <div className="pointer-events-none absolute -bottom-[8%] -right-[5%] h-[200px] w-[200px] rounded-full bg-chrome-dark/10 blur-[80px] sm:h-[300px] sm:w-[300px] md:h-[400px] md:w-[400px]" aria-hidden="true" />

      {/* Water ripple canvas */}
      <canvas
        id="water-ripple-canvas"
        className="pointer-events-none absolute inset-0 z-10"
        aria-hidden="true"
      />

      {/* Cursor glow */}
      <div
        className="pointer-events-none fixed z-[9998] h-[300px] w-[300px] rounded-full opacity-0 transition-opacity duration-300"
        style={{
          background: `radial-gradient(circle, rgba(107,159,184,0.06) 0%, transparent 70%)`,
          left: cursorPos.x - 150,
          top: cursorPos.y - 150,
        }}
        aria-hidden="true"
      />

      {/* Content */}
      <div className="relative z-20 mx-auto max-w-4xl px-4 text-center">
        {/* Logo */}
        <div className="mb-8 flex justify-center">
          <div className="relative">
            <div className="h-24 w-24 rounded-full bg-gradient-to-br from-chrome-light/20 to-chrome-dark/20 p-3">
              <div className="flex h-full w-full items-center justify-center rounded-full bg-[#0A1A2E] text-4xl font-bold text-chrome-bright" style={{ fontFamily: 'var(--font-display)' }}>
                A
              </div>
            </div>
          </div>
        </div>

        <p className="mb-4 animate-fade-in-up text-sm font-semibold uppercase tracking-[0.2em] text-chrome-light/70" style={{ animationDelay: '0.2s' }}>
          Rooftop Container Café &mdash; Sa Đéc
        </p>

        <h1 className="animate-fade-in-up mb-6 font-display text-5xl font-bold uppercase tracking-[0.15em] text-chrome-bright sm:text-7xl md:text-8xl" style={{ animationDelay: '0.35s' }}>
          <span className="block">AURA</span>
          <span className="block bg-gradient-to-r from-chrome-bright via-chrome-light to-chrome-mid bg-clip-text text-transparent">
            CAFÉ
          </span>
        </h1>

        <p className="animate-fade-in-up mx-auto mb-8 max-w-xl text-lg text-chrome-light/70" style={{ animationDelay: '0.5s' }}>
          Không gian cà phê <em className="text-chrome-bright">industrial-luxury</em> độc đáo &mdash;
          nơi ly specialty coffee gặp gỡ hoàng hôn trên <em className="text-chrome-bright">rooftop container</em>.
        </p>

        {/* Feature pills */}
        <div className="animate-fade-in-up mb-10 flex flex-wrap justify-center gap-3" style={{ animationDelay: '0.65s' }}>
          <span className="inline-flex items-center gap-2 rounded-full border border-chrome-light/20 bg-white/5 px-4 py-2 text-xs font-semibold uppercase tracking-wider text-chrome-light backdrop-blur-sm">
            <svg className="h-4 w-4" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.5"><circle cx="10" cy="10" r="4"/><path d="M10 2v3M10 15v3M2 10h3M15 10h3M4.9 4.9l2.1 2.1M13 13l2.1 2.1M4.9 15.1l2.1-2.1M13 7l2.1-2.1"/></svg>
            Hoàng Hôn Lộng Gió
          </span>
          <span className="inline-flex items-center gap-2 rounded-full border border-chrome-light/20 bg-white/5 px-4 py-2 text-xs font-semibold uppercase tracking-wider text-chrome-light backdrop-blur-sm">
            <svg className="h-4 w-4" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="M10 2l2.5 5 5.5.8-4 3.9.9 5.5L10 15.5l-4.9 2.5.9-5.5-4-3.9 5.5-.8z"/></svg>
            Specialty Coffee
          </span>
          <span className="inline-flex items-center gap-2 rounded-full border border-chrome-light/20 bg-white/5 px-4 py-2 text-xs font-semibold uppercase tracking-wider text-chrome-light backdrop-blur-sm">
            <svg className="h-4 w-4" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.5"><circle cx="10" cy="6" r="3"/><path d="M4 14c0-3.3 2.7-6 6-6s6 2.7 6 6M8 18h4"/></svg>
            Industrial Lounge
          </span>
        </div>

        {/* CTAs */}
        <div className="animate-fade-in-up flex flex-wrap justify-center gap-4" style={{ animationDelay: '0.8s' }}>
          <Link to="/table-reservation">
            <Button variant="primary" size="lg" className="shadow-lg shadow-chrome-mid/20">
              Đặt bàn ngay &rarr;
            </Button>
          </Link>
          <Link to="/menu">
            <Button variant="ghost" size="lg">
              Khám Phá Menu
            </Button>
          </Link>
        </div>
      </div>

      {/* Scroll hint */}
      <div className="absolute bottom-8 left-1/2 z-20 -translate-x-1/2 animate-fade-in-up" style={{ animationDelay: '1.2s' }} aria-hidden="true">
        <div className="flex flex-col items-center gap-2">
          <span className="text-[10px] font-semibold uppercase tracking-[0.2em] text-chrome-light/40">
            Scroll
          </span>
          <div className="h-8 w-[1px] bg-gradient-to-b from-chrome-light/40 to-transparent" />
        </div>
      </div>
    </section>
  );
}
