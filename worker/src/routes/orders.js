/* eslint-disable no-console */
/**
 * Orders Routes
 * API endpoints cho order operations
 */

import { jsonResponse, errorResponse } from '../middleware/cors.js';
import { processOrderLoyalty } from './loyalty.js';

// Debug logging configuration
const DEBUG = typeof AURA_DEBUG !== 'undefined' && AURA_DEBUG;

// KV key used as realtime flag for KDS polling
const KV_LATEST_KEY = 'latest_order_ts';

/**
 * Send Telegram notification to bếp/admin
 * Failure non-blocking — không throw, chỉ log
 */
async function notifyTelegram(env, order) {
  if (!env.TELEGRAM_BOT_TOKEN || !env.TELEGRAM_CHAT_ID) {
    if (DEBUG) {console.log('[Telegram] Skip — secrets missing');}
    return;
  }
  try {
    const items = (order.items || []).map(i =>
      `• ${i.name} x${i.qty || i.quantity || 1}`
    ).join('\n');
    const fmt = (n) => new Intl.NumberFormat('vi-VN').format(Math.round(n)) + '₫';
    const text = `🛎 *ĐƠN MỚI — AURA SPACE*\n` +
      `━━━━━━━━━━━━━━━━━━\n` +
      `📋 ${order.id}\n` +
      `👤 ${order.customer_name}\n` +
      `📞 ${order.customer_phone}\n` +
      (order.customer_address ? `📍 ${order.customer_address}\n` : '') +
      `━━━━━━━━━━━━━━━━━━\n` +
      `${items}\n` +
      `━━━━━━━━━━━━━━━━━━\n` +
      `💵 *${fmt(order.total)}*\n` +
      `💳 ${order.payment_method.toUpperCase()}\n` +
      (order.notes ? `📝 ${order.notes}\n` : '');
    const url = `https://api.telegram.org/bot${env.TELEGRAM_BOT_TOKEN}/sendMessage`;
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        chat_id: env.TELEGRAM_CHAT_ID,
        text,
        parse_mode: 'Markdown',
      }),
      signal: AbortSignal.timeout(5000),
    });
    if (!res.ok) {
      const err = await res.text();
      console.error('[Telegram] HTTP', res.status, err);
    }
  } catch (e) {
    console.error('[Telegram] Notify failed (non-blocking):', e.message);
  }
}

// Helper: Generate unique ID
function generateId(prefix = 'ID_') {
  return prefix + Date.now().toString(36) + Math.random().toString(36).substr(2, 5);
}

// Helper: Parse JSON body
async function parseJSON(request) {
  try {
    return await request.json();
  } catch {
    throw new Error('Invalid JSON body');
  }
}

/**
 * POST /api/orders
 * Body: items, total, customer_name, customer_phone, payment_method, etc.
 */
export async function createOrder(request, env, ctx) {
  try {
    const body = await parseJSON(request);

    // Validate required fields
    const required = ['items', 'total', 'customer_name', 'customer_phone', 'payment_method'];
    for (const field of required) {
      if (!body[field]) {
        return errorResponse(`Missing required field: ${field}`, 400);
      }
    }

    const orderId = generateId('ORD_');
    const itemsJson = JSON.stringify(body.items);

    // Insert order
    const stmt = env.AURA_DB.prepare(`
      INSERT INTO orders (
        id, items, total, status, customer_name, customer_phone,
        customer_email, customer_address, payment_method, payment_status,
        shipping_fee, discount, notes, delivery_time
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    await stmt.bind(
      orderId,
      itemsJson,
      parseInt(body.total),
      'pending',
      body.customer_name,
      body.customer_phone,
      body.customer_email || null,
      body.customer_address || null,
      body.payment_method,
      'unpaid',
      parseInt(body.shipping_fee) || 0,
      parseInt(body.discount) || 0,
      body.notes || null,
      body.delivery_time || 'now'
    ).run();

    // Create payment record
    const paymentId = generateId('PAY_');
    await env.AURA_DB.prepare(`
      INSERT INTO payments (id, order_id, method, amount, status)
      VALUES (?, ?, ?, ?, ?)
    `).bind(
      paymentId,
      orderId,
      body.payment_method,
      parseInt(body.total),
      'pending'
    ).run();

    // Update/create customer if email provided
    if (body.customer_email) {
      await env.AURA_DB.prepare(`
        INSERT INTO customers (id, email, name, phone, loyalty_points, loyalty_tier)
        VALUES (?, ?, ?, ?, 0, 'bronze')
        ON CONFLICT(email) DO UPDATE SET
          name = excluded.name,
          phone = excluded.phone,
          updated_at = CURRENT_TIMESTAMP
      `).bind(
        generateId('CUST_'),
        body.customer_email,
        body.customer_name,
        body.customer_phone
      ).run();
    }

    if (env.AUTH_KV) {
      await env.AUTH_KV.put('latest_order_ts', new Date().toISOString());
    }

    // Telegram notify — AWAIT để chắc chắn fire (max 5s latency, non-fatal nếu fail)
    // ctx.waitUntil không reliable trong mọi env — await trực tiếp deterministic hơn
    const telegramPromise = notifyTelegram(env, {
      id: orderId,
      items: body.items,
      total: body.total,
      customer_name: body.customer_name,
      customer_phone: body.customer_phone,
      customer_address: body.customer_address,
      payment_method: body.payment_method,
      notes: body.notes,
    }).catch(e => console.error('[Telegram] Async error:', e));
    if (ctx?.waitUntil) {
      ctx.waitUntil(telegramPromise);
    } else {
      await telegramPromise;
    }

    return jsonResponse({
      success: true,
      order: {
        id: orderId,
        status: 'pending',
        payment_status: 'unpaid',
        items: body.items,
        total: parseInt(body.total),
        customer: {
          full_name: body.customer_name,
          phone: body.customer_phone,
          address: body.customer_address || null
        },
        customer_name: body.customer_name,
        customer_phone: body.customer_phone,
        customer_address: body.customer_address || null,
        payment_method: body.payment_method,
        shipping_fee: parseInt(body.shipping_fee) || 0,
        discount: parseInt(body.discount) || 0,
        notes: body.notes || null,
        delivery_time: body.delivery_time || 'now',
        created_at: new Date().toISOString(),
      },
      message: 'Order created successfully',
    }, 201);
  } catch (error) {
    if (DEBUG) {console.error('CreateOrder error:', error);}
    return errorResponse('Failed to create order: ' + error.message, 500);
  }
}

/**
 * GET /api/orders/:id
 */
export async function getOrder(request, env, id) {
  try {
    const { results } = await env.AURA_DB
      .prepare('SELECT * FROM orders WHERE id = ?')
      .bind(id)
      .all();

    if (!results || results.length === 0) {
      return errorResponse('Order not found', 404);
    }

    const order = {
      ...results[0],
      items: JSON.parse(results[0].items),
      total: parseInt(results[0].total),
      shipping_fee: parseInt(results[0].shipping_fee),
      discount: parseInt(results[0].discount),
    };

    // Get payment info
    const { results: paymentResults } = await env.AURA_DB
      .prepare('SELECT * FROM payments WHERE order_id = ?')
      .bind(id)
      .all();

    order.payment = paymentResults[0] || null;

    return jsonResponse({ success: true, order });
  } catch (error) {
    if (DEBUG) {console.error('GetOrder error:', error);}
    return errorResponse('Failed to fetch order: ' + error.message, 500);
  }
}

/**
 * PATCH /api/orders/:id
 * Body: status, payment_status, or other updatable fields
 */
// Finite state machine for order status transitions
const ORDER_STATE_MACHINE = {
  pending:    ['confirmed', 'cancelled'],
  confirmed:  ['preparing', 'cancelled'],
  preparing:  ['ready', 'cancelled'],
  ready:      ['served', 'delivered', 'cancelled'],
  served:     ['completed'],
  delivered:  ['completed'],
  completed:  [],
  cancelled:  [],
};

export async function updateOrder(request, env, id) {
  try {
    const body = await parseJSON(request);

    // Check if order exists
    const { results } = await env.AURA_DB
      .prepare('SELECT id, status FROM orders WHERE id = ?')
      .bind(id)
      .all();

    if (!results || results.length === 0) {
      return errorResponse('Order not found', 404);
    }

    // Validate status transition
    if (body.status !== undefined) {
      const currentStatus = results[0].status;
      const allowed = ORDER_STATE_MACHINE[currentStatus] || [];
      if (!allowed.includes(body.status) && body.status !== currentStatus) {
        return errorResponse(
          `Invalid transition: ${currentStatus} → ${body.status}. Allowed: ${allowed.join(', ') || 'none (terminal)'}`,
          400
        );
      }
    }

    // Build dynamic update query
    const updatableFields = ['status', 'payment_status', 'notes', 'delivery_time'];
    const updates = [];
    const params = [];

    for (const field of updatableFields) {
      if (body[field] !== undefined) {
        updates.push(`${field} = ?`);
        params.push(body[field]);
      }
    }

    // Always update updated_at
    updates.push('updated_at = CURRENT_TIMESTAMP');

    if (updates.length === 1) {
      return errorResponse('No valid fields to update', 400);
    }

    params.push(id);

    const query = `UPDATE orders SET ${updates.join(', ')} WHERE id = ?`;
    await env.AURA_DB.prepare(query).bind(...params).run();

    // Update payment status if provided
    if (body.payment_status) {
      await env.AURA_DB.prepare(`
        UPDATE payments SET status = ?, updated_at = CURRENT_TIMESTAMP
        WHERE order_id = ?
      `).bind(
        body.payment_status === 'paid' ? 'completed' : body.payment_status,
        id
      ).run();
    }

    if (env.AUTH_KV) {
      await env.AUTH_KV.put('latest_order_ts', new Date().toISOString());
    }

    // Trigger auto-cashback + loyalty rewards when order is delivered/completed
    if (['delivered', 'completed'].includes(body.status)) {
      await triggerAutoCashback(id, env);
      const order = await env.AURA_DB.prepare('SELECT customer_email FROM orders WHERE id = ?').bind(id).first();
      if (order?.customer_email) {
        await processOrderLoyalty(env.AURA_DB, id, order.customer_email);
      }
    }

    return jsonResponse({
      success: true,
      message: 'Order updated successfully',
    });
  } catch (error) {
    if (DEBUG) {console.error('UpdateOrder error:', error);}
    return errorResponse('Failed to update order: ' + error.message, 500);
  }
}

/**
 * GET /api/orders/latest
 */
export async function getLatestOrderTimestamp(request, env) {
  try {
    const ts = env.AUTH_KV ? await env.AUTH_KV.get('latest_order_ts') : null;
    return jsonResponse({ success: true, ts });
  } catch (error) {
    return errorResponse('Failed to get latest timestamp: ' + error.message, 500);
  }
}

/**
 * GET /api/admin/orders
 * Query params: status, payment_status, limit, offset, sort
 */
export async function getAdminOrders(request, env) {
  try {
    const url = new URL(request.url);
    const status = url.searchParams.get('status');
    const paymentStatus = url.searchParams.get('payment_status');
    const limit = url.searchParams.get('limit') || '50';
    const offset = url.searchParams.get('offset') || '0';
    const sort = url.searchParams.get('sort') || 'created_at';

    let query = 'SELECT * FROM orders WHERE 1=1';
    const params = [];

    if (status) {
      query += ' AND status = ?';
      params.push(status);
    }

    if (paymentStatus) {
      query += ' AND payment_status = ?';
      params.push(paymentStatus);
    }

    // Validate sort field
    const validSorts = ['created_at', 'total', 'status'];
    const orderDirection = url.searchParams.get('order') === 'asc' ? 'ASC' : 'DESC';
    const sortBy = validSorts.includes(sort) ? sort : 'created_at';

    query += ` ORDER BY ${sortBy} ${orderDirection} LIMIT ? OFFSET ?`;
    params.push(parseInt(limit), parseInt(offset));

    const { results } = await env.AURA_DB.prepare(query).bind(...params).all();

    // Parse order data
    const orders = results.map(order => ({
      ...order,
      items: JSON.parse(order.items),
      total: parseInt(order.total),
      shipping_fee: parseInt(order.shipping_fee),
      discount: parseInt(order.discount),
    }));

    // Get total count
    const countQuery = 'SELECT COUNT(*) as total FROM orders WHERE 1=1' +
      (status ? ' AND status = ?' : '') +
      (paymentStatus ? ' AND payment_status = ?' : '');

    const countParams = [];
    if (status) {countParams.push(status);}
    if (paymentStatus) {countParams.push(paymentStatus);}

    const { results: countResult } = await env.AURA_DB.prepare(countQuery).bind(...countParams).all();
    const total = countResult[0]?.total || 0;

    return jsonResponse({
      success: true,
      orders,
      pagination: {
        total: parseInt(total),
        limit: parseInt(limit),
        offset: parseInt(offset),
      },
    });
  } catch (error) {
    if (DEBUG) {console.error('GetAdminOrders error:', error);}
    return errorResponse('Failed to fetch orders: ' + error.message, 500);
  }
}

/**
 * GET /api/stats
 * Get dashboard statistics
 */
export async function getStats(request, env) {
  try {
    // Today's stats
    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);

    // Total orders today
    const { results: ordersTodayResult } = await env.AURA_DB.prepare(`
      SELECT COUNT(*) as total, COALESCE(SUM(total), 0) as revenue
      FROM orders
      WHERE created_at >= ?
    `).bind(todayStart.toISOString()).all();

    // Orders by status
    const { results: statusResult } = await env.AURA_DB.prepare(`
      SELECT status, COUNT(*) as count
      FROM orders
      GROUP BY status
    `).all();

    // Top products (from order items)
    const { results: topProducts } = await env.AURA_DB.prepare(`
      SELECT items, COUNT(*) as order_count
      FROM orders
      WHERE status != 'cancelled'
      GROUP BY items
      ORDER BY order_count DESC
      LIMIT 10
    `).all();

    // Parse items and aggregate product counts
    const productStats = {};
    topProducts.forEach(row => {
      try {
        const items = JSON.parse(row.items);
        items.forEach(item => {
          const name = item.name || 'Unknown';
          if (!productStats[name]) {
            productStats[name] = 0;
          }
          productStats[name] += item.quantity || 1;
        });
      } catch {
        // Skip invalid JSON
      }
    });

    const topProductsList = Object.entries(productStats)
      .map(([name, quantity]) => ({ name, quantity }))
      .sort((a, b) => b.quantity - a.quantity)
      .slice(0, 6);

    // Revenue last 7 days
    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

    const { results: revenueResult } = await env.AURA_DB.prepare(`
      SELECT DATE(created_at) as date, COALESCE(SUM(total), 0) as revenue
      FROM orders
      WHERE created_at >= ? AND status != 'cancelled'
      GROUP BY DATE(created_at)
      ORDER BY date DESC
    `).bind(sevenDaysAgo.toISOString()).all();

    return jsonResponse({
      success: true,
      stats: {
        orders_today: ordersTodayResult[0]?.total || 0,
        revenue_today: ordersTodayResult[0]?.revenue || 0,
        orders_by_status: statusResult.reduce((acc, row) => {
          acc[row.status] = row.count;
          return acc;
        }, {}),
        top_products: topProductsList,
        revenue_7days: revenueResult.map(row => ({
          date: row.date,
          revenue: row.revenue,
        })),
      },
    });
  } catch (error) {
    if (DEBUG) {console.error('GetStats error:', error);}
    return errorResponse('Failed to fetch stats: ' + error.message, 500);
  }
}

/**
 * triggerAutoCashback — called when order status becomes 'delivered'
 * Looks up loyalty member by customer_phone, calculates points based on tier,
 * updates balance, and records transaction.
 */
async function triggerAutoCashback(orderId, env) {
  try {
    // Get order info
    const { results: orderResults } = await env.AURA_DB.prepare(
      'SELECT customer_phone, total FROM orders WHERE id = ?'
    ).bind(orderId).all();

    if (!orderResults || orderResults.length === 0) {return;}

    const { customer_phone, total } = orderResults[0];
    if (!customer_phone) {return;}

    // Lookup loyalty member by phone
    const { results: memberResults } = await env.AURA_DB.prepare(
      'SELECT id, tier, points_balance, total_points_earned FROM loyalty_members WHERE phone = ?'
    ).bind(customer_phone).all();

    if (!memberResults || memberResults.length === 0) {return;}

    const member = memberResults[0];

    // Check idempotency: skip if already has cashback for this order
    const { results: existingTx } = await env.AURA_DB.prepare(
      'SELECT id FROM loyalty_transactions WHERE member_id = ? AND type = ? AND reference_id = ?'
    ).bind(member.id, 'earn', orderId).all();

    if (existingTx && existingTx.length > 0) {return;}

    // Get tier cashback percent
    const { results: tierResults } = await env.AURA_DB.prepare(
      'SELECT cashback_percent FROM loyalty_tiers WHERE name = ?'
    ).bind(member.tier).all();

    const cashbackPercent = tierResults?.[0]?.cashback_percent || 0;
    const pointsEarned = Math.floor((total * cashbackPercent) / 100);

    if (pointsEarned <= 0) {return;}

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
    ).bind(newBalance, newTotal, newTier, member.id).run();

    // Record transaction
    await env.AURA_DB.prepare(
      'INSERT INTO loyalty_transactions (member_id, type, points, description, reference_id) VALUES (?, ?, ?, ?, ?)'
    ).bind(member.id, 'earn', pointsEarned, `Cashback ${cashbackPercent}% from order ${orderId}`, orderId).run();

    if (DEBUG) { console.log(`Auto-cashback: +${pointsEarned} pts for order ${orderId} (${cashbackPercent}%)`); }
  } catch (error) {
    if (DEBUG) { console.error('triggerAutoCashback error:', error); }
    // Non-fatal: don't block the order status update
  }
}
