import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  UTM_STORAGE_KEY,
  buildUrlWithUtm,
  captureUtmFromSearch,
  clearStoredUtm,
  getStoredUtm,
  parseUtmFromSearch,
} from '@/lib/utm';

describe('utm attribution helpers', () => {
  beforeEach(() => {
    window.sessionStorage.clear();
  });

  afterEach(() => {
    vi.restoreAllMocks();
    window.sessionStorage.clear();
  });

  it('parses non-empty trimmed UTM params and caps each value at 120 chars', () => {
    const longValue = 'x'.repeat(150);
    const parsed = parseUtmFromSearch(
      `?utm_source=%20tiktok%20&utm_medium=video&utm_campaign=flagship_sadec_30d&utm_content=${longValue}&utm_term=%20%20&other=ignored`
    );

    expect(parsed).toEqual({
      utm_source: 'tiktok',
      utm_medium: 'video',
      utm_campaign: 'flagship_sadec_30d',
      utm_content: 'x'.repeat(120),
    });
    expect(parsed.utm_term).toBeUndefined();
  });

  it('persists captured UTM to sessionStorage and retains it across navigation without query params', () => {
    const captured = captureUtmFromSearch(
      '?utm_source=tiktok&utm_medium=social&utm_campaign=launch_q4',
      '/pricing'
    );

    expect(captured).not.toBeNull();
    expect(captured?.utm_source).toBe('tiktok');
    expect(captured?.utm_medium).toBe('social');
    expect(captured?.utm_campaign).toBe('launch_q4');
    expect(captured?.landing_path).toBe('/pricing');
    expect(captured?.captured_at).toBeTruthy();

    const storedRaw = window.sessionStorage.getItem(UTM_STORAGE_KEY);
    expect(storedRaw).toBeTruthy();

    // Navigating to /signup without query params retains previously captured UTM
    const retained = captureUtmFromSearch('', '/signup');
    expect(retained).toEqual(captured);
    expect(getStoredUtm()).toEqual(captured);
  });

  it('merges UTM params cleanly into relative URLs preserving existing query params', () => {
    const url = buildUrlWithUtm('/signup?plan=pro', {
      utm_source: 'instore_qr',
      utm_medium: 'table_tent',
      utm_campaign: 'flagship_sadec_30d',
      utm_content: 'checkin_footer',
    });

    expect(url).toBe(
      '/signup?plan=pro&utm_source=instore_qr&utm_medium=table_tent&utm_campaign=flagship_sadec_30d&utm_content=checkin_footer'
    );

    const urlNoExisting = buildUrlWithUtm('/signup', {
      utm_source: 'facebook',
    });
    expect(urlNoExisting).toBe('/signup?utm_source=facebook');

    const urlWithoutUtm = buildUrlWithUtm('/signup?plan=pro', null);
    expect(urlWithoutUtm).toBe('/signup?plan=pro');
  });

  it('clears stored UTM from sessionStorage', () => {
    captureUtmFromSearch('?utm_source=google&utm_medium=cpc', '/pricing');
    expect(getStoredUtm()?.utm_source).toBe('google');

    clearStoredUtm();
    expect(getStoredUtm()).toBeNull();
    expect(window.sessionStorage.getItem(UTM_STORAGE_KEY)).toBeNull();
  });

  it('preserves original landing_path and captured_at when forwarded UTM matches stored campaign', () => {
    const first = captureUtmFromSearch(
      '?utm_source=tiktok&utm_medium=organic&utm_campaign=flagship_sadec_30d',
      '/pricing'
    );
    const forwarded = captureUtmFromSearch(
      '?utm_source=tiktok&utm_medium=organic&utm_campaign=flagship_sadec_30d',
      '/signup'
    );

    expect(forwarded?.landing_path).toBe('/pricing');
    expect(forwarded?.captured_at).toBe(first?.captured_at);
  });

  it('preserves hash fragments, respects existing UTM in basePath, and ignores malformed stored JSON', () => {
    const withHash = buildUrlWithUtm('/signup?plan=pro&utm_source=explicit#step2', {
      utm_source: 'stored',
      utm_campaign: 'flagship_sadec_30d',
    });
    expect(withHash).toBe('/signup?plan=pro&utm_source=explicit&utm_campaign=flagship_sadec_30d#step2');

    window.sessionStorage.setItem(UTM_STORAGE_KEY, '{not-valid-json');
    expect(getStoredUtm()).toBeNull();
  });

  it('handles sessionStorage throwing errors gracefully (private mode / restricted context)', () => {
    const originalDescriptor = Object.getOwnPropertyDescriptor(window, 'sessionStorage');
    const getItemSpy = vi.fn(() => {
      throw new Error('SecurityError');
    });
    const setItemSpy = vi.fn(() => {
      throw new Error('QuotaExceededError');
    });
    const removeItemSpy = vi.fn(() => {
      throw new Error('SecurityError');
    });

    Object.defineProperty(window, 'sessionStorage', {
      configurable: true,
      value: {
        getItem: getItemSpy,
        setItem: setItemSpy,
        removeItem: removeItemSpy,
        clear: vi.fn(),
        key: vi.fn(),
        length: 0,
      },
    });

    try {
      expect(() => getStoredUtm()).not.toThrow();
      expect(getStoredUtm()).toBeNull();

      const captured = captureUtmFromSearch('?utm_source=zalo&utm_campaign=sadec', '/pricing');
      expect(captured?.utm_source).toBe('zalo');
      expect(captured?.utm_campaign).toBe('sadec');

      expect(() => clearStoredUtm()).not.toThrow();
      expect(getItemSpy).toHaveBeenCalled();
      expect(setItemSpy).toHaveBeenCalled();
      expect(removeItemSpy).toHaveBeenCalled();
    } finally {
      if (originalDescriptor) {
        Object.defineProperty(window, 'sessionStorage', originalDescriptor);
      }
    }
  });
});
