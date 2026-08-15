export function AboutHero() {
  return (
    <section className="relative min-h-screen flex items-center justify-center overflow-hidden px-6">
      {/* Dark overlay */}
      <div className="absolute inset-0 bg-[var(--aura-noir-deep)]/85 z-10" />

      {/* Architectural background image */}
      <div
        className="absolute inset-0 bg-cover bg-center"
        style={{
          backgroundImage:
            "url('https://lh3.googleusercontent.com/aida-public/AB6AXuACV1Udt-Hrc1M1LgOPzS7v8AzKj9LY37FvF84qcsl1xnhN5UpzbjAL7YECy1F2462ZGEk_OP-7A8hik2pOP99Nojnf51y7Mb9IXjGQlTQSBeym9fR_cxzw_ny6yQEcG98L50URyngya9UOMRkc7u4sVMPyLbRdY_AX2IBE_yf7BLinia4L9wIYd3OwmyUkxasutf0d7CdGedJ3TmOVNoAzkuqjCqp37ucfYgkbSivwlE_Pm9uErwenNM_ZOMrcNHe0Ix1egPArFyo')",
        }}
        role="img"
        aria-label="Industrial luxury cafe built from shipping containers with bronze accent lighting"
      />

      <div className="relative z-20 text-center max-w-4xl mx-auto pt-24">
        <span className="block font-label-caps text-[var(--aura-chrome-dark)] tracking-[0.4em] uppercase mb-8 text-xs md:text-sm">
          AURA CAFE — Est. 2024
        </span>

        <h1 className="font-display text-display-lg md:text-display-lg text-white leading-tight mb-6" style={{ fontStyle: 'italic' }}>
          Our Story&nbsp;
          <span className="text-[var(--aura-tertiary)]" style={{ fontStyle: 'normal' }}>
            /
          </span>
          <br className="sm:hidden" />
          &nbsp;Câu chuyện
        </h1>

        <p className="font-body text-body-lg md:text-body-lg text-[var(--aura-chrome-mid)] max-w-2xl mx-auto font-light leading-relaxed">
          Từ khung thép công nghiệp đến không gian cà phê đương đại —{' '}
          <span className="text-[var(--aura-tertiary)]">
            nơi kiến trúc container gặp nghệ thuật rang xay
          </span>
        </p>
      </div>

      {/* Scroll indicator */}
      <div
        className="absolute bottom-10 left-1/2 -translate-x-1/2 z-20 animate-bounce-slow"
        aria-hidden="true"
      >
        <span className="text-[var(--aura-chrome-mid)] text-2xl">{'\u{2193}'}</span>
      </div>
    </section>
  );
}
