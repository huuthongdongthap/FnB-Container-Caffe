import { LandingNav } from '@/components/stitch/StitchLandingNew-nav';
import { LandingFooter } from '@/components/stitch/StitchLandingNew-footer';
import { HelmetHead } from '@/components/seo/HelmetHead';
import { Check, Sparkles, Coffee, Briefcase, Crown } from 'lucide-react';

interface Plan {
  readonly id: string;
  readonly tier: string;
  readonly price: string;
  readonly period: string;
  readonly desc: string;
  readonly icon: typeof Coffee;
  readonly features: readonly string[];
  readonly cta: string;
  readonly highlighted: boolean;
}

const PLANS: readonly Plan[] = [
  {
    id: 'morning',
    tier: 'CÀ PHÊ SÁNG',
    price: '199.000₫',
    period: '/ THÁNG',
    desc: 'Dành cho khách hàng khởi đầu ngày mới đầy năng lượng cùng hương vị cà phê mộc Sa Đéc.',
    icon: Coffee,
    features: [
      '1 ly cà phê phin hoặc espresso mỗi ngày',
      'Tặng 1 voucher giảm 20% đồ uống đặc biệt/tháng',
      'Tích lũy x1.5 điểm AURA Points',
      'Đặt món nhanh qua mã QR tại bàn',
    ],
    cta: 'ĐĂNG KÝ GÓI SÁNG',
    highlighted: false,
  },
  {
    id: 'coworking',
    tier: 'CO-WORKING & CABIN',
    price: '499.000₫',
    period: '/ THÁNG',
    desc: 'Không gian làm việc tĩnh lặng lý tưởng cho freelancer, người làm việc từ xa và sáng tạo.',
    icon: Briefcase,
    features: [
      'Chỗ ngồi ưu tiên tại Cabin Yên Tĩnh & Lounge Thủy Mộc',
      '1 ly đồ uống bất kỳ trong menu mỗi ngày',
      'Wifi cáp quang tốc độ cao & ổ điện công suất lớn',
      'Giảm 15% toàn bộ bánh ngọt & đồ ăn nhẹ',
      'Tích lũy x2 điểm thưởng AURA Points',
    ],
    cta: 'CHỌN GÓI PHỔ BIẾN',
    highlighted: true,
  },
  {
    id: 'corporate',
    tier: 'DOANH NHÂN & VIP',
    price: '1.490.000₫',
    period: '/ THÁNG',
    desc: 'Đặc quyền tiếp đón đối tác và tổ chức workshop, gặp mặt cao cấp giữa lòng Sa Đéc.',
    icon: Crown,
    features: [
      'Toàn bộ quyền lợi của gói Co-working',
      '30 ly đồ uống cao cấp mỗi tháng cho đối tác',
      'Ưu tiên đặt bàn Sân Thượng Rooftop hoặc Cabin riêng',
      'Hỗ trợ in ấn tài liệu họp miễn phí',
      'Bãi đỗ xe ô tô dành riêng & phục vụ tận bàn',
    ],
    cta: 'LIÊN HỆ GÓI VIP',
    highlighted: false,
  },
] as const;

export default function SubscriptionsNew() {
  return (
    <div className="relative min-h-screen bg-[var(--aura-noir-deep,#0a1a2e)] text-[var(--aura-chrome-bright)] selection:bg-[var(--aura-chrome-mid)] selection:text-[#0A1A2E] flex flex-col justify-between">
      <HelmetHead
        title="Gói Hội Viên &amp; Đặc Quyền Tháng — AURA CAFE"
        description="Đăng ký gói cà phê tháng và gói co-working tại AURA CAFE Sa Đéc. Thưởng thức đồ uống mỗi ngày và tận hưởng không gian làm việc container sang trọng."
        canonical="/subscriptions"
      />
      <LandingNav />

      <div role="region" aria-label="Gói Hội Viên Đặc Quyền" className="subscriptions-container pt-28 pb-24 px-5 sm:px-8 lg:px-16 max-w-7xl mx-auto w-full flex-1">
        {/* Hero */}
        <section className="mb-16 text-center max-w-3xl mx-auto">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-[var(--aura-chrome-mid)]/10 border border-[var(--aura-chrome-mid)]/20 mb-4">
            <Sparkles className="w-3.5 h-3.5 text-[var(--aura-chrome-bright)]" />
            <span className="text-[var(--aura-chrome-mid)] text-xs uppercase tracking-widest font-semibold font-body">
              Gói Hội Viên Đặc Quyền
            </span>
          </div>
          <h1 className="font-display text-4xl sm:text-5xl lg:text-6xl text-white font-medium mb-6 leading-tight">
            Nâng Tầm Trải Nghiệm Mỗi Ngày
          </h1>
          <div className="font-body text-base sm:text-lg text-[var(--aura-chrome-soft)] font-light leading-relaxed">
            Tiết kiệm chi phí, chủ động thời gian và tận hưởng không gian cà phê container độc bản tại Sa Đéc với các gói thành viên linh hoạt.
          </div>
        </section>

        {/* Pricing Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8 items-stretch">
          {PLANS.map((plan) => {
            const Icon = plan.icon;
            return (
              <div
                key={plan.id}
                className={`rounded-[36px] p-8 sm:p-10 flex flex-col justify-between relative transition-all duration-500 group ${
                  plan.highlighted
                    ? 'bg-gradient-to-b from-white/10 to-white/5 border-2 border-[var(--aura-chrome-bright)] shadow-[0_0_30px_rgba(201,214,223,0.15)] md:-translate-y-2'
                    : 'bg-white/5 backdrop-blur-[8px] border border-white/10 hover:border-[var(--aura-chrome-mid)]/40 shadow-xl'
                }`}
              >
                {plan.highlighted && (
                  <div className="absolute -top-3.5 left-1/2 -translate-x-1/2 bg-[var(--aura-chrome-bright)] text-[var(--aura-noir-deep)] font-body text-[10px] font-bold px-4 py-1 rounded-full uppercase tracking-widest shadow-md">
                    LỰA CHỌN PHỔ BIẾN
                  </div>
                )}

                <div>
                  <div className="w-12 h-12 rounded-2xl bg-[var(--aura-chrome-mid)]/15 border border-[var(--aura-chrome-mid)]/30 flex items-center justify-center text-[var(--aura-chrome-bright)] mb-6">
                    <Icon className="w-6 h-6" />
                  </div>

                  <h3 className="font-display text-xl font-bold text-white mb-2 tracking-wide">
                    {plan.tier}
                  </h3>
                  <p className="font-body text-xs text-[var(--aura-chrome-mid)] mb-6 leading-relaxed font-light">
                    {plan.desc}
                  </p>

                  <div className="flex items-baseline gap-1.5 pb-6 mb-6 border-b border-white/10">
                    <span className="font-display text-3xl sm:text-4xl font-bold text-white">
                      {plan.price}
                    </span>
                    <span className="font-body text-xs text-[var(--aura-chrome-mid)] tracking-wider">
                      {plan.period}
                    </span>
                  </div>

                  <ul className="space-y-3.5 mb-8">
                    {plan.features.map((f, i) => (
                      <li key={i} className="flex items-start gap-3">
                        <div className="w-5 h-5 rounded-full bg-[var(--aura-chrome-bright)]/10 flex items-center justify-center shrink-0 mt-0.5 text-[var(--aura-chrome-bright)]">
                          <Check className="w-3.5 h-3.5 stroke-[2.5]" />
                        </div>
                        <span className="font-body text-xs sm:text-sm text-[var(--aura-chrome-soft)] font-light leading-snug">
                          {f}
                        </span>
                      </li>
                    ))}
                  </ul>
                </div>

                <a
                  href="/contact"
                  className={`w-full py-4 rounded-2xl font-body text-xs font-bold uppercase tracking-widest text-center transition-all duration-300 active:scale-[0.98] ${
                    plan.highlighted
                      ? 'bg-[var(--aura-chrome-bright)] hover:bg-white text-[var(--aura-noir-deep)] shadow-lg'
                      : 'bg-white/5 hover:bg-white/10 border border-white/15 text-white'
                  }`}
                >
                  {plan.cta}
                </a>
              </div>
            );
          })}
        </div>

        {/* Location Highlight Banner */}
        <div className="mt-20 relative rounded-[32px] overflow-hidden border border-white/10 bg-white/5">
          <div className="grid grid-cols-1 md:grid-cols-12 items-center">
            <div className="md:col-span-7 p-8 sm:p-12">
              <span className="text-[var(--aura-chrome-mid)] text-xs uppercase tracking-[0.25em] font-semibold block mb-2">
                ĐIỂM HẸN TẠI SA ĐÉC
              </span>
              <h2 className="font-display text-2xl sm:text-3xl text-white font-medium mb-4">
                29 Nguyễn Tất Thành, Sa Đéc, Đồng Tháp
              </h2>
              <p className="font-body text-sm text-[var(--aura-chrome-soft)] font-light leading-relaxed mb-6">
                Không gian mở với 3 khối container hàng hải, 5 phân khu thư giãn và làm việc, sân thượng ngắm view thành phố hoa Sa Đéc. Sẵn sàng chào đón quý khách từ 06:30 đến 22:30 mỗi ngày.
              </p>
              <div className="flex gap-4">
                <a
                  href="/table-reservation"
                  className="bg-[var(--aura-chrome-bright)] text-[var(--aura-noir-deep)] px-6 py-2.5 rounded-full text-xs font-bold uppercase tracking-wider font-body hover:bg-white transition-colors"
                >
                  Đặt Chỗ Trước
                </a>
                <a
                  href="/gallery"
                  className="border border-white/20 text-white px-6 py-2.5 rounded-full text-xs font-semibold uppercase tracking-wider font-body hover:border-white transition-colors"
                >
                  Xem Hình Ảnh
                </a>
              </div>
            </div>
            <div className="md:col-span-5 h-64 md:h-full min-h-[260px] relative overflow-hidden">
              <img
                src="/photos/IMG_6631.webp"
                alt="AURA CAFE lung linh về đêm tại Sa Đéc"
                className="w-full h-full object-cover grayscale opacity-70 hover:grayscale-0 hover:opacity-100 transition-all duration-700"
              />
            </div>
          </div>
        </div>
      </div>

      <LandingFooter />
    </div>
  );
}
