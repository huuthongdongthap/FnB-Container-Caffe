const FLAGSHIP_HEAD_SELECTOR = [
  'meta[name="description"]',
  'meta[name="robots"]',
  'meta[property^="og:"]',
  'meta[name^="twitter:"]',
  'meta[name="application-name"]',
  'meta[name="apple-mobile-web-app-title"]',
  'link[rel="canonical"]',
  'script[type="application/ld+json"]:not(#route-breadcrumb-ld)',
].join(',');

export function isReactManagedHeadNode(node: Element): boolean {
  if (node.getAttribute('data-rh') === 'true') return true;
  return Object.keys(node).some(
    (key) => key.startsWith('__reactFiber$') || key.startsWith('__reactProps$'),
  );
}

/**
 * Temporarily detaches non-React flagship head tags while a tenant storefront route is active,
 * and restores them before public routes reclaim ownership. Idempotent if already suspended.
 */
export function suspendFlagshipHead(): () => void {
  if (typeof document === 'undefined') return () => {};
  if (document.documentElement.dataset.flagshipHeadSuspended === 'true') {
    return () => {};
  }
  document.documentElement.dataset.flagshipHeadSuspended = 'true';

  const prevTitle = document.title;
  const nodes = Array.from(document.head.querySelectorAll(FLAGSHIP_HEAD_SELECTOR)).filter(
    (node) => !isReactManagedHeadNode(node) && node.getAttribute('data-storefront-seo') !== 'true',
  );
  nodes.forEach((node) => node.remove());
  document.head
    .querySelectorAll('link[rel="alternate"][type="text/markdown"]')
    .forEach((node) => node.remove());
  document.getElementById('route-breadcrumb-ld')?.remove();

  const hasStorefrontTitle = Boolean(document.head.querySelector('[data-storefront-seo="true"]'));
  if (!hasStorefrontTitle) {
    document.title = 'Đang tải thực đơn cửa hàng';
  }

  const root = document.getElementById('root');
  const prevLabel = root?.getAttribute('aria-label');
  root?.setAttribute('aria-label', 'Đặt món QR');

  return () => {
    delete document.documentElement.dataset.flagshipHeadSuspended;
    nodes.forEach((node) => {
      if (!node.isConnected) {
        document.head.appendChild(node);
      }
    });
    if (!Array.from(document.head.querySelectorAll('title')).some(isReactManagedHeadNode)) {
      document.title = prevTitle;
    }
    if (prevLabel) root?.setAttribute('aria-label', prevLabel);
    else root?.removeAttribute('aria-label');
  };
}
