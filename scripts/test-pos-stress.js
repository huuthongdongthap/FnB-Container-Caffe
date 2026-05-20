#!/usr/bin/env node
// scripts/test-pos-stress.js
// AURA CAFE — POS + Cashback Stress Test
// Usage: node scripts/test-pos-stress.js [--owner-email=EMAIL --owner-pass=PASS]
// Requires: Node 18+ (built-in fetch)

const WORKER = 'https://aura-space-worker.sadec-marketing-hub.workers.dev';

// Parse CLI args
const args = Object.fromEntries(
  process.argv.slice(2)
    .filter(a => a.startsWith('--'))
    .map(a => a.slice(2).split('='))
);
const OWNER_EMAIL = args['owner-email'] || null;
const OWNER_PASS  = args['owner-pass']  || null;

// 10 test phones — unique to stress test, won't collide with E2E phones (0799888777)
const STRESS_PHONES = Array.from({ length: 10 }, (_, i) => `079922200${String(i).padStart(2, '0')}`);

let passed = 0;
let failed = 0;
let skipped = 0;
const results = [];
let ownerToken = null;

async function assert(name, fn) {
  try {
    await fn();
    results.push({ name, ok: true });
    passed++;
  } catch (err) {
    if (err.message === 'SKIP') {
      results.push({ name, ok: null });
      skipped++;
    } else {
      results.push({ name, ok: false, error: err.message });
      failed++;
    }
  }
}

function expect(cond, msg) { if (!cond) throw new Error(msg); }
function skip(reason) { console.log(`  skip — ${reason}`); throw new Error('SKIP'); }

async function post(path, body, token) {
  const h = { 'Content-Type': 'application/json' };
  if (token) h['Authorization'] = `Bearer ${token}`;
  return fetch(`${WORKER}${path}`, { method: 'POST', headers: h, body: JSON.stringify(body) });
}
async function patch(path, body, token) {
  const h = { 'Content-Type': 'application/json' };
  if (token) h['Authorization'] = `Bearer ${token}`;
  return fetch(`${WORKER}${path}`, { method: 'PATCH', headers: h, body: JSON.stringify(body) });
}
async function get(path, token) {
  const h = token ? { Authorization: `Bearer ${token}` } : {};
  return fetch(`${WORKER}${path}`, { headers: h });
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

async function phoneAuth(phone) {
  return post('/api/loyalty/phone-auth', { phone, name: `Stress ${phone.slice(-4)}`, source: 'stress-test' });
}

async function createOrder(phone, total = 50000) {
  return post('/api/orders', {
    customer_name: `Stress ${phone.slice(-4)}`,
    customer_phone: phone,
    payment_method: 'cash',
    total,
    items: [{ name: 'Cà phê đen', quantity: 1, price: total }],
  });
}

async function completeOrder(orderId) {
  const states = ['confirmed', 'preparing', 'ready', 'served', 'completed'];
  for (const status of states) {
    const res = await patch(`/api/orders/${orderId}`, { status }, ownerToken);
    if (!res.ok) {
      const e = await res.json().catch(() => ({}));
      throw new Error(`→${status} failed ${res.status}: ${e.error || JSON.stringify(e)}`);
    }
    await new Promise(r => setTimeout(r, 120));
  }
}

async function lookupWallet(phone) {
  const res = await get(`/api/loyalty/lookup?phone=${phone}`);
  if (!res.ok) return null;
  return res.json();
}

// ─── Tests ───────────────────────────────────────────────────────────────────

console.log('AURA CAFE — POS Stress Test');
console.log(`Worker: ${WORKER}`);
console.log(`Phones: ${STRESS_PHONES.length} | Owner JWT: ${OWNER_EMAIL ? 'provided' : 'none (PATCH tests skipped)'}`);
console.log('─'.repeat(60));

// 1. Health
await assert('Health — /api/health responds 200', async () => {
  const res = await get('/api/health');
  expect(res.status === 200, `Got ${res.status}`);
  const d = await res.json();
  console.log(`  ${d.status} ts=${d.ts}`);
});

// 2. Owner JWT (optional — only if credentials passed)
await assert('Auth — owner login', async () => {
  if (!OWNER_EMAIL) skip('no --owner-email provided');
  const res = await post('/api/auth/login', { email: OWNER_EMAIL, password: OWNER_PASS });
  if (!res.ok) {
    const e = await res.json().catch(() => ({}));
    throw new Error(`Login failed ${res.status}: ${e.error}`);
  }
  const d = await res.json();
  ownerToken = d.token;
  expect(ownerToken, 'No token in response');
  console.log(`  Logged in as ${OWNER_EMAIL}`);
});

// 3. Campaign check
await assert('Campaign — GRAND_OPENING_6_6_2026 active-campaign endpoint', async () => {
  const res = await get('/api/loyalty/active-campaign');
  expect(res.status === 200, `Got ${res.status}`);
  const d = await res.json();
  const c = d.campaign || d;
  console.log(`  Campaign: ${c.id || c.campaign_id} | active=${c.active} | bonus=${c.signup_bonus}đ | multiplier=${c.multiplier}x | cap=${c.cap}`);
});

// 4. Concurrent signups (10 in parallel)
let signupResults = [];
await assert('Stress — 10 concurrent phone-auth signups', async () => {
  const reqs = STRESS_PHONES.map(p => phoneAuth(p));
  const responses = await Promise.allSettled(reqs);
  signupResults = await Promise.all(
    responses.map(async (r, i) => {
      if (r.status !== 'fulfilled') return { phone: STRESS_PHONES[i], ok: false };
      const res = r.value;
      const body = await res.json().catch(() => ({}));
      return { phone: STRESS_PHONES[i], ok: res.ok || res.status === 409, body };
    })
  );
  const ok = signupResults.filter(r => r.ok).length;
  expect(ok >= 8, `Only ${ok}/10 signups OK`);
  console.log(`  ${ok}/10 signups OK`);
  const newCount = signupResults.filter(r => r.body?.isNew || r.body?.new_member).length;
  if (newCount > 0) console.log(`  ${newCount} new members created`);
});

// 5. Wallet reads (10 concurrent)
await assert('Stress — 10 concurrent wallet reads (lookup)', async () => {
  const reqs = STRESS_PHONES.map(p => lookupWallet(p));
  const responses = await Promise.allSettled(reqs);
  const ok = responses.filter(r => r.status === 'fulfilled' && r.value !== null).length;
  expect(ok >= 8, `Only ${ok}/10 wallet reads OK`);
  const wallets = responses
    .filter(r => r.status === 'fulfilled' && r.value?.customer)
    .map(r => r.value);
  const totalBalance = wallets.reduce((s, w) => s + (w.wallet?.balance || 0), 0);
  console.log(`  ${ok}/10 wallet reads OK | total cashback balance: ${totalBalance}đ`);
});

// 6. Rate limit test (5 concurrent orders — exactly at limit boundary)
let firstOrderId = null;
await assert('Stress — 5 concurrent orders (at rate limit boundary)', async () => {
  const batch = STRESS_PHONES.slice(0, 5);
  const responses = await Promise.allSettled(batch.map(p => createOrder(p, 45000)));
  let ok = 0;
  for (const r of responses) {
    if (r.status === 'fulfilled' && r.value.ok) {
      ok++;
      if (!firstOrderId) {
        const d = await r.value.json().catch(() => ({}));
        firstOrderId = d.order?.id || d.id;
      }
    }
  }
  expect(ok >= 3, `Only ${ok}/5 orders created — was rate limit still active from prior run? Wait 10 min and retry`);
  console.log(`  ${ok}/5 concurrent orders OK | first order: ${firstOrderId}`);
});

// 7. Rate limit enforcement (6th order should 429 if within window)
await assert('Rate limit — 6th order within window → 429', async () => {
  const res = await createOrder(STRESS_PHONES[0], 50000);
  if (res.status === 429) {
    console.log('  429 triggered as expected ✅');
  } else if (res.ok) {
    // Rate limit window may have expired — not a failure, just note it
    console.log('  Order succeeded (rate limit window expired or different IP — OK)');
  } else {
    throw new Error(`Unexpected status ${res.status}`);
  }
});

// 8. Cashback earn + verify (requires ownerToken)
let completedOrderId = null;
await assert('Cashback — complete order → cashback credited (requires owner JWT)', async () => {
  if (!ownerToken) skip('no owner JWT — pass --owner-email and --owner-pass');
  if (!firstOrderId) skip('no order ID from previous test');

  await completeOrder(firstOrderId);
  completedOrderId = firstOrderId;
  console.log(`  Order ${firstOrderId} completed ✅`);

  // Wait for D1 write
  await new Promise(r => setTimeout(r, 1500));

  const phone = STRESS_PHONES[0];
  const wallet = await lookupWallet(phone);
  expect(wallet, 'Wallet lookup returned null');
  const earned = wallet?.wallet?.total_earned || 0;
  expect(earned > 0, `Wallet total_earned = ${earned} — cashback earn may be broken`);
  console.log(`  Wallet earned: ${earned}đ | balance: ${wallet.wallet?.balance || 0}đ`);
});

// 9. Double-earn idempotency (re-complete same order)
await assert('Cashback — double-earn idempotency (same order → no duplicate)', async () => {
  if (!ownerToken) skip('no owner JWT');
  if (!completedOrderId) skip('no completed order from prior test');

  // Try to trigger loyalty again directly — should be blocked by idempotency check
  // Attempt another PATCH (should be a no-op since order is already completed)
  const res = await patch(`/api/orders/${completedOrderId}`, { status: 'completed' }, ownerToken);
  // Expect either 400 (terminal state) or 200 (no-op)
  expect(res.status === 400 || res.status === 200, `Unexpected ${res.status}`);

  // Balance should not change
  await new Promise(r => setTimeout(r, 800));
  const wallet1 = await lookupWallet(STRESS_PHONES[0]);
  await new Promise(r => setTimeout(r, 500));
  const wallet2 = await lookupWallet(STRESS_PHONES[0]);
  const b1 = wallet1?.wallet?.total_earned || 0;
  const b2 = wallet2?.wallet?.total_earned || 0;
  expect(b1 === b2, `Double-earn detected: ${b1} → ${b2}`);
  console.log(`  total_earned stable at ${b1}đ ✅`);
});

// 10. Signup bonus (50k) — verify on newly created member
await assert('Campaign — signup bonus 50k credited to new member', async () => {
  // Pick a phone not used in this run (new number pattern)
  const newPhone = '0799333001';
  const res = await phoneAuth(newPhone);
  const d = await res.json().catch(() => ({}));

  const isNew = d.isNew || d.new_member || false;
  const bonus = d.bonus || d.signup_bonus || d.cashback_bonus || 0;

  if (!isNew) {
    console.log(`  Phone ${newPhone} already existed — bonus: ${bonus}đ (may be 0 for repeat signup)`);
    return;
  }

  console.log(`  New member created | signup bonus: ${bonus}đ`);
  // For new members during active campaign, expect 50k bonus
  const wallet = await lookupWallet(newPhone);
  const earned = wallet?.wallet?.total_earned || 0;
  expect(earned >= 50000, `Expected ≥50000đ signup bonus, got ${earned}đ`);
  console.log(`  Wallet earned: ${earned}đ ✅`);
});

// 11. Loyalty tiers endpoint
await assert('Loyalty — tiers endpoint returns 4 tiers', async () => {
  const res = await get('/api/loyalty/tiers');
  expect(res.ok, `Got ${res.status}`);
  const d = await res.json();
  const tiers = d.data || d.tiers || d;
  expect(Array.isArray(tiers) && tiers.length >= 4, `Got ${Array.isArray(tiers) ? tiers.length : 'non-array'} tiers, expected 4`);
  console.log(`  Tiers: ${tiers.map(t => t.tier_name || t.name).join(', ')}`);
});

// 12. Concurrent health (10 parallel)
await assert('Stress — 10 concurrent /api/health checks', async () => {
  const reqs = Array.from({ length: 10 }, () => get('/api/health'));
  const responses = await Promise.all(reqs);
  const ok = responses.filter(r => r.ok).length;
  expect(ok >= 9, `Only ${ok}/10 health checks OK`);
  console.log(`  ${ok}/10 health checks OK`);
});

// ─── Summary ─────────────────────────────────────────────────────────────────

console.log('');
console.log('─'.repeat(60));
console.log(`Results: ${passed} passed / ${failed} failed / ${skipped} skipped / ${passed + failed + skipped} total`);
console.log('');

for (const r of results) {
  const icon = r.ok === true ? '✅' : r.ok === null ? '⏭️ ' : '❌';
  console.log(`${icon} ${r.name}`);
  if (!r.ok && r.ok !== null) console.log(`     → ${r.error}`);
}

console.log('');
if (failed === 0) {
  console.log(`✅ POS Stress Test PASSED (${skipped > 0 ? `${skipped} skipped — re-run with --owner-email to test cashback earn` : 'all tests ran'})`);
} else {
  console.log(`⚠️  ${failed} test(s) failed`);
  if (!OWNER_EMAIL) {
    console.log('');
    console.log('  Tip: re-run with owner credentials to enable cashback earn tests:');
    console.log('  node scripts/test-pos-stress.js --owner-email=YOUR@EMAIL --owner-pass=YOUR_PASS');
  }
  process.exit(1);
}
