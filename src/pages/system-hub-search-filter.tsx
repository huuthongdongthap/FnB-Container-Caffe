'use client';

import { Search } from 'lucide-react';
import type { SectionCategory } from './system-hub-types';

interface SystemHubSearchFilterProps {
  categories: SectionCategory[];
  searchTerm: string;
  selectedCategory: string;
  totalSections: number;
  onSearchTermChange: (value: string) => void;
  onSelectedCategoryChange: (value: string) => void;
}

/** Search box + category chips. Pure controlled inputs — the page owns the state. */
export function SystemHubSearchFilter({
  categories,
  searchTerm,
  selectedCategory,
  totalSections,
  onSearchTermChange,
  onSelectedCategoryChange,
}: SystemHubSearchFilterProps) {
  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-8 mb-8">
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-4 bg-[#0A1A2E]/60 border border-white/10 rounded-xl p-3 backdrop-blur-md">
        {/* Search Input */}
        <div className="relative flex-1">
          <Search
            size={18}
            className="absolute left-3.5 top-1/2 -translate-y-1/2 text-[var(--aura-text-secondary,#a0a8b0)]"
          />
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => onSearchTermChange(e.target.value)}
            placeholder="Tìm nhanh phân hệ (ví dụ: bếp, kds, thu ngân, bàn, crm, voucher, pos...)"
            aria-label="Tìm nhanh phân hệ"
            className="w-full pl-10 pr-4 py-2.5 bg-black/30 border border-white/10 rounded-lg text-sm text-white placeholder-[var(--aura-text-secondary,#a0a8b0)]/60 focus:outline-none focus:border-[#6B9FB8] transition-colors"
          />
          {searchTerm && (
            <button
              type="button"
              onClick={() => onSearchTermChange('')}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-[var(--aura-text-secondary,#a0a8b0)] hover:text-white"
            >
              Xóa
            </button>
          )}
        </div>

        {/* Category tabs */}
        <div className="flex items-center gap-1.5 overflow-x-auto pb-1 sm:pb-0 scrollbar-none">
          <button
            type="button"
            onClick={() => onSelectedCategoryChange('all')}
            className={`px-3 py-1.5 rounded-lg text-xs font-medium whitespace-nowrap transition-all ${
              selectedCategory === 'all'
                ? 'bg-[var(--aura-chrome-bright,#E8EEF3)] text-[#0A1A2E] font-semibold shadow-sm'
                : 'bg-white/5 text-[var(--aura-text-secondary,#a0a8b0)] hover:bg-white/10 hover:text-white'
            }`}
          >
            Tất cả ({totalSections})
          </button>
          {categories.map((c) => (
            <button
              key={c.id}
              type="button"
              onClick={() => onSelectedCategoryChange(c.id)}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium whitespace-nowrap transition-all ${
                selectedCategory === c.id
                  ? 'bg-[var(--aura-chrome-bright,#E8EEF3)] text-[#0A1A2E] font-semibold shadow-sm'
                  : 'bg-white/5 text-[var(--aura-text-secondary,#a0a8b0)] hover:bg-white/10 hover:text-white'
              }`}
            >
              {c.name} ({c.items.length})
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
