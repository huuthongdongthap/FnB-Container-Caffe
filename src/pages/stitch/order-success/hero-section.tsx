export function HeroSection() {
  return (
    <div className="w-full relative aspect-square flex flex-col items-center justify-center overflow-hidden rounded-[40px]">
      <div className="absolute top-1/2 left-1/2 -z-10">
        <div
          className="ring-outer absolute top-0 left-0 border border-[var(--aura-tertiary)]/60 rounded-full"
          style={{ width: 260, height: 260 }}
        />
        <div
          className="ring-inner absolute border border-white/20 rounded-full"
          style={{ width: 240, height: 240, top: 10, left: 10 }}
        />
        <div
          className="ring-outer absolute border border-[var(--aura-tertiary)]/30 rounded-full"
          style={{ width: 340, height: 340, top: -40, left: -40 }}
        />
        <div
          className="ring-inner absolute border border-white/10 rounded-full"
          style={{ width: 320, height: 320, top: -30, left: -30 }}
        />
      </div>

      <div className="relative z-10 text-center flex flex-col gap-2">
        <span className="font-body text-xs font-bold tracking-[0.2em] text-[var(--aura-tertiary)] uppercase">
          ESTIMATED WAIT
        </span>
        <div className="font-display text-[clamp(56px,15vw,84px)] leading-none text-[var(--aura-chrome-bright)] flex items-baseline justify-center">
          12
          <span className="text-xl md:text-2xl ml-2 font-body uppercase tracking-widest text-[var(--aura-tertiary)] font-semibold">
            min
          </span>
        </div>
        <div className="mt-3 px-4 py-1.5 rounded-full border border-[var(--aura-tertiary)]/30 bg-[var(--aura-tertiary)]/10 inline-flex items-center gap-2 self-center">
          <div className="w-2 h-2 rounded-full bg-[var(--aura-tertiary)] pulse-dot" />
          <span className="font-body text-[10px] text-[var(--aura-tertiary)] font-semibold tracking-wider uppercase">
            Preparing Your Brew
          </span>
        </div>
      </div>
    </div>
  );
}
