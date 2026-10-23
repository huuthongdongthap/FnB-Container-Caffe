/**
 * The free-text note to the bar. Numbered after the option groups the rule layer
 * kept, so the section sequence stays consecutive when a drink cannot take sugar
 * or ice.
 */

interface DrinkNotesSectionProps {
  /** Section number shown before the label. */
  index: number;
  /** id of the input, wired to the label so clicking it focuses the field. */
  inputId: string;
  value: string;
  onChange: (value: string) => void;
}

export function DrinkNotesSection({ index, inputId, value, onChange }: DrinkNotesSectionProps) {
  return (
    <div>
      <label
        htmlFor={inputId}
        className="block text-xs font-bold uppercase tracking-wider text-[var(--aura-chrome-soft)] mb-2"
      >
        {index}. Ghi chú thêm cho quầy bar
      </label>
      <input
        id={inputId}
        type="text"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder="Ví dụ: cho nhiều sữa, mang ly giữ nhiệt riêng..."
        className="w-full px-3.5 py-2.5 bg-black/40 border border-white/10 rounded-xl text-xs text-white placeholder-white/30 focus:outline-none focus:border-[var(--aura-chrome-bright)] transition-colors"
      />
    </div>
  );
}
