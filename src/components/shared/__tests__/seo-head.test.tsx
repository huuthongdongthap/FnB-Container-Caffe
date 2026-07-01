import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render } from '@/test-utils';
import { SEOHead } from '../SEOHead';

describe('SEOHead', () => {
  beforeEach(() => {
    document.title = '';
    // Remove any existing OG meta tags
    document.querySelectorAll('meta[property^="og:"], meta[name^="description"], meta[name="robots"]')
      .forEach((el) => el.remove());
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('sets document.title from title prop', () => {
    render(<SEOHead title="Về Chúng Tôi | AURA CAFE" />);
    expect(document.title).toBe('Về Chúng Tôi | AURA CAFE');
  });

  it('sets meta description tag', () => {
    render(<SEOHead
      title="Test"
      description="Câu chuyện hình thành AURA CAFE"
    />);
    const meta = document.querySelector('meta[name="description"]');
    expect(meta).toBeInTheDocument();
    expect(meta).toHaveAttribute('content', 'Câu chuyện hình thành AURA CAFE');
  });

  it('sets OG meta tags when provided', () => {
    render(<SEOHead
      title="Test"
      ogTitle="AURA CAFE | Về Chúng Tôi"
      ogDescription="Câu chuyện hình thành AURA CAFE"
      ogImage="images/night-4k.png"
      ogType="website"
    />);

    expect(document.querySelector('meta[property="og:title"]')).toHaveAttribute('content', 'AURA CAFE | Về Chúng Tôi');
    expect(document.querySelector('meta[property="og:description"]')).toHaveAttribute('content', 'Câu chuyện hình thành AURA CAFE');
    expect(document.querySelector('meta[property="og:image"]')).toHaveAttribute('content', 'images/night-4k.png');
    expect(document.querySelector('meta[property="og:type"]')).toHaveAttribute('content', 'website');
  });

  it('does not set OG tags when not provided', () => {
    render(<SEOHead title="Test" />);
    expect(document.querySelector('meta[property="og:title"]')).not.toBeInTheDocument();
  });

  it('removes meta tags on unmount', () => {
    const { unmount } = render(<SEOHead title="Temp" description="Temp desc" />);
    unmount();
    expect(document.querySelector('meta[name="description"]')).not.toBeInTheDocument();
  });

  it('sets robots meta tag when noindex is true', () => {
    render(<SEOHead title="404" noindex />);
    expect(document.querySelector('meta[name="robots"]')).toHaveAttribute('content', 'noindex, nofollow');
  });
});
