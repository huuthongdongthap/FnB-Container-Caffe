#!/usr/bin/env node
// scripts/d1-review.js
// AURA CAFE — D+1 Post-Launch Review
// Usage: node scripts/d1-review.js [date=YYYY-MM-DD] [--owner-email=E --owner-pass=P]
// Default date: yesterday (so run on 07/06 → pulls 06/06 data)

import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const WORKER = 'https://aura-space-worker.sadec-marketing-hub.workers.dev';

const args = Object.fromEntries(
  process.argv.slice(2)
    .filter(a => a.startsWith('--'))
    .map(a => a.slice(2).split('='))
);
const dateArg = process.argv.slice(2).find(a => /^\d{4}-\d{2}-\d{2}$/.test(a));
const DATE = dateArg || (() => { const d = new Date(); d.setDate(d.getDate()-1); return d.toISOString().slice(0,10); })();
const OWNER_EMAIL = args['owner-email'] || null;
const OWNER_PASS  = args['owner-pass']  || null;

async function getToken() {
  if (!OWNER_EMAIL) return null;
  const res = await fetch(`${WORKER}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: OWNER_EMAIL, password: OWNER_PASS }),
  });
  if (!res.ok) { console.error(`Login failed ${res.status}`); return null; }
  return (await res.json()).token;
}

async function apiFetch(path, token) {
  const res = await fetch(`${WORKER}${path}`, {
    headers: token ? { Authorization: `Bearer ${token}` } : {},
  });
  if (!res.ok) throw new Error(`${path} → ${res.status}`);
  return res.json();
}

function fmt(n) { return Number(n || 0).toLocaleString('vi-VN') + 'đ'; }
function pct(n) { return `${n}%`; }
function bar(pct, width=20) {
  const filled = Math.round((Math.min(pct,100)/100)*width);
  return '█'.repeat(filled) + '░'.repeat(width-filled) + ` ${pct}%`;
}

async function main() {
  console.log(`AURA CAFE — D+1 Review | Date: ${DATE}`);
  console.log('─'.repeat(60));

  const token = await getToken();
  if (!token) {
    console.error('No owner JWT. Pass --owner-email and --owner-pass');
    process.exit(1);
  }

  console.log('Pulling data from worker...');
  const [summary, signups, cashback, orders] = await Promise.all([
    apiFetch(`/api/reports/summary?date=${DATE}`, token),
    apiFetch(`/api/reports/signups?date=${DATE}`, token),
    apiFetch(`/api/reports/cashback?date=${DATE}`, token),
    apiFetch(`/api/reports/orders?date=${DATE}`, token),
  ]);

  const now = new Date().toISOString().replace('T', ' ').slice(0,19);

  // ── Build markdown report ──────────────────────────────────────
  const kpi = summary.kpi || {};
  const bonus = summary.signup_bonus || {};
  const tiers = (summary.member_tiers || []).map(t => `${t.loyalty_tier}: ${t.count}`).join(' | ');

  const bySource = (signups.signups?.by_source || [])
    .map(r => `| ${r.source.padEnd(20)} | ${String(r.count).padStart(5)} |`)
    .join('\n');

  const byCbType = (cashback.cashback?.by_type || [])
    .map(r => `| ${r.type.padEnd(10)} | ${String(r.count).padStart(5)} | ${fmt(r.total_vnd).padStart(14)} |`)
    .join('\n');

  const topEarners = (cashback.cashback?.top_earners || []).slice(0,5)
    .map((r,i) => `${i+1}. ${(r.name||'—').padEnd(20)} ${r.phone}  earned:${fmt(r.earned)}`)
    .join('\n');

  const hourly = (orders.orders?.hourly || [])
    .map(r => `${r.hour}h: ${'▓'.repeat(Math.min(r.count,20))} ${r.count} đơn`)
    .join('\n');

  const byStatus = (orders.orders?.by_status || [])
    .map(r => `| ${r.status.padEnd(12)} | ${r.count} |`)
    .join('\n');

  const report = `# AURA CAFE — D+1 Post-Launch Review
**Ngày D0:** ${DATE} | **Generated:** ${now}
**Campaign:** GRAND_OPENING_6_6_2026

---

## KPI Dashboard

| Metric | Target | Actual | Progress |
|--------|--------|--------|----------|
| Signups D0 | 100 | **${kpi.signups?.actual ?? '—'}** | ${bar(kpi.signups?.pct ?? 0)} |
| Orders D0 | 150 | **${kpi.orders?.actual ?? '—'}** | ${bar(kpi.orders?.pct ?? 0)} |
| Cashback issued | 5.000.000đ | **${fmt(kpi.cashback?.actual)}** | ${bar(kpi.cashback?.pct ?? 0)} |

---

## Signups — ${summary.signups ?? '—'} thành viên

### By Source / Channel
| Channel | Signups |
|---------|---------|
${bySource || '| (no data) | — |'}

### Signup Bonus (50k cap: ${bonus.cap_total})
- Granted: **${bonus.granted}** signups × 50.000đ = **${fmt(bonus.vnd)}**
- Cap used: **${bonus.cap_used}/${bonus.cap_total}** (${bar(bonus.cap_pct ?? 0)})

---

## Cashback Issued

| Type | Txns | Amount |
|------|------|--------|
${byCbType || '| (no data) | — | — |'}

- **Total issued:** ${fmt(cashback.cashback?.issued_vnd)}
- **Total spent:** ${fmt(cashback.cashback?.spent_vnd)}
- **Net liability:** ${fmt(cashback.cashback?.net_liability_vnd)}

### Top 5 Earners D0
\`\`\`
${topEarners || '(no data)'}
\`\`\`

---

## Orders — ${summary.orders ?? '—'} đơn | Revenue: ${fmt(summary.revenue_vnd)}

### Hourly Volume
\`\`\`
${hourly || '(no data)'}
\`\`\`

### By Status
| Status | Count |
|--------|-------|
${byStatus || '| (no data) | — |'}

---

## Member Tiers (cumulative)
${tiers || '(no data)'}

---

## Anomaly Checks

${bonus.granted > bonus.cap_total
  ? `⚠️  OVER-CAP: ${bonus.granted} bonuses granted vs cap ${bonus.cap_total} — INVESTIGATE`
  : `✅  Signup bonus within cap (${bonus.cap_used}/${bonus.cap_total})`}

${cashback.cashback?.net_liability_vnd > 6000000
  ? `⚠️  Cashback liability ${fmt(cashback.cashback?.net_liability_vnd)} exceeds budget 5.000.000đ — review`
  : `✅  Cashback liability ${fmt(cashback.cashback?.net_liability_vnd)} within budget`}

---

## Actions Required

${kpi.signups?.actual < 50
  ? '- [ ] Signups < 50% target — boost Facebook post, send Zalo reminder'
  : '- [x] Signup target on track'}
${kpi.orders?.actual < 75
  ? '- [ ] Orders < 50% target — check POS, staff briefing needed'
  : '- [x] Orders on track'}
${(bonus.cap_used / bonus.cap_total) > 0.8
  ? '- [ ] Signup bonus cap >80% used — decide whether to extend cap'
  : ''}

---

*Generated by scripts/d1-review.js | AURA CAFE Sa Đéc*
`;

  // Write report
  const dir = path.join(ROOT, 'reports/marketing/d1-review');
  await fs.mkdir(dir, { recursive: true });
  const outFile = path.join(dir, `d1-review-${DATE}.md`);
  await fs.writeFile(outFile, report, 'utf-8');

  // Print summary to stdout
  console.log('');
  console.log('─'.repeat(60));
  console.log(`Signups   : ${summary.signups ?? '?'} / 100  (${kpi.signups?.pct ?? 0}%)`);
  console.log(`Orders    : ${summary.orders ?? '?'} / 150  (${kpi.orders?.pct ?? 0}%)`);
  console.log(`Revenue   : ${fmt(summary.revenue_vnd)}`);
  console.log(`Cashback  : ${fmt(summary.cashback_issued_vnd)} issued | ${fmt(summary.cashback_spent_vnd)} spent`);
  console.log(`Bonus cap : ${bonus.cap_used ?? '?'}/${bonus.cap_total ?? 100} used`);
  console.log('─'.repeat(60));
  console.log(`Report    : ${outFile}`);
  console.log('');
}

main().catch(e => { console.error(e.message); process.exit(1); });
