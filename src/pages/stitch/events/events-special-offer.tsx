export function EventsSpecialOffer() {
  return (
    <section className="pb-20">
      <div className="max-w-[1200px] mx-auto px-5 md:px-16">
        <div className="glass-panel border-l-4 border-[var(--aura-tertiary)] p-6 md:p-8 flex flex-col md:flex-row items-center gap-4 md:gap-8">
          <span className="text-4xl">🏆</span>
          <div className="flex-1 text-center md:text-left">
            <h3 className="font-headline-md text-lg md:text-xl text-[var(--aura-chrome-bright)]">
              Member Exclusive / Ưu đãi thành viên
            </h3>
            <p className="font-body text-sm md:text-base text-[var(--aura-chrome-mid)] mt-1">
              Bring a friend, both get 20% off this Saturday
              <span className="hidden md:inline">
                {' '}
                — Mời bạn bè, cả hai được giảm 20% thứ Bảy này
              </span>
            </p>
          </div>
          <span className="font-body text-xs font-medium uppercase tracking-widest text-[var(--aura-tertiary)] whitespace-nowrap">
            Limited / Có hạn
          </span>
        </div>
      </div>
    </section>
  );
}
