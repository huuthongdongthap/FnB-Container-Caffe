import '@testing-library/jest-dom/vitest';
import { vi } from 'vitest';

// Initialize i18n for tests so t() returns translation values, not keys
import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import viTranslations from '../public/locales/vi/translation.json';
import enTranslations from '../public/locales/en/translation.json';

i18n.use(initReactI18next).init({
  lng: 'vi',
  fallbackLng: 'vi',
  interpolation: { escapeValue: false },
  resources: {
    vi: { translation: viTranslations },
    en: { translation: enTranslations },
  },
});

// jsdom polyfill: HTMLDialogElement not implemented in jsdom
HTMLDialogElement.prototype.showModal = function () {
  this.open = true;
};
HTMLDialogElement.prototype.close = function () {
  this.open = false;
};

// jsdom polyfill: EventSource (not available in jsdom)
if (typeof globalThis.EventSource === 'undefined') {
  class MockEventSource extends EventTarget {
    static CONNECTING = 0;
    static OPEN = 1;
    static CLOSED = 2;
    readyState: number = MockEventSource.CONNECTING;
    url: string;
    onopen: ((event: Event) => void) | null = null;
    onmessage: ((event: MessageEvent) => void) | null = null;
    onerror: ((event: Event) => void) | null = null;

    constructor(url: string | URL) {
      super();
      this.url = String(url);
      // Simulate immediate connection
      setTimeout(() => {
        this.readyState = MockEventSource.OPEN;
        this.dispatchEvent(new Event('open'));
        if (this.onopen) this.onopen(new Event('open'));
      }, 0);
    }

    close() {
      this.readyState = MockEventSource.CLOSED;
    }
  }
  (globalThis as unknown as { EventSource: typeof MockEventSource }).EventSource = MockEventSource;
}

// jsdom polyfill: localStorage mock
const createMockStorage = () => {
  let store: Record<string, string> = {};
  return {
    getItem: vi.fn((key: string) => store[key] ?? null),
    setItem: vi.fn((key: string, value: string) => { store[key] = value; }),
    removeItem: vi.fn((key: string) => { delete store[key]; }),
    clear: vi.fn(() => { store = {}; }),
    get length() { return Object.keys(store).length; },
    key: vi.fn((index: number) => Object.keys(store)[index] ?? null),
  };
};

Object.defineProperty(globalThis, 'localStorage', {
  value: createMockStorage(),
  writable: true,
  configurable: true,
});
