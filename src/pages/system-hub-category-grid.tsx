'use client';

import { Link } from 'react-router-dom';
import { ArrowUpRight, Search } from 'lucide-react';
import type { SectionCategory } from './system-hub-types';

interface SystemHubCategoryGridProps {
  categories: SectionCategory[];
  onResetFilters: () => void;
}

/**
 * The catalogue grid, or the empty state when the filters match nothing.
 * One section block per category; the empty state shares `onResetFilters`
 * with the search controls so "Xem toàn bộ phân hệ" clears both filters.
 */
export function SystemHubCategoryGrid({ categories, onResetFilters }: SystemHubCategoryGridProps) {
  if (categories.length === 0) {
    return (
      <div className="text-center py-16 bg-[#0A1A2E]/40 border border-white/10 rounded-2xl">
        <Search size={40} className="mx-auto text-[var(--aura-text-secondary,#a0a8b0)]/40 mb-3" />
        <p className="text-base font-medium text-white">Không tìm thấy phân hệ nào phù hợp</p>
        <p className="text-xs text-[var(--aura-text-secondary,#a0a8b0)] mt-1">
          Vui lòng thử từ khóa khác hoặc bấm nút "Tất cả".
        </p>
        <button
          type="button"
          onClick={onResetFilters}
          className="mt-4 px-4 py-2 rounded-lg bg-white/10 text-white text-xs hover:bg-white/20 transition-all"
        >
          Xem toàn bộ phân hệ
        </button>
      </div>
    );
  }

  return (
    <>
      {categories.map((cat) => (
        <section key={cat.id} className="space-y-4">
          {/* Section Header */}
          <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-2 pb-2 border-b border-white/10">
            <div>
              <div className="flex items-center gap-2">
                <span className="w-2.5 h-2.5 rounded-full bg-gradient-to-r from-amber-400 to-orange-400" />
                <h2 className="text-lg sm:text-xl font-bold tracking-tight text-white font-display">
                  {cat.name}
                </h2>
                <span className="text-xs uppercase tracking-wider text-[var(--aura-text-secondary,#a0a8b0)]/70 font-medium">
                  / {cat.nameEn}
                </span>
              </div>
              <p className="text-xs text-[var(--aura-text-secondary,#a0a8b0)] mt-1">
                {cat.description}
              </p>
            </div>
            <span className="text-xs text-[var(--aura-text-secondary,#a0a8b0)] font-medium">
              {cat.items.length} đường dẫn
            </span>
          </div>

          {/* Grid of Action Cards */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
            {cat.items.map((item) => {
              const Icon = item.icon;
              return (
                <div
                  key={item.id}
                  className="group relative rounded-xl border border-white/10 bg-[#0A1A2E]/70 p-5 backdrop-blur-md transition-all duration-300 hover:border-[#6B9FB8]/50 hover:bg-[#0E233C]/90 hover:shadow-[0_8px_30px_rgba(0,0,0,0.5)] flex flex-col justify-between"
                >
                  {/* Top card info */}
                  <div>
                    <div className="flex items-start justify-between gap-3 mb-3">
                      <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-white/10 to-white/5 border border-white/10 flex items-center justify-center text-[var(--aura-chrome-bright,#E8EEF3)] group-hover:scale-105 group-hover:border-[#6B9FB8]/40 transition-transform">
                        <Icon size={20} />
                      </div>
                      <span
                        className={`text-[10px] font-semibold tracking-wider uppercase px-2 py-0.5 rounded-md border ${item.badgeColor}`}
                      >
                        {item.badge}
                      </span>
                    </div>

                    <h3 className="font-display text-base font-bold text-white group-hover:text-[var(--aura-chrome-bright,#E8EEF3)] transition-colors flex items-center gap-1.5">
                      {item.title}
                    </h3>
                    <p className="text-xs text-[var(--aura-text-secondary,#a0a8b0)] font-medium mb-2">
                      {item.subtitle}
                    </p>
                    <p className="text-xs text-[var(--aura-text-secondary,#a0a8b0)]/90 leading-relaxed mb-4 line-clamp-3">
                      {item.description}
                    </p>
                  </div>

                  {/* Bottom path + launch button */}
                  <div className="pt-3 border-t border-white/5 flex items-center justify-between gap-3">
                    <code className="text-[11px] font-mono text-[var(--aura-text-secondary,#a0a8b0)] bg-black/40 px-2 py-1 rounded">
                      {item.path}
                    </code>
                    <Link
                      to={item.path}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[var(--aura-chrome-bright,#E8EEF3)] text-[#0A1A2E] text-xs font-semibold hover:bg-white hover:shadow-[0_0_15px_rgba(201,214,223,0.3)] transition-all active:scale-95"
                    >
                      <span>{item.primaryAction}</span>
                      <ArrowUpRight size={14} />
                    </Link>
                  </div>
                </div>
              );
            })}
          </div>
        </section>
      ))}
    </>
  );
}
