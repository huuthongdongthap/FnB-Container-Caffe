import { useTranslation } from 'react-i18next';
import { Minus, Plus, Trash2 } from 'lucide-react';
import { cn } from '@/lib/cn';
import type { CartItem as CartItemType } from '@/hooks/stores/use-cart-store';

interface CartItemProps {
  item: CartItemType;
  onUpdateQuantity: (id: string, quantity: number) => void;
  onRemove: (id: string) => void;
}

function formatPrice(price: number): string {
  return new Intl.NumberFormat('vi-VN').format(price) + '₫';
}

export function CartItemRow({ item, onUpdateQuantity, onRemove }: CartItemProps) {
  const { t } = useTranslation();
  const lineTotal = item.price * item.quantity;

  return (
    <div
      className="flex items-center gap-3 rounded-lg border border-border/10 bg-background/50 p-3 transition-colors hover:bg-background/80"
      role="group"
      aria-label={`${item.name} x${item.quantity}`}
    >
      {/* Item info */}
      <div className="flex-1 min-w-0">
        <p className="truncate text-sm font-medium text-foreground">{item.name}</p>
        <p className="text-xs text-muted">{formatPrice(item.price)} {t('order.perItem')}</p>
      </div>

      {/* Quantity controls */}
      <div className="flex items-center gap-1">
        <button
          onClick={() => onUpdateQuantity(item.id, item.quantity - 1)}
          className={cn(
            'flex h-7 w-7 items-center justify-center rounded-md border border-border/20',
            'text-muted transition-colors hover:bg-accent/20 hover:text-foreground',
          )}
          aria-label={t('order.decreaseQuantity', { name: item.name })}
        >
          <Minus className="h-3 w-3" />
        </button>
        <span
          className="flex h-7 min-w-[2rem] items-center justify-center text-sm font-medium text-foreground"
          aria-live="polite"
        >
          {item.quantity}
        </span>
        <button
          onClick={() => onUpdateQuantity(item.id, item.quantity + 1)}
          className={cn(
            'flex h-7 w-7 items-center justify-center rounded-md border border-border/20',
            'text-muted transition-colors hover:bg-accent/20 hover:text-foreground',
          )}
          aria-label={t('order.increaseQuantity', { name: item.name })}
        >
          <Plus className="h-3 w-3" />
        </button>
      </div>

      {/* Line total */}
      <span className="min-w-[4rem] text-right text-sm font-semibold text-foreground tabular-nums">
        {formatPrice(lineTotal)}
      </span>

      {/* Remove */}
      <button
        onClick={() => onRemove(item.id)}
        className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md text-muted transition-colors hover:bg-destructive/10 hover:text-destructive"
        aria-label={t('order.removeItem', { name: item.name })}
      >
        <Trash2 className="h-4 w-4" />
      </button>
    </div>
  );
}
