import { Heart } from 'lucide-react';
import { cn } from '@/lib/cn';

interface TipInputProps {
  value: number;
  onChange: (value: number) => void;
  disabled?: boolean;
}

const PRESET_TIPS = [5_000, 10_000, 20_000, 50_000];

function formatPrice(price: number): string {
  return new Intl.NumberFormat('vi-VN').format(price) + '₫';
}

export function TipInput({ value, onChange, disabled }: TipInputProps) {
  return (
    <div className="space-y-3">
      <h3 className="font-display text-lg font-semibold text-foreground">
        Tip cho nhân viên <Heart size={14} className="inline fill-accent text-accent" />
      </h3>
      <div className="flex flex-wrap gap-2">
        {PRESET_TIPS.map((amount) => (
          <button
            key={amount}
            type="button"
            disabled={disabled}
            onClick={() => onChange(amount === value ? 0 : amount)}
            className={cn(
              'rounded-full border px-4 py-2 text-sm font-medium transition-all duration-200',
              value === amount
                ? 'border-accent-warm bg-accent-warm/10 text-accent-warm'
                : 'border-border/30 text-muted hover:border-border/60 hover:text-foreground',
              disabled && 'cursor-not-allowed opacity-60',
            )}
          >
            {formatPrice(amount)}
          </button>
        ))}
        <button
          type="button"
          disabled={disabled}
          onClick={() => onChange(0)}
          className={cn(
            'rounded-full border px-4 py-2 text-sm font-medium transition-all duration-200',
            value === 0 || !PRESET_TIPS.includes(value)
              ? 'border-border/30 text-muted'
              : 'border-accent-warm/50 text-muted',
            disabled && 'cursor-not-allowed opacity-60',
          )}
        >
          Không tip
        </button>
      </div>
      {value > 0 && (
        <p className="text-sm text-muted">
          Cảm ơn bạn đã tip {formatPrice(value)} <Heart size={14} className="inline fill-accent text-accent" />
        </p>
      )}
    </div>
  );
}
