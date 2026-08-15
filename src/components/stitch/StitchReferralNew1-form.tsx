'use client';

import { useState, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { Copy, Check, MessageCircle, MessageSquare, MessagesSquare } from 'lucide-react';

const SHARE_METHODS = [
  { key: 'zalo', icon: MessageCircle, label: 'Zalo' },
  { key: 'messenger', icon: MessageSquare, label: 'Messenger' },
  { key: 'sms', icon: MessagesSquare, label: 'SMS' },
];

export function ReferralCodeBlock({
  code,
  onCopyCode,
}: {
  code: string;
  onCopyCode?: (code: string) => void;
}) {
  const { t } = useTranslation();
  const [copied, setCopied] = useState(false);

  const handleCopy = useCallback(() => {
    navigator.clipboard.writeText(code).catch(() => {});
    setCopied(true);
    onCopyCode?.(code);
    setTimeout(() => setCopied(false), 2000);
  }, [code, onCopyCode]);

  return (
    <section className="mb-10" aria-label={t('stitch.referral.referralCodeSectionAria')}>
      <div className="flex flex-col gap-3">
        <div
          className="rounded-lg p-6 flex justify-between items-center bg-[var(--aura-surface-container)]"
          style={{
            border: '1px solid transparent',
            background: 'linear-gradient(var(--aura-surface-container), var(--aura-surface-container)) padding-box, linear-gradient(135deg, #E5E7EB 0%, rgba(229, 231, 235, 0.2) 100%) border-box',
          }}
        >
          <span className="font-body text-[24px] leading-[1.2] font-medium font-mono tracking-widest text-[#d9e3f6]">
            {code}
          </span>
          <button
            type="button"
            onClick={handleCopy}
            className="flex items-center gap-1 text-[var(--aura-chrome-bright)] active:scale-95 transition-transform"
            aria-label={copied ? t('stitch.referral.copiedAria') : t('stitch.referral.copyAria')}
          >
            {copied ? <Check className="h-5 w-5 text-green-400" /> : <Copy className="h-5 w-5" />}
          </button>
        </div>

        <button
          type="button"
          onClick={handleCopy}
          className="w-full py-4 rounded-lg font-body text-[14px] leading-[1.2] font-semibold uppercase tracking-widest text-[#050f1c] transition-all active:scale-[0.98]"
          style={{
            background: 'linear-gradient(180deg, var(--aura-chrome-bright) 0%, var(--aura-chrome-bright) 100%)',
            boxShadow: '0 0 20px color-mix(in srgb, var(--aura-chrome-bright) 15%, transparent)',
          }}
        >
          {copied
            ? t('stitch.referral.codeCopied', { defaultValue: 'Copied!' })
            : t('stitch.referral.copyCode', { defaultValue: 'Copy Code' })
          }
        </button>

        <div
          className="mt-3 flex justify-between items-center overflow-x-auto gap-3 py-2"
          style={{ msOverflowStyle: 'none', scrollbarWidth: 'none' }}
        >
          <style>{`.stitch-scroll-hide::-webkit-scrollbar { display: none; }`}</style>
          {SHARE_METHODS.map((method) => {
            const IconComp = method.icon;
            return (
              <button
                key={method.key}
                type="button"
                className="flex-shrink-0 flex items-center gap-1 px-6 py-2 rounded-full border border-white/[0.05] active:scale-95 transition-transform"
                style={{
                  background: 'color-mix(in srgb, var(--aura-surface-container) 40%, transparent)',
                  backdropFilter: 'blur(20px)',
                  WebkitBackdropFilter: 'blur(20px)',
                }}
                aria-label={t('stitch.referral.shareViaAria', { method: method.label })}
              >
                <IconComp className="h-[18px] w-[18px] text-[var(--aura-chrome-bright)]" />
                <span className="font-body text-[12px] leading-[1.2] font-medium text-[var(--aura-chrome-soft)]">
                  {method.label}
                </span>
              </button>
            );
          })}
        </div>
      </div>
    </section>
  );
}
