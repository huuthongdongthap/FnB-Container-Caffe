import { type MutableRefObject } from 'react';
import { REWARDS, ACTIVITIES } from './loyalty-rewards-constants';

interface LeftColumnProps {
  cardRefs: MutableRefObject<(HTMLElement | null)[]>;
  copied: boolean;
}

export function LeftColumn({ cardRefs, copied }: LeftColumnProps) {
  return (
    <div className="col-span-12 lg:col-span-8 flex flex-col gap-6">
      {/* Platinum Card */}
      <section
        ref={(el) => { cardRefs.current[0] = el; }}
        className="relative overflow-hidden rounded-xl p-6 flex flex-col md:flex-row justify-between items-end md:items-stretch gap-6"
        style={{
          background: 'linear-gradient(135deg, rgba(205,127,50,0.15) 0%, rgba(5,20,36,0.4) 100%)',
          backdropFilter: 'blur(32px)',
          WebkitBackdropFilter: 'blur(32px)',
          border: '1px solid rgba(205,127,50,0.3)',
        }}
      >
        <div className="absolute inset-0 opacity-[0.03] pointer-events-none" style={{
          backgroundImage: 'url(https://www.transparenttextures.com/patterns/brushed-alum.png)',
        }} />
        <div className="flex flex-col justify-between flex-1 relative">
          <div>
            <span className="inline-block px-3 py-1 bg-[var(--aura-tertiary)]/20 border border-[var(--aura-tertiary)]/40 rounded-full text-[10px] font-bold tracking-[0.2em] text-[var(--aura-tertiary)] uppercase mb-4">
              Platinum Tier
            </span>
            <h2 className="font-display text-4xl md:text-5xl text-[var(--aura-chrome-bright)] mb-2 leading-tight">
              Member Since 2022
            </h2>
            <p className="font-body text-[var(--aura-chrome-mid)] opacity-80 text-base">
              You are in the top 2% of our community. Enjoy exclusive access to the Obsidian Lounge.
            </p>
          </div>
          <div className="mt-6">
            <div className="flex justify-between items-end mb-2">
              <span className="text-xs text-[var(--aura-chrome-dark)] uppercase tracking-wider">Next Level: Black Tier</span>
              <span className="text-xs text-[var(--aura-tertiary)]">2,550 pts remaining</span>
            </div>
            <div className="h-1.5 w-full rounded-full overflow-hidden" style={{
              background: 'rgba(18,32,49,1)',
              boxShadow: '0 0 20px rgba(205,127,50,0.2)',
            }}>
              <div className="h-full rounded-full" style={{
                width: '78%',
                background: 'linear-gradient(90deg, #8e4e00 0%, #cd7f32 50%, #ffb779 100%)',
              }} />
            </div>
          </div>
        </div>
        <div className="flex flex-col items-end justify-between text-right min-w-[200px] relative">
          <span className="text-xs text-[var(--aura-chrome-dark)] uppercase tracking-widest">Balance</span>
          <div className="text-[72px] leading-none text-[var(--aura-tertiary)] font-light mt-2" style={{ fontFamily: "'Libre Caslon Text', serif" }}>
            12,450
          </div>
          <div className="text-xs tracking-tighter" style={{ color: 'rgba(198,198,198,0.7)' }}>PREMIUM REWARD POINTS</div>
          <button className="mt-6 w-full py-3 bg-[var(--aura-tertiary)] text-[var(--aura-noir-deep)] font-bold rounded-lg active:scale-95 transition-transform">
            Redeem Points
          </button>
        </div>
      </section>

      {/* Rewards Grid */}
      <section>
        <div className="flex justify-between items-center mb-6">
          <h3 className="font-headline-md text-xl text-[var(--aura-chrome-bright)]">Available Rewards</h3>
          <a href="#all" className="text-xs text-[var(--aura-tertiary)] hover:underline uppercase tracking-widest">
            View All
          </a>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {REWARDS.map((reward) => (
            <div
              key={reward.title}
              className="rounded-xl overflow-hidden group cursor-pointer hover:border-[var(--aura-tertiary)]/40 transition-all duration-500 bg-[rgba(40,54,71,0.4)] backdrop-blur-xl border border-white/10"
            >
              <div className="h-40 relative">
                <img
                  src={reward.image}
                  alt={reward.alt}
                  className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-700"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-[var(--aura-noir-void)] to-transparent" />
              </div>
              <div className="p-6">
                <h4 className="font-body text-lg text-[var(--aura-chrome-bright)] mb-1">{reward.title}</h4>
                <p className="text-xs text-[var(--aura-chrome-dark)] mb-4">{reward.points} POINTS</p>
                <button className="w-full py-2 border border-[var(--aura-chrome-dark)]/30 text-xs font-bold rounded hover:bg-white/5 transition-colors">
                  Claim Reward
                </button>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* Points History */}
      <section
        ref={(el) => { cardRefs.current[1] = el; }}
        className="rounded-xl p-6 overflow-hidden bg-[rgba(40,54,71,0.4)] backdrop-blur-xl border border-white/10"
      >
        <div className="flex justify-between items-center mb-6">
          <h3 className="font-headline-md text-xl text-[var(--aura-chrome-bright)]">Points History</h3>
          <button className="text-[var(--aura-chrome-dark)] hover:text-[var(--aura-tertiary)] transition-colors" aria-label="Filter list">
            {copied ? '✅' : '🔍'}
          </button>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead>
              <tr className="border-b border-white/10">
                <th className="py-4 text-xs text-[var(--aura-chrome-mid)] tracking-widest uppercase font-bold">Activity</th>
                <th className="py-4 text-xs text-[var(--aura-chrome-mid)] tracking-widest uppercase font-bold">Date</th>
                <th className="py-4 text-xs text-[var(--aura-chrome-mid)] tracking-widest uppercase font-bold">Status</th>
                <th className="py-4 text-xs text-[var(--aura-chrome-mid)] tracking-widest uppercase font-bold text-right">Points</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5">
              {ACTIVITIES.map((item) => (
                <tr key={item.activity} className="group hover:bg-white/5 transition-colors">
                  <td className="py-4 font-body">{item.activity}</td>
                  <td className="py-4 text-sm text-[var(--aura-chrome-dark)]">{item.date}</td>
                  <td className="py-4">
                    <span className="px-2 py-0.5 rounded text-[10px] border border-[var(--aura-tertiary)]/40 text-[var(--aura-tertiary)]">
                      {item.status}
                    </span>
                  </td>
                  <td className="py-4 text-right font-bold text-[var(--aura-tertiary)]">{item.points}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
