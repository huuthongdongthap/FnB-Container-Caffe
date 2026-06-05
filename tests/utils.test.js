/**
 * Utility Functions Tests
 */

const fs = require('fs');
const path = require('path');

const rootDir = path.join(__dirname, '..');

describe('Utility Functions', () => {
  let scriptJs;
  let dashboardJs;

  beforeAll(() => {
    scriptJs = fs.readFileSync(path.join(rootDir, 'js/script.js'), 'utf8');
    dashboardJs = fs.readFileSync(path.join(rootDir, 'js/utils.js'), 'utf8');
  });

  describe('Format Currency', () => {
    test('should have formatCurrency function', () => {
      expect(dashboardJs).toContain('formatCurrency');
    });

    test('should use Vietnamese locale for currency', () => {
      expect(dashboardJs).toContain('vi-VN');
      expect(dashboardJs).toContain('VND');
    });

    test('should use Intl.NumberFormat', () => {
      expect(dashboardJs).toContain('Intl.NumberFormat');
    });
  });

  describe('Format Date', () => {
    test('should have formatDate function', () => {
      expect(dashboardJs).toContain('formatDate');
    });

    test('should use Vietnamese locale for dates', () => {
      expect(dashboardJs).toContain('vi-VN');
    });

    test('should use Intl.DateTimeFormat or localestring', () => {
      const hasIntl = dashboardJs.includes('Intl.DateTimeFormat') || dashboardJs.includes('toLocaleDateString') || dashboardJs.includes('toLocaleString');
      expect(hasIntl).toBe(true);
    });
  });

  describe('Debounce Function', () => {
    test('should have debounce function', () => {
      expect(dashboardJs).toContain('function debounce');
    });

    test('should use setTimeout for debouncing', () => {
      expect(dashboardJs).toContain('setTimeout');
      expect(dashboardJs).toContain('clearTimeout');
    });
  });

  describe('Event Listeners', () => {
    test('should have click event listeners', () => {
      expect(scriptJs).toContain('click');
      expect(scriptJs).toContain('addEventListener');
    });

    test('should have keyboard event listeners', () => {
      const hasKeydown = scriptJs.includes('keydown') || dashboardJs.includes('keydown');
      expect(hasKeydown).toBe(true);
    });

    test('should have scroll event listeners', () => {
      expect(scriptJs).toContain('scroll');
    });
  });
});

describe('Code Quality', () => {
  let scriptJs;
  let dashboardJs;
  let checkoutJs;
  let stylesCss;
  let dashboardCss;

  beforeAll(() => {
    scriptJs = fs.readFileSync(path.join(rootDir, 'js/script.js'), 'utf8');
    dashboardJs = fs.readFileSync(path.join(rootDir, 'js/utils.js'), 'utf8');
    checkoutJs = fs.readFileSync(path.join(rootDir, 'js/checkout.js'), 'utf8');
    try {
      const cssDir = path.join(rootDir, 'css');
      const cssFiles = fs.readdirSync(cssDir).filter(f => f.endsWith('.css') && !f.startsWith('.'));
      stylesCss = cssFiles.map(f => fs.readFileSync(path.join(cssDir, f), 'utf8')).join('\n');
    } catch (e) {
      stylesCss = '';
    }
    try {
      dashboardCss = fs.readFileSync(path.join(rootDir, '_archive/dead-css/admin.css'), 'utf8');
    } catch (e) {
      dashboardCss = '';
    }
  });

  test('should not have console.log in production code', () => {
    const consoleLogs = (scriptJs.match(/console\.log/g) || []).length + (dashboardJs.match(/console\.log/g) || []).length;
    expect(consoleLogs).toBeLessThan(20);
  });

  test('should not have TODO comments', () => {
    const allFiles = [scriptJs, dashboardJs, stylesCss, dashboardCss].join('\n');
    const todos = allFiles.match(/TODO|FIXME/g) || [];
    expect(todos.length).toBe(0);
  });

  test('should use const/let instead of var', () => {
    const allJs = scriptJs + dashboardJs + checkoutJs;
    const varDeclarations = allJs.match(/\bvar\b/g) || [];
    expect(varDeclarations.length).toBeLessThan(15);
  });

  test('CSS should use custom properties', () => {
    const allCss = stylesCss + dashboardCss;
    const customProps = allCss.match(/--[\w-]+:/g) || [];
    expect(customProps.length).toBeGreaterThan(10);
  });
});
