/* ── Stitch: aura_cafe_customer_reviews ────────────────────────────── */
/* Source: stitch_aura_cafe/aura_cafe_customer_reviews/code.html */

import { useState } from 'react';
import { StitchShell, StitchNav } from '../StitchBase';
import { PageFooter } from '@/components/stitch/StitchLayout';
import { FILTERS, REVIEWS } from './review-constants';
import { ReviewCard } from './review-card';

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
