/**
 * Customer Loyalty Rewards System Tests - AURA CAFE
 * Updated for phone-auth + cashback + API-first flow
 */

const fs = require('fs');
const path = require('path');

const rootDir = path.join(__dirname, '..');

describe('Loyalty Rewards System', () => {
    let loyaltyJs;
    let loyaltyHtml;
    let workerLoyalty;

    beforeAll(() => {
        loyaltyJs = fs.readFileSync(path.join(rootDir, 'js/loyalty.js'), 'utf8');
        loyaltyHtml = fs.readFileSync(path.join(rootDir, 'loyalty.html'), 'utf8');
        try {
            workerLoyalty = fs.readFileSync(path.join(rootDir, 'worker/src/routes/loyalty.js'), 'utf8');
        } catch (e) {
            workerLoyalty = '';
        }
    });

    describe('Loyalty JavaScript — Core', () => {
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

    describe('Loyalty JavaScript — Phone Auth + API', () => {
        test('should have phoneAuth function', () => {
            expect(loyaltyJs).toContain('function phoneAuth');
        });

        test('should have fetchSummary function', () => {
            expect(loyaltyJs).toContain('function fetchSummary');
        });

        test('should have fetchPoints function', () => {
            expect(loyaltyJs).toContain('function fetchPoints');
        });

        test('should have fetchCashback function', () => {
            expect(loyaltyJs).toContain('function fetchCashback');
        });

        test('should have initLoyalty function', () => {
            expect(loyaltyJs).toContain('function initLoyalty');
        });

        test('should have handlePhoneLookup function', () => {
            expect(loyaltyJs).toContain('function handlePhoneLookup');
        });

        test('should have loadServerData function', () => {
            expect(loyaltyJs).toContain('function loadServerData');
        });

        test('should have renderLoyaltyCardFromData function', () => {
            expect(loyaltyJs).toContain('function renderLoyaltyCardFromData');
        });

        test('should have redeemCashback that calls /spend-cashback', () => {
            expect(loyaltyJs).toContain('/spend-cashback');
        });

        test('should have tier mapping function (silver/gold/platinum)', () => {
            expect(loyaltyJs).toContain('function tierToObj');
            expect(loyaltyJs).toContain("'silver'");
            expect(loyaltyJs).toContain("'gold'");
            expect(loyaltyJs).toContain("'platinum'");
        });

        test('should use JWT token in localStorage', () => {
            expect(loyaltyJs).toContain('fnb_loyalty_token');
        });

        test('should reference API_BASE for Worker endpoint', () => {
            expect(loyaltyJs).toContain('aura-space-worker');
        });

        test('should have phone input validation (9-15 digits)', () => {
            expect(loyaltyJs).toContain('/^[0-9]{9,15}$/');
        });
    });

    describe('Loyalty HTML — DOM Elements', () => {
        test('should have #loyaltyCard container', () => {
            expect(loyaltyHtml).toContain('id="loyaltyCard"');
        });

        test('should have #cbAmount element', () => {
            expect(loyaltyHtml).toContain('id="cbAmount"');
        });

        test('should have #cbHistory element', () => {
            expect(loyaltyHtml).toContain('id="cbHistory"');
        });

        test('should have #phoneLookup form', () => {
            expect(loyaltyHtml).toContain('id="phoneLookup"');
        });

        test('should have #loyaltyPhoneInput input', () => {
            expect(loyaltyHtml).toContain('id="loyaltyPhoneInput"');
        });

        test('should have #phoneLookupBtn button', () => {
            expect(loyaltyHtml).toContain('id="phoneLookupBtn"');
        });

        test('should have #redeemCashbackBtn button', () => {
            expect(loyaltyHtml).toContain('id="redeemCashbackBtn"');
        });

        test('should have #pointsHistory container', () => {
            expect(loyaltyHtml).toContain('id="pointsHistory"');
        });

        test('should load brand-tokens.css', () => {
            expect(loyaltyHtml).toContain('brand-tokens.css');
        });

        test('should load loyalty.js as module', () => {
            expect(loyaltyHtml).toContain('js/loyalty.js');
        });
    });

    describe('Loyalty Worker — API Endpoints', () => {
        test('should have POST /phone-auth endpoint', () => {
            expect(workerLoyalty).toContain("post('/phone-auth'");
        });

        test('should have rate limiting on phone-auth', () => {
            expect(workerLoyalty).toContain('throttle');
        });

        test('should have generateJWT import', () => {
            expect(workerLoyalty).toContain('generateJWT');
        });

        test('should have authCustomer middleware bypass for public routes', () => {
            expect(workerLoyalty).toContain("'/phone-auth'");
            expect(workerLoyalty).toContain("'/tiers'");
        });

        test('should validate phone number format', () => {
            expect(workerLoyalty).toContain('/^[0-9]{9,15}$/');
        });

        test('should create customer on phone-auth if not found', () => {
            expect(workerLoyalty).toContain('INSERT INTO customers');
        });

        test('should create cashback wallet for new customer', () => {
            expect(workerLoyalty).toContain('INSERT INTO cashback_wallets');
        });

        test('should have GET /summary endpoint', () => {
            expect(workerLoyalty).toContain("get('/summary'");
        });

        test('should have GET /points endpoint', () => {
            expect(workerLoyalty).toContain("get('/points'");
        });

        test('should have GET /cashback endpoint', () => {
            expect(workerLoyalty).toContain("get('/cashback'");
        });

        test('should have POST /spend-cashback endpoint', () => {
            expect(workerLoyalty).toContain("post('/spend-cashback'");
        });

        test('should have GET /tiers endpoint', () => {
            expect(workerLoyalty).toContain("get('/tiers'");
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
        test('JS file should be under 35KB (includes API fetch logic)', () => {
            const sizeKb = Buffer.byteLength(loyaltyJs, 'utf8') / 1024;
            expect(sizeKb).toBeLessThan(35);
        });
    });
});

describe('Loyalty Integration', () => {
    let loyaltyJs;

    beforeAll(() => {
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

describe('Loyalty CSS — Brand Tokens', () => {
    let loyaltyHtml;

    beforeAll(() => {
        loyaltyHtml = fs.readFileSync(path.join(__dirname, '../loyalty.html'), 'utf8');
    });

    test('should NOT have hardcoded #1A1F35 (old bg-surface)', () => {
        // After fix, :root should use var(--aura-noir-steel) not hardcoded hex
        const rootBlock = loyaltyHtml.match(/:root\s*\{[^}]+\}/s);
        if (rootBlock) {
            expect(rootBlock[0]).not.toContain('#1A1F35');
        }
    });

    test('should NOT have hardcoded #666666 (old text-muted)', () => {
        const rootBlock = loyaltyHtml.match(/:root\s*\{[^}]+\}/s);
        if (rootBlock) {
            expect(rootBlock[0]).not.toContain('#666666');
        }
    });

    test('should use var(--aura-*) tokens in :root overrides', () => {
        const rootBlock = loyaltyHtml.match(/:root\s*\{[^}]+\}/s);
        if (rootBlock) {
            expect(rootBlock[0]).toContain('var(--aura-');
        }
    });
});