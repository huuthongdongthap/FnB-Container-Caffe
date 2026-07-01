import { cn } from '@/lib/cn';

interface ZoneColorsProps {
  className?: string;
}

const ZONES = [
  {
    name: 'Jade Counter',
    color: '#2D5A3D',
    token: '--aura-forest-primary',
    description: 'Quầy bar xanh lục — Mộc energy, giao tiếp, pha chế.',
    hex: '#2D5A3D',
  },
  {
    name: 'Sky Deck',
    color: '#6B9FB8',
    token: '--aura-chrome-mid',
    description: 'Rooftop thoáng — Chrome trung, kết nối trời & đất.',
    hex: '#6B9FB8',
  },
  {
    name: 'Noir Cabin',
    color: '#1A1A2E',
    token: '--aura-noir-void',
    description: 'Cabin tối — Thủy tĩnh lặng, riêng tư, sâu lắng.',
    hex: '#1A1A2E',
  },
  {
    name: 'Aura Lounge',
    color: '#C9D6DF',
    token: '--aura-chrome-light',
    description: 'Lounge ánh bạc — Kim sáng, xa hoa, thư giãn.',
    hex: '#C9D6DF',
  },
  {
    name: 'VIP Steel Nest',
    color: '#3A6B80',
    token: '--aura-steel-matte',
    description: 'Phòng thép tối — Thép xanh, đẳng cấp, riêng biệt.',
    hex: '#3A6B80',
  },
];

export function ZoneColors({ className }: ZoneColorsProps) {
  return (
    <section className={cn('space-y-6', className)}>
      <div>
        <h2 className="font-display text-2xl font-bold text-foreground">
          Zone Colors
        </h2>
        <p className="mt-2 text-muted">
          Mỗi khu vực trong không gian AURA CAFE mang một màu sắc chủ đạo riêng.
        </p>
      </div>

      <div className="grid gap-4 md:grid-cols-5">
        {ZONES.map((zone) => (
          <div
            key={zone.name}
            className="group rounded-2xl border border-border bg-card overflow-hidden transition-all duration-200 hover:border-accent/30"
          >
            {/* Color bar */}
            <div
              className="h-16 w-full"
              style={{ backgroundColor: zone.color }}
            />

            {/* Info */}
            <div className="p-4">
              <h3 className="font-display text-base font-semibold text-foreground">
                {zone.name}
              </h3>
              <code className="mt-1 block text-xs text-muted">{zone.token}</code>
              <span className="mt-1 inline-block rounded bg-accent/10 px-2 py-0.5 font-mono text-xs text-accent">
                {zone.hex}
              </span>
              <p className="mt-2 text-xs leading-relaxed text-muted">
                {zone.description}
              </p>
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}
