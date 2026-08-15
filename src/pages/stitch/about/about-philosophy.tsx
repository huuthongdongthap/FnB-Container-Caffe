export function AboutPhilosophy() {
  return (
    <section id="philosophy" className="py-24 md:py-32 px-6 md:px-16">
      <div className="max-w-3xl mx-auto story-reveal opacity-0 translate-y-10 transition-all duration-700">
        <div className="glass-panel p-10 md:p-16 text-center">
          <span className="font-label-caps text-[var(--aura-chrome-dark)] tracking-[0.3em] uppercase block mb-6 text-xs">
            Philosophy — Triết Lý
          </span>

          <h2 className="font-display text-headline-md md:text-headline-md text-[var(--aura-tertiary)] mb-8" style={{ fontStyle: 'italic' }}>
            The Craft&nbsp;
            <span className="text-[var(--aura-chrome-mid)] text-headline-sm">
              / Nghệ thuật
            </span>
          </h2>

          <p className="font-body text-body-md md:text-body-lg text-[var(--aura-chrome-bright)] leading-relaxed font-light">
            Aura Cafe was born from a singular obsession: to build a space where industrial
            architecture and the art of coffee converge. We salvaged three decommissioned
            shipping containers and reimagined them as a nocturnal sanctuary — a place where
            raw steel, panoramic glass, and the alchemy of precision brewing create something
            neither cafe nor gallery, but both.
          </p>

          <p className="font-body text-body-md text-[var(--aura-chrome-mid)] leading-relaxed font-light mt-6">
            Mỗi chi tiết đều được chế tác — từ khung thép đến hạt cà phê đơn nguồn.
            Không phải quán cà phê, không phải phòng trưng bày. Mà cả hai.
          </p>
        </div>
      </div>
    </section>
  );
}
