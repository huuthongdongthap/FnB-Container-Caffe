'use client';

import { Layers, Settings2 } from 'lucide-react';
import { DetailCard } from './stitch-container-new1-detail-card';
import type { ContainerCafeData } from './stitch-container-new1-types';

/**
 * "The Container Aesthetic" bento grid section.
 */
export function BentoSection({ data }: { data: ContainerCafeData }) {
  return (
    <section id="aesthetic">
      {/* Section heading */}
      <div className="mb-6">
        <h2
          className="text-[48px] leading-[1.1] tracking-[-0.02em]"
          style={{
            fontFamily: "'EB Garamond', Georgia, serif",
            fontWeight: 500,
            color: 'var(--aura-chrome-bright)',
          }}
        >
          {data.sectionTitle}
        </h2>
        <div className="mt-3 h-[1px] w-24" style={{ backgroundColor: 'var(--aura-chrome-bright)' }} />
      </div>

      <div className="grid grid-cols-1 gap-6 md:grid-cols-12 md:items-stretch">
        {/* Main Feature Card (md:col-span-7) */}
        <div
          className="glass-panel group flex flex-col justify-between md:col-span-7"
          style={{
            padding: '48px',
            backgroundColor: 'rgba(18, 37, 61, 0.6)',
            backdropFilter: 'blur(12px)',
            WebkitBackdropFilter: 'blur(12px)',
            border: '1px solid rgba(198, 198, 199, 0.15)',
          }}
        >
          <div>
            <h3
              className="mb-6 text-[32px] leading-[1.3] italic"
              style={{
                fontFamily: "'EB Garamond', Georgia, serif",
                fontWeight: 400,
                color: 'var(--aura-chrome-bright)',
              }}
            >
              {data.featureCardTitle}
            </h3>
            <p
              className="text-base"
              style={{
                fontFamily: "'Space Grotesk', sans-serif",
                lineHeight: '1.6',
                color: 'var(--aura-chrome-soft)',
              }}
            >
              {data.featureCardText}
            </p>
          </div>

          {/* Image */}
          <div className="relative mt-12 overflow-hidden rounded-lg aspect-video">
            <div
              className="pointer-events-none absolute inset-0 z-10 opacity-20"
              style={{
                backgroundColor: 'rgba(18, 37, 61, 0.6)',
                backdropFilter: 'blur(12px)',
              }}
            />
            <img
              className="h-full w-full object-cover transition-transform duration-700 group-hover:scale-110 grayscale-[0.5]"
              src={data.featureImageUrl}
              alt={data.featureImageAlt}
              loading="lazy"
            />
          </div>
        </div>

        {/* Detail Cards Column (md:col-span-5) */}
        <div className="flex flex-col gap-6 md:col-span-5">
          {data.detailCards.map((card) => (
            <DetailCard
              key={card.id}
              icon={
                card.id === 'frosted-glass'
                  ? <Layers className="h-5 w-5" />
                  : <Settings2 className="h-5 w-5" />
              }
              title={card.title}
              description={card.description}
              highlight={card.highlight}
            />
          ))}
        </div>
      </div>
    </section>
  );
}
