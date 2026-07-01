import { useState } from 'react';
import { cn, Card, Badge, Button, Input } from '@/components/ui';

interface TicketTier {
  id: string;
  name: string;
  price: number;
  description: string;
  available: number;
}

interface TicketPurchaseProps {
  eventTitle: string;
  tiers: TicketTier[];
  onPurchase: (tierId: string, quantity: number) => void;
  className?: string;
}

function formatVnd(amount: number): string {
  return amount.toLocaleString('vi-VN') + ' đ';
}

export function TicketPurchase({
  eventTitle,
  tiers,
  onPurchase,
  className,
}: TicketPurchaseProps) {
  const [quantities, setQuantities] = useState<Record<string, number>>({});

  const updateQuantity = (tierId: string, value: number) => {
    setQuantities((prev) => ({
      ...prev,
      [tierId]: Math.max(0, Math.min(value, tiers.find((t) => t.id === tierId)?.available ?? 99)),
    }));
  };

  const total = tiers.reduce((sum, tier) => {
    return sum + (quantities[tier.id] ?? 0) * tier.price;
  }, 0);

  const hasSelection = Object.values(quantities).some((q) => q > 0);

  return (
    <Card className={cn('p-6', className)}>
      <h3 className="mb-1 font-display text-lg font-bold">Mua ve</h3>
      <p className="mb-6 text-xs text-muted/60">{eventTitle}</p>

      {/* Tier Selection */}
      <div className="space-y-4">
        {tiers.map((tier) => {
          const qty = quantities[tier.id] ?? 0;

          return (
            <div
              key={tier.id}
              className="flex items-center justify-between rounded-lg border border-border/30 p-4"
            >
              <div className="min-w-0 flex-1">
                <p className="text-sm font-semibold">{tier.name}</p>
                <p className="text-xs text-muted/60">{tier.description}</p>
                <p className="mt-1 font-display text-base font-bold text-accent">
                  {formatVnd(tier.price)}
                </p>
              </div>

              <div className="flex items-center gap-3">
                {tier.available > 0 ? (
                  <>
                    <button
                      type="button"
                      onClick={() => updateQuantity(tier.id, qty - 1)}
                      className="flex h-8 w-8 items-center justify-center rounded-full border border-border/40 text-sm transition-colors hover:bg-muted/10 disabled:opacity-30"
                      disabled={qty <= 0}
                      aria-label="Giam so luong"
                    >
                      -
                    </button>
                    <span className="w-6 text-center text-sm font-semibold tabular-nums">
                      {qty}
                    </span>
                    <button
                      type="button"
                      onClick={() => updateQuantity(tier.id, qty + 1)}
                      className="flex h-8 w-8 items-center justify-center rounded-full border border-border/40 text-sm transition-colors hover:bg-muted/10 disabled:opacity-30"
                      disabled={qty >= tier.available}
                      aria-label="Tang so luong"
                    >
                      +
                    </button>
                  </>
                ) : (
                  <Badge variant="destructive" className="text-[10px]">
                    Het ve
                  </Badge>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* Total */}
      {hasSelection && (
        <div className="mt-6 rounded-lg bg-muted/10 p-4">
          <div className="flex items-center justify-between">
            <span className="text-sm font-semibold">Tong cong</span>
            <span className="font-display text-xl font-bold text-accent-warm">
              {formatVnd(total)}
            </span>
          </div>
        </div>
      )}

      {/* Purchase Button */}
      <Button
        variant="primary"
        size="lg"
        className="mt-4 w-full"
        disabled={!hasSelection}
        onClick={() => {
          for (const [tierId, qty] of Object.entries(quantities)) {
            if (qty > 0) onPurchase(tierId, qty);
          }
        }}
      >
        {hasSelection ? 'Tien hanh dat ve' : 'Chon ve de dat'}
      </Button>
    </Card>
  );
}
