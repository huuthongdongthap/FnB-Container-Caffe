import { brandConfig } from './brand-types';

export function injectBrandTheme(): void {
  // Set document title
  document.title = brandConfig.seo.title;

  // Update meta description
  const metaDesc =
    document.querySelector<HTMLMetaElement>('meta[name="description"]') ??
    (() => {
      const meta = document.createElement('meta');
      meta.name = 'description';
      document.head.appendChild(meta);
      return meta;
    })();
  metaDesc.content = brandConfig.seo.description;

  // Set CSS custom properties on :root (preserve Quicksand priority for display font)
  const root = document.documentElement;
  const displayFont = brandConfig.theme.fonts.display.includes('Quicksand')
    ? brandConfig.theme.fonts.display
    : `'Quicksand', ${brandConfig.theme.fonts.display}`;
  root.style.setProperty('--aura-font-display', displayFont);
  root.style.setProperty('--aura-font-body', brandConfig.theme.fonts.body);
  root.style.setProperty('--aura-font-mono', brandConfig.theme.fonts.mono);
}
