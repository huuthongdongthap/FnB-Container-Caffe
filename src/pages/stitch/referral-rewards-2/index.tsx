import { useState } from 'react';
import { StitchShell } from '../StitchBase';
import { PageHeader, PageFooter } from '@/components/stitch/StitchLayout'

/* ── Data ─────────────────────────────────────────────────────────────── */

const FRIENDS = [
  {
    name: 'Alex Nguyen',
    joined: 'Oct 12, 2023',
    status: 'ACTIVE',
    avatar: 'AN',
  },
  {
    name: 'Elena Sofia',
    joined: 'Oct 08, 2023',
    status: 'JOINED',
    avatar: 'ES',
  },
  {
    name: 'Marcus Chen',
    joined: 'Sept 24, 2023',
    status: 'ACTIVE',
    avatar: 'MC',
  },
] as const;

const REWARD_HISTORY = [
  { date: 'Oct 12, 2023', source: 'Referral Reward (Alex N.)', credit: 15.0 },
  { date: 'Oct 01, 2023', source: 'Monthly Bonus Reward', credit: 10.0 },
  { date: 'Sept 24, 2023', source: 'Referral Reward (Marcus C.)', credit: 15.0 },
  { date: 'Aug 15, 2023', source: 'Account Verified', credit: 5.0 },
] as const;

const SHARE_CHANNELS = [
  { label: 'Zalo', icon: '💬' },
  { label: 'Messenger', icon: '📨' },
  { label: 'SMS', icon: '📱' },
] as const;

const MOBILE_NAV_ITEMS = [
  { label: 'Menu', icon: '🍽️', active: false },
  { label: 'Referrals', icon: '👥', active: true },
  { label: 'Rewards', icon: '🏆', active: false },
  { label: 'Profile', icon: '👤', active: false },
] as const;

/* ── Component ────────────────────────────────────────────────────────── */

export default function ReferralRewards2() {
  const [copied, setCopied] = useState(false);
  const referralCode = 'AURA-VIP-2024-X';

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(referralCode);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // clipboard unavailable — no-op
    }
  };

  return (
    <StitchShell>
      {/* ── Top Navigation ─────────────────────────────────────────── */}
      <nav className="fixed top-0 w-full z-50 flex justify-between items-center px-5 md:px-6 py-4"
           style={{
             background: 'rgba(255,255,255,0.05)',
             backdropFilter: 'blur(24px)',
             borderBottom: '1px solid rgba(255,255,255,0.15)',
           }}>
        <div className="flex items-center gap-4">
          <button className="text-[var(--aura-tertiary)] cursor-pointer active:scale-95 transition-transform text-xl"
                  aria-label="Go back">
            ←
          </button>
          <h1 className="font-display text-xl md:text-2xl text-[var(--aura-tertiary)] tracking-tight uppercase">
            AURA CAFE
          </h1>
        </div>

        <div className="hidden md:flex items-center gap-8">
          {['MENU', 'REFERRALS', 'REWARDS', 'PROFILE'].map((item) => (
            <a
              key={item}
              href="#"
              className={`font-body text-xs font-semibold tracking-widest uppercase transition-colors ${
                item === 'REFERRALS'
                  ? 'text-[var(--aura-tertiary)]'
                  : 'text-[var(--aura-chrome-mid)] hover:text-[var(--aura-chrome-bright)]'
              }`}
            >
              {item}
            </a>
          ))}
        </div>

        <button className="text-[var(--aura-chrome-mid)] text-2xl" aria-label="Account">
          👤
        </button>
      </nav>

      <main className="pt-24 pb-32 px-5 max-w-6xl mx-auto">
        {/* ── Hero: Referral Reward ─────────────────────────────────── */}
        <section className="mb-12 animate-[fadeIn_1s_ease-out]">
          <div
            className="p-8 md:p-16 relative overflow-hidden flex flex-col items-center text-center"
            style={{
              background: 'var(--aura-noir-deep)',
              backdropFilter: 'blur(20px)',
              border: '1px solid rgba(255,255,255,0.1)',
              borderRadius: '40px',
              boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.1)',
            }}
          >
            {/* Atmospheric glows */}
            <div className="absolute -top-24 -right-24 w-64 h-64 rounded-full blur-[100px]"
                 style={{ background: 'rgba(212,165,116,0.1)' }} />
            <div className="absolute -bottom-24 -left-24 w-64 h-64 rounded-full blur-[100px]"
                 style={{ background: 'rgba(184,199,226,0.1)' }} />

            <p className="font-body text-xs font-semibold text-[var(--aura-tertiary)] tracking-[0.3em] mb-6 uppercase">
              Exclusive Invitation
            </p>

            <h2 className="font-display text-3xl md:text-5xl text-[var(--aura-chrome-bright)] mb-4 tracking-tight">
              Share the Experience
            </h2>

            <div className="relative py-6 px-8 mt-4">
              <span
                className="font-display text-6xl md:text-[120px] leading-none text-[var(--aura-tertiary)] italic drop-shadow-2xl"
                style={{ textShadow: '0 0 40px rgba(212,165,116,0.3)' }}
              >
                $15.00
              </span>
              <p className="font-body text-xs text-[var(--aura-chrome-mid)] tracking-[0.3em] mt-4 uppercase">
                Per Successful Referral
              </p>
            </div>

            <p className="font-body text-base text-[var(--aura-chrome-mid)] max-w-xl mx-auto mt-8 leading-relaxed">
              Invite your inner circle to experience the refined atmosphere of Aura Cafe.
              Both you and your friend will receive premium credits for each successful enrollment.
            </p>
          </div>
        </section>

        {/* ── Bento Grid: Code + Progress ───────────────────────────── */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 mb-12">
          {/* Referral Code Card */}
          <div
            className="lg:col-span-7 p-8 flex flex-col justify-between"
            style={{
              background: 'var(--aura-noir-deep)',
              backdropFilter: 'blur(20px)',
              border: '1px solid rgba(255,255,255,0.1)',
              borderRadius: '40px',
            }}
          >
            <div>
              <h3 className="font-display text-xl text-[var(--aura-chrome-bright)] mb-2">
                Personal Access Key
              </h3>
              <p className="font-body text-sm text-[var(--aura-chrome-mid)] mb-8">
                Share this unique identifier with your guests.
              </p>
            </div>

            <div className="space-y-5">
              <div className="relative group">
                <input
                  readOnly
                  value={referralCode}
                  className="w-full px-6 py-5 font-body text-xl text-[var(--aura-tertiary)] tracking-widest focus:outline-none focus:border-white/50 transition-colors"
                  style={{
                    background: 'rgba(255,255,255,0.05)',
                    border: '1px solid rgba(255,255,255,0.15)',
                  }}
                />
                <button
                  onClick={handleCopy}
                  className="absolute right-3 top-1/2 -translate-y-1/2 px-5 py-2 font-body text-[10px] font-semibold uppercase tracking-widest transition-all active:scale-95"
                  style={{
                    background: 'var(--aura-tertiary)',
                    color: 'var(--aura-noir-deep)',
                  }}
                >
                  {copied ? 'Copied!' : 'Copy Code'}
                </button>
              </div>

              <div className="flex flex-wrap gap-3">
                {SHARE_CHANNELS.map((ch) => (
                  <button
                    key={ch.label}
                    className="flex-1 flex items-center justify-center gap-2 py-3 transition-colors hover:bg-white/5 active:scale-95"
                    style={{
                      background: 'var(--aura-noir-deep)',
                      backdropFilter: 'blur(20px)',
                      border: '1px solid rgba(255,255,255,0.1)',
                    }}
                  >
                    <span className="text-sm">{ch.icon}</span>
                    <span className="font-body text-[10px] font-semibold tracking-widest uppercase text-[var(--aura-chrome-mid)]">
                      {ch.label}
                    </span>
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Progress Tracker */}
          <div
            className="lg:col-span-5 p-8 flex flex-col justify-between"
            style={{
              background: 'var(--aura-noir-deep)',
              backdropFilter: 'blur(20px)',
              border: '1px solid rgba(255,255,255,0.1)',
              borderRadius: '40px',
            }}
          >
            <div>
              <div className="flex justify-between items-end mb-4">
                <h3 className="font-display text-xl text-[var(--aura-chrome-bright)]">Next Bonus</h3>
                <span className="font-body text-sm text-[var(--aura-tertiary)]">3/5 Referrals</span>
              </div>
              <p className="font-body text-sm text-[var(--aura-chrome-mid)] mb-6">
                Unlock a $50 Premium Reserve credit upon reaching 5 referrals.
              </p>
            </div>

            <div className="space-y-4">
              <div
                className="h-2 w-full rounded-full overflow-hidden"
                style={{ background: 'rgba(255,255,255,0.08)' }}
              >
                <div
                  className="h-full transition-all duration-1000"
                  style={{
                    width: '60%',
                    background: 'linear-gradient(90deg, #D4A574 0%, #FFD700 100%)',
                    boxShadow: '0 0 15px rgba(212,165,116,0.5)',
                  }}
                />
              </div>
              <div className="flex justify-between font-body text-[10px] tracking-widest uppercase"
                   style={{ color: 'rgba(212,225,255,0.4)' }}>
                <span>Current Level</span>
                <span>Premium Status Unlock</span>
              </div>
            </div>

            <div className="mt-8 pt-8" style={{ borderTop: '1px solid rgba(255,255,255,0.05)' }}>
              <div className="flex items-center gap-4">
                <div
                  className="w-12 h-12 flex items-center justify-center"
                  style={{
                    background: 'var(--aura-noir-deep)',
                    backdropFilter: 'blur(20px)',
                    border: '1px solid rgba(255,255,255,0.15)',
                  }}
                >
                  <span className="text-[var(--aura-tertiary)] text-xl">🏆</span>
                </div>
                <div>
                  <p className="font-body text-xs font-semibold tracking-widest uppercase text-[var(--aura-chrome-bright)]">
                    Silver Member
                  </p>
                  <p className="font-body text-sm text-[var(--aura-chrome-mid)]">Total Earned: $45.00</p>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* ── Detailed Lists: Friend Network + Reward History ───────── */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Friend Network */}
          <div className="space-y-4">
            <div className="flex justify-between items-center px-2">
              <h4 className="font-display text-lg text-[var(--aura-chrome-bright)]">Friend Network</h4>
              <span className="font-body text-[10px] font-semibold tracking-widest uppercase text-[var(--aura-chrome-mid)]">
                Recent Activity
              </span>
            </div>
            <div
              className="h-px"
              style={{
                background: 'linear-gradient(90deg, transparent, rgba(255,255,255,0.2), transparent)',
                position: 'relative',
              }}
            />

            <div className="space-y-4">
              {FRIENDS.map((friend, idx) => (
                <div
                  key={friend.name}
                  className="p-4 flex items-center justify-between transition-all hover:border-[var(--aura-tertiary)]/30"
                  style={{
                    background: 'var(--aura-noir-deep)',
                    backdropFilter: 'blur(20px)',
                    border: '1px solid rgba(255,255,255,0.1)',
                  }}
                >
                  <div className="flex items-center gap-4">
                    <div
                      className="w-10 h-10 overflow-hidden flex items-center justify-center"
                      style={{ background: 'rgba(255,255,255,0.05)' }}
                    >
                      <span className="font-body text-xs font-semibold text-[var(--aura-chrome-mid)]">
                        {friend.avatar}
                      </span>
                    </div>
                    <div>
                      <p className="font-body text-sm font-medium text-[var(--aura-chrome-bright)]">
                        {friend.name}
                      </p>
                      <p className="font-body text-xs text-[var(--aura-chrome-mid)]">{friend.joined}</p>
                    </div>
                  </div>
                  <span
                    className="px-3 py-1 font-body text-[10px] font-semibold tracking-widest uppercase"
                    style={{
                      background:
                        friend.status === 'ACTIVE'
                          ? 'rgba(212,165,116,0.15)'
                          : 'rgba(255,255,255,0.05)',
                      color:
                        friend.status === 'ACTIVE'
                          ? 'var(--aura-tertiary)'
                          : 'var(--aura-chrome-mid)',
                      border: `1px solid ${
                        friend.status === 'ACTIVE'
                          ? 'rgba(212,165,116,0.2)'
                          : 'rgba(255,255,255,0.1)'
                      }`,
                    }}
                  >
                    {friend.status}
                  </span>
                </div>
              ))}
            </div>

            {/* Reward History */}
            <div className="space-y-4 mt-8">
              <div className="flex justify-between items-center px-2">
                <h4 className="font-display text-lg text-[var(--aura-chrome-bright)]">Reward History</h4>
                <button className="font-body text-[10px] font-semibold tracking-widest uppercase text-[var(--aura-chrome-mid)] underline hover:text-[var(--aura-tertiary)] transition-colors">
                  Download Statement
                </button>
              </div>
              <div
                className="h-px"
                style={{
                  background: 'linear-gradient(90deg, transparent, rgba(255,255,255,0.2), transparent)',
                }}
              />
              <div
                className="overflow-hidden"
                style={{
                  background: 'var(--aura-noir-deep)',
                  border: '1px solid rgba(255,255,255,0.1)',
                }}
              >
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr style={{ background: 'rgba(255,255,255,0.05)' }}>
                      <th className="p-4 font-body text-[10px] font-semibold tracking-widest uppercase text-[var(--aura-chrome-mid)]">
                        Date
                      </th>
                      <th className="p-4 font-body text-[10px] font-semibold tracking-widest uppercase text-[var(--aura-chrome-mid)]">
                        Source
                      </th>
                      <th className="p-4 font-body text-[10px] font-semibold tracking-widest uppercase text-[var(--aura-chrome-mid)] text-right">
                        Credit
                      </th>
                    </tr>
                  </thead>
                  <tbody className="font-body text-sm">
                    {REWARD_HISTORY.map((row) => (
                      <tr
                        key={row.date}
                        className="transition-colors hover:bg-white/5"
                        style={{ borderTop: '1px solid rgba(255,255,255,0.03)' }}
                      >
                        <td className="p-4 font-body text-xs text-[var(--aura-chrome-mid)]">
                          {row.date}
                        </td>
                        <td className="p-4 text-[var(--aura-chrome-bright)]">{row.source}</td>
                        <td className="p-4 text-right font-semibold text-[var(--aura-tertiary)]">
                          +${row.credit.toFixed(2)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>

          {/* Reward History Full Width (desktop spans second column) */}
          <div className="hidden lg:block" />
        </div>
      </main>

      {/* ── Mobile Bottom Navigation ────────────────────────────────── */}
      <nav
        className="md:hidden fixed bottom-0 left-0 w-full flex justify-around items-center h-20 px-2 pb-4 z-50"
        style={{
          background: 'rgba(0,14,35,0.6)',
          backdropFilter: 'blur(24px)',
          borderTop: '1px solid rgba(255,255,255,0.1)',
        }}
      >
        {MOBILE_NAV_ITEMS.map((item) => (
          <button
            key={item.label}
            className={`flex flex-col items-center justify-center transition-all duration-200 active:scale-90 ${
              item.active ? 'font-bold' : ''
            }`}
            style={{
              color: item.active ? 'var(--aura-tertiary)' : 'var(--aura-chrome-mid)',
              background: item.active ? 'rgba(57,71,94,0.4)' : 'transparent',
              borderRadius: '9999px',
              padding: '4px 16px',
            }}
          >
            <span className="text-lg">{item.icon}</span>
            <span className="font-body text-[10px] mt-1 tracking-widest uppercase font-semibold">
              {item.label}
            </span>
          </button>
        ))}
      </nav>
    </StitchShell>
  );
}
