import { useState, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { Copy, Check, Share2 } from 'lucide-react';

export function ReferralBlock({
  code,
  onShare,
}: {
  code: string;
  onShare?: () => void;
}) {
  const { t } = useTranslation();
  const [copied, setCopied] = useState(false);

  const handleCopy = useCallback(() => {
    navigator.clipboard.writeText(code).catch(() => {});
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }, [code]);

  return (
    <section
      className="relative overflow-hidden rounded-xl p-[24px]"
      aria-label={t('loyalty.referralSectionAria')}
      data-glass="card"
      style={{
        backgroundColor: 'color-mix(in srgb, var(--aura-bg-high) 40%, transparent)',
        backdropFilter: 'blur(24px)',
        WebkitBackdropFilter: 'blur(24px)',
        border: '1px solid rgba(255,255,255,0.05)',
      }}
    >
      {/* Glow orb */}
      <div
        className="pointer-events-none absolute -right-10 -top-10 w-32 h-32 blur-[64px]"
        style={{ backgroundColor: 'color-mix(in srgb, var(--aura-chrome-bright) 10%, transparent)' }}
      />

      <h3
        className="mb-2 text-[24px] leading-[1.4] font-normal"
        style={{ fontFamily: "'Libre Caslon Text', serif", color: 'var(--aura-chrome-bright)' }}
      >
        {t('loyalty.referEarn')}
      </h3>
      <p
        className="mb-[24px] text-[16px] leading-[1.5] font-normal"
        style={{ fontFamily: "'Space Grotesk', sans-serif", color: 'var(--aura-chrome-soft)' }}
      >
        {t('loyalty.referDescription')}
      </p>

      {/* Code display */}
      <div className="p-[12px] bg-[var(--aura-bg-page)] rounded border border-[rgba(255,255,255,0.05)] flex items-center justify-between mb-4">
        <span
          className="text-[24px] leading-none tracking-widest"
          style={{ fontFamily: "'Libre Caslon Text', serif", color: 'var(--aura-chrome-bright)', fontWeight: '400' }}
        >
          {code}
        </span>
        <button
          type="button"
          onClick={handleCopy}
          className="flex items-center gap-1 text-[12px] leading-none font-bold active:scale-90 transition-all"
          style={{
            fontFamily: "'Space Grotesk', sans-serif",
            color: copied ? '#4CAF50' : 'var(--aura-chrome-bright)',
          }}
          onMouseEnter={(e) => {
            if (!copied) (e.currentTarget as HTMLElement).style.color = '#ffffff';
          }}
          onMouseLeave={(e) => {
            if (!copied) (e.currentTarget as HTMLElement).style.color = 'var(--aura-chrome-bright)';
          }}
          aria-label={copied ? t('loyalty.codeCopiedAria') : t('loyalty.copyCodeAria')}
        >
          {copied ? (
            <Check className="h-[18px] w-[18px]" />
          ) : (
            <Copy className="h-[18px] w-[18px]" />
          )}
          {copied ? t('loyalty.copied') : t('loyalty.copy')}
        </button>
      </div>

      {/* Share buttons */}
      <div className="flex gap-2">
        <button
          type="button"
          className="flex-1 py-2 bg-white/5 border border-[var(--aura-chrome-soft)]/20 rounded flex items-center justify-center hover:bg-white/10 transition-all"
          aria-label={t('loyalty.shareCodeAria')}
        >
          <Share2 className="h-4 w-4" style={{ color: 'var(--aura-chrome-soft)' }} />
        </button>
        <button
          type="button"
          onClick={onShare}
          className="flex-[3] py-2 rounded font-bold active:scale-95 transition-transform"
          style={{
            backgroundColor: 'var(--aura-chrome-bright)',
            color: 'var(--aura-noir-deep)',
            fontFamily: "'Space Grotesk', sans-serif",
            fontSize: '12px',
            lineHeight: '1',
          }}
        >
          {t('loyalty.shareInviteLink')}
        </button>
      </div>
    </section>
  );
}
