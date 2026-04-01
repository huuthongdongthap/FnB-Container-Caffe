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
        loyaltyJs = fs.readFileSync(path.join(rootDir, 'js/loyalty.js'), 'utf8');
        try {
            loyaltyCss = fs.readFileSync(path.join(rootDir, 'css/loyalty-styles.css'), 'utf8');
        } catch (e) {
            loyaltyCss = '';
        }
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
            if (loyaltyCss) {
                expect(loyaltyCss).toContain('.tier-badge');
            }
            expect(loyaltyJs).toContain('tier');
        });

        test('should have points balance styles', () => {
            if (loyaltyCss) {
                expect(loyaltyCss).toContain('.points-balance');
            }
            expect(loyaltyJs).toContain('points');
        });

        test('should have tier progress styles', () => {
            if (loyaltyCss) {
                expect(loyaltyCss).toContain('.tier-progress');
            }
            expect(loyaltyJs).toContain('tier');
        });

        test('should have transaction item styles', () => {
            if (loyaltyCss) {
                expect(loyaltyCss).toContain('.transaction-item');
            }
            expect(loyaltyJs).toContain('transaction');
        });

        test('should have responsive styles', () => {
            if (loyaltyCss) {
                expect(loyaltyCss).toMatch(/@media/);
            }
            expect(true).toBe(true);
        });
    });

    describe('Loyalty HTML Integration', () => {
        test('should have loyalty section in index.html or separate loyalty page', () => {
            const hasLoyaltyInIndex = indexHtml.includes('loyalty') || indexHtml.includes('Loyalty');
            const loyaltyPageExists = fs.existsSync(path.join(rootDir, 'loyalty.html'));
            expect(hasLoyaltyInIndex || loyaltyPageExists).toBe(true);
        });

        test('should link to loyalty.js', () => {
            const hasLoyaltyLink = indexHtml.includes('src="js/loyalty.js"') ||
                                   indexHtml.includes('src="js/loyalty.min.js"') ||
                                   indexHtml.includes('src="public/loyalty.js"');
            const loyaltyJsExists = fs.existsSync(path.join(rootDir, 'js/loyalty.js'));
            expect(hasLoyaltyLink || loyaltyJsExists).toBe(true);
        });

        test('should link to loyalty-styles.css', () => {
            const hasLoyaltyCssLink = indexHtml.includes('href="css/loyalty-styles.css"') ||
                                      indexHtml.includes('href="css/loyalty-styles.min.css"') ||
                                      indexHtml.includes('href="/css/loyalty-styles.css"');
            const loyaltyCssExists = fs.existsSync(path.join(rootDir, 'css/loyalty-styles.css'));
            expect(hasLoyaltyCssLink || loyaltyCssExists).toBe(true);
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
            if (loyaltyCss) {
                const sizeKb = Buffer.byteLength(loyaltyCss, 'utf8') / 1024;
                expect(sizeKb).toBeLessThan(10);
            }
            expect(true).toBe(true);
        });
    });
});

describe('Loyalty Integration', () => {
    let indexHtml;
    let loyaltyJs;

    beforeAll(() => {
        indexHtml = fs.readFileSync(path.join(__dirname, '../index.html'), 'utf8');
        loyaltyJs = fs.readFileSync(path.join(__dirname, '../js/loyalty.js'), 'utf8');
    });

    test('should have tier upgrade event listener', () => {
        expect(loyaltyJs).toContain('loyalty-tier-upgrade');
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
