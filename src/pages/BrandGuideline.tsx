import { SEOHead } from '@/components/shared/SEOHead';
import { Breadcrumbs } from '@/components/shared/Breadcrumbs';
import { ColorPalette } from '@/components/brand/ColorPalette';
import { TypographyShowcase } from '@/components/brand/TypographyShowcase';
import { LogoUsage } from '@/components/brand/LogoUsage';
import { BaziExplanation } from '@/components/brand/BaziExplanation';
import { ZoneColors } from '@/components/brand/ZoneColors';

const BREADCRUMBS = [
 { label: 'Trang chủ', to: '/' },
 { label: 'Brand Guideline', to: '/brand-guideline' },
];

const NOIR_COLORS = [
 { name: 'Noir Void', token: '--aura-noir-void', hex: '#050D1A', category: 'Noir Surfaces' },
 { name: 'Noir Deep', token: '--aura-noir-deep', hex: '#0A1A2E', category: 'Noir Surfaces' },
 { name: 'Noir Mid', token: '--aura-noir-mid', hex: '#1A2A4E', category: 'Noir Surfaces' },
 { name: 'Noir Bright', token: '--aura-noir-bright', hex: '#25406B', category: 'Noir Surfaces' },
 { name: 'Noir Steel', token: '--aura-noir-steel', hex: '#334155', category: 'Noir Surfaces' },
];

const CHROME_COLORS = [
 { name: 'Chrome Bright', token: '--aura-chrome-bright', hex: '#E8EEF3', category: 'Chrome & Silver' },
 { name: 'Chrome Master', token: '--aura-chrome-master', hex: '#C9D6DF', category: 'Chrome & Silver' },
 { name: 'Chrome Mid', token: '--aura-chrome-mid', hex: '#6B9FB8', category: 'Chrome & Silver' },
 { name: 'Steel Matte', token: '--aura-steel-matte', hex: '#3A6B80', category: 'Chrome & Silver' },
 { name: 'Aura Neon Glow', token: '--aura-neon-glow', hex: '#6B9FB8', category: 'Chrome & Silver' },
];

const FOREST_COLORS = [
 { name: 'Forest Deep', token: '--aura-forest-deep', hex: '#1A2D1F', category: 'Forest Green (Bar)' },
 { name: 'Forest Primary', token: '--aura-forest-primary', hex: '#2D5A3D', category: 'Forest Green (Bar)' },
 { name: 'Forest Light', token: '--aura-forest-light', hex: '#4A7C59', category: 'Forest Green (Bar)' },
 { name: 'Forest Pale', token: '--aura-forest-pale', hex: '#A8C5A0', category: 'Forest Green (Bar)' },
];

const FONTS_DATA = [
 { name: 'Cormorant Garamond', category: 'Display', usage: 'Tiêu đề H1/H2, hero, wordmark. Letter-spacing rộng 4-12px.' },
 { name: 'Space Grotesk', category: 'Body', usage: 'Body text, navigation, button, form. Weight 400-700. Line-height 1.6-1.8.' },
 { name: 'Plus Jakarta Sans', category: 'Utility', usage: 'Button, label, small text, uppercase sections.' },
];

const MATERIALS = [
 { name: 'Corten Steel', desc: 'Vỏ container 20-40ft. Để rỉ tự nhiên cho lớp patina màu nâu đất. Không sơn phủ trong 3 năm đầu.', spec: 'Finish: weathered natural' },
 { name: 'Walnut Oak Wood', desc: 'Bàn, quầy bar, kệ menu. Dầu tự nhiên. Khắc laser emblem trên góc bàn signature.', spec: 'Oil: Osmo Polyx' },
 { name: 'Smoked Brass', desc: 'Tay nắm, khung đèn, chân bàn. Patina tối, không đánh bóng.', spec: 'Finish: antique smoked' },
 { name: 'Black Terrazzo', desc: 'Sàn rooftop, đế quầy. Viên sỏi trắng-bạc rải trên nền xi măng đen mài polish.', spec: 'Size: 600x600mm' },
];

const BRAND_RULES_DO = [
 'Dùng Cormorant Garamond cho H1/H2, Space Grotesk cho body.',
 'Giữ nền đen sâu (#1A1A2E), accent chrome/bạc (#C9D6DF).',
 'Letter-spacing rộng 4-12px cho uppercase title.',
 'Radius 16px cho card, 50px (pill) cho button.',
 'Shadow mềm: 0 8px 30px rgba(0,0,0,0.12).',
];

const BRAND_RULES_DONT = [
 'Không dùng pastel, màu nhạt, gradient nhiều màu.',
 'Không dùng font script, comic, handwriting.',
 'Không xoay/nghiêng logo, không đổi màu logo.',
 'Không radius > 24px (trừ pill button).',
 'Không dùng ảnh HDR chói, ánh sáng lạnh > 4000K.',
];

export function BrandGuideline() {
 return (
 <>
 <SEOHead
 title="Brand Guideline | AURA CAFE — 水 Noir Lounge"
 description="Brand guideline chính thức của AURA CAFE — Container Rooftop Café Sa Đéc. Element DNA: 水 Thủy Noir Lounge."
 ogTitle="Brand Guideline | AURA CAFE"
 ogDescription="Brand guideline chính thức — Element DNA 水 Thủy Noir Lounge"
 ogType="website"
 />

 <main id="main-content" className="bg-[#0A1A2E] text-[#e4e2e4] mx-auto max-w-6xl px-4 py-8">
 {/* Breadcrumbs */}
 <Breadcrumbs items={BREADCRUMBS} className="mb-8" />

 {/* Hero */}
 <section className="mb-16 text-center">
 <div className="mb-2 font-utility text-xs font-semibold uppercase tracking-[4px] text-[#b8c7e2]">
 Brand Guideline &middot; v1.0
 </div>
 <h1 className="font-[EB_Garamond,serif] text-5xl font-bold text-[#e4e2e4] md:text-7xl">
 Aura Space
 </h1>
 <p className="mx-auto mt-4 max-w-3xl text-[#b8c7e2]">
 Container Rooftop Café tại Sa Đéc, Đồng Tháp &mdash; nơi gặp gỡ giữa ánh bạc chrome,
 thép công nghiệp và bầu trời đêm. Element DNA: <code className="rounded bg-[#b8c7e2]/10 px-2 py-0.5 font-mono text-xs text-[#b8c7e2]">水 Thủy — Noir Lounge</code>.
 </p>
 <div className="mt-4 flex justify-center gap-4 text-xs text-[#b8c7e2]">
 <span>Version 1.0.0</span>
 <span>2026-04-20</span>
 <span>bazi-mcp</span>
 </div>
 </section>

 {/* Section: Bazi Foundation */}
 <section className="mb-16 scroll-mt-20" id="bazi-foundation">
 <BaziExplanation />
 </section>

 {/* Section: Logo */}
 <section className="mb-16 scroll-mt-20" id="logo">
 <LogoUsage />
 </section>

 {/* Section: Colors */}
 <section className="mb-16 scroll-mt-20" id="colors">
 <div className="mb-8">
 <h2 className="font-[EB_Garamond,serif] text-2xl font-bold text-[#e4e2e4]">
 Color Palette
 </h2>
 <p className="mt-2 text-[#b8c7e2]">
 Noir Lounge 水 Thủy &mdash; nền đen sâu + bạc ánh kim sang trọng.
 Click vào swatch để copy mã màu. Tất cả đều là CSS custom property trong
 <code className="ml-1 rounded bg-[#b8c7e2]/10 px-2 py-0.5 font-mono text-xs text-[#b8c7e2]">css/brand-tokens.css</code>.
 </p>
 </div>

 <ColorPalette colors={[...NOIR_COLORS, ...CHROME_COLORS, ...FOREST_COLORS]} categories />
 </section>

 {/* Section: Typography */}
 <section className="mb-16 scroll-mt-20" id="typography">
 <div className="mb-8">
 <h2 className="font-[EB_Garamond,serif] text-2xl font-bold text-[#e4e2e4]">
 Typography
 </h2>
 <p className="mt-2 text-[#b8c7e2]">
 Ba font chính: Cormorant Garamond (tiêu đề sang trọng), Space Grotesk (thân văn bản hiện đại),
 Plus Jakarta Sans (button, label, utility).
 </p>
 </div>

 <TypographyShowcase fonts={FONTS_DATA} />

 {/* Type Scale Table */}
 <div className="mt-8 overflow-x-auto rounded-2xl border border-white/[0.08] bg-white/[0.03] backdrop-blur-md border border-white/[0.08] rounded-xl">
 <table className="w-full text-left text-sm">
 <thead>
 <tr className="border-b border-white/[0.08]">
 <th className="px-6 py-3 font-utility text-xs font-semibold uppercase tracking-wider text-[#b8c7e2]">Token</th>
 <th className="px-6 py-3 font-utility text-xs font-semibold uppercase tracking-wider text-[#b8c7e2]">Size</th>
 <th className="px-6 py-3 font-utility text-xs font-semibold uppercase tracking-wider text-[#b8c7e2]">Usage</th>
 </tr>
 </thead>
 <tbody className="divide-y divide-border">
 {[
 { token: '--aura-fs-display', size: 'clamp(48px, 8vw, 80px)', usage: 'Hero titles' },
 { token: '--aura-fs-hero', size: 'clamp(32px, 5vw, 56px)', usage: 'Section hero' },
 { token: '--aura-fs-h1', size: 'clamp(28px, 4vw, 42px)', usage: 'Page titles' },
 { token: '--aura-fs-h2', size: 'clamp(22px, 3vw, 32px)', usage: 'Section heads' },
 { token: '--aura-fs-h3', size: '20px', usage: 'Card heads' },
 { token: '--aura-fs-body', size: '16px', usage: 'Body text' },
 { token: '--aura-fs-sm', size: '14px', usage: 'Small text, buttons' },
 { token: '--aura-fs-label', size: '11px', usage: 'Uppercase labels' },
 ].map((row) => (
 <tr key={row.token} className="hover:bg-[#b8c7e2]/5">
 <td className="px-6 py-3 font-mono text-xs text-[#b8c7e2]">{row.token}</td>
 <td className="px-6 py-3 text-[#e4e2e4]">{row.size}</td>
 <td className="px-6 py-3 text-[#b8c7e2]">{row.usage}</td>
 </tr>
 ))}
 </tbody>
 </table>
 </div>
 </section>

 {/* Section: Materials */}
 <section className="mb-16 scroll-mt-20" id="materials">
 <div className="mb-8">
 <h2 className="font-[EB_Garamond,serif] text-2xl font-bold text-[#e4e2e4]">
 Materials &amp; Texture
 </h2>
 <p className="mt-2 text-[#b8c7e2]">
 Không gian được xây từ ngôn ngữ vật liệu công nghiệp sang trọng.
 </p>
 </div>

 <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
 {MATERIALS.map((material) => (
 <div key={material.name} className="rounded-2xl border border-white/[0.08] bg-white/[0.03] backdrop-blur-md border border-white/[0.08] rounded-xl p-6">
 <h3 className="font-[EB_Garamond,serif] text-lg font-semibold text-[#e4e2e4]">{material.name}</h3>
 <p className="mt-2 text-sm text-[#b8c7e2]">{material.desc}</p>
 <p className="mt-3 text-xs text-[#b8c7e2]">{material.spec}</p>
 </div>
 ))}
 </div>
 </section>

 {/* Section: Brand Voice */}
 <section className="mb-16 scroll-mt-20" id="brand-voice">
 <div className="mb-8">
 <h2 className="font-[EB_Garamond,serif] text-2xl font-bold text-[#e4e2e4]">
 Brand Voice &amp; Rules
 </h2>
 <p className="mt-2 text-[#b8c7e2]">
 Giọng thương hiệu: bình tĩnh, tối giản, có nhịp nội tâm. Dùng tiếng Việt chuẩn, không teencode.
 </p>
 </div>

 <div className="grid gap-6 md:grid-cols-2">
 <div className="rounded-2xl border border-green-500/20 bg-green-500/5 p-6">
 <h3 className="font-[EB_Garamond,serif] text-lg font-semibold text-green-600">DO &middot; Nên làm</h3>
 <ul className="mt-3 space-y-2">
 {BRAND_RULES_DO.map((rule) => (
 <li key={rule} className="flex items-start gap-2 text-sm text-[#e4e2e4]">
 <span className="mt-0.5 shrink-0 text-green-500" aria-hidden="true">&#10003;</span>
 {rule}
 </li>
 ))}
 </ul>
 </div>
 <div className="rounded-2xl border border-destructive/20 bg-destructive/5 p-6">
 <h3 className="font-[EB_Garamond,serif] text-lg font-semibold text-red-400">DON&apos;T &middot; Tránh làm</h3>
 <ul className="mt-3 space-y-2">
 {BRAND_RULES_DONT.map((rule) => (
 <li key={rule} className="flex items-start gap-2 text-sm text-[#e4e2e4]">
 <span className="mt-0.5 shrink-0 text-red-400" aria-hidden="true">&#10007;</span>
 {rule}
 </li>
 ))}
 </ul>
 </div>
 </div>

 <div className="mt-6 rounded-2xl border border-white/[0.1] bg-[#b8c7e2]/5 p-6 text-center">
 <p className="font-[EB_Garamond,serif] text-xl font-semibold text-[#e4e2e4]">
 &ldquo;Nhâm nhi một khoảng lặng.&rdquo;
 </p>
 <p className="mt-1 text-sm text-[#b8c7e2]">
 Slogan phụ: &ldquo;Container trên mây &middot; Cà phê dưới sao.&rdquo;
 </p>
 </div>
 </section>

 {/* Section: Zone Colors */}
 <section className="mb-16 scroll-mt-20" id="zone-colors">
 <ZoneColors />
 </section>
 </main>
 </>
 );
}
