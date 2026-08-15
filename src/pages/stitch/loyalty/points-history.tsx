import { POINTS_HISTORY } from './loyalty-constants';

export default function PointsHistory() {
  return (
    <section className="glass-panel rounded-xl p-6">
      <div className="flex justify-between items-center mb-4">
        <h3 className="font-headline-md text-headline-md text-[var(--aura-chrome-bright)]">Points History / Lịch sử điểm</h3>
        <span className="text-[var(--aura-chrome-mid)] cursor-pointer hover:text-[var(--aura-tertiary)]">☰</span>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-left">
          <thead>
            <tr className="border-b border-white/10">
              <th className="py-3 font-label-caps text-[10px] text-[var(--aura-chrome-mid)] uppercase tracking-wider">Activity</th>
              <th className="py-3 font-label-caps text-[10px] text-[var(--aura-chrome-mid)] uppercase tracking-wider">Date</th>
              <th className="py-3 font-label-caps text-[10px] text-[var(--aura-chrome-mid)] uppercase tracking-wider">Status</th>
              <th className="py-3 font-label-caps text-[10px] text-[var(--aura-chrome-mid)] uppercase tracking-wider text-right">Points</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-white/5">
            {POINTS_HISTORY.map(row => (
              <tr key={row.activity} className="group hover:bg-white/5 transition-colors">
                <td className="py-3 font-body-sm text-sm text-[var(--aura-chrome-bright)]">{row.activity}</td>
                <td className="py-3 font-label-caps text-[10px] text-[var(--aura-chrome-mid)]">{row.date}</td>
                <td className="py-3"><span className="px-2 py-0.5 rounded text-[9px] border border-[var(--aura-tertiary)]/40 text-[var(--aura-tertiary)] uppercase">{row.status}</span></td>
                <td className="py-3 text-right font-bold text-[var(--aura-tertiary)]">{row.pts}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}
