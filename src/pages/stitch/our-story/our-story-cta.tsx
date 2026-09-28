export function CtaSection() {
  return (
    <section className="py-32 md:py-40 px-5 md:px-16 text-center bg-[var(--aura-noir-void)]">
      <div className="max-w-4xl mx-auto bg-white/5 backdrop-blur-[8px] border border-white/10 rounded-[40px] p-12 md:p-24 relative overflow-hidden">
        {/* Ambient glows */}
        <div className="absolute -top-24 -left-24 w-64 h-64 bg-[var(--aura-chrome-bright)]/10 blur-[100px] rounded-full" />
        <div className="absolute -bottom-24 -right-24 w-64 h-64 bg-[var(--aura-chrome-mid)]/10 blur-[100px] rounded-full" />

        <h2 className="font-display text-3xl md:text-5xl lg:text-6xl text-white mb-6">
          Trải Nghiệm AURA CAFE
        </h2>
        <p className="text-[var(--aura-chrome-mid)] mb-10 max-w-xl mx-auto font-body font-light leading-relaxed text-sm md:text-base">
          Ghé thăm chúng tôi tại 29 Nguyễn Tất Thành, Sa Đéc để đắm mình trong không gian container xanh mát hoặc gọi món trực tuyến để thưởng thức ngay.
        </p>
        <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
          <a
            href="/menu"
            className="w-full sm:w-auto bg-[var(--aura-chrome-bright)] hover:bg-white text-[var(--aura-noir-deep)] px-8 py-3.5 font-body text-xs font-bold uppercase tracking-[0.15em] transition-all duration-300 shadow-xl rounded-full inline-flex items-center justify-center"
          >
            Khám Phá Thực Đơn
          </a>
          <a
            href="/table-reservation"
            className="w-full sm:w-auto border border-[var(--aura-chrome-mid)]/40 hover:border-[var(--aura-chrome-bright)] text-[var(--aura-chrome-bright)] px-8 py-3.5 font-body text-xs font-bold uppercase tracking-[0.15em] transition-all duration-300 rounded-full inline-flex items-center justify-center"
          >
            Đặt Bàn Ngay
          </a>
        </div>
      </div>
    </section>
  );
}
