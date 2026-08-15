import { REWARD_HISTORY } from './referral-rewards-2-data';

export function RewardHistory() {
  return (
    <div className="space-y-4 mt-8">
      <div className="flex justify-between items-center px-2">
        <h4 className="font-display text-lg text-[var(--aura-chrome-bright)]">Reward History</h4>
        <button className="font-body text-[10px] font-semibold tracking-widest uppercase text-[var(--aura-chrome-mid)] underline hover:text-[var(--aura-tertiary)] transition-colors">
          Download Statement
        </button>
      </div>
      <div
        className="h-px"
        style={{
          background: 'linear-gradient(90deg, transparent, rgba(255,255,255,0.2), transparent)',
        }}
      />
      <div
        className="overflow-hidden"
        style={{
          background: 'var(--aura-noir-deep)',
          border: '1px solid rgba(255,255,255,0.1)',
        }}
      >
        <table className="w-full text-left border-collapse">
          <thead>
            <tr style={{ background: 'rgba(255,255,255,0.05)' }}>
              <th className="p-4 font-body text-[10px] font-semibold tracking-widest uppercase text-[var(--aura-chrome-mid)]">
                Date
              </th>
              <th className="p-4 font-body text-[10px] font-semibold tracking-widest uppercase text-[var(--aura-chrome-mid)]">
                Source
              </th>
              <th className="p-4 font-body text-[10px] font-semibold tracking-widest uppercase text-[var(--aura-chrome-mid)] text-right">
                Credit
              </th>
            </tr>
          </thead>
          <tbody className="font-body text-sm">
            {REWARD_HISTORY.map((row) => (
              <tr
                key={row.date}
                className="transition-colors hover:bg-white/5"
                style={{ borderTop: '1px solid rgba(255,255,255,0.03)' }}
              >
                <td className="p-4 font-body text-xs text-[var(--aura-chrome-mid)]">
                  {row.date}
                </td>
                <td className="p-4 text-[var(--aura-chrome-bright)]">{row.source}</td>
                <td className="p-4 text-right font-semibold text-[var(--aura-tertiary)]">
                  +${row.credit.toFixed(2)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
