/**
 * Customer Loyalty Rewards System Tests - F&B Caffe Container
 */

const fs = require('fs');
const path = require('path');

const rootDir = path.join(__dirname, '..');

describe('Loyalty Rewards System', () => {
    let loyaltyJs;
    let loyaltyCss;
    let indexHtml;

    beforeAll(() => {
        loyaltyJs = fs.readFileSync(path.join(rootDir, 'public/loyalty.js'), 'utf8');
        loyaltyCss = fs.readFileSync(path.join(rootDir, 'public/loyalty-styles.css'), 'utf8');
        indexHtml = fs.readFileSync(path.join(rootDir, 'index.html'), 'utf8');
    });

    describe('Loyalty JavaScript', () => {
        test('should have CUSTOMER_TIERS defined', () => {
            expect(loyaltyJs).toContain('CUSTOMER_TIERS');
            expect(loyaltyJs).toContain('DONG');
            expect(loyaltyJs).toContain('BAC');
            expect(loyaltyJs).toContain('VANG');
            expect(loyaltyJs).toContain('KIM_CUONG');
        });

        test('should have POINTS_RULES defined', () => {
            expect(loyaltyJs).toContain('POINTS_RULES');
            expect(loyaltyJs).toContain('BASE_EARN_RATE');
            expect(loyaltyJs).toContain('REDEMPTION_RATE');
        });

        test('should have LoyaltyManager class', () => {
            expect(loyaltyJs).toContain('class LoyaltyManager');
        });

        test('should have tier methods', () => {
            expect(loyaltyJs).toContain('getTier()');
            expect(loyaltyJs).toContain('getNextTierProgress()');
        });

        test('should have earn points functionality', () => {
            expect(loyaltyJs).toContain('earnPoints');
            expect(loyaltyJs).toContain('pointsEarned');
        });

        test('should have redeem points functionality', () => {
            expect(loyaltyJs).toContain('redeemPoints');
            expect(loyaltyJs).toContain('discountValue');
        });

        test('should have birthday bonus', () => {
            expect(loyaltyJs).toContain('giveBirthdayBonus');
            expect(loyaltyJs).toContain('BIRTHDAY_BONUS');
        });

        test('should have transaction history', () => {
            expect(loyaltyJs).toContain('transactionHistory');
            expect(loyaltyJs).toContain('getHistory');
        });

        test('should use localStorage for persistence', () => {
            expect(loyaltyJs).toContain('localStorage');
            expect(loyaltyJs).toContain('fnb_customer_id');
            expect(loyaltyJs).toContain('fnb_loyalty_customer');
        });

        test('should export to window', () => {
            expect(loyaltyJs).toContain('window.LoyaltyManager');
            expect(loyaltyJs).toContain('window.CUSTOMER_TIERS');
            expect(loyaltyJs).toContain('window.renderTierBadge');
        });
    });

    describe('Loyalty CSS', () => {
        test('should have tier badge styles', () => {
            expect(loyaltyCss).toContain('.tier-badge');
        });

        test('should have points balance styles', () => {
            expect(loyaltyCss).toContain('.points-balance');
        });

        test('should have tier progress styles', () => {
            expect(loyaltyCss).toContain('.tier-progress');
        });

        test('should have transaction item styles', () => {
            expect(loyaltyCss).toContain('.transaction-item');
        });

        test('should have responsive styles', () => {
            expect(loyaltyCss).toMatch(/@media.*max-width/s);
        });
    });

    describe('Loyalty HTML Integration', () => {
        test('should have loyalty section in index.html', () => {
            expect(indexHtml).toContain('class="loyalty-section"');
            expect(indexHtml).toContain('id="loyalty"');
        });

        test('should have loyalty widget', () => {
            expect(indexHtml).toContain('class="loyalty-widget"');
        });

        test('should have tier badge container', () => {
            expect(indexHtml).toContain('id="loyaltyTierBadge"');
        });

        test('should have points balance container', () => {
            expect(indexHtml).toContain('id="loyaltyPointsBalance"');
        });

        test('should have tier progress container', () => {
            expect(indexHtml).toContain('id="loyaltyTierProgress"');
        });

        test('should have benefits container', () => {
            expect(indexHtml).toContain('id="loyaltyBenefits"');
        });

        test('should link to loyalty.js', () => {
            expect(indexHtml).toContain('src="public/loyalty.js"');
        });

        test('should link to loyalty-styles.css', () => {
            expect(indexHtml).toContain('href="public/loyalty-styles.css"');
        });

        test('should initialize LoyaltyManager', () => {
            expect(indexHtml).toContain('new LoyaltyManager()');
            expect(indexHtml).toContain('initLoyaltyWidget');
        });
    });

    describe('Loyalty Tier Configuration', () => {
        test('should have Dong tier (0-4999 points)', () => {
            expect(loyaltyJs).toContain("id: 'dong'");
            expect(loyaltyJs).toContain('minPoints: 0');
        });

        test('should have Bac tier (5000-14999 points)', () => {
            expect(loyaltyJs).toContain("id: 'bac'");
            expect(loyaltyJs).toContain('minPoints: 5000');
        });

        test('should have Vang tier (15000-49999 points)', () => {
            expect(loyaltyJs).toContain("id: 'vang'");
            expect(loyaltyJs).toContain('minPoints: 15000');
        });

        test('should have Kim Cuong tier (50000+ points)', () => {
            expect(loyaltyJs).toContain("id: 'kim-cuong'");
            expect(loyaltyJs).toContain('minPoints: 50000');
        });
    });

    describe('Loyalty Performance', () => {
        test('JS file should be under 20KB', () => {
            const sizeKb = Buffer.byteLength(loyaltyJs, 'utf8') / 1024;
            expect(sizeKb).toBeLessThan(20);
        });

        test('CSS file should be under 10KB', () => {
            const sizeKb = Buffer.byteLength(loyaltyCss, 'utf8') / 1024;
            expect(sizeKb).toBeLessThan(10);
        });
    });
});

describe('Loyalty Integration', () => {
    let indexHtml;
    let loyaltyJs;

    beforeAll(() => {
        indexHtml = fs.readFileSync(path.join(__dirname, '../index.html'), 'utf8');
        loyaltyJs = fs.readFileSync(path.join(__dirname, '../public/loyalty.js'), 'utf8');
    });

    test('should have tier upgrade event listener', () => {
        expect(indexHtml).toContain('loyalty-tier-upgrade');
    });

    test('should have earn rate based on tier', () => {
        expect(loyaltyJs).toContain('earnRate');
        expect(loyaltyJs).toMatch(/case 'bac':.*earnRate = 8/s);
    });

    test('should validate points redemption', () => {
        expect(loyaltyJs).toContain('pointsAmount > this.customer.points');
        expect(loyaltyJs).toContain('pointsAmount < 100');
    });
});
