import { REWARDS } from './loyalty-constants';

export default function AvailableRewards() {
  return (
    <section>
      <div className="flex justify-between items-center mb-4">
        <h3 className="font-headline-md text-headline-md text-[var(--aura-chrome-bright)]">Available Rewards / Phần thưởng</h3>
        <a href="#" className="font-label-caps text-[10px] text-[var(--aura-tertiary)] hover:underline uppercase tracking-widest">View All / Xem tất cả</a>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {REWARDS.map(r => (
          <div key={r.name} className="glass-panel rounded-xl overflow-hidden cursor-pointer transition-all duration-500 hover:border-[var(--aura-tertiary)]/40 group">
            <div className="h-40 relative overflow-hidden">
              <div className="w-full h-full bg-cover bg-center group-hover:scale-105 transition-transform duration-700" style={{ backgroundImage: `url(${r.img})` }} role="img" aria-label={r.name} />
              <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent" />
            </div>
            <div className="p-4">
              <h4 className="font-body text-body text-[var(--aura-chrome-bright)] mb-1">{r.name}</h4>
              <p className="font-label-caps text-[10px] text-[var(--aura-chrome-mid)] uppercase tracking-wider">{r.pts}</p>
              <button className="w-full mt-3 py-2 border border-white/10 rounded-lg font-label-caps text-[10px] font-bold uppercase tracking-wider text-[var(--aura-chrome-mid)] hover:bg-white/5 transition-colors">
                Claim / Nhận
              </button>
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}
