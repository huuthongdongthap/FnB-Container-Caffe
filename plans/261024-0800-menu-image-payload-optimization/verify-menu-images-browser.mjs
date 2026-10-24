/**
 * Visual gate for the menu image pipeline.
 *
 * Three checks per breakpoint, run in a real browser because none of them are
 * observable from the DOM alone: whether the browser picked a variant large
 * enough for the slot (wrong `sizes` shows up as a soft, upscaled card), whether
 * the layout shifts as images stream in, and whether the four brand packshots
 * still occupy their original aspect ratio instead of being cropped by
 * object-cover.
 *
 * Mirrors verify-menu-browser.mjs: it stubs the menu API with the canonical
 * 49-item fixture so the run does not depend on the backend.
 */
import { chromium } from 'playwright';
import fs from 'node:fs/promises';

// Serve the built dist, not the dev server: the dev entry injects
// /@vite/client and /@react-refresh and never resolves the lazy route chunks
// the same way, so a run against it hangs on the loading skeleton forever.
const URL = 'http://127.0.0.1:5199/menu';
const BREAKPOINTS = [
  { name: 'mobile', width: 390, height: 844 },
  { name: 'tablet', width: 768, height: 1024 },
  { name: 'desktop', width: 1440, height: 1100 },
];

const PACKSHOTS = ['dasani.webp', 'coca-cola.webp', 'pepsi.webp', 'red-bull.webp'];

/**
 * Walk the whole page once so every lazy image is pulled into view, then return
 * to the top. Cards hold their size from CSS, so this is only needed to make the
 * network requests happen — any card that moves during the walk is a layout shift.
 */
async function scrollThrough(page) {
  await page.evaluate(async () => {
    const step = Math.floor((document.body.scrollHeight - innerHeight) / 10);
    for (let i = 0; i <= 10; i += 1) {
      window.scrollTo(0, i * step);
      await new Promise((resolve) => requestAnimationFrame(() => setTimeout(resolve, 80)));
    }
    window.scrollTo(0, 0);
    await new Promise((resolve) => setTimeout(resolve, 200));
  });
}

// MenuPage reads through apiClient.getCustomerMenu, which unwraps res.data —
// so the stub must be { success, data: { categories: [{ items: [...] }] } }.
// Returning the flat { items } shape that the admin /api/menu consumer uses
// leaves res.data undefined and the page never leaves its loading skeleton.
const catalog = JSON.parse(await fs.readFile('public/data/menu-data.json', 'utf8'));
const menu = {
  success: true,
  data: {
    categories: catalog.categories.map((category) => ({
      id: category.id,
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
  },
  meta: { locale: 'vi' },
};

const browser = await chromium.launch({ headless: true, channel: 'chrome' });
const context = await browser.newContext({ serviceWorkers: 'block' });
await context.route('**/api/menu*', (route) => {
  return route.fulfill({
    contentType: 'application/json',
    // getCustomerMenu unwraps res.data, so the wire body must BE the envelope.
    body: JSON.stringify(menu),
  });
});
const page = await context.newPage();

// The production bundle calls the absolute worker origin rather than the local
// one (api-client picks API_BASE from VITE_API_BASE, falling back to the remote
// host outside DEV), so log what the page really asks for before trusting any
// assumption about which URL the stub needs to match.

const formats = new Map();
page.on('response', (response) => {
  const url = response.url();
  if (!url.includes('/menu/aura-drinks/')) return;
  const match = /-(\d+)\.(avif|webp)$/.exec(url.split('/').pop());
  if (match) formats.set(`${match[2]} ${match[1]}w`, (formats.get(`${match[2]} ${match[1]}w`) ?? 0) + 1);
});

const checks = [];

// The first navigation of a fresh context races the lazy route chunk against
// the stubbed query and can leave the page on its own skeleton with 0 articles,
// which would read as a false failure on whichever breakpoint came first. Load
// the route once here and throw that render away, so every breakpoint below
// measures a page whose chunk and query are already resolved.
await page.goto(URL);
try {
  await page.waitForFunction(() => {
    const cards = [...document.querySelectorAll('article')];
    return cards.length >= 49 && cards.every((card) => (card.textContent ?? '').trim().length > 20);
  }, null, { timeout: 60000 });
} catch (error) {
  // Dump enough of the page to tell a skeleton that never resolved from a route
  // that never loaded, instead of reporting a bare timeout.
  const dump = await page.evaluate(() => ({
    articles: document.querySelectorAll('article').length,
    imgs: document.querySelectorAll('img').length,
    bodyText: document.body.innerText.slice(0, 300),
    skeleton: !!document.querySelector('[class*="skeleton" i], [class*="animate-pulse" i]'),
  }));
  console.log('[warm-up failed]', JSON.stringify(dump, null, 2));
  throw error;
}

for (const { name, width, height } of BREAKPOINTS) {
  formats.clear();
  await page.setViewportSize({ width, height });
  await page.goto(URL);

  // Lay out with the card boxes already reserved, then let the images arrive.
  // Wait for the real description text, not just the card count: the menu
  // renders a skeleton whose text is shorter than the loaded card's, so a
  // baseline taken on the skeleton measures the text settling rather than the
  // image, and every variable-length description reads as a false shift.
  await page.waitForFunction(() => {
    const cards = [...document.querySelectorAll('article')];
    return cards.length >= 49 && cards.every((card) => (card.textContent ?? '').trim().length > 20);
  });
  // Measure the image frame, not the whole card. The card's outer height is
  // driven by the description, which the image cannot affect — clamping that
  // is a card-design concern, and comparing it here blames the pipeline for
  // text settling. The fixed h-64 frame is the slot the image must not move.
  const boxesBefore = await page.$$eval('article', (cards) =>
    cards.map((card) => {
      const frame = card.querySelector('div.relative');
      const box = frame ?? card;
      const r = box.getBoundingClientRect();
      return { x: +r.x.toFixed(1), w: +r.width.toFixed(1), h: +r.height.toFixed(1) };
    }));

  await page.locator('article img').evaluateAll((images) => {
    images.forEach((image) => { image.loading = 'eager'; });
  });
  // Only images in view will fetch — scroll the page so each one is requested,
  // then judge the loaded bitmap. A <picture>-wrapped img keeps its 1200px
  // fallback in src while <source> loads the 400px AVIF it actually picked, so
  // waiting on src alone hangs forever.
  await scrollThrough(page);
  await page.waitForFunction(
    () => [...document.querySelectorAll('article img')].every((image) => image.complete && image.naturalWidth > 0),
    null,
    { timeout: 60000 },
  );

  const boxesAfter = await page.$$eval('article', (cards) =>
    cards.map((card) => {
      const frame = card.querySelector('div.relative');
      const box = frame ?? card;
      const r = box.getBoundingClientRect();
      return { x: +r.x.toFixed(1), w: +r.width.toFixed(1), h: +r.height.toFixed(1) };
    }));

  // A frame whose own width or height changed after its image loaded means the
  // slot was not reserved up front; x is checked to catch a column reflow.
  const shiftedCards = boxesAfter.filter((box, index) => {
    const before = boxesBefore[index];
    return Math.abs(box.x - before.x) > 1 || Math.abs(box.w - before.w) > 1 || Math.abs(box.h - before.h) > 1;
  }).length;

  const report = await page.evaluate((packshots) => {
    const dpr = Math.min(devicePixelRatio, 2);
    const pickCurrent = (image) => {
      const source = image.closest('picture')?.querySelector('source');
      if (!source) return { w: image.naturalWidth, url: image.currentSrc };
      return { w: image.naturalWidth, url: image.currentSrc };
    };

    const images = [...document.querySelectorAll('article img')];
    const soft = [];
    for (const image of images) {
      const { url } = pickCurrent(image);
      const box = image.getBoundingClientRect();
      if (box.width === 0) continue;
      // Rasterise at devicePixelRatio: a 2x display needs twice the pixels a 1x
      // one does, otherwise the browser scales the bitmap up and it looks soft.
      const needed = box.width * dpr;
      if (image.naturalWidth < needed - 1) {
        soft.push({ alt: image.alt.slice(0, 40), naturalWidth: image.naturalWidth, needed: Math.round(needed) });
      }
      if (url.endsWith('.webp') && !url.includes('-')) {
        soft.push({ alt: image.alt.slice(0, 40), reason: 'master served, no variant' });
      }
    }

    const packshot = images
      .map((image) => ({ image, src: image.getAttribute('src') ?? '' }))
      .find((entry) => packshots.some((packshot) => entry.src.includes(packshot)));

    let packshotRatio = null;
    if (packshot) {
      const box = packshot.image.getBoundingClientRect();
      const style = getComputedStyle(packshot.image);
      packshotRatio = {
        src: packshot.src,
        // object-contain must letterbox rather than crop, so the rendered box
        // ratio is free to differ; what matters is the bitmap keeping its own.
        bitmapRatio: +(packshot.image.naturalWidth / packshot.image.naturalHeight).toFixed(3),
        boxRatio: +(box.width / box.height).toFixed(3),
        objectFit: style.objectFit,
      };
    }

    return {
      count: images.length,
      overflow: document.documentElement.scrollWidth > innerWidth,
      soft,
      packshotRatio,
    };
  }, PACKSHOTS);

  await page.screenshot({ path: `plans/261024-0800-menu-image-payload-optimization/menu-images-${name}.png`, fullPage: false });

  checks.push({
    name,
    fixture: 'canonical 49-item catalog with empty API image URLs',
    formats: [...formats.entries()].map(([format, count]) => `${format}=${count}`),
    shiftedCards,
    overflow: report.overflow,
    soft: report.soft,
    packshotRatio: report.packshotRatio,
  });
}

await browser.close();

const failures = [];
for (const check of checks) {
  if (check.soft.length) failures.push({ name: check.name, why: `${check.soft.length} image(s) rendered soft`, detail: check.soft.slice(0, 3) });
  if (check.shiftedCards) failures.push({ name: check.name, why: `${check.shiftedCards} card(s) shifted after image load` });
  if (check.overflow) failures.push({ name: check.name, why: 'horizontal overflow' });
  if (!check.packshotRatio || check.packshotRatio.objectFit !== 'contain') {
    failures.push({ name: check.name, why: 'packshot not object-contain' });
  }
}

await fs.writeFile(
  'plans/261024-0800-menu-image-payload-optimization/menu-images-browser-checks.json',
  JSON.stringify({ checks, failures }, null, 2),
);
console.log(JSON.stringify({ checks, failures }, null, 2));
await browser.close();
if (failures.length) process.exit(1);
