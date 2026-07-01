import { useState } from 'react';
import { cn } from '@/lib/cn';
import { Link } from 'react-router-dom';

interface Zone {
  id: string;
  number: string;
  name: string;
  subtitle: string;
  badge: string;
  tagline: string;
  description: string;
  specs: Array<{ label: string; value: string }>;
  icon: string;
}

const ZONES: Zone[] = [
  {
    id: 'jade-counter',
    number: '01',
    name: 'Quầy Bar',
    subtitle: 'Jade Counter',
    badge: 'JADE COUNTER',
    tagline: 'Mộc Mạc & Tự Nhiên',
    description:
      'Nằm cuối bên phải tầng trệt, quầy container 20ft được chế tác tinh xảo từ gỗ óc chó cao cấp kết hợp mặt đá ngọc bích sang trọng. Bao quanh bởi các chậu cây xanh tươi mát, không gian này mang phong cách Forest Green thanh lịch.',
    specs: [
      { label: 'Thiết kế', value: 'Walnut & Jade' },
      { label: 'Sức chứa', value: '15 khách' },
      { label: 'Phong cách', value: 'Forest Green' },
    ],
    icon: '🌿',
  },
  {
    id: 'sky-deck',
    number: '02',
    name: 'Rooftop',
    subtitle: 'Sky Deck',
    badge: 'SKY DECK',
    tagline: 'Khoáng Đạt & Lộng Gió',
    description:
      'Sân thượng container tầng 2 thoáng đãng, ngắm trọn vẹn cảnh trời đêm phố thị Sa Đéc lung linh. Lý tưởng để thưởng thức Cold Brew mát lạnh giữa không gian lãng mạn vô tận.',
    specs: [
      { label: 'Độ cao', value: '8m so với mặt phố' },
      { label: 'Sức chứa', value: '40 khách' },
      { label: 'Tầm nhìn', value: 'Phố Sa Đéc lung linh' },
    ],
    icon: '🌅',
  },
  {
    id: 'noir-cabin',
    number: '03',
    name: 'Container Seating',
    subtitle: 'Noir Cabin',
    badge: 'NOIR CABIN',
    tagline: 'Ấm Cúng & Công Nghiệp',
    description:
      'Không gian khép kín bên trong container 40ft. Vách thép đen rỉ tự nhiên thô mộc, kết hợp sofa da navy sang trọng. Riêng tư tuyệt đối, ấm cúng.',
    specs: [
      { label: 'Tiện nghi', value: 'Điều hòa & Cách âm' },
      { label: 'Sức chứa', value: '25 khách' },
      { label: 'Vật liệu', value: 'Thép đen rỉ & Da navy' },
    ],
    icon: '🛋️',
  },
  {
    id: 'aura-lounge',
    number: '04',
    name: 'Sunset Corner',
    subtitle: 'Aura Lounge',
    badge: 'AURA LOUNGE',
    tagline: 'Tây Hướng Hoàng Hôn',
    description:
      'Góc Tây đón trọn ánh hoàng hôn rực rỡ. Inox gương và chrome bóng bẩy phản chiếu ánh sáng cực chất &mdash; Industrial Luxury đẳng cấp.',
    specs: [
      { label: 'Giờ vàng', value: '16:30 - 18:00' },
      { label: 'Sức chứa', value: '20 khách' },
      { label: 'Vật liệu', value: 'Inox gương & Chrome' },
    ],
    icon: '🌇',
  },
  {
    id: 'vip-steel-nest',
    number: '05',
    name: 'VIP Steel Nest',
    subtitle: 'Ban Công Treo',
    badge: 'VIP STEEL NEST',
    tagline: 'Yên Tĩnh & Độc Bản',
    description:
      'Ban công container treo lơ lửng giữa không trung. Biệt lập tuyệt đối, thích hợp cho gặp gỡ đối tác hay những cuộc trò chuyện sâu lắng.',
    specs: [
      { label: 'Vị trí', value: 'Ban công container treo' },
      { label: 'Sức chứa', value: '10 khách' },
      { label: 'Đặc điểm', value: 'Biệt lập & Yên tĩnh' },
    ],
    icon: '🏗️',
  },
];

export function FiveZoneShowcase() {
  const [activeZone, setActiveZone] = useState(0);

  const zone = ZONES[activeZone] as Zone;

  return (
    <section className="bg-gradient-to-b from-[#0A1A2E] to-[#050D1A] py-20" aria-label="5 không gian trải nghiệm">
      <div className="mx-auto max-w-6xl px-4">
        {/* Header */}
        <div className="mb-12 text-center">
          <span className="text-xs font-semibold uppercase tracking-[0.2em] text-chrome-mid/60">
            02 &mdash; THIẾT KẾ ĐỘC BẢN
          </span>
          <h2 className="mt-3 font-display text-3xl font-bold text-chrome-bright sm:text-4xl">
            5 Không Gian Trải Nghiệm
          </h2>
          <p className="mx-auto mt-3 max-w-2xl text-chrome-light/60">
            Cấu trúc 2 tầng container xếp chồng &mdash; kính cường lực, thép nguyên khối,
            không gian mỗi khu có cá tính riêng.
          </p>
        </div>

        {/* Tabs */}
        <div
          className="mb-10 flex flex-wrap justify-center gap-2"
          role="tablist"
          aria-label="Chọn không gian"
        >
          {ZONES.map((z, idx) => (
            <button
              key={z.id}
              role="tab"
              aria-selected={idx === activeZone}
              aria-controls={`zone-panel-${z.id}`}
              id={`zone-tab-${z.id}`}
              onClick={() => setActiveZone(idx)}
              className={cn(
                'rounded-full px-5 py-2.5 text-sm font-medium transition-all duration-200',
                idx === activeZone
                  ? 'bg-chrome-light/15 text-chrome-bright shadow-lg shadow-chrome-mid/10'
                  : 'text-chrome-light/40 hover:text-chrome-light/70 hover:bg-white/5',
              )}
            >
              <span className="mr-1 text-xs opacity-50">{z.number}</span>
              {z.subtitle}
            </button>
          ))}
        </div>

        {/* Active zone panel */}
        <div
          key={zone.id}
          className="animate-fade-in-up rounded-2xl border border-chrome-light/10 bg-gradient-to-br from-[#0A1A2E]/80 to-[#050D1A]/90 p-6 backdrop-blur-sm sm:p-10"
          role="tabpanel"
          aria-labelledby={`zone-tab-${zone.id}`}
          id={`zone-panel-${zone.id}`}
        >
          <div className="grid gap-8 md:grid-cols-2">
            {/* Visual */}
            <div className="flex aspect-[4/3] items-center justify-center rounded-xl bg-gradient-to-br from-chrome-dark/20 to-noir-mid/50 border border-chrome-light/10">
              <span className="text-7xl">{zone.icon}</span>
            </div>

            {/* Info */}
            <div className="flex flex-col justify-center gap-4">
              <span className="inline-block w-fit rounded-full border border-chrome-light/20 bg-white/5 px-3 py-1 text-[10px] font-semibold uppercase tracking-wider text-chrome-light">
                {zone.badge}
              </span>
              <h3 className="font-display text-2xl font-bold text-chrome-bright">
                {zone.name} <span className="font-light text-chrome-light/50">&mdash;</span>{' '}
                <em className="not-italic text-chrome-light">{zone.subtitle}</em>
              </h3>
              <p className="text-xs font-semibold uppercase tracking-wider text-chrome-mid/70">{zone.tagline}</p>
              <p className="text-chrome-light/70 leading-relaxed">{zone.description}</p>
              <dl className="mt-2 space-y-2 border-t border-chrome-light/10 pt-4">
                {zone.specs.map((spec) => (
                  <div key={spec.label} className="flex justify-between text-sm">
                    <dt className="text-chrome-mid/60">{spec.label}</dt>
                    <dd className="text-chrome-light/80 font-medium">{spec.value}</dd>
                  </div>
                ))}
              </dl>
            </div>
          </div>
        </div>

        {/* CTA */}
        <div className="mt-10 text-center">
          <Link
            to="/about-us"
            className="inline-flex items-center gap-2 text-sm font-semibold text-chrome-light transition-colors hover:text-chrome-bright"
          >
            Khám phá thêm về không gian <span>&rarr;</span>
          </Link>
        </div>
      </div>
    </section>
  );
}
