export function StitchSubscriptionsNewVisual() {
  return (
    <div className="group relative mt-20 h-80 w-full overflow-hidden">
      <div className="absolute inset-0 z-10 bg-gradient-to-t from-[var(--aura-surface-dim)] via-transparent to-transparent" />
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        className="h-full w-full object-cover opacity-40 grayscale transition-all duration-700 group-hover:scale-105 group-hover:opacity-60"
        src="/photos/IMG_6631.webp"
        alt="A high-contrast, professional architectural photograph of a luxury industrial cafe interior"
      />
      <div className="absolute bottom-8 left-8 z-20">
        <p className="mb-2 font-[family-name:var(--aura-body-font)] text-xs uppercase tracking-[0.1em] text-[var(--aura-bronze-shimmer)]">
          FOUNDRY LOCATION
        </p>
        <p className="font-[family-name:var(--aura-display-font)] text-3xl text-[var(--aura-chrome-bright)]">
          The Central Hub.
        </p>
      </div>
    </div>
  );
}
