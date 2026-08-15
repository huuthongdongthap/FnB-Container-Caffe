import { useState } from 'react';

export default function ReferralSection() {
  const [copied, setCopied] = useState(false);
  const handleCopy = () => { setCopied(true); setTimeout(() => setCopied(false), 2000); };

  return (
    <section className="glass-panel rounded-xl p-5 relative overflow-hidden">
      <div className="absolute -right-8 -top-8 w-28 h-28 bg-[var(--aura-tertiary)]/10 blur-[48px] rounded-full" />
      <h3 className="font-headline-md text-headline-md text-[var(--aura-chrome-bright)] mb-2">Refer & Earn / Mời bạn</h3>
      <p className="font-body-sm text-sm text-[var(--aura-chrome-mid)]">Invite another connoisseur. When they join, you both receive 2,000 points. / Mời bạn, cả hai nhận 2,000 điểm.</p>
      <div className="mt-4 p-3 rounded-lg bg-white/5 border border-white/10 flex items-center justify-between">
        <span className="font-mono text-lg tracking-widest text-[var(--aura-tertiary)]">AURA-PLAT-882</span>
        <button onClick={handleCopy} className="text-[var(--aura-tertiary)] hover:text-white flex items-center gap-1 font-label-caps text-[10px] font-bold active:scale-90 transition-all">
          {copied ? '✓ COPIED' : '📋 COPY'}
        </button>
      </div>
      <div className="flex gap-2 mt-3">
        <button className="flex-1 py-2 rounded-lg bg-white/5 border border-white/10 text-[var(--aura-chrome-mid)] hover:bg-white/10 transition-all text-xs">📤 Share</button>
        <button className="flex-[3] py-2 rounded-lg bg-[var(--aura-tertiary)] text-[var(--aura-noir-deep)] font-label-caps text-xs font-bold hover:brightness-110 transition-all">Share Invite</button>
      </div>
    </section>
  );
}
