import { useState, type ReactNode } from 'react';
import { resolveMenuDrinkPackshots } from '@/lib/menu-drink-images';
import type { MenuItemData } from './StitchMenuNew-types';

interface StitchMenuNewMenuPhotoProps {
  item: Pick<MenuItemData, 'id' | 'imageSrc' | 'imageAlt'>;
  children: ReactNode;
}

export function StitchMenuNewMenuPhoto({ item, children }: StitchMenuNewMenuPhotoProps) {
  const [failedSources, setFailedSources] = useState<string[]>([]);
  const packshots = resolveMenuDrinkPackshots(item.id, item.imageSrc);
  const images = (packshots ?? [{ src: item.imageSrc, alt: item.imageAlt }])
    .filter((image) => image.src && !failedSources.includes(image.src));

  if (images.length === 0) return children;

  return (
    <div className={packshots ? 'flex h-full w-full items-center justify-center gap-4 bg-[#efe9dc] px-6 py-8' : 'h-full w-full'}>
      {images.map((image) => (
        <img
          key={image.src}
          src={image.src}
          alt={image.alt}
          className={packshots
            ? 'h-full min-w-0 flex-1 object-contain'
            : 'h-full w-full object-cover transition-transform duration-700 group-hover:scale-105'}
          loading="lazy"
          onError={() => setFailedSources((previous) => [...previous, image.src])}
        />
      ))}
    </div>
  );
}
