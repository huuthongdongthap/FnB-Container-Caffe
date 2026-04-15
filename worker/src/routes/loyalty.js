/**
 * Loyalty Routes — read-only + write operations
 *
 * READ-ONLY:
 *   GET /api/loyalty/member/:phone
 *   GET /api/loyalty/wallet/:memberId
 *   GET /api/loyalty/transactions/:memberId
 *   GET /api/loyalty/points/:memberId
 *   GET /api/loyalty/tiers
 *   GET /api/loyalty/rewards
 *
 * WRITE:
 *   POST /api/loyalty/register
 *   POST /api/loyalty/process-cashback
 *   POST /api/loyalty/spend-cashback
 *   POST /api/loyalty/redeem
 */

import { jsonResponse, errorResponse } from '../middleware/cors.js';

// ─── Utilities ───

function generateReferralCode() {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let code = 'AURA-';
  for (let i = 0; i < 4; i++) {
    code += chars[Math.floor(Math.random() * chars.length)];
  }
  code += '-';
  for (let i = 0; i < 3; i++) {
    code += chars[Math.floor(Math.random() * chars.length)];
  }
  return code;
}

function generateMemberId() {
  return 'LM-' + Date.now().toString(36) + '-' + Math.random().toString(36).substr(2, 5);
}

// ─── READ-ONLY Routes ───

/**
 * GET /api/loyalty/member/:phone
 */
export async function getMember(request, env, phone) {
  try {
    const { results } = await env.AURA_DB.prepare(
      'SELECT * FROM loyalty_members WHERE phone = ?'
    ).bind(phone).all();

    if (!results || results.length === 0) {
      return errorResponse('Member not found', 404);
    }

    const member = results[0];
    member.points_balance = parseInt(member.points_balance);
    member.total_points_earned = parseInt(member.total_points_earned);

    return jsonResponse({ success: true, member });
  } catch (error) {
    return errorResponse('Failed to fetch member: ' + error.message, 500);
  }
}

/**
 * GET /api/loyalty/wallet/:memberId — current points balance
 */
export async function getWallet(request, env, memberId) {
  try {
    const { results } = await env.AURA_DB.prepare(
      'SELECT id, customer_name, phone, tier, points_balance, total_points_earned FROM loyalty_members WHERE id = ?'
    ).bind(memberId).all();

    if (!results || results.length === 0) {
      return errorResponse('Member not found', 404);
    }

    const m = results[0];
    m.points_balance = parseInt(m.points_balance);
    m.total_points_earned = parseInt(m.total_points_earned);

    return jsonResponse({ success: true, wallet: m });
  } catch (error) {
    return errorResponse('Failed to fetch wallet: ' + error.message, 500);
  }
}

/**
 * GET /api/loyalty/transactions/:memberId?page=1&limit=20
 */
export async function getTransactions(request, env, memberId) {
  try {
    const url = new URL(request.url);
    const page = Math.max(1, parseInt(url.searchParams.get('page') || '1'));
    const limit = Math.min(100, Math.max(1, parseInt(url.searchParams.get('limit') || '20')));
    const offset = (page - 1) * limit;

    const { results } = await env.AURA_DB.prepare(
      'SELECT * FROM loyalty_transactions WHERE member_id = ? ORDER BY created_at DESC LIMIT ? OFFSET ?'
    ).bind(memberId, limit, offset).all();

    const { results: countResult } = await env.AURA_DB.prepare(
      'SELECT COUNT(*) as total FROM loyalty_transactions WHERE member_id = ?'
    ).bind(memberId).all();

    const total = countResult?.[0]?.total || 0;
    const items = (results || []).map(t => ({ ...t, points: parseInt(t.points) }));

    return jsonResponse({
      success: true,
      transactions: items,
      pagination: { total, page, limit, totalPages: Math.ceil(total / limit) || 0 },
    });
  } catch (error) {
    return errorResponse('Failed to fetch transactions: ' + error.message, 500);
  }
}

/**
 * GET /api/loyalty/points/:memberId — summary of earned vs spent
 */
export async function getPoints(request, env, memberId) {
  try {
    const { results: memberResults } = await env.AURA_DB.prepare(
      'SELECT points_balance, total_points_earned FROM loyalty_members WHERE id = ?'
    ).bind(memberId).all();

    if (!memberResults || memberResults.length === 0) {
      return errorResponse('Member not found', 404);
    }

    const m = memberResults[0];
    const balance = parseInt(m.points_balance);
    const earned = parseInt(m.total_points_earned);

    return jsonResponse({
      success: true,
      points: { balance, totalEarned: earned, totalSpent: earned - balance },
    });
  } catch (error) {
    return errorResponse('Failed to fetch points: ' + error.message, 500);
  }
}

/**
 * GET /api/loyalty/tiers — all tier definitions
 */
export async function getTiers(request, env) {
  try {
    const { results } = await env.AURA_DB.prepare(
      'SELECT * FROM loyalty_tiers ORDER BY min_points ASC'
    ).all();

    const tiers = (results || []).map(t => ({
      ...t,
      min_points: parseInt(t.min_points),
      cashback_percent: parseFloat(t.cashback_percent),
      benefits: t.benefits ? JSON.parse(t.benefits) : [],
    }));

    return jsonResponse({ success: true, tiers });
  } catch (error) {
    return errorResponse('Failed to fetch tiers: ' + error.message, 500);
  }
}

/**
 * GET /api/loyalty/rewards?category=&status=active&page=1&limit=20
 */
export async function getRewards(request, env) {
  try {
    const url = new URL(request.url);
    const category = url.searchParams.get('category');
    const status = url.searchParams.get('status') || 'active';
    const page = Math.max(1, parseInt(url.searchParams.get('page') || '1'));
    const limit = Math.min(100, Math.max(1, parseInt(url.searchParams.get('limit') || '20')));
    const offset = (page - 1) * limit;

    let query = 'SELECT * FROM loyalty_rewards WHERE 1=1';
    const params = [];

    if (category) { query += ' AND category = ?'; params.push(category); }
    if (status) { query += ' AND status = ?'; params.push(status); }

    query += ' ORDER BY points_cost ASC LIMIT ? OFFSET ?';
    params.push(limit, offset);

    const { results } = await env.AURA_DB.prepare(query).bind(...params).all();

    let countQuery = 'SELECT COUNT(*) as total FROM loyalty_rewards WHERE 1=1';
    const countParams = [];
    if (category) { countQuery += ' AND category = ?'; countParams.push(category); }
    if (status) { countQuery += ' AND status = ?'; countParams.push(status); }

    const { results: countResult } = await env.AURA_DB.prepare(countQuery).bind(...countParams).all();
    const total = countResult?.[0]?.total || 0;

    const items = (results || []).map(r => ({ ...r, points_cost: parseInt(r.points_cost), stock: parseInt(r.stock) }));

    return jsonResponse({
      success: true,
      rewards: items,
      pagination: { total, page, limit, totalPages: Math.ceil(total / limit) || 0 },
    });
  } catch (error) {
    return errorResponse('Failed to fetch rewards: ' + error.message, 500);
  }
}

// ─── WRITE Routes ───

/**
 * POST /api/loyalty/register
 * Body: { customer_name, phone, email?, referral_code? }
 */
export async function registerMember(request, env) {
  try {
    const body = await request.json();
    const { customer_name, phone, email, referral_code } = body;

    if (!customer_name || !customer_name.trim()) {
      return errorResponse('customer_name is required', 400);
    }
    if (!phone || !phone.trim()) {
      return errorResponse('phone is required', 400);
    }

    // Check duplicate phone
    const { results: existing } = await env.AURA_DB.prepare(
      'SELECT id FROM loyalty_members WHERE phone = ?'
    ).bind(phone.trim()).all();

    if (existing && existing.length > 0) {
      return errorResponse('Phone number already registered', 409);
    }

    const memberId = generateMemberId();
    const refCode = generateReferralCode();

    await env.AURA_DB.prepare(
      'INSERT INTO loyalty_members (id, customer_name, phone, email, tier, points_balance, total_points_earned, referral_code, referred_by) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)'
    ).bind(memberId, customer_name.trim(), phone.trim(), email?.trim() || null, 'bronze', 0, 0, refCode, referral_code || null).run();

    return jsonResponse({
      success: true,
      message: 'Đăng ký thành viên thành công',
      member: { id: memberId, customer_name: customer_name.trim(), phone: phone.trim(), tier: 'bronze', points_balance: 0, referral_code: refCode },
    }, 201);
  } catch (error) {
    return errorResponse('Failed to register member: ' + error.message, 500);
  }
}

/**
 * POST /api/loyalty/process-cashback
 * Body: { member_id, order_id, order_total }
 * Credits points based on member's tier cashback_percent
 */
export async function processCashback(request, env) {
  try {
    const body = await request.json();
    const { member_id, order_id, order_total } = body;

    if (!member_id || !order_id || !order_total) {
      return errorResponse('member_id, order_id, and order_total are required', 400);
    }

    // Get member's tier
    const { results: memberResults } = await env.AURA_DB.prepare(
      'SELECT id, tier, points_balance, total_points_earned FROM loyalty_members WHERE id = ?'
    ).bind(member_id).all();

    if (!memberResults || memberResults.length === 0) {
      return errorResponse('Member not found', 404);
    }

    const member = memberResults[0];

    // Get tier cashback percent
    const { results: tierResults } = await env.AURA_DB.prepare(
      'SELECT cashback_percent FROM loyalty_tiers WHERE name = ?'
    ).bind(member.tier).all();

    const cashbackPercent = tierResults?.[0]?.cashback_percent || 0;
    const pointsEarned = Math.floor((order_total * cashbackPercent) / 100);

    if (pointsEarned <= 0) {
      return jsonResponse({ success: true, message: 'No points earned for this tier', points_earned: 0 });
    }

    const newBalance = parseInt(member.points_balance) + pointsEarned;
    const newTotal = parseInt(member.total_points_earned) + pointsEarned;

    // Check tier upgrade
    const { results: newTierResults } = await env.AURA_DB.prepare(
      'SELECT name FROM loyalty_tiers WHERE min_points <= ? ORDER BY min_points DESC LIMIT 1'
    ).bind(newTotal).all();

    const newTier = newTierResults?.[0]?.name || member.tier;

    // Update member
    await env.AURA_DB.prepare(
      'UPDATE loyalty_members SET points_balance = ?, total_points_earned = ?, tier = ? WHERE id = ?'
    ).bind(newBalance, newTotal, newTier, member_id).run();

    // Record transaction
    await env.AURA_DB.prepare(
      'INSERT INTO loyalty_transactions (member_id, type, points, description, reference_id) VALUES (?, ?, ?, ?, ?)'
    ).bind(member_id, 'earn', pointsEarned, `Cashback ${cashbackPercent}% from order ${order_id}`, order_id).run();

    return jsonResponse({
      success: true,
      points_earned: pointsEarned,
      new_balance: newBalance,
      tier: newTier,
    });
  } catch (error) {
    return errorResponse('Failed to process cashback: ' + error.message, 500);
  }
}

/**
 * POST /api/loyalty/spend-cashback
 * Body: { member_id, order_id, order_total }
 * Deducts points equivalent to cashback usage (for display/logging)
 */
export async function spendCashback(request, env) {
  try {
    const body = await request.json();
    const { member_id, order_id, order_total } = body;

    if (!member_id || !order_id || !order_total) {
      return errorResponse('member_id, order_id, and order_total are required', 400);
    }

    const { results: memberResults } = await env.AURA_DB.prepare(
      'SELECT id, points_balance FROM loyalty_members WHERE id = ?'
    ).bind(member_id).all();

    if (!memberResults || memberResults.length === 0) {
      return errorResponse('Member not found', 404);
    }

    const balance = parseInt(memberResults[0].points_balance);
    const pointsUsed = Math.min(balance, Math.floor(order_total / 1000)); // 1 point = 1000 VND

    if (pointsUsed <= 0) {
      return jsonResponse({ success: true, message: 'No points to spend', points_used: 0, discount: 0 });
    }

    const newBalance = balance - pointsUsed;

    await env.AURA_DB.prepare(
      'UPDATE loyalty_members SET points_balance = ? WHERE id = ?'
    ).bind(newBalance, member_id).run();

    await env.AURA_DB.prepare(
      'INSERT INTO loyalty_transactions (member_id, type, points, description, reference_id) VALUES (?, ?, ?, ?, ?)'
    ).bind(member_id, 'spend', -pointsUsed, `Spent ${pointsUsed} points on order ${order_id}`, order_id).run();

    return jsonResponse({
      success: true,
      points_used: pointsUsed,
      discount: pointsUsed * 1000,
      new_balance: newBalance,
    });
  } catch (error) {
    return errorResponse('Failed to spend cashback: ' + error.message, 500);
  }
}

/**
 * POST /api/loyalty/redeem
 * Body: { member_id, reward_id }
 */
export async function redeemReward(request, env) {
  try {
    const body = await request.json();
    const { member_id, reward_id } = body;

    if (!member_id || !reward_id) {
      return errorResponse('member_id and reward_id are required', 400);
    }

    // Get member balance
    const { results: memberResults } = await env.AURA_DB.prepare(
      'SELECT id, points_balance, customer_name FROM loyalty_members WHERE id = ?'
    ).bind(member_id).all();

    if (!memberResults || memberResults.length === 0) {
      return errorResponse('Member not found', 404);
    }

    const balance = parseInt(memberResults[0].points_balance);

    // Get reward cost
    const { results: rewardResults } = await env.AURA_DB.prepare(
      'SELECT id, name, points_cost, stock FROM loyalty_rewards WHERE id = ? AND status = ?'
    ).bind(reward_id, 'active').all();

    if (!rewardResults || rewardResults.length === 0) {
      return errorResponse('Reward not found or inactive', 404);
    }

    const reward = rewardResults[0];
    const cost = parseInt(reward.points_cost);
    const stock = parseInt(reward.stock);

    if (balance < cost) {
      return errorResponse(`Insufficient points. Need ${cost}, have ${balance}`, 400);
    }
    if (stock !== -1 && stock <= 0) {
      return errorResponse('Reward out of stock', 400);
    }

    const newBalance = balance - cost;

    // Update member
    await env.AURA_DB.prepare(
      'UPDATE loyalty_members SET points_balance = ? WHERE id = ?'
    ).bind(newBalance, member_id).run();

    // Update stock
    if (stock !== -1) {
      await env.AURA_DB.prepare(
        'UPDATE loyalty_rewards SET stock = stock - 1 WHERE id = ?'
      ).bind(reward_id).run();
    }

    // Record transaction
    const redeemId = 'RD-' + Date.now();
    await env.AURA_DB.prepare(
      'INSERT INTO loyalty_transactions (member_id, type, points, description, reference_id) VALUES (?, ?, ?, ?, ?)'
    ).bind(member_id, 'redeem', -cost, `Redeemed: ${reward.name}`, redeemId).run();

    return jsonResponse({
      success: true,
      message: `Đã đổi thành công: ${reward.name}`,
      reward: { id: redeemId, name: reward.name, points_cost: cost },
      new_balance: newBalance,
    });
  } catch (error) {
    return errorResponse('Failed to redeem reward: ' + error.message, 500);
  }
}

// ─── Router Dispatcher ───

export const loyaltyRouter = {
  async fetch(request, env) {
    const url = new URL(request.url);
    const path = url.pathname;
    const method = request.method;
    const parts = path.split('/');
    // /api/loyalty/{action}/{param?}

    if (path === '/api/loyalty/tiers' && method === 'GET') {
      return getTiers(request, env);
    }
    if (path === '/api/loyalty/rewards' && method === 'GET') {
      return getRewards(request, env);
    }
    if (path === '/api/loyalty/register' && method === 'POST') {
      return registerMember(request, env);
    }
    if (path === '/api/loyalty/process-cashback' && method === 'POST') {
      return processCashback(request, env);
    }
    if (path === '/api/loyalty/spend-cashback' && method === 'POST') {
      return spendCashback(request, env);
    }
    if (path === '/api/loyalty/redeem' && method === 'POST') {
      return redeemReward(request, env);
    }
    // /api/loyalty/member/:phone
    if (parts[1] === 'api' && parts[2] === 'loyalty' && parts[3] === 'member' && parts[4] && method === 'GET') {
      return getMember(request, env, parts[4]);
    }
    // /api/loyalty/wallet/:memberId
    if (parts[1] === 'api' && parts[2] === 'loyalty' && parts[3] === 'wallet' && parts[4] && method === 'GET') {
      return getWallet(request, env, parts[4]);
    }
    // /api/loyalty/transactions/:memberId
    if (parts[1] === 'api' && parts[2] === 'loyalty' && parts[3] === 'transactions' && parts[4] && method === 'GET') {
      return getTransactions(request, env, parts[4]);
    }
    // /api/loyalty/points/:memberId
    if (parts[1] === 'api' && parts[2] === 'loyalty' && parts[3] === 'points' && parts[4] && method === 'GET') {
      return getPoints(request, env, parts[4]);
    }

    return errorResponse('Not Found', 404);
  },
};
