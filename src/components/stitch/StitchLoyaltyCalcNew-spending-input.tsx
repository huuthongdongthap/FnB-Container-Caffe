interface SpendingInputProps {
  spending: number;
  points: number;
  onChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
}

export function SpendingInput({ spending, points, onChange }: SpendingInputProps) {
  return (
    <div
      className="relative mb-10 overflow-hidden rounded p-6"
      style={{
        background: 'var(--aura-surface-container)',
        border: '1px solid var(--aura-surface-container-high)',
      }}
    >
      <div className="flex flex-col gap-4">
        <label
          className="font-[family-name:var(--aura-body-font)] text-xs uppercase tracking-widest text-[var(--aura-bronze-shimmer)]"
          htmlFor="spending-input"
        >
          Current Spending ($)
        </label>
        <input
          className="border-b border-[var(--aura-surface-container-high)] bg-transparent py-2 font-[family-name:var(--aura-display-font)] text-2xl text-[var(--aura-bronze-shimmer)] outline-none transition-colors duration-300 focus:border-[var(--aura-bronze-shimmer)]"
          id="spending-input"
          placeholder="0.00"
          type="number"
          value={spending || ''}
          onChange={onChange}
        />
        <div className="mt-2 flex items-center justify-between">
          <span className="font-[family-name:var(--aura-body-font)] text-xs text-[var(--aura-bronze-shimmer)] opacity-60">
            Estimated Points
          </span>
          <span className="font-[family-name:var(--aura-body-font)] text-sm text-[var(--aura-chrome-bright)]">
            {points.toLocaleString()} PTS
          </span>
        </div>
      </div>
    </div>
  );
}
