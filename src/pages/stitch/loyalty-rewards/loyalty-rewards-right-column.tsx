import { type MutableRefObject } from 'react';
import { WEEKDAYS, COMPLETED_DAYS, TIER_BENEFITS } from './loyalty-rewards-constants';

interface RightColumnProps {
  cardRefs: MutableRefObject<(HTMLElement | null)[]>;
  copied: boolean;
  onCopyCode: () => void;
}

export function RightColumn({ cardRefs, copied, onCopyCode }: RightColumnProps) {
  return (
    <div className="col-span-12 lg:col-span-4 flex flex-col gap-6">
      {/* Weekly Streak */}
      <section
        ref={(el) => { cardRefs.current[2] = el; }}
        className="rounded-xl p-6 bg-[rgba(40,54,71,0.4)] backdrop-blur-xl border border-white/10"
      >
        <h3 className="font-headline-md text-xl text-[var(--aura-chrome-bright)] mb-6">Weekly Streak</h3>
        <div className="flex justify-between items-center gap-2">
          {WEEKDAYS.map((day, i) => {
            const isCompleted = i < COMPLETED_DAYS;
            return (
              <div key={day} className="flex flex-col items-center gap-2">
                <div
                  className={`w-10 h-10 rounded-full border flex items-center justify-center text-lg ${
                    isCompleted
                      ? 'border-[var(--aura-tertiary)] text-[var(--aura-tertiary)] bg-[var(--aura-tertiary)]/10'
                      : 'border-white/20 text-white/30'
                  }`}
                >
                  👑
                </div>
                <span className="text-[10px] text-[var(--aura-chrome-dark)] font-bold">{day}</span>
              </div>
            );
          })}
        </div>
        <p className="mt-6 font-body text-base text-[var(--aura-chrome-mid)] leading-relaxed">
          Check in today to maintain your <span className="text-[var(--aura-tertiary)] font-bold">12-day streak</span> and earn double points on your next pour.
        </p>
        <button className="mt-4 w-full py-3 bg-[var(--aura-noir-deep)] border border-white/20 text-[var(--aura-chrome-bright)] font-bold rounded-lg hover:border-[var(--aura-tertiary)]/40 transition-all flex items-center justify-center gap-2">
          📍 Check-in at Roastery
        </button>
      </section>

      {/* Referral Block */}
      <section
        ref={(el) => { cardRefs.current[3] = el; }}
        className="rounded-xl p-6 relative overflow-hidden bg-[rgba(40,54,71,0.4)] backdrop-blur-xl border border-white/10"
      >
        <div className="absolute -right-10 -top-10 w-32 h-32 bg-[var(--aura-tertiary)]/10 blur-[64px]" />
        <h3 className="font-headline-md text-xl text-[var(--aura-chrome-bright)] mb-2">Refer &amp; Earn</h3>
        <p className="font-body text-sm text-[var(--aura-chrome-dark)] mb-6">
          Invite another connoisseur. When they join, you both receive 2,000 premium points.
        </p>
        <div className="p-3 rounded border border-white/10 flex items-center justify-between mb-4" style={{ background: 'rgba(5,20,36,1)' }}>
          <span className="font-display text-xl tracking-widest text-[var(--aura-tertiary)]">AURA-PLAT-882</span>
          <button
            onClick={onCopyCode}
            className="text-[var(--aura-tertiary)] hover:text-white flex items-center gap-1 text-xs font-bold active:scale-90 transition-all"
          >
            {copied ? '✅' : '📋'} {copied ? 'COPIED' : 'COPY'}
          </button>
        </div>
        <div className="flex gap-2">
          <button className="flex-1 py-2 bg-white/5 border border-white/20 rounded flex items-center justify-center hover:bg-white/10 transition-all">
            📤
          </button>
          <button className="flex-[3] py-2 bg-[var(--aura-tertiary)] text-[var(--aura-noir-deep)] font-bold rounded">
            Share Invite Link
          </button>
        </div>
      </section>

      {/* Tier Benefits */}
      <section
        ref={(el) => { cardRefs.current[4] = el; }}
        className="rounded-xl p-6 bg-[rgba(40,54,71,0.4)] backdrop-blur-xl border border-white/10"
      >
        <h3 className="text-xs text-[var(--aura-chrome-dark)] uppercase tracking-[0.2em] mb-6">Tier Benefits</h3>
        <ul className="space-y-4">
          {TIER_BENEFITS.map((benefit) => (
            <li key={benefit} className="flex items-center gap-3 group">
              <span className="w-1.5 h-1.5 bg-[var(--aura-tertiary)] rounded-full group-hover:scale-150 transition-transform" />
              <span className="font-body text-[var(--aura-chrome-bright)]">{benefit}</span>
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}
