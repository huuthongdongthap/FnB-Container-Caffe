import React from 'react';
import { ShoppingBag, Coffee, Flame, Snowflake, CupSoda, Citrus, Milk, Wine, Croissant, Target, FlaskConical, Utensils } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/cn';
import type { MenuItem } from '@/hooks/use-menu';

interface MenuCardProps {
  item: MenuItem;
  onAddToCart: (item: MenuItem) => void;
  className?: string;
}

const CATEGORY_ICON: Record<string, React.ElementType> = {
  coffee: Coffee,
  'traditional-coffee': Coffee,
  'hot-coffee': Flame,
  frappuccino: Snowflake,
  tea: Coffee,
  smoothies: CupSoda,
  juice: Citrus,
  yogurt: Milk,
  soda: CupSoda,
  signature: Wine,
  snacks: Croissant,
  food: Croissant,
  combo: Target,
  'other-drinks': CupSoda,
  bottled: FlaskConical,
};

function getCategoryIcon(category: string): React.ElementType {
  return CATEGORY_ICON[category.toLowerCase()] ?? Utensils;
}

function formatPrice(price: number): string {
  return new Intl.NumberFormat('vi-VN').format(price) + '₫';
}

export function MenuCard({ item, onAddToCart, className }: MenuCardProps) {
  return (
    <div
      className={cn(
        'group relative overflow-hidden',
        'glass-panel',
        'hover:scale-[1.02] hover:shadow-[0_0_30px_rgba(201,214,223,0.15)]',
        !item.available && 'opacity-60',
        className,
      )}
      role="article"
      aria-label={`${item.name} — ${formatPrice(item.price)}`}
    >
      {/* Image area */}
      <div className="relative aspect-[4/3] overflow-hidden bg-gradient-to-br from-[#1A2A4E] to-[#0A1A2E]">
        {item.image ? (
          <picture>
            <source
              srcSet={item.image.replace(/\.(png|jpg|jpeg)$/i, '.webp')}
              type="image/webp"
            />
            <img
              src={item.image}
              alt={item.name}
              className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-110"
              loading="lazy"
            />
          </picture>
        ) : (
          <div className="flex h-full items-center justify-center text-5xl">
            {React.createElement(getCategoryIcon(item.category), { size: 24 })}
          </div>
        )}
        {/* Availability badge */}
        {!item.available && (
          <div className="absolute inset-0 flex items-center justify-center bg-black/50">
            <Badge variant="destructive">Tạm hết</Badge>
          </div>
        )}
        {/* Category badge */}
        <Badge
          variant="default"
          className="absolute left-3 top-3 border border-white/10 bg-black/40 text-white backdrop-blur-sm"
        >
          {React.createElement(getCategoryIcon(item.category), { size: 24 })} {item.category}
        </Badge>
      </div>

      {/* Content */}
      <div className="flex flex-col gap-2 p-4">
        <h3 className="font-display text-lg font-semibold leading-tight text-[#F5F5F5]">
          {item.name}
        </h3>
        {item.description && (
          <p className="line-clamp-2 text-sm text-[#e4e2e4]">{item.description}</p>
        )}

        {/* Tags */}
        {item.tags && item.tags.length > 0 && (
          <div className="flex flex-wrap gap-1.5">
            {item.tags.map((tag) => (
              <span
                key={tag}
                className="rounded-full bg-accent/10 px-2.5 py-0.5 text-[10px] font-medium text-accent"
              >
                {tag}
              </span>
            ))}
          </div>
        )}

        {/* Price + Add to cart */}
        <div className="mt-auto flex items-center justify-between pt-2">
          <span className="font-display text-xl font-semibold text-[#b8c7e2]">
            {formatPrice(item.price)}
          </span>

          {/* Add to cart: always visible on mobile, hover reveal on desktop */}
          <Button
            size="sm"
            variant="ghost"
            disabled={!item.available}
            onClick={() => onAddToCart(item)}
            aria-label={`Thêm ${item.name} vào giỏ hàng`}
            className={cn(
              'border border-white/10 bg-white/5 text-accent backdrop-blur-sm',
              'opacity-100 md:opacity-0 md:group-hover:opacity-100',
              'transition-opacity duration-300',
              'hover:border-accent/30 hover:bg-accent/20',
            )}
          >
            <ShoppingBag className="h-3.5 w-3.5" />
            <span className="hidden text-xs sm:inline">Thêm</span>
          </Button>
        </div>
      </div>
    </div>
  );
}
