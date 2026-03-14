/**
 * Dashboard Tests - F&B Caffe Container Admin Dashboard
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.join(__dirname, '..');

describe('Dashboard', () => {
  let dashboardHtml;
  let dashboardJs;
  let dashboardCss;

  beforeAll(() => {
    // Load dashboard files
    dashboardHtml = fs.readFileSync(path.join(rootDir, 'dashboard/admin.html'), 'utf8');
    dashboardJs = fs.readFileSync(path.join(rootDir, 'dashboard/dashboard.js'), 'utf8');
    dashboardCss = fs.readFileSync(path.join(rootDir, 'dashboard/dashboard-styles.css'), 'utf8');
  });

  describe('HTML Structure', () => {
    test('should have valid HTML structure', () => {
      expect(dashboardHtml).toContain('<!DOCTYPE html>');
      expect(dashboardHtml).toContain('<html lang="vi">');
      expect(dashboardHtml).toContain('<head>');
      expect(dashboardHtml).toContain('<body>');
    });

    test('should have sidebar navigation', () => {
      expect(dashboardHtml).toContain('id="sidebar"');
      expect(dashboardHtml).toContain('class="sidebar-nav"');
      expect(dashboardHtml).toContain('class="nav-item');
    });

    test('should have all required navigation items', () => {
      const navItems = [
        'Dashboard',
        'Đơn hàng',
        'Thực đơn',
        'Kho',
        'Doanh thu',
        'Thống kê',
        'Khách hàng',
        'Nhân viên',
        'Cài đặt'
      ];

      navItems.forEach(item => {
        expect(dashboardHtml).toContain(item);
      });
    });

    test('should have stats grid', () => {
      expect(dashboardHtml).toContain('class="stats-grid"');
      expect(dashboardHtml).toContain('class="stat-card');
    });

    test('should have orders table', () => {
      expect(dashboardHtml).toContain('class="orders-table"');
      expect(dashboardHtml).toContain('<table>');
      expect(dashboardHtml).toContain('<thead>');
      expect(dashboardHtml).toContain('<tbody>');
    });

    test('should have revenue chart', () => {
      expect(dashboardHtml).toContain('class="bar-chart"');
      expect(dashboardHtml).toContain('class="bar-group"');
    });

    test('should have product list', () => {
      expect(dashboardHtml).toContain('class="product-list"');
      expect(dashboardHtml).toContain('class="product-item"');
    });

    test('should have quick actions', () => {
      expect(dashboardHtml).toContain('class="quick-actions"');
      expect(dashboardHtml).toContain('class="action-btn"');
    });
  });

  describe('CSS Styling', () => {
    test('should define dashboard CSS variables', () => {
      expect(dashboardCss).toContain(':root');
      expect(dashboardCss).toContain('--dash-bg');
      expect(dashboardCss).toContain('--dash-surface');
      expect(dashboardCss).toContain('--dash-card');
      expect(dashboardCss).toContain('--dash-border');
    });

    test('should have status colors defined', () => {
      expect(dashboardCss).toContain('--status-success');
      expect(dashboardCss).toContain('--status-warning');
      expect(dashboardCss).toContain('--status-info');
      expect(dashboardCss).toContain('--status-danger');
    });

    test('should have responsive breakpoints', () => {
      expect(dashboardCss).toMatch(/@media.*max-width.*1440px/s);
      expect(dashboardCss).toMatch(/@media.*max-width.*1024px/s);
      expect(dashboardCss).toMatch(/@media.*max-width.*768px/s);
    });

    test('should have sidebar styles', () => {
      expect(dashboardCss).toContain('.sidebar');
      expect(dashboardCss).toContain('.sidebar-header');
      expect(dashboardCss).toContain('.sidebar-nav');
      expect(dashboardCss).toContain('.sidebar-footer');
    });

    test('should have card styles', () => {
      expect(dashboardCss).toContain('.card');
      expect(dashboardCss).toContain('.card-header');
      expect(dashboardCss).toContain('.card-body');
    });

    test('should have stat card styles', () => {
      expect(dashboardCss).toContain('.stat-card');
      expect(dashboardCss).toContain('.stat-header');
      expect(dashboardCss).toContain('.stat-body');
      expect(dashboardCss).toContain('.stat-value');
    });
  });

  describe('JavaScript Functionality', () => {
    test('should have DOMContentLoaded listener', () => {
      expect(dashboardJs).toContain('DOMContentLoaded');
    });

    test('should have sidebar toggle functionality', () => {
      expect(dashboardJs).toContain('menuToggle');
      expect(dashboardJs).toContain('sidebar.classList.toggle');
    });

    test('should have navigation active state handling', () => {
      expect(dashboardJs).toContain('nav-item');
      expect(dashboardJs).toContain('classList.remove(\'active\')');
      expect(dashboardJs).toContain('classList.add(\'active\')');
    });

    test('should have search functionality', () => {
      expect(dashboardJs).toContain('searchInput');
      expect(dashboardJs).toContain('addEventListener(\'input\'');
    });

    test('should have keyboard shortcuts', () => {
      expect(dashboardJs).toContain('keydown');
      expect(dashboardJs).toContain('Ctrl');
      expect(dashboardJs).toContain('metaKey');
    });

    test('should have utility functions exported', () => {
      expect(dashboardJs).toContain('formatCurrency');
      expect(dashboardJs).toContain('formatDate');
      expect(dashboardJs).toContain('debounce');
      expect(dashboardJs).toContain('window.DashboardUtils');
    });
  });

  describe('Accessibility', () => {
    test('should have proper ARIA attributes', () => {
      // Check for role attributes
      expect(dashboardHtml).toMatch(/role|aria-/i);
    });

    test('should have lang attribute on html', () => {
      expect(dashboardHtml).toContain('lang="vi"');
    });

    test('should have viewport meta tag', () => {
      expect(dashboardHtml).toContain('name="viewport"');
      expect(dashboardHtml).toContain('width=device-width');
    });
  });

  describe('File Size Checks', () => {
    test('HTML file should be under 100KB', () => {
      const sizeKb = Buffer.byteLength(dashboardHtml, 'utf8') / 1024;
      expect(sizeKb).toBeLessThan(100);
    });

    test('CSS file should be under 50KB', () => {
      const sizeKb = Buffer.byteLength(dashboardCss, 'utf8') / 1024;
      expect(sizeKb).toBeLessThan(50);
    });

    test('JS file should be under 30KB', () => {
      const sizeKb = Buffer.byteLength(dashboardJs, 'utf8') / 1024;
      expect(sizeKb).toBeLessThan(30);
    });
  });
});

describe('Dashboard Components', () => {
  describe('Stats Cards', () => {
    test('should have revenue stat card', () => {
      const html = fs.readFileSync(path.join(__dirname, '../dashboard/admin.html'), 'utf8');
      expect(html).toContain('Doanh thu hôm nay');
      expect(html).toContain('class="stat-card revenue"');
    });

    test('should have orders stat card', () => {
      const html = fs.readFileSync(path.join(__dirname, '../dashboard/admin.html'), 'utf8');
      expect(html).toContain('class="stat-card orders"');
      expect(html).toContain('Đơn hàng');
    });

    test('should have customers stat card', () => {
      const html = fs.readFileSync(path.join(__dirname, '../dashboard/admin.html'), 'utf8');
      expect(html).toContain('class="stat-card customers"');
      expect(html).toContain('Khách hàng');
    });

    test('should have products stat card', () => {
      const html = fs.readFileSync(path.join(__dirname, '../dashboard/admin.html'), 'utf8');
      expect(html).toContain('class="stat-card products"');
      expect(html).toContain('Sản phẩm bán chạy');
    });
  });

  describe('Status Badges', () => {
    test('should have completed status badge', () => {
      const html = fs.readFileSync(path.join(__dirname, '../dashboard/admin.html'), 'utf8');
      expect(html).toContain('status-badge completed');
      expect(html).toContain('Hoàn thành');
    });

    test('should have processing status badge', () => {
      const html = fs.readFileSync(path.join(__dirname, '../dashboard/admin.html'), 'utf8');
      expect(html).toContain('status-badge processing');
      expect(html).toContain('Đang chế biến');
    });

    test('should have pending status badge', () => {
      const html = fs.readFileSync(path.join(__dirname, '../dashboard/admin.html'), 'utf8');
      expect(html).toContain('status-badge pending');
      expect(html).toContain('Đang chờ');
    });

    test('should have cancelled status badge', () => {
      const html = fs.readFileSync(path.join(__dirname, '../dashboard/admin.html'), 'utf8');
      expect(html).toContain('status-badge cancelled');
      expect(html).toContain('Hủy');
    });
  });
});
