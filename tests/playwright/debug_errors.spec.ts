import { test, expect } from '@playwright/test';

test('debug console errors on all pages', async ({ page }) => {
  const pages = [
    { name: 'home', url: '/' },
    { name: 'menu', url: '/menu.html' },
    { name: 'checkout', url: '/checkout.html' },
    { name: 'loyalty', url: '/loyalty.html' },
    { name: 'reservation', url: '/table-reservation.html' },
    { name: 'contact', url: '/contact.html' },
    { name: 'about', url: '/about-us.html' },
  ];

  for (const p of pages) {
    console.log(`\n=== ${p.name} (${p.url}) ===`);
    const errors = [];
    const failedRequests = [];
    
    page.on('pageerror', err => errors.push(`PAGEERROR: ${err.message}`));
    page.on('console', msg => {
      if (msg.type() === 'error') errors.push(`CONSOLE: ${msg.text()}`);
    });
    page.on('requestfailed', req => {
      failedRequests.push(`${req.url()} — ${req.failure()?.errorText || 'unknown'}`);
    });

    await page.goto(p.url);
    await page.waitForLoadState('networkidle', { timeout: 15000 });
    await page.reload();
    await page.waitForLoadState('networkidle', { timeout: 15000 });

    if (errors.length) {
      console.log('Console/Page Errors:');
      errors.forEach(e => console.log(`  ${e}`));
    }
    if (failedRequests.length) {
      console.log('Failed Requests:');
      failedRequests.forEach(r => console.log(`  ${r}`));
    }
    if (!errors.length && !failedRequests.length) {
      console.log('  No errors!');
    }
    
    page.removeAllListeners('pageerror');
    page.removeAllListeners('console');
    page.removeAllListeners('requestfailed');
  }
});
