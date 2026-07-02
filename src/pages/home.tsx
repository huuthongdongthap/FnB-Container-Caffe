import { HelmetHead } from '@/components/seo/HelmetHead';
import { HeroSection } from '@/components/home/hero-section';
import { FeaturedMenu } from '@/components/home/featured-menu';
import { FiveZoneShowcase } from '@/components/home/five-zone-showcase';
import { TestimonialCarousel } from '@/components/home/testimonial-carousel';
import { LocationMap } from '@/components/home/location-map';

export function HomePage() {
  return (
    <>
      <HelmetHead
        title="Container Caffe Sa Đéc"
        description="AURA CAFE — Quán cà phê container industrial-luxury tại Sa Đéc, Đồng Tháp. 5 không gian độc đáo: Jade Counter, Sky Deck, Noir Cabin, Aura Lounge, VIP Steel Nest."
        ogImage="/images/night-4k.webp"
        ogType="website"
        canonical="/"
      />
      {/* JSON-LD Structured Data */}
      <script type="application/ld+json">
        {JSON.stringify({
          "@context": "https://schema.org",
          "@type": "CafeOrCoffeeShop",
          "name": "AURA CAFE",
          "description": "Quán cà phê container industrial-luxury tại Sa Đéc, Đồng Tháp",
          "url": "https://auraspace.cafe",
          "telephone": "0946013633",
          "address": {
            "@type": "PostalAddress",
            "addressLocality": "Sa Đéc",
            "addressRegion": "Đồng Tháp",
            "addressCountry": "VN"
          },
          "servesCuisine": ["Cà phê", "Trà", "Đồ uống", "Bánh ngọt"],
          "priceRange": "10,000₫ - 100,000₫"
        })}
      </script>

      {/* Stats strip */}
      <section className="bg-[#0A1A2E] py-10" aria-label="AURA CAFE số liệu">
        <div className="mx-auto max-w-6xl px-4">
          <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
            <div className="rounded-xl border border-chrome-light/10 bg-white/5 p-5 text-center backdrop-blur-sm transition-colors hover:bg-white/10">
              <p className="font-display text-3xl font-bold text-chrome-bright md:text-4xl">5</p>
              <p className="mt-1 text-xs text-chrome-light/60">Zone Không Gian</p>
            </div>
            <div className="rounded-xl border border-chrome-light/10 bg-white/5 p-5 text-center backdrop-blur-sm transition-colors hover:bg-white/10">
              <p className="font-display text-3xl font-bold text-chrome-bright md:text-4xl">100%</p>
              <p className="mt-1 text-xs text-chrome-light/60">Cà Phê Mộc</p>
            </div>
            <div className="rounded-xl border border-chrome-light/10 bg-white/5 p-5 text-center backdrop-blur-sm transition-colors hover:bg-white/10">
              <p className="font-display text-3xl font-bold text-chrome-bright md:text-4xl">360&deg;</p>
              <p className="mt-1 text-xs text-chrome-light/60">Tầm Nhìn</p>
            </div>
            <div className="rounded-xl border border-chrome-light/10 bg-white/5 p-5 text-center backdrop-blur-sm transition-colors hover:bg-white/10">
              <p className="font-display text-3xl font-bold text-chrome-bright md:text-4xl">30+</p>
              <p className="mt-1 text-xs text-chrome-light/60">Chỗ Ngồi</p>
            </div>
          </div>
        </div>
      </section>

      <FeaturedMenu />
      <FiveZoneShowcase />
      <TestimonialCarousel />
      <LocationMap />
    </>
  );
}
