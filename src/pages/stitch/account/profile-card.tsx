export function ProfileCard() {
  return (
    <section className="glass-card relative overflow-hidden">
      <div
        className="absolute -top-10 -right-10 w-40 h-40 rounded-full opacity-40"
        style={{
          background: 'radial-gradient(circle, rgba(205,127,50,0.35) 0%, transparent 70%)',
          filter: 'blur(40px)',
        }}
      />

      <div className="relative z-10 flex items-center gap-5 p-6">
        <div className="relative flex-shrink-0">
          <div className="w-20 h-20 rounded-full border-2 border-secondary/30 p-[3px]"
            style={{
              background: 'linear-gradient(135deg, #CD7F32, #A0522D)',
              padding: '3px',
            }}
          >
            <div className="w-full h-full rounded-full bg-[#0D1825] flex items-center justify-center">
              <span className="text-4xl">👤</span>
            </div>
          </div>
        </div>

        <div>
          <h2 className="font-display text-2xl text-[var(--aura-chrome-bright)]">Julian Vene</h2>
          <span
            className="inline-block mt-2 px-3 py-[3px] rounded-full font-body text-[10px] font-bold uppercase tracking-widest"
            style={{
              background: 'linear-gradient(135deg, #CD7F32, #A0522D)',
              color: '#040B14',
            }}
          >
            Gold Tier
          </span>
        </div>
      </div>
    </section>
  );
}
