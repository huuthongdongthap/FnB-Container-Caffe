'use client';

import type { ContainerCafeData } from './stitch-container-new1-types';

/**
 * Nocturnal Lounge section with image + feature list.
 */
export function LoungeSection({ data }: { data: ContainerCafeData }) {
  return (
    <section id="lounge" className="py-20">
      <div
        className="flex flex-col overflow-hidden rounded-xl md:flex-row"
        style={{
          backgroundColor: 'rgba(25, 45, 75, 0.8)',
          backdropFilter: 'blur(20px)',
          WebkitBackdropFilter: 'blur(20px)',
          border: '1px solid rgba(198, 198, 199, 0.3)',
        }}
      >
        {/* Image side */}
        <div className="relative h-[500px] md:w-1/2">
          <img
            className="h-full w-full object-cover"
            src={data.loungeImageUrl}
            alt={data.loungeImageAlt}
            loading="lazy"
          />
          <div className="absolute inset-0 bg-gradient-to-r from-transparent to-[#0c2038]" />
        </div>

        {/* Text side */}
        <div className="flex flex-col justify-center p-20 md:w-1/2">
          {/* Tag */}
          <span
            className="mb-3 text-xs uppercase leading-[1.0] tracking-[0.2em]"
            style={{
              fontFamily: "'Space Grotesk', sans-serif",
              fontWeight: 600,
              color: 'var(--aura-chrome-bright)',
            }}
          >
            {data.loungeTag}
          </span>

          <h2
            className="mb-6 text-[48px] leading-[1.1] tracking-[-0.02em]"
            style={{
              fontFamily: "'EB Garamond', Georgia, serif",
              fontWeight: 500,
              color: 'var(--aura-chrome-bright)',
            }}
          >
            {data.loungeTitle}
          </h2>

          <p
            className="mb-12 text-lg"
            style={{
              fontFamily: "'Space Grotesk', sans-serif",
              lineHeight: '1.6',
              color: 'var(--aura-chrome-soft)',
            }}
          >
            {data.loungeDescription}
          </p>

          {/* Features */}
          <div className="space-y-6">
            {data.loungeFeatures.map((feature) => (
              <div
                key={feature.id}
                className="flex items-start gap-6 pb-6"
                style={{ borderBottom: '0.5px solid rgba(198, 198, 199, 0.4)' }}
              >
                <span
                  className="text-[24px] leading-[1.4] italic"
                  style={{
                    fontFamily: "'EB Garamond', Georgia, serif",
                    fontWeight: 400,
                    color: 'var(--aura-chrome-bright)',
                  }}
                >
                  {feature.number}
                </span>
                <div>
                  <h5
                    className="mb-1 text-[14px] uppercase leading-[1.0] tracking-[0.1em]"
                    style={{
                      fontFamily: "'Space Grotesk', sans-serif",
                      fontWeight: 500,
                      color: 'var(--aura-chrome-bright)',
                    }}
                  >
                    {feature.title}
                  </h5>
                  <p
                    className="text-base"
                    style={{
                      fontFamily: "'Space Grotesk', sans-serif",
                      lineHeight: '1.6',
                      color: 'var(--aura-chrome-soft)',
                    }}
                  >
                    {feature.description}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
