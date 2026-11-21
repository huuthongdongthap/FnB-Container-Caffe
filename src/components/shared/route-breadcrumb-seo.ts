function isBreadcrumb(script: HTMLScriptElement): boolean {
  try {
    const value = JSON.parse(script.textContent ?? '') as {
      '@type'?: string;
      '@graph'?: Array<{ '@type'?: string }>;
    } | null;
    if (!value) return false;
    if (value['@type'] === 'BreadcrumbList') return true;
    return (
      Array.isArray(value['@graph']) &&
      value['@graph'].some((item) => item?.['@type'] === 'BreadcrumbList')
    );
  } catch {
    return false;
  }
}

export function manageRouteBreadcrumb(name: string, url: string, origin: string): () => void {
  const script = document.createElement('script');
  script.id = 'route-breadcrumb-ld';
  script.type = 'application/ld+json';
  script.textContent = JSON.stringify({
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: [
      { '@type': 'ListItem', position: 1, name: 'Trang chủ', item: `${origin}/` },
      { '@type': 'ListItem', position: 2, name, item: url },
    ],
  });

  function sync() {
    const existing = Array.from(
      document.querySelectorAll<HTMLScriptElement>('script[type="application/ld+json"]'),
    ).some((node) => node !== script && isBreadcrumb(node));
    if (existing) script.remove();
    else if (!script.isConnected) document.head.appendChild(script);
  }

  // The page may commit its own Breadcrumbs after the route's Suspense fallback.
  const observer = new MutationObserver(sync);
  observer.observe(document.body, { childList: true, subtree: true });
  sync();
  return () => {
    observer.disconnect();
    script.remove();
  };
}
