/**
 * Additional Pages Tests - F&B Caffe Container
 * Coverage: contact.html, success.html, failure.html
 */

const fs = require('fs');
const path = require('path');
const rootDir = path.join(__dirname, '..');

describe('Additional Pages Tests', () => {
  describe('Contact Page', () => {
    let content;

    beforeAll(() => {
      content = fs.readFileSync(path.join(rootDir, 'contact.html'), 'utf8');
    });

    test('should have valid HTML structure', () => {
      expect(content).toContain('<!DOCTYPE html>');
      expect(content).toContain('lang="vi"');
      expect(content).toContain('<title>');
    });

    test('should have SEO meta tags', () => {
      expect(content).toContain('name="description"');
      expect(content).toContain('property="og:title"');
    });

    test('should have contact form', () => {
      expect(content).toContain('<form');
      expect(content).toContain('type="email"');
      expect(content).toContain('type="text"');
    });

    test('should have PWA support', () => {
      expect(content).toContain('manifest.json');
      expect(content).toContain('apple-touch-icon');
    });

    test('should have responsive viewport', () => {
      expect(content).toContain('name="viewport"');
    });
  });

  describe('Success Page', () => {
    let content;

    beforeAll(() => {
      content = fs.readFileSync(path.join(rootDir, 'success.html'), 'utf8');
    });

    test('should have valid HTML structure', () => {
      expect(content).toContain('<!DOCTYPE html>');
      expect(content).toContain('lang="vi"');
    });

    test('should have success indicator', () => {
      expect(content).toMatch(/thành công|success|✓|checkmark/i);
    });

    test('should have order confirmation', () => {
      expect(content).toMatch(/đơn hàng|order|confirmation/i);
    });

    test('should have CTA button', () => {
      expect(content).toMatch(/<a[^>]*href|<button|Tiếp tục|Continue/i);
    });

    test('should have SEO title', () => {
      expect(content).toContain('<title>');
    });
  });

  describe('Failure Page', () => {
    let content;

    beforeAll(() => {
      content = fs.readFileSync(path.join(rootDir, 'failure.html'), 'utf8');
    });

    test('should have valid HTML structure', () => {
      expect(content).toContain('<!DOCTYPE html>');
      expect(content).toContain('lang="vi"');
    });

    test('should have error indicator', () => {
      expect(content).toMatch(/thất bại|error|✗|error/i);
    });

    test('should have retry option', () => {
      expect(content).toMatch(/thử lại|retry|quay lại/i);
    });

    test('should have support contact', () => {
      expect(content).toMatch(/liên hệ|support|help|contact/i);
    });

    test('should have SEO title', () => {
      expect(content).toContain('<title>');
    });
  });

  describe('KDS Page', () => {
    let content;
    let css;

    beforeAll(() => {
      content = fs.readFileSync(path.join(rootDir, 'kds.html'), 'utf8');
      css = fs.readFileSync(path.join(rootDir, 'kds-styles.css'), 'utf8');
    });

    test('should have valid HTML structure', () => {
      expect(content).toContain('<!DOCTYPE html>');
      expect(content).toContain('lang="vi"');
    });

    test('should have order display', () => {
      expect(content).toMatch(/order|đơn hàng|kitchen/i);
    });

    test('should have status indicators', () => {
      expect(content).toMatch(/pending|preparing|ready|completed/i);
    });

    test('should have timer functionality', () => {
      expect(content).toMatch(/timer|time|phút|giây/i);
    });

    test('should have responsive CSS', () => {
      expect(css).toMatch(/@media/);
    });

    test('should have PWA support', () => {
      expect(content).toContain('manifest.json');
    });
  });
});
