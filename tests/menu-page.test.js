/**
 * Menu Page Tests - F&B Caffe Container
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.join(__dirname, '..');

describe('Menu Page', () => {
    let menuHtml;
    let menuJs;
    let stylesCss;

    beforeAll(() => {
        menuHtml = fs.readFileSync(path.join(rootDir, 'menu.html'), 'utf8');
        menuJs = fs.readFileSync(path.join(rootDir, 'menu.js'), 'utf8');
        stylesCss = fs.readFileSync(path.join(rootDir, 'styles.css'), 'utf8');
    });

    describe('HTML Structure', () => {
        test('should have valid HTML5 structure', () => {
            expect(menuHtml).toContain('<!DOCTYPE html>');
            expect(menuHtml).toContain('<html lang="vi"');
            expect(menuHtml).toContain('<head>');
            expect(menuHtml).toContain('<body>');
        });

        test('should have proper charset and viewport', () => {
            expect(menuHtml).toContain('charset="UTF-8"');
            expect(menuHtml).toContain('name="viewport"');
        });

        test('should have page title', () => {
            const titleMatch = menuHtml.match(/<title>.*Menu.*<\/title>/i);
            expect(titleMatch).toBeTruthy();
        });

        test('should have SEO meta description', () => {
            expect(menuHtml).toContain('name="description"');
        });

        test('should have Open Graph tags', () => {
            expect(menuHtml).toContain('property="og:title"');
            expect(menuHtml).toContain('property="og:description"');
            expect(menuHtml).toContain('property="og:image"');
            expect(menuHtml).toContain('property="og:type"');
        });

        test('should have Twitter Card tags', () => {
            expect(menuHtml).toContain('name="twitter:card"');
            expect(menuHtml).toContain('name="twitter:title"');
        });

        test('should have manifest link for PWA', () => {
            expect(menuHtml).toContain('rel="manifest"');
            expect(menuHtml).toContain('public/manifest.json');
        });
    });

    describe('Menu Hero Section', () => {
        test('should have menu hero section', () => {
            expect(menuHtml).toContain('class="menu-hero"');
        });

        test('should have menu hero title', () => {
            expect(menuHtml).toContain('class="menu-hero-title"');
        });

        test('should have menu hero subtitle', () => {
            expect(menuHtml).toContain('class="menu-hero-subtitle"');
        });
    });

    describe('Menu Filter System', () => {
        test('should have filter buttons container', () => {
            expect(menuHtml).toContain('class="filter-btn active"') || expect(menuHtml).toContain('filter-btn');
        });

        test('should have filter buttons with data attributes', () => {
            expect(menuHtml).toContain('data-filter="all"');
            expect(menuHtml).toContain('data-filter="coffee"');
            expect(menuHtml).toContain('data-filter="signature"');
            expect(menuHtml).toContain('data-filter="snacks"');
            expect(menuHtml).toContain('data-filter="combo"');
        });

        test('should have active state on All filter by default', () => {
            expect(menuHtml).toContain('filter-btn active');
        });
    });

    describe('Menu Categories', () => {
        test('should have menu categories with data-category', () => {
            expect(menuHtml).toContain('class="menu-category"');
            expect(menuHtml).toContain('data-category=');
        });

        test('should have coffee category section', () => {
            expect(menuHtml).toContain('data-category="coffee"');
        });

        test('should have signature drinks category', () => {
            expect(menuHtml).toContain('data-category="signature"');
        });

        test('should have snacks/food category', () => {
            expect(menuHtml).toContain('data-category="snacks"');
        });

        test('should have menu cards', () => {
            expect(menuHtml).toContain('class="menu-item-card"');
        });

        test('should have menu card images', () => {
            expect(menuHtml).toContain('class="item-image"');
        });

        test('should have menu item names', () => {
            expect(menuHtml).toContain('class="item-name"');
        });

        test('should have menu item prices', () => {
            expect(menuHtml).toContain('class="item-price"');
        });

        test('should have menu item descriptions', () => {
            expect(menuHtml).toContain('class="item-desc"');
        });
    });

    describe('Gallery Section', () => {
        test('should have gallery section', () => {
            expect(menuHtml).toContain('class="menu-gallery"');
        });

        test('should have gallery grid layout', () => {
            expect(menuHtml).toContain('class="gallery-grid"');
        });

        test('should have gallery items', () => {
            expect(menuHtml).toContain('class="gallery-item"');
        });

        test('should have gallery overlay on hover', () => {
            expect(menuHtml).toContain('class="gallery-overlay"');
        });

        test('should have lightbox for gallery', () => {
            // Lightbox is created dynamically, check for the function
            expect(menuJs).toContain('lightbox');
            expect(menuJs).toContain('lightbox-overlay');
        });
    });

    describe('Menu JavaScript Functionality', () => {
        test('should have DOMContentLoaded listener', () => {
            expect(menuJs).toContain('DOMContentLoaded');
        });

        test('should have initMenuFilter function', () => {
            expect(menuJs).toContain('function initMenuFilter');
        });

        test('should have filter button click handlers', () => {
            expect(menuJs).toContain('filter-btn');
            expect(menuJs).toContain('addEventListener');
            expect(menuJs).toContain('dataset.filter');
        });

        test('should have category filtering logic', () => {
            expect(menuJs).toContain('menu-category');
            expect(menuJs).toContain('dataset.category');
            expect(menuJs).toContain('style.display');
        });

        test('should have animation on filter', () => {
            expect(menuJs).toContain('style.opacity');
            expect(menuJs).toContain('style.transform');
            expect(menuJs).toContain('transition');
        });

        test('should have initGalleryLightbox function', () => {
            expect(menuJs).toContain('function initGalleryLightbox');
        });

        test('should have lightbox overlay creation', () => {
            expect(menuJs).toContain('document.createElement');
            expect(menuJs).toContain('lightbox-overlay');
        });

        test('should have lightbox open/close functions', () => {
            expect(menuJs).toContain('openLightbox');
            expect(menuJs).toContain('closeLightbox');
        });

        test('should have keyboard escape handler', () => {
            expect(menuJs).toContain('keydown');
            expect(menuJs).toContain('Escape');
        });

        test('should have initSmoothScroll function', () => {
            expect(menuJs).toContain('function initSmoothScroll');
        });

        test('should have smooth scroll to anchors', () => {
            expect(menuJs).toContain('a[href^="#"]');
            expect(menuJs).toContain('window.scrollTo');
            expect(menuJs).toContain("behavior: 'smooth'");
        });

        test('should have initScrollReveal function', () => {
            expect(menuJs).toContain('function initScrollReveal');
        });

        test('should use IntersectionObserver for reveal', () => {
            expect(menuJs).toContain('IntersectionObserver');
            expect(menuJs).toContain('isIntersecting');
        });

        test('should have service worker registration', () => {
            expect(menuJs).toContain('registerServiceWorker');
            expect(menuJs).toContain('navigator.serviceWorker.register');
        });
    });

    describe('Menu CSS Styling', () => {
        test('should have menu hero styles', () => {
            expect(stylesCss).toContain('.menu-hero');
            expect(stylesCss).toContain('.menu-hero-title');
            expect(stylesCss).toContain('.menu-hero-subtitle');
        });

        test('should have menu filter styles', () => {
            expect(stylesCss).toContain('.filter-btn');
        });

        test('should have menu card styles', () => {
            expect(stylesCss).toContain('.menu-item-card');
            expect(stylesCss).toContain('.item-image');
            expect(stylesCss).toContain('.item-content');
        });

        test('should have gallery grid styles', () => {
            expect(stylesCss).toContain('.gallery-grid');
            expect(stylesCss).toContain('grid-template-columns');
        });

        test('should have gallery item styles', () => {
            expect(stylesCss).toContain('.gallery-item');
            expect(stylesCss).toContain('.gallery-overlay');
        });

        test('should have lightbox styles', () => {
            expect(stylesCss).toContain('.lightbox-overlay') ||
                   expect(menuJs).toContain('style.cssText');
        });

        test('should have responsive styles for menu', () => {
            expect(stylesCss).toMatch(/@media.*max-width.*1024px/s);
            expect(stylesCss).toMatch(/@media.*max-width.*768px/s);
            expect(stylesCss).toMatch(/@media.*max-width.*480px/s);
            expect(stylesCss).toMatch(/@media.*max-width.*375px/s);
        });
    });

    describe('Menu Performance', () => {
        test('HTML file should be under 100KB', () => {
            const sizeKb = Buffer.byteLength(menuHtml, 'utf8') / 1024;
            expect(sizeKb).toBeLessThan(100);
        });

        test('JS file should be under 20KB', () => {
            const sizeKb = Buffer.byteLength(menuJs, 'utf8') / 1024;
            expect(sizeKb).toBeLessThan(20);
        });
    });

    describe('Menu Accessibility', () => {
        test('should have alt attributes on images', () => {
            const imgTags = menuHtml.match(/<img[^>]*>/g) || [];
            imgTags.forEach(img => {
                expect(img).toContain('alt=');
            });
        });

        test('should have proper heading hierarchy', () => {
            expect(menuHtml).toContain('<h1');
            expect(menuHtml).toContain('<h2');
            expect(menuHtml).toContain('<h3');
        });
    });
});

describe('Menu Page Integration', () => {
    let menuHtml;
    let menuJs;

    beforeAll(() => {
        menuHtml = fs.readFileSync(path.join(__dirname, '../menu.html'), 'utf8');
        menuJs = fs.readFileSync(path.join(__dirname, '../menu.js'), 'utf8');
    });

    test('should link to menu.js', () => {
        expect(menuHtml).toMatch(/menu\.js|menu\.min\.js/i);
    });

    test('should link to styles.css or minified version', () => {
        expect(menuHtml).toMatch(/styles(\.min)?\.css/);
    });

    test('should have navigation to home page', () => {
        expect(menuHtml).toContain('href="index.html"');
    });

    test('should filter menu items by category', () => {
        expect(menuJs).toContain('categoryFilter === filter');
    });

    test('should animate items on filter change', () => {
        expect(menuJs).toContain('setTimeout');
        expect(menuJs).toContain('index * 50');
    });

    test('should handle gallery item clicks', () => {
        expect(menuJs).toContain('gallery-item');
        expect(menuJs).toContain('addEventListener');
    });

    test('should prevent default on anchor links', () => {
        expect(menuJs).toContain('e.preventDefault');
    });
});
