import { useState, type ReactNode } from 'react';
import { resolveMenuDrinkPackshots, menuImageVariants } from '@/lib/menu-drink-images';
import type { MenuItemData } from './StitchMenuNew-types';

interface StitchMenuNewMenuPhotoProps {
  item: Pick<MenuItemData, 'id' | 'imageSrc' | 'imageAlt'>;
  children: ReactNode;
}

/**
 * Card image with per-device sizing.
 *
 * `sizes` mirrors the grid in StitchMenuNew.tsx (grid-cols-1 sm:grid-cols-2
 * lg:grid-cols-3 xl:grid-cols-4 inside max-w-7xl px-6). It has to stay in sync
 * with that markup: overstating the width makes the browser download a variant
 * larger than the slot, understating it makes the card look soft.
 */
const SIZES = '(max-width: 639px) 92vw, (max-width: 1023px) 46vw, (max-width: 1279px) 30vw, 293px';

function srcSet(variants: ReturnType<typeof menuImageVariants>, format: 'avif' | 'webp') {
  return variants
    .filter((variant) => variant.format === format)
    .map((variant) => `${variant.src} ${variant.width}w`)
    .join(', ');
}

interface CardImageProps {
  src: string;
  alt: string;
  responsive: boolean;
  onError: () => void;
}

/**
 * A single <img>, wrapped in <picture> when multiple widths exist.
 *
 * Packshots are deliberately not resized: they are product packshots whose
 * framing carries the label, and the grid gives them an object-contain box.
 */
function CardImage({ src, alt, responsive, onError }: CardImageProps) {
  const shared = {
    alt,
    className: responsive
      ? 'h-full w-full object-cover transition-transform duration-700 group-hover:scale-105'
      : 'h-full min-w-0 flex-1 object-contain',
    loading: 'lazy' as const,
    onError,
  };

  if (!responsive) return <img src={src} {...shared} />;

  const variants = menuImageVariants(src);
  const avif = srcSet(variants, 'avif');
  const webp = srcSet(variants, 'webp');

  return (
    <picture>
      {avif ? <source type="image/avif" srcSet={avif} sizes={SIZES} /> : null}
      <img
        src={variants.find((variant) => variant.width === 1200 && variant.format === 'webp')?.src ?? src}
        srcSet={webp}
        sizes={SIZES}
        decoding="async"
        {...shared}
      />
    </picture>
  );
}

export function StitchMenuNewMenuPhoto({ item, children }: StitchMenuNewMenuPhotoProps) {
  const [failedSources, setFailedSources] = useState<string[]>([]);
  const packshots = resolveMenuDrinkPackshots(item.id, item.imageSrc);
  const images = packshots ?? [{ src: item.imageSrc, alt: item.imageAlt }];

  if (images.filter((image) => image.src && !failedSources.includes(image.src)).length === 0) {
    return children;
  }

  const markFailed = (src: string) => () =>
    setFailedSources((previous) => [...previous, src]);

  return (
    <div className={packshots ? 'flex h-full w-full items-center justify-center gap-4 bg-[#efe9dc] px-6 py-8' : 'h-full w-full'}>
      {images
        .filter((image) => image.src && !failedSources.includes(image.src))
        .map((image) => (
          <CardImage
            key={image.src}
            src={image.src}
            alt={image.alt}
            responsive={!packshots}
            onError={markFailed(image.src)}
          />
        ))}
    </div>
  );
}
