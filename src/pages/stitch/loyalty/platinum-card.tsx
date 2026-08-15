export default function PlatinumCard() {
  return (
    <section className="glass-panel rounded-2xl p-6 md:p-8 relative overflow-hidden" style={{ background: 'linear-gradient(135deg, rgba(212,165,116,0.08) 0%, rgba(212,165,116,0.02) 50%, transparent 100%)' }}>
      <div className="absolute -right-16 -top-16 w-48 h-48 bg-[var(--aura-tertiary)]/10 blur-[64px] rounded-full" />
      <div className="flex items-start justify-between relative">
        <div>
          <span className="inline-block px-3 py-1 rounded-full bg-[var(--aura-tertiary)] text-[var(--aura-noir-deep)] font-label-caps text-[10px] uppercase tracking-widest font-bold mb-3" style={{ boxShadow: '0 0 12px rgba(212,165,116,0.3)' }}>
            ⭐ Platinum / Bạch kim
          </span>
          <p className="font-body text-sm text-[var(--aura-chrome-mid)]">Member Since / Thành viên từ 2022</p>
          <div className="mt-4">
            <div className="flex justify-between mb-1">
              <span className="font-label-caps text-[10px] text-[var(--aura-chrome-mid)] uppercase tracking-wider">Progress to Black Tier / Tiến trình Black</span>
              <span className="font-label-caps text-[10px] text-[var(--aura-tertiary)]">2,550 PTS needed</span>
            </div>
            <div className="h-2 w-full bg-white/5 rounded-full overflow-hidden">
              <div className="h-full bg-[var(--aura-tertiary)] rounded-full" style={{ width: '78%', boxShadow: '0 0 10px rgba(212,165,116,0.3)' }} />
            </div>
          </div>
        </div>
      </div>
      <div className="flex items-end justify-between mt-8 pt-6 border-t border-white/10">
        <div>
          <p className="font-label-caps text-[10px] text-[var(--aura-chrome-mid)] uppercase tracking-wider">Available Points / Điểm có sẵn</p>
          <p className="font-display text-5xl md:text-7xl text-[var(--aura-tertiary)] leading-none mt-1" style={{ fontFamily: 'var(--font-display, "Libre Caslon Text", serif)' }}>12,450</p>
          <p className="font-label-caps text-[10px] text-[var(--aura-chrome-mid)] mt-1 tracking-wider">PREMIUM REWARD POINTS</p>
        </div>
        <button className="px-6 py-3 rounded-lg bg-[var(--aura-tertiary)] text-[var(--aura-noir-deep)] font-headline-sm uppercase tracking-widest text-xs font-bold hover:brightness-110 active:scale-95 transition-all">
          Redeem / Quy đổi
        </button>
      </div>
    </section>
  );
}
