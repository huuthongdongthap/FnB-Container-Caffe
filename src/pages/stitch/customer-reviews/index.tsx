/* ── Stitch: aura_cafe_customer_reviews ────────────────────────────── */
/* Source: stitch_aura_cafe/aura_cafe_customer_reviews/code.html */

import { useState } from 'react';
import { StitchShell, StitchNav } from '../StitchBase';
import { PageHeader, PageFooter } from '@/components/stitch/StitchLayout'

const FILTERS = ['All', '5 Star', 'Photo', 'Latest'] as const;

interface Review {
  name: string;
  initials: string;
  date: string;
  rating: number;
  text: string;
  likes: number;
  isChefsChoice?: boolean;
  photos?: string[];
}

const REVIEWS: Review[] = [
  {
    name: 'Isabella Vane',
    initials: 'IV',
    date: 'Oct 14, 2023',
    rating: 5,
    text: '"The midnight espresso selection is unparalleled. The industrial architecture of the space creates a cocoon of luxury that makes every visit feel like a secret ritual. The texture of the velvet seating against the cold steel is pure sensory genius."',
    likes: 42,
    isChefsChoice: true,
    photos: [
      'https://lh3.googleusercontent.com/aida-public/AB6AXuAIkJkLEhh-JIpZhIAzqfMhhYbYnd1pfAjiUu7WCfxGO-hkBGjkWkxrysLkQFz7Wk6Dquqde11XlB8vqlCkScep50xLHZLl1dqtyvhzIaTqdhhGk2nUvb1OLaYKqr33X5vgGc1xRoNkmsHooRsxRt4Gq3YdXzPNkWoePeYxfjBER26Gh1XnVBGVAId6AK37X8G0If0vZXcqGYMGPl_GOKt3TTS39-Zmqu1rIWOu9PtobvagRB-e_UcM51EUA8VemSiJoasQiUKAj5A',
      'https://lh3.googleusercontent.com/aida-public/AB6AXuDY0kZTzu_eDCzdeNtwOb5PDzk6AfBvfpyjeWYa5QzAiHJ-V7rJxv6OhovjTg1Ca882ie74XGdCsyf9DJuMbTBSChCk_g466fqeUEM8buyQg6-QN3uEko28b9oLrb9QJBycRc3Mph8WR4k4kdHoWKQ78slLnQqlORIUn0U9qs3H1Ei6Xi4C6iVwaMnkXjBdk_FpN18e_pQEV9uHpz12Eb1QdQPytGC2_P5hW4zauK1GcNBAptGSjej-2LKVGjjtKRlDeaJKOb77MdA',
    ],
  },
  {
    name: 'Julian Thorne',
    initials: 'JT',
    date: 'Oct 12, 2023',
    rating: 4,
    text: 'A masterclass in atmosphere. The lighting design alone is worth the reservation. Perfect for late-night meetings where privacy and aesthetics are paramount.',
    likes: 18,
    photos: [
      'https://lh3.googleusercontent.com/aida-public/AB6AXuBkfvITRussIW0rvnfjcteP4oPrgMESCj_3jKFknxAbcunHPHF88S5dZD2S3ybXK5KxveDqm99bXCiJT6L2_ko1AipvopRS8Y6fgVcUkE1O7jSEhDw34b_I6kQ49pR_-7I0ryKgwWkBk1OvmaZFnLVbyX4hnEvWzb_88hZJijVKL_ygD8dIt7pvuto86_uyzrEn8ucykKvla9s5kc8ZGNEn-jG0IALJe3QIpuThXsyLHJ18oIRjKvC5avIA44wfXVRkNUzm42Yij2k',
    ],
  },
  {
    name: 'Sienna Ray',
    initials: 'SR',
    date: 'Oct 09, 2023',
    rating: 5,
    text: 'The smoked truffle croissant is a revelation. I\'ve never seen such attention to detail in cafe service. It feels more like a private lounge than a cafe.',
    likes: 24,
  },
  {
    name: 'Marcus Sterling',
    initials: 'MS',
    date: 'Oct 05, 2023',
    rating: 5,
    text: 'Aura provides the precision I require. Quiet, dark, and perfectly balanced. The architecture speaks to a forgotten era of high-end craftsmanship.',
    likes: 12,
  },
  {
    name: 'Leo Chen',
    initials: 'LC',
    date: 'Sep 28, 2023',
    rating: 5,
    text: 'Unreal aesthetics. Every corner is a photograph waiting to happen. The Dark Velvet latte is a must-try.',
    likes: 89,
    photos: [
      'https://lh3.googleusercontent.com/aida-public/AB6AXuC8u_4wEl-rwdM8Hd9TgLS0ObzY6HdeIWjzv_PSQGKLNOueo8BoU59WNmUTimKCNUBdsSq0VXiQ4wDRhn0AggL4fDq1bT4829jW4woP05iP6g7ycQnIq25y9JU-KYLTU8ujLEOMJyijEvvgvBLhtfwkYqdQ-BfFsBNlMIxO0bms-ilqVJ49Xl8W80pcK3FR0rwm7WspFFUOHGG2ELxNLJEf8GJpSYIJ3I91UF9idV71wiVLuusdwJGvxNSoY_2PO-O8Ff0SNhBv6UQ',
    ],
  },
  {
    name: 'Elena K.',
    initials: 'EK',
    date: 'Sep 25, 2023',
    rating: 4,
    text: 'The acoustic dampening here is incredible. Even when full, it maintains this serene, heavy silence that is so rare in the city.',
    likes: 5,
  },
] as const;

function StarRating({ rating }: { rating: number }) {
  return (
    <div className="flex gap-0.5">
      {Array.from({ length: 5 }, (_, i) => (
        <span key={i} className={`text-sm ${i < rating ? 'text-[var(--aura-chrome-mid)]' : 'text-[var(--aura-chrome-dark)]/30'}`}>
          {i < rating ? '★' : '★'}
        </span>
      ))}
    </div>
  );
}

function HeartButton({ likes }: { likes: number }) {
  const [liked, setLiked] = useState(false);
  const [count, setCount] = useState(likes);

  const toggle = () => {
    setLiked((prev) => !prev);
    setCount((prev) => (liked ? prev - 1 : prev + 1));
  };

  return (
    <button
      onClick={toggle}
      className={`flex items-center gap-1 transition-colors ${liked ? 'text-red-400' : 'text-[var(--aura-chrome-dark)]/60 hover:text-red-400'}`}
    >
      <span className="text-lg">{liked ? '❤️' : '🤍'}</span>
      <span className="font-body text-xs">{count}</span>
    </button>
  );
}

function ReviewCard({
  review,
  isFeatured,
}: {
  review: (typeof REVIEWS)[number];
  isFeatured: boolean;
}) {
  const hasPhotos = review.photos && review.photos.length > 0;

  return (
    <div
      className={`rounded-2xl p-6 md:p-8 flex flex-col gap-4 transition-all duration-300 relative overflow-hidden group ${
        isFeatured
          ? 'bg-white/5 backdrop-blur-xl border border-[var(--aura-tertiary)]/30 shadow-[inset_0_0_10px_rgba(212,165,116,0.1)]'
          : 'bg-white/5 backdrop-blur-xl border border-white/10 hover:border-[var(--aura-chrome-mid)]/20'
      }`}
    >
      {isFeatured && (
        <div className="absolute top-3 right-3">
          <span className="bg-[#291500] text-[var(--aura-tertiary)] font-body text-[10px] px-2 py-1 rounded-full uppercase tracking-tighter">
            Chef&apos;s Choice
          </span>
        </div>
      )}

      {/* Header */}
      <div className="flex items-center gap-4">
        <div className="w-12 h-12 rounded-full overflow-hidden border border-[var(--aura-chrome-dark)]/30 shrink-0">
          <div className="w-full h-full bg-[var(--aura-noir-deep)] flex items-center justify-center">
            <span className="font-body text-sm text-[var(--aura-chrome-bright)]">{review.initials}</span>
          </div>
        </div>
        <div>
          <h3 className="font-display text-lg text-[var(--aura-chrome-bright)]">{review.name}</h3>
          <StarRating rating={review.rating} />
        </div>
      </div>

      {/* Text */}
      <p className="font-body text-[var(--aura-chrome-mid)] leading-relaxed text-sm md:text-base">{review.text}</p>

      {/* Photos */}
      {hasPhotos && (
        <div
          className={`grid gap-2 mt-2 ${review.photos!.length >= 2 ? 'grid-cols-2' : ''}`}
        >
          {review.photos!.map((src, i) => (
            <div key={i} className="h-32 md:h-36 rounded-lg overflow-hidden bg-white/5 backdrop-blur-xl">
              <img
                src={src}
                alt={`${review.name} review photo ${i + 1}`}
                className="w-full h-full object-cover"
                loading="lazy"
              />
            </div>
          ))}
        </div>
      )}

      {/* Footer */}
      <div className="flex justify-between items-center mt-auto pt-4 border-t border-white/5">
        <span className="font-body text-xs text-[var(--aura-chrome-dark)]/60 uppercase tracking-widest">
          {review.date}
        </span>
        <HeartButton likes={review.likes} />
      </div>
    </div>
  );
}

export default function CustomerReviews() {
  const [activeFilter, setActiveFilter] = useState<string>('All');

  return (
    <StitchShell>
      <StitchNav ctaLabel="Book a Table" />

      <main className="pt-24 pb-16 md:pb-24 max-w-[1200px] mx-auto px-5 md:px-16">
        {/* Header */}
        <section className="flex flex-col md:flex-row justify-between items-end md:items-center mb-16 gap-4">
          <div>
            <h1 className="font-display text-4xl md:text-5xl lg:text-6xl text-[var(--aura-chrome-bright)] mb-3 leading-tight">
              Guest Experiences
            </h1>
            <div className="flex items-center gap-4">
              <span className="font-display text-2xl text-[var(--aura-chrome-mid)]">4.9/5</span>
              <div className="flex gap-0.5">
                {Array.from({ length: 5 }, (_, i) => (
                  <span key={i} className={`text-lg ${i < 4 ? 'text-[var(--aura-chrome-mid)]' : 'text-[var(--aura-chrome-mid)]/50'}`}>
                    {i < 4 ? '★' : '★'}
                  </span>
                ))}
              </div>
              <span className="font-body text-xs text-[var(--aura-chrome-dark)]/60 uppercase tracking-[0.2em]">
                1,248 Reviews
              </span>
            </div>
          </div>

          <button className="bg-[var(--aura-chrome-mid)] text-[var(--aura-noir-deep)] flex items-center gap-2 px-8 py-4 rounded-full font-body text-xs font-bold uppercase tracking-widest transition-all hover:brightness-110 active:scale-95">
            <span>✏️</span>
            Write a Review
          </button>
        </section>

        {/* Filters */}
        <section className="mb-6 overflow-x-auto pb-4">
          <div className="flex gap-4 min-w-max">
            {FILTERS.map((filter) => (
              <button
                key={filter}
                onClick={() => setActiveFilter(filter)}
                className={`px-6 py-2 rounded-full font-body text-xs uppercase tracking-widest transition-all ${
                  filter === activeFilter
                    ? 'bg-white/5 backdrop-blur-xl border border-[var(--aura-tertiary)]/30 text-[var(--aura-tertiary)]'
                    : 'bg-white/5 backdrop-blur-xl border border-white/10 text-[var(--aura-chrome-dark)]/70 hover:text-[var(--aura-chrome-bright)] hover:border-[var(--aura-chrome-mid)]/20'
                }`}
              >
                {filter}
              </button>
            ))}
          </div>
        </section>

        {/* Review Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {REVIEWS.map((review, i) => (
            <ReviewCard key={review.name + i} review={review} isFeatured={i === 0} />
          ))}
        </div>

        {/* Loading indicator */}
        <div className="flex flex-col items-center mt-10 gap-3 opacity-40">
          <span className="font-body text-xs uppercase tracking-[0.2em] text-[var(--aura-chrome-dark)]/60">
            Loading more experiences
          </span>
          <div className="w-8 h-8 border-2 border-[var(--aura-chrome-mid)] border-t-transparent rounded-full animate-spin" />
        </div>
      </main>

      {/* Footer */}
<PageFooter
  brand="AURA CAFE"
  socialSize="sm"
  copyLine="© 2024 Aura Cafe. Precision. Darkness. Luxury."
/>
    </StitchShell>
  );
}
