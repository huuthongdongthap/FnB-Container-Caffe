import { useState } from 'react';
import { cn } from '@/lib/cn';
import type { MenuGroup } from '@/hooks/use-tv-menu';

interface CategoryCarouselProps {
  menuGroups: MenuGroup[];
  onCategorySelect?: (category: string) => void;
}

export function CategoryCarousel({ menuGroups, onCategorySelect }: CategoryCarouselProps) {
  const [activeCategory, setActiveCategory] = useState<string | null>(null);

  if (menuGroups.length === 0) {
    return (
      <div className="flex items-center justify-center py-8 text-gray-400">
        <p>Không có danh mục</p>
      </div>
    );
  }

  const handleCategoryClick = (category: string) => {
    const newCategory = activeCategory === category ? null : category;
    setActiveCategory(newCategory);
    onCategorySelect?.(newCategory ?? '');
  };

  return (
    <div className="category-carousel">
      <div className="flex gap-2 overflow-x-auto pb-2 scrollbar-hide">
        <button
          onClick={() => {
            setActiveCategory(null);
            onCategorySelect?.('');
          }}
          className={cn(
            'px-4 py-2 rounded-full text-sm font-medium whitespace-nowrap transition-colors',
            activeCategory === null
              ? 'bg-blue-600 text-white'
              : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
          )}
        >
          Tất cả
        </button>
        {menuGroups.map((group) => (
          <button
            key={group.category}
            onClick={() => handleCategoryClick(group.category)}
            className={cn(
              'px-4 py-2 rounded-full text-sm font-medium whitespace-nowrap transition-colors',
              activeCategory === group.category
                ? 'bg-blue-600 text-white'
                : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
            )}
          >
            {group.category}
            <span className="ml-1.5 text-xs opacity-70">({group.items.length})</span>
          </button>
        ))}
      </div>
    </div>
  );
}
