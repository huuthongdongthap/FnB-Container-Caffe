import { useEffect, useState } from 'react';
import { OFFERS } from './constants';
import { HeroSection } from './hero-section';
import { OfferCard } from './offer-card';
import { NewsletterSection } from './newsletter-section';
import { LandingNav } from '@/components/stitch/StitchLandingNew-nav';
import { LandingFooter } from '@/components/stitch/StitchLandingNew-footer';
import { HelmetHead } from '@/components/seo/HelmetHead';
import { Sparkles, Award, ShieldCheck, Zap } from 'lucide-react';

export type { CardOffer } from './types';

export default function PromotionsNew() {
  const [timer, setTimer] = useState(4 * 3600 + 22 * 60 + 15);

  useEffect(() => {
    const id = setInterval(() => {
      setTimer(t => (t > 0 ? t - 1 : 4 * 3600 + 22 * 60 + 15));
    }, 1000);
    return () => clearInterval(id);
  }, []);

  const formatTime = (sec: number) => {
    const h = String(Math.floor(sec / 3600)).padStart(2, '0');
    const m = String(Math.floor((sec % 3600) / 60)).padStart(2, '0');
    const s = String(sec % 60).padStart(2, '0');
    return `${h}:${m}:${s}`;
  };

  return (
    <div className="relative min-h-screen bg-[#0A1A2E] text-[var(--aura-chrome-bright)] font-body selection:bg-[var(--aura-chrome-mid)] selection:text-[#0A1A2E] flex flex-col justify-between">
      <HelmetHead
        title="Ưu Đãi & Đặc Quyền Hội Viên — AURA CAFE"
        description="Khám phá các chương trình ưu đãi độc quyền, hoàn tiền ví thành viên và voucher giảm giá tại AURA CAFE Sa Đéc."
        canonical="/promotions"
      />

      <LandingNav />

      <div role="region" aria-label="Ưu Đãi & Đặc Quyền" className="pt-24 pb-12 flex-1">
        {/* Hero Promo Banner */}
        <HeroSection offer={OFFERS[0]!} timer={timer} formatTime={formatTime} />

        {/* Membership Tier Badges Bar */}
        <section className="px-4 sm:px-6 max-w-7xl mx-auto my-8">
          <div className="p-6 rounded-2xl bg-white/[0.03] border border-white/10 backdrop-blur-md">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6">
              <div>
                <span className="text-xs uppercase tracking-[0.2em] font-bold text-[var(--aura-bronze-shimmer,#C9A96E)] block mb-1">
                  Chính Sách Khách Hàng Thân Thiết
                </span>
                <h4 className="text-lg font-semibold text-white font-display">
                  4 Cấp Bậc Hội Viên Ví AURA
                </h4>
              </div>
              <span className="text-xs text-[var(--aura-chrome-mid)]">
                Tự động tích lũy điểm & hoàn tiền trực tiếp trên mỗi hóa đơn
              </span>
            </div>

            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
              <div className="p-4 rounded-xl bg-white/[0.02] border border-white/5 flex flex-col justify-between">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs font-bold text-[#CD7F32]">HẠNG ĐỒNG</span>
                  <Award className="w-4 h-4 text-[#CD7F32]" />
                </div>
                <div className="text-xl font-bold text-white mb-1">Hoàn 3%</div>
                <span className="text-[11px] text-[var(--aura-chrome-mid)]">Mặc định khi đăng ký</span>
              </div>

              <div className="p-4 rounded-xl bg-white/[0.02] border border-white/5 flex flex-col justify-between">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs font-bold text-[#C0C0C0]">HẠNG BẠC</span>
                  <Zap className="w-4 h-4 text-[#C0C0C0]" />
                </div>
                <div className="text-xl font-bold text-white mb-1">Hoàn 5%</div>
                <span className="text-[11px] text-[var(--aura-chrome-mid)]">Từ 500.000₫ tích lũy</span>
              </div>

              <div className="p-4 rounded-xl bg-white/[0.02] border border-[var(--aura-bronze-shimmer,#C9A96E)]/30 flex flex-col justify-between">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs font-bold text-[var(--aura-bronze-shimmer,#C9A96E)]">HẠNG VÀNG</span>
                  <Sparkles className="w-4 h-4 text-[var(--aura-bronze-shimmer,#C9A96E)]" />
                </div>
                <div className="text-xl font-bold text-white mb-1">Hoàn 7%</div>
                <span className="text-[11px] text-[var(--aura-chrome-mid)]">Từ 2.000.000₫ tích lũy</span>
              </div>

              <div className="p-4 rounded-xl bg-gradient-to-br from-white/[0.06] to-white/[0.01] border border-[var(--aura-chrome-bright)]/40 flex flex-col justify-between shadow-lg">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs font-bold text-[var(--aura-chrome-bright)]">BẠCH KIM</span>
                  <ShieldCheck className="w-4 h-4 text-[var(--aura-chrome-bright)]" />
                </div>
                <div className="text-xl font-bold text-white mb-1">Hoàn 10%</div>
                <span className="text-[11px] text-[var(--aura-chrome-mid)]">Từ 5.000.000₫ tích lũy</span>
              </div>
            </div>
          </div>
        </section>

        {/* Feature Offers Grid */}
        <section className="px-4 sm:px-6 space-y-6 max-w-7xl mx-auto mt-10">
          <div className="flex items-center gap-3 border-l-4 border-[var(--aura-bronze-shimmer,#C9A96E)] pl-4">
            <div>
              <span className="text-xs uppercase tracking-widest text-[var(--aura-bronze-shimmer,#C9A96E)] font-bold block mb-1">
                Ưu Đãi Hiện Hành
              </span>
              <h3 className="font-display text-2xl font-bold text-white tracking-tight">
                Ưu Đãi &amp; Đặc Quyền Hội Viên
              </h3>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {OFFERS.slice(1).map(offer => (
              <OfferCard key={offer.id} offer={offer} />
            ))}
          </div>
        </section>

        {/* VIP Newsletter Section */}
        <NewsletterSection />
      </div>

      <LandingFooter />
    </div>
  );
}
