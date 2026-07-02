/**
 * Image helper — converts image path to WebP with PNG fallback
 */

export function imgSrc(path: string): { src: string; webp: string } {
  const webp = path.replace(/\.(png|jpg|jpeg)$/i, '.webp');
  return { src: path, webp };
}
