import { useTranslation } from 'react-i18next';
import { HeroSection } from '@/components/home/HeroSection';
import { FeaturedMenu } from '@/components/home/featured-menu';
import { FiveZoneShowcase } from '@/components/home/five-zone-showcase';
import { TestimonialCarousel } from '@/components/home/testimonial-carousel';
import { LocationMap } from '@/components/home/location-map';

export function HomePage() {
  const { t } = useTranslation('home');

  return (
    <>
      <HeroSection />

      {/* Stats strip */}
      <section className="bg-[#0A1A2E] py-10" aria-label={t('statsLabel')}>
        <div className="mx-auto max-w-6xl px-4 md:px-6">
          <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
            <div className="rounded-xl border border-chrome-light/10 bg-white/5 p-5 text-center backdrop-blur-sm transition-colors hover:bg-white/10">
              <p className="font-display text-3xl font-bold text-chrome-bright md:text-4xl">5</p>
              <p className="mt-1 text-xs text-chrome-light/60">{t('stats.spaces')}</p>
            </div>
            <div className="rounded-xl border border-chrome-light/10 bg-white/5 p-5 text-center backdrop-blur-sm transition-colors hover:bg-white/10">
              <p className="font-display text-3xl font-bold text-chrome-bright md:text-4xl">100%</p>
              <p className="mt-1 text-xs text-chrome-light/60">{t('stats.coffee')}</p>
            </div>
            <div className="rounded-xl border border-chrome-light/10 bg-white/5 p-5 text-center backdrop-blur-sm transition-colors hover:bg-white/10">
              <p className="font-display text-3xl font-bold text-chrome-bright md:text-4xl">360&deg;</p>
              <p className="mt-1 text-xs text-chrome-light/60">{t('stats.vision')}</p>
            </div>
            <div className="rounded-xl border border-chrome-light/10 bg-white/5 p-5 text-center backdrop-blur-sm transition-colors hover:bg-white/10">
              <p className="font-display text-3xl font-bold text-chrome-bright md:text-4xl">30+</p>
              <p className="mt-1 text-xs text-chrome-light/60">{t('stats.seats')}</p>
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
