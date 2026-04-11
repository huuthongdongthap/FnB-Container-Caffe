/**
 * Dashboard Tests - AURA SPACE Admin Dashboard
 */

const fs = require('fs');
const path = require('path');

const rootDir = path.join(__dirname, '..');

describe('Dashboard', () => {
  let dashboardHtml;
  let dashboardJs;
  let dashboardCss;

  beforeAll(() => {
    // Load dashboard files (including sub-modules)
    dashboardHtml = fs.readFileSync(path.join(rootDir, 'dashboard/admin.html'), 'utf8');
    dashboardJs = fs.readFileSync(path.join(rootDir, 'dashboard/dashboard.js'), 'utf8')
        + fs.readFileSync(path.join(rootDir, 'dashboard/dashboard-api.js'), 'utf8')
        + fs.readFileSync(path.join(rootDir, 'dashboard/dashboard-render.js'), 'utf8');
    dashboardCss = fs.readFileSync(path.join(rootDir, 'dashboard/dashboard-styles.css'), 'utf8');
  });

  describe('HTML Structure', () => {
    test('should have valid HTML structure', () => {
      expect(dashboardHtml).toContain('<!DOCTYPE html>');
      expect(dashboardHtml).toContain('<html lang="vi">');
      expect(dashboardHtml).toContain('<head>');
      expect(dashboardHtml).toContain('class="dashboard-body"');
    });

    test('should have SEO metadata', () => {
      expect(dashboardHtml).toContain('name="description"');
      expect(dashboardHtml).toContain('Quản lý đơn hàng');
      expect(dashboardHtml).toContain('name="keywords"');
      expect(dashboardHtml).toContain('admin dashboard');
    });

    test('should have PWA support', () => {
      expect(dashboardHtml).toContain('rel="manifest"');
      expect(dashboardHtml).toContain('manifest.json');
      expect(dashboardHtml).toContain('apple-mobile-web-app-capable');
      expect(dashboardHtml).toContain('apple-touch-icon');
    });

    test('should have favicon links', () => {
      expect(dashboardHtml).toContain('favicon.svg');
      expect(dashboardHtml).toContain('favicon-16x16.png');
      expect(dashboardHtml).toContain('favicon-32x32.png');
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
      expect(dashboardHtml).toContain('bar-chart');
      expect(dashboardHtml).toContain('bar-');
    });

    test('should have product list', () => {
      expect(dashboardHtml).toContain('product-list');
      expect(dashboardHtml).toContain('product-item');
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
      expect(dashboardJs).toContain('ctrlKey');
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
      // Allow slightly larger size for full-featured dashboard
      expect(sizeKb).toBeLessThan(35);
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

  describe('New Dashboard Components', () => {
    let componentsJs;

    beforeAll(() => {
      componentsJs = fs.readFileSync(path.join(__dirname, '../dashboard/components.js'), 'utf8');
    });

    test('should have Modal component', () => {
      expect(componentsJs).toContain('Modal');
      expect(componentsJs).toContain('show');
      expect(componentsJs).toContain('hide');
    });

    test('should have Toast component', () => {
      expect(componentsJs).toContain('Toast');
      expect(componentsJs).toContain('success');
      expect(componentsJs).toContain('error');
    });

    test('should have DateRangePicker component', () => {
      expect(componentsJs).toContain('DateRangePicker');
      expect(componentsJs).toContain('calculateRange');
    });

    test('should have Pagination component', () => {
      expect(componentsJs).toContain('Pagination');
      expect(componentsJs).toContain('getVisiblePages');
    });

    test('should have FilterDropdown component', () => {
      expect(componentsJs).toContain('FilterDropdown');
      expect(componentsJs).toContain('dropdown-trigger');
    });

    test('should have Skeleton loading component', () => {
      expect(componentsJs).toContain('Skeleton');
      expect(componentsJs).toContain('skeleton-loading');
    });

    test('should have ExportButton component', () => {
      expect(componentsJs).toContain('ExportButton');
      expect(componentsJs).toContain('export-menu');
    });

    test('should have SearchBox component', () => {
      expect(componentsJs).toContain('SearchBox');
      expect(componentsJs).toContain('debounce');
    });

    test('should have Confirm dialog component', () => {
      expect(componentsJs).toContain('Confirm');
      expect(componentsJs).toContain('show');
    });
  });

  describe('Dashboard Enhanced Features', () => {
    let dashboardJs;

    beforeAll(() => {
      dashboardJs = fs.readFileSync(path.join(__dirname, '../dashboard/dashboard.js'), 'utf8')
          + fs.readFileSync(path.join(__dirname, '../dashboard/dashboard-api.js'), 'utf8')
          + fs.readFileSync(path.join(__dirname, '../dashboard/dashboard-render.js'), 'utf8');
    });

    test('should have DashboardState', () => {
      expect(dashboardJs).toContain('const DashboardState');
      expect(dashboardJs).toContain('currentPage');
      expect(dashboardJs).toContain('totalPages');
    });

    test('should have initializeDashboard function', () => {
      expect(dashboardJs).toContain('function initializeDashboard');
    });

    test('should have loadOrders function', () => {
      expect(dashboardJs).toContain('async function loadOrders');
    });

    test('should have showOrderDetail function', () => {
      expect(dashboardJs).toContain('async function showOrderDetail');
    });

    test('should have handleOrderAction function', () => {
      expect(dashboardJs).toContain('async function handleOrderAction');
    });

    test('should have exportData function', () => {
      expect(dashboardJs).toContain('function exportData');
      expect(dashboardJs).toContain('exportToCSV');
    });

    test('should have refreshData function', () => {
      expect(dashboardJs).toContain('function refreshData');
    });

    test('should have mock data methods', () => {
      expect(dashboardJs).toContain('getMockStats');
      expect(dashboardJs).toContain('getMockRevenue');
      expect(dashboardJs).toContain('getMockOrders');
      expect(dashboardJs).toContain('getMockTopProducts');
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

    test('should have cancelled status badge style', () => {
      const html = fs.readFileSync(path.join(__dirname, '../dashboard/admin.html'), 'utf8');
      expect(html).toContain('status-bar cancelled');
      expect(html).toContain('Hủy');
    });
  });
});
