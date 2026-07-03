/**
 * StitchMobileOrderingV2 — AURA CAFE Mobile Ordering (Stitch v2 design)
 *
 * Mobile-first ordering page with glassmorphism cards, chrome accents,
 * bottom cart bar, and premium nocturnal lounge feel.
 * Source: Stitch AI mobile-v2 export.
 */
'use client';

import { useState } from 'react';
import { clsx } from 'clsx';
import {
  Search,
  ShoppingCart,
  Plus,
  Minus,
  ArrowLeft,
  Coffee,
  ChevronRight,
  Star,
  MapPin,
} from 'lucide-react';

/* ─── Types ─────────────────────────────────────────────────────── */
export interface MenuItem {
  id: string;
  name: string;
  description: string;
  price: number;
  category: string;
  featured?: boolean;
  rating?: number;
}

export interface CartItem extends MenuItem {
  quantity: number;
}

export interface StitchMobileOrderingV2Props {
  items?: MenuItem[];
  tableId?: string;
  restaurantName?: string;
}

/* ─── Default Menu Data ─────────────────────────────────────────── */
const DEFAULT_ITEMS: MenuItem[] = [
  { id: '1', name: 'Cà phê sữa đá', description: 'Espresso pha phin truyền thống với sữa đặc', price: 45000, category: 'Cà phê', featured: true, rating: 4.8 },
  { id: '2', name: 'Bạc xỉu', description: 'Cà phê sữa với nhiều sữa hơn, vị ngọt nhẹ', price: 42000, category: 'Cà phê', rating: 4.6 },
  { id: '3', name: 'Cold Brew', description: 'Ủ lạnh 24h, vị đậm đà không chua', price: 55000, category: 'Cà phê', featured: true, rating: 4.9 },
  { id: '4', name: 'Matcha Latte', description: 'Bột matcha Nhật nguyên chất với sữa tươi', price: 52000, category: 'Trà & Sữa', rating: 4.5 },
  { id: '5', name: 'Trà đào cam sả', description: 'Trà lài kết hợp đào tươi, cam và sả', price: 48000, category: 'Trà & Sữa', rating: 4.7 },
  { id: '6', name: 'Bánh mì que pate', description: 'Bánh mì nóng giòn kẹp pate truyền thống', price: 25000, category: 'Bánh & Ăn nhẹ', rating: 4.4 },
  { id: '7', name: 'Bánh flan', description: 'Bánh flan thơm béo sốt caramel', price: 20000, category: 'Bánh & Ăn nhẹ', rating: 4.3 },
  { id: '8', name: 'Sinh tố bơ', description: 'Sinh tố bơ tươi xay cùng sữa đặc', price: 49000, category: 'Sinh tố', rating: 4.8 },
];

const CATEGORIES = ['Tất cả', 'Cà phê', 'Trà & Sữa', 'Bánh & Ăn nhẹ', 'Sinh tố'];

/* ─── Menu Item Card ─────────────────────────────────────────────── */
function MenuItemCard({
  item,
  quantity,
  onAdd,
  onRemove,
}: {
  item: MenuItem;
  quantity: number;
  onAdd: () => void;
  onRemove: () => void;
}) {
  return (
    <div className="glass-panel-mobile p-4 flex items-start gap-4 group">
      {/* Image placeholder */}
      <div className="w-16 h-16 rounded-xl flex-shrink-0 bg-[rgba(198,198,199,0.08)] flex items-center justify-center overflow-hidden">
        <Coffee className="w-7 h-7 text-[rgba(198,198,199,0.3)]" />
      </div>

      {/* Content */}
      <div className="flex-1 min-w-0">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <h3 className="font-display text-[17px] text-[#e8e8e8] font-semibold truncate">
                {item.name}
              </h3>
              {item.featured && (
                <Star className="w-3.5 h-3.5 fill-[#d4a574] text-[#d4a574]" />
              )}
            </div>
            <p className="font-['Space_Grotesk',sans-serif] text-[12px] text-[#a0a8b0] leading-relaxed mt-0.5 line-clamp-2">
              {item.description}
            </p>
          </div>
        </div>

        <div className="flex items-center justify-between mt-3">
          <span className="font-display text-[18px] text-[#c6c6c7] font-semibold">
            {item.price.toLocaleString()}₫
          </span>

          <div className="flex items-center gap-2">
            {quantity > 0 ? (
              <div className="flex items-center gap-2 bg-[rgba(198,198,199,0.1)] rounded-lg px-2 py-1">
                <button
                  type="button"
                  onClick={onRemove}
                  className="w-7 h-7 flex items-center justify-center rounded-md text-[#a0a8b0] hover:text-[#c6c6c7] hover:bg-[rgba(198,198,199,0.1)] transition-all active:scale-90"
                >
                  <Minus className="w-3.5 h-3.5" />
                </button>
                <span className="font-['Space_Grotesk',sans-serif] text-[13px] text-[#e8e8e8] font-medium w-5 text-center">
                  {quantity}
                </span>
                <button
                  type="button"
                  onClick={onAdd}
                  className="w-7 h-7 flex items-center justify-center rounded-md text-[#c6c6c7] hover:bg-[rgba(198,198,199,0.15)] transition-all active:scale-90"
                >
                  <Plus className="w-3.5 h-3.5" />
                </button>
              </div>
            ) : (
              <button
                type="button"
                onClick={onAdd}
                className="w-8 h-8 flex items-center justify-center rounded-lg bg-[rgba(198,198,199,0.1)] text-[#c6c6c7] hover:bg-[rgba(198,198,199,0.2)] transition-all active:scale-90"
              >
                <Plus className="w-4 h-4" />
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

/* ─── Main Component ─────────────────────────────────────────────── */
export default function StitchMobileOrderingV2({
  items = DEFAULT_ITEMS,
  tableId = 'B01',
  restaurantName = 'AURA CAFE',
}: Readonly<StitchMobileOrderingV2Props>) {
  const [activeCategory, setActiveCategory] = useState('Tất cả');
  const [cart, setCart] = useState<CartItem[]>([]);
  const [searchQuery, setSearchQuery] = useState('');

  const filteredItems = items.filter((item) => {
    const matchesCategory = activeCategory === 'Tất cả' || item.category === activeCategory;
    const matchesSearch = item.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      item.description.toLowerCase().includes(searchQuery.toLowerCase());
    return matchesCategory && matchesSearch;
  });

  const getQuantity = (id: string) => cart.find((c) => c.id === id)?.quantity ?? 0;

  const addToCart = (item: MenuItem) => {
    setCart((prev) => {
      const existing = prev.find((c) => c.id === item.id);
      if (existing) {
        return prev.map((c) => c.id === item.id ? { ...c, quantity: c.quantity + 1 } : c);
      }
      return [...prev, { ...item, quantity: 1 }];
    });
  };

  const removeFromCart = (id: string) => {
    setCart((prev) => {
      const existing = prev.find((c) => c.id === id);
      if (existing && existing.quantity <= 1) {
        return prev.filter((c) => c.id !== id);
      }
      return prev.map((c) => c.id === id ? { ...c, quantity: c.quantity - 1 } : c);
    });
  };

  const totalItems = cart.reduce((acc, c) => acc + c.quantity, 0);
  const totalPrice = cart.reduce((acc, c) => acc + c.price * c.quantity, 0);

  return (
    <div className="min-h-screen flex flex-col" style={{ backgroundColor: '#0A1A2E', color: '#efe0d6' }}>
      {/* Status Bar */}
      <div className="flex items-center justify-between px-4 pt-3 pb-2">
        <div className="flex items-center gap-1.5">
          <MapPin className="w-3 h-3 text-[#d4a574]" />
          <span className="font-['Space_Grotesk',sans-serif] text-[11px] text-[#a0a8b0] tracking-wide">
            Bàn <span className="text-[#d4a574] font-semibold">{tableId}</span>
          </span>
        </div>
        <div className="flex items-center gap-1.5">
          <div className="w-1.5 h-1.5 rounded-full bg-[#4CAF50] animate-pulse" />
          <span className="font-['Space_Grotesk',sans-serif] text-[10px] text-[#a0a8b0] tracking-wider uppercase">Đang mở</span>
        </div>
      </div>

      {/* Header */}
      <div className="px-4 pb-2">
        <div className="flex items-center justify-between mb-1">
          <h1 className="font-display text-[24px] text-[#e8e8e8] font-semibold">
            {restaurantName}
          </h1>
        </div>
        <p className="font-['Space_Grotesk',sans-serif] text-[12px] text-[#a0a8b0]">
          Container Caffe & Space · Sa Đéc
        </p>
      </div>

      {/* Search Bar */}
      <div className="px-4 mb-3">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#a0a8b0]" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Tìm món..."
            className="w-full pl-10 pr-4 py-3 rounded-xl text-[13px] font-['Space_Grotesk',sans-serif] bg-[rgba(255,255,255,0.05)] border border-[rgba(255,255,255,0.08)] text-[#e8e8e8] placeholder:text-[#a0a8b0] focus:outline-none focus:border-[rgba(198,198,199,0.3)] focus:ring-1 focus:ring-[rgba(198,198,199,0.1)] transition-all"
          />
        </div>
      </div>

      {/* Category Pills */}
      <div className="px-4 mb-4 overflow-x-auto">
        <div className="flex gap-2 pb-1 min-w-max">
          {CATEGORIES.map((cat) => (
            <button
              key={cat}
              type="button"
              onClick={() => setActiveCategory(cat)}
              className={clsx(
                'px-4 py-2 rounded-full text-[12px] font-[\'Space_Grotesk\',sans-serif] font-medium tracking-wide transition-all border whitespace-nowrap',
                activeCategory === cat
                  ? 'bg-[rgba(198,198,199,0.15)] text-[#c6c6c7] border-[rgba(198,198,199,0.3)]'
                  : 'bg-transparent text-[#a0a8b0] border-[rgba(255,255,255,0.08)] hover:border-[rgba(198,198,199,0.2)] hover:text-[#c6c6c7]'
              )}
            >
              {cat}
            </button>
          ))}
        </div>
      </div>

      {/* Menu Items */}
      <div className="flex-1 px-4 pb-36 overflow-y-auto">
        <div className="flex flex-col gap-3">
          {filteredItems.length === 0 ? (
            <div className="text-center py-12">
              <Coffee className="w-10 h-10 mx-auto mb-3 text-[rgba(198,198,199,0.2)]" />
              <p className="font-['Space_Grotesk',sans-serif] text-[14px] text-[#a0a8b0]">
                Không tìm thấy món
              </p>
            </div>
          ) : (
            filteredItems.map((item) => (
              <MenuItemCard
                key={item.id}
                item={item}
                quantity={getQuantity(item.id)}
                onAdd={() => addToCart(item)}
                onRemove={() => removeFromCart(item.id)}
              />
            ))
          )}
        </div>
      </div>

      {/* Bottom Cart Bar */}
      {totalItems > 0 && (
        <div className="fixed bottom-0 left-0 right-0 z-50 p-4 pb-6">
          <div className="glass-panel-mobile-cart rounded-2xl p-4 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="relative">
                <ShoppingCart className="w-5 h-5 text-[#c6c6c7]" />
                <span className="absolute -top-2 -right-2 w-4 h-4 rounded-full bg-[#d4a574] text-[10px] font-bold text-[#1a1a2e] flex items-center justify-center font-['Space_Grotesk',sans-serif]">
                  {totalItems}
                </span>
              </div>
              <div>
                <span className="font-display text-[18px] text-[#e8e8e8] font-semibold">
                  {totalPrice.toLocaleString()}₫
                </span>
                <span className="font-['Space_Grotesk',sans-serif] text-[11px] text-[#a0a8b0] ml-2">
                  {totalItems} món
                </span>
              </div>
            </div>
            <button
              type="button"
              className="flex items-center gap-2 px-6 py-3 rounded-xl bg-gradient-to-r from-[#c6c6c7] to-[#a0a0a0] text-[#1a1a2e] text-[12px] font-['Space_Grotesk',sans-serif] font-semibold tracking-wider uppercase hover:opacity-90 active:scale-95 transition-all"
            >
              Đặt món
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}

      {/* Styles */}
      <style>{`
        .glass-panel-mobile {
          background: rgba(22, 42, 68, 0.4);
          backdrop-filter: blur(24px);
          -webkit-backdrop-filter: blur(24px);
          border: 0.5px solid rgba(229, 228, 226, 0.15);
          border-radius: 14px;
          transition: all 0.2s ease;
        }
        .glass-panel-mobile:active {
          transform: scale(0.99);
        }
        .glass-panel-mobile-cart {
          background: rgba(11, 32, 58, 0.9);
          backdrop-filter: blur(24px);
          -webkit-backdrop-filter: blur(24px);
          border: 0.5px solid rgba(229, 228, 226, 0.2);
          box-shadow: 0 -4px 30px rgba(0, 0, 0, 0.3);
        }
      `}</style>
    </div>
  );
}
