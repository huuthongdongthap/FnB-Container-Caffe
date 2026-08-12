/* ── Stitch: aura_cafe_luxury_container_landing ────────────────────── */
/* Source: /Users/macbook/Downloads/stitch_aura_cafe/aura_cafe_luxury_container_landing/code.html */
/* Converted: HTML → React/TSX, Tailwind → CSS vars, Material Symbols → text */

import { StitchShell } from '../StitchBase';
import { PageHeader, PageFooter } from '@/components/stitch/StitchLayout'

const SECTION =
  'bg-[var(--aura-noir-deep)]/50';

export default function LuxuryContainerLanding() {
  return (
    <StitchShell>
      {/* Hero */}
      <section className="relative z-10 px-5 md:px-16 py-20 flex flex-col items-center justify-center min-h-[870px] text-center">
        <div className="max-w-5xl w-full border-t border-[var(--aura-border-chrome)]/30 p-8 md:p-24 relative overflow-hidden">

          <div className="relative z-10 flex flex-col items-center">
            <span className="font-body text-xs font-semibold text-[var(--aura-chrome-mid)] mb-6 tracking-[0.4em] uppercase">
              Sa Dec • Premium Coffee
            </span>

            <h1 className="font-display text-4xl md:text-5xl lg:text-6xl text-[var(--aura-chrome-bright)] mb-8 max-w-3xl leading-tight">
              AURA CAFE
            </h1>

            <p className="font-body text-base md:text-lg text-[var(--aura-chrome-mid)] max-w-2xl mb-12 leading-relaxed">
              Trải nghiệm cà phê container thượng hạng giữa không gian công nghiệp sang trọng.
              Nơi ánh sáng và bóng tối hòa quyện tạo nên bản giao hưởng kiến trúc độc bản.
            </p>

            <div className="flex flex-col sm:flex-row gap-6">
              <button className="bg-gradient-to-r from-[#D4A574] to-[#B48554] text-[var(--aura-noir-deep)] font-body text-xs font-bold px-10 py-5 uppercase tracking-widest hover:opacity-90 transition-all">
                Khám phá ngay →
              </button>
              <button className="border border-[var(--aura-border-chrome)] px-10 py-5 font-body text-xs uppercase tracking-widest text-[var(--aura-chrome-bright)] hover:bg-white/5 transition-all">
                Thực đơn
              </button>
            </div>
          </div>
        </div>
      </section>

      {/* Features */}
      <section className={`relative z-10 px-5 md:px-16 py-24 mb-32 ${SECTION}`}>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8 max-w-6xl mx-auto">

          {[
            { icon: '☕', title: 'Menu đa dạng', desc: 'Từ những hạt Arabica tuyển chọn đến những công thức trà đặc biệt, được pha chế bởi những nghệ nhân barista tận tâm nhất.' },
            { icon: '🪑', title: 'Đặt bàn nhanh', desc: 'Đảm bảo vị trí ngồi lý tưởng trong không gian lounge sang trọng cho những cuộc gặp gỡ quan trọng.' },
            { icon: '🚗', title: 'Giao tận nơi', desc: 'Thưởng thức hương vị AURA ngay tại nhà hoặc văn phòng với dịch vụ giao hàng nhanh chóng trong khu vực Sa Đéc.' },
          ].map((f, i) => (
            <div key={i} className="border-t border-[var(--aura-border-chrome)]/20 p-10 hover:-translate-y-2 transition-transform duration-500">
              <div className="w-12 h-12 flex items-center justify-center mb-8 border border-[var(--aura-chrome-mid)]/30">
                <span className="text-xl">{f.icon}</span>
              </div>
              <h3 className="font-display text-xl text-[var(--aura-chrome-bright)] mb-4">{f.title}</h3>
              <p className="font-body text-sm text-[var(--aura-chrome-mid)] mb-8 leading-relaxed">{f.desc}</p>
              <a href="#" className="font-body text-xs text-[var(--aura-chrome-mid)] uppercase tracking-widest hover:underline">
                Xem chi tiết →
              </a>
            </div>
          ))}
        </div>
      </section>

      {/* Gallery / Detail */}
      <section className="relative z-10 px-5 md:px-16 py-24">
        <div className="flex flex-col md:flex-row gap-20 items-center max-w-6xl mx-auto">
          <div className="w-full md:w-1/2 relative">
            <div className="border-t border-[var(--aura-border-chrome)]/20 p-2">
              <div className="w-full h-[500px] bg-[var(--aura-noir-mid)]" />
            </div>
          </div>
          <div className="w-full md:w-1/2">
            <span className="font-body text-xs text-[var(--aura-chrome-mid)] mb-4 block uppercase tracking-widest">
              Kiến Trúc Độc Bản
            </span>
            <h2 className="font-display text-3xl text-[var(--aura-chrome-bright)] mb-8">
              Nơi Công Nghiệp Gặp Gỡ Sự Sang Trọng
            </h2>
            <p className="font-body text-base text-[var(--aura-chrome-mid)] mb-10 leading-relaxed">
              Aura Cafe không chỉ là một quán cà phê; đó là một tuyên ngôn về phong cách sống.
              Những khối container thô cứng được chúng tôi biến đổi thành không gian nghệ thuật.
            </p>
            <div className="space-y-6">
              {[
                { t: 'Vật liệu tinh tuyển', d: 'Thép không gỉ, kính cường lực mờ và gỗ sồi tự nhiên.' },
                { t: 'Ánh sáng cảm xúc', d: 'Hệ thống chiếu sáng được thiết kế bởi chuyên gia.' },
              ].map((item, i) => (
                <div key={i} className="flex items-start gap-4">
                  <div className="mt-1.5 w-2 h-2 bg-[var(--aura-chrome-mid)]" />
                  <div>
                    <h4 className="font-body text-sm text-[var(--aura-chrome-bright)] uppercase mb-1">{item.t}</h4>
                    <p className="font-body text-sm text-[var(--aura-chrome-mid)]">{item.d}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* Location */}
      <section className="relative z-10 px-5 md:px-16 py-24 mb-16">
        <div className="border-t border-[var(--aura-border-chrome)]/20 p-8 md:p-12 max-w-6xl mx-auto">
          <div className="flex flex-col md:flex-row justify-between items-center gap-12">
            <div className="max-w-md">
              <h2 className="font-display text-2xl text-[var(--aura-chrome-bright)] mb-6">Ghé thăm chúng tôi tại Sa Đéc</h2>
              <div className="space-y-4">
                {[
                  { icon: '📍', text: 'Đường Nguyễn Sinh Sắc, Phường 2, Sa Đéc, Đồng Tháp' },
                  { icon: '🕐', text: 'Mở cửa: 07:00 - 23:00 mỗi ngày' },
                  { icon: '📞', text: '+84 277 123 456' },
                ].map((c, i) => (
                  <div key={i} className="flex items-center gap-4 text-[var(--aura-chrome-mid)]">
                    <span>{c.icon}</span>
                    <span className="font-body text-sm">{c.text}</span>
                  </div>
                ))}
              </div>
            </div>
            <div className="w-full md:w-1/2 h-64 bg-[var(--aura-noir-mid)]" />
          </div>
        </div>
      </section>

      {/* Footer */}
<PageFooter
  brand="AURA CAFE"
  socialSize="sm"
  copyLine="© 2024 AURA CAFE SA DEC"
/>
    </StitchShell>
  );
}
