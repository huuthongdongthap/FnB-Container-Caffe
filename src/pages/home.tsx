import { HeroSection } from '@/components/home/HeroSection';
import { FeaturedMenu } from '@/components/home/featured-menu';
import { FiveZoneShowcase } from '@/components/home/five-zone-showcase';
import { TestimonialCarousel } from '@/components/home/testimonial-carousel';
import { LocationMap } from '@/components/home/location-map';

export function HomePage() {
  return (
    <>
      <HeroSection />

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
