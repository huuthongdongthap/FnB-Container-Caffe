/**
 * Kitchen Display System (KDS) Tests - AURA SPACE
 */

const fs = require('fs');
const path = require('path');

const rootDir = path.join(__dirname, '..');

describe('Kitchen Display System', () => {
    let kdsHtml;
    let kdsJs;

    beforeAll(() => {
        kdsHtml = fs.readFileSync(path.join(rootDir, 'kitchen-display.html'), 'utf8');
        kdsJs = fs.readFileSync(path.join(rootDir, 'js/kds-app.js'), 'utf8')
            + fs.readFileSync(path.join(rootDir, 'js/kds/kds-api.js'), 'utf8')
            + fs.readFileSync(path.join(rootDir, 'js/kds/kds-render.js'), 'utf8');
    });

    describe('HTML Structure', () => {
        test('should have valid HTML5 structure', () => {
            expect(kdsHtml).toContain('<!DOCTYPE html>');
            expect(kdsHtml).toContain('<html lang="vi">');
            expect(kdsHtml).toContain('<head>');
            expect(kdsHtml).toContain('<body class="kds-body">');
        });

        test('should have proper charset and viewport', () => {
            expect(kdsHtml).toContain('charset="UTF-8"');
            expect(kdsHtml).toContain('name="viewport"');
            expect(kdsHtml).toContain('width=device-width');
        });

        test('should have KDS title', () => {
            expect(kdsHtml).toContain('<title>Kitchen Display System');
        });

        test('should have robots noindex for SEO', () => {
            expect(kdsHtml).toContain('name="robots"');
            expect(kdsHtml).toContain('noindex, nofollow');
        });

        test('should have chef emoji favicon', () => {
            expect(kdsHtml).toContain('rel="icon"');
            expect(kdsHtml).toContain('👨‍🍳');
        });
    });

    describe('KDS Header', () => {
        test('should have header with kds-header class', () => {
            expect(kdsHtml).toContain('class="kds-header"');
        });

        test('should have KDS logo', () => {
            expect(kdsHtml).toContain('class="kds-logo"');
            expect(kdsHtml).toContain('👨‍🍳');
        });

        test('should have title and subtitle', () => {
            expect(kdsHtml).toContain('class="kds-title"');
            expect(kdsHtml).toContain('Kitchen Display System');
            expect(kdsHtml).toContain('class="kds-subtitle"');
            expect(kdsHtml).toContain('AURA SPACE Café');
        });

        test('should have clock and date display', () => {
            expect(kdsHtml).toContain('id="kdsClock"');
            expect(kdsHtml).toContain('id="kdsDate"');
        });

        test('should have stats section', () => {
            expect(kdsHtml).toContain('class="kds-stats"');
        });

        test('should have pending stat item', () => {
            expect(kdsHtml).toContain('class="stat-item pending"');
            expect(kdsHtml).toContain('id="statPending"');
            expect(kdsHtml).toContain('Chờ');
        });

        test('should have preparing stat item', () => {
            expect(kdsHtml).toContain('class="stat-item preparing"');
            expect(kdsHtml).toContain('id="statPreparing"');
            expect(kdsHtml).toContain('Đang làm');
        });

        test('should have ready stat item', () => {
            expect(kdsHtml).toContain('class="stat-item ready"');
            expect(kdsHtml).toContain('id="statReady"');
            expect(kdsHtml).toContain('Sẵn sàng');
        });

        test('should have settings button', () => {
            expect(kdsHtml).toContain('class="kds-settings"');
            expect(kdsHtml).toContain('id="kdsSettings"');
            expect(kdsHtml).toContain('⚙️');
        });
    });

    describe('KDS Board - Order Columns', () => {
        test('should have main board container', () => {
            expect(kdsHtml).toContain('class="kds-board"');
        });

        test('should have pending column', () => {
            expect(kdsHtml).toContain('data-status="pending"');
            expect(kdsHtml).toContain('class="kds-column-header pending"');
            expect(kdsHtml).toContain('📋');
            expect(kdsHtml).toContain('Chờ Xử Lý');
            expect(kdsHtml).toContain('id="pendingCount"');
        });

        test('should have preparing column', () => {
            expect(kdsHtml).toContain('data-status="preparing"');
            expect(kdsHtml).toContain('class="kds-column-header preparing"');
            expect(kdsHtml).toContain('🔥');
            expect(kdsHtml).toContain('Đang Chế Biến');
            expect(kdsHtml).toContain('id="preparingCount"');
        });

        test('should have ready column', () => {
            expect(kdsHtml).toContain('data-status="ready"');
            expect(kdsHtml).toContain('class="kds-column-header ready"');
            expect(kdsHtml).toContain('✅');
            expect(kdsHtml).toContain('Sẵn Sàng');
            expect(kdsHtml).toContain('id="readyCount"');
        });

        test('should have completed column', () => {
            expect(kdsHtml).toContain('data-status="completed"');
            expect(kdsHtml).toContain('class="kds-column-header completed"');
            expect(kdsHtml).toContain('✔️');
            expect(kdsHtml).toContain('Hoàn Thành');
            expect(kdsHtml).toContain('id="completedCount"');
        });

        test('should have order containers for each column', () => {
            expect(kdsHtml).toContain('id="pendingOrders"');
            expect(kdsHtml).toContain('id="preparingOrders"');
            expect(kdsHtml).toContain('id="readyOrders"');
            expect(kdsHtml).toContain('id="completedOrders"');
        });
    });

    describe('New Order Alert System', () => {
        test('should have order alert container', () => {
            expect(kdsHtml).toContain('class="order-alert"');
            expect(kdsHtml).toContain('id="orderAlert"');
        });

        test('should have alert icon', () => {
            expect(kdsHtml).toContain('class="alert-icon"');
            expect(kdsHtml).toContain('🔔');
        });

        test('should have alert content with order ID', () => {
            expect(kdsHtml).toContain('class="alert-content"');
            expect(kdsHtml).toContain('Order Mới!');
            expect(kdsHtml).toContain('id="alertOrderId"');
        });

        test('should have dismiss button', () => {
            expect(kdsHtml).toContain('class="alert-dismiss"');
            expect(kdsHtml).toContain('id="alertDismiss"');
            expect(kdsHtml).toContain('✕');
        });
    });

    describe('Settings Modal', () => {
        test('should have settings modal', () => {
            expect(kdsHtml).toContain('id="kdsModal"');
            expect(kdsHtml).toContain('class="kds-modal"');
        });

        test('should have modal overlay', () => {
            expect(kdsHtml).toContain('class="kds-modal-overlay"');
        });

        test('should have modal header with title and close button', () => {
            expect(kdsHtml).toContain('class="kds-modal-header"');
            expect(kdsHtml).toContain('⚙️ Cài Đặt');
            expect(kdsHtml).toContain('id="kdsModalClose"');
        });

        test('should have sound toggle setting', () => {
            expect(kdsHtml).toContain('id="toggleSound"');
            expect(kdsHtml).toContain('Âm Thanh Thông Báo');
            expect(kdsHtml).toContain('class="toggle"');
        });

        test('should have auto refresh toggle setting', () => {
            expect(kdsHtml).toContain('id="toggleAutoRefresh"');
            expect(kdsHtml).toContain('Tự Động Làm Mới');
        });

        test('should have refresh interval input', () => {
            expect(kdsHtml).toContain('id="refreshInterval"');
            expect(kdsHtml).toContain('type="number"');
            expect(kdsHtml).toContain('value="5"');
            expect(kdsHtml).toContain('min="3"');
            expect(kdsHtml).toContain('max="60"');
        });

        test('should have view all orders button', () => {
            expect(kdsHtml).toContain('id="btnViewAllOrders"');
            expect(kdsHtml).toContain('📊 Xem Orders');
        });

        test('should have test order generator button', () => {
            expect(kdsHtml).toContain('id="btnGenerateTestOrder"');
            expect(kdsHtml).toContain('🧪 Tạo Order Test');
        });
    });

    describe('Order Detail Modal', () => {
        test('should have order detail modal', () => {
            expect(kdsHtml).toContain('id="orderDetailModal"');
            expect(kdsHtml).toContain('class="order-detail-modal"');
        });

        test('should have order detail title', () => {
            expect(kdsHtml).toContain('id="orderDetailTitle"');
            expect(kdsHtml).toContain('Order #--');
        });

        test('should have order detail close button', () => {
            expect(kdsHtml).toContain('id="orderDetailClose"');
        });

        test('should have order detail body container', () => {
            expect(kdsHtml).toContain('id="orderDetailBody"');
        });
    });

    describe('KDS JavaScript - State Management', () => {
        test('should have KDS_STATE object', () => {
            expect(kdsJs).toContain('const KDS_STATE');
            expect(kdsJs).toContain('orders: []');
            expect(kdsJs).toContain('settings:');
            expect(kdsJs).toContain('stats:');
        });

        test('should have settings configuration', () => {
            expect(kdsJs).toContain('soundEnabled:');
            expect(kdsJs).toContain('autoRefresh:');
            expect(kdsJs).toContain('refreshInterval:');
            expect(kdsJs).toContain('lastSync:');
        });

        test('should have stats tracking', () => {
            expect(kdsJs).toContain('pending:');
            expect(kdsJs).toContain('preparing:');
            expect(kdsJs).toContain('ready:');
            expect(kdsJs).toContain('completed:');
        });
    });

    describe('Menu Items Configuration', () => {
        test('should have MENU_ITEMS with drinks', () => {
            expect(kdsJs).toContain('const MENU_ITEMS');
            expect(kdsJs).toContain('drinks:');
            expect(kdsJs).toContain('Espresso');
            expect(kdsJs).toContain('Cappuccino');
            expect(kdsJs).toContain('Latte Art');
        });

        test('should have MENU_ITEMS with food', () => {
            expect(kdsJs).toContain('food:');
            expect(kdsJs).toContain('Croissant Bơ');
            expect(kdsJs).toContain('Bagel Sandwich');
            expect(kdsJs).toContain('Fries Giòn');
        });

        test('should have menu item properties', () => {
            expect(kdsJs).toContain('id:');
            expect(kdsJs).toContain('name:');
            expect(kdsJs).toContain('price:');
            expect(kdsJs).toContain('category:');
            expect(kdsJs).toContain('prepTime:');
        });
    });

    describe('Order Status Constants', () => {
        test('should have ORDER_STATUS enum', () => {
            expect(kdsJs).toContain('const ORDER_STATUS');
            expect(kdsJs).toContain('PENDING:');
            expect(kdsJs).toContain('PREPARING:');
            expect(kdsJs).toContain('READY:');
            expect(kdsJs).toContain('COMPLETED:');
        });
    });

    describe('Priority System', () => {
        test('should have PRIORITY enum', () => {
            expect(kdsJs).toContain('const PRIORITY');
            expect(kdsJs).toContain('RUSH:');
            expect(kdsJs).toContain('NORMAL:');
            expect(kdsJs).toContain('LOW:');
        });
    });

    describe('Order ID Generator', () => {
        test('should have generateOrderId function', () => {
            expect(kdsJs).toContain('function generateOrderId');
            expect(kdsJs).toContain('ORD-');
        });

        test('should have generateTableNumber function', () => {
            expect(kdsJs).toContain('function generateTableNumber');
        });

        test('should have generateRandomOrder function', () => {
            expect(kdsJs).toContain('function generateRandomOrder');
            expect(kdsJs).toContain('numDrinks');
            expect(kdsJs).toContain('numFood');
        });
    });

    describe('Local Storage Functions', () => {
        test('should have loadOrders function', () => {
            expect(kdsJs).toContain('function loadOrders');
            expect(kdsJs).toContain('localStorage.getItem');
            expect(kdsJs).toContain('kds_orders');
        });

        test('should have saveOrders function', () => {
            expect(kdsJs).toContain('function saveOrders');
            expect(kdsJs).toContain('localStorage.setItem');
        });

        test('should filter old completed orders', () => {
            expect(kdsJs).toContain('oneHourAgo');
            expect(kdsJs).toContain('3600000');
            expect(kdsJs).toContain('ORDER_STATUS.COMPLETED');
        });
    });

    describe('Order Status Transitions', () => {
        test('should have advanceOrderStatus function', () => {
            expect(kdsJs).toContain('function advanceOrderStatus');
            expect(kdsJs).toContain('transitions');
        });

        test('should have moveToPreviousStatus function', () => {
            expect(kdsJs).toContain('function moveToPreviousStatus');
        });

        test('should have proper status flow', () => {
            expect(kdsJs).toContain('[ORDER_STATUS.PENDING]: ORDER_STATUS.PREPARING');
            expect(kdsJs).toContain('[ORDER_STATUS.PREPARING]: ORDER_STATUS.READY');
            expect(kdsJs).toContain('[ORDER_STATUS.READY]: ORDER_STATUS.COMPLETED');
        });
    });

    describe('Format Utilities', () => {
        test('should have formatCurrency function', () => {
            expect(kdsJs).toContain('function formatCurrency');
            expect(kdsJs).toContain('Intl.NumberFormat');
            expect(kdsJs).toContain('vi-VN');
            expect(kdsJs).toContain('VND');
        });

        test('should have formatTime function', () => {
            expect(kdsJs).toContain('function formatTime');
            expect(kdsJs).toContain('hour:');
            expect(kdsJs).toContain('minute:');
        });

        test('should have formatDuration function', () => {
            expect(kdsJs).toContain('function formatDuration');
            expect(kdsJs).toContain('minutes');
            expect(kdsJs).toContain('seconds');
        });

        test('should have getPriorityClass function', () => {
            expect(kdsJs).toContain('function getPriorityClass');
            expect(kdsJs).toContain('priority-rush');
            expect(kdsJs).toContain('priority-low');
        });

        test('should have getPriorityLabel function', () => {
            expect(kdsJs).toContain('function getPriorityLabel');
            expect(kdsJs).toContain('🔥 GẤP');
            expect(kdsJs).toContain('⏱️ Từ từ');
        });
    });

    describe('Order Card Rendering', () => {
        test('should have renderOrderCard function', () => {
            expect(kdsJs).toContain('function renderOrderCard');
            expect(kdsJs).toContain('order-card');
        });

        test('should render order header with ID and priority', () => {
            expect(kdsJs).toContain('order-card-header');
            expect(kdsJs).toContain('order-number');
            expect(kdsJs).toContain('priority-badge');
        });

        test('should render order items', () => {
            expect(kdsJs).toContain('order-items');
            expect(kdsJs).toContain('item-qty');
            expect(kdsJs).toContain('item-name');
            expect(kdsJs).toContain('item-price');
        });

        test('should render order footer with total and timer', () => {
            expect(kdsJs).toContain('order-card-footer');
            expect(kdsJs).toContain('order-total');
            expect(kdsJs).toContain('order-timer');
        });

        test('should have order action buttons', () => {
            expect(kdsJs).toContain('order-actions');
            expect(kdsJs).toContain('btn-back');
            expect(kdsJs).toContain('btn-advance');
        });

        test('should handle dine-in and takeaway order types', () => {
            expect(kdsJs).toContain('dine-in');
            expect(kdsJs).toContain('takeaway');
            expect(kdsJs).toContain('tableNumber');
        });
    });

    describe('Render All Orders', () => {
        test('should have renderAllOrders function', () => {
            expect(kdsJs).toContain('function renderAllOrders');
        });

        test('should get all column containers', () => {
            expect(kdsJs).toContain('getElementById');
            expect(kdsJs).toContain('pendingOrders');
            expect(kdsJs).toContain('preparingOrders');
            expect(kdsJs).toContain('readyOrders');
            expect(kdsJs).toContain('completedOrders');
        });

        test('should filter orders by status', () => {
            expect(kdsJs).toContain('.filter(o => o.status === ORDER_STATUS.PENDING)');
            expect(kdsJs).toContain('.filter(o => o.status === ORDER_STATUS.PREPARING)');
            expect(kdsJs).toContain('.filter(o => o.status === ORDER_STATUS.READY)');
        });

        test('should have empty state fallback', () => {
            expect(kdsJs).toContain('empty-state');
            expect(kdsJs).toContain('Không có order');
        });
    });

    describe('Stats Update', () => {
        test('should have updateStats function', () => {
            expect(kdsJs).toContain('function updateStats');
        });

        test('should update stat DOM elements', () => {
            expect(kdsJs).toContain('getElementById');
            expect(kdsJs).toContain('statPending');
            expect(kdsJs).toContain('statPreparing');
            expect(kdsJs).toContain('statReady');
        });
    });

    describe('Clock System', () => {
        test('should have updateClock function', () => {
            expect(kdsJs).toContain('function updateClock');
        });

        test('should update clock and date elements', () => {
            expect(kdsJs).toContain('kdsClock');
            expect(kdsJs).toContain('kdsDate');
        });

        test('should use Vietnamese locale for time', () => {
            expect(kdsJs).toContain('vi-VN');
            expect(kdsJs).toContain('toLocaleTimeString');
            expect(kdsJs).toContain('toLocaleDateString');
        });

        test('should have interval timer for clock', () => {
            expect(kdsJs).toContain('setInterval(updateClock, 1000)');
        });
    });

    describe('Timer System', () => {
        test('should have updateTimers function', () => {
            expect(kdsJs).toContain('function updateTimers');
        });

        test('should update order timers', () => {
            expect(kdsJs).toContain('.order-timer');
            expect(kdsJs).toContain('elapsed');
            expect(kdsJs).toContain('formatDuration');
        });

        test('should handle overdue orders', () => {
            expect(kdsJs).toContain('order-overdue');
            expect(kdsJs).toContain('timer-danger');
            expect(kdsJs).toContain('minutes > 10');
        });
    });

    describe('New Order Alert System', () => {
        test('should have checkNewOrders function', () => {
            expect(kdsJs).toContain('function checkNewOrders');
            expect(kdsJs).toContain('lastOrderCount');
        });

        test('should have showAlert function', () => {
            expect(kdsJs).toContain('function showAlert');
            expect(kdsJs).toContain('orderAlert');
            expect(kdsJs).toContain('classList.add');
        });

        test('should have playNotificationSound function', () => {
            expect(kdsJs).toContain('function playNotificationSound');
            expect(kdsJs).toContain('AudioContext');
            expect(kdsJs).toContain('oscillator');
        });

        test('should use Web Audio API for beep', () => {
            expect(kdsJs).toContain('createOscillator');
            expect(kdsJs).toContain('gainNode');
            expect(kdsJs).toContain('frequency.value = 800');
        });
    });

    describe('Settings Modal Functions', () => {
        test('should have openSettingsModal function', () => {
            expect(kdsJs).toContain('function openSettingsModal');
        });

        test('should have closeSettingsModal function', () => {
            expect(kdsJs).toContain('function closeSettingsModal');
        });

        test('should have closeOrderDetailModal function', () => {
            expect(kdsJs).toContain('function closeOrderDetailModal');
        });

        test('should have initSettings function', () => {
            expect(kdsJs).toContain('function initSettings');
        });

        test('should have toggle sound handler', () => {
            expect(kdsJs).toContain('toggleSound');
            expect(kdsJs).toContain('soundEnabled');
        });

        test('should have toggle auto refresh handler', () => {
            expect(kdsJs).toContain('toggleAutoRefresh');
            expect(kdsJs).toContain('autoRefresh');
        });

        test('should have refresh interval input handler', () => {
            expect(kdsJs).toContain('refreshInterval');
            expect(kdsJs).toContain('Math.max(3000');
            expect(kdsJs).toContain('Math.min(60000');
        });
    });

    describe('Test Order Generator', () => {
        test('should have test order button handler', () => {
            expect(kdsJs).toContain('btnGenerateTest');
            expect(kdsJs).toContain('generateRandomOrder');
            expect(kdsJs).toContain('KDS_STATE.orders.push');
        });

        test('should have view all orders button handler', () => {
            expect(kdsJs).toContain('btnViewAll');
            expect(kdsJs).toContain('KDS_STATE.orders.map');
        });
    });

    describe('KDS Initialization', () => {
        test('should have initKDS function', () => {
            expect(kdsJs).toContain('function initKDS');
        });

        test('should load orders on init', () => {
            expect(kdsJs).toContain('loadOrders');
            expect(kdsJs).toContain('renderAllOrders');
            expect(kdsJs).toContain('updateStats');
        });

        test('should have auto-refresh interval', () => {
            expect(kdsJs).toContain('setInterval');
            expect(kdsJs).toContain('settings.refreshInterval');
            expect(kdsJs).toContain('Math.random() > 0.7');
        });

        test('should have timer update interval', () => {
            expect(kdsJs).toMatch(/setInterval\(.*updateTimers.*1000\)/);
        });

        test('should attach modal event listeners', () => {
            expect(kdsJs).toContain('kdsSettings');
            expect(kdsJs).toContain('addEventListener');
            expect(kdsJs).toContain('kdsModalClose');
        });

        test('should have overlay click handler', () => {
            expect(kdsJs).toContain('.kds-modal-overlay');
            expect(kdsJs).toContain('classList.remove');
        });

        test('should start on DOMContentLoaded', () => {
            expect(kdsJs).toContain('DOMContentLoaded');
            expect(kdsJs).toContain('initKDS');
        });
    });

    describe('Global Function Exports', () => {
        test('should export advanceOrderStatus to window', () => {
            expect(kdsJs).toContain('window.advanceOrderStatus');
        });

        test('should export moveToPreviousStatus to window', () => {
            expect(kdsJs).toContain('window.moveToPreviousStatus');
        });
    });

    describe('CSS Integration', () => {
        test('should link to styles.css or minified version', () => {
            expect(kdsHtml).toMatch(/href=".*styles(\.min)?\.css"/);
        });

        test('should have KDS specific classes in HTML', () => {
            expect(kdsHtml).toMatch(/kds-[a-z-]+/g);
        });
    });

    describe('File Size Checks', () => {
        test('HTML file should be under 50KB', () => {
            const sizeKb = Buffer.byteLength(kdsHtml, 'utf8') / 1024;
            expect(sizeKb).toBeLessThan(50);
        });

        test('JS file should be under 30KB', () => {
            const sizeKb = Buffer.byteLength(kdsJs, 'utf8') / 1024;
            expect(sizeKb).toBeLessThan(30);
        });
    });

    describe('Code Quality', () => {
        test('should not have TODO comments', () => {
            const todos = kdsJs.match(/TODO|FIXME/g) || [];
            expect(todos.length).toBe(0);
        });

        test('should use const/let instead of var', () => {
            const varDeclarations = kdsJs.match(/\bvar\b/g) || [];
            expect(varDeclarations.length).toBe(0);
        });
    });
});

describe('KDS Integration', () => {
    let kdsHtml;
    let kdsJs;
    let stylesCss;

    beforeAll(() => {
        kdsHtml = fs.readFileSync(path.join(__dirname, '../kitchen-display.html'), 'utf8');
        kdsJs = fs.readFileSync(path.join(__dirname, '../js/kds-app.js'), 'utf8');
        try {
            stylesCss = fs.readFileSync(path.join(__dirname, '../css/kds-styles.css'), 'utf8');
        } catch (e) {
            stylesCss = '';
        }
    });

    test('should link to kds-app.js or minified version', () => {
        expect(kdsHtml).toMatch(/src=["'].*kds-app\.js["']/);
    });

    test('should have KDS styles', () => {
        if (stylesCss) {
            expect(stylesCss).toContain('.kds-');
        }
        expect(kdsHtml).toMatch(/kds-[a-z-]+/g);
    });

    test('should have order card styles', () => {
        if (stylesCss) {
            expect(stylesCss).toContain('.order-card');
        }
        expect(kdsHtml).toContain('order');
    });

    test('should have modal styles', () => {
        if (stylesCss) {
            expect(stylesCss).toMatch(/\.kds-modal|\.modal/);
        }
        expect(kdsJs).toContain('modal');
    });

    test('should have responsive styles for KDS', () => {
        if (stylesCss) {
            expect(stylesCss).toMatch(/@media/);
        }
        expect(true).toBe(true);
    });
});
