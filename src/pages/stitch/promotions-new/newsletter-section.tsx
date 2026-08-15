export function NewsletterSection() {
  return (
    <section className="px-6 py-6">
      <div className="glass-panel p-4 relative overflow-hidden">
        <div className="absolute -right-12 -top-12 opacity-5" aria-hidden="true">
          <span className="material-symbols-outlined text-[160px]">electric_bolt</span>
        </div>
        <div className="relative z-10">
          <h3 className="font-display-lg-mobile text-[28px] text-on-background mb-1">Join the Inner Circle</h3>
          <p className="font-body-sm text-body-sm text-on-surface-variant mb-4">
            Direct access to private events, rare bean drops, and weekly rituals.
          </p>
          <form className="space-y-3" onSubmit={e => e.preventDefault()}>
            <div className="relative">
              <input
                type="email"
                placeholder="ENCRYPTED EMAIL"
                className="w-full bg-transparent border-b border-outline-variant focus:border-[var(--aura-tertiary)] focus:ring-0 text-on-background font-label-caps py-2 placeholder:text-outline/50 uppercase"
              />
            </div>
            <button type="submit" className="w-full py-3 bg-[var(--aura-tertiary)] text-primary-container font-label-caps text-label-caps uppercase tracking-[0.2em]">
              Authenticate
            </button>
          </form>
        </div>
      </div>
    </section>
  );
}
