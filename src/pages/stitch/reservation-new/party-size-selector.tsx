import { GUEST_OPTIONS } from './reservation-new-constants';
import { Users } from 'lucide-react';

interface PartySizeSelectorProps {
  selectedParty: string;
  onSelect: (guest: string) => void;
}

export function PartySizeSelector({ selectedParty, onSelect }: PartySizeSelectorProps) {
  return (
    <section>
      <div className="flex items-center gap-2 mb-4">
        <Users className="w-4 h-4 text-[#4A7C59]" />
        <label className="font-body text-xs font-bold uppercase tracking-widest text-[var(--aura-chrome-mid)]">
          1. SỐ LƯỢNG KHÁCH
        </label>
      </div>
      <div className="flex flex-wrap gap-3">
        {GUEST_OPTIONS.map((g) => {
          const isSelected = selectedParty === g;
          return (
            <button
              key={g}
              type="button"
              onClick={() => onSelect(g)}
              className={`px-5 py-3 min-h-[44px] inline-flex items-center justify-center rounded-xl font-body text-sm transition-all cursor-pointer border ${
                isSelected
                  ? 'bg-[var(--aura-chrome-bright)] text-[#0A1A2E] font-bold shadow-lg border-[var(--aura-chrome-bright)] scale-105'
                  : 'bg-white/5 border-white/10 text-[var(--aura-chrome-soft)] hover:border-[var(--aura-chrome-mid)] hover:text-white'
              }`}
            >
              {g}
            </button>
          );
        })}
      </div>
    </section>
  );
}
