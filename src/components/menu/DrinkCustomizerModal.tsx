'use client';

import { useState, useEffect, useId, useRef } from 'react';
import { Plus, Minus } from 'lucide-react';
import type { MenuItemData } from '@/components/stitch/StitchMenuNew-types';
import { buildDrinkOptions } from '@/lib/menu-option-rules';
import { DrinkModalHeader } from './DrinkModalHeader';
import { DrinkOptionGroup } from './DrinkOptionGroup';
import { DrinkNotesSection } from './DrinkNotesSection';
import { useDialogFocusTrap } from './use-dialog-focus-trap';

interface DrinkCustomizerModalProps {
  item: MenuItemData | null;
  isOpen: boolean;
  onClose: () => void;
  onConfirm: (customizedItem: {
    item: MenuItemData;
    quantity: number;
    finalPrice: number;
    modifiers: string[];
    notes: string;
  }) => void;
}

/**
 * One adjustable axis the rule layer enabled for this item.
 * `label` drives the heading; `selected` is the customer's pick.
 */
interface OptionSection {
  label: string;
  options: readonly string[];
  selected: string;
  onChange: (value: string) => void;
}

/**
 * A drink is served exactly as the menu prices it: sweetness, ice and a note to
 * the bar are the only adjustable axes, and never all three at once. Sections are
 * numbered from the groups that survived the rule layer so a customer never reads
 * "3. Mức đá" straight under "1. Độ ngọt" with a missing 2.
 */
export function DrinkCustomizerModal({
  item,
  isOpen,
  onClose,
  onConfirm,
}: DrinkCustomizerModalProps) {
  // ── All hooks MUST be called unconditionally (Rules of Hooks) ──
  const noteInputId = useId();
  const dialogRef = useRef<HTMLDivElement>(null);
  const [sweetness, setSweetness] = useState('');
  const [ice, setIce] = useState('');
  const [notes, setNotes] = useState('');
  const [quantity, setQuantity] = useState(1);

  const plan = item ? buildDrinkOptions(item) : null;
  const isModalVisible = Boolean(isOpen && item && plan && !plan.bypass);

  useEffect(() => {
    if (!item) return;
    const next = buildDrinkOptions(item);
    setSweetness(next.sweetnessOptions[0] ?? '');
    setIce(next.iceOptions[0] ?? '');
    setNotes('');
    setQuantity(1);
  }, [item?.id, isOpen]);

  useDialogFocusTrap(dialogRef, isModalVisible, onClose);

  // Guard: render nothing when closed, no item selected, or the item is served as-is.
  if (!isModalVisible || !item || !plan) return null;

  const basePrice = parseInt(item.price.replace(/\D/g, ''), 10) || 25000;
  const totalPrice = basePrice * quantity;

  // State resets in an effect, so the very first paint would briefly show nothing
  // selected; fall back to the plan's own default until the effect commits.
  const pickedSweetness = sweetness || plan.sweetnessOptions[0] || '';
  const pickedIce = ice || plan.iceOptions[0] || '';

  const handleConfirm = () => {
    const modifierList = [pickedSweetness, pickedIce, notes.trim()].filter(Boolean);
    onConfirm({
      item,
      quantity,
      finalPrice: basePrice,
      modifiers: modifierList,
      notes: notes.trim(),
    });
    onClose();
  };

  const sections: OptionSection[] = [];
  if (plan.showSweetness) {
    sections.push({
      label: 'Độ ngọt (Đường)',
      options: plan.sweetnessOptions,
      selected: pickedSweetness,
      onChange: setSweetness,
    });
  }
  if (plan.showIce) {
    sections.push({
      label: 'Mức đá',
      options: plan.iceOptions,
      selected: pickedIce,
      onChange: setIce,
    });
  }

  const sectionsVisible = sections.length + (plan.showNotes ? 1 : 0);

  return (
    <div
      ref={dialogRef}
      tabIndex={-1}
      role="dialog"
      aria-modal="true"
      aria-labelledby="drink-customizer-title"
      className="fixed inset-0 z-[120] flex items-end sm:items-center justify-center p-0 sm:p-4 bg-black/70 backdrop-blur-sm animate-fade-in"
    >
      <div
        className="w-full max-w-lg bg-[#0A1A2E] border border-white/10 rounded-t-3xl sm:rounded-2xl shadow-2xl flex flex-col max-h-[90vh] overflow-hidden"
        style={{ fontFamily: 'var(--aura-font-body)' }}
      >
        <DrinkModalHeader
          imageSrc={item.imageSrc}
          name={item.name}
          category={item.category}
          price={`${basePrice.toLocaleString('vi-VN')}₫`}
          onClose={onClose}
        />

        {/* Scrollable modifiers list — numbered off the sections that actually render */}
        <div className="flex-1 overflow-y-auto p-5 space-y-6">
          {sections.map((section, index) => (
            <DrinkOptionGroup
              key={section.label}
              index={index + 1}
              label={section.label}
              options={section.options}
              selected={section.selected}
              onChange={section.onChange}
            />
          ))}

          {plan.showNotes && (
            <DrinkNotesSection
              index={sectionsVisible}
              inputId={noteInputId}
              value={notes}
              onChange={setNotes}
            />
          )}
        </div>

        {/* Footer: quantity counter + confirm button */}
        <div className="p-4 sm:p-5 border-t border-white/10 bg-black/40 flex items-center gap-4">
          <div className="flex items-center gap-2 bg-white/5 border border-white/10 rounded-full px-2 py-1">
            <button
              type="button"
              onClick={() => setQuantity((q) => Math.max(1, q - 1))}
              disabled={quantity <= 1}
              aria-label="Giảm số lượng"
              className="min-h-[44px] min-w-[44px] w-11 h-11 rounded-full flex items-center justify-center text-white/70 hover:text-white disabled:opacity-30 cursor-pointer"
            >
              <Minus className="w-3.5 h-3.5" />
            </button>
            <span className="text-sm font-bold text-white min-w-[20px] text-center">
              {quantity}
            </span>
            <button
              type="button"
              onClick={() => setQuantity((q) => q + 1)}
              aria-label="Tăng số lượng"
              className="min-h-[44px] min-w-[44px] w-11 h-11 rounded-full flex items-center justify-center text-white/70 hover:text-white cursor-pointer"
            >
              <Plus className="w-3.5 h-3.5" />
            </button>
          </div>

          <button
            type="button"
            onClick={handleConfirm}
            className="flex-1 min-h-[44px] py-3 px-5 rounded-full bg-gradient-to-r from-[var(--aura-chrome-light)] to-[var(--aura-chrome-bright)] text-[#0A1A2E] text-xs font-bold uppercase tracking-wider flex items-center justify-between shadow-lg hover:brightness-110 active:scale-[0.98] transition-all cursor-pointer"
          >
            <span>Thêm vào giỏ</span>
            <span>{totalPrice.toLocaleString('vi-VN')}₫</span>
          </button>
        </div>
      </div>
    </div>
  );
}
