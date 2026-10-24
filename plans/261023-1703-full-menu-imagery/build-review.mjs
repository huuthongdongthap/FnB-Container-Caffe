import fs from 'node:fs/promises';
import sharp from 'sharp';
import { MENU_DRINK_IMAGES, resolveMenuDrinkPackshots } from '../../src/lib/menu-drink-images.ts';

const planDirectory = 'plans/261023-1703-full-menu-imagery';
const assetDirectory = 'public/menu/aura-drinks';
const catalog = JSON.parse(await fs.readFile('public/data/menu-data.json', 'utf8'));
const imageMap = MENU_DRINK_IMAGES;
const cleanName = (value) => value.replace(/\s*\([^)]*\)/g, '').trim();
const escapeHtml = (value) => value.replace(/[&<>"']/g, (character) => ({
  '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', '\'': '&#39;',
})[character]);
const categories = catalog.categories.map((category) => ({
  id: category.id,
  name: cleanName(category.name),
}));
const items = [];
for (const item of catalog.items) {
  const image = imageMap[item.id];
  if (!image) {
    throw new Error(`Missing image mapping: ${item.id}`);
  }
  const filePath = `public${image}`;
  const metadata = await sharp(filePath).metadata();
  const packshots = resolveMenuDrinkPackshots(item.id, image);
  if (!packshots && (metadata.width !== 1200 || metadata.height !== 900)) {
    throw new Error(`Invalid dimensions: ${filePath}`);
  }
  const brandImages = [];
  for (const packshot of packshots ?? []) {
    const details = await sharp(`public${packshot.src}`).metadata();
    if (details.format !== 'webp' || !details.width || !details.height) {
      throw new Error(`Invalid packshot: ${packshot.src}`);
    }
    brandImages.push({ ...packshot, width: details.width, height: details.height });
  }
  const stats = await fs.stat(filePath);
  items.push({id: item.id, name: cleanName(item.name), category: item.category, image, bytes: stats.size,
    ...(packshots ? {packshots: brandImages, source: 'official-brand-packshot'} : {source: 'ai-illustration'})});
}
if (items.length !== 49 || new Set(items.map((item) => item.image)).size !== 49) {
  throw new Error('Expected 49 distinct menu photographs');
}
await fs.writeFile(`${assetDirectory}/collection.json`, JSON.stringify({categories, items}, null, 2));
const buttons = categories.map((category) => `<button type="button" data-category="${category.id}" aria-pressed="false">${escapeHtml(category.name)}</button>`).join('\n');
const cards = items.map((item) => {
  const category = categories.find((entry) => entry.id === item.category);
  const image = item.image.split('/').at(-1);
  const photo = item.packshots
    ? `<div class="photo packshots">${item.packshots.map((packshot) => `<a href="${packshot.src.split('/').at(-1)}" target="_blank" rel="noopener"><img src="${packshot.src.split('/').at(-1)}" alt="${escapeHtml(packshot.alt)}" width="${packshot.width}" height="${packshot.height}" loading="lazy"></a>`).join('')}</div>`
    : `<a class="photo" href="${image}" target="_blank" rel="noopener"><img src="${image}" alt="${escapeHtml(item.name)} — ảnh minh họa" width="1200" height="900" loading="lazy"></a>`;
  const download = item.packshots
    ? item.packshots.map((packshot) => `<a href="${packshot.src.split('/').at(-1)}" download>Tải ${escapeHtml(packshot.alt.split(' — ')[0])}</a>`).join(' · ')
    : `<a href="${image}" download>Tải ảnh WebP</a>`;
  return `<article data-category="${item.category}" data-name="${escapeHtml(item.name)}">
    ${photo}
    <div class="details"><span class="category">${escapeHtml(category.name)}</span><h2>${escapeHtml(item.name)}</h2>${download}</div>
  </article>`;
}).join('\n');
const html = `<!doctype html>
<html lang="vi"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
<title>AURA — Toàn bộ ảnh Menu</title>
<style>
:root{color-scheme:dark;font-family:system-ui,sans-serif;background:#101a19;color:#f4f0e7}*{box-sizing:border-box}body{margin:0}main{max-width:1440px;margin:auto;padding:56px 28px}header{max-width:780px;margin-bottom:32px}.eyebrow{color:#d3bd91;letter-spacing:.24em;font-size:12px}h1{font-family:Georgia,serif;font-weight:400;font-size:clamp(36px,5vw,64px);margin:14px 0}header p,footer{color:#bac5bd;line-height:1.7}.toolbar{margin:24px 0 32px}label{display:block;font-size:13px;margin-bottom:8px}input{width:min(100%,480px);padding:14px 16px;font:inherit;background:#17231f;color:#fff;border:1px solid #59675b;border-radius:8px}nav{display:flex;flex-wrap:wrap;gap:8px;margin-top:20px}button{font:inherit;font-size:12px;min-height:44px;padding:10px 14px;border:1px solid #45564a;border-radius:24px;background:#17231f;color:#ddd;cursor:pointer}button[aria-pressed="true"]{background:#d3bd91;color:#17231f;border-color:#d3bd91}.count{color:#bac5bd;font-size:13px;margin:18px 0}.grid{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:24px}article{border:1px solid #33413b;border-radius:16px;overflow:hidden;background:#17231f;min-width:0}article[hidden]{display:none}.photo{display:block}article img{display:block;width:100%;height:auto;aspect-ratio:4/3;object-fit:cover}.details{padding:20px}.category{color:#c2ac7e;font-size:10px;letter-spacing:.12em;text-transform:uppercase}h2{font-size:19px;margin:8px 0 16px;font-weight:500;overflow-wrap:anywhere}a{color:#e6dfcd;text-underline-offset:5px;font-size:13px}:focus-visible{outline:2px solid #e6dfcd;outline-offset:4px}footer{margin-top:36px;font-size:13px}@media(max-width:900px){.grid{grid-template-columns:repeat(2,minmax(0,1fr))}}@media(max-width:560px){main{padding:32px 16px}.grid{grid-template-columns:1fr;gap:20px}}
.packshots{display:flex;aspect-ratio:4/3;gap:16px;padding:28px;background:#efe9dc}.packshots a{display:flex;flex:1;min-width:0;width:0}.packshots img{width:100%;height:100%;aspect-ratio:auto;object-fit:contain}
</style></head><body><main>
<header><div class="eyebrow">AURA CAFE · FULL MENU COLLECTION</div><h1>Mỗi món một sắc vị.</h1><p>49 ảnh món nước · 10 nhóm · Ánh nắng tự nhiên, chất liệu mộc và màu sắc nguyên liệu.</p></header>
<div class="toolbar"><label for="search">Tìm món nước</label><input id="search" type="search" placeholder="Cà phê, trà đào, sinh tố…" autocomplete="off"><nav aria-label="Lọc nhóm đồ uống"><button type="button" data-category="all" aria-pressed="true">Tất cả</button>${buttons}</nav><p class="count" role="status" aria-live="polite">Hiển thị 49 / 49 món</p></div>
<section class="grid" aria-label="Toàn bộ ảnh món nước">${cards}</section>
<footer>Ảnh món pha chế là minh họa AI. Dasani, Coca-Cola, Pepsi và Red Bull dùng ảnh sản phẩm từ website hãng, giữ nguyên nhãn, không cắt bao bì.<br>Nguồn: <a href="https://www.coca-cola.com/vn/vi/brands/dasani">Dasani — Coca-Cola Việt Nam</a> · <a href="https://www.coca-cola.com/vn/vi/brands/coca-cola">Coca-Cola Việt Nam</a> · <a href="https://www.suntorypepsico.vn/thuong-hieu-cua-chung-toi/pepsi-3">Suntory PepsiCo Việt Nam</a> · <a href="https://www.tcp.com/en/tcp-global/asia/vietnam">TCP — Red Bull</a>.<br>Bản duyệt local; cần xác minh quyền sử dụng ảnh trước khi xuất bản. Mỗi mục gồm nhiều lựa chọn dùng cách phục vụ đại diện; không thay đổi danh mục hay giá bán.</footer>
</main><script>
const buttons=[...document.querySelectorAll('button[data-category]')];
const cards=[...document.querySelectorAll('article')];
const input=document.querySelector('#search');
let activeCategory='all';
const normalize=value=>value.normalize('NFD').replace(/[\\u0300-\\u036f]/g,'').replace(/đ/gi,'d').toLowerCase();
function filter(){const query=normalize(input.value.trim());let count=0;for(const card of cards){const visible=(activeCategory==='all'||card.dataset.category===activeCategory)&&normalize(card.dataset.name).includes(query);card.hidden=!visible;if(visible)count++;}document.querySelector('[role="status"]').textContent='Hiển thị '+count+' / 49 món';}
for(const button of buttons){button.addEventListener('click',()=>{activeCategory=button.dataset.category;for(const other of buttons)other.setAttribute('aria-pressed',String(other===button));filter();});}
input.addEventListener('input',filter);
</script></body></html>`;
await fs.writeFile(`${assetDirectory}/preview.html`, html);
for (let start = 0; start < items.length; start += 16) {
  const group = items.slice(start, start + 16);
  const tiles = [];
  for (const [index, item] of group.entries()) {
    const caption = Buffer.from(`<svg width="360" height="32"><rect width="360" height="32" fill="#10201b"/><text x="10" y="21" font-size="13" fill="white" font-family="sans-serif">${escapeHtml(item.name)}</text></svg>`);
    const input = await sharp(`public${item.image}`).resize(360, 270, {fit:'contain', background: item.packshots ? '#efe9dc' : '#10201b'}).extend({bottom:32, background:'#10201b'}).composite([{input:caption, left:0, top:270}]).png().toBuffer();
    tiles.push({input, left:(index % 4) * 360, top:Math.floor(index / 4) * 302});
  }
  await sharp({create:{width:1440, height:Math.ceil(group.length / 4) * 302, channels:3, background:'#10201b'}})
    .composite(tiles).jpeg({quality:90}).toFile(`${planDirectory}/contact-sheet-${Math.floor(start / 16) + 1}.jpg`);
}
await fs.writeFile(`${planDirectory}/asset-checks.json`, JSON.stringify({count:items.length, distinct:49, totalBytes:items.reduce((total,item)=>total+item.bytes,0), items}, null, 2));
console.log(`Built full preview: ${items.length} distinct menu images; official brand packshots retain their original proportions`);
