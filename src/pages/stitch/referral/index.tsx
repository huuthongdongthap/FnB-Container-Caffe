import { useState } from 'react';
import { PageHeader, PageFooter } from '@/components/stitch/StitchLayout';

const BENEFITS = [
{ icon: '☕', title: 'Free First Brew', desc: 'Your friend gets a complimentary drink on their first visit. / Bạn bè nhận đồ uống miễn phí lần đầu.', count: '2,400 USED' },
{ icon: '🎁', title: 'Double Points', desc: 'Both earn 2,000 bonus points when they join. / Cả hai nhận 2,000 điểm thưởng.', count: '1,850 USED' },
{ icon: '👑', title: 'Tier Boost', desc: 'Refer 5 friends to unlock exclusive Black Tier preview. / Giới thiệu 5 bạn để mở khóa Black Tier.', count: '320 USED' },
{ icon: '💎', title: 'VIP Access', desc: 'Exclusive event invites for both referrer and referee. / Mời sự kiện đặc biệt cho cả hai.', count: '150 USED' },
] as const;

const LEADERBOARD = [
{ name: 'L. Moreau', refs: 47, reward: 'Black Tier' },
{ name: 'K. Nguyen', refs: 38, reward: 'Private Cupping' },
{ name: 'A. Rossi', refs: 31, reward: 'Limited Vessel' },
{ name: 'M. Chen', refs: 24, reward: 'Artisan Flight' },
{ name: 'J. Vane', refs: 19, reward: '2,000 PTS' },
] as const;

export default function ReferralProgram() {
const [copied, setCopied] = useState(false);
const handleCopy = () => { setCopied(true); setTimeout(() => setCopied(false), 2000); };

return (
<div className="min-h-screen bg-[var(--aura-noir-deep)] text-[var(--aura-chrome-bright)]">
{/* Top Nav */}
<PageHeader
brand="AURA CAFE"
sticky
rightContent={
<span className="w-8 h-8 rounded-full bg-[var(--aura-tertiary)]/20 flex items-center justify-center text-sm">👤</span>
}
/>

<main className="max-w-7xl mx-auto px-5 py-8">
{/* Hero */}
<section className="text-center mb-10">
<span className="inline-block px-3 py-1 rounded-full bg-[var(--aura-tertiary)]/15 text-[var(--aura-tertiary)] font-label-caps text-[10px] uppercase tracking-widest font-bold border border-[var(--aura-tertiary)]/30">Referral Program</span>
<h1 className="font-display text-4xl md:text-5xl text-[var(--aura-chrome-bright)] italic mt-4" style={{ fontFamily: 'var(--font-display, "Libre Caslon Text", serif)' }}>
Share the Craft<br />Chia sẻ nghệ thuật
</h1>
<p className="font-body text-body text-[var(--aura-chrome-mid)] mt-3 max-w-xl mx-auto">
Invite fellow connoisseurs. Every referral earns both of you exclusive rewards. / Mời những người sành, mỗi lời mời mang thưởng cho cả hai.
</p>
</section>

{/* Your Referral Code */}
<section className="glass-panel rounded-2xl p-6 md:p-8 mb-8 relative overflow-hidden" style={{ background: 'linear-gradient(135deg, rgba(212,165,116,0.1) 0%, transparent 50%)' }}>
<div className="absolute -right-20 -top-20 w-64 h-64 bg-[var(--aura-tertiary)]/10 blur-[64px] rounded-full" />
<div className="relative">
<h3 className="font-headline-md text-headline-md text-[var(--aura-chrome-bright)] mb-2">Your Referral Code / Mã giới thiệu</h3>
<p className="font-body-sm text-sm text-[var(--aura-chrome-mid)] mb-4">Share this code. When they join and make their first order, you both receive rewards. / Chia sẻ mã này, khi họ đăng ký và đặt hàng đầu tiên.</p>
<div className="flex items-center gap-4">
<div className="flex-1 p-4 rounded-xl bg-white/5 border border-white/10 font-mono text-xl md:text-2xl tracking-[0.15em] text-[var(--aura-tertiary)] text-center">
AURA-A7X-2024
</div>
<button onClick={handleCopy} className="px-6 py-4 rounded-xl bg-[var(--aura-tertiary)] text-[var(--aura-noir-deep)] font-label-caps text-label-caps text-xs font-bold uppercase tracking-wider hover:brightness-110 active:scale-95 transition-all whitespace-nowrap">
{copied ? '✓ COPIED / Đã sao chép' : '📋 COPY / SAO CHÉP'}
</button>
</div>
</div>
</section>

{/* Stats Row */}
<div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-10">
{[
{ label: 'Total Referrals / Tổng giới thiệu', value: '47' },
{ label: 'Active / Đang hoạt động', value: '12' },
{ label: 'Rewards Claimed / Đã nhận', value: '$650' },
{ label: 'Your Rank / Xếp hạng', value: '#3' },
].map(stat => (
<div key={stat.label} className="glass-panel rounded-xl p-4 text-center">
<p className="font-display text-3xl text-[var(--aura-tertiary)]" style={{ fontFamily: 'var(--font-display, serif)' }}>{stat.value}</p>
<p className="font-label-caps text-[9px] text-[var(--aura-chrome-mid)] uppercase tracking-wider mt-1">{stat.label}</p>
</div>
))}
</div>

{/* Benefits Grid */}
<section className="mb-10">
<h3 className="font-headline-md text-headline-md text-[var(--aura-chrome-bright)] mb-4">Reward Tiers / Cấp thưởng</h3>
<div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
{BENEFITS.map(b => (
<div key={b.title} className="glass-panel rounded-xl p-5 transition-all hover:-translate-y-1 hover:border-[var(--aura-tertiary)]/30 group">
<div className="text-3xl mb-3">{b.icon}</div>
<h4 className="font-headline-sm text-headline-sm text-[var(--aura-chrome-bright)] mb-1 group-hover:text-[var(--aura-tertiary)] transition-colors">{b.title}</h4>
<p className="font-body-sm text-xs text-[var(--aura-chrome-mid)] leading-relaxed">{b.desc}</p>
<span className="inline-block mt-3 px-2 py-0.5 rounded bg-white/5 font-label-caps text-[9px] text-[var(--aura-chrome-mid)] border border-white/10">{b.count}</span>
</div>
))}
</div>
</section>

{/* How It Works */}
<section className="glass-panel rounded-2xl p-6 md:p-8 mb-10">
<h3 className="font-headline-md text-headline-md text-[var(--aura-chrome-bright)] mb-6">How It Works / Cách hoạt động</h3>
<div className="grid grid-cols-1 md:grid-cols-3 gap-6">
{[
{ step: '01', title: 'Share / Chia sẻ', desc: 'Share your unique code AURA-A7X-2024 with friends. / Chia sẻ mã duy nhất của bạn với bạn bè.' },
{ step: '02', title: 'They Join / Họ tham gia', desc: 'Your friend signs up and makes their first order. / Bạn bè đăng ký và đặt hàng đầu tiên.' },
{ step: '03', title: 'Both Win / Cùng thắng', desc: 'You both receive 2,000 bonus points instantly. / Cả hai nhận 2,000 điểm thưởng ngay.' },
].map(s => (
<div key={s.step} className="relative">
<div className="w-10 h-10 rounded-full bg-[var(--aura-tertiary)]/15 flex items-center justify-center font-display text-lg text-[var(--aura-tertiary)] mb-3" style={{ fontFamily: 'var(--font-display, serif)' }}>{s.step}</div>
<h4 className="font-headline-sm text-headline-sm text-[var(--aura-chrome-bright)] mb-1">{s.title}</h4>
<p className="font-body-sm text-xs text-[var(--aura-chrome-mid)]">{s.desc}</p>
{s.step !== '03' && <div className="hidden md:block absolute top-5 left-[calc(100%+12px)] text-[var(--aura-tertiary)]/40">→</div>}
</div>
))}
</div>
</section>

{/* Share on Social */}
<section className="glass-panel rounded-2xl p-6 md:p-8 mb-10">
<h3 className="font-headline-md text-headline-md text-[var(--aura-chrome-bright)] mb-4">Share on Social / Chia sẻ MXH</h3>
<p className="font-body-sm text-sm text-[var(--aura-chrome-mid)] mb-4">
Spread the word. Use your code anywhere. / Lan tỏa thông điệp. Dùng mã ở mọi nơi.
</p>
<div className="flex flex-wrap gap-3">
{[
{ label: 'IG Story', icon: '📸' },
{ label: 'Facebook', icon: '📘' },
{ label: 'Zalo', icon: '💬' },
{ label: 'Message', icon: '✉️' },
].map(s => (
<button key={s.label} className="flex items-center gap-2 px-4 py-2.5 rounded-lg bg-white/5 border border-white/10 text-sm text-[var(--aura-chrome-bright)] hover:border-[var(--aura-tertiary)]/40 transition-all">
<span>{s.icon}</span>
<span className="font-label-caps text-xs">{s.label}</span>
</button>
))}
</div>
</section>

{/* Leaderboard */}
<section>
<h3 className="font-headline-md text-headline-md text-[var(--aura-chrome-bright)] mb-4">Top Referrers / Top giới thiệu</h3>
<div className="glass-panel rounded-xl overflow-hidden">
<table className="w-full text-left">
<thead>
<tr className="border-b border-white/10">
<th className="p-4 font-label-caps text-[10px] text-[var(--aura-chrome-mid)] uppercase tracking-wider">Rank</th>
<th className="p-4 font-label-caps text-[10px] text-[var(--aura-chrome-mid)] uppercase tracking-wider">Member</th>
<th className="p-4 font-label-caps text-[10px] text-[var(--aura-chrome-mid)] uppercase tracking-wider text-right">Referrals</th>
<th className="p-4 font-label-caps text-[10px] text-[var(--aura-chrome-mid)] uppercase tracking-wider text-right">Reward</th>
</tr>
</thead>
<tbody className="divide-y divide-white/5">
{LEADERBOARD.map((row, i) => (
<tr key={row.name} className="group hover:bg-white/5 transition-colors">
<td className="p-4">
<span className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold ${i === 0 ? 'bg-[var(--aura-tertiary)] text-[var(--aura-noir-deep)]' : i === 1 ? 'bg-white/10 text-[var(--aura-chrome-bright)]' : i === 2 ? 'bg-[#D4A574]/20 text-[var(--aura-tertiary)]' : 'bg-white/5 text-[var(--aura-chrome-mid)]'}`}>
{i + 1}
</span>
</td>
<td className="p-4 font-body text-sm text-[var(--aura-chrome-bright)]">{row.name}</td>
<td className="p-4 text-right font-bold text-[var(--aura-tertiary)]">{row.refs}</td>
<td className="p-4 text-right font-label-caps text-xs text-[var(--aura-chrome-mid)]">{row.reward}</td>
</tr>
))}
</tbody>
</table>
</div>
</section>
</main>

{/* Footer */}
<PageFooter
brand="AURA CAFE"
legalLinks={['Privacy', 'Terms', 'Contact']}
copyLine="© 2024 AURA CAFE. ALL RIGHTS RESERVED."
/>
</div>
);
}
