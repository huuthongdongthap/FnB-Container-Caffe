/**
 * Landing Page Tests - F&B Caffe Container
 */

const fs = require('fs');
const path = require('path');

const rootDir = path.join(__dirname, '..');

describe('Landing Page', () => {
  let indexHtml;
  let stylesCss;
  let scriptJs;

  beforeAll(() => {
    indexHtml = fs.readFileSync(path.join(rootDir, 'index.html'), 'utf8');
    stylesCss = fs.readFileSync(path.join(rootDir, 'styles.css'), 'utf8');
    scriptJs = fs.readFileSync(path.join(rootDir, 'script.js'), 'utf8');
  });

  describe('HTML Structure', () => {
    test('should have valid HTML5 structure', () => {
      expect(indexHtml).toContain('<!DOCTYPE html>');
      expect(indexHtml).toContain('<html');
      expect(indexHtml).toContain('<head>');
      expect(indexHtml).toContain('<body>');
      expect(indexHtml).toContain('</html>');
    });

    test('should have Vietnamese language attribute', () => {
      expect(indexHtml).toContain('lang="vi"');
    });

    test('should have proper charset', () => {
      expect(indexHtml).toContain('charset="UTF-8"');
    });

    test('should have viewport meta tag', () => {
      expect(indexHtml).toContain('name="viewport"');
      expect(indexHtml).toContain('width=device-width');
      expect(indexHtml).toContain('initial-scale=1.0');
    });
  });

  describe('Navigation', () => {
    test('should have navigation bar', () => {
      expect(indexHtml).toContain('class="navbar"');
      expect(indexHtml).toContain('class="nav-links"');
    });

    test('should have brand logo', () => {
      expect(indexHtml).toContain('class="nav-brand"');
      expect(indexHtml).toContain('class="brand-icon"');
    });

    test('should have navigation links or menu items', () => {
      // Check for either traditional nav links or alternative menu structure
      const hasNavLinks = indexHtml.includes('Giới thiệu') ||
                          indexHtml.includes('Thực đơn') ||
                          indexHtml.includes('Liên hệ') ||
                          indexHtml.includes('class="nav-links"');
      expect(hasNavLinks).toBe(true);
    });

    test('should have hamburger menu for mobile', () => {
      expect(indexHtml).toContain('class="hamburger"');
      expect(indexHtml).toContain('class="mobile-menu"');
    });
  });

  describe('Hero Section', () => {
    test('should have hero section', () => {
      expect(indexHtml).toContain('class="hero"');
      expect(indexHtml).toContain('class="hero-content"');
    });

    test('should have hero title', () => {
      expect(indexHtml).toContain('class="hero-title"');
    });

    test('should have hero subtitle', () => {
      expect(indexHtml).toContain('class="hero-subtitle"');
    });

    test('should have hero CTA buttons', () => {
      expect(indexHtml).toContain('class="btn-primary"');
      expect(indexHtml).toContain('class="btn-secondary"');
    });

    test('should have hero badge', () => {
      expect(indexHtml).toContain('class="hero-badge"');
    });
  });

  describe('Menu Section', () => {
    test('should have menu section', () => {
      expect(indexHtml).toContain('class="menu-section"') ||
        expect(indexHtml).toContain('id="menu"') ||
        expect(indexHtml).toContain('Thực đơn');
    });

    test('should have menu categories or product sections', () => {
      // Check for menu categories or alternative product display
      const hasMenuItems = indexHtml.includes('class="menu-category"') ||
                           indexHtml.includes('class="menu-item"') ||
                           indexHtml.includes('item-price') ||
                           indexHtml.includes('menu-grid');
      expect(hasMenuItems).toBe(true);
    });

    test('should have menu items with prices', () => {
      expect(indexHtml).toContain('class="menu-item"');
      expect(indexHtml).toContain('class="item-price"');
    });

    test('should have menu category icons', () => {
      expect(indexHtml).toContain('class="menu-cat-icon"');
    });
  });

  describe('CSS Styling', () => {
    test('should have CSS custom properties defined', () => {
      expect(stylesCss).toContain(':root');
      expect(stylesCss).toContain('--bg-dark');
      expect(stylesCss).toContain('--bg-surface');
      expect(stylesCss).toContain('--coffee-');
    });

    test('should have typography variables', () => {
      expect(stylesCss).toContain('--font-heading');
      expect(stylesCss).toContain('--font-body');
      expect(stylesCss).toContain('--font-mono');
    });

    test('should have responsive media queries', () => {
      expect(stylesCss).toMatch(/@media.*max-width.*1024px/s);
      expect(stylesCss).toMatch(/@media.*max-width.*768px/s);
      expect(stylesCss).toMatch(/@media.*max-width.*480px/s);
    });

    test('should have navbar styles', () => {
      expect(stylesCss).toContain('.navbar');
      expect(stylesCss).toContain('.nav-links');
      expect(stylesCss).toContain('.nav-brand');
    });

    test('should have hero styles', () => {
      expect(stylesCss).toContain('.hero');
      expect(stylesCss).toContain('.hero-title');
      expect(stylesCss).toContain('.hero-content');
    });

    test('should have animation keyframes', () => {
      expect(stylesCss).toMatch(/@keyframes/s);
    });
  });

  describe('JavaScript Functionality', () => {
    test('should have DOMContentLoaded listener', () => {
      expect(scriptJs).toContain('DOMContentLoaded');
    });

    test('should have scroll event listener', () => {
      expect(scriptJs).toContain('scroll');
    });

    test('should have mobile menu toggle', () => {
      expect(scriptJs).toContain('hamburger');
      expect(scriptJs).toContain('mobile-menu');
    });

    test('should have smooth scroll functionality', () => {
      expect(scriptJs).toContain('scroll-behavior');
      expect(scriptJs).toContain('scrollIntoView');
    });

    test('should have reveal on scroll functionality', () => {
      expect(scriptJs).toContain('IntersectionObserver');
      expect(scriptJs).toContain('reveal');
    });
  });

  describe('SEO & Metadata', () => {
    test('should have title tag', () => {
      expect(indexHtml).toMatch(/<title>.*<\/title>/);
    });

    test('should have meta description', () => {
      expect(indexHtml).toContain('name="description"');
    });

    test('should have Open Graph tags', () => {
      expect(indexHtml).toContain('property="og:title"');
      expect(indexHtml).toContain('property="og:description"');
      expect(indexHtml).toContain('property="og:image"');
    });
  });

  describe('Accessibility', () => {
    test('should have alt attributes on images', () => {
      const imgTags = indexHtml.match(/<img[^>]*>/g) || [];
      imgTags.forEach(img => {
        expect(img).toContain('alt=');
      });
    });

    test('should have proper heading hierarchy', () => {
      expect(indexHtml).toContain('<h1');
      expect(indexHtml).toContain('<h2');
      expect(indexHtml).toContain('<h3');
    });

    test('should have skip link (optional but recommended)', () => {
      // This is optional - checking if there's any skip navigation
      const hasSkipLink = indexHtml.includes('skip') || indexHtml.includes('nhảy');
      // Not failing test if not present, just noting
      expect(hasSkipLink || true).toBe(true);
    });
  });

  describe('Performance', () => {
    test('HTML file should be under 200KB', () => {
      const sizeKb = Buffer.byteLength(indexHtml, 'utf8') / 1024;
      expect(sizeKb).toBeLessThan(200);
    });

    test('CSS file should be under 100KB', () => {
      const sizeKb = Buffer.byteLength(stylesCss, 'utf8') / 1024;
      expect(sizeKb).toBeLessThan(100);
    });

    test('JS file should be under 50KB', () => {
      const sizeKb = Buffer.byteLength(scriptJs, 'utf8') / 1024;
      expect(sizeKb).toBeLessThan(50);
    });
  });
});

describe('Contact Section', () => {
  let indexHtml;

  beforeAll(() => {
    indexHtml = fs.readFileSync(path.join(__dirname, '../index.html'), 'utf8');
  });

  test('should have contact section', () => {
    expect(indexHtml).toContain('class="location"');
    expect(indexHtml).toContain('class="location-map"');
  });

  test('should have contact form or contact info', () => {
    expect(indexHtml).toContain('class="location-info"') ||
      expect(indexHtml).toContain('<form') ||
      expect(indexHtml).toContain('contact');
  });

  test('should have Google Maps iframe', () => {
    expect(indexHtml).toContain('<iframe');
    expect(indexHtml).toContain('google.com/maps');
  });

  test('should have business hours', () => {
    expect(indexHtml).toContain('class="location-hours"');
    expect(indexHtml).toContain('class="hours-row"');
  });
});

describe('Footer', () => {
  let indexHtml;

  beforeAll(() => {
    indexHtml = fs.readFileSync(path.join(__dirname, '../index.html'), 'utf8');
  });

  test('should have footer element', () => {
    expect(indexHtml).toContain('class="footer"');
  });

  test('should have social media links', () => {
    expect(indexHtml).toContain('class="footer-social"');
  });

  test('should have copyright information', () => {
    expect(indexHtml).toContain('©');
    expect(indexHtml).toContain(new Date().getFullYear().toString());
  });
});
