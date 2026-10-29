import { createRequire } from 'node:module';
import path from 'node:path';
import { createServer } from 'vite';
import { ROOT, REVIEW_PASSWORD, verificationDir } from './local-runtime.mjs';
import { http, sign } from './local-flow-api.mjs';

const require = createRequire(import.meta.url);
const { chromium } = require('playwright');
const itemName = 'Cà phê kiểm thử local';

export async function runBrowserFlow(runtime, context, check) {
  const blocked = [];
  const apiResponses = [];
  const errors = [];
  const server = await createServer({
    root: ROOT, configFile: path.join(ROOT, 'vite.config.js'), envDir: runtime.scratch,
    mode: 'local-review', logLevel: 'error',
    define: { 'import.meta.env.VITE_API_BASE': JSON.stringify(runtime.url) },
    server: { host: '127.0.0.1', port: 5197, strictPort: true,
      proxy: { '/api': { target: runtime.url, changeOrigin: true, secure: false } } },
  });
  let browser;
  try {
    await server.listen();
    browser = await chromium.launch({ channel: 'chrome', headless: true });
    const newContext = async (storage = {}) => {
      const session = await browser.newContext({ viewport: { width: 1440, height: 1000 }, serviceWorkers: 'block' });
      await session.route('**/*', route => {
        const url = new URL(route.request().url());
        // Fulfill only known local provider invoices; this never contacts payOS.
        if (url.hostname === 'pay.payos.vn' && /^\/web\/local-\d+$/.test(url.pathname)) {
          const code = url.pathname.slice('/web/local-'.length);
          const invoice = runtime.providerRequests.find(item => item.kind === 'create' && String(item.orderCode) === code);
          if (invoice) return route.fulfill({ status: 200, contentType: 'text/html', body:
            `<meta charset="utf-8"><h1>Local PayOS provider fixture</h1><a href="${invoice.returnUrl}">Quay lại cửa hàng (local)</a>` });
        }
        if (['127.0.0.1', 'localhost'].includes(url.hostname) || ['data:', 'blob:'].includes(url.protocol)) return route.continue();
        blocked.push({ host: url.hostname, path: url.pathname });
        return route.abort('blockedbyclient');
      });
      await session.addInitScript(values => {
        localStorage.setItem('i18nextLng', 'vi');
        Object.entries(values).forEach(([key, value]) => localStorage.setItem(key, value));
      }, storage);
      const page = await session.newPage();
      page.on('pageerror', error => errors.push(error.message));
      page.on('response', response => {
        const url = new URL(response.url());
        if (url.pathname.startsWith('/api/')) apiResponses.push({ method: response.request().method(), path: url.pathname, status: response.status() });
      });
      return { session, page };
    };

    for (const method of ['cod', 'payos']) {
      const label = `Browser ${method} checkout`;
      const { session, page } = await newContext({ aura_cart_v3: JSON.stringify([
        { id: 'review-coffee', productId: 'review-coffee', name: itemName, price: 20000, quantity: 1 },
      ]) });
      try {
        await page.goto('http://127.0.0.1:5197/checkout');
        await page.getByPlaceholder('Ví dụ: Nguyễn Văn A').fill(label);
        await page.getByPlaceholder('0901 234 567').fill('0900000010');
        await page.getByRole('button', { name: /Mang đi/ }).click();
        const methods = await page.locator('input[name="payment"]').evaluateAll(inputs => inputs.map(input => input.value));
        check(`browser-methods:${method}`, JSON.stringify(methods.sort()) === JSON.stringify(['cod', 'payos']), ['cod', 'payos'], methods);
        await page.locator('label').filter({ has: page.locator(`input[name="payment"][value="${method}"]`) }).click();
        const submitted = page.waitForResponse(response => new URL(response.url()).pathname === '/api/orders' && response.request().method() === 'POST', { timeout: 20000 });
        await page.locator('button[type="submit"]').click();
        const response = await submitted;
        const payload = await response.json();
        const idempotencyKey = response.request().headers()['idempotency-key'];
        check(`browser-idempotency:${method}`, Boolean(idempotencyKey), 'checkout sends a stable idempotency key', { present: Boolean(idempotencyKey) });
        let navigation;
        try {
          await page.waitForURL(method === 'cod' ? /\/order-success\?/ : /^https:\/\/pay\.payos\.vn\/web\/local-\d+$/, { timeout: 12000 });
          navigation = true;
        } catch { navigation = false; }
        const row = await runtime.db.prepare('SELECT id,payment_method FROM orders WHERE customer_name = ?').bind(label).first();
        check(`browser-submit:${method}`, response.status() === 201 && navigation,
          method === 'cod' ? 'order201 -> confirmation' : 'order201 -> local PayOS fixture redirect',
          { status: response.status(), url: new URL(page.url()).pathname, error: payload.error, persisted: Boolean(row) });
        await page.screenshot({ path: path.join(verificationDir(), `browser-checkout-${method}.png`), fullPage: true });
        const orderId = payload.data?.id || row?.id;
        if (orderId) {
          if (method === 'payos') {
            const payment = await runtime.db.prepare('SELECT transaction_id,amount FROM payments WHERE order_id = ?').bind(orderId).first();
            if (payment) {
              const data = { orderCode: Number(payment.transaction_id), amount: payment.amount, description: 'browser-local-review', code: '00' };
              const callback = await http(runtime, '/api/webhook/payos', { method: 'POST', body: {
                code: '00', desc: 'success', success: true, data, signature: sign(data),
              } });
              const paid = await runtime.db.prepare('SELECT payment_status FROM orders WHERE id = ?').bind(orderId).first();
              check('browser-payos-callback', callback.status === 200 && paid.payment_status === 'paid', 'browser order confirmed paid by signed callback', { status: callback.status, order: paid });
            }
          }
          if (method === 'payos' && page.url().startsWith('https://pay.payos.vn/web/local-')) {
            await page.getByRole('link', { name: 'Quay lại cửa hàng (local)' }).click();
            await page.waitForURL(/\/order-success\?/);
          } else await page.goto(`http://127.0.0.1:5197/order-success?order_id=${encodeURIComponent(orderId)}`);
          let visible = false;
          try { await page.getByText(itemName, { exact: true }).first().waitFor({ state: 'visible', timeout: 12000 }); visible = true; } catch {}
          check(`browser-confirmation:${method}`, visible, 'actual item displayed from API', { visible, orderId });
          await page.screenshot({ path: path.join(verificationDir(), `browser-confirmation-${method}.png`), fullPage: true });
        }
      } catch (error) { check(`browser-checkout:${method}`, false, 'flow executes', { error: String(error) }); }
      finally { await session.close(); }
    }

    // Verify F01, F02, F03, F04, F05, F06 & OrderSuccess NaN guard end-to-end
    const { session: fSession, page: fPage } = await newContext({
      aura_checkout_form: JSON.stringify({ orderType: 'dine_in', tableNumber: '5', fullName: 'QA F01-F06', phone: '0901234567' }),
    });
    try {
      await fPage.setViewportSize({ width: 1280, height: 720 });
      await fPage.goto('http://127.0.0.1:5197/menu?table=8');
      await fPage.getByText('Matcha latte đá').first().waitFor({ state: 'visible', timeout: 15000 });

      // F05a: Matcha latte đá (Iced-only) must NOT offer Uống nóng
      await fPage.locator('article[aria-label="Matcha latte đá"] button').last().click();
      await fPage.getByRole('dialog').waitFor({ state: 'visible', timeout: 5000 });
      const matchaHasHot = await fPage.getByRole('dialog').getByText('Uống nóng').count();
      await fPage.getByRole('button', { name: 'Đóng bảng tùy chọn' }).click();

      // F05b: Lipton chanh/ tắc đá/nóng (Iced/Hot) MUST offer Uống nóng
      await fPage.locator('article[aria-label="Lipton chanh/ tắc đá/nóng"] button').last().click();
      await fPage.getByRole('dialog').waitFor({ state: 'visible', timeout: 5000 });
      const liptonHasHot = await fPage.getByRole('dialog').getByText('Uống nóng').count();
      await fPage.getByRole('button', { name: 'Đóng bảng tùy chọn' }).click();
      check('browser-f05-serving-temperature', matchaHasHot === 0 && liptonHasHot === 1,
        'Matcha latte đá omits Uống nóng; Lipton đá/nóng includes Uống nóng',
        { matchaHasHot, liptonHasHot });

      // F06: Sting/ Coca/ Pepsi/ 7 UP/ Ô long opens drink selector without sugar/ice
      await fPage.locator('article[aria-label="Sting/ Coca/ Pepsi/ 7 UP/ Ô long"] button').last().click();
      await fPage.getByRole('dialog').waitFor({ state: 'visible', timeout: 5000 });
      const btChoiceHeading = await fPage.getByRole('dialog').getByText(/Chọn loại nước/).count();
      const btSugarHeading = await fPage.getByRole('dialog').getByText(/Độ ngọt/).count();
      await fPage.getByRole('dialog').getByText('Coca', { exact: true }).click();
      await fPage.getByRole('dialog').getByRole('button', { name: /Thêm vào giỏ/ }).click();
      check('browser-f06-bundled-drink-choice', btChoiceHeading === 1 && btSugarHeading === 0,
        'bt002 prompts for drink choice without sugar/ice and adds chosen variant',
        { btChoiceHeading, btSugarHeading });

      // Add customized craft drink with note for F03 + F04
      await fPage.locator('article[aria-label="Cà phê kiểm thử local"] button').last().click();
      await fPage.getByRole('dialog').waitFor({ state: 'visible', timeout: 5000 });
      await fPage.getByRole('dialog').getByText('70% ít ngọt').click();
      await fPage.getByRole('dialog').getByText('Ít đá').click();
      await fPage.getByRole('dialog').getByRole('textbox').fill('QA local: giu nguyen ghi chu');
      await fPage.getByRole('dialog').getByRole('button', { name: /Thêm vào giỏ/ }).click();

      // F02 desktop & mobile hit-test + click on CartFAB while CartBottomBar is visible
      const fabBtn = fPage.locator('div.fixed.right-8 button').first();
      await fabBtn.waitFor({ state: 'visible', timeout: 5000 });
      const desktopHit = await fabBtn.evaluate(btn => {
        const r = btn.getBoundingClientRect();
        const el = document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2);
        return Boolean(el && (el === btn || btn.contains(el)));
      });
      await fPage.setViewportSize({ width: 390, height: 844 });
      const mobileNoOverlap = await fPage.evaluate(() => {
        const fab = document.querySelector('div.fixed.right-8 button')?.getBoundingClientRect();
        const bar = document.querySelector('button[aria-label^="Thanh toán "]')?.getBoundingClientRect();
        if (!fab || !bar) return false;
        return fab.bottom <= bar.top || fab.top >= bar.bottom;
      });
      await fPage.setViewportSize({ width: 1280, height: 720 });
      await fabBtn.click();
      const drawerDialog = fPage.locator('[role="dialog"][aria-hidden="false"]').first();
      await drawerDialog.waitFor({ state: 'visible', timeout: 5000 });
      check('browser-f02-cart-fab-clickable', desktopHit && mobileNoOverlap,
        'CartFAB receives desktop click and does not overlap CartBottomBar on mobile',
        { desktopHit, mobileNoOverlap });

      // F04: CartDrawer shows modifiers and item notes
      const drawerText = await drawerDialog.innerText();
      const f04CartVisible = drawerText.includes('70% ít ngọt · Ít đá')
        && drawerText.includes('Ghi chú: QA local: giu nguyen ghi chu')
        && drawerText.includes('Coca');
      check('browser-f04-cart-modifiers-and-notes', f04CartVisible,
        'CartDrawer displays modifiers, bundled drink choice, and item notes',
        { f04CartVisible });
      await drawerDialog.getByRole('button', { name: 'Đóng' }).click();

      // F01: Click floating CartBottomBar on /menu?table=8 overrides prior Table 5
      await fPage.locator('button[aria-label^="Thanh toán "]').click();
      await fPage.waitForURL(/\/checkout\?table=8/, { timeout: 10000 });
      const tableInputVal = await fPage.getByPlaceholder('Ví dụ: Bàn 5').inputValue();
      const summaryText = await fPage.innerText('body');
      const f04CheckoutVisible = summaryText.includes('Ghi chú: QA local: giu nguyen ghi chu');
      check('browser-f01-table-context-preserved', tableInputVal === '8' && f04CheckoutVisible,
        'CartBottomBar preserves ?table=8 and overrides stale table 5 in checkout',
        { url: fPage.url(), tableInputVal, f04CheckoutVisible });

      // Submit order and check OrderSuccess NaN guard + F03 KDS item & order notes
      await fPage.getByPlaceholder('Ví dụ: Nguyễn Văn A').fill('QA F03 KDS Note');
      await fPage.getByPlaceholder('0901 234 567').fill('0901234567');
      await fPage.getByPlaceholder(/Ví dụ: ít đá, ít đường/).fill('QA don: mang ra cung luc');
      await fPage.locator('label').filter({ has: fPage.locator('input[name="payment"][value="cod"]') }).click();
      const orderRespPromise = fPage.waitForResponse(r => new URL(r.url()).pathname === '/api/orders' && r.request().method() === 'POST', { timeout: 15000 });
      await fPage.locator('button[type="submit"]').click();
      const orderResp = await orderRespPromise;
      await fPage.waitForURL(/\/order-success\?/, { timeout: 12000 });
      const successBodyText = await fPage.innerText('body');
      check('browser-order-success-no-nan', orderResp.status() === 201 && !successBodyText.includes('NaN'),
        'order-success renders server total immediately without NaN',
        { status: orderResp.status(), hasNaN: successBodyText.includes('NaN') });
    } catch (error) {
      check('browser-f01-f06-suite', false, 'all F01-F06 browser checks pass', { error: String(error) });
    } finally {
      await fSession.close();
    }

    const { session, page } = await newContext({
      aura_auth_token: context.tokens['staff-default'],
      aura_auth_user: JSON.stringify({ id: 'staff-default', name: 'Local Staff', email: 'staff-default@local-review.test', role: 'staff' }),
    });
    try {
      await page.goto('http://127.0.0.1:5197/kds');
      let loaded = false;
      try { await page.getByText(/Cà phê kiểm thử/).first().waitFor({ state: 'visible', timeout: 30000 }); loaded = true; } catch {}
      check('browser-staff-kds', loaded, 'authenticated KDS displays local item', { loaded });
      const kdsBodyText = await page.innerText('body');
      const f03NoteOnKds = kdsBodyText.includes('Ghi chú: QA local: giu nguyen ghi chu')
        && kdsBodyText.includes('Ghi chú đơn: QA don: mang ra cung luc')
        && kdsBodyText.includes('TABLE 8');
      check('browser-f03-kds-notes-visible', f03NoteOnKds,
        'KDS ticket displays item notes, order notes, and TABLE 8 context',
        { f03NoteOnKds });
      if (loaded) {
        const start = page.getByRole('button', { name: /Bắt đầu|START PREP/i }).first();
        if (await start.count()) {
          const changed = page.waitForResponse(response => /\/api\/(?:admin\/)?orders\/[^/]+\/status$/.test(new URL(response.url()).pathname) && response.request().method() === 'PATCH', { timeout: 10000 });
          await start.click();
          const response = await changed;
          check('browser-kds-action', response.status() === 200, 'KDS start action succeeds', { status: response.status(), path: new URL(response.url()).pathname });
        }
      }
      const ghostId = 'ORD_REVIEW_GHOST_READY';
      await runtime.db.prepare('INSERT INTO orders (id,items,total,status,customer_name,customer_phone,payment_method,tenant_id,created_at) VALUES (?,?,?,?,?,?,?,?,?)')
        .bind(ghostId, JSON.stringify([{ name: 'GHOST KDS LOCAL', quantity: 1, price: 20000 }]), 20000, 'ready', 'Ghost test', '0900000010', 'cod', 'default', new Date().toISOString()).run();
      await runtime.kv.put('orders:latest_updated_at', new Date().toISOString());
      await page.getByText('GHOST KDS LOCAL', { exact: true }).waitFor({ state: 'visible', timeout: 15000 });
      await runtime.db.prepare("UPDATE orders SET status = 'completed' WHERE id = ?").bind(ghostId).run();
      await runtime.kv.put('orders:latest_updated_at', new Date().toISOString());
      for (let attempt = 0; attempt < 2; attempt++) await page.waitForResponse(async response => {
        if (new URL(response.url()).pathname !== '/api/kds/orders' || response.status() !== 200) return false;
        const result = await response.json();
        return !(result.data || []).some(order => order.id === ghostId);
      }, { timeout: 15000 });
      const ghostVisible = await page.getByText('GHOST KDS LOCAL', { exact: true }).isVisible();
      check('browser-removes-completed-ticket', !ghostVisible, 'ticket removed after two authoritative refreshes', { ghostVisible });
      await page.screenshot({ path: path.join(verificationDir(), 'browser-kds.png'), fullPage: true });
      await runtime.db.prepare('INSERT INTO orders (id,items,total,status,customer_name,customer_phone,payment_method,tenant_id,created_at) VALUES (?,?,?,?,?,?,?,?,?)')
        .bind('ORD_REVIEW_PRIVATE_DEFAULT', JSON.stringify([{ name: 'PRIVATE DEFAULT TICKET', quantity: 1, price: 20000 }]), 20000, 'ready', 'Private tenant fixture', '0900000010', 'cod', 'default', new Date().toISOString()).run();
      await page.getByText('PRIVATE DEFAULT TICKET', { exact: true }).waitFor({ state: 'visible', timeout: 15000 });
      // Register before switching: the first fetch can finish before evaluate returns.
      const tenantResponse = page.waitForResponse(async response => {
        if (new URL(response.url()).pathname !== '/api/kds/orders' || response.status() !== 200) return false;
        const result = await response.json();
        return (result.data || []).some(order => order.id === 'ORD_REVIEW_TENANT_A') && !(result.data || []).some(order => order.id === 'ORD_REVIEW_PRIVATE_DEFAULT');
      }, { timeout: 20000 });
      const switched = await page.evaluate(async password => {
        const { useAuthStore } = await import('/src/hooks/stores/use-auth-store.ts');
        await useAuthStore.getState().logout();
        await useAuthStore.getState().login('staff-a@local-review.test', password);
        const token = localStorage.getItem('aura_auth_token');
        return token ? JSON.parse(atob(token.split('.')[1].replace(/-/g, '+').replace(/_/g, '/'))).tenantId : null;
      }, REVIEW_PASSWORD);
      await tenantResponse;
      const previousTenantVisible = await page.getByText('PRIVATE DEFAULT TICKET', { exact: true }).isVisible();
      check('browser-session-tenant-isolation', switched === 'cafe-a' && !previousTenantVisible, 'tenant A session cannot retain default-tenant ticket', { tenant: switched, previousTenantVisible });
      await page.screenshot({ path: path.join(verificationDir(), 'browser-kds-tenant-switch.png'), fullPage: true });
    } catch (error) { check('browser-kds-flow', false, 'flow executes', { error: String(error) }); }
    finally { await session.close(); }
    return { apiResponses, blockedExternalRequests: blocked, pageErrors: errors };
  } finally {
    if (browser) await browser.close();
    await server.close();
  }
}
