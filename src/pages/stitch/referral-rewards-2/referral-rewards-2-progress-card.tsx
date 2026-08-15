export function ProgressTracker() {
  return (
    <div
      className="lg:col-span-5 p-8 flex flex-col justify-between"
      style={{
        background: 'var(--aura-noir-deep)',
        backdropFilter: 'blur(20px)',
        border: '1px solid rgba(255,255,255,0.1)',
        borderRadius: '40px',
      }}
    >
      <div>
        <div className="flex justify-between items-end mb-4">
          <h3 className="font-display text-xl text-[var(--aura-chrome-bright)]">Next Bonus</h3>
          <span className="font-body text-sm text-[var(--aura-tertiary)]">3/5 Referrals</span>
        </div>
        <p className="font-body text-sm text-[var(--aura-chrome-mid)] mb-6">
          Unlock a $50 Premium Reserve credit upon reaching 5 referrals.
        </p>
      </div>

      <div className="space-y-4">
        <div
          className="h-2 w-full rounded-full overflow-hidden"
          style={{ background: 'rgba(255,255,255,0.08)' }}
        >
          <div
            className="h-full transition-all duration-1000"
            style={{
              width: '60%',
              background: 'linear-gradient(90deg, #D4A574 0%, #FFD700 100%)',
              boxShadow: '0 0 15px rgba(212,165,116,0.5)',
            }}
          />
        </div>
        <div
          className="flex justify-between font-body text-[10px] tracking-widest uppercase"
          style={{ color: 'rgba(212,225,255,0.4)' }}
        >
          <span>Current Level</span>
          <span>Premium Status Unlock</span>
        </div>
      </div>

      <div className="mt-8 pt-8" style={{ borderTop: '1px solid rgba(255,255,255,0.05)' }}>
        <div className="flex items-center gap-4">
          <div
            className="w-12 h-12 flex items-center justify-center"
            style={{
              background: 'var(--aura-noir-deep)',
              backdropFilter: 'blur(20px)',
              border: '1px solid rgba(255,255,255,0.15)',
            }}
          >
            <span className="text-[var(--aura-tertiary)] text-xl">🏆</span>
          </div>
          <div>
            <p className="font-body text-xs font-semibold tracking-widest uppercase text-[var(--aura-chrome-bright)]">
              Silver Member
            </p>
            <p className="font-body text-sm text-[var(--aura-chrome-mid)]">Total Earned: $45.00</p>
          </div>
        </div>
      </div>
    </div>
  );
}
