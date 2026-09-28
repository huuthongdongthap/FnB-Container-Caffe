import { useState } from 'react';
import { LandingNav } from '@/components/stitch/StitchLandingNew-nav';
import { LandingFooter } from '@/components/stitch/StitchLandingNew-footer';
import { HelmetHead } from '@/components/seo/HelmetHead';
import { X, ZoomIn, Wind, CloudSun, Building2 } from 'lucide-react';

// ─── 3 khu không gian thực tế của AURA CAFE ──────────────────────────────
// 1. Sân Ngoài Trời  — khu Outside gồm sân vườn + container 20ft mở hai đầu
// 2. Rooftop Tầng Thượng — sân thượng container nhìn ra làng hoa
// 3. Phòng Container  — container 40ft có máy lạnh, yên tĩnh, riêng tư

type ZoneFilter =
  | 'TẤT CẢ'
  | 'SÂN NGOÀI TRỜI'
  | 'ROOFTOP TẦNG THƯỢNG'
  | 'PHÒNG CONTAINER';

interface GalleryItem {
  id: number;
  category: ZoneFilter;
  title: string;
  description: string;
  image: string;
}

const GALLERY_ITEMS: readonly GalleryItem[] = [
  {
    id: 1,
    category: 'SÂN NGOÀI TRỜI',
    title: 'Khuôn Viên Sân Vườn & Container Mở',
    description:
      'Khu vực ngoài trời thoáng đãng với cây xanh bao phủ, container 20ft hai đầu mở — hứng gió tự nhiên, ngắm làng hoa Sa Đéc.',
    image: '/photos/IMG_6565.webp',
  },
  {
    id: 2,
    category: 'SÂN NGOÀI TRỜI',
    title: 'Góc Container Thép & Vách Kính',
    description:
      'Chi tiết kiến trúc container sơn phủ công nghiệp phối cùng kính cường lực — nơi ánh sáng tự nhiên tràn vào suốt ngày.',
    image: '/photos/IMG_6696.webp',
  },
  {
    id: 3,
    category: 'ROOFTOP TẦNG THƯỢNG',
    title: 'AURA CAFE Lung Linh Về Đêm',
    description:
      'Sân thượng rooftop thoáng trời — ánh đèn vàng ấm áp trải dài, view đêm yên bình giữa lòng Sa Đéc.',
    image: '/photos/IMG_6631.webp',
  },
  {
    id: 4,
    category: 'SÂN NGOÀI TRỜI',
    title: 'Quầy Bar Pha Chế & Đón Khách',
    description:
      'Quầy bar ngoài trời sầm uất — nơi những ly cà phê máy và trà trái cây được pha chế tươi ngon mỗi ngày.',
    image: '/photos/IMG_6693.webp',
  },
  {
    id: 5,
    category: 'PHÒNG CONTAINER',
    title: 'Phòng Riêng Container 40ft Máy Lạnh',
    description:
      'Không gian phòng kín yên tĩnh bên trong container 40ft — máy lạnh mát, ánh sáng ấm, lý tưởng cho làm việc, họp nhóm hoặc trò chuyện riêng tư.',
    image: '/photos/IMG_6694.webp',
  },
  {
    id: 6,
    category: 'ROOFTOP TẦNG THƯỢNG',
    title: 'Góc Thư Giãn Rooftop Hướng Vườn',
    description:
      'Bàn ghế thoáng gió trên tầng thượng — view hướng ra vườn hoa cây cảnh Sa Đéc, hoàn hảo cho những buổi chiều chill.',
    image: '/photos/IMG_6697.webp',
  },
];

// ─── Zone metadata (icon + mô tả ngắn cho zone card) ─────────────────────
const ZONE_META: Record<
  Exclude<ZoneFilter, 'TẤT CẢ'>,
  { icon: typeof Wind; tagline: string; note: string }
> = {
  'SÂN NGOÀI TRỜI': {
    icon: CloudSun,
    tagline: 'Thoáng — Xanh — Gió tự nhiên',
    note: 'Container 20ft mở hai đầu • Sân vườn cây xanh • Gần quầy bar',
  },
  'ROOFTOP TẦNG THƯỢNG': {
    icon: Building2,
    tagline: 'View đẹp — Thoáng trời — Buổi tối lung linh',
    note: 'Sân thượng mở • Ánh đèn ấm về đêm • Hướng làng hoa Sa Đéc',
  },
  'PHÒNG CONTAINER': {
    icon: Wind,
    tagline: 'Mát lạnh — Yên tĩnh — Riêng tư',
    note: 'Container 40ft • Máy lạnh • Phù hợp làm việc & họp nhóm',
  },
};

const FILTERS: readonly ZoneFilter[] = [
  'TẤT CẢ',
  'SÂN NGOÀI TRỜI',
  'ROOFTOP TẦNG THƯỢNG',
  'PHÒNG CONTAINER',
];

export default function GalleryNew() {
  const [activeFilter, setActiveFilter] = useState<ZoneFilter>('TẤT CẢ');
  const [modalImage, setModalImage] = useState<GalleryItem | null>(null);

  const filteredItems =
    activeFilter === 'TẤT CẢ'
      ? GALLERY_ITEMS
      : GALLERY_ITEMS.filter((item) => item.category === activeFilter);

  return (
    <div className="relative min-h-screen bg-[var(--aura-noir-deep,#0a1a2e)] text-[var(--aura-chrome-bright)] selection:bg-[var(--aura-chrome-mid)] selection:text-[#0A1A2E] overflow-x-hidden">
      <HelmetHead
        title="Không Gian — AURA CAFE"
        description="Khám phá 3 khu không gian độc đáo: Sân Ngoài Trời (container 20ft mở), Rooftop Tầng Thượng, và Phòng Container 40ft máy lạnh tại AURA CAFE Sa Đéc."
        canonical="/gallery"
      />
      <LandingNav />

      <div role="region" aria-label="Không Gian AURA CAFE" className="pt-28 pb-24 px-4 sm:px-6 max-w-6xl mx-auto w-full">

        {/* ── Header ──────────────────────────────────────────────────── */}
        <div className="text-center mb-12 sm:mb-14">
          <span className="text-[var(--aura-chrome-mid)] text-xs uppercase tracking-[0.3em] font-semibold block mb-3">
            KHÔNG GIAN • AURA CAFE SA ĐÉC
          </span>
          <h1 className="font-display text-3xl sm:text-4xl md:text-6xl text-white font-medium mb-4">
            3 Khu Trải Nghiệm
          </h1>
          <p className="font-body text-sm sm:text-base text-[var(--aura-chrome-soft)] max-w-2xl mx-auto font-light leading-relaxed">
            Từ sân ngoài trời thoáng gió, tầng thượng ngắm sao, đến phòng container
            mát lạnh yên tĩnh — mỗi khu mang một cảm giác hoàn toàn khác biệt.
          </p>
        </div>

        {/* ── Zone summary cards ───────────────────────────────────────── */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-12 sm:mb-14">
          {(Object.entries(ZONE_META) as [Exclude<ZoneFilter, 'TẤT CẢ'>, typeof ZONE_META[keyof typeof ZONE_META]][]).map(
            ([zone, meta]) => {
              const Icon = meta.icon;
              const isActive = activeFilter === zone;
              return (
                <button
                  key={zone}
                  type="button"
                  onClick={() => setActiveFilter(zone)}
                  className={`text-left p-5 min-h-[44px] rounded-2xl border transition-all duration-300 cursor-pointer group ${
                    isActive
                      ? 'border-[var(--aura-chrome-bright)] bg-[var(--aura-chrome-bright)]/8 shadow-[0_0_20px_rgba(232,238,243,0.08)]'
                      : 'border-white/10 bg-white/[0.02] hover:border-white/20 hover:bg-white/5'
                  }`}
                >
                  <div className="flex items-center gap-3 mb-3">
                    <div
                      className={`w-9 h-9 rounded-xl flex items-center justify-center transition-colors ${
                        isActive
                          ? 'bg-[var(--aura-chrome-bright)]/15 text-[var(--aura-chrome-bright)]'
                          : 'bg-white/5 text-[var(--aura-chrome-mid)]'
                      }`}
                    >
                      <Icon className="w-4.5 h-4.5" aria-hidden="true" />
                    </div>
                    <span
                      className={`text-xs font-bold uppercase tracking-widest transition-colors ${
                        isActive ? 'text-[var(--aura-chrome-bright)]' : 'text-[var(--aura-chrome-mid)]'
                      }`}
                    >
                      {zone}
                    </span>
                  </div>
                  <p className="text-sm text-white font-medium mb-1">{meta.tagline}</p>
                  <p className="text-xs text-[var(--aura-chrome-soft)] leading-relaxed">{meta.note}</p>
                </button>
              );
            },
          )}
        </div>

        {/* ── Filter pills ─────────────────────────────────────────────── */}
        <nav
          className="flex justify-start sm:justify-center gap-2 sm:gap-4 mb-10 overflow-x-auto pb-3 px-1 max-w-full scroll-smooth no-scrollbar"
          aria-label="Bộ lọc không gian"
        >
          {FILTERS.map((f) => (
            <button
              key={f}
              type="button"
              onClick={() => setActiveFilter(f)}
              className={`px-4 sm:px-5 py-2.5 min-h-[44px] inline-flex items-center justify-center rounded-full text-xs font-bold uppercase tracking-wider transition-all cursor-pointer whitespace-nowrap shrink-0 ${
                activeFilter === f
                  ? 'bg-[var(--aura-chrome-bright)] text-[var(--aura-noir-deep)] shadow-lg scale-105'
                  : 'bg-white/5 border border-white/10 text-[var(--aura-chrome-mid)] hover:border-[var(--aura-chrome-bright)] hover:text-white'
              }`}
            >
              {f}
            </button>
          ))}
        </nav>

        {/* ── Gallery Grid ─────────────────────────────────────────────── */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {filteredItems.map((item) => (
            <div
              key={item.id}
              onClick={() => setModalImage(item)}
              className="group cursor-pointer rounded-2xl overflow-hidden bg-white/5 border border-white/10 hover:border-[var(--aura-chrome-mid)]/60 transition-all duration-300 shadow-xl flex flex-col"
            >
              <div className="relative aspect-[4/3] overflow-hidden bg-black/40">
                <img
                  className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-105"
                  alt={item.title}
                  src={item.image}
                  loading="lazy"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity flex items-end p-4">
                  <span className="text-xs text-white uppercase tracking-wider flex items-center gap-1 font-semibold">
                    <ZoomIn className="w-4 h-4" /> Xem ảnh lớn
                  </span>
                </div>
              </div>
              <div className="p-5 flex-1 flex flex-col justify-between">
                <div>
                  <span className="text-[10px] font-bold tracking-widest uppercase text-[#4A7C59] block mb-1">
                    {item.category}
                  </span>
                  <h3 className="font-display text-lg text-white font-medium mb-1">{item.title}</h3>
                  <p className="font-body text-xs text-[var(--aura-chrome-soft)] line-clamp-2">
                    {item.description}
                  </p>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* ── Lightbox Modal ─────────────────────────────────────────────── */}
      {modalImage && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label={modalImage.title}
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/90 p-4 backdrop-blur-md"
          onClick={() => setModalImage(null)}
        >
          <div
            className="relative max-w-4xl w-full bg-[#0a1a2e] border border-white/20 rounded-2xl overflow-hidden"
            onClick={(e) => e.stopPropagation()}
          >
            <button
              type="button"
              onClick={() => setModalImage(null)}
              aria-label="Đóng ảnh"
              className="absolute top-4 right-4 z-10 w-11 h-11 min-h-[44px] min-w-[44px] rounded-full bg-black/60 text-white flex items-center justify-center hover:bg-white hover:text-black transition-all cursor-pointer"
            >
              <X className="w-6 h-6" />
            </button>
            <img
              src={modalImage.image}
              alt={modalImage.title}
              className="w-full max-h-[75vh] object-contain bg-black/50"
            />
            <div className="p-6">
              <span className="text-xs text-[#4A7C59] font-bold uppercase tracking-wider">
                {modalImage.category}
              </span>
              <h3 className="font-display text-2xl text-white mt-1 mb-2">{modalImage.title}</h3>
              <p className="font-body text-sm text-[var(--aura-chrome-soft)]">{modalImage.description}</p>
            </div>
          </div>
        </div>
      )}

      <LandingFooter />
    </div>
  );
}
