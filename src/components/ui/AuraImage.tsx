import { cn } from '@/lib/cn';

interface AuraImageProps extends Omit<React.ImgHTMLAttributes<HTMLImageElement>, 'loading'> {
  src: string;
  alt: string;
}

/**
 * AuraImage — picture wrapper with WebP source + PNG/fallback + lazy loading.
 *
 * Static image paths (ending in .png, .jpg, .jpeg, .gif, .avif):
 *   <picture>
 *     <source srcSet="...webp" type="image/webp" />
 *     <img src={original} alt={alt} loading="lazy" />
 *   </picture>
 *
 * Paths ending in .webp:
 *   <picture>
 *     <source srcSet={src} type="image/webp" />
 *     <img src="...png" alt={alt} loading="lazy" />
 *   </picture>
 *
 * Data URLs, blobs, SVGs, and unrecognised paths: plain <img> with lazy loading.
 */
export function AuraImage({ src, alt, className, ...rest }: AuraImageProps) {
  const isConvertible = /\.(png|jpg|jpeg|gif|avif)(\?.*)?$/i.test(src);
  const isWebp = /\.webp(\?.*)?$/i.test(src);
  const isStaticExt = isConvertible || isWebp;

  if (!isStaticExt) {
    return (
      <img
        src={src}
        alt={alt}
        className={cn(className)}
        loading="lazy"
        {...rest}
      />
    );
  }

  const webpSrc = isConvertible
    ? src.replace(/\.(png|jpg|jpeg|gif|avif)(\?.*)?$/i, '.webp')
    : src;
  const pngSrc = src;

  return (
    <picture>
      {!isWebp && webpSrc !== src && <source srcSet={webpSrc} type="image/webp" />}
      <img
        src={pngSrc}
        alt={alt}
        className={cn(className)}
        loading="lazy"
        {...rest}
      />
    </picture>
  );
}
