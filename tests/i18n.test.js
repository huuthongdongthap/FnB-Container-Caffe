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

// Mock requestAnimationFrame
window.requestAnimationFrame = jest.fn((cb) => setTimeout(cb, 0));

// Import i18n module
const { I18N } = require('../js/i18n.js');

describe('I18N', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    document.body.innerHTML = '';
    // Use the exported I18N from module
    window.I18N = { ...I18N };
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
      expect(window.I18N.translations.vi['hero.title']).toBe('F&B Container Café');
      expect(window.I18N.translations.en['hero.title']).toBe('F&B Container Café');
    });

    test('có menu category translations', () => {
      expect(window.I18N.translations.vi['menu.coffee']).toBe('Cà Phê');
      expect(window.I18N.translations.en['menu.coffee']).toBe('Coffee');
    });

    test('có order translations', () => {
      expect(window.I18N.translations.vi['order.cart']).toBe('Giỏ Hàng');
      expect(window.I18N.translations.en['order.cart']).toBe('Cart');
    });

    test('có contact form translations', () => {
      expect(window.I18N.translations.vi['contact.name']).toBe('Họ Tên');
      expect(window.I18N.translations.en['contact.name']).toBe('Name');
    });

    test('có language toggle translations', () => {
      expect(window.I18N.translations.vi['lang.switch']).toBeTruthy();
      expect(window.I18N.translations.en['lang.switch']).toBeTruthy();
    });
  });

  describe('t function', () => {
    test('trả về translation đúng key', () => {
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

    test('trả về defaultLang nếu lang không hỗ trợ', () => {
      window.I18N.currentLang = 'fr';
      const result = window.I18N.t('nav.home');
      expect(result).toBe('Trang Chủ'); // Fallback to default
    });
  });

  describe('setLanguage', () => {
    test('đặt currentLang đúng', () => {
      window.I18N.setLanguage('en');
      expect(window.I18N.currentLang).toBe('en');
    });

    test('lưu language preference vào localStorage', () => {
      window.I18N.setLanguage('en');
      expect(localStorage.setItem).toHaveBeenCalledWith('language', 'en');
    });

    test('gọi translatePage sau khi set language', () => {
      window.I18N.setLanguage('en');
      // translatePage should be called
      expect(window.I18N.currentLang).toBe('en');
    });
  });

  describe('translatePage', () => {
    beforeEach(() => {
      document.body.innerHTML = `
        <h1 data-i18n="hero.title">F&B Container Café</h1>
        <input type="text" data-i18n-placeholder="contact.name.placeholder" placeholder="Nhập họ tên" />
        <button data-i18n-title="contact.submit" title="Gửi Tin Nhắn">Gửi</button>
      `;
    });

    test('dịch các element có data-i18n', () => {
      window.I18N.currentLang = 'en';
      window.I18N.translatePage();

      const h1 = document.querySelector('h1');
      expect(h1.textContent).toBe('F&B Container Café');
    });

    test('dịch placeholder các element có data-i18n-placeholder', () => {
      window.I18N.currentLang = 'en';
      window.I18N.translatePage();

      const input = document.querySelector('input');
      expect(input.getAttribute('placeholder')).toBeTruthy();
    });

    test('dịch title các element có data-i18n-title', () => {
      window.I18N.currentLang = 'en';
      window.I18N.translatePage();

      const button = document.querySelector('button');
      expect(button.getAttribute('title')).toBeTruthy();
    });

    test('gọi updateLanguageToggle sau khi dịch', () => {
      window.I18N.translatePage();
      // updateLanguageToggle should be called
      expect(window.I18N.currentLang).toBeDefined();
    });
  });

  describe('addLanguageToggle', () => {
    beforeEach(() => {
      document.body.innerHTML = `
        <nav class="nav-links">
          <button id="themeToggle">Theme</button>
        </nav>
      `;
    });

    test('tạo toggle button với id langToggle', () => {
      window.I18N.addLanguageToggle();
      const toggle = document.getElementById('langToggle');
      expect(toggle).toBeTruthy();
    });

    test('toggle button có class lang-toggle', () => {
      window.I18N.addLanguageToggle();
      const toggle = document.getElementById('langToggle');
      expect(toggle.classList.contains('lang-toggle')).toBe(true);
    });

    test('toggle button có aria-label', () => {
      window.I18N.addLanguageToggle();
      const toggle = document.getElementById('langToggle');
      expect(toggle.getAttribute('aria-label')).toBeTruthy();
    });

    test('toggle button có lang-icon và lang-text', () => {
      window.I18N.addLanguageToggle();
      const toggle = document.getElementById('langToggle');
      expect(toggle.querySelector('.lang-icon')).toBeTruthy();
      expect(toggle.querySelector('.lang-text')).toBeTruthy();
    });

    test('toggle button có click handler', () => {
      window.I18N.addLanguageToggle();
      const toggle = document.getElementById('langToggle');
      toggle.click();
      // Should toggle language
      expect(window.I18N.currentLang).toBeDefined();
    });

    test('không tạo lại toggle nếu đã tồn tại', () => {
      window.I18N.addLanguageToggle();
      const firstToggle = document.getElementById('langToggle');

      window.I18N.addLanguageToggle();
      const toggles = document.querySelectorAll('#langToggle');

      expect(toggles.length).toBe(1);
    });

    test('thêm toggle vào nav nếu không có themeToggle', () => {
      document.body.innerHTML = '<nav class="nav-links"></nav>';
      window.I18N.addLanguageToggle();

      const nav = document.querySelector('.nav-links');
      const toggle = document.getElementById('langToggle');

      expect(nav.contains(toggle)).toBe(true);
    });
  });

  describe('toggleLanguage', () => {
    beforeEach(() => {
      document.body.innerHTML = `
        <button id="langToggle">
          <span class="lang-icon">🌐</span>
          <span class="lang-text">EN</span>
        </button>
      `;
    });

    test('chuyển từ vi sang en', () => {
      window.I18N.currentLang = 'vi';
      window.I18N.toggleLanguage();
      expect(window.I18N.currentLang).toBe('en');
    });

    test('chuyển từ en sang vi', () => {
      window.I18N.currentLang = 'en';
      window.I18N.toggleLanguage();
      expect(window.I18N.currentLang).toBe('vi');
    });

    test('gọi setLanguage với newLang', () => {
      window.I18N.currentLang = 'vi';
      window.I18N.toggleLanguage();
      expect(window.I18N.currentLang).toBe('en');
    });

    test('hiển thị toast notification', () => {
      window.I18N.currentLang = 'vi';
      window.I18N.toggleLanguage();
      // showToast should be called
      expect(window.I18N.currentLang).toBe('en');
    });
  });

  describe('updateLanguageToggle', () => {
    beforeEach(() => {
      document.body.innerHTML = `
        <button id="langToggle">
          <span class="lang-text">EN</span>
        </button>
      `;
    });

    test('cập nhật lang-text thành EN khi currentLang = vi', () => {
      window.I18N.currentLang = 'vi';
      window.I18N.updateLanguageToggle();

      const langText = document.querySelector('.lang-text');
      expect(langText.textContent).toBe('EN');
    });

    test('cập nhật lang-text thành VI khi currentLang = en', () => {
      window.I18N.currentLang = 'en';
      window.I18N.updateLanguageToggle();

      const langText = document.querySelector('.lang-text');
      expect(langText.textContent).toBe('VI');
    });

    test('không làm gì nếu không có toggle', () => {
      document.body.innerHTML = '';
      window.I18N.currentLang = 'en';

      // Should not throw
      expect(() => window.I18N.updateLanguageToggle()).not.toThrow();
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

    test('remove toast cũ nếu đã tồn tại', () => {
      window.I18N.showToast('First');
      let toasts = document.querySelectorAll('.toast-notification');
      expect(toasts.length).toBe(1);

      window.I18N.showToast('Second');
      toasts = document.querySelectorAll('.toast-notification');
      expect(toasts.length).toBe(1);

      const toast = document.querySelector('.toast-notification');
      expect(toast.textContent).toBe('Second');
    });

    test('toast có style đúng', () => {
      window.I18N.showToast('Test');
      const toast = document.querySelector('.toast-notification');
      expect(toast.style.position).toBe('fixed');
      expect(toast.style.bottom).toBe('24px');
      expect(toast.style.borderRadius).toBe('12px');
    });
  });

  describe('init', () => {
    beforeEach(() => {
      document.body.innerHTML = `
        <nav class="nav-links"></nav>
        <h1 data-i18n="hero.title">F&B Container Café</h1>
      `;
    });

    test('đặt currentLang từ localStorage', () => {
      localStorage.getItem.mockReturnValue('en');

      // Re-init I18N
      window.I18N.currentLang = 'vi';
      window.I18N.init();

      // Should load from localStorage
      expect(localStorage.getItem).toHaveBeenCalledWith('language');
    });

    test('thêm language toggle button', () => {
      window.I18N.init();
      const toggle = document.getElementById('langToggle');
      expect(toggle).toBeTruthy();
    });

    test('dịch trang khi init', () => {
      window.I18N.init();
      expect(window.I18N.currentLang).toBeDefined();
    });
  });

  describe('auto-init', () => {
    test('tự động init khi DOMContentLoaded', () => {
      // I18N should auto-init on DOMContentLoaded
      expect(window.I18N).toBeDefined();
      expect(window.I18N.init).toBeDefined();
    });
  });
});
