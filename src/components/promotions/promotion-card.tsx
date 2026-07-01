import { useState, useCallback, useMemo } from 'react';
import { cn, Card, Badge, Button } from '@/components/ui';

interface PromotionCardProps {
  id: string;
  code: string;
  percent: number;
  maxDiscount: number;
  minOrder: number;
  expiresAt: string;
  usageCount: number;
  usageLimit: number;
  icon: string;
  isFeatured: boolean;
  onApplyToCart?: (code: string) => void;
}

function formatVnd(amount: number): string {
  return amount.toLocaleString('vi-VN') + '₫';
}

function formatDate(iso: string): string {
  if (!iso) return '';
  const d = new Date(iso);
  return d.toLocaleDateString('vi-VN', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });
}

function daysLeft(iso: string): number | null {
  if (!iso) return null;
  const diff = new Date(iso).getTime() - Date.now();
  return Math.ceil(diff / (1000 * 60 * 60 * 24));
}

export function PromotionCard({
  code,
  percent,
  maxDiscount,
  minOrder,
  expiresAt,
  usageCount,
  usageLimit,
  icon,
  isFeatured,
  onApplyToCart,
}: PromotionCardProps) {
  const [copied, setCopied] = useState(false);
  const remaining = daysLeft(expiresAt);
  const isExpired = remaining !== null && remaining <= 0;
  const pctLabel = code === 'MONDAYBOOST' ? 'x2 Diem' : `${percent}%`;

  const handleCopy = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(code);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      const ta = document.createElement('textarea');
      ta.value = code;
      ta.style.position = 'fixed';
      ta.style.opacity = '0';
      document.body.appendChild(ta);
      ta.select();
      document.execCommand('copy');
      document.body.removeChild(ta);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  }, [code]);

  const expiryLabel = useMemo(() => {
    if (remaining === null) return '';
    if (remaining <= 0) return 'Het han';
    return `Con ${remaining} ngay`;
  }, [remaining]);

  return (
    <Card
      className={cn(
        'relative flex flex-col transition-all duration-200',
        isFeatured && 'promo-card--featured border-2 border-accent/30 shadow-lg',
        isExpired && 'promo-card--expired opacity-60 grayscale',
      )}
    >
      {/* Header */}
      <div className="flex items-start gap-4 border-b border-border/30 px-5 py-4">
        <span className="text-3xl" aria-hidden="true">
          {icon}
        </span>
        <div>
          <p className="font-display text-2xl font-bold">{pctLabel}</p>
          <p className="text-[11px] uppercase tracking-wider text-muted/60">Giam gia</p>
        </div>
      </div>

      {/* Code */}
      <div className="flex items-center gap-3 border-b border-border/30 px-5 py-3">
        <code className="flex-1 rounded bg-muted/10 px-3 py-1.5 font-display text-sm font-bold tracking-wider text-accent">
          {code}
        </code>
        <Button
          variant="secondary"
          size="sm"
          onClick={handleCopy}
          aria-label={`Sao chep ma ${code}`}
        >
          {copied ? 'Da sao chep!' : 'Sao chep'}
        </Button>
      </div>

      {/* Meta Info */}
      <div className="flex-1 space-y-1.5 px-5 py-4">
        {maxDiscount > 0 && (
          <div className="flex items-center gap-2 text-xs text-muted/60">
            <span className="h-1.5 w-1.5 rounded-full bg-accent" />
            Giam toi da {formatVnd(maxDiscount)}
          </div>
        )}
        {minOrder > 0 && (
          <div className="flex items-center gap-2 text-xs text-muted/60">
            <span className="h-1.5 w-1.5 rounded-full bg-accent" />
            Don toi thieu {formatVnd(minOrder)}
          </div>
        )}
        {usageLimit > 0 && (
          <div className="flex items-center gap-2 text-xs text-muted/60">
            <span className="h-1.5 w-1.5 rounded-full bg-accent" />
            {usageCount}/{usageLimit} luot dung
          </div>
        )}
      </div>

      {/* Expiry */}
      <div className="flex items-center justify-between border-t border-border/30 px-5 py-3">
        {expiryLabel && (
          <span className="text-xs text-muted/40">
            {isExpired ? expiryLabel : `⏳ ${expiryLabel}`}
            {expiresAt && !isExpired ? ` · ${formatDate(expiresAt)}` : ''}
          </span>
        )}
        {isExpired && (
          <Badge variant="destructive" className="text-[10px]">
            Het han
          </Badge>
        )}
      </div>

      {/* CTA */}
      {onApplyToCart && !isExpired && (
        <div className="px-5 pb-4">
          <Button
            variant="primary"
            size="sm"
            className="w-full"
            onClick={() => onApplyToCart(code)}
          >
            Ap dung vao don
          </Button>
        </div>
      )}
    </Card>
  );
}
