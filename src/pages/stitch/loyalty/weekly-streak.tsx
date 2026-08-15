import { DAYS } from './loyalty-constants';

export default function WeeklyStreak() {
  return (
    <section className="glass-panel rounded-xl p-5">
      <h3 className="font-headline-md text-headline-md text-[var(--aura-chrome-bright)] mb-4">Weekly Streak / Chuỗi ngày</h3>
      <div className="flex justify-between gap-2">
        {DAYS.map((day, i) => (
          <div key={day} className="flex flex-col items-center gap-2">
            <div className={`w-10 h-10 rounded-full border flex items-center justify-center ${i < 3 ? 'border-[var(--aura-tertiary)] text-[var(--aura-tertiary)] bg-[var(--aura-tertiary)]/10' : 'border-white/10 text-white/20'}`}>
              <span className="text-sm">⭐</span>
            </div>
            <span className="font-label-caps text-[9px] text-[var(--aura-chrome-mid)] uppercase tracking-wider">{day}</span>
          </div>
        ))}
      </div>
      <p className="mt-4 font-body-sm text-sm text-[var(--aura-chrome-mid)]">
        Check in today to maintain your <span className="text-[var(--aura-tertiary)] font-bold">12-day streak</span> and earn double points. / Checkin để giữ chuỗi 12 ngày và nhân đôi điểm.
      </p>
      <button className="mt-4 w-full py-3 rounded-lg bg-white/5 border border-white/10 font-headline-sm uppercase tracking-widest text-xs hover:border-[var(--aura-tertiary)]/40 transition-all flex items-center justify-center gap-2">
        📍 Check-in at Roastery
      </button>
    </section>
  );
}
