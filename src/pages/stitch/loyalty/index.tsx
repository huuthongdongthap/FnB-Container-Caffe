import { useState } from 'react';
import { PageHeader, PageFooter, FooterSocialLinks, FooterLegalLinks } from '@/components/stitch/StitchLayout';

const REWARDS = [
{ name: 'Private Cupping Session', pts: '4,500 PTS', img: 'https://lh3.googleusercontent.com/aida-public/AB6AXuB5VoyAqqlj9v1p_Fd0vKnkJbm4fDpCbBfcfnGk9iXWJsQkUY4p9MwZE9gW4aIGDezgU5nVuKq9kA5nJlELipUIKxSAu-iJ0TyddMgMz4EetP8GtGSFzEHu72d1fnLIk3pCADfO75fGMgJjAfybKZas0EOq-e0Wu_847djVJd6nISO3cs0Pjyb7NUii2ULfHnRyQW30Laqzeso6-81-OMMeqPUorTlgkBBRabwNARHVIRCd7uvVvxzFycbE1Y4I-ysk4OWL4tc5Mtk' },
{ name: 'Limited Edition Vessel', pts: '8,000 PTS', img: 'https://lh3.googleusercontent.com/aida-public/AB6AXuD1ZYyk4mbXZG3-ZeOC-Q5TZST8LNWGfeghQ08Q6qfgBKPaqKi2xvxzOhGO64VKfR7PP8RlK7NqYc5d0KyUivemYw5JwC_jdKmOULyvxP6-iAfdcE3TynE0mhz2DNdVaaRjQQi2rnuYdumCRNtZb-HNEiKa1grVkNIXGPNK9z0SxwpgcmyPwiY8KGLjvlpu-inWp6t01uR2oV28qWJNBVzw7R7ne9nt747XKEB9Q2FKmg7c_NrELvOi2xwOpzmbhqX2YaBD_vG3uRE' },
{ name: 'Artisan Coffee Flight', pts: '2,500 PTS', img: 'https://lh3.googleusercontent.com/aida-public/AB6AXuAHAfEGOOefIl2MVbYXeX3iigZB8rveXFZ7jluS_IW7_nDi6Phokeh3xVop2G1btyCwd2nrPhZnWVDIeCsGyK_u0ukBnx06WTAn2Irk1_14p99qJYFVXOIyjxQPmBB5ONiDOz-sZHx1_hSVTRDTwU7zj75xxi5_-LTat6pQ36So9JPYZ4X4k9sCoOIWYVgr_SmQXuEaD9hCKRXmaI-eicBKDQJnGmeubIirNBf0n4CzrYV1-4-CnEiGR7ksClo00VjDHOFshsJkssc' },
] as const;

const POINTS_HISTORY = [
{ activity: 'Kenya SL28 Purchase', date: 'OCT 24, 2024', status: 'COMPLETED', pts: '+450' },
{ activity: 'Concierge Booking', date: 'OCT 20, 2024', status: 'COMPLETED', pts: '+1,200' },
{ activity: 'Referral Bonus', date: 'OCT 15, 2024', status: 'COMPLETED', pts: '+2,000' },
] as const;

const DAYS = ['MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT'] as const;

const TIER_BENEFITS = [
'Complementary valet parking / Đỗ xe miễn phí',
'Priority reservation access / Đặt bàn ưu tiên',
'Invite-only tasting events / Sự kiện degustation riêng',
'15% Discount on retail gear / Giảm 15% hàng retail',
] as const;

export default function LoyaltyRewardsDashboard() {
const [copied, setCopied] = useState(false);
const handleCopy = () => { setCopied(true); setTimeout(() => setCopied(false), 2000); };

return (
<div className="min-h-screen bg-[var(--aura-noir-deep)] text-[var(--aura-chrome-bright)]">
{/* Top Bar */}
<PageHeader
brand="AURA CAFE"
sticky
rightContent={
<span className="w-8 h-8 rounded-full bg-[var(--aura-tertiary)]/20 flex items-center justify-center text-sm">👤</span>
}
/>

<main className="max-w-7xl mx-auto px-5 py-8">
<div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
{/* Left Column */}
<div className="lg:col-span-8 space-y-6">
{/* Platinum Card */}
<section className="glass-panel rounded-2xl p-6 md:p-8 relative overflow-hidden" style={{ background: 'linear-gradient(135deg, rgba(212,165,116,0.08) 0%, rgba(212,165,116,0.02) 50%, transparent 100%)' }}>
<div className="absolute -right-16 -top-16 w-48 h-48 bg-[var(--aura-tertiary)]/10 blur-[64px] rounded-full" />
<div className="flex items-start justify-between relative">
<div>
<span className="inline-block px-3 py-1 rounded-full bg-[var(--aura-tertiary)] text-[var(--aura-noir-deep)] font-label-caps text-[10px] uppercase tracking-widest font-bold mb-3" style={{ boxShadow: '0 0 12px rgba(212,165,116,0.3)' }}>
⭐ Platinum / Bạch kim
</span>
<p className="font-body text-sm text-[var(--aura-chrome-mid)]">Member Since / Thành viên từ 2022</p>
<div className="mt-4">
<div className="flex justify-between mb-1">
<span className="font-label-caps text-[10px] text-[var(--aura-chrome-mid)] uppercase tracking-wider">Progress to Black Tier / Tiến trình Black</span>
<span className="font-label-caps text-[10px] text-[var(--aura-tertiary)]">2,550 PTS needed</span>
</div>
<div className="h-2 w-full bg-white/5 rounded-full overflow-hidden">
<div className="h-full bg-[var(--aura-tertiary)] rounded-full" style={{ width: '78%', boxShadow: '0 0 10px rgba(212,165,116,0.3)' }} />
</div>
</div>
</div>
</div>
<div className="flex items-end justify-between mt-8 pt-6 border-t border-white/10">
<div>
<p className="font-label-caps text-[10px] text-[var(--aura-chrome-mid)] uppercase tracking-wider">Available Points / Điểm có sẵn</p>
<p className="font-display text-5xl md:text-7xl text-[var(--aura-tertiary)] leading-none mt-1" style={{ fontFamily: 'var(--font-display, "Libre Caslon Text", serif)' }}>12,450</p>
<p className="font-label-caps text-[10px] text-[var(--aura-chrome-mid)] mt-1 tracking-wider">PREMIUM REWARD POINTS</p>
</div>
<button className="px-6 py-3 rounded-lg bg-[var(--aura-tertiary)] text-[var(--aura-noir-deep)] font-headline-sm uppercase tracking-widest text-xs font-bold hover:brightness-110 active:scale-95 transition-all">
Redeem / Quy đổi
</button>
</div>
</section>

{/* Available Rewards */}
<section>
<div className="flex justify-between items-center mb-4">
<h3 className="font-headline-md text-headline-md text-[var(--aura-chrome-bright)]">Available Rewards / Phần thưởng</h3>
<a href="#" className="font-label-caps text-[10px] text-[var(--aura-tertiary)] hover:underline uppercase tracking-widest">View All / Xem tất cả</a>
</div>
<div className="grid grid-cols-1 md:grid-cols-3 gap-4">
{REWARDS.map(r => (
<div key={r.name} className="glass-panel rounded-xl overflow-hidden cursor-pointer transition-all duration-500 hover:border-[var(--aura-tertiary)]/40 group">
<div className="h-40 relative overflow-hidden">
<div className="w-full h-full bg-cover bg-center group-hover:scale-105 transition-transform duration-700" style={{ backgroundImage: `url(${r.img})` }} role="img" aria-label={r.name} />
<div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent" />
</div>
<div className="p-4">
<h4 className="font-body text-body text-[var(--aura-chrome-bright)] mb-1">{r.name}</h4>
<p className="font-label-caps text-[10px] text-[var(--aura-chrome-mid)] uppercase tracking-wider">{r.pts}</p>
<button className="w-full mt-3 py-2 border border-white/10 rounded-lg font-label-caps text-[10px] font-bold uppercase tracking-wider text-[var(--aura-chrome-mid)] hover:bg-white/5 transition-colors">
Claim / Nhận
</button>
</div>
</div>
))}
</div>
</section>

{/* Points History */}
<section className="glass-panel rounded-xl p-6">
<div className="flex justify-between items-center mb-4">
<h3 className="font-headline-md text-headline-md text-[var(--aura-chrome-bright)]">Points History / Lịch sử điểm</h3>
<span className="text-[var(--aura-chrome-mid)] cursor-pointer hover:text-[var(--aura-tertiary)]">☰</span>
</div>
<div className="overflow-x-auto">
<table className="w-full text-left">
<thead>
<tr className="border-b border-white/10">
<th className="py-3 font-label-caps text-[10px] text-[var(--aura-chrome-mid)] uppercase tracking-wider">Activity</th>
<th className="py-3 font-label-caps text-[10px] text-[var(--aura-chrome-mid)] uppercase tracking-wider">Date</th>
<th className="py-3 font-label-caps text-[10px] text-[var(--aura-chrome-mid)] uppercase tracking-wider">Status</th>
<th className="py-3 font-label-caps text-[10px] text-[var(--aura-chrome-mid)] uppercase tracking-wider text-right">Points</th>
</tr>
</thead>
<tbody className="divide-y divide-white/5">
{POINTS_HISTORY.map(row => (
<tr key={row.activity} className="group hover:bg-white/5 transition-colors">
<td className="py-3 font-body-sm text-sm text-[var(--aura-chrome-bright)]">{row.activity}</td>
<td className="py-3 font-label-caps text-[10px] text-[var(--aura-chrome-mid)]">{row.date}</td>
<td className="py-3"><span className="px-2 py-0.5 rounded text-[9px] border border-[var(--aura-tertiary)]/40 text-[var(--aura-tertiary)] uppercase">{row.status}</span></td>
<td className="py-3 text-right font-bold text-[var(--aura-tertiary)]">{row.pts}</td>
</tr>
))}
</tbody>
</table>
</div>
</section>
</div>

{/* Right Column */}
<div className="lg:col-span-4 space-y-6">
{/* Weekly Streak */}
<section className="glass-panel rounded-xl p-5">
<h3 className="font-headline-md text-headline-md text-[var(--aura-chrome-bright)] mb-4">Weekly Streak / Chuỗi ngày</h3>
<div className="flex justify-between gap-2">
{DAYS.map((day, i) => (
<div key={day} className="flex flex-col items-center gap-2">
<div className={`w-10 h-10 rounded-full border flex items-center justify-center ${i < 3 ? 'border-[var(--aura-tertiary)] text-[var(--aura-tertiary)] bg-[var(--aura-tertiary)]/10' : 'border-white/10 text-white/20'}`}>
<span className="text-sm">⭐</span>
</div>
<span className="font-label-caps text-[9px] text-[var(--aura-chrome-mid)] uppercase tracking-wider">{day}</span>
</div>
))}
</div>
<p className="mt-4 font-body-sm text-sm text-[var(--aura-chrome-mid)]">
Check in today to maintain your <span className="text-[var(--aura-tertiary)] font-bold">12-day streak</span> and earn double points. / Checkin để giữ chuỗi 12 ngày và nhân đôi điểm.
</p>
<button className="mt-4 w-full py-3 rounded-lg bg-white/5 border border-white/10 font-headline-sm uppercase tracking-widest text-xs hover:border-[var(--aura-tertiary)]/40 transition-all flex items-center justify-center gap-2">
📍 Check-in at Roastery
</button>
</section>

{/* Referral */}
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

{/* Benefits */}
<section className="glass-panel rounded-xl p-5">
<h3 className="font-label-caps text-[10px] text-[var(--aura-chrome-mid)] uppercase tracking-[0.2em] mb-4">Tier Benefits / Quyền lợi</h3>
<ul className="space-y-3">
{TIER_BENEFITS.map(b => (
<li key={b} className="flex items-center gap-3 group">
<span className="w-1.5 h-1.5 rounded-full bg-[var(--aura-tertiary)] group-hover:scale-150 transition-transform shrink-0" />
<span className="font-body-sm text-sm text-[var(--aura-chrome-bright)]">{b}</span>
</li>
))}
</ul>
</section>

{/* Reward History (right col) */}
<section className="glass-panel rounded-xl p-5">
<h3 className="font-label-caps text-[10px] text-[var(--aura-chrome-mid)] uppercase tracking-widest mb-3 border-l-2 border-[var(--aura-tertiary)] pl-3">Reward History / Lịch sử thưởng</h3>
<div className="rounded-xl overflow-hidden bg-white/5 border border-white/5">
<table className="w-full text-left text-sm">
<thead>
<tr className="border-b border-white/10">
<th className="p-2 font-label-caps text-[9px] uppercase text-[var(--aura-chrome-mid)]">Date</th>
<th className="p-2 font-label-caps text-[9px] uppercase text-[var(--aura-chrome-mid)]">Source</th>
<th className="p-2 font-label-caps text-[9px] uppercase text-[var(--aura-chrome-mid)] text-right">Amount</th>
</tr>
</thead>
<tbody>
{[{ d: '24 Oct', s: 'J. Vane', a: '+$15.00' }, { d: '21 Oct', s: 'E. Thorne', a: '+$15.00' }, { d: '15 Oct', s: 'M. Chen', a: '+$15.00' }].map(r => (
<tr key={r.d} className="border-b border-white/5 last:border-0 hover:bg-white/5 transition-colors">
<td className="p-2 font-body-sm text-xs text-[var(--aura-chrome-mid)]">{r.d}</td>
<td className="p-2 font-body-sm text-xs">{r.s}</td>
<td className="p-2 font-body-sm text-xs text-right text-[var(--aura-tertiary)]">{r.a}</td>
</tr>
))}
</tbody>
</table>
</div>
</section>
</div>
</div>
</main>

{/* Footer */}
<PageFooter
brand="AURA CAFE"
socialLinks={['IG', 'FB', 'TT'].map(s => ({ label: s }))}
socialSize="sm"
rows={
<>
<FooterSocialLinks links={['IG', 'FB', 'TT'].map(s => ({ label: s }))} size="md" className="justify-center" />
<FooterLegalLinks links={['Privacy', 'Terms', 'Black Tier', 'Contact']} className="justify-center mt-4" />
<p className="font-label-caps text-[10px] text-[var(--aura-chrome-mid)] opacity-50 text-center mt-4">© 2024 AURA CAFE. ALL RIGHTS RESERVED.</p>
</>
}
/>
</div>
);
}
