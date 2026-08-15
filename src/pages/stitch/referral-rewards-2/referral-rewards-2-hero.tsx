export function ReferralHero() {
  return (
    <section className="mb-12 animate-[fadeIn_1s_ease-out]">
      <div
        className="p-8 md:p-16 relative overflow-hidden flex flex-col items-center text-center"
        style={{
          background: 'var(--aura-noir-deep)',
          backdropFilter: 'blur(20px)',
          border: '1px solid rgba(255,255,255,0.1)',
          borderRadius: '40px',
          boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.1)',
        }}
      >
        {/* Atmospheric glows */}
        <div
          className="absolute -top-24 -right-24 w-64 h-64 rounded-full blur-[100px]"
          style={{ background: 'rgba(212,165,116,0.1)' }}
        />
        <div
          className="absolute -bottom-24 -left-24 w-64 h-64 rounded-full blur-[100px]"
          style={{ background: 'rgba(184,199,226,0.1)' }}
        />

        <p className="font-body text-xs font-semibold text-[var(--aura-tertiary)] tracking-[0.3em] mb-6 uppercase">
          Exclusive Invitation
        </p>

        <h2 className="font-display text-3xl md:text-5xl text-[var(--aura-chrome-bright)] mb-4 tracking-tight">
          Share the Experience
        </h2>

        <div className="relative py-6 px-8 mt-4">
          <span
            className="font-display text-6xl md:text-[120px] leading-none text-[var(--aura-tertiary)] italic drop-shadow-2xl"
            style={{ textShadow: '0 0 40px rgba(212,165,116,0.3)' }}
          >
            $15.00
          </span>
          <p className="font-body text-xs text-[var(--aura-chrome-mid)] tracking-[0.3em] mt-4 uppercase">
            Per Successful Referral
          </p>
        </div>

        <p className="font-body text-base text-[var(--aura-chrome-mid)] max-w-xl mx-auto mt-8 leading-relaxed">
          Invite your inner circle to experience the refined atmosphere of Aura Cafe.
          Both you and your friend will receive premium credits for each successful enrollment.
        </p>
      </div>
    </section>
  );
}
