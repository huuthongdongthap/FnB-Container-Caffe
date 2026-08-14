import { useTranslation } from 'react-i18next';
import { Sparkles } from 'lucide-react';
import type { LoyaltyHistoryEntry } from './stitch-loyalty-types';
import { StatusBadge } from './loyalty-status-badge';

export function PointsHistoryTable({ history }: { history: LoyaltyHistoryEntry[] }) {
  const { t } = useTranslation();

  if (history.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-12 text-center">
        <Sparkles className="h-8 w-8 mb-3" style={{ color: 'var(--aura-chrome-dim)' }} />
        <p className="text-[16px] leading-[1.5] font-normal" style={{ fontFamily: "'Space Grotesk', sans-serif", color: 'var(--aura-chrome-soft)' }}>
          {t('loyalty.noHistory')}
        </p>
      </div>
    );
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-left">
        <thead>
          <tr className="border-b" style={{ borderColor: 'rgba(255,255,255,0.05)' }}>
            {(['activity', 'date', 'status', 'points'] as const).map((key) => (
              <th
                key={key}
                className={`py-4 text-[12px] leading-none tracking-widest uppercase font-bold ${key === 'points' ? 'text-right' : ''}`}
                style={{ fontFamily: "'Space Grotesk', sans-serif", color: 'var(--aura-chrome-soft)' }}
              >
                {t(`loyalty.${key}`)}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y" style={{ borderColor: 'rgba(255,255,255,0.04)' }}>
          {history.map((entry) => (
            <tr
              key={entry.id}
              className="group transition-colors hover:bg-white/[0.03]"
            >
              <td
                className="py-4 text-[16px] leading-[1.5] font-normal"
                style={{ fontFamily: "'Space Grotesk', sans-serif", color: 'var(--aura-chrome-bright)' }}
              >
                {entry.activity}
              </td>
              <td
                className="py-4 text-[12px] leading-none font-semibold"
                style={{ fontFamily: "'Space Grotesk', sans-serif", color: 'var(--aura-chrome-soft)' }}
              >
                {entry.date}
              </td>
              <td className="py-4">
                <StatusBadge status={entry.status} />
              </td>
              <td
                className="py-4 text-right font-bold text-[16px] leading-[1.5]"
                style={{ fontFamily: "'Space Grotesk', sans-serif", color: 'var(--aura-chrome-bright)' }}
              >
                {entry.points > 0 ? '+' : ''}
                {entry.points.toLocaleString()}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
