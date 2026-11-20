import { useLayoutEffect } from 'react';
import { suspendFlagshipHead } from '@/components/shared/tenant-head-boundary';
import { sanitizeStorefrontMediaUrl } from './storefront-helpers';

export interface StorefrontSeoInput {
  slug?: string;
  state: 'loading' | 'ready' | 'not_found' | 'error';
  displayName?: string;
  tagline?: string;
  address?: string;
  logoUrl?: string | null;
}

export function useStorefrontSeo(input: StorefrontSeoInput): void {
  const { slug, state, displayName, tagline, address, logoUrl } = input;

  // Ensure flagship head tags are suspended even if TenantStorefrontPage mounts without RouteSeoManager.
  useLayoutEffect(() => suspendFlagshipHead(), []);

  useLayoutEffect(() => {
    const cleanName = displayName?.trim() || '';
    const title =
      state === 'ready' && cleanName
        ? `${cleanName} — Đặt món QR`
        : state === 'not_found'
          ? 'Không tìm thấy cửa hàng'
          : state === 'error'
            ? 'Không thể tải thực đơn cửa hàng'
            : 'Đang tải thực đơn cửa hàng';
    const description =
      state === 'ready' && cleanName
        ? tagline?.trim() || address?.trim() || `Đặt món QR trực tuyến tại ${cleanName}.`
        : state === 'not_found'
          ? 'Đường dẫn cửa hàng không tồn tại hoặc đã thay đổi.'
          : state === 'error'
            ? 'Không thể kết nối máy chủ thực đơn lúc này. Vui lòng thử lại.'
            : 'Thực đơn đặt món QR trực tuyến.';
    const cleanSlug = (slug || '').trim();
    const canonical = cleanSlug
      ? `https://auraspace.cafe/s/${encodeURIComponent(cleanSlug)}`
      : 'https://auraspace.cafe/s';

    document.head
      .querySelectorAll('link[rel="alternate"][type="text/markdown"]')
      .forEach((node) => node.remove());
    document.getElementById('route-breadcrumb-ld')?.remove();

    const nodes: Element[] = [];
    function meta(key: string, content: string) {
      const node = document.createElement('meta');
      node.setAttribute(key.startsWith('og:') ? 'property' : 'name', key);
      node.content = content;
      node.setAttribute('data-storefront-seo', 'true');
      document.head.appendChild(node);
      nodes.push(node);
    }

    document.title = title;
    meta('description', description);
    meta('robots', state === 'ready' && cleanName ? 'index, follow' : 'noindex, nofollow');
    meta('og:title', title);
    meta('og:description', description);
    meta('og:url', canonical);
    meta('og:type', 'website');
    if (state === 'ready' && cleanName) {
      meta('og:site_name', cleanName);
    }
    meta('twitter:title', title);
    meta('twitter:description', description);
    meta('twitter:card', 'summary');

    const safeLogo = state === 'ready' ? sanitizeStorefrontMediaUrl(logoUrl) : null;
    if (safeLogo && cleanName) {
      const absoluteLogo = new URL(safeLogo, 'https://auraspace.cafe').href;
      meta('og:image', absoluteLogo);
      meta('og:image:alt', cleanName);
      meta('twitter:image', absoluteLogo);
    }

    const link = document.createElement('link');
    link.rel = 'canonical';
    link.href = canonical;
    link.setAttribute('data-storefront-seo', 'true');
    document.head.appendChild(link);
    nodes.push(link);

    return () => {
      nodes.forEach((node) => node.remove());
      if (document.title === title) {
        document.title = '';
      }
    };
  }, [slug, state, displayName, tagline, address, logoUrl]);
}
