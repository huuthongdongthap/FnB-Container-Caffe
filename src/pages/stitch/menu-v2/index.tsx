import { useState } from 'react';
import { PageHeader, PageFooter } from '@/components/stitch/StitchLayout';

const FILTERS = ['All', 'Coffee', 'Tea', 'Signature', 'Cold Brew'] as const;

type Filter = typeof FILTERS[number];

interface ProductItem {
  name: string;
  price: string;
  tag?: string;
  intensity?: number;
  sweetness?: number;
  caffeine?: number;
  spice?: number;
  desc: string;
  img: string;
}

const PRODUCTS: ProductItem[] = [
{ name: 'Midnight Espresso', price: '$6.50', tag: 'Featured', intensity: 9, sweetness: 2, caffeine: 10, desc: 'Dark, bold, unapologetic. / Đậm, mạnh, không nhượng bộ.', img: 'https://lh3.googleusercontent.com/aida-public/AB6AXuB_jlKo9X4D8qY-FPsCJIht8-bj_tP6A1R7wnp98lIVt_gJPs5_WxM8PrD7SnPhML_Uoc593rsG7p3GgFYf1aW_DkYhXN4BVzu0yMm5_NMgftU_z6rMijcFKziBuhYkJYtM70gdHa-I_iYKguT9s-chHuI2xGkVFIM9_FyqzGu3BXF-d2hzBnSc_aXl9xj_SB-B0pzfq-ZZueCJbYdpMa7-QverBBoonsy4h1wPjNWU5GWe-pzVaC4b_NTqGe5GQIrjkm_yBTosgw' },
{ name: 'Chrome Velvet Latte', price: '$8.00', sweetness: 4, caffeine: 5, desc: 'Silky chrome smoothness. / Nhẹ nhàng mượt mà chrome.', img: 'https://lh3.googleusercontent.com/aida-public/AB6AXuDTyG-lA1b0lMGI97x1xGuw2ZfTdC0wXbrcRTQSN4uSbXxlcg-rDGeY5Ai72s3el2m5ISca1jGlOp8ynHlfckqWNOl44l-COBcK_FHq6L_Ye0ncr7QaW8t7rBdVFKEF5AuQJDopMnqOvRsTPmP81vfflNSHvhpME9VhlmBKc-dRrlSDrHwkME-sEPe3VWjvHOVKUi0lT5_QuaImL4TchV3CZ1W0CPcVXa-XIjMzDfKVV06AqNgUukPKC47j55lJyrjuCm8Hp3n8Mg' },
{ name: 'Industrial Cold Brew', price: '$7.50', caffeine: 10, sweetness: 1, desc: '18-hour steeped patience. / 18 giờ chiết xuất kiên nhẫn.', img: 'https://lh3.googleusercontent.com/aida-public/AB6AXuATJHHuAIMu9E5_PP_UCAsux97RHHLmBVjU9qpfeFKiPyjVGv-l3EHUzAg_fgBj4CHPZIoqFJ_JPxLjrMD9vmUNiBcHwzhKpceGBurTX1i-Mr4TJe2K8m9-h_OQeQDrp9qOU7RoxxYVxl4wN4kRnRI8H6GnsLuuqCiVuvKRZEhL-w36h-xoGSFt94Hd96pNPYaSaZfLZoTpEYB_v9dP8oZyv1d5JoOjL2U75TvMupj4k1ZGB0dt4RpmItxKZcgkVZcCN63d5d3Aw' },
{ name: 'Bronze Chai', price: '$7.00', spice: 7, caffeine: 4, desc: 'Warm bronze spice complexity. / Hương vị gia vị đồng ấm.', img: 'https://lh3.googleusercontent.com/aida-public/AB6AXuB_jlKo9X4D8qY-FPsCJIht8-bj_tP6A1R7wnp98lIVt_gJPs5_WxM8PrD7SnPhML_Uoc593rsG7p3GgFYf1aW_DkYhXN4BVzu0yMm5_NMgftU_z6rMijcFKziBuhYkJYtM70gdHa-I_iYKguT9s-chHuI2xGkVFIM9_FyqzGu3BXF-d2hzBnSc_aXl9xj_SB-B0pzfq-ZZueCJbYdpMa7-QverBBoonsy4h1wPjNWU5GWe-pzVaC4b_NTqGe5GQIrjkm_yBTosgw' },
];

export default function DigitalMenu() {
const [activeFilter, setActiveFilter] = useState<Filter>('All');

return (
<div className="min-h-screen bg-[var(--aura-noir-deep)] text-[var(--aura-chrome-bright)]">
{/* Top Nav */}
<PageHeader
brand="AURA CAFE"
scrollEffect
rightContent={
<>
<nav className="hidden md:flex items-center gap-8">
{["Menu / Thực đơn", "Events / Sự kiện", "Story / Câu chuyện", "Contact"].map(link => (
<a key={link} href="#" className="font-label-caps text-label-caps text-[var(--aura-chrome-mid)] hover:text-[var(--aura-tertiary)] transition-colors text-xs uppercase tracking-widest">{link}</a>
))}
</nav>
<button className="bg-[var(--aura-tertiary)] text-[var(--aura-noir-deep)] px-5 py-2 rounded-full font-headline-sm uppercase tracking-widest text-xs hover:brightness-110 active:scale-95 transition-all">
Book Now / Đặt ngay
</button>
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
{PRODUCTS.map(product => {
const gaugeVal = product.intensity ?? product.sweetness ?? product.caffeine ?? product.spice ?? 5;
return (
<div key={product.name} className="glass-panel rounded-2xl overflow-hidden transition-all duration-300 hover:-translate-y-1 group">
<div className="relative aspect-[4/5] overflow-hidden bg-white/5">
<div className="w-full h-full bg-cover bg-center group-hover:scale-105 transition-transform duration-700" style={{ backgroundImage: `url(${product.img})` }} role="img" aria-label={product.name} />
<div className="absolute inset-0 bg-gradient-to-t from-black/70 via-transparent to-transparent" />
{product.tag && <span className="absolute top-3 left-3 px-2.5 py-1 rounded-lg bg-[var(--aura-tertiary)] text-[var(--aura-noir-deep)] font-label-caps text-[9px] uppercase tracking-wider font-bold" style={{ boxShadow: '0 0 10px rgba(212,165,116,0.3)' }}>⭐ {product.tag}</span>}
<div className="absolute bottom-3 left-4 right-4">
<h3 className="font-headline-md text-headline-md text-[var(--aura-chrome-bright)] group-hover:text-[var(--aura-tertiary)] transition-colors">{product.name}</h3>
<p className="font-body text-xs text-[var(--aura-chrome-mid)] mt-0.5 line-clamp-1">{product.desc}</p>
<span className="font-label-caps text-label-caps text-[var(--aura-tertiary)]">{product.price}</span>
</div>
</div>
<div className="p-4 space-y-2">
<div>
<div className="flex justify-between font-label-caps text-[9px] text-[var(--aura-chrome-mid)] uppercase tracking-wider mb-1">
<span>Intensity / Cường độ</span><span>{gaugeVal}/10</span>
</div>
<div className="h-1.5 w-full bg-white/5 rounded-full overflow-hidden">
<div className="h-full bg-[#D4A574] rounded-full" style={{ width: `${gaugeVal * 10}%` }} />
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

{/* Craft Section */}
<section className="py-20 px-5">
<div className="max-w-4xl mx-auto glass-panel rounded-2xl p-8 md:p-12 text-center">
<h2 className="font-display text-3xl md:text-4xl text-[var(--aura-chrome-bright)] italic mb-4" style={{ fontFamily: 'var(--font-display, "Libre Caslon Text", serif)' }}>The Craft / Nghệ thuật</h2>
<p className="font-body text-body text-[var(--aura-chrome-mid)] max-w-2xl mx-auto">
Precision-brewed at 0.5 Micron filtration. 94°C optimal extraction. / Chiết xuất ở 0.5 Micron. Nhiệt độ tối ưu 94°C.
</p>
<div className="flex justify-center gap-8 mt-8">
{[{ label: 'Filtration / Lọc', value: '0.5 Micron' }, { label: 'Brew / Pha', value: '94°C' }, { label: 'Extraction / Chiết', value: '18s' }].map(spec => (
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
socialLinks={["IG", "FB", "TT"].map(s => ({ label: s }))}
socialSize="sm"
copyLine="© 2024 AURA CAFE. Brush Bronze. / Đồng cọ."
/>
</div>
);
}
