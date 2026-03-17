/**
 * ═══════════════════════════════════════════════
 *  F&B CAFFE CONTAINER — Cloudflare Worker
 *  REST API with D1 Database + KV Auth
 * ═══════════════════════════════════════════════
 *
 * Routes:
 * - GET  /api/menu          - Get all menu items
 * - GET  /api/menu/:id      - Get single menu item
 * - GET  /api/menu/category/:category - Get items by category
 * - POST /api/orders        - Create new order
 * - GET  /api/orders/:id    - Get order by ID
 * - PATCH /api/orders/:id   - Update order status
 * - GET  /api/admin/orders  - List all orders (admin)
 * - POST /api/customers     - Create/Update customer
 * - GET  /api/payments/:order_id - Get payment by order
 *
 * Auth Routes (KV):
 * - POST /api/auth/register - Register new user
 * - POST /api/auth/login    - Login user
 * - POST /api/auth/logout   - Logout (invalidate token)
 * - GET  /api/auth/me       - Get current user info
 */

// CORS Headers helper
function corsHeaders(origin = '*') {
  return {
    'Access-Control-Allow-Origin': origin,
    'Access-Control-Allow-Methods': 'GET, POST, PUT, PATCH, DELETE, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Session-ID',
    'Access-Control-Max-Age': '86400',
  };
}

// JSON Response helper
function jsonResponse(data, status = 200, headers = {}) {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      'Content-Type': 'application/json',
      ...corsHeaders(),
      ...headers,
    },
  });
}

// Error Response helper
function errorResponse(message, status = 400, headers = {}) {
  return jsonResponse({ success: false, error: message }, status, headers);
}

// Generate unique ID
function generateId(prefix = '') {
  return `${prefix}${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
}

// Parse JSON body safely
async function parseJSON(request) {
  try {
    return await request.json();
  } catch (e) {
    throw new Error('Invalid JSON body');
  }
}

// ═══════════════════════════════════════════════
//  AUTH HELPERS (JWT + Password Hashing)
// ═══════════════════════════════════════════════

// Simple JWT-like token generation (for Worker environment)
async function generateJWT(payload, secret) {
  const encoder = new TextEncoder();
  const header = { alg: 'HS256', typ: 'JWT' };

  const headerBase64 = base64UrlEncode(JSON.stringify(header));
  const payloadBase64 = base64UrlEncode(JSON.stringify(payload));

  const signatureInput = `${headerBase64}.${payloadBase64}`;
  const key = await crypto.subtle.importKey(
    'raw',
    encoder.encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  );
  const signature = await crypto.subtle.sign('HMAC', key, encoder.encode(signatureInput));
  const signatureBase64 = base64UrlEncode(String.fromCharCode(...new Uint8Array(signature)));

  return `${signatureInput}.${signatureBase64}`;
}

// Verify JWT token
async function verifyJWT(token, secret) {
  try {
    const encoder = new TextEncoder();
    const parts = token.split('.');
    if (parts.length !== 3) return null;

    const [headerBase64, payloadBase64, signatureBase64] = parts;
    const signatureInput = `${headerBase64}.${payloadBase64}`;

    const key = await crypto.subtle.importKey(
      'raw',
      encoder.encode(secret),
      { name: 'HMAC', hash: 'SHA-256' },
      false,
      ['verify']
    );

    const signature = Uint8Array.from(atob(signatureBase64), c => c.charCodeAt(0));
    const isValid = await crypto.subtle.verify('HMAC', key, signature, encoder.encode(signatureInput));

    if (!isValid) return null;

    const payload = JSON.parse(atob(payloadBase64));

    // Check expiration
    if (payload.exp && payload.exp < Date.now() / 1000) {
      return null;
    }

    return payload;
  } catch (e) {
    return null;
  }
}

// Base64 URL encode
function base64UrlEncode(str) {
  return btoa(encodeURIComponent(str).replace(/%([0-9A-F]{2})/g, (_, p1) => String.fromCharCode(parseInt(p1, 16))))
    .replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, '');
}

// Hash password using SHA-256
async function hashPassword(password) {
  const encoder = new TextEncoder();
  const data = encoder.encode(password);
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
}

// Get auth token from request header
function getAuthToken(request) {
  const authHeader = request.headers.get('Authorization');
  if (authHeader && authHeader.startsWith('Bearer ')) {
    return authHeader.substring(7);
  }
  return null;
}

// ═══════════════════════════════════════════════
//  ROUTE HANDLERS
// ═══════════════════════════════════════════════

/**
 * GET /api/menu
 * Query params: category, available, search, limit, offset
 */
async function getMenu(request, env) {
  try {
    const url = new URL(request.url);
    const category = url.searchParams.get('category');
    const available = url.searchParams.get('available');
    const search = url.searchParams.get('search');
    const limit = url.searchParams.get('limit') || '50';
    const offset = url.searchParams.get('offset') || '0';

    let query = 'SELECT * FROM menu_items WHERE 1=1';
    const params = [];

    if (category) {
      query += ' AND category = ?';
      params.push(category);
    }

    if (available !== null) {
      query += ' AND available = ?';
      params.push(available === 'true' ? 1 : 0);
    }

    if (search) {
      query += ' AND (name LIKE ? OR description LIKE ?)';
      params.push(`%${search}%`, `%${search}%`);
    }

    query += ' ORDER BY category, name LIMIT ? OFFSET ?';
    params.push(parseInt(limit), parseInt(offset));

    const { results } = await env.FNB_DB.prepare(query).bind(...params).all();

    // Parse JSON fields
    const items = results.map(item => ({
      ...item,
      tags: item.tags ? JSON.parse(item.tags) : [],
      price: parseInt(item.price),
      available: Boolean(item.available),
    }));

    // Get total count
    const countQuery = 'SELECT COUNT(*) as total FROM menu_items WHERE 1=1' +
      (category ? ' AND category = ?' : '') +
      (available !== null ? ' AND available = ?' : '') +
      (search ? ' AND (name LIKE ? OR description LIKE ?)' : '');

    const countParams = [];
    if (category) countParams.push(category);
    if (available !== null) countParams.push(available === 'true' ? 1 : 0);
    if (search) countParams.push(`%${search}%`, `%${search}%`);

    const { results: countResult } = await env.FNB_DB.prepare(countQuery).bind(...countParams).all();
    const total = countResult[0]?.total || 0;

    return jsonResponse({
      success: true,
      items,
      pagination: {
        total: parseInt(total),
        limit: parseInt(limit),
        offset: parseInt(offset),
      },
    });
  } catch (error) {
    console.error('GetMenu error:', error);
    return errorResponse('Failed to fetch menu: ' + error.message, 500);
  }
}

/**
 * GET /api/menu/:id
 */
async function getMenuItem(request, env, id) {
  try {
    const { results } = await env.FNB_DB
      .prepare('SELECT * FROM menu_items WHERE id = ?')
      .bind(id)
      .all();

    if (!results || results.length === 0) {
      return errorResponse('Menu item not found', 404);
    }

    const item = {
      ...results[0],
      tags: results[0].tags ? JSON.parse(results[0].tags) : [],
      price: parseInt(results[0].price),
      available: Boolean(results[0].available),
    };

    return jsonResponse({ success: true, item });
  } catch (error) {
    console.error('GetMenuItem error:', error);
    return errorResponse('Failed to fetch menu item: ' + error.message, 500);
  }
}

/**
 * POST /api/orders
 * Body: items, total, customer_name, customer_phone, payment_method, etc.
 */
async function createOrder(request, env) {
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
    const stmt = env.FNB_DB.prepare(`
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
    await env.FNB_DB.prepare(`
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
      await env.FNB_DB.prepare(`
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

    return jsonResponse({
      success: true,
      order: {
        id: orderId,
        status: 'pending',
        payment_status: 'unpaid',
        created_at: new Date().toISOString(),
      },
      message: 'Order created successfully',
    }, 201);
  } catch (error) {
    console.error('CreateOrder error:', error);
    return errorResponse('Failed to create order: ' + error.message, 500);
  }
}

/**
 * GET /api/orders/:id
 */
async function getOrder(request, env, id) {
  try {
    const { results } = await env.FNB_DB
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
    const { results: paymentResults } = await env.FNB_DB
      .prepare('SELECT * FROM payments WHERE order_id = ?')
      .bind(id)
      .all();

    order.payment = paymentResults[0] || null;

    return jsonResponse({ success: true, order });
  } catch (error) {
    console.error('GetOrder error:', error);
    return errorResponse('Failed to fetch order: ' + error.message, 500);
  }
}

/**
 * PATCH /api/orders/:id
 * Body: status, payment_status, or other updatable fields
 */
async function updateOrder(request, env, id) {
  try {
    const body = await parseJSON(request);

    // Check if order exists
    const { results } = await env.FNB_DB
      .prepare('SELECT id FROM orders WHERE id = ?')
      .bind(id)
      .all();

    if (!results || results.length === 0) {
      return errorResponse('Order not found', 404);
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
    await env.FNB_DB.prepare(query).bind(...params).run();

    // Update payment status if provided
    if (body.payment_status) {
      await env.FNB_DB.prepare(`
        UPDATE payments SET status = ?, updated_at = CURRENT_TIMESTAMP
        WHERE order_id = ?
      `).bind(
        body.payment_status === 'paid' ? 'completed' : body.payment_status,
        id
      ).run();
    }

    return jsonResponse({
      success: true,
      message: 'Order updated successfully',
    });
  } catch (error) {
    console.error('UpdateOrder error:', error);
    return errorResponse('Failed to update order: ' + error.message, 500);
  }
}

/**
 * GET /api/admin/orders
 * Query params: status, payment_status, limit, offset, sort
 */
async function getAdminOrders(request, env) {
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

    const { results } = await env.FNB_DB.prepare(query).bind(...params).all();

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
    if (status) countParams.push(status);
    if (paymentStatus) countParams.push(paymentStatus);

    const { results: countResult } = await env.FNB_DB.prepare(countQuery).bind(...countParams).all();
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
    console.error('GetAdminOrders error:', error);
    return errorResponse('Failed to fetch orders: ' + error.message, 500);
  }
}

/**
 * GET /api/stats
 * Get dashboard statistics
 */
async function getStats(request, env) {
  try {
    // Today's stats
    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);

    // Total orders today
    const { results: ordersTodayResult } = await env.FNB_DB.prepare(`
      SELECT COUNT(*) as total, COALESCE(SUM(total), 0) as revenue
      FROM orders
      WHERE created_at >= ?
    `).bind(todayStart.toISOString()).all();

    // Orders by status
    const { results: statusResult } = await env.FNB_DB.prepare(`
      SELECT status, COUNT(*) as count
      FROM orders
      GROUP BY status
    `).all();

    // Top products (from order items)
    const { results: topProducts } = await env.FNB_DB.prepare(`
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
      } catch (e) {
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

    const { results: revenueResult } = await env.FNB_DB.prepare(`
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
    console.error('GetStats error:', error);
    return errorResponse('Failed to fetch stats: ' + error.message, 500);
  }
}

// ═══════════════════════════════════════════════
//  AUTH HANDLERS (KV Storage)
// ═══════════════════════════════════════════════

/**
 * POST /api/auth/register
 * Body: email, password, name, phone
 */
async function registerUser(request, env) {
  try {
    const body = await parseJSON(request);

    // Validate required fields
    const { email, password, name, phone } = body;
    if (!email || !password) {
      return errorResponse('Email và mật khẩu là bắt buộc', 400);
    }

    if (password.length < 6) {
      return errorResponse('Mật khẩu phải có ít nhất 6 ký tự', 400);
    }

    // Check if user exists
    const existingUser = await env.AUTH_KV.get(`user:${email}`);
    if (existingUser) {
      return errorResponse('Email đã được đăng ký', 409);
    }

    // Hash password
    const hashedPassword = await hashPassword(password);

    // Create user object
    const user = {
      id: generateId('USR_'),
      email,
      name: name || '',
      phone: phone || '',
      password: hashedPassword,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };

    // Save to KV
    await env.AUTH_KV.put(`user:${email}`, JSON.stringify(user));

    // Generate token
    const token = await generateJWT(
      { email, name: user.name, id: user.id },
      env.JWT_SECRET
    );

    // Save token to KV (for invalidation)
    await env.AUTH_KV.put(`token:${token}`, email, { expirationTtl: 86400 * 7 }); // 7 days

    return jsonResponse({
      success: true,
      user: { id: user.id, email: user.email, name: user.name, phone: user.phone },
      token,
      message: 'Đăng ký thành công',
    }, 201);
  } catch (error) {
    console.error('Register error:', error);
    return errorResponse('Đăng ký thất bại: ' + error.message, 500);
  }
}

/**
 * POST /api/auth/login
 * Body: email, password
 */
async function loginUser(request, env) {
  try {
    const body = await parseJSON(request);
    const { email, password } = body;

    if (!email || !password) {
      return errorResponse('Vui lòng nhập email và mật khẩu', 400);
    }

    // Get user from KV
    const userStr = await env.AUTH_KV.get(`user:${email}`);
    if (!userStr) {
      return errorResponse('Email hoặc mật khẩu không đúng', 401);
    }

    const user = JSON.parse(userStr);

    // Verify password
    const hashedPassword = await hashPassword(password);
    if (user.password !== hashedPassword) {
      return errorResponse('Email hoặc mật khẩu không đúng', 401);
    }

    // Generate token
    const token = await generateJWT(
      { email, name: user.name, id: user.id },
      env.JWT_SECRET
    );

    // Save token to KV
    await env.AUTH_KV.put(`token:${token}`, email, { expirationTtl: 86400 * 7 });

    // Update last login
    user.last_login = new Date().toISOString();
    user.updated_at = new Date().toISOString();
    await env.AUTH_KV.put(`user:${email}`, JSON.stringify(user));

    return jsonResponse({
      success: true,
      user: { id: user.id, email: user.email, name: user.name, phone: user.phone },
      token,
      message: 'Đăng nhập thành công',
    });
  } catch (error) {
    console.error('Login error:', error);
    return errorResponse('Đăng nhập thất bại: ' + error.message, 500);
  }
}

/**
 * POST /api/auth/logout
 * Header: Authorization: Bearer <token>
 */
async function logoutUser(request, env) {
  try {
    const token = getAuthToken(request);
    if (!token) {
      return errorResponse('Không tìm thấy token', 400);
    }

    // Delete token from KV (invalidate)
    await env.AUTH_KV.delete(`token:${token}`);

    return jsonResponse({
      success: true,
      message: 'Đăng xuất thành công',
    });
  } catch (error) {
    console.error('Logout error:', error);
    return errorResponse('Đăng xuất thất bại: ' + error.message, 500);
  }
}

/**
 * GET /api/auth/me
 * Header: Authorization: Bearer <token>
 */
async function getCurrentUser(request, env) {
  try {
    const token = getAuthToken(request);
    if (!token) {
      return errorResponse('Unauthorized', 401);
    }

    // Verify token
    const payload = await verifyJWT(token, env.JWT_SECRET);
    if (!payload) {
      return errorResponse('Token không hợp lệ hoặc đã hết hạn', 401);
    }

    // Check if token is invalidated
    const tokenEmail = await env.AUTH_KV.get(`token:${token}`);
    if (!tokenEmail) {
      return errorResponse('Token đã bị hủy', 401);
    }

    // Get user data
    const userStr = await env.AUTH_KV.get(`user:${payload.email}`);
    if (!userStr) {
      return errorResponse('User not found', 404);
    }

    const user = JSON.parse(userStr);

    return jsonResponse({
      success: true,
      user: { id: user.id, email: user.email, name: user.name, phone: user.phone },
    });
  } catch (error) {
    console.error('GetUser error:', error);
    return errorResponse('Lỗi server: ' + error.message, 500);
  }
}

// ═══════════════════════════════════════════════
//  MAIN REQUEST HANDLER
// ═══════════════════════════════════════════════

export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);
    const path = url.pathname;
    const method = request.method;

    // Handle CORS preflight
    if (method === 'OPTIONS') {
      return new Response(null, {
        status: 204,
        headers: corsHeaders(),
      });
    }

    try {
      // Route matching
      // GET /api/menu
      if (path === '/api/menu' && method === 'GET') {
        return getMenu(request, env);
      }

      // GET /api/menu/:id
      if (path.match(/^\/api\/menu\/[^/]+$/) && method === 'GET') {
        const id = path.split('/')[3];
        return getMenuItem(request, env, id);
      }

      // POST /api/orders
      if (path === '/api/orders' && method === 'POST') {
        return createOrder(request, env);
      }

      // GET /api/orders/:id
      if (path.match(/^\/api\/orders\/[^/]+$/) && method === 'GET') {
        const id = path.split('/')[3];
        return getOrder(request, env, id);
      }

      // PATCH /api/orders/:id
      if (path.match(/^\/api\/orders\/[^/]+$/) && method === 'PATCH') {
        const id = path.split('/')[3];
        return updateOrder(request, env, id);
      }

      // GET /api/admin/orders
      if (path === '/api/admin/orders' && method === 'GET') {
        return getAdminOrders(request, env);
      }

      // GET /api/stats
      if (path === '/api/stats' && method === 'GET') {
        return getStats(request, env);
      }

      // Auth Routes
      // POST /api/auth/register
      if (path === '/api/auth/register' && method === 'POST') {
        return registerUser(request, env);
      }

      // POST /api/auth/login
      if (path === '/api/auth/login' && method === 'POST') {
        return loginUser(request, env);
      }

      // POST /api/auth/logout
      if (path === '/api/auth/logout' && method === 'POST') {
        return logoutUser(request, env);
      }

      // GET /api/auth/me
      if (path === '/api/auth/me' && method === 'GET') {
        return getCurrentUser(request, env);
      }

      // 404 for unmatched routes
      return errorResponse('Not Found', 404);

    } catch (error) {
      console.error('Worker error:', error);
      return errorResponse('Internal Server Error: ' + error.message, 500);
    }
  },
};
