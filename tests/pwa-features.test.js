/**
 * PWA Features Tests - F&B Caffe Container
 */

const fs = require('fs');
const path = require('path');

const rootDir = path.join(__dirname, '..');

describe('PWA Features', () => {
  let indexHtml;
  let manifestJson;
  let swJs;

  beforeAll(() => {
    indexHtml = fs.readFileSync(path.join(rootDir, 'index.html'), 'utf8');
    manifestJson = fs.readFileSync(path.join(rootDir, 'public/manifest.json'), 'utf8');
    swJs = fs.readFileSync(path.join(rootDir, 'public/sw.js'), 'utf8');
  });

  describe('Manifest', () => {
    test('should have manifest link', () => {
      expect(indexHtml).toContain('rel="manifest"');
    });

    test('manifest should have name', () => {
      const manifest = JSON.parse(manifestJson);
      expect(manifest.name).toBeTruthy();
    });

    test('manifest should have short_name', () => {
      const manifest = JSON.parse(manifestJson);
      expect(manifest.short_name).toBeTruthy();
    });

    test('manifest should have start_url', () => {
      const manifest = JSON.parse(manifestJson);
      expect(manifest.start_url).toBeTruthy();
    });

    test('manifest should have display mode', () => {
      const manifest = JSON.parse(manifestJson);
      expect(['standalone', 'fullscreen', 'minimal-ui']).toContain(manifest.display);
    });

    test('manifest should have background_color', () => {
      const manifest = JSON.parse(manifestJson);
      expect(manifest.background_color).toBeTruthy();
    });

    test('manifest should have theme_color', () => {
      const manifest = JSON.parse(manifestJson);
      expect(manifest.theme_color).toBeTruthy();
    });

    test('manifest should have icons', () => {
      const manifest = JSON.parse(manifestJson);
      expect(manifest.icons).toBeTruthy();
      expect(manifest.icons.length).toBeGreaterThan(0);
    });

    test('manifest should have 192x192 icon', () => {
      const manifest = JSON.parse(manifestJson);
      const has192 = manifest.icons.some(icon => icon.sizes === '192x192');
      expect(has192).toBe(true);
    });

    test('manifest should have 512x512 icon', () => {
      const manifest = JSON.parse(manifestJson);
      const has512 = manifest.icons.some(icon => icon.sizes === '512x512');
      expect(has512).toBe(true);
    });
  });

  describe('Service Worker', () => {
    test('should register service worker', () => {
      expect(indexHtml).toContain('serviceWorker');
      expect(indexHtml).toContain('register');
    });

    test('service worker should have install event', () => {
      expect(swJs).toContain('install');
    });

    test('service worker should have activate event', () => {
      expect(swJs).toContain('activate');
    });

    test('service worker should have fetch event', () => {
      expect(swJs).toContain('fetch');
    });

    test('service worker should cache assets', () => {
      expect(swJs).toMatch(/cache|caches/i);
    });

    test('service worker should have cache name', () => {
      expect(swJs).toMatch(/CACHE_NAME|cacheName/i);
    });
  });

  describe('PWA Meta Tags', () => {
    test('should have apple-mobile-web-app-capable', () => {
      expect(indexHtml).toContain('apple-mobile-web-app-capable');
    });

    test('should have apple-mobile-web-app-status-bar-style', () => {
      expect(indexHtml).toContain('apple-mobile-web-app-status-bar-style');
    });

    test('should have apple-mobile-web-app-title', () => {
      expect(indexHtml).toContain('apple-mobile-web-app-title');
    });

    test('should have apple touch icons', () => {
      expect(indexHtml).toContain('apple-touch-icon');
    });

    test('should have theme-color meta tag', () => {
      expect(indexHtml).toContain('name="theme-color"');
    });
  });

  describe('Offline Support', () => {
    test('should have offline fallback', () => {
      expect(swJs).toMatch(/offline|fallback/i);
    });

    test('should cache index page', () => {
      expect(swJs).toMatch(/index|\/|home/i);
    });
  });

  describe('Install Prompt', () => {
    test('should handle beforeinstallprompt', () => {
      expect(indexHtml).toContain('beforeinstallprompt');
    });

    test('should have install button handler', () => {
      expect(indexHtml).toMatch(/install|cài.*đặt/i);
    });
  });
});
