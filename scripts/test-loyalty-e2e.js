#!/usr/bin/env node
// scripts/test-loyalty-e2e.js
// AURA CAFE — Loyalty System E2E Smoke Test
// Usage: node scripts/test-loyalty-e2e.js
// Requires: Node 18+ (built-in fetch), no external deps

const WORKER = 'https://aura-space-worker.sadec-marketing-hub.workers.dev';
const PAGES  = 'https://fnb-caffe-container.pages.dev';

// Test phone — safe idempotent test number
const TEST_PHONE = '0799888777';
const TEST_NAME  = 'Test E2E';

let passed = 0;
let failed = 0;
const results = [];

async function assert(name, fn) {
  try {
    await fn();
    results.push({ name, ok: true });
    passed++;
  } catch (err) {
    results.push({ name, ok: false, error: err.message });
    failed++;
  }
}

function expect(condition, msg) {
  if (!condition) throw new Error(msg);
}

// ─── Helper ───────────────────────────────────────────────────────────────────

async function get(path, base = WORKER) {
  const res = await fetch(`${base}${path}`);
  return res;
}

async function post(path, body, base = WORKER) {
  const res = await fetch(`${base}${path}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  return res;
}

async function patch(path, body = {}, base = WORKER) {
  const res = await fetch(`${base}${path}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  return res;
}

// ─── Test Cases ───────────────────────────────────────────────────────────────

// 1. Health check
await assert('Health check — GET /api/health → 200, status ok', async () => {
  const res = await get('/api/health');
  expect(res.status === 200, `Expected 200, got ${res.status}`);
  const data = await res.json();
  expect(data.status === 'ok', `Expected status "ok", got "${data.status}"`);
});

// 2. Public tiers
await assert('Public tiers — GET /api/loyalty/tiers → 200, 4 tiers with correct cashback rates', async () => {
  const res = await get('/api/loyalty/tiers');
  expect(res.status === 200, `Expected 200, got ${res.status}`);
  const data = await res.json();

  // Accept array or object with tiers key
  const tiers = Array.isArray(data) ? data : (data.tiers ?? data.data ?? null);
  expect(Array.isArray(tiers), `Expected array of tiers, got: ${JSON.stringify(data).slice(0, 120)}`);
  expect(tiers.length === 4, `Expected 4 tiers, got ${tiers.length}`);

  // Find each tier by name (case-insensitive)
  const find = (name) => tiers.find(t =>
    (t.name ?? t.tier_name ?? t.id ?? '').toLowerCase() === name
  );
  const bronze   = find('bronze');
  const silver   = find('silver');
  const gold     = find('gold');
  const platinum = find('platinum');

  expect(bronze,   'bronze tier not found');
  expect(silver,   'silver tier not found');
  expect(gold,     'gold tier not found');
  expect(platinum, 'platinum tier not found');

  // cashback_rate may be stored as 3, 0.03, or "3%"
  const rate = (t) => {
    const raw = t.cashback_rate ?? t.cashback_percent ?? t.rate ?? t.percent;
    if (typeof raw === 'string') return parseFloat(raw);
    return raw;
  };
  const normalise = (r) => r > 1 ? r / 100 : r;  // 3 → 0.03

  expect(Math.abs(normalise(rate(bronze))   - 0.03) < 0.001, `bronze cashback expected 3%, got ${rate(bronze)}`);
  expect(Math.abs(normalise(rate(silver))   - 0.05) < 0.001, `silver cashback expected 5%, got ${rate(silver)}`);
  expect(Math.abs(normalise(rate(gold))     - 0.07) < 0.001, `gold cashback expected 7%, got ${rate(gold)}`);
  expect(Math.abs(normalise(rate(platinum)) - 0.10) < 0.001, `platinum cashback expected 10%, got ${rate(platinum)}`);
});

// 3. Active campaign
await assert('Active campaign — GET /api/loyalty/active-campaign → 200, parses JSON', async () => {
  const res = await get('/api/loyalty/active-campaign');
  expect(res.status === 200, `Expected 200, got ${res.status}`);
  const data = await res.json(); // throws if invalid JSON
  expect(data !== undefined, 'Response body was undefined');
  // campaign may be null — that is valid
});

// 4. Signup page accessible (Pages CDN)
await assert('Signup page accessible — Pages /dang-ky-thanh-vien → 200', async () => {
  const res = await get('/dang-ky-thanh-vien', PAGES);
  expect(res.status === 200, `Expected 200, got ${res.status}`);
});

// 5. Auth guards
await assert('Auth guard — PATCH /api/orders/test123 without JWT → 401', async () => {
  const res = await patch('/api/orders/test123');
  expect(res.status === 401, `Expected 401, got ${res.status}`);
});

await assert('Auth guard — GET /api/kds/orders without JWT → 401', async () => {
  const res = await get('/api/kds/orders');
  expect(res.status === 401, `Expected 401, got ${res.status}`);
});

await assert('Auth guard — POST /api/seed-menu without JWT → 404 (route hidden)', async () => {
  const res = await post('/api/seed-menu', {});
  expect(res.status === 404, `Expected 404, got ${res.status}`);
});

// 6. Lookup — non-member phone
await assert('Lookup non-member — GET /api/loyalty/lookup?phone=0999999999 → 200, ok:false, Vietnamese error', async () => {
  const res = await get('/api/loyalty/lookup?phone=0999999999');
  expect(res.status === 200, `Expected 200, got ${res.status}`);
  const data = await res.json();
  expect(data.ok === false, `Expected ok:false, got ok:${data.ok}`);
  // Check there is some kind of error/message field
  const msg = data.error ?? data.message ?? data.msg ?? '';
  expect(typeof msg === 'string' && msg.length > 0, `Expected Vietnamese error message, got: ${JSON.stringify(msg)}`);
});

// 7. Phone-auth — register / return test member
await assert('Phone-auth register — POST /api/loyalty/phone-auth → 200 or 409 (member exists)', async () => {
  const res = await post('/api/loyalty/phone-auth', { phone: TEST_PHONE, name: TEST_NAME });
  // 409 conflict = already registered = acceptable PASS
  if (res.status === 409) return;
  expect(res.status === 200, `Expected 200 or 409, got ${res.status}`);
  const data = await res.json();
  expect(data.success === true, `Expected success:true, got: ${JSON.stringify(data).slice(0, 200)}`);
});

// 8. Lookup — after registration, member should exist
await assert('Lookup after register — GET /api/loyalty/lookup?phone=0799888777 → 200, ok:true, valid member', async () => {
  const res = await get(`/api/loyalty/lookup?phone=${TEST_PHONE}`);
  expect(res.status === 200, `Expected 200, got ${res.status}`);
  const data = await res.json();
  expect(data.ok === true, `Expected ok:true — member not found after register. Response: ${JSON.stringify(data).slice(0, 200)}`);

  const member = data.member ?? data.data ?? data;
  const memberId = member.member_id ?? member.id ?? '';
  expect(typeof memberId === 'string' && memberId.startsWith('AC'), `Expected member_id to start with "AC", got "${memberId}"`);

  const tier = (member.tier ?? member.tier_name ?? '').toLowerCase();
  expect(tier === 'bronze', `Expected tier "bronze", got "${tier}"`);

  const balance = member.balance ?? member.points ?? member.cashback_balance;
  expect(typeof balance === 'number', `Expected balance to be a number, got ${typeof balance} (${balance})`);
});

// 9. Rate limit check — send enough requests to trigger 10/5min limit
// Note: Cloudflare KV is eventually consistent across PoPs — send 40 requests
// so even if some PoPs see stale counters, the cumulative writes converge over 10+
await assert('Rate limit — phone-auth triggers 429 after 10 req/5min/IP (KV eventual consistency: 40 attempts)', async () => {
  const ATTEMPTS = 40;
  let hitLimit = false;

  for (let i = 0; i < ATTEMPTS; i++) {
    const res = await post('/api/loyalty/phone-auth', { phone: TEST_PHONE, name: TEST_NAME });
    if (res.status === 429) {
      hitLimit = true;
      break;
    }
  }

  expect(hitLimit, `Expected 429 (rate limit) within ${ATTEMPTS} attempts (limit: 10/5min) — KV writes may lag across PoPs`);
});

// 10. Spend-cashback float validation
await assert('Spend-cashback integer validation — float amount → 400 or 401 (not 200)', async () => {
  const res = await post('/api/loyalty/spend-cashback', {
    order_id: 'e2e-test-xyz',
    amount: 99.5,   // float — should be rejected
  });
  // 400 = float rejected (best)
  // 401 = auth required before validation (acceptable)
  // Anything else except 200 is acceptable
  expect(
    res.status === 400 || res.status === 401 || res.status === 403 || res.status === 422,
    `Expected 400/401/403/422 (float rejection or auth guard), got ${res.status}`
  );
  expect(res.status !== 200, `Float amount 99.5 must NOT be accepted (got 200 OK)`);
});

// ─── Summary ──────────────────────────────────────────────────────────────────

async function run() {
  // All asserts above are top-level awaited; this just prints results.
  console.log('\nResults:');
  for (const r of results) {
    console.log(`  ${r.ok ? '✓' : '✗'} ${r.name}${r.error ? ' — ' + r.error : ''}`);
  }
  console.log(`\n${'═'.repeat(60)}`);
  console.log(`  ${passed} passed, ${failed} failed`);
  if (failed > 0) process.exit(1);
}

console.log('\n🧪 AURA LOYALTY — E2E Smoke Test');
console.log('═'.repeat(60));
console.log(`  Worker : ${WORKER}`);
console.log(`  Pages  : ${PAGES}`);
console.log(`  Time   : ${new Date().toISOString()}`);
console.log('═'.repeat(60));

run().catch(err => { console.error(err); process.exit(1); });
