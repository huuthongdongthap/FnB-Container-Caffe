import { useState } from 'react';
import { StitchShell } from '../StitchBase';
import { PageHeader } from '@/components/stitch/StitchLayout';

import { REFERRAL_CODE, SHARE_CHANNELS, FRIENDS, REWARDS } from './referral-rewards-1-constants';
import type { InnerProps } from './referral-rewards-1-types';
import { Avatar, StatusBadge } from './referral-rewards-1-sub-components';

// Re-export extracted modules for backward compatibility
export type { InnerProps, ShareChannel, Friend, Reward } from './referral-rewards-1-types';
export { REFERRAL_CODE, SHARE_CHANNELS, FRIENDS, REWARDS } from './referral-rewards-1-constants';
export { Avatar, StatusBadge } from './referral-rewards-1-sub-components';

/* ── Component ────────────────────────────────────────────────────────── */

export default function ReferralRewards1() {
  const [copied, setCopied] = useState(false);

  const handleCopy = () => {
    navigator.clipboard.writeText(REFERRAL_CODE);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <StitchShell>
      <InnerContent copied={copied} onCopy={handleCopy} />
    </StitchShell>
  );
}

function InnerContent({ copied, onCopy }: InnerProps) {
  return (
    <>
      <PageHeader brand="AURA CAFE" scrollEffect />
      <main className="pt-20 px-5 md:px-16 pb-32" style={{ background: 'var(--aura-noir-void)' }}>
        <section className="mt-2 mb-10">
          <div className="relative overflow-hidden rounded-2xl p-6 flex flex-col items-center text-center"
            style={{
              background: 'rgba(18, 28, 42, 0.4)',
              backdropFilter: 'blur(20px)',
              border: '1px solid rgba(255, 255, 255, 0.08)',
            }}
          >
            <div className="absolute -top-24 -right-24 w-48 h-48 rounded-full opacity-10"
              style={{ background: 'var(--aura-tertiary)', filter: 'blur(80px)' }}
            />
            <span className="font-body text-xs font-semibold uppercase tracking-[0.2em] text-[var(--aura-chrome-dark)] mb-1">
              Refer &amp; Earn
            </span>
            <h1 className="font-display text-5xl text-secondary mb-1" style={{ lineHeight: 1.1 }}>
              Receive $15.00
            </h1>
            <p className="font-body text-base text-[var(--aura-chrome-dark)] max-w-[280px]">
              Share the Aura experience with your inner circle and earn rewards for every successful invitation.
            </p>
            <div className="mt-6 w-full h-px bg-gradient-to-r from-transparent via-white/10 to-transparent" />
          </div>
        </section>

        <section className="mb-10">
          <div className="flex flex-col gap-3">
            <div className="flex justify-between items-center rounded-lg p-4"
              style={{
                background: 'var(--aura-noir-deep)',
                border: '1px solid transparent',
                backgroundImage: 'linear-gradient(var(--aura-noir-deep), var(--aura-noir-deep)) padding-box, linear-gradient(135deg, #E5E7EB 0%, rgba(229, 231, 235, 0.2) 100%) border-box',
              }}
            >
              <span className="font-body text-sm tracking-widest text-[var(--aura-chrome-bright)] font-mono">
                {REFERRAL_CODE}
              </span>
              <button type="button" onClick={onCopy} aria-label="Copy code"
                className="flex items-center gap-1 text-secondary active:scale-95 transition-all"
              >
                <span className="text-lg">{copied ? '✅' : '📋'}</span>
              </button>
            </div>
            <button
              type="button" onClick={onCopy}
              className="w-full py-4 rounded-lg uppercase tracking-widest font-body text-xs font-semibold transition-all active:scale-[0.98]"
              style={{
                background: 'linear-gradient(180deg, #efbd8a 0%, #d4a574 100%)',
                color: 'var(--aura-noir-void)',
                boxShadow: '0 0 20px rgba(212, 165, 116, 0.15)',
              }}
            >
              {copied ? 'Copied!' : 'Copy Code'}
            </button>
            <div className="flex justify-between items-center mt-2 overflow-x-auto gap-3 py-2">
              {SHARE_CHANNELS.map((ch) => (
                <button key={ch.label} type="button"
                  className="flex-shrink-0 flex items-center gap-1 px-6 py-2 rounded-full transition-all active:scale-95"
                  style={{
                    background: 'rgba(18, 28, 42, 0.4)',
                    backdropFilter: 'blur(20px)',
                    border: '1px solid rgba(255, 255, 255, 0.05)',
                  }}
                >
                  <span className="text-base">{ch.icon}</span>
                  <span className="font-body text-xs">{ch.label}</span>
                </button>
              ))}
            </div>
          </div>
        </section>

        <section className="mb-10">
          <div className="flex justify-between items-end mb-3">
            <div>
              <h3 className="font-display text-xl text-secondary">Path to Platinum</h3>
              <p className="font-body text-xs text-[var(--aura-chrome-dark)] opacity-60">Unlock $50 exclusive bonus</p>
            </div>
            <div className="text-right">
              <span className="font-display text-xl text-secondary">3/5</span>
              <p className="font-body text-xs text-[var(--aura-chrome-dark)] opacity-60 uppercase">Referrals</p>
            </div>
          </div>
          <div className="w-full h-2 rounded-full overflow-hidden" style={{ background: 'rgba(255,255,255,0.05)' }}>
            <div className="h-full rounded-full" style={{
              width: '60%',
              background: 'linear-gradient(180deg, #efbd8a 0%, #d4a574 100%)',
              boxShadow: '0 0 20px rgba(212, 165, 116, 0.15)',
              transition: 'width 1s ease-out',
            }} />
          </div>
          <div className="flex justify-between mt-1 px-1">
            {Array.from({ length: 5 }).map((_, i) => (
              <span key={i} className="w-1 h-1 rounded-full" style={{
                background: i < 3 ? 'var(--aura-tertiary)' : 'rgba(255, 255, 255, 0.2)',
                boxShadow: i < 3 ? '0 0 8px #d4a574' : 'none',
              }} />
            ))}
          </div>
        </section>

        <section className="mb-10">
          <h3 className="font-body text-xs uppercase tracking-widest text-[var(--aura-chrome-dark)] mb-4 pl-3"
            style={{ borderLeft: '2px solid var(--aura-tertiary)' }}
          >Recent Network</h3>
          <div className="flex flex-col gap-3">
            {FRIENDS.map((f) => (
              <div key={f.name} className="p-3 rounded-xl flex items-center justify-between"
                style={{
                  background: 'rgba(18, 28, 42, 0.4)',
                  backdropFilter: 'blur(20px)',
                  border: '1px solid rgba(255, 255, 255, 0.08)',
                }}
              >
                <div className="flex items-center gap-3">
                  <Avatar name={f.name} />
                  <div>
                    <p className="font-body text-sm font-medium">{f.name}</p>
                    <p className="font-body text-xs text-[var(--aura-chrome-dark)] opacity-50">{f.joined}</p>
                  </div>
                </div>
                <StatusBadge status={f.status} />
              </div>
            ))}
          </div>
        </section>

        <section className="mb-16">
          <h3 className="font-body text-xs uppercase tracking-widest text-[var(--aura-chrome-dark)] mb-4 pl-3"
            style={{ borderLeft: '2px solid var(--aura-tertiary)' }}
          >Reward History</h3>
          <div className="rounded-xl overflow-hidden" style={{
            background: 'linear-gradient(#121c2a, #121c2a) padding-box, linear-gradient(135deg, #E5E7EB 0%, rgba(229, 231, 235, 0.2) 100%) border-box',
            border: '1px solid transparent',
          }}>
            <div className="rounded-xl overflow-hidden" style={{ background: 'rgba(18, 28, 42, 0.5)' }}>
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="border-b border-white/10">
                    {['Date', 'Source', 'Amount'].map((h, i) => (
                      <th key={h} className={`p-4 font-body text-xs uppercase tracking-wider text-[var(--aura-chrome-dark)] opacity-60 ${i === 2 ? 'text-right' : ''}`}>
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="font-body text-sm divide-y divide-white/5">
                  {REWARDS.map((r) => (
                    <tr key={r.date + r.source} className="hover:bg-white/5 transition-colors">
                      <td className="p-4 text-[var(--aura-chrome-dark)]">{r.date}</td>
                      <td className="p-4">{r.source}</td>
                      <td className="p-4 text-right text-secondary font-medium">{r.amount}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </section>
      </main>
    </>
  );
}
