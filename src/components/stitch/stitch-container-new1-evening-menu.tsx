'use client';

import { MenuCard } from './stitch-container-new1-menu-card';
import type { ContainerCafeData } from './stitch-container-new1-types';

/**
 * Evening Selections menu preview section.
 */
export function EveningMenu({
  data,
  onMenuItemClick,
}: {
  data: ContainerCafeData;
  onMenuItemClick?: (id: string) => void;
}) {
  return (
    <section className="space-y-6">
      <div className="text-center">
        <h2
          className="text-[48px] leading-[1.1] tracking-[-0.02em]"
          style={{
            fontFamily: "'EB Garamond', Georgia, serif",
            fontWeight: 500,
            color: 'var(--aura-chrome-bright)',
          }}
        >
          {data.menuSectionTitle}
        </h2>
        <p
          className="text-[14px] uppercase leading-[1.0] tracking-widest"
          style={{
            fontFamily: "'Space Grotesk', sans-serif",
            fontWeight: 500,
            color: '#c6c6c7',
          }}
        >
          {data.menuSectionSubtitle}
        </p>
      </div>

      {/* Grid */}
      <div className="grid grid-cols-1 gap-6 md:grid-cols-3">
        {data.menuItems.map((item) => (
          <MenuCard key={item.id} item={item} onClick={onMenuItemClick} />
        ))}
      </div>
    </section>
  );
}
