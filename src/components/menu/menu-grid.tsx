import { Search } from 'lucide-react';
import { MenuCard } from './menu-card';
import type { MenuItem } from '@/hooks/use-menu';

interface MenuGridProps {
  items: MenuItem[];
  isLoading: boolean;
  onAddToCart: (item: MenuItem) => void;
}

function MenuSkeleton() {
  return (
    <div
      className="glass-panel overflow-hidden"
      aria-hidden="true"
    >
      <div className="aspect-[4/3] animate-shimmer" />
      <div className="space-y-3 p-4">
        <div className="h-5 w-3/4 rounded bg-white/10" />
        <div className="h-4 w-full rounded bg-white/5" />
        <div className="h-4 w-1/2 rounded bg-white/5" />
        <div className="flex items-center justify-between pt-2">
          <div className="h-6 w-20 rounded bg-white/10" />
          <div className="h-8 w-16 rounded-lg bg-white/10" />
        </div>
      </div>
    </div>
  );
}

export function MenuGrid({ items, isLoading, onAddToCart }: MenuGridProps) {
  if (isLoading) {
    return (
      <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
        {Array.from({ length: 8 }).map((_, i) => (
          <MenuSkeleton key={i} />
        ))}
      </div>
    );
  }

  if (!items || items.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-16 text-center">
        <span className="mb-4 text-4xl"><Search size={40} /></span>
        <h3 className="font-display text-xl font-semibold text-[#F5F5F5]">
          Không tìm thấy món
        </h3>
        <p className="mt-2 text-sm text-[#8A8E96]">
          Thử thay đổi bộ lọc hoặc tìm kiếm với từ khóa khác.
        </p>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
      {items.map((item) => (
        <MenuCard key={item.id} item={item} onAddToCart={onAddToCart} />
      ))}
    </div>
  );
}
