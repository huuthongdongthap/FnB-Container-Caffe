import { SHARE_CHANNELS } from './referral-rewards-2-data';

interface ReferralCodeCardProps {
  referralCode: string;
  copied: boolean;
  onCopy: () => void;
}

export function ReferralCodeCard({ referralCode, copied, onCopy }: ReferralCodeCardProps) {
  return (
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
            onClick={onCopy}
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
  );
}
