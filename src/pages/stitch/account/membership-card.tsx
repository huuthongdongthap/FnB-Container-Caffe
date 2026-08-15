export function MembershipCard() {
  return (
    <div
      className="relative overflow-hidden rounded-2xl"
      style={{ aspectRatio: '1.6 / 1' }}
    >
      <div className="absolute inset-0"
        style={{
          background: 'linear-gradient(135deg, #2A1F14 0%, #0D1825 40%, #1A2540 70%, #2A1F14 100%)',
        }}
      />
      <div className="absolute inset-0"
        style={{
          background: 'linear-gradient(160deg, rgba(205,127,50,0.25) 0%, transparent 50%, rgba(205,127,50,0.15) 100%)',
        }}
      />
      <div className="absolute inset-0"
        style={{ boxShadow: 'inset 0 1px 0 0 rgba(205,127,50,0.3)' }}
      />

      <div className="relative z-10 flex flex-col items-center justify-center h-full gap-2">
        <span className="font-display text-4xl italic tracking-[0.2em] chrome-text">AURA</span>
        <span className="font-body text-[10px] tracking-[0.3em] text-[var(--aura-chrome-mid)] uppercase">
          Member Since 2022
        </span>
      </div>
    </div>
  );
}
