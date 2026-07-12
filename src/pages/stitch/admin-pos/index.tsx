import { useState } from 'react';

const CATEGORIES = ['All / Tất cả', 'Coffee', 'Tea', 'Signature', 'Pastries', 'Brunch', 'Merchandise'] as const;

type Category = typeof CATEGORIES[number];

interface NavItem { id: string; icon: string }

const MENU_ITEMS = [
  { name: 'Midnight Espresso', price: '$6.50', img: 'https://lh3.googleusercontent.com/aida-public/AB6AXuB_jlKo9X4D8qY-FPsCJIht8-bj_tP6A1R7wnp98lIVt_gJPs5_WxM8PrD7SnPhML_Uoc593rsG7p3GgFYf1aW_DkYhXN4BVzu0yMm5_NMgftU_z6rMijcFKziBuhYkJYtM70gdHa-I_iYKguT9s-chHuI2xGkVFIM9_FyqzGu3BXF-d2hzBnSc_aXl9xj_SB-B0pzfq-ZZueCJbYdpMa7-QverBBoonsy4h1wPjNWU5GWe-pzVaC4b_NTqGe5GQIrjkm_yBTosgw' },
  { name: 'Chrome Velvet', price: '$8.25', img: 'https://lh3.googleusercontent.com/aida-public/AB6AXuDTyG-lA1b0lMGI97x1xGuw2ZfTdC0wXbrcRTQSN4uSbXxlcg-rDGeY5Ai72s3el2m5ISca1jGlOp8ynHlfckqWNOl44l-COBcK_FHq6L_Ye0ncr7QaW8t7rBdVFKEF5AuQJDopMnqOvRsTPmP81vfflNSHvhpME9VhlmBKc-dRrlSDrHwkME-sEPe3VWjvHOVKUi0lT5_QuaImL4TchV3CZ1W0CPcVXa-XIjMzDfKVV06AqNgUukPKC47j55lJyrjuCm8Hp3n8Mg' },
  { name: 'Silver Leaf Pastry', price: '$5.50', img: 'https://lh3.googleusercontent.com/aida-public/AB6AXuA4aNwf5tAAkTfM4q4hZZ27qqbZx_VG7EpXrLUKSQIz2ycaUYq1Nha1UGsAuWNQs16F6UvOaMBOL2iFsfmku_VeBm3J_W7XsyYE-obLGMMN7TrRpZePtq71vntIjSUaAiasCkZt4U_Ghew1QH4yfgE04IOBdn-f_zGAJOzJiq3hImnyOErxtcA-OzzNyxsYl-qQ1WuOzFnhICY_ULma5ywdSSHRhzrXP5w6MHMlxgA9RkPQDJsQ9a7jDtl6UO2aQq3yHFmADoPCUw' },
  { name: 'Industrial Cold Brew', price: '$7.00', img: 'https://lh3.googleusercontent.com/aida-public/AB6AXuATJHHuAIMu9E5_PP_UCAsux97RHHLmBVjU9qpfeFKiPyjVGv-l3EHUzAg_fgBj4CHPZIoqFJ_JPxLjrMD9vmUNiBcHwzhKpceGBurTX1i-Mr4TJe2K8m9-h_OQeQDrp9qOU7RoxxYVxl4wN4kRnRI8H6GnsLuuqCiVuvKRZEhL-w36h-xoGSFt94Hd96pNPYaSaZfLZoTpEYB_v9dP8oZyv1d5JoOjL2U75TvMupj4k1ZGB0dt4RpmItxKZcgkVZcCN63d5d3Aw' },
] as const;

const ORDER_ITEMS = [
  { name: 'Midnight Espresso', mod: 'Double Shot • 1x', price: '$6.50' },
  { name: 'Chrome Velvet Latte', mod: 'Oat Milk • 1x', price: '$7.25' },
] as const;

export default function PosTerminal() {
  const [activeCategory, setActiveCategory] = useState<Category>('All / Tất cả');
  const [isRefining, setIsRefining] = useState(false);
  const panelRef = typeof window !== 'undefined' ? { current: null as HTMLDivElement | null } : { current: null };

  const handleMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!panelRef.current) return;
    const rect = panelRef.current.getBoundingClientRect();
    const x = (e.clientX - rect.left) / rect.width;
    const y = (e.clientY - rect.top) / rect.height;
    const rotateY = (x - 0.5) * 8;
    const rotateX = (0.5 - y) * 8;
    panelRef.current.style.transform = `perspective(1200px) rotateX(${rotateX}deg) rotateY(${rotateY}deg)`;
  };

  const handleMouseLeave = () => {
    if (!panelRef.current) return;
    panelRef.current.style.transform = 'perspective(1200px) rotateX(0deg) rotateY(0deg)';
  };

  return (
    <div className="h-screen flex flex-col bg-[var(--aura-noir-deep)] text-[var(--aura-chrome-bright)]">
      {/* Top header */}
      <header className="shrink-0 h-14 bg-[var(--aura-noir-void)] border-b border-white/10 flex items-center justify-between px-6 z-20">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-[var(--aura-tertiary)]/20 flex items-center justify-center text-sm">☕</div>
          <h1 className="font-display text-headline-sm text-[var(--aura-tertiary)] tracking-wider">AURA CAFE</h1>
          <span className="font-label-caps text-[10px] text-[var(--aura-chrome-mid)] ml-2">POS Terminal / Máy POS</span>
        </div>
        <div className="flex items-center gap-2">
          <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
          <span className="font-label-caps text-label-caps text-[var(--aura-chrome-mid)]">Terminal Session: Active</span>
        </div>
      </header>

      <div className="flex flex-1 overflow-hidden">
        {/* Left Panel */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          {/* Search */}
          <div className="relative">
            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--aura-chrome-mid)]">🔍</span>
            <input
              type="text"
              placeholder="Tìm món / Search menu..."
              className="w-full bg-white/5 border border-white/10 rounded-xl py-2.5 pl-10 pr-4 font-body text-sm text-[var(--aura-chrome-bright)] placeholder:text-[var(--aura-chrome-mid)]/50 outline-none focus:border-[var(--aura-tertiary)] transition-colors"
            />
          </div>

          {/* Categories */}
          <div className="flex flex-wrap gap-2">
            {CATEGORIES.map(cat => (
              <button
                key={cat}
                onClick={() => setActiveCategory(cat)}
                className={`px-4 py-2 rounded-xl font-label-caps text-label-caps text-xs transition-all active:scale-95 ${
                  activeCategory === cat
                    ? 'bg-[var(--aura-tertiary)] text-[var(--aura-noir-deep)]'
                    : 'bg-white/5 text-[var(--aura-chrome-mid)] hover:text-[var(--aura-chrome-bright)] border border-white/5'
                }`}
              >
                {cat}
              </button>
            ))}
          </div>

          {/* Menu grid */}
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
            {MENU_ITEMS.map(item => (
              <div key={item.name} className={`glass-panel rounded-xl overflow-hidden border aspect-[4/5] flex flex-col cursor-pointer transition-all hover:-translate-y-1 hover:border-[var(--aura-tertiary)]/30 group ${isRefining ? 'opacity-80' : ''}`}>
                <div className="flex-1 relative overflow-hidden bg-white/5">
                  <img src={item.img} alt={item.name} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500" />
                  <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent" />
                  <div className="absolute bottom-3 left-3 right-3">
                    <p className="font-body-sm text-body-sm text-white font-medium">{item.name}</p>
                    <p className="font-label-caps text-label-caps text-[var(--aura-tertiary)]">{item.price}</p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Right Sidebar */}
        <aside className="w-96 bg-[var(--aura-noir-void)]/60 border-l border-white/10 flex flex-col shrink-0">
          <div className="p-6 border-b border-white/10">
            <h3 className="font-headline-lg text-headline-lg text-[var(--aura-chrome-bright)]">Order Summary / Đơn hàng</h3>
            <div className="flex gap-4 mt-3">
              <div>
                <p className="font-label-caps text-[10px] text-[var(--aura-chrome-mid)] uppercase">Guest / Khách</p>
                <p className="font-body-sm text-body-sm text-[var(--aura-chrome-bright)]">Nguyễn Văn A</p>
              </div>
              <div>
                <p className="font-label-caps text-[10px] text-[var(--aura-chrome-mid)] uppercase">Table / Bàn</p>
                <p className="font-body-sm text-body-sm text-[var(--aura-chrome-bright)]">B01</p>
              </div>
            </div>
          </div>

          {/* Items */}
          <div className="flex-1 overflow-y-auto p-6 space-y-4">
            {ORDER_ITEMS.map(item => (
              <div key={item.name} className="flex justify-between items-start gap-3">
                <div className="flex gap-3">
                  <div className="w-14 h-14 rounded-lg bg-white/5 border border-white/10 shrink-0 bg-cover bg-center" style={{ backgroundImage: `url(${MENU_ITEMS.find(m => m.name === item.name)?.img})` }} role="img" aria-label={item.name} />
                  <div>
                    <p className="font-body-sm text-body-sm text-[var(--aura-chrome-bright)]">{item.name}</p>
                    <p className="font-label-caps text-[10px] text-[var(--aura-chrome-mid)]">{item.mod}</p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <button className="w-6 h-6 rounded bg-white/10 flex items-center justify-center text-xs text-[var(--aura-chrome-mid)] hover:bg-white/20 transition-colors">−</button>
                  <span className="font-body-sm text-sm w-4 text-center">1</span>
                  <button className="w-6 h-6 rounded bg-white/10 flex items-center justify-center text-xs text-[var(--aura-chrome-mid)] hover:bg-white/20 transition-colors">+</button>
                  <span className="font-body-sm text-sm text-[var(--aura-tertiary)] ml-2">{item.price}</span>
                </div>
              </div>
            ))}
          </div>

          {/* Totals */}
          <div className="p-6 border-t border-white/10 space-y-2">
            <div className="flex justify-between font-body-sm text-body-sm text-[var(--aura-chrome-mid)]">
              <span>Subtotal / Tạm tính</span>
              <span>$13.75</span>
            </div>
            <div className="flex justify-between font-body-sm text-body-sm text-[var(--aura-chrome-mid)]">
              <span>Luxury Tax (5%) / Thuế</span>
              <span>$0.68</span>
            </div>
            <div className="flex justify-between font-headline-md text-headline-md text-[var(--aura-tertiary)] pt-2 border-t border-white/10">
              <span>Total / Tổng</span>
              <span>$15.49</span>
            </div>
          </div>

          {/* Payment */}
          <div className="p-6 border-t border-white/10 space-y-3">
            <button className="w-full py-3 rounded-xl bg-[var(--aura-tertiary)] text-[var(--aura-noir-deep)] font-headline-sm uppercase tracking-widest text-sm hover:brightness-110 active:scale-[0.98] transition-all" style={{ boxShadow: '0 0 20px rgba(212,165,116,0.3)' }}>
              PayOS
            </button>
            <button className="w-full py-3 rounded-xl bg-white/5 border border-white/10 font-headline-sm uppercase tracking-widest text-sm text-[var(--aura-chrome-mid)] hover:text-[var(--aura-chrome-bright)] active:scale-[0.98] transition-all">
              COD / Tiền mặt
            </button>
            <button className="w-full py-3.5 rounded-xl bg-[#7BA89C] text-white font-headline-sm uppercase tracking-widest text-sm hover:brightness-110 active:scale-[0.98] transition-all">
              Complete Order / Hoàn tất
            </button>
          </div>
        </aside>
      </div>

      {/* Footer */}
      <footer className="shrink-0 h-12 bg-[var(--aura-noir-void)] border-t border-white/10 flex items-center justify-between px-6">
        <span className="font-label-caps text-[10px] text-[var(--aura-chrome-mid)]">AURA Terminal v2.4</span>
        <span className="font-label-caps text-[10px] text-[var(--aura-chrome-mid)]" suppressHydrationWarning>{new Date().toLocaleTimeString('vi-VN')}</span>
        <div className="flex gap-3">
          <button className="px-3 py-1 rounded bg-white/5 font-label-caps text-[10px] text-[var(--aura-chrome-mid)] hover:text-[var(--aura-chrome-bright)] transition-colors">Open Drawer / Mở ngăn</button>
          <button className="px-3 py-1 rounded bg-white/5 font-label-caps text-[10px] text-[var(--aura-chrome-mid)] hover:text-[var(--aura-chrome-bright)] transition-colors">Receipt / In hóa đơn</button>
          <button className="px-3 py-1 rounded bg-white/5 font-label-caps text-[10px] text-[var(--aura-chrome-mid)] hover:text-[var(--aura-chrome-bright)] transition-colors">End Shift / Kết ca</button>
        </div>
      </footer>
    </div>
  );
}