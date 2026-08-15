import { ORDER_ITEMS, STEPS } from './order-success-constants';

interface OrderDetailsCardProps {
  completedSteps: number;
}

export function OrderDetailsCard({ completedSteps }: OrderDetailsCardProps) {
  return (
    <div className="w-full bg-white/5 backdrop-blur-xl border border-white/10 rounded-[40px] p-5 flex flex-col gap-5">
      <div className="flex justify-between items-center border-b border-white/5 pb-4">
        <span className="font-body text-xs font-bold tracking-wider text-[var(--aura-chrome-mid)]">
          ORDER #AURA-9842
        </span>
        <span className="font-display text-2xl text-[var(--aura-tertiary)]">$14.43</span>
      </div>

      <div className="flex flex-col gap-4">
        {ORDER_ITEMS.map((item, i) => (
          <div key={`${item.name}-${i}`} className="flex justify-between items-center">
            <div className="flex gap-3 items-center">
              <span className="text-[var(--aura-tertiary)] font-bold text-sm">{item.qty}x</span>
              <span className="font-body text-sm text-[var(--aura-chrome-bright)]">{item.name}</span>
            </div>
            <span className="font-display text-sm text-[var(--aura-chrome-mid)] italic">{item.price}</span>
          </div>
        ))}
      </div>

      <div className="w-full h-px bg-white/5" />

      <div className="flex flex-col gap-4">
        <div className="relative w-full h-[2px] bg-white/10">
          <div
            className="absolute h-full bg-[var(--aura-tertiary)] transition-all duration-500"
            style={{ width: `${(completedSteps / (STEPS.length - 1)) * 100}%` }}
          />
          <div className="absolute top-1/2 left-0 -translate-y-1/2 flex justify-between w-full">
            {STEPS.map((step, i) => (
              <div
                key={step.label}
                className={`w-4 h-4 rounded-full flex items-center justify-center border-2 ${
                  i <= completedSteps
                    ? 'bg-[var(--aura-tertiary)] border-white/20 ring-4 ring-[var(--aura-noir-deep)]'
                    : 'bg-[var(--aura-noir-deep)] border-white/10 ring-4 ring-[var(--aura-noir-deep)]'
                }`}
              >
                {i <= completedSteps && (
                  <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="var(--aura-noir-deep)" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                    <polyline points="20 6 9 17 4 12" />
                  </svg>
                )}
              </div>
            ))}
          </div>
        </div>

        <div className="flex justify-between w-full px-1">
          {STEPS.map((step) => (
            <span
              key={step.label}
              className={`font-body text-[10px] tracking-wider uppercase ${
                step.active || STEPS.indexOf(step) < completedSteps
                  ? 'text-[var(--aura-tertiary)] font-semibold'
                  : 'text-[var(--aura-chrome-mid)]'
              }`}
            >
              {step.label}
            </span>
          ))}
        </div>
      </div>
    </div>
  );
}
