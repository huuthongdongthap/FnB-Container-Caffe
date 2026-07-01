import { useState, useCallback } from 'react';
import { cn, Card, Badge, Button } from '@/components/ui';

interface ReferralLinkProps {
  code: string;
  referralCount: number;
  onApplyCode?: (code: string) => void;
  className?: string;
}

export function ReferralLink({
  code,
  referralCount,
  onApplyCode,
  className,
}: ReferralLinkProps) {
  const [copied, setCopied] = useState(false);
  const [inputCode, setInputCode] = useState('');

  const handleCopy = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(code);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Fallback for non-HTTPS
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

  const handleShare = useCallback(
    (platform: 'zalo' | 'facebook') => {
      const url = `${window.location.origin}/referral?ref=${code}`;
      const encoded = encodeURIComponent(url);
      if (platform === 'zalo') {
        window.open(
          `https://zalo.me/share?url=${encoded}`,
          '_blank',
          'noopener,noreferrer',
        );
      } else {
        window.open(
          `https://www.facebook.com/sharer/sharer.php?u=${encoded}`,
          '_blank',
          'noopener,noreferrer',
        );
      }
    },
    [code],
  );

  const handleApply = useCallback(() => {
    const trimmed = inputCode.trim().toUpperCase();
    if (trimmed && onApplyCode) {
      onApplyCode(trimmed);
      setInputCode('');
    }
  }, [inputCode, onApplyCode]);

  return (
    <div className={cn('space-y-6', className)}>
      {/* Referral Code Display */}
      <Card className="p-6 text-center">
        <p className="mb-4 text-xs font-semibold uppercase tracking-widest text-muted/60">
          Ma gioi thieu cua ban
        </p>
        <p className="mb-1 font-display text-4xl font-bold tracking-[0.15em] text-accent">
          {code}
        </p>
        <p className="mb-6 text-xs text-muted/40">
          Sao chep ma nay va chia se voi ban be
        </p>

        <div className="flex flex-wrap justify-center gap-3">
          <Button variant="primary" size="sm" onClick={handleCopy}>
            {copied ? 'Da sao chep!' : 'Sao chep ma'}
          </Button>
          <Button variant="secondary" size="sm" onClick={() => handleShare('zalo')}>
            Chia se Zalo
          </Button>
          <Button variant="secondary" size="sm" onClick={() => handleShare('facebook')}>
            Chia se Facebook
          </Button>
        </div>

        <div className="mt-6">
          <Badge variant="info">
            Da gioi thieu: {referralCount} nguoi
          </Badge>
        </div>
      </Card>

      {/* Apply Referral Code */}
      <Card className="p-6">
        <p className="mb-3 text-xs font-semibold uppercase tracking-widest text-muted/60">
          Nhap ma gioi thieu
        </p>
        <div className="flex gap-3">
          <input
            type="text"
            placeholder="Nhap ma gioi thieu..."
            value={inputCode}
            onChange={(e) => setInputCode(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleApply()}
            maxLength={20}
            className="flex-1 rounded-lg border border-border/40 bg-background px-4 py-2.5 font-display text-base font-semibold uppercase tracking-widest text-accent outline-none transition-colors placeholder:normal-case placeholder:text-muted/40 focus:border-accent"
            aria-label="Nhap ma gioi thieu"
          />
          <Button variant="primary" size="sm" onClick={handleApply}>
            Ap dung
          </Button>
        </div>
      </Card>
    </div>
  );
}
