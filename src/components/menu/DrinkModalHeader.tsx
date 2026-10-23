/**
 * The dialog header: item image, category, name and the menu price. The price is
 * the only figure shown — the drink is billed at the menu rate, so nothing here is
 * an estimate that the checkout could contradict.
 */

import { X } from 'lucide-react';

interface DrinkModalHeaderProps {
  imageSrc: string;
  name: string;
  category: string;
  /** Pre-formatted price, e.g. "29.000₫". */
  price: string;
  onClose: () => void;
}

export function DrinkModalHeader({
  imageSrc,
  name,
  category,
  price,
  onClose,
}: DrinkModalHeaderProps) {
  return (
    <div className="relative p-5 border-b border-white/10 flex items-start gap-4 bg-white/[0.02]">
      {imageSrc && (
        <img
          src={imageSrc}
          alt={name}
          className="w-16 h-16 rounded-xl object-cover border border-white/10 shrink-0"
        />
      )}
      <div className="flex-1 min-w-0 pr-8">
        <span className="text-[10px] uppercase font-bold tracking-widest text-[#4A7C59] block mb-1">
          {category} • Tùy chỉnh vị
        </span>
        <h3
          id="drink-customizer-title"
          className="text-lg font-bold text-white truncate"
          style={{ fontFamily: 'var(--aura-font-display)' }}
        >
          {name}
        </h3>
        <p className="text-sm font-semibold text-[var(--aura-chrome-bright)] mt-0.5">{price}</p>
      </div>
      <button
        type="button"
        onClick={onClose}
        aria-label="Đóng bảng tùy chọn"
        className="absolute top-4 right-4 min-h-[44px] min-w-[44px] p-2 rounded-full bg-white/5 hover:bg-white/10 text-white/70 hover:text-white flex items-center justify-center transition-colors cursor-pointer"
      >
        <X className="w-5 h-5" />
      </button>
    </div>
  );
}
