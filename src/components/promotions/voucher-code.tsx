import { useState, useCallback } from 'react';
import { cn, Card, Badge, Button } from '@/components/ui';

interface VoucherCodeProps {
  code: string;
  discount: string;
  isExpired?: boolean;
  onApplyToCart?: (code: string) => void;
  className?: string;
}

export function VoucherCode({
  code,
  discount,
  isExpired = false,
  onApplyToCart,
  className,
}: VoucherCodeProps) {
  const [copied, setCopied] = useState(false);

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

  return (
    <Card
      className={cn(
        'flex items-center gap-4 p-4',
        isExpired && 'opacity-50 grayscale',
        className,
      )}
    >
      <div className="flex-1">
        <div className="flex items-center gap-2">
          <code className="rounded bg-muted/10 px-2.5 py-1 font-display text-sm font-bold tracking-wider text-accent">
            {code}
          </code>
          {isExpired && (
            <Badge variant="destructive" className="text-[9px]">
              Het han
            </Badge>
          )}
        </div>
        <p className="mt-1 text-xs text-muted/60">{discount}</p>
      </div>

      <div className="flex gap-2">
        <Button variant="secondary" size="sm" onClick={handleCopy}>
          {copied ? 'Da chep' : 'Chep ma'}
        </Button>
        {onApplyToCart && !isExpired && (
          <Button variant="primary" size="sm" onClick={() => onApplyToCart(code)}>
            Dung ngay
          </Button>
        )}
      </div>
    </Card>
  );
}
