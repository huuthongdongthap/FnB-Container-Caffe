import { ShoppingBag } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/cn';
import type { MenuItem } from '@/hooks/use-menu';

interface MenuCardProps {
  item: MenuItem;
  onAddToCart: (item: MenuItem) => void;
  className?: string;
}

const CATEGORY_EMOJI: Record<string, string> = {
  coffee: '☕',
  'traditional-coffee': '☕',
  'hot-coffee': '🔥',
  frappuccino: '🧊',
  tea: '🍵',
  smoothies: '🥤',
  juice: '🍊',
  yogurt: '🥛',
  soda: '🫧',
  signature: '🍹',
  snacks: '🥐',
  food: '🥐',
  combo: '🎯',
  'other-drinks': '🥤',
  bottled: '🧴',
};

function getEmoji(category: string): string {
  return CATEGORY_EMOJI[category.toLowerCase()] ?? '🍽️';
}

function formatPrice(price: number): string {
  return new Intl.NumberFormat('vi-VN').format(price) + '₫';
}

export function MenuCard({ item, onAddToCart, className }: MenuCardProps) {
  return (
    <div
      className={cn(
        'group relative overflow-hidden rounded-xl border border-border/20 bg-card backdrop-blur-sm',
        'transition-all duration-300 hover:-translate-y-1 hover:shadow-lg',
        !item.available && 'opacity-60',
        className,
      )}
      role="article"
      aria-label={`${item.name} — ${formatPrice(item.price)}`}
    >
      {/* Image area */}
      <div className="relative aspect-[4/3] overflow-hidden bg-gradient-to-br from-chrome-dark/20 to-noir-mid">
        {item.image ? (
          <picture>
            <source
              srcSet={item.image.replace(/\.(png|jpg|jpeg)$/i, '.webp')}
              type="image/webp"
            />
            <img
              src={item.image}
              alt={item.name}
              className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105"
              loading="lazy"
            />
          </picture>
        ) : (
          <div className="flex h-full items-center justify-center text-5xl">
            {getEmoji(item.category)}
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
          variant="info"
          className="absolute left-2 top-2 bg-background/80 backdrop-blur-sm"
        >
          {getEmoji(item.category)} {item.category}
        </Badge>
      </div>

      {/* Content */}
      <div className="flex flex-col gap-2 p-4">
        <h3 className="font-display text-lg font-semibold leading-tight text-foreground">
          {item.name}
        </h3>
        {item.description && (
          <p className="line-clamp-2 text-sm text-muted">{item.description}</p>
        )}

        {/* Tags */}
        {item.tags && item.tags.length > 0 && (
          <div className="flex flex-wrap gap-1">
            {item.tags.map((tag) => (
              <span
                key={tag}
                className="rounded-full bg-accent/10 px-2 py-0.5 text-[10px] font-medium text-accent"
              >
                {tag}
              </span>
            ))}
          </div>
        )}

        {/* Price + Add to cart */}
        <div className="mt-auto flex items-center justify-between pt-2">
          <span className="font-display text-xl font-bold text-primary">
            {formatPrice(item.price)}
          </span>
          <Button
            size="sm"
            variant="primary"
            disabled={!item.available}
            onClick={() => onAddToCart(item)}
            aria-label={`Thêm ${item.name} vào giỏ hàng`}
          >
            <ShoppingBag className="h-4 w-4" />
            <span className="hidden sm:inline">Thêm</span>
          </Button>
        </div>
      </div>
    </div>
  );
}
