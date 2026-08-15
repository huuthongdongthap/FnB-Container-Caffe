import { REWARD_HISTORY_DATA } from './loyalty-constants';

export default function RewardHistoryTable() {
  return (
    <section className="glass-panel rounded-xl p-5">
      <h3 className="font-label-caps text-[10px] text-[var(--aura-chrome-mid)] uppercase tracking-widest mb-3 border-l-2 border-[var(--aura-tertiary)] pl-3">Reward History / Lịch sử thưởng</h3>
      <div className="rounded-xl overflow-hidden bg-white/5 border border-white/5">
        <table className="w-full text-left text-sm">
          <thead>
            <tr className="border-b border-white/10">
              <th className="p-2 font-label-caps text-[9px] uppercase text-[var(--aura-chrome-mid)]">Date</th>
              <th className="p-2 font-label-caps text-[9px] uppercase text-[var(--aura-chrome-mid)]">Source</th>
              <th className="p-2 font-label-caps text-[9px] uppercase text-[var(--aura-chrome-mid)] text-right">Amount</th>
            </tr>
          </thead>
          <tbody>
            {REWARD_HISTORY_DATA.map(r => (
              <tr key={r.d} className="border-b border-white/5 last:border-0 hover:bg-white/5 transition-colors">
                <td className="p-2 font-body-sm text-xs text-[var(--aura-chrome-mid)]">{r.d}</td>
                <td className="p-2 font-body-sm text-xs">{r.s}</td>
                <td className="p-2 font-body-sm text-xs text-right text-[var(--aura-tertiary)]">{r.a}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}
