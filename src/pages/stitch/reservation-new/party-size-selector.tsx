import { GUEST_OPTIONS } from './reservation-new-constants';

interface PartySizeSelectorProps {
  selectedParty: string;
  onSelect: (guest: string) => void;
}

export function PartySizeSelector({ selectedParty, onSelect }: PartySizeSelectorProps) {
  return (
    <section>
      <label className="block font-label-sm text-label-sm uppercase mb-4 text-secondary">Guests</label>
      <div className="flex space-x-3 overflow-x-auto no-scrollbar pb-2">
        {GUEST_OPTIONS.map(g => (
          <button
            key={g}
            type="button"
            onClick={() => onSelect(g)}
            className={`flex-shrink-0 w-12 h-12 rounded-xl glass-panel flex items-center justify-center font-label-md text-label-md transition-all ${
              selectedParty === g
                ? 'active-pill bronze-glow'
                : 'text-on-surface-variant hover:border-secondary/50'
            }`}
          >
            {g}
          </button>
        ))}
      </div>
    </section>
  );
}
