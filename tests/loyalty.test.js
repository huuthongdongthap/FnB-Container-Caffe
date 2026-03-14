/**
 * Customer Loyalty Program Tests - F&B Caffe Container
 */

const fs = require('fs');
const path = require('path');

const rootDir = path.join(__dirname, '..');

describe('Customer Loyalty Program', () => {
    let loyaltyJs;
    let loyaltyStyles;
    let indexHtml;

    beforeAll(() => {
        loyaltyJs = fs.readFileSync(path.join(rootDir, 'public/loyalty.js'), 'utf8');
        loyaltyStyles = fs.readFileSync(path.join(rootDir, 'public/loyalty-styles.css'), 'utf8');
        indexHtml = fs.readFileSync(path.join(rootDir, 'index.html'), 'utf8');
    });

    describe('Loyalty JavaScript Module', () => {
        test('should have CUSTOMER_TIERS constant defined', () => {
            expect(loyaltyJs).toContain('const CUSTOMER_TIERS');
        });

        test('should have Dong (Bronze) tier', () => {
            expect(loyaltyJs).toContain('DONG');
            expect(loyaltyJs).toContain('Thành viên Đồng');
        });

        test('should have Bac (Silver) tier', () => {
            expect(loyaltyJs).toContain('BAC');
            expect(loyaltyJs).toContain('Thành viên Bạc');
        });

        test('should have Vang (Gold) tier', () => {
            expect(loyaltyJs).toContain('VANG');
            expect(loyaltyJs).toContain('Thành viên Vàng');
        });

        test('should have Kim Cuong (Diamond) tier', () => {
            expect(loyaltyJs).toContain('KIM_CUONG');
            expect(loyaltyJs).toContain('Thành viên Kim Cương');
        });

        test('should have POINTS_RULES constant', () => {
            expect(loyaltyJs).toContain('const POINTS_RULES');
        });

        test('should have BASE_EARN_RATE defined', () => {
            expect(loyaltyJs).toContain('BASE_EARN_RATE');
        });

        test('should have REDEMPTION_RATE defined', () => {
            expect(loyaltyJs).toContain('REDEMPTION_RATE');
        });

        test('should have BIRTHDAY_BONUS defined', () => {
            expect(loyaltyJs).toContain('BIRTHDAY_BONUS');
        });
    });

    describe('LoyaltyManager Class', () => {
        test('should have LoyaltyManager class defined', () => {
            expect(loyaltyJs).toContain('class LoyaltyManager');
        });

        test('should have constructor method', () => {
            expect(loyaltyJs).toContain('constructor()');
        });

        test('should have getTier method', () => {
            expect(loyaltyJs).toContain('getTier()');
        });

        test('should have earnPoints method', () => {
            expect(loyaltyJs).toContain('earnPoints');
        });

        test('should have redeemPoints method', () => {
            expect(loyaltyJs).toContain('redeemPoints');
        });

        test('should have getHistory method', () => {
            expect(loyaltyJs).toContain('getHistory');
        });

        test('should use localStorage for persistence', () => {
            expect(loyaltyJs).toContain('localStorage.getItem');
            expect(loyaltyJs).toContain('localStorage.setItem');
        });
    });

    describe('UI Helper Functions', () => {
        test('should have renderTierBadge function', () => {
            expect(loyaltyJs).toContain('function renderTierBadge');
        });

        test('should have renderPointsBalance function', () => {
            expect(loyaltyJs).toContain('function renderPointsBalance');
        });

        test('should have renderTierProgress function', () => {
            expect(loyaltyJs).toContain('function renderTierProgress');
        });

        test('should have renderTransactionItem function', () => {
            expect(loyaltyJs).toContain('function renderTransactionItem');
        });

        test('should export functions to window object', () => {
            expect(loyaltyJs).toContain('window.LoyaltyManager');
            expect(loyaltyJs).toContain('window.CUSTOMER_TIERS');
        });
    });

    describe('Loyalty CSS Styles', () => {
        test('should have loyalty-widget styles', () => {
            expect(loyaltyStyles).toContain('.loyalty-widget');
        });

        test('should have tier-badge styles', () => {
            expect(loyaltyStyles).toContain('.tier-badge');
        });

        test('should have points-balance styles', () => {
            expect(loyaltyStyles).toContain('.points-balance');
        });

        test('should have tier-progress styles', () => {
            expect(loyaltyStyles).toContain('.tier-progress');
        });

        test('should have transaction-history styles', () => {
            expect(loyaltyStyles).toContain('.transaction-history');
            expect(loyaltyStyles).toContain('.transaction-item');
        });

        test('should have responsive styles', () => {
            expect(loyaltyStyles).toMatch(/@media.*max-width.*768px/s);
            expect(loyaltyStyles).toMatch(/@media.*max-width.*375px/s);
        });
    });

    describe('Loyalty Section in Index Page', () => {
        test('should have loyalty section', () => {
            expect(indexHtml).toContain('loyalty-section') || expect(indexHtml).toContain('id="loyalty"');
        });

        test('should link to loyalty.js', () => {
            expect(indexHtml).toContain('src="public/loyalty.js"');
        });

        test('should link to loyalty-styles.css', () => {
            expect(indexHtml).toContain('href="public/loyalty-styles.css"');
        });
    });

    describe('Tier Benefits', () => {
        test('should have different earn rates per tier', () => {
            expect(loyaltyJs).toContain('earnRate = 8');
            expect(loyaltyJs).toContain('earnRate = 6');
            expect(loyaltyJs).toContain('earnRate = 5');
        });

        test('should have tier-specific benefits', () => {
            expect(loyaltyJs).toContain('benefits');
        });

        test('should use Vietnamese language', () => {
            expect(loyaltyJs).toContain('Thành viên');
            expect(loyaltyJs).toContain('Điểm');
        });
    });
});
