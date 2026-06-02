/**
 * Track Order Page Tests - AURA CAFE
 */

const fs = require('fs');
const path = require('path');

const rootDir = path.join(__dirname, '..');

describe('Track Order Page', () => {
  let trackOrderHtml;
  let trackOrderJs;

  beforeAll(() => {
    trackOrderHtml = fs.readFileSync(path.join(rootDir, 'track-order.html'), 'utf8');
    trackOrderJs = fs.readFileSync(path.join(rootDir, 'js/track-order.js'), 'utf8');
  });

  describe('HTML structure / smoke checks', () => {
    test('should have valid HTML5 shell and tracking section', () => {
      expect(trackOrderHtml).toContain('<!DOCTYPE html>');
      expect(trackOrderHtml).toContain('<html lang="vi">');
      expect(trackOrderHtml).toContain('class="tracking-section"');
      expect(trackOrderHtml).toContain('id="orderIdInput"');
      expect(trackOrderHtml).toContain('id="trackOrderBtn"');
    });

    test('should load track-order script module', () => {
      expect(trackOrderHtml).toMatch(/src=["'][^"']*track-order\.js(\?[^"']*)?["']/);
    });
  });

  describe('Accessible input labeling', () => {
    test('should provide both explicit label and aria-label for order input', () => {
      expect(trackOrderHtml).toContain('<label for="orderIdInput"');
      expect(trackOrderHtml).toContain('id="orderIdInput"');
      expect(trackOrderHtml).toContain('aria-label="Mã đơn hàng"');
    });
  });

  describe('ARIA live/status support for dynamic updates', () => {
    test('should include loading status region and live announcement region', () => {
      expect(trackOrderHtml).toContain('id="trackingLoading"');
      expect(trackOrderHtml).toContain('role="status"');
      expect(trackOrderHtml).toContain('id="trackingStatusLive"');
      expect(trackOrderHtml).toContain('aria-live="polite"');
      expect(trackOrderJs).toContain('announceStatus');
      expect(trackOrderJs).toContain('trackingStatusLive');
    });
  });

  describe('Keyboard interaction indicator', () => {
    test('should handle Enter key on order input', () => {
      expect(trackOrderJs).toContain('addEventListener(');
      expect(trackOrderJs).toContain("'keypress'");
      expect(trackOrderJs).toContain("e.key === 'Enter'");
      expect(trackOrderJs).toContain('handleTrackClick()');
    });
  });

  describe('Core CTA and state containers', () => {
    test('should have loading/result/retry/menu related containers and actions', () => {
      expect(trackOrderHtml).toContain('id="trackingLoading"');
      expect(trackOrderHtml).toContain('id="statusCard"');
      expect(trackOrderHtml).toContain('id="errorCard"');
      expect(trackOrderHtml).toContain('btn-retry');
      expect(trackOrderHtml).toContain('retrySearch()');
      expect(trackOrderHtml).toContain('href="menu.html"');
      expect(trackOrderHtml).toContain('id="emptyCard"');
    });
  });
});
