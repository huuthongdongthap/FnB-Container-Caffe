import { ANALYTICS_CARDS } from './admin-terminal-constants';

export function AnalyticsCards() {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-6">
      {ANALYTICS_CARDS.map((card) => (
        <div
          key={card.label}
          className="bg-white/5 backdrop-blur-xl border border-white/10 rounded-[40px] p-6 flex flex-col justify-between h-40"
        >
          <div className="flex justify-between items-start">
            <span className="text-xs font-bold tracking-widest text-[var(--aura-tertiary)]">
              {card.label}
            </span>
            {card.change && card.trendUp && (
              <span className="text-[#CD7F32] flex items-center font-bold text-sm">
                {card.change} <span className="ml-1">📈</span>
              </span>
            )}
          </div>
          <div className="mt-4">
            <span className="text-[40px] leading-[48px] tracking-widest font-light text-[var(--aura-chrome-bright)]">
              {card.value}
            </span>
          </div>
        </div>
      ))}
    </div>
  );
}
