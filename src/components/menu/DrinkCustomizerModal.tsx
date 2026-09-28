'use client';

import { useState, useId } from 'react';
import { X, Plus, Minus, Sparkles, Check } from 'lucide-react';
import type { MenuItemData } from '@/components/stitch/StitchMenuNew-types';

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

const SWEETNESS_OPTIONS = ['100% đường (chuẩn)', '70% ít ngọt', '50% ngọt thanh', 'Không đường'];
const ICE_OPTIONS = ['Đá đầy đủ (chuẩn)', 'Ít đá', 'Đá riêng', 'Uống nóng'];
const SIZE_OPTIONS = [
  { label: 'Size Tiêu Chuẩn (M)', extra: 0 },
  { label: 'Size Lớn (L)', extra: 5000 },
];
const TOPPINGS = [
  { id: 't_cream', name: 'Kem cheese béo mặn', price: 8000 },
  { id: 't_pearl', name: 'Trân châu trắng', price: 5000 },
  { id: 't_jelly', name: 'Thạch cà phê giòn', price: 5000 },
];

export function DrinkCustomizerModal({
  item,
  isOpen,
  onClose,
  onConfirm,
}: DrinkCustomizerModalProps) {
  // ── All hooks MUST be called unconditionally (Rules of Hooks) ──
  const noteInputId = useId();
  const [sweetness, setSweetness] = useState<string>(SWEETNESS_OPTIONS[0] ?? '100% đường (chuẩn)');
  const [ice, setIce] = useState<string>(ICE_OPTIONS[0] ?? 'Đá đầy đủ (chuẩn)');
  const [size, setSize] = useState(SIZE_OPTIONS[0] ?? { label: 'Size Tiêu Chuẩn (M)', extra: 0 });
  const [selectedToppings, setSelectedToppings] = useState<string[]>([]);
  const [notes, setNotes] = useState('');
  const [quantity, setQuantity] = useState(1);

  // Guard: render nothing when modal is closed or no item selected
  if (!isOpen || !item) return null;

  const basePrice = parseInt(item.price.replace(/\D/g, ''), 10) || 25000;

  const toppingsPrice = selectedToppings.reduce((sum, tid) => {
    const t = TOPPINGS.find((top) => top.id === tid);
    return sum + (t?.price ?? 0);
  }, 0);

  const unitPrice = basePrice + size.extra + toppingsPrice;
  const totalPrice = unitPrice * quantity;

  const toggleTopping = (id: string) => {
    setSelectedToppings((prev) =>
      prev.includes(id) ? prev.filter((t) => t !== id) : [...prev, id],
    );
  };

  const handleConfirm = () => {
    const modifierList: string[] = [
      size.label,
      sweetness,
      ice,
      ...selectedToppings.map((tid) => TOPPINGS.find((t) => t.id === tid)?.name).filter(Boolean) as string[],
    ];

    onConfirm({
      item,
      quantity,
      finalPrice: unitPrice,
      modifiers: modifierList,
      notes: notes.trim(),
    });
    onClose();
  };

  return (
    <div className="fixed inset-0 z-[120] flex items-end sm:items-center justify-center p-0 sm:p-4 bg-black/70 backdrop-blur-sm animate-fade-in">
      <div
        className="w-full max-w-lg bg-[#0A1A2E] border border-white/10 rounded-t-3xl sm:rounded-2xl shadow-2xl flex flex-col max-h-[90vh] overflow-hidden"
        style={{ fontFamily: 'var(--aura-font-body)' }}
      >
        {/* Header with image & item info */}
        <div className="relative p-5 border-b border-white/10 flex items-start gap-4 bg-white/[0.02]">
          {item.imageSrc && (
            <img
              src={item.imageSrc}
              alt={item.name}
              className="w-16 h-16 rounded-xl object-cover border border-white/10 shrink-0"
            />
          )}
          <div className="flex-1 min-w-0 pr-8">
            <span className="text-[10px] uppercase font-bold tracking-widest text-[#4A7C59] block mb-1">
              {item.category} • Tùy chỉnh vị
            </span>
            <h3
              className="text-lg font-bold text-white truncate"
              style={{ fontFamily: 'var(--aura-font-display)' }}
            >
              {item.name}
            </h3>
            <p className="text-sm font-semibold text-[var(--aura-chrome-bright)] mt-0.5">
              {basePrice.toLocaleString('vi-VN')}₫
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Đóng bảng tùy chọn"
            className="absolute top-4 right-4 p-2 rounded-full bg-white/5 hover:bg-white/10 text-white/70 hover:text-white transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Scrollable modifiers list */}
        <div className="flex-1 overflow-y-auto p-5 space-y-6">
          {/* Size */}
          <div>
            <h4 className="text-xs font-bold uppercase tracking-wider text-[var(--aura-chrome-soft)] mb-2.5">
              1. Chọn kích cỡ (Size)
            </h4>
            <div className="grid grid-cols-2 gap-2.5">
              {SIZE_OPTIONS.map((opt) => {
                const isSelected = size.label === opt.label;
                return (
                  <button
                    key={opt.label}
                    type="button"
                    onClick={() => setSize(opt)}
                    className={`py-2.5 px-3 rounded-xl border text-xs font-medium text-left flex items-center justify-between transition-all cursor-pointer ${
                      isSelected
                        ? 'border-[var(--aura-chrome-bright)] bg-[var(--aura-chrome-bright)]/10 text-white'
                        : 'border-white/10 bg-white/[0.02] text-white/70 hover:border-white/20'
                    }`}
                  >
                    <span>{opt.label}</span>
                    {opt.extra > 0 && (
                      <span className="text-[11px] font-semibold text-[#6B9FB8]">
                        +{opt.extra.toLocaleString('vi-VN')}₫
                      </span>
                    )}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Sweetness */}
          <div>
            <h4 className="text-xs font-bold uppercase tracking-wider text-[var(--aura-chrome-soft)] mb-2.5">
              2. Độ ngọt (Đường)
            </h4>
            <div className="grid grid-cols-2 gap-2">
              {SWEETNESS_OPTIONS.map((opt) => {
                const isSelected = sweetness === opt;
                return (
                  <button
                    key={opt}
                    type="button"
                    onClick={() => setSweetness(opt)}
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

          {/* Ice */}
          <div>
            <h4 className="text-xs font-bold uppercase tracking-wider text-[var(--aura-chrome-soft)] mb-2.5">
              3. Mức đá
            </h4>
            <div className="grid grid-cols-2 gap-2">
              {ICE_OPTIONS.map((opt) => {
                const isSelected = ice === opt;
                return (
                  <button
                    key={opt}
                    type="button"
                    onClick={() => setIce(opt)}
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

          {/* Toppings */}
          <div>
            <h4 className="text-xs font-bold uppercase tracking-wider text-[var(--aura-chrome-soft)] mb-2.5">
              4. Topping thêm (tùy chọn)
            </h4>
            <div className="space-y-2">
              {TOPPINGS.map((top) => {
                const isSelected = selectedToppings.includes(top.id);
                return (
                  <button
                    key={top.id}
                    type="button"
                    onClick={() => toggleTopping(top.id)}
                    className={`w-full py-2.5 px-3 rounded-xl border text-xs font-medium flex items-center justify-between transition-all cursor-pointer ${
                      isSelected
                        ? 'border-[var(--aura-chrome-bright)] bg-[var(--aura-chrome-bright)]/10 text-white'
                        : 'border-white/10 bg-white/[0.02] text-white/70 hover:border-white/20'
                    }`}
                  >
                    <div className="flex items-center gap-2">
                      <div
                        className={`w-4 h-4 rounded flex items-center justify-center border ${
                          isSelected
                            ? 'bg-[var(--aura-chrome-bright)] border-[var(--aura-chrome-bright)] text-[#0A1A2E]'
                            : 'border-white/30'
                        }`}
                      >
                        {isSelected && <Check className="w-3 h-3 stroke-[3]" />}
                      </div>
                      <span>{top.name}</span>
                    </div>
                    <span className="font-semibold text-[#6B9FB8]">
                      +{top.price.toLocaleString('vi-VN')}₫
                    </span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Special instructions */}
          <div>
            <label
              htmlFor={noteInputId}
              className="block text-xs font-bold uppercase tracking-wider text-[var(--aura-chrome-soft)] mb-2"
            >
              5. Ghi chú thêm cho quầy bar
            </label>
            <input
              id={noteInputId}
              type="text"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Ví dụ: cho nhiều sữa, mang ly giữ nhiệt riêng..."
              className="w-full px-3.5 py-2.5 bg-black/40 border border-white/10 rounded-xl text-xs text-white placeholder-white/30 focus:outline-none focus:border-[var(--aura-chrome-bright)] transition-colors"
            />
          </div>
        </div>

        {/* Footer: quantity counter + confirm button */}
        <div className="p-4 sm:p-5 border-t border-white/10 bg-black/40 flex items-center gap-4">
          <div className="flex items-center gap-2 bg-white/5 border border-white/10 rounded-full px-2 py-1">
            <button
              type="button"
              onClick={() => setQuantity((q) => Math.max(1, q - 1))}
              disabled={quantity <= 1}
              aria-label="Giảm số lượng"
              className="w-7 h-7 rounded-full flex items-center justify-center text-white/70 hover:text-white disabled:opacity-30 cursor-pointer"
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
              className="w-7 h-7 rounded-full flex items-center justify-center text-white/70 hover:text-white cursor-pointer"
            >
              <Plus className="w-3.5 h-3.5" />
            </button>
          </div>

          <button
            type="button"
            onClick={handleConfirm}
            className="flex-1 py-3 px-5 rounded-full bg-gradient-to-r from-[var(--aura-chrome-light)] to-[var(--aura-chrome-bright)] text-[#0A1A2E] text-xs font-bold uppercase tracking-wider flex items-center justify-between shadow-lg hover:brightness-110 active:scale-[0.98] transition-all cursor-pointer"
          >
            <span>Thêm vào giỏ</span>
            <span>{totalPrice.toLocaleString('vi-VN')}₫</span>
          </button>
        </div>
      </div>
    </div>
  );
}
