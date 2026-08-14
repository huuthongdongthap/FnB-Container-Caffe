/**
 * Referral code block with copy button and share methods
 * (Zalo, Messenger, SMS).
 */

import { useState, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { BODY_FONT } from './StitchReferralNew2-constants';
import { CheckIcon, ForumIcon, SmsIcon, ShareIcon } from './StitchReferralNew2-icons';

export function ReferralCodeBlock({
  code,
  onCopyCode,
  onShareVia,
}: {
  code: string;
  onCopyCode?: (code: string) => void;
  onShareVia?: (method: string) => void;
}) {
  const { t } = useTranslation();
  const [copied, setCopied] = useState(false);

  const SHARE_METHODS = [
    { key: 'zalo', icon: ShareIcon, label: 'Zalo' },
    { key: 'messenger', icon: ForumIcon, label: 'Messenger' },
    { key: 'sms', icon: SmsIcon, label: 'SMS' },
  ];

  const handleCopy = useCallback(() => {
    navigator.clipboard.writeText(code).catch(() => {});
    setCopied(true);
    onCopyCode?.(code);
    setTimeout(() => setCopied(false), 2000);
  }, [code, onCopyCode]);

  return (
    <section
      className="mb-8"
      aria-label={t('stitch.referral.referralCodeSectionAria')}
    >
      <div className="flex flex-col gap-4">
        {/* Code display with copy button */}
        <div className="relative flex items-center rounded-lg bg-[#1e3550]/40 p-1 backdrop-blur-xl"
          style={{ border: '1px solid rgba(255,255,255,0.12)' }}
        >
          <input
            type="text"
            readOnly
            value={code}
            className={`w-full bg-transparent px-5 py-4 ${BODY_FONT} text-lg tracking-widest text-[#efbd8a] outline-none placeholder:text-[var(--aura-text-secondary, #a0a8b0)]/40`}
            aria-label={t('stitch.referral.referralCodeAria')}
            tabIndex={-1}
          />
          <button
            type="button"
            onClick={handleCopy}
            className={`mr-2 flex shrink-0 items-center gap-2 rounded-md px-5 py-2.5 ${BODY_FONT} text-xs font-semibold uppercase tracking-wider transition-all active:scale-95 ${
              copied
                ? 'bg-[#4CAF50]/20 text-[#4CAF50]'
                : 'bg-[#efbd8a] text-[#0a1628]'
            }`}
            style={copied ? {} : { boxShadow: '0 2px 12px rgba(239, 189, 138, 0.3)' }}
            aria-label={
              copied
                ? t('stitch.referral.copiedAria')
                : t('stitch.referral.copyAria')
            }
          >
            {copied ? (
              <>
                <CheckIcon className="h-4 w-4" />
                <span>{t('stitch.referral.codeCopied')}</span>
              </>
            ) : (
              <span>{t('stitch.referral.copyCode')}</span>
            )}
          </button>
        </div>

        {/* Share buttons */}
        <div className="flex flex-wrap gap-3">
          {SHARE_METHODS.map((method) => {
            const IconComp = method.icon;
            return (
              <button
                key={method.key}
                type="button"
                onClick={() => onShareVia?.(method.key)}
                className="flex flex-1 items-center justify-center gap-2 rounded-lg border border-white/[0.08] bg-[#162a44]/40 px-4 py-3 backdrop-blur-xl transition-all hover:bg-white/[0.05] active:scale-95"
                aria-label={t('stitch.referral.shareViaAria', { method: method.label })}
              >
                <IconComp className="h-4 w-4 text-[var(--aura-text-secondary, #a0a8b0)]" />
                <span className={`${BODY_FONT} text-xs font-semibold uppercase tracking-wider text-[var(--aura-text-primary, #e8e8e8)]`}>
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
