/**
 * Kitchen Display System (KDS) Tests - F&B Caffe Container
 */

const fs = require('fs');
const path = require('path');

const rootDir = path.join(__dirname, '..');

describe('Kitchen Display System', () => {
    let kdsHtml;
    let kdsJs;
    let stylesCss;

    beforeAll(() => {
        kdsHtml = fs.readFileSync(path.join(rootDir, 'kitchen-display.html'), 'utf8');
        kdsJs = fs.readFileSync(path.join(rootDir, 'kds-app.js'), 'utf8');
        stylesCss = fs.readFileSync(path.join(rootDir, 'styles.css'), 'utf8');
    });

    describe('HTML Structure', () => {
        test('should have valid HTML5 structure', () => {
            expect(kdsHtml).toContain('<!DOCTYPE html>');
            expect(kdsHtml).toContain('<html lang="vi"');
        });

        test('should have KDS body class', () => {
            expect(kdsHtml).toContain('class="kds-body"');
        });

        test('should have KDS header', () => {
            expect(kdsHtml).toContain('class="kds-header"');
            expect(kdsHtml).toContain('class="kds-title"');
        });

        test('should have stats section', () => {
            expect(kdsHtml).toContain('class="kds-stats"');
            expect(kdsHtml).toContain('stat-item pending');
            expect(kdsHtml).toContain('stat-item preparing');
            expect(kdsHtml).toContain('stat-item ready');
        });
    });

    describe('KDS Board', () => {
        test('should have KDS board container', () => {
            expect(kdsHtml).toContain('class="kds-board"');
        });

        test('should have order columns', () => {
            expect(kdsHtml).toContain('class="kds-column"');
            expect(kdsHtml).toContain('data-status=');
        });

        test('should have order cards', () => {
            expect(kdsHtml).toContain('class="kds-card"') || expect(kdsHtml).toContain('class="order-card"');
        });

        test('should have order timer', () => {
            expect(kdsHtml).toContain('class="order-timer"');
        });

        test('should have action buttons', () => {
            expect(kdsHtml).toContain('class="kds-btn"');
        });
    });

    describe('KDS JavaScript Functionality', () => {
        test('should have DOMContentLoaded listener', () => {
            expect(kdsJs).toContain('DOMContentLoaded');
        });

        test('should have order status constants', () => {
            expect(kdsJs).toContain('pending');
            expect(kdsJs).toContain('preparing');
            expect(kdsJs).toContain('ready');
            expect(kdsJs).toContain('completed');
        });

        test('should have render functions', () => {
            expect(kdsJs).toContain('render');
        });

        test('should have timer functionality', () => {
            expect(kdsJs).toContain('setInterval');
            expect(kdsJs).toContain('timer') || expect(kdsJs).toContain('elapsed');
        });

        test('should have updateStats function', () => {
            expect(kdsJs).toContain('updateStats') || expect(kdsJs).toContain('stats');
        });

        test('should have clock display', () => {
            expect(kdsJs).toContain('clock') || expect(kdsJs).toContain('Clock');
        });
    });

    describe('KDS CSS Styling', () => {
        test('should have KDS body styles', () => {
            expect(stylesCss).toContain('.kds-body');
        });

        test('should have KDS header styles', () => {
            expect(stylesCss).toContain('.kds-header');
        });

        test('should have KDS board styles', () => {
            expect(stylesCss).toContain('.kds-board');
        });

        test('should have KDS column styles', () => {
            expect(stylesCss).toContain('.kds-column');
        });

        test('should have order timer styles', () => {
            expect(stylesCss).toContain('.order-timer');
        });

        test('should have KDS button styles', () => {
            expect(stylesCss).toContain('.kds-btn');
        });

        test('should have status color variants', () => {
            expect(stylesCss).toContain('.pending') || expect(stylesCss).toContain('stat-item pending');
            expect(stylesCss).toContain('.preparing') || expect(stylesCss).toContain('stat-item preparing');
            expect(stylesCss).toContain('.ready') || expect(stylesCss).toContain('stat-item ready');
        });

        test('should have responsive styles', () => {
            expect(stylesCss).toMatch(/@media.*max-width.*1024px/s);
            expect(stylesCss).toMatch(/@media.*max-width.*768px/s);
        });
    });

    describe('KDS Integration', () => {
        test('should link to kds-app.js', () => {
            expect(kdsHtml).toContain('src="kds-app.js"');
        });

        test('should link to styles.css', () => {
            expect(kdsHtml).toContain('href="styles.css"');
        });

        test('should track order timing', () => {
            expect(kdsJs).toContain('Date') || expect(kdsJs).toContain('timestamp');
        });
    });
});
