#!/usr/bin/env node
/**
 * Generate membership cards PDF batch from D1
 * Usage: node scripts/generate-member-cards.js [limit=100] [output=designs/cards-batch-1.pdf]
 * Requires: npm install puppeteer --save-dev
 */

import puppeteer from 'puppeteer';
import fs from 'fs/promises';
import { execSync } from 'child_process';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');

const LIMIT = parseInt(process.argv[2] || '100', 10);
const OUTPUT = process.argv[3] || 'designs/cards-batch-1.pdf';
const DB_NAME = 'fnb-caffe-db';

const TIER_VI = { bronze: 'Đồng', silver: 'Bạc', gold: 'Vàng', platinum: 'Bạch Kim' };

async function fetchMembers() {
  const json = execSync(
    `npx wrangler d1 execute ${DB_NAME} --remote --json --command="SELECT id, name, phone, loyalty_tier FROM customers ORDER BY created_at ASC LIMIT ${LIMIT}"`,
    { encoding: 'utf-8', cwd: path.join(ROOT, 'worker') }
  );
  const data = JSON.parse(json);
  return (data[0] || data).results || [];
}

function memberId(id) {
  return 'AC' + String(id).slice(-6).toUpperCase();
}

function renderFrontCard(member) {
  const tier = member.loyalty_tier || 'bronze';
  const tierVi = TIER_VI[tier] || 'Đồng';
  return `
    <div class="card card-front">
      <div class="brand-row">
        <div class="brand-logo">A</div>
        <div>
          <div class="brand-name">AURA</div>
          <div class="brand-sub">CAFE · EST.2018</div>
        </div>
      </div>
      <div class="member-row">
        <div class="member-label">Thành viên</div>
        <div class="member-id">${memberId(member.id)}</div>
        <div class="member-name">${(member.name || 'THÀNH VIÊN').toUpperCase()}</div>
      </div>
      <div class="tier-badge ${tier}">${tierVi}</div>
    </div>`;
}

function renderBackCard() {
  return `
    <div class="card card-back">
      <div>
        <div class="qr-box">
          <img src="public/qr/qr-signup-leaflet.png" alt="QR"/>
        </div>
        <div class="qr-label">QUÉT QR</div>
      </div>
      <div class="instructions">
        <strong>Cách dùng ví AURA</strong>
        <ol>
          <li>Đọc SĐT khi order → tích cashback</li>
          <li>Quét QR → xem ví online</li>
          <li>Dùng ví trừ hóa đơn (max 50%)</li>
        </ol>
      </div>
      <div class="back-footer">AURA CAFE · Sa Đéc · 0946.013.633</div>
    </div>`;
}

function buildSheets(members, renderCard) {
  const perSheet = 10;
  let html = '';
  for (let i = 0; i < members.length; i++) {
    if (i % perSheet === 0) {
      if (i > 0) html += '</div>';
      html += `<div class="sheet"${i > 0 ? ' style="page-break-before:always"' : ''}>`;
    }
    html += renderCard(members[i]);
  }
  if (members.length > 0) html += '</div>';
  return html;
}

async function main() {
  const members = await fetchMembers();
  console.log(`Found ${members.length} members`);
  if (!members.length) { console.log('No members found.'); process.exit(0); }

  const template = await fs.readFile(path.join(ROOT, 'designs/membership-card-template.html'), 'utf-8');

  const frontSheets = buildSheets(members, renderFrontCard);
  const backSheets = buildSheets(
    members.map((_, i) => i), // dummy array, back cards are identical
    () => renderBackCard()
  );

  const finalHtml = template
    .replace('<div class="sheet" id="frontSheet">', frontSheets)
    .replace(/(<div class="sheet-label"[^>]*>Mặt sau[^<]*<\/div>\s*)<div class="sheet" id="backSheet"[^>]*>/, `$1<div class="sheet" id="backSheet" style="page-break-before:always">`)
    .replace('<div class="sheet" id="backSheet" style="page-break-before:always">\n  <div class="card card-back">', backSheets.replace('<div class="sheet">', '<div style="display:none">'))
    // Simpler: replace entire back sheet section
  ;

  // Rebuild cleanly
  const frontBlock = `<div class="sheet-label">Mặt trước — in trên giấy 300gsm matte, cắt 90×54mm</div>\n${buildSheets(members, renderFrontCard)}`;
  const backBlock = `<div class="sheet-label" style="page-break-before:always">Mặt sau — in mặt trái của tờ trước</div>\n${buildSheets(members.slice(0, members.length), () => renderBackCard())}`;

  const bodyContent = frontBlock + '\n' + backBlock;
  const cleanHtml = template.replace(
    /<div class="sheet-label">Mặt trước[\s\S]*?<\/body>/,
    bodyContent + '\n</body>'
  );

  const browser = await puppeteer.launch({ args: ['--no-sandbox'] });
  const page = await browser.newPage();
  await page.setContent(cleanHtml, { waitUntil: 'networkidle0', baseURL: `file://${ROOT}/` });
  await page.pdf({
    path: path.join(ROOT, OUTPUT),
    format: 'A4',
    printBackground: true,
    margin: { top: '10mm', bottom: '10mm', left: '10mm', right: '10mm' },
  });
  await browser.close();

  console.log(`PDF generated: ${OUTPUT}`);
  console.log(`  ${members.length} thẻ trên ${Math.ceil(members.length / 10)} tờ A4`);
  console.log(`  In giấy cứng 300gsm matte, cắt 90×54mm (~80-100k cho 100 thẻ)`);
}

main().catch(e => { console.error(e.message); process.exit(1); });
