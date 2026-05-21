#!/usr/bin/env node
// scripts/test-local-bugs.js
// Verification script for the 2 loyalty / referral bugs

import { execSync } from 'child_process';
import dns from 'dns';

// Force node to use ipv4 for localhost
dns.setDefaultResultOrder('ipv4first');

const BASE_URL = 'http://127.0.0.1:8787';

async function delay(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function completeOrderFsm(orderId, ownerToken) {
  const steps = ['confirmed', 'preparing', 'ready', 'delivered', 'completed'];
  let lastStatus = 0;
  for (const step of steps) {
    const res = await fetch(`${BASE_URL}/api/orders/${orderId}`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${ownerToken}`
      },
      body: JSON.stringify({ status: step })
    });
    lastStatus = res.status;
    if (res.status !== 200) {
      const txt = await res.text();
      console.error(`Failed step ${step} for ${orderId}:`, res.status, txt);
      break;
    }
  }
  return lastStatus;
}

function runSql(command) {
  try {
    const output = execSync(
      `npx wrangler d1 execute fnb-caffe-db --local --config worker/wrangler.toml --command="${command.replace(/"/g, '\\"')}"`,
      { encoding: 'utf-8', stdio: 'pipe' }
    );
    return JSON.parse(output.substring(output.indexOf('[')));
  } catch (err) {
    console.error('SQL Execution failed:', err.message);
    throw err;
  }
}

async function test() {
  console.log('=== Starting Loyalty and Referral Verification ===');

  // 1. Clean up SQLite database for test users
  console.log('Cleaning up SQLite test data...');
  runSql("DELETE FROM referrals WHERE referrer_id IN (SELECT id FROM customers WHERE phone IN ('0700111222', '0700333444')) OR referred_customer_id IN (SELECT id FROM customers WHERE phone IN ('0700111222', '0700333444'));");
  runSql("DELETE FROM referral_codes WHERE customer_id IN (SELECT id FROM customers WHERE phone IN ('0700111222', '0700333444'));");
  runSql("DELETE FROM cashback_transactions WHERE customer_id IN (SELECT id FROM customers WHERE phone IN ('0700111222', '0700333444'));");
  runSql("DELETE FROM cashback_wallets WHERE customer_id IN (SELECT id FROM customers WHERE phone IN ('0700111222', '0700333444'));");
  runSql("DELETE FROM loyalty_point_logs WHERE customer_id IN (SELECT id FROM customers WHERE phone IN ('0700111222', '0700333444'));");
  runSql("DELETE FROM user_rewards WHERE customer_id IN (SELECT id FROM customers WHERE phone IN ('0700111222', '0700333444'));");
  runSql("DELETE FROM orders WHERE customer_phone IN ('0700111222', '0700333444');");
  runSql("DELETE FROM customers WHERE phone IN ('0700111222', '0700333444');");

  // 2. Bootstrap the Owner
  console.log('Bootstrapping owner account...');
  let ownerToken = '';
  try {
    const bootRes = await fetch(`${BASE_URL}/api/auth/bootstrap-owner`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: 'testowner@aura.space',
        password: 'password123',
        name: 'Test Owner'
      })
    });
    const bootData = await bootRes.json();
    if (bootRes.ok || bootRes.status === 409) {
      // If 409, try login
      const loginRes = await fetch(`${BASE_URL}/api/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: 'testowner@aura.space',
          password: 'password123'
        })
      });
      const loginData = await loginRes.json();
      ownerToken = loginData.token;
    } else {
      throw new Error(`Bootstrap failed: ${JSON.stringify(bootData)}`);
    }
  } catch (err) {
    console.error('Owner bootstrap failed:', err.message);
    process.exit(1);
  }
  console.log('Owner authenticated successfully!');

  // 3. Register Referrer (Customer A)
  console.log('Registering Customer A (Referrer)...');
  const resA = await fetch(`${BASE_URL}/api/loyalty/phone-auth`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ phone: '0700111222', name: 'Customer A' })
  });
  const dataA = await resA.json();
  const tokenA = dataA.token;
  const custIdA = dataA.customer.id;
  console.log(`Customer A registered. ID: ${custIdA}`);

  // Get referral code for Customer A
  const codeRes = await fetch(`${BASE_URL}/api/loyalty/referral/code`, {
    headers: { 'Authorization': `Bearer ${tokenA}` }
  });
  const codeData = await codeRes.json();
  const refCodeA = codeData.data.code;
  console.log(`Customer A Referral Code: ${refCodeA}`);

  // 4. Register Referee (Customer B)
  console.log('Registering Customer B (Referee)...');
  const resB = await fetch(`${BASE_URL}/api/loyalty/phone-auth`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ phone: '0700333444', name: 'Customer B' })
  });
  const dataB = await resB.json();
  const tokenB = dataB.token;
  const custIdB = dataB.customer.id;
  console.log(`Customer B registered. ID: ${custIdB}`);

  // Customer B applies Customer A's referral code
  console.log(`Customer B applying Referral Code ${refCodeA}...`);
  const applyRes = await fetch(`${BASE_URL}/api/loyalty/referral/apply`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${tokenB}`
    },
    body: JSON.stringify({ code: refCodeA })
  });
  const applyData = await applyRes.json();
  console.log('Referral applied:', applyData);

  // 5. Test Bug 1: Order value under 30k should NOT reward referral points
  console.log('Creating small order (20k VND) for Customer B...');
  const orderRes1 = await fetch(`${BASE_URL}/api/orders`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      items: [{ id: 'p004', name: 'Cà Phê Sữa Đá', price: 20000, quantity: 1 }],
      total: 20000,
      customer_name: 'Customer B',
      customer_phone: '0700333444',
      customer_email: 'customerb@loyalty.aura',
      payment_method: 'cash'
    })
  });
  const orderData1 = await orderRes1.json();
  const orderId1 = orderData1.order?.id || orderData1.data?.id || orderData1.id;
  console.log(`Order 1 created. ID: ${orderId1}`);

  // Deliver the small order
  console.log('Completing Order 1 (20k)...');
  const patchRes1Code = await completeOrderFsm(orderId1, ownerToken);
  console.log('Order 1 status patch code:', patchRes1Code);

  // Check Referrer A's points: should still be 0
  const checkA1 = runSql(`SELECT loyalty_points, lifetime_points, loyalty_tier FROM customers WHERE id = '${custIdA}'`)[0].results[0];
  console.log('Referrer A points after 20k order:', checkA1);
  if (checkA1.loyalty_points !== 0 || checkA1.lifetime_points !== 0) {
    console.error('❌ BUG 1 FAIL: Referrer received points for order < 30k VND!');
    process.exit(1);
  }
  console.log('✓ Verified: Order < 30k VND did not trigger referral points.');

  // 6. Test Bug 1: Order value >= 30k should reward exactly 100 referral points
  console.log('Creating qualifying order (45k VND) for Customer B...');
  const orderRes2 = await fetch(`${BASE_URL}/api/orders`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      items: [{ id: 'p002', name: 'Cappuccino', price: 45000, quantity: 1 }],
      total: 45000,
      customer_name: 'Customer B',
      customer_phone: '0700333444',
      customer_email: 'customerb@loyalty.aura',
      payment_method: 'cash'
    })
  });
  const orderData2 = await orderRes2.json();
  const orderId2 = orderData2.order?.id || orderData2.data?.id || orderData2.id;
  console.log(`Order 2 created. ID: ${orderId2}`);

  // Complete the qualifying order
  console.log('Completing Order 2 (45k)...');
  const patchRes2Code = await completeOrderFsm(orderId2, ownerToken);
  console.log('Order 2 status patch code:', patchRes2Code);

  // Check Referrer A's points: should be 100 loyalty_points and 100 lifetime_points, and tier upgraded to 'silver' (since min_points for silver is 50, but gold is 500)
  const checkA2 = runSql(`SELECT loyalty_points, lifetime_points, loyalty_tier FROM customers WHERE id = '${custIdA}'`)[0].results[0];
  console.log('Referrer A points after 45k order:', checkA2);
  if (checkA2.loyalty_points !== 100 || checkA2.lifetime_points !== 100 || checkA2.loyalty_tier !== 'silver') {
    console.error('❌ BUG 1 & 2 FAIL: Referrer points/tier after first order processing incorrect!');
    process.exit(1);
  }
  console.log('✓ Verified: Referrer successfully rewarded 100 points and upgraded to Silver tier on first purchase of friend.');

  // 7. Test Bug 2: Tier Downgrade Prevention
  // We will manually add more points to Customer A via ordering, or directly via DB to get to Gold.
  // Let's directly add 250 points to Customer A (both loyalty and lifetime) via SQL to simulate spend that reaches Gold tier (min 200 points).
  console.log('Simulating spend to reach Gold tier...');
  runSql(`UPDATE customers SET loyalty_points = 350, lifetime_points = 350, loyalty_tier = 'gold' WHERE id = '${custIdA}'`);

  // Verify Customer A is Gold
  const checkA3 = runSql(`SELECT loyalty_points, lifetime_points, loyalty_tier FROM customers WHERE id = '${custIdA}'`)[0].results[0];
  console.log('Referrer A tier after simulated spend:', checkA3);
  if (checkA3.loyalty_tier !== 'gold') {
    console.error('❌ Set tier failed!');
    process.exit(1);
  }

  // Redeem a reward of 100 points
  console.log('Customer A redeeming 100-point voucher...');
  const redeemRes = await fetch(`${BASE_URL}/api/loyalty/redeem`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${tokenA}`
    },
    body: JSON.stringify({ reward_id: 'reward_001' }) // cost: 100 points
  });
  const redeemData = await redeemRes.json();
  console.log('Redeem result:', redeemData);

  // Cost is 100 points. Loyalty points should be 350 - 100 = 250. Lifetime points should STILL be 350!
  // Let's check if the tier remains 'gold' even though loyalty points might decrease, and let's check values.
  const checkA4 = runSql(`SELECT loyalty_points, lifetime_points, loyalty_tier FROM customers WHERE id = '${custIdA}'`)[0].results[0];
  console.log('Referrer A points after redemption:', checkA4);
  if (checkA4.loyalty_points !== 250) {
    console.error(`❌ Redeem points not deducted properly! Expected 250, got ${checkA4.loyalty_points}`);
    process.exit(1);
  }
  if (checkA4.lifetime_points !== 350) {
    console.error(`❌ Lifetime points should not change on redemption! Expected 350, got ${checkA4.lifetime_points}`);
    process.exit(1);
  }
  if (checkA4.loyalty_tier !== 'gold') {
    console.error('❌ BUG 2 FAIL: Customer tier downgraded upon points redemption!');
    process.exit(1);
  }
  console.log('✓ Verified: Redeeming rewards does NOT reduce lifetime_points or trigger tier downgrades.');

  // Let's perform another order to see if tier checks remain anchored to lifetime_points
  console.log('Customer A making another purchase (60k VND)...');
  const orderRes3 = await fetch(`${BASE_URL}/api/orders`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      items: [{ id: 'p003', name: 'Latte Art', price: 60000, quantity: 1 }],
      total: 60000,
      customer_name: 'Customer A',
      customer_phone: '0700111222',
      customer_email: 'customera@loyalty.aura',
      payment_method: 'cash'
    })
  });
  const orderData3 = await orderRes3.json();
  const orderId3 = orderData3.order?.id || orderData3.data?.id || orderData3.id;

  // Complete Customer A's new order
  console.log('Completing Customer A order (60k)...');
  await completeOrderFsm(orderId3, ownerToken);

  // If tier was based on loyalty_points (259), it would downgrade to 'silver' because 259 is below Gold... wait, it's above 200.
  // What if loyalty_points was 150 (after redemptions), which is below 200?
  // Let's manually deduct more points via SQL to have loyalty_points = 150, keeping lifetime_points = 359, and then place an order!
  console.log('Artificially reducing spendable loyalty_points to 150 (below Gold threshold of 200)...');
  runSql(`UPDATE customers SET loyalty_points = 150 WHERE id = '${custIdA}'`);

  console.log('Customer A making another purchase (60k VND) while loyalty_points is below Gold threshold...');
  const orderRes4 = await fetch(`${BASE_URL}/api/orders`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      items: [{ id: 'p003', name: 'Latte Art', price: 60000, quantity: 1 }],
      total: 60000,
      customer_name: 'Customer A',
      customer_phone: '0700111222',
      customer_email: 'customera@loyalty.aura',
      payment_method: 'cash'
    })
  });
  const orderData4 = await orderRes4.json();
  const orderId4 = orderData4.order?.id || orderData4.data?.id || orderData4.id;

  console.log('Completing Customer A order 4...');
  await completeOrderFsm(orderId4, ownerToken);

  // If tier was based on loyalty_points (150 + 9 = 159), it would downgrade to 'silver' because 159 < 200.
  // But since it is based on lifetime_points (359 + 9 = 368), it must remain 'gold'!
  const checkA5 = runSql(`SELECT loyalty_points, lifetime_points, loyalty_tier FROM customers WHERE id = '${custIdA}'`)[0].results[0];
  console.log('Referrer A points after order 4 with low loyalty_points:', checkA5);
  if (checkA5.loyalty_tier !== 'gold') {
    console.error('❌ BUG 2 FAIL: Customer tier downgraded to Silver during purchase because spendable points were low!');
    process.exit(1);
  }
  console.log('✓ Verified: Tier calculations during purchase are correctly based on lifetime_points, preventing downgrade!');

  console.log('\n🎉 ALL VERIFICATIONS PASSED SUCCESSFULLY! Both bugs are verified as completely fixed!');
  process.exit(0);
}

test().catch(err => {
  console.error('Unexpected test error:', err);
  process.exit(1);
});
