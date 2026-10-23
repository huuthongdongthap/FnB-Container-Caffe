/**
 * A labelled grid of selectable option chips (sweetness levels, ice levels).
 * Extracted from the modal so the dialog file stays focused on layout and state.
 */

interface DrinkOptionGroupProps {
  /** Section number shown before the title; the modal numbers only rendered groups. */
  index: number;
  label: string;
  options: readonly string[];
  selected: string;
  onChange: (value: string) => void;
}

export function DrinkOptionGroup({
  index,
  label,
  options,
  selected,
  onChange,
}: DrinkOptionGroupProps) {
  return (
    <div>
      <h4 className="text-xs font-bold uppercase tracking-wider text-[var(--aura-chrome-soft)] mb-2.5">
        {index}. {label}
      </h4>
      <div className="grid grid-cols-2 gap-2">
        {options.map((opt) => {
          const isSelected = selected === opt;
          return (
            <button
              key={opt}
              type="button"
              data-section={label}
              onClick={() => onChange(opt)}
              className={`py-2 px-3 rounded-xl border text-xs font-medium text-left transition-all cursor-pointer ${
                isSelected
                  ? 'border-[var(--aura-chrome-bright)] bg-[var(--aura-chrome-bright)]/10 text-white font-semibold'
                  : 'border-white/10 bg-white/[0.02] text-white/70 hover:border-white/20'
              }`}
            >
              {opt}
            </button>
          );
        })}
      </div>
    </div>
  );
}
