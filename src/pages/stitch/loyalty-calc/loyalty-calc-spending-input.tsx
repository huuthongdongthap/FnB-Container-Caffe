interface SpendingInputCardProps {
  spending: number;
  points: number;
  onChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
}

export function SpendingInputCard({ spending, points, onChange }: SpendingInputCardProps) {
  return (
    <div className="bg-[#121F31] border border-[#2E3A4C] p-4 rounded mb-8 relative overflow-hidden">
      <div className="flex flex-col gap-3">
        <label className="font-label-sm text-label-sm uppercase tracking-widest text-secondary" htmlFor="spending-input">
          Current Spending ($)
        </label>
        <input
          id="spending-input"
          type="number"
          value={spending}
          onChange={onChange}
          placeholder="0.00"
          className="bg-transparent border-b border-[#2E3A4C] focus:border-[var(--aura-tertiary)] outline-none font-headline-md text-headline-md text-[var(--aura-tertiary)] py-1 transition-colors duration-300"
        />
        <div className="flex justify-between items-center mt-1">
          <span className="font-label-sm text-label-sm text-secondary opacity-60">Estimated Points</span>
          <span className="font-label-md text-label-md text-[var(--aura-tertiary)]" id="points-display">
            {points.toLocaleString()} PTS
          </span>
        </div>
      </div>
    </div>
  );
}
