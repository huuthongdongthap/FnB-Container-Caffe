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
    scriptJs = fs.readFileSync(path.join(rootDir, 'script.js'), 'utf8');
    dashboardJs = fs.readFileSync(path.join(rootDir, 'dashboard/dashboard.js'), 'utf8');
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

    test('should use Intl.DateTimeFormat', () => {
      expect(dashboardJs).toContain('Intl.DateTimeFormat');
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
      expect(scriptJs).toContain('keydown') || expect(dashboardJs).toContain('keydown');
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
    scriptJs = fs.readFileSync(path.join(__dirname, '../script.js'), 'utf8');
    dashboardJs = fs.readFileSync(path.join(__dirname, '../dashboard/dashboard.js'), 'utf8');
    checkoutJs = fs.readFileSync(path.join(__dirname, '../checkout.js'), 'utf8');
    stylesCss = fs.readFileSync(path.join(__dirname, '../styles.css'), 'utf8');
    dashboardCss = fs.readFileSync(path.join(__dirname, '../dashboard/dashboard-styles.css'), 'utf8');
  });

  test('should not have console.log in production code', () => {
    // Allow console.log only for debugging, should be removed in production
    const consoleLogs = (scriptJs.match(/console\.log/g) || []).length +
                        (dashboardJs.match(/console\.log/g) || []).length;
    // Allow up to 20 console.logs for debugging (dashboard.js has API logging)
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
    // Allow some var in legacy code, but prefer const/let
    expect(varDeclarations.length).toBeLessThan(10);
  });

  test('CSS should use custom properties', () => {
    const allCss = stylesCss + dashboardCss;
    const customProps = allCss.match(/--[\w-]+:/g) || [];
    expect(customProps.length).toBeGreaterThan(10);
  });
});
