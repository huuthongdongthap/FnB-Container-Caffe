import { chromium } from 'playwright';
import fs from 'node:fs/promises';

const catalog = JSON.parse(await fs.readFile('public/data/menu-data.json', 'utf8'));
const menu = {
  categories: catalog.categories.map((category) => ({
    name: category.name,
    items: catalog.items.filter((item) => item.category === category.id).map((item) => ({
      id: item.id,
      name: item.name,
      description: item.description,
      priceCents: item.price,
      category: item.category,
      imageUrl: null,
      tags: item.tags,
      available: true,
    })),
  })),
  totalItems: catalog.items.length,
};
const browser = await chromium.launch({headless:true, channel:'chrome'});
const context = await browser.newContext({serviceWorkers:'block'});
await context.route('**/api/menu?*', (route) => route.fulfill({
  contentType:'application/json',
  body:JSON.stringify({success:true, data:menu}),
}));
const page = await context.newPage();
const checks = [];
for (const [name, width, height] of [['desktop', 1440, 1100], ['mobile', 390, 844]]) {
  await page.setViewportSize({width, height});
  await page.goto('http://127.0.0.1:5187/menu');
  await page.waitForFunction(() => document.querySelectorAll('article img[src^="/menu/aura-drinks/"]').length === 49);
  await page.locator('article img').evaluateAll((images) => images.forEach((image) => image.loading = 'eager'));
  await page.waitForFunction(() => [...document.querySelectorAll('article img')].every((image) => image.complete && image.naturalWidth > 0));
  const result = await page.evaluate(() => ({
    count: document.querySelectorAll('article img[src^="/menu/aura-drinks/"]').length,
    distinct: new Set([...document.querySelectorAll('article img')].map((image) => image.getAttribute('src'))).size,
    overflow: document.documentElement.scrollWidth > innerWidth,
  }));
  if (result.count !== 49 || result.distinct !== 49 || result.overflow) throw new Error(JSON.stringify(result));
  await page.screenshot({path:`plans/261023-1703-full-menu-imagery/menu-${name}.png`, fullPage:false});
  checks.push({name, fixture:'canonical 49-item catalog with empty API image URLs', ...result});
}
await fs.writeFile('plans/261023-1703-full-menu-imagery/menu-browser-checks.json', JSON.stringify(checks, null, 2));
console.log(JSON.stringify(checks));
await browser.close();
