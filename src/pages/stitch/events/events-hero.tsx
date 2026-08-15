export function EventsHero() {
  return (
    <section className="relative py-16 md:py-24 overflow-hidden">
      {/* Ambient bg orbs */}
      <div className="absolute top-10 left-10 w-72 h-72 rounded-full bg-[var(--aura-tertiary)] opacity-[0.04] blur-[100px] pointer-events-none" />
      <div className="absolute bottom-10 right-10 w-96 h-96 rounded-full bg-[var(--aura-chrome-dark)] opacity-[0.05] blur-[120px] pointer-events-none" />

      <div className="relative z-10 max-w-[1200px] mx-auto px-5 md:px-16 text-center">
        <span className="font-body text-xs font-medium tracking-[0.3em] uppercase text-[var(--aura-tertiary)] mb-4 block">
          Upcoming / Sắp tới
        </span>
        <h1 className="font-display text-4xl md:text-6xl lg:text-7xl text-[var(--aura-chrome-bright)] leading-tight mb-6">
          Events &amp; Promotions
          <br />
          <span className="text-[var(--aura-tertiary)]">
            Sự kiện &amp; Khuyến mãi
          </span>
        </h1>
        <p className="font-body text-base md:text-lg text-[var(--aura-chrome-mid)] max-w-2xl mx-auto leading-relaxed">
          Curated experiences that blend craft, community, and the distinctive
          atmosphere of AURA CAFE &mdash;{' '}
          <span className="text-[var(--aura-chrome-light)]">
            Những trải nghiệm được tuyển chọn kết hợp thủ công, cộng đồng và
            không khí đặc trưng của AURA CAFE.
          </span>
        </p>
      </div>
    </section>
  );
}
