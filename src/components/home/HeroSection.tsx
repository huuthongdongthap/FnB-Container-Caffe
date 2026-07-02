import { Link } from 'react-router-dom';

export function HeroSection() {
  return (
    <section
      className="relative flex min-h-screen items-center justify-center overflow-hidden"
      style={{
        background: 'linear-gradient(to bottom, #0A1A2E 0%, #070F1F 50%, #050D1A 100%)',
      }}
      aria-label="AURA CAFE — Container Caffe & Space"
    >
      {/* Gradient mesh — multiple radial gradients create a premium depth effect */}
      <div
        className="pointer-events-none absolute inset-0 z-0"
        style={{
          backgroundImage: [
            'radial-gradient(ellipse at 20% 35%, rgba(107,159,184,0.12) 0%, transparent 55%)',
            'radial-gradient(ellipse at 80% 25%, rgba(201,214,223,0.06) 0%, transparent 45%)',
            'radial-gradient(ellipse at 50% 80%, rgba(58,107,128,0.08) 0%, transparent 50%)',
            'radial-gradient(ellipse at 75% 65%, rgba(107,159,184,0.05) 0%, transparent 40%)',
          ].join(','),
        }}
        aria-hidden="true"
      />

      {/* Floating decorative geometric shapes */}
      <div className="hero-shape hero-shape--1" aria-hidden="true" />
      <div className="hero-shape hero-shape--2" aria-hidden="true" />
      <div className="hero-shape hero-shape--3" aria-hidden="true" />
      <div className="hero-shape hero-shape--4" aria-hidden="true" />

      {/* Subtle dot-grid overlay */}
      <div className="dot-grid-overlay z-[1]" aria-hidden="true" />

      {/* Main content */}
      <div className="relative z-10 mx-auto max-w-5xl px-5 text-center">
        {/* Location subtitle */}
        <p
          className="animate-fade-in-up mb-3 font-body text-xs font-semibold uppercase tracking-[0.25em] text-accent/60"
          style={{ animationDelay: '0.15s', animationFillMode: 'both' }}
        >
          Container Caffe &amp; Space &mdash; Sa Dec, Dong Thap
        </p>

        {/* Hero headline — chrome/silver gradient */}
        <h1
          className="animate-fade-in-up mb-3 font-display text-6xl font-bold uppercase tracking-[0.06em] sm:text-7xl md:text-8xl lg:text-9xl"
          style={{ animationDelay: '0.3s', animationFillMode: 'both' }}
        >
          <span className="hero-title-chrome">AURA CAFE</span>
        </h1>

        {/* Tagline */}
        <p
          className="animate-fade-in-up mx-auto mb-10 max-w-lg font-body text-base leading-relaxed text-accent/40 sm:text-lg"
          style={{ animationDelay: '0.5s', animationFillMode: 'both' }}
        >
          Khong gian ca phe industrial-luxury doc dao
          &mdash; noi ly specialty coffee gap go hoang hon tren rooftop container.
        </p>

        {/* CTA buttons */}
        <div
          className="animate-fade-in-up flex flex-col items-center justify-center gap-4 sm:flex-row"
          style={{ animationDelay: '0.7s', animationFillMode: 'both' }}
        >
          <Link to="/menu" className="hero-cta-primary">
            Xem Thuc Don
            <svg
              className="h-4 w-4"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              aria-hidden="true"
            >
              <path d="M5 12h14M12 5l7 7-7 7" />
            </svg>
          </Link>
          <Link to="/table-reservation" className="hero-cta-outline">
            Dat Ban Ngay
            <svg
              className="h-4 w-4"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              aria-hidden="true"
            >
              <path d="M5 12h14M12 5l7 7-7 7" />
            </svg>
          </Link>
        </div>
      </div>

      {/* Scroll indicator */}
      <div
        className="animate-fade-in-up absolute bottom-8 left-1/2 z-10 -translate-x-1/2"
        style={{ animationDelay: '1s', animationFillMode: 'both' }}
        aria-hidden="true"
      >
        <div className="flex flex-col items-center gap-2">
          <span className="font-body text-[10px] font-semibold uppercase tracking-[0.25em] text-accent/30">
            Scroll
          </span>
          <div
            className="h-10 w-[1px]"
            style={{
              background: 'linear-gradient(to bottom, rgba(201,214,223,0.3), transparent)',
            }}
          />
        </div>
      </div>
    </section>
  );
}
