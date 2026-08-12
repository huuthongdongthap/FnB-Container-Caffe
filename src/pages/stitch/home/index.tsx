import { useState, useEffect } from 'react';
import { PageHeader, PageFooter } from '@/components/stitch/StitchLayout';

const FEATURES = [
{ icon: '\u{1F3AD}', title: 'Industrial Roots', desc: 'Raw concrete, polished steel, and warm bronze accents. / Bê tông thô, thép đánh bóng, đồng ấm.', badge: '' },
{ icon: '☕', title: 'Artisan Roasts', desc: 'Precision-brewed single-origin coffees. / Cà phê single-origin chiết xuất chính xác.', badge: 'Signature / Đặc trưng' },
{ icon: '\u{1F319}', title: 'Lounge Atmosphere', desc: 'Nocturnal luxury for the modern connoisseur. / Sang trọng đêm cho người sành.', badge: '' },
] as const;

const SOCIAL_LINKS = ['IG', 'FB', 'TT'] as const;

export default function LuxuryLandingHero() {
const [scrolled, setScrolled] = useState(false);
const [timeLeft, setTimeLeft] = useState({ h: 0, m: 0, s: 0 });

useEffect(() => {
const handleScroll = () => setScrolled(window.scrollY > 60);
window.addEventListener('scroll', handleScroll, { passive: true });
return () => window.removeEventListener('scroll', handleScroll);
}, []);

// Live clock countdown to midnight
useEffect(() => {
const timer = setInterval(() => {
const now = new Date();
const midnight = new Date(now); midnight.setHours(24, 0, 0, 0);
const diff = midnight.getTime() - now.getTime();
setTimeLeft({ h: Math.floor(diff / 3600000), m: Math.floor((diff % 3600000) / 60000), s: Math.floor((diff % 60000) / 1000) });
}, 1000);
return () => clearInterval(timer);
}, []);

return (
<div className="min-h-screen bg-[var(--aura-noir-deep)] text-[var(--aura-chrome-bright)]">
{/* Ambient background */}
<div className="fixed inset-0 -z-10 pointer-events-none">
<div className="absolute inset-0 opacity-20" style={{ background: 'radial-gradient(ellipse at 50% 30%, #1a2740 0%, transparent 70%)' }} />
<canvas id="shader-bg" className="absolute inset-0 w-full h-full opacity-30" />
</div>

{/* Top Nav */}
<PageHeader
brand="AURA CAFE"
scrollEffect
rightContent={
<>
<nav className="hidden md:flex items-center gap-8">
{['Menu / Thực đơn', 'Events / Sự kiện', 'Story / Câu chuyện', 'Contact'].map(link => (
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
<section className="relative min-h-screen flex items-center justify-center px-6">
<div className="text-center max-w-4xl">
<span className="font-label-caps text-label-caps text-[var(--aura-tertiary)] uppercase tracking-[0.2em] block mb-4">Est. 2024 • Industrial Luxury</span>
<h1 className="font-display text-5xl md:text-7xl lg:text-8xl text-[var(--aura-chrome-bright)] italic leading-tight mb-6" style={{ fontFamily: 'var(--font-display, "Libre Caslon Text", serif)' }}>
The Art of the<br />Nocturnal Pour
</h1>
<div className="glass-panel rounded-2xl p-6 md:p-8 max-w-2xl mx-auto mb-10">
<p className="font-body text-body text-[var(--aura-chrome-mid)] leading-relaxed">
Where industrial architecture meets artisan coffee. Each cup is a ritual, each space a sanctuary for the nocturnal connoisseur.
<br />
<span className="text-[var(--aura-tertiary)]">Nơi kiến trúc công nghiệp gặp gỡ cà phê thủ công. Mỗi ly là nghi lễ, mỗi không gian là thiền đường.</span>
</p>
</div>
<div className="flex flex-col sm:flex-row gap-4 justify-center">
<button className="px-8 py-4 rounded-full bg-[var(--aura-tertiary)] text-[var(--aura-noir-deep)] font-headline-md uppercase tracking-widest hover:brightness-110 active:scale-95 transition-all" style={{ boxShadow: '0 20px 25px -5px rgba(212,165,116,0.3)' }}>
Book Your Table / Đặt bàn
</button>
<button className="px-8 py-4 rounded-full glass-panel border border-white/10 text-[var(--aura-chrome-bright)] font-headline-md uppercase tracking-widest hover:border-[var(--aura-tertiary)]/50 active:scale-95 transition-all">
Explore Menu / Xem thực đơn
</button>
</div>
<div className="mt-12 font-label-caps text-[10px] text-[var(--aura-chrome-mid)] uppercase tracking-widest">
Opens in {String(timeLeft.h).padStart(2, '0')}:{String(timeLeft.m).padStart(2, '0')}:{String(timeLeft.s).padStart(2, '0')} · Currently Open
</div>
</div>
</section>

{/* Features Bento Grid */}
<section className="py-24 px-5 max-w-7xl mx-auto">
<div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
{FEATURES.map(feature => (
<div key={feature.title} className="glass-panel rounded-2xl p-8 transition-all hover:-translate-y-1 hover:border-[var(--aura-tertiary)]/20 group">
<div className="text-4xl mb-4">{feature.icon}</div>
<h3 className="font-headline-md text-headline-md text-[var(--aura-chrome-bright)] mb-3 italic" style={{ fontFamily: 'var(--font-display, serif)' }}>{feature.title}</h3>
<p className="font-body text-body text-[var(--aura-chrome-mid)] text-sm leading-relaxed">{feature.desc}</p>
{feature.badge && (
<span className="inline-block mt-4 px-3 py-1 rounded-full bg-[var(--aura-tertiary)]/15 text-[var(--aura-tertiary)] font-label-caps text-[10px] uppercase tracking-wider border border-[var(--aura-tertiary)]/30">
{feature.badge}
</span>
)}
</div>
))}
</div>
</section>

{/* Visual Teaser */}
<section className="relative h-[60vh] min-h-[400px] overflow-hidden">
<div className="absolute inset-0 bg-cover bg-center" style={{ backgroundImage: `url('https://lh3.googleusercontent.com/aida-public/AB6AXuB_jlKo9X4D8qY-FPsCJIht8-bj_tP6A1R7wnp98lIVt_gJPs5_WxM8PrD7SnPhML_Uoc593rsG7p3GgFYf1aW_DkYhXN4BVzu0yMm5_NMgftU_z6rMijcFKziBuhYkJYtM70gdHa-I_iYKguT9s-chHuI2xGkVFIM9_FyqzGu3BXF-d2hzBnSc_aXl9xj_SB-B0pzfq-ZZueCJbYdpMa7-QverBBoonsy4h1wPjNWU5GWe-pzVaC4b_NTqGe5GQIrjkm_yBTosgw')` }} role="img" aria-label="Aura Cafe interior with bronze industrial lighting" />
<div className="absolute inset-0 bg-gradient-to-r from-[var(--aura-noir-deep)]/80 via-[var(--aura-noir-deep)]/40 to-transparent" />
<div className="relative z-10 flex items-center h-full max-w-7xl mx-auto px-6">
<div className="max-w-lg">
<h2 className="font-display text-4xl md:text-5xl text-[var(--aura-chrome-bright)] italic mb-4" style={{ fontFamily: 'var(--font-display, "Libre Caslon Text", serif)' }}>
The Night is<br />Your Canvas
</h2>
<p className="font-body text-body text-[var(--aura-chrome-mid)]">
Experience sensory darkness. / Trải nghiệm bóng tối giác quan.
</p>
</div>
</div>
</section>

{/* Footer */}
<PageFooter
brand="AURA CAFE"
socialLinks={SOCIAL_LINKS.map(s => ({ label: s }))}
socialSize="sm"
copyLine="© 2024 AURA CAFE. Brush Bronze. / Đồng cọ."
/>
</div>
);
}
