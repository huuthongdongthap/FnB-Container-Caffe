import { cn } from '@/lib/cn';
import { Box, Cloud, Moon, Sparkles } from 'lucide-react';

const CONCEPT_ICONS: Record<string, React.ElementType> = {
  box: Box,
  cloud: Cloud,
  moon: Moon,
  sparkles: Sparkles,
};

interface ContainerConceptProps {
  className?: string;
}

const ZONES = [
  {
    name: 'Jade Counter',
    description: 'Quầy bar xanh lục — không gian giao tiếp và pha chế.',
    color: 'bg-[#2D5A3D]',
    icon: 'box',
  },
  {
    name: 'Sky Deck',
    description: 'Rooftop thoáng đãng — view bầu trời và không khí mở.',
    color: 'bg-[#6B9FB8]',
    icon: 'cloud',
  },
  {
    name: 'Noir Cabin',
    description: 'Cabin tối giản — riêng tư, tĩnh lặng cho work & date.',
    color: 'bg-[#1A1A2E]',
    icon: 'moon',
  },
  {
    name: 'Aura Lounge',
    description: 'Lounge ánh bạc — thư giãn cùng ánh đèn chrome ấm.',
    color: 'bg-[#C9D6DF]',
    icon: 'sparkles',
  },
  {
    name: 'VIP Steel Nest',
    description: 'Không gian cao cấp — phòng riêng thép tối màu.',
    color: 'bg-[#3A6B80]',
    icon: '🪹',
  },
];

export function ContainerConcept({ className }: ContainerConceptProps) {
  return (
    <section className={cn('py-16', className)}>
      <div className="mx-auto max-w-6xl px-4">
        <div className="mb-12 text-center">
          <span className="font-utility text-xs font-semibold uppercase tracking-[4px] text-accent">
            Không Gian
          </span>
          <h2 className="mt-2 font-display text-3xl font-bold text-foreground md:text-4xl">
            5-Zone Concept
          </h2>
          <p className="mt-2 text-muted">
            Mỗi khu vực là một trải nghiệm riêng biệt
          </p>
        </div>

        {/* CSS-only container illustration */}
        <div className="mb-12 overflow-hidden rounded-2xl border border-border bg-card p-8">
          <div className="flex flex-wrap gap-4">
            {ZONES.slice(0, 3).map((zone) => (
              <div
                key={zone.name}
                className="flex flex-1 flex-col items-center gap-2 rounded-xl p-4 min-w-[140px]"
                style={{ backgroundColor: zone.color, opacity: 0.85 }}
              >
                <span className="text-2xl">{zone.icon}</span>
                <span className="text-center text-xs font-semibold text-white">
                  {zone.name}
                </span>
              </div>
            ))}
          </div>
          <div className="mt-4 flex flex-wrap gap-4">
            {ZONES.slice(3).map((zone) => (
              <div
                key={zone.name}
                className="flex flex-1 items-center justify-center gap-2 rounded-xl p-4 min-w-[160px]"
                style={{ backgroundColor: zone.color, opacity: 0.85 }}
              >
                <span className="text-2xl">{zone.icon}</span>
                <span className="text-center text-xs font-semibold text-white">
                  {zone.name}
                </span>
              </div>
            ))}
          </div>
        </div>

        {/* Zone details */}
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {ZONES.map((zone) => (
            <div
              key={zone.name}
              className="rounded-2xl border border-border bg-card p-6 transition-all duration-200 hover:border-accent/30"
            >
              <div className="mb-3 flex items-center gap-3">
                <div
                  className={cn(
                    'h-4 w-4 rounded-full',
                    zone.color,
                  )}
                />
                <h3 className="font-display text-lg font-semibold text-foreground">
                  {zone.name}
                </h3>
              </div>
              <p className="text-sm leading-relaxed text-muted">
                {zone.description}
              </p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
