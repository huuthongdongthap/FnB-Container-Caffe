import { useState } from 'react';
import { PageHeader, PageFooter } from '@/components/stitch/StitchLayout';

const FILTERS = ['All', 'Coffee', 'Tea', 'Signature', 'Cold Brew'] as const;

type Filter = typeof FILTERS[number];

interface Product {
name: string;
price: string;
tag?: string;
intensity?: number;
sweetness?: number;
caffeine?: number;
spice?: number;
img: string;
}

const PRODUCTS: readonly Product[] = [
{ name: 'Midnight Espresso', price: '$6.50', tag: 'Featured', intensity: 9, sweetness: 2, caffeine: 10, img: 'https://lh3.googleusercontent.com/aida-public/AB6AXuB_jlKo9X4D8qY-FPsCJIht8-bj_tP6A1R7wnp98lIVt_gJPs5_WxM8PrD7SnPhML_Uoc593rsG7p3GgFYf1aW_DkYhXN4BVzu0yMm5_NMgftU_z6rMijcFKziBuhYkJYtM70gdHa-I_iYKguT9s-chHuI2xGkVFIM9_FyqzGu3BXF-d2hzBnSc_aXl9xj_SB-B0pzfq-ZZueCJbYdpMa7-QverBBoonsy4h1wPjNWU5GWe-pzVaC4b_NTqGe5GQIrjkm_yBTosgw' },
{ name: 'Chrome Velvet Latte', price: '$8.00', sweetness: 4, caffeine: 5, img: 'https://lh3.googleusercontent.com/aida-public/AB6AXuDTyG-lA1b0lMGI97x1xGuw2ZfTdC0wXbrcRTQSN4uSbXxlcg-rDGeY5Ai72s3el2m5ISca1jGlOp8ynHlfckqWNOl44l-COBcK_FHq6L_Ye0ncr7QaW8t7rBdVFKEF5AuQJDopMnqOvRsTPmP81vfflNSHvhpME9VhlmBKc-dRrlSDrHwkME-sEPe3VWjvHOVKUi0lT5_QuaImL4TchV3CZ1W0CPcVXa-XIjMzDfKVV06AqNgUukPKC47j55lJyrjuCm8Hp3n8Mg' },
{ name: 'Industrial Cold Brew', price: '$7.50', caffeine: 10, sweetness: 1, img: 'https://lh3.googleusercontent.com/aida-public/AB6AXuATJHHuAIMu9E5_PP_UCAsux97RHHLmBVjU9qpfeFKiPyjVGv-l3EHUzAg_fgBj4CHPZIoqFJ_JPxLjrMD9vmUNiBcHwzhKpceGBurTX1i-Mr4TJe2K8m9-h_OQeQDrp9qOU7RoxxYVxl4wN4kRnRI8H6GnsLuuqCiVuvKRZEhL-w36h-xoGSFt94Hd96pNPYaSaZfLZoTpEYB_v9dP8oZyv1d5JoOjL2U75TvMupj4k1ZGB0dt4RpmItxKZcgkVZcCN63d5d3Aw' },
{ name: 'Bronze Chai', price: '$7.00', spice: 7, caffeine: 4, img: 'https://lh3.googleusercontent.com/aida-public/AB6AXuB_jlKo9X4D8qY-FPsCJIht8-bj_tP6A1R7wnp98lIVt_gJPs5_WxM8PrD7SnPhML_Uoc593rsG7p3GgFYf1aW_DkYhXN4BVzu0yMm5_NMgftU_z6rMijcFKziBuhYkJYtM70gdHa-I_iYKguT9s-chHuI2xGkVFIM9_FyqzGu3BXF-d2hzBnSc_aXl9xj_SB-B0pzfq-ZZueCJbYdpMa7-QverBBoonsy4h1wPjNWU5GWe-pzVaC4b_NTqGe5GQIrjkm_yBTosgw' },
] as const;

export default function DigitalMenu2() {
const [activeFilter, setActiveFilter] = useState<Filter>('All');
const [hoveredId, setHoveredId] = useState<number | null>(null);

return (
<div className="min-h-screen bg-[var(--aura-noir-deep)] text-[var(--aura-chrome-bright)]">
{/* Top Nav */}
<PageHeader
brand="AURA CAFE"
rightContent={
<>
<button className="text-[var(--aura-chrome-mid)] hover:text-[var(--aura-tertiary)] transition-colors">🔍</button>
<button className="text-[var(--aura-tertiary)]">📅</button>
<span className="font-label-caps text-[10px] text-[var(--aura-chrome-mid)] uppercase tracking-widest hidden sm:inline">Reserve / Đặt chỗ</span>
</>
}
/>

{/* Hero */}
<section className="pt-16 relative overflow-hidden">
<div className="max-w-7xl mx-auto px-5 py-16 md:py-24">
<div className="text-center mb-12">
<span className="font-label-caps text-label-caps text-[var(--aura-tertiary)] uppercase tracking-[0.2em] block mb-3">The Digital Reserve</span>
<h1 className="font-display text-4xl md:text-6xl text-[var(--aura-chrome-bright)] italic" style={{ fontFamily: 'var(--font-display, "Libre Caslon Text", serif)' }}>
Precision • Darkness • Luxury
</h1>
<p className="font-body text-body text-[var(--aura-chrome-mid)] mt-4 max-w-xl mx-auto">
Every brew engineered for the nocturnal palate. / Mỗi ly được tạo ra cho khứu giác đêm.
</p>
</div>

{/* Filters */}
<div className="flex flex-wrap justify-center gap-2 mb-10">
{FILTERS.map(f => (
<button key={f} onClick={() => setActiveFilter(f)} className={`px-4 py-2 rounded-full font-label-caps text-label-caps text-xs transition-all active:scale-95 ${activeFilter === f ? 'bg-[var(--aura-tertiary)] text-[var(--aura-noir-deep)]' : 'bg-white/5 text-[var(--aura-chrome-mid)] hover:text-[var(--aura-chrome-bright)]'}`}>
{f}
</button>
))}
</div>

{/* Product Grid */}
<div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
{PRODUCTS.map((product, i) => {
const meta = product as { intensity?: number; sweetness?: number; caffeine?: number; spice?: number };
const gaugeValue = meta.intensity ?? meta.sweetness ?? meta.caffeine ?? meta.spice ?? 5;
return (
<div key={product.name} className="glass-panel rounded-2xl overflow-hidden transition-all duration-300 hover:-translate-y-1 hover:border-[var(--aura-tertiary)]/30 group" onMouseEnter={() => setHoveredId(i)} onMouseLeave={() => setHoveredId(null)}>
<div className="relative aspect-[4/5] overflow-hidden bg-white/5">
<div className="w-full h-full bg-cover bg-center group-hover:scale-105 transition-transform duration-700" style={{ backgroundImage: `url(${(product as Product & { desc?: string }).img})` }} role="img" aria-label={product.name} />
<div className="absolute inset-0 bg-gradient-to-t from-black/70 via-transparent to-transparent" />
{product.tag && <span className="absolute top-3 left-3 px-2.5 py-1 rounded-lg bg-[var(--aura-tertiary)] text-[var(--aura-noir-deep)] font-label-caps text-[9px] uppercase tracking-wider font-bold" style={{ boxShadow: '0 0 10px rgba(212,165,116,0.3)' }}>⭐ {product.tag}</span>}
<div className="absolute bottom-3 left-4 right-4">
<h3 className="font-headline-md text-headline-md text-[var(--aura-chrome-bright)] group-hover:text-[var(--aura-tertiary)] transition-colors">{product.name}</h3>
<div className="flex items-center justify-between mt-1">
<span className="font-label-caps text-label-caps text-[var(--aura-tertiary)]">{product.price}</span>
</div>
</div>
</div>
<div className="p-4 space-y-2">
{/* Gauge */}
<div>
<div className="flex justify-between font-label-caps text-[9px] text-[var(--aura-chrome-mid)] uppercase tracking-wider mb-1">
<span>Intensity / Cường độ</span><span>{gaugeValue}/10</span>
</div>
<div className="h-1.5 w-full bg-white/5 rounded-full overflow-hidden">
<div className="h-full bg-[#D4A574] rounded-full transition-all" style={{ width: `${gaugeValue * 10}%` }} />
</div>
</div>
<button className="w-full py-2.5 rounded-xl bg-gradient-to-r from-[#D4A574] to-[#B8862D] text-[var(--aura-noir-deep)] font-label-caps text-label-caps text-xs font-bold uppercase tracking-wider hover:brightness-110 active:scale-95 transition-all" style={{ boxShadow: '0 2px 8px rgba(0,0,0,0.2)' }}>
Add to Order / Thêm
</button>
</div>
</div>
);
})}
</div>
</div>
</section>

{/* The Craft Section */}
<section className="py-20 px-5">
<div className="max-w-4xl mx-auto glass-panel rounded-2xl p-8 md:p-12 text-center" onMouseMove={e => {
const card = (e.target as HTMLElement).closest('.glass-panel');
if (!card) return;
const rect = card.getBoundingClientRect();
const x = e.clientX - rect.left, y = e.clientY - rect.top;
(card as HTMLElement).style.transform = `perspective(1000px) rotateX(${((y - rect.height / 2) / 40).toFixed(2)}deg) rotateY(${((x - rect.width / 2) / 40).toFixed(2)}deg)`;
}} onMouseLeave={e => { const card = (e.target as HTMLElement).closest('.glass-panel'); if (card) (card as HTMLElement).style.transform = ''; }}>
<h2 className="font-display text-3xl md:text-4xl text-[var(--aura-chrome-bright)] italic mb-4" style={{ fontFamily: 'var(--font-display, "Libre Caslon Text", serif)' }}>The Craft / Nghệ thuật</h2>
<p className="font-body text-body text-[var(--aura-chrome-mid)] max-w-2xl mx-auto">
Precision-brewed at 0.5 Micron filtration. 94°C optimal extraction. / Chiết xuất ở 0.5 Micron. Nhiệt độ tối ưu 94°C.
</p>
<div className="flex justify-center gap-8 mt-8">
{[{ label: 'Filtration / Lọc', value: '0.5 Micron' }, { label: 'Temperature / Nhiệt', value: '94°C' }, { label: 'Extraction / Chiết', value: '18s' }].map(spec => (
<div key={spec.label}>
<p className="font-headline-md text-headline-md text-[var(--aura-tertiary)]">{spec.value}</p>
<p className="font-label-caps text-[10px] text-[var(--aura-chrome-mid)] uppercase tracking-wider">{spec.label}</p>
</div>
))}
</div>
</div>
</section>

{/* Footer */}
<PageFooter
brand="AURA CAFE"
socialLinks={['IG', 'FB', 'TT'].map(s => ({ label: s }))}
socialSize="sm"
copyLine="© 2024 AURA CAFE. Brush Bronze. / Đồng cọ."
/>
</div>
);
}
