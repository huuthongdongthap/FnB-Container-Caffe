/* ── Stitch: aura_cafe_customer_reviews ────────────────────────────── */
import { useState, useMemo } from 'react';
import { LandingNav } from '@/components/stitch/StitchLandingNew-nav';
import { LandingFooter } from '@/components/stitch/StitchLandingNew-footer';
import { HelmetHead } from '@/components/seo/HelmetHead';
import { FILTERS, REVIEWS } from './review-constants';
import { ReviewCard } from './review-card';
import { PenLine, Star, Sparkles } from 'lucide-react';

export default function CustomerReviews() {
  const [activeFilter, setActiveFilter] = useState<string>('Tất cả');

  const filteredReviews = useMemo(() => {
    if (activeFilter === '5 Sao') {
      return REVIEWS.filter((r) => r.rating === 5);
    }
    if (activeFilter === 'Có ảnh') {
      return REVIEWS.filter((r) => r.photos && r.photos.length > 0);
    }
    return REVIEWS;
  }, [activeFilter]);

  return (
    <div className="relative min-h-screen bg-[var(--aura-noir-deep,#0a1a2e)] text-[var(--aura-chrome-bright)] selection:bg-[var(--aura-chrome-mid)] selection:text-[#0A1A2E] flex flex-col justify-between">
      <HelmetHead
        title="Đánh Giá Của Khách Hàng — AURA CAFE"
        description="Khám phá những trải nghiệm chân thực từ khách hàng tại AURA CAFE Sa Đéc. Không gian container độc bản, cà phê mộc và dịch vụ tận tâm."
        canonical="/reviews"
      />
      <LandingNav />

      <div role="feed" id="customer-reviews-feed" aria-label="Customer Reviews Stream" className="comment-list reviews-feed-container pt-28 pb-16 md:pb-24 max-w-[1200px] mx-auto px-5 md:px-16 w-full flex-1">
        {/* Header */}
        <section className="flex flex-col md:flex-row justify-between items-start md:items-end mb-16 gap-6">
          <div>
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-[var(--aura-chrome-mid)]/10 border border-[var(--aura-chrome-mid)]/20 mb-3">
              <Sparkles className="w-3.5 h-3.5 text-[var(--aura-chrome-bright)]" />
              <span className="text-[var(--aura-chrome-mid)] text-xs uppercase tracking-widest font-semibold font-body">
                Trải Nghiệm Độc Bản
              </span>
            </div>
            <h1 className="font-display text-4xl md:text-5xl lg:text-6xl text-[var(--aura-chrome-bright)] mb-4 leading-tight">
              Khách Hàng Nói Về AURA
            </h1>
            <div className="flex items-center gap-4 flex-wrap">
              <span className="font-display text-3xl text-white font-bold">4.9/5</span>
              <div className="flex gap-1 text-amber-400">
                {Array.from({ length: 5 }, (_, i) => (
                  <Star key={i} className="w-5 h-5 fill-current" />
                ))}
              </div>
              <span className="font-body text-xs text-[var(--aura-chrome-mid)] uppercase tracking-[0.2em]">
                1.248 Lượt Đánh Giá Tại Sa Đéc
              </span>
            </div>
          </div>

          <a
            href="https://maps.app.goo.gl/KMKbeDY4gM2FBBpw9"
            target="_blank"
            rel="noopener noreferrer"
            className="bg-[var(--aura-chrome-bright)] hover:bg-white text-[var(--aura-noir-deep)] flex items-center gap-2.5 px-8 py-3.5 rounded-full font-body text-xs font-bold uppercase tracking-widest transition-all duration-300 shadow-xl active:scale-95 shrink-0"
          >
            <PenLine className="w-4 h-4" />
            Viết Đánh Giá
          </a>
        </section>

        {/* Filters */}
        <section className="mb-10 overflow-x-auto pb-2">
          <div className="flex gap-3 min-w-max">
            {FILTERS.map((filter) => (
              <button
                key={filter}
                onClick={() => setActiveFilter(filter)}
                className={`px-6 py-2.5 rounded-full font-body text-xs font-semibold uppercase tracking-wider transition-all duration-300 ${
                  filter === activeFilter
                    ? 'bg-[var(--aura-chrome-bright)] text-[var(--aura-noir-deep)] shadow-lg shadow-[rgba(201,214,223,0.2)]'
                    : 'bg-white/5 backdrop-blur-[8px] border border-white/10 text-[var(--aura-chrome-mid)] hover:text-white hover:border-[var(--aura-chrome-mid)]/40'
                }`}
              >
                {filter}
              </button>
            ))}
          </div>
        </section>

        {/* Review Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {filteredReviews.map((review, i) => (
            <ReviewCard key={review.name + i} review={review} isFeatured={i === 0 && activeFilter === 'Tất cả'} />
          ))}
        </div>
      </div>

      {/* Footer */}
      <LandingFooter />
    </div>
  );
}
