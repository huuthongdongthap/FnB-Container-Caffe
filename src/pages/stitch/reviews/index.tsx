import { useState } from 'react';
import { PageHeader, PageFooter } from '@/components/stitch/StitchLayout';

const REVIEWS = [
{
id: 1, author: 'L. Moreau', rating: 5, date: 'OCT 28, 2024',
text: 'The Industrial Cold Brew changed my morning ritual. 18-hour extraction is no gimmick — it is genuinely the smoothest cold brew I have tasted. / Cold Brew Công nghiệp đã thay đổi nghi lễ buổi sáng của tôi.',
avatar: 'https://lh3.googleusercontent.com/aida-public/AB6AXuB_jlKo9X4D8qY-FPsCJIht8-bj_tP6A1R7wnp98lIVt_gJPs5_WxM8PrD7SnPhML_Uoc593rsG7p3GgFYf1aW_DkYhXN4BVzu0yMm5_NMgftU_z6rMijcFKziBuhYkJYtM70gdHa-I_iYKguT9s-chHuI2xGkVFIM9_FyqzGu3BXF-d2hzBnSc_aXl9xj_SB-B0pzfq-ZZueCJbYdpMa7-QverBBoonsy4h1wPjNWU5GWe-pzVaC4b_NTqGe5GQIrjkm_yBTosgw',
product: 'Industrial Cold Brew',
},
{
id: 2, author: 'K. Nguyen', rating: 5, date: 'OCT 25, 2024',
text: 'AURA CAFE is unlike anything in HCMC. The bronze lighting and chrome velvet latte — this is luxury redefined for the nocturnal palette. / AURA CAFE khác biệt hoàn toàn tại HCMC.',
avatar: 'https://lh3.googleusercontent.com/aida-public/AB6AXuDTyG-lA1b0lMGI97x1xGuw2ZfTdC0wXbrcRTQSN4uSbXxlcg-rDGeY5Ai72s3el2m5ISca1jGlOp8ynHlfckqWNOl44l-COBcK_FHq6L_Ye0ncr7QaW8t7rBdVFKEF5AuQJDopMnqOvRsTPmP81vfflNSHvhpME9VhlmBKc-dRrlSDrHwkME-sEPe3VWjvHOVKUi0lT5_QuaImL4TchV3CZ1W0CPcVXa-XIjMzDfKVV06AqNgUukPKC47j55lJyrjuCm8Hp3n8Mg',
product: 'Chrome Velvet Latte',
},
{
id: 3, author: 'A. Rossi', rating: 4, date: 'OCT 22, 2024',
text: 'The Bronze Chai has real depth. You can taste the single-origin spices. Only wish the seating was more accessible for larger groups. / Bronze Chai có hương vị sâu sắc.',
avatar: 'https://lh3.googleusercontent.com/aida-public/AB6AXuATJHHuAIMu9E5_PP_UCAsux97RHHLmBVjU9qpfeFKiPyjVGv-l3EHUzAg_fgBj4CHPZIoqFJ_JPxLjrMD9vmUNiBcHwzhKpceGBurTX1i-Mr4TJe2K8m9-h_OQeQDrp9qOU7RoxxYVxl4wN4kRnRI8H6GnsLuuqCiVuvKRZEhL-w36h-xoGSFt94Hd96pNPYaSaZfLZoTpEYB_v9dP8oZyv1d5JoOjL2U75TvMupj4k1ZGB0dt4RpmItxKZcgkVZcCN63d5d3Aw',
product: 'Bronze Chai',
},
{
id: 4, author: 'M. Chen', rating: 5, date: 'OCT 18, 2024',
text: 'Platinum tier concierge service is next-level. They remembered my exact milk preference. Worth every point. / Dịch vụ concierge Platinum thực sự đẳng cấp.',
avatar: 'https://lh3.googleusercontent.com/aida-public/AB6AXuB_jlKo9X4D8qY-FPsCJIht8-bj_tP6A1R7wnp98lIVt_gJPs5_WxM8PrD7SnPhML_Uoc593rsG7p3GgFYf1aW_DkYhXN4BVzu0yMm5_NMgftU_z6rMijcFKziBuhYkJYtM70gdHa-I_iYKguT9s-chHuI2xGkVFIM9_FyqzGu3BXF-d2hzBnSc_aXl9xj_SB-B0pzfq-ZZueCJbYdpMa7-QverBBoonsy4h1wPjNWU5GWe-pzVaC4b_NTqGe5GQIrjkm_yBTosgw',
product: 'Loyalty Program',
},
{
id: 5, author: 'J. Vane', rating: 5, date: 'OCT 15, 2024',
text: 'The midnight espresso hit different here. Raw intensity, zero bitterness. This is what coffee should taste like. / Midnight Espresso ở đây khác hoàn toàn.',
avatar: 'https://lh3.googleusercontent.com/aida-public/AB6AXuDTyG-lA1b0lMGI97x1xGuw2ZfTdC0wXbrcRTQSN4uSbXxlcg-rDGeY5Ai72s3el2m5ISca1jGlOp8ynHlfckqWNOl44l-COBcK_FHq6L_Ye0ncr7QaW8t7rBdVFKEF5AuQJDopMnqOvRsTPmP81vfflNSHvhpME9VhlmBKc-dRrlSDrHwkME-sEPe3VWjvHOVKUi0lT5_QuaImL4TchV3CZ1W0CPcVXa-XIjMzDfKVV06AqNgUukPKC47j55lJyrjuCm8Hp3n8Mg',
product: 'Midnight Espresso',
},
] as const;

const RATING_DISTRIBUTION = [78, 14, 5, 2, 1] as const;
const REVIEW_FILTERS = ['All Reviews', '5 Stars', '4 Stars', '3 Stars', 'With Photos'] as const;

export default function ReviewsRatings() {
const [activeFilter, setActiveFilter] = useState('All Reviews');
const [hoveredStars, setHoveredStars] = useState<number | null>(null);
const [showForm, setShowForm] = useState(false);

const avgRating = (REVIEWS.reduce((sum, r) => sum + r.rating, 0) / REVIEWS.length).toFixed(1);

return (
<div className="min-h-screen bg-[var(--aura-noir-deep)] text-[var(--aura-chrome-bright)]">
{/* Top Nav */}
<PageHeader
brand="AURA CAFE"
sticky
rightContent={
<button className="px-4 py-1.5 rounded-lg bg-[var(--aura-tertiary)] text-[var(--aura-noir-deep)] font-label-caps text-[10px] font-bold uppercase tracking-widest">Write Review</button>
}
/>

<main className="max-w-6xl mx-auto px-5 py-20">
{/* Hero */}
<section className="text-center mb-10">
<span className="inline-block px-3 py-1 rounded-full bg-[var(--aura-tertiary)]/15 text-[var(--aura-tertiary)] font-label-caps text-[10px] uppercase tracking-widest font-bold border border-[var(--aura-tertiary)]/30">
Reviews & Ratings / Đánh giá
</span>
<h1 className="font-display text-4xl md:text-5xl text-[var(--aura-chrome-bright)] italic mt-4" style={{ fontFamily: 'var(--font-display, "Libre Caslon Text", serif)' }}>
Guest Voices<br />Tiếng nói khách
</h1>
</section>

{/* Rating Overview */}
<section className="glass-panel rounded-2xl p-6 md:p-8 mb-8" style={{ background: 'linear-gradient(135deg, rgba(212,165,116,0.06) 0%, transparent 60%)' }}>
<div className="flex flex-col md:flex-row items-center gap-8">
{/* Large Score */}
<div className="text-center shrink-0">
<p className="font-display text-7xl text-[var(--aura-tertiary)]" style={{ fontFamily: 'var(--font-display, serif)' }}>{avgRating}</p>
<div className="flex gap-0.5 justify-center mt-1 mb-1">
{[1, 2, 3, 4, 5].map(star => (
<span key={star} className={`text-2xl ${star <= 4 ? 'text-[var(--aura-tertiary)]' : 'text-white/20'}`}>★</span>
))}
</div>
<p className="font-label-caps text-[10px] text-[var(--aura-chrome-mid)]">BASED ON 284 REVIEWS</p>
</div>

{/* Rating Distribution */}
<div className="flex-1 space-y-2">
{[5, 4, 3, 2, 1].map(i => (
<div key={i} className="flex items-center gap-3">
<span className="font-label-caps text-[10px] text-[var(--aura-chrome-mid)] uppercase tracking-wider w-8">{i} ★</span>
<div className="flex-1 h-2.5 bg-white/5 rounded-full overflow-hidden">
<div className="h-full bg-[var(--aura-tertiary)] rounded-full transition-all" style={{ width: `${RATING_DISTRIBUTION[5 - i]}%` }} />
</div>
<span className="font-label-caps text-[9px] text-[var(--aura-chrome-mid)] w-10 text-right">{RATING_DISTRIBUTION[5 - i]}%</span>
</div>
))}
</div>
</div>
</section>

{/* Filter Tabs */}
<div className="flex flex-wrap gap-2 mb-6">
{REVIEW_FILTERS.map(f => (
<button key={f} onClick={() => setActiveFilter(f)} className={`px-4 py-2 rounded-full font-label-caps text-label-caps text-xs transition-all active:scale-95 ${activeFilter === f ? 'bg-[var(--aura-tertiary)] text-[var(--aura-noir-deep)]' : 'bg-white/5 text-[var(--aura-chrome-mid)] hover:text-[var(--aura-chrome-bright)]'}`}>
{f}
</button>
))}
</div>

{/* Review Cards */}
<div className="space-y-4">
{REVIEWS.map(review => (
<article key={review.id} className="glass-panel rounded-xl p-5 md:p-6 transition-all hover:border-[var(--aura-tertiary)]/20">
<div className="flex items-start gap-4">
{/* Avatar */}
<div className="w-12 h-12 rounded-full bg-white/5 border border-white/10 overflow-hidden shrink-0" style={{ backgroundImage: `url(${review.avatar})`, backgroundSize: 'cover', backgroundPosition: 'center' }} role="img" aria-label={review.author} />

{/* Content */}
<div className="flex-1 min-w-0">
<div className="flex flex-wrap items-start justify-between gap-2">
<div>
<h4 className="font-body text-body text-[var(--aura-chrome-bright)]">{review.author}</h4>
<div className="flex items-center gap-2 mt-0.5">
<div className="flex gap-0.5">
{[1, 2, 3, 4, 5].map(star => (
<span key={star} className={`text-sm ${star <= review.rating ? 'text-[var(--aura-tertiary)]' : 'text-white/15'}`}>★</span>
))}
</div>
<span className="font-label-caps text-[9px] text-[var(--aura-chrome-mid)] border-l border-white/10 pl-2">{review.date}</span>
</div>
</div>
<span className="px-2.5 py-1 rounded-lg bg-white/5 border border-white/10 font-label-caps text-[9px] text-[var(--aura-chrome-mid)] uppercase tracking-wider shrink-0">
{review.product}
</span>
</div>
<p className="font-body text-sm text-[var(--aura-chrome-mid)] mt-3 leading-relaxed">{review.text}</p>
<div className="flex items-center gap-4 mt-4">
<button className="font-label-caps text-[10px] text-[var(--aura-chrome-mid)] hover:text-[var(--aura-tertiary)] transition-colors flex items-center gap-1">
👍 Helpful (23)
</button>
<button className="font-label-caps text-[10px] text-[var(--aura-chrome-mid)] hover:text-[var(--aura-tertiary)] transition-colors">🔗 Share</button>
</div>
</div>
</div>
</article>
))}
</div>

{/* Write Review */}
<section className="glass-panel rounded-2xl p-6 md:p-8 mt-8" style={{ background: 'linear-gradient(135deg, rgba(212,165,116,0.04) 0%, transparent 60%)' }}>
<h3 className="font-headline-md text-headline-md text-[var(--aura-chrome-bright)] mb-2">Write a Review / Viết đánh giá</h3>
<p className="font-body-sm text-sm text-[var(--aura-chrome-mid)] mb-4">Share your experience to help other connoisseurs. / Chia sẻ trải nghiệm của bạn.</p>

{!showForm ? (
<button onClick={() => setShowForm(true)} className="px-6 py-3 rounded-xl bg-[var(--aura-tertiary)] text-[var(--aura-noir-deep)] font-label-caps text-label-caps text-xs font-bold uppercase tracking-wider hover:brightness-110 active:scale-95 transition-all">
✍️ Start Writing / Bắt đầu viết
</button>
) : (
<div className="space-y-4">
<div>
<div className="flex gap-1 mb-1">
{[1, 2, 3, 4, 5].map(s => (
<button key={s} onMouseEnter={() => setHoveredStars(s)} onMouseLeave={() => setHoveredStars(null)} className="text-2xl transition-colors">
<span className={s <= (hoveredStars || 5) ? 'text-[var(--aura-tertiary)]' : 'text-white/15'}>★</span>
</button>
))}
</div>
</div>
<textarea className="w-full p-4 rounded-xl bg-white/5 border border-white/10 text-[var(--aura-chrome-bright)] font-body text-sm placeholder:text-white/20 focus:outline-none focus:border-[var(--aura-tertiary)]/40 transition-colors resize-none" rows={4} placeholder="Share your experience... / Chia sẻ trải nghiệm của bạn..." />
<div className="flex justify-end gap-3">
<button onClick={() => setShowForm(false)} className="px-5 py-2.5 rounded-lg glass-panel border border-white/10 font-label-caps text-xs text-[var(--aura-chrome-mid)] hover:text-[var(--aura-chrome-bright)] transition-all">Cancel</button>
<button className="px-5 py-2.5 rounded-lg bg-[var(--aura-tertiary)] text-[var(--aura-noir-deep)] font-label-caps text-xs font-bold uppercase tracking-wider hover:brightness-110 active:scale-95 transition-all">
Submit / Gửi
</button>
</div>
</div>
)}
</section>
</main>

{/* Footer */}
<PageFooter
brand="AURA CAFE"
socialLinks={['IG', 'FB', 'TT'].map(s => ({ label: s }))}
socialSize="sm"
legalLinks={['Privacy', 'Terms', 'Contact']}
copyLine="© 2024 AURA CAFE. ALL RIGHTS RESERVED."
/>
</div>
);
}
