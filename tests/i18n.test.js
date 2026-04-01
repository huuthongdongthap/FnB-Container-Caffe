/**
 * @jest-environment jsdom
 */

// Mock localStorage
const localStorageMock = (() => {
  let store = {};
  return {
    getItem: jest.fn((key) => store[key] || null),
    setItem: jest.fn((key, value) => {
      store[key] = value.toString();
    }),
    removeItem: jest.fn((key) => {
      delete store[key];
    }),
    clear: jest.fn(() => {
      store = {};
    })
  };
})();

Object.defineProperty(window, 'localStorage', {
  value: localStorageMock
});

// Import i18n module
const { I18N } = require('../js/i18n.js');

describe('I18N', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    document.body.innerHTML = '';
    // Use the global I18N directly (not a copy)
    window.I18N.currentLang = 'vi';
  });

  describe('configuration', () => {
    test('có currentLang mặc định là vi', () => {
      expect(window.I18N.currentLang).toBe('vi');
    });

    test('có defaultLang là vi', () => {
      expect(window.I18N.defaultLang).toBe('vi');
    });

    test('supportedLangs có vi và en', () => {
      expect(window.I18N.supportedLangs).toEqual(['vi', 'en']);
    });

    test('có translations object', () => {
      expect(window.I18N.translations).toBeDefined();
      expect(window.I18N.translations.vi).toBeDefined();
      expect(window.I18N.translations.en).toBeDefined();
    });
  });

  describe('translations', () => {
    test('có navigation translations', () => {
      expect(window.I18N.translations.vi['nav.home']).toBe('Trang Chủ');
      expect(window.I18N.translations.en['nav.home']).toBe('Home');
    });

    test('có hero section translations', () => {
      expect(window.I18N.translations.vi['hero.tagline']).toBe('Where Flavor Meets Design');
      expect(window.I18N.translations.en['hero.tagline']).toBe('Where Flavor Meets Design');
    });

    test('có menu category translations', () => {
      expect(window.I18N.translations.vi['menu.category.coffee']).toBe('Cà Phê');
      expect(window.I18N.translations.en['menu.category.coffee']).toBe('Coffee');
    });

    test('có common translations', () => {
      expect(window.I18N.translations.vi['common.loading']).toBe('Đang tải...');
      expect(window.I18N.translations.en['common.loading']).toBe('Loading...');
    });
  });

  describe('t function', () => {
    test('trả về translation đúng key', () => {
      window.I18N.currentLang = 'vi';
      const result = window.I18N.t('nav.home');
      expect(result).toBe('Trang Chủ');
    });

    test('trả về key nếu không tìm thấy translation', () => {
      const result = window.I18N.t('nonexistent.key');
      expect(result).toBe('nonexistent.key');
    });

    test('trả về translation theo currentLang', () => {
      window.I18N.currentLang = 'en';
      const result = window.I18N.t('nav.home');
      expect(result).toBe('Home');
    });
  });

  describe('setLanguage', () => {
    test('đặt currentLang đúng', () => {
      window.I18N.setLanguage('en');
      expect(window.I18N.currentLang).toBe('en');
    });

    test('lưu language preference vào localStorage', () => {
      window.I18N.setLanguage('en');
      expect(localStorage.setItem).toHaveBeenCalledWith('fnb_lang', 'en');
    });
  });

  describe('translatePage', () => {
    beforeEach(() => {
      document.body.innerHTML = `
        <h1 data-i18n="hero.tagline">Where Flavor Meets Design</h1>
        <input type="text" data-i18n-placeholder="common.search" placeholder="Tìm kiếm" />
      `;
    });

    test('dịch các element có data-i18n', () => {
      window.I18N.currentLang = 'en';
      window.I18N.translatePage();

      const h1 = document.querySelector('h1');
      expect(h1.textContent).toBe('Where Flavor Meets Design');
    });

    test('dịch placeholder các element có data-i18n-placeholder', () => {
      window.I18N.currentLang = 'en';
      window.I18N.translatePage();

      const input = document.querySelector('input');
      expect(input.getAttribute('placeholder')).toBeTruthy();
    });
  });

  describe('showToast', () => {
    beforeEach(() => {
      document.body.innerHTML = '';
      jest.useFakeTimers();
    });

    afterEach(() => {
      jest.useRealTimers();
    });

    test('tạo toast element', () => {
      window.I18N.showToast('Test message');
      const toast = document.querySelector('.toast-notification');
      expect(toast).toBeTruthy();
    });

    test('toast có nội dung đúng', () => {
      window.I18N.showToast('Hello World');
      const toast = document.querySelector('.toast-notification');
      expect(toast.textContent).toBe('Hello World');
    });

    test('toast tự động remove sau 4 giây', () => {
      window.I18N.showToast('Test');
      jest.advanceTimersByTime(4400);

      const toast = document.querySelector('.toast-notification');
      expect(toast).toBeNull();
    });
  });

  describe('getCurrentLang', () => {
    test('trả về ngôn ngữ hiện tại', () => {
      window.I18N.currentLang = 'en';
      expect(window.I18N.getCurrentLang()).toBe('en');
    });
  });

  describe('getSupportedLanguages', () => {
    test('trả về danh sách ngôn ngữ', () => {
      const langs = window.I18N.getSupportedLanguages();
      expect(langs).toBeDefined();
      expect(langs.length).toBeGreaterThan(0);
    });
  });

  describe('toggleLanguage', () => {
    test('chuyển từ vi sang en', () => {
      window.I18N.currentLang = 'vi';
      const oldLang = window.I18N.currentLang;
      window.I18N.toggleLanguage();
      expect(window.I18N.currentLang).not.toBe(oldLang);
    });

    test('chuyển từ en sang vi', () => {
      window.I18N.currentLang = 'en';
      const oldLang = window.I18N.currentLang;
      window.I18N.toggleLanguage();
      expect(window.I18N.currentLang).not.toBe(oldLang);
    });
  });
});
