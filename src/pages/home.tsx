import { HelmetHead } from '@/components/seo/HelmetHead';
import { HeroSection } from '@/components/home/hero-section';
import { FeaturedMenu } from '@/components/home/featured-menu';
import { FiveZoneShowcase } from '@/components/home/five-zone-showcase';
import { TestimonialCarousel } from '@/components/home/testimonial-carousel';
import { LocationMap } from '@/components/home/location-map';
import { useReviews, useReviewsStats } from '@/hooks/use-reviews';
import { ReviewCard } from '@/components/reviews/ReviewCard';
import { RatingStars } from '@/components/reviews/RatingStars';
import { Button } from '@/components/ui/button';
import { Link } from 'react-router-dom';

export function HomePage() {
  const { data: reviewsData } = useReviews(1, 5);
  const { data: stats } = useReviewsStats();
  const reviews = reviewsData?.data ?? [];

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

      {/* Customer Reviews section */}
      <section className="bg-gradient-to-b from-[#0A1A2E] to-[#050D1A] py-20" aria-label="Khách hàng đánh giá">
        <div className="mx-auto max-w-6xl px-4">
          <div className="mb-10 text-center">
            <span className="text-xs font-semibold uppercase tracking-[0.2em] text-chrome-mid/60">
              KHÁCH HÀNG NÓI GÌ
            </span>
            <h2 className="mt-3 font-display text-3xl font-bold text-chrome-bright sm:text-4xl">
              Khách Hàng Nói Gì Về Chúng Tôi
            </h2>
            {stats && (
              <div className="mt-4 flex items-center justify-center gap-2 text-sm text-chrome-light/60">
                <RatingStars rating={Math.round(stats.average_rating)} size="sm" />
                <span>{stats.average_rating.toFixed(1)} / 5.0</span>
                <span className="text-chrome-light/40">({stats.total_reviews} đánh giá)</span>
              </div>
            )}
          </div>

          {reviews.length > 0 && (
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {reviews.slice(0, 3).map((review) => (
                <ReviewCard key={review.id} review={review} />
              ))}
            </div>
          )}

          <div className="mt-8 text-center">
            <Link to="/reviews">
              <Button variant="ghost">
                Xem tất cả đánh giá &rarr;
              </Button>
            </Link>
          </div>
        </div>
      </section>

      <LocationMap />
    </>
  );
}
