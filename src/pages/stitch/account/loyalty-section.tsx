export function LoyaltySection() {
  return (
    <section className="glass-card p-6"
      style={{ boxShadow: 'inset 0 1px 0 0 rgba(205,127,50,0.3)' }}
    >
      <div className="flex justify-between items-end mb-4">
        <div>
          <span className="block font-body text-[10px] text-[var(--aura-chrome-mid)] tracking-[0.2em] uppercase mb-1">
            Số dư điểm
          </span>
          <p className="font-display text-[2rem] leading-none primary-gradient">
            1,250 <span className="font-body text-sm text-[var(--aura-chrome-mid)] opacity-70">pts</span>
          </p>
        </div>
        <div className="text-right">
          <span className="block font-body text-[10px] text-[var(--aura-chrome-mid)] tracking-[0.2em] uppercase mb-1">
            Hạng tiếp theo
          </span>
          <p className="font-body text-sm text-[var(--aura-chrome-light)]">Platinum</p>
        </div>
      </div>

      <div className="w-full h-[6px] bg-white/10 rounded-full overflow-hidden mb-2">
        <div
          className="h-full rounded-full"
          style={{
            width: '80%',
            background: 'linear-gradient(135deg, #CD7F32, #A0522D)',
          }}
        />
      </div>
      <p className="font-body text-[11px] text-[var(--aura-chrome-dark)] text-right">
        250 pts to go / Còn 250 điểm
      </p>
    </section>
  );
}
