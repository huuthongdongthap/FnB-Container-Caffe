/**
 * Unit tests for Zod validation schemas.
 */

import { describe, it, expect } from 'vitest';
import {
  paymentMethodSchema,
  createOrderSchema,
  registerSchema,
  loginSchema,
  contactSchema,
  reservationSchema,
  phoneAuthSchema,
  menuQuerySchema,
  adminOrdersQuerySchema,
  createProductSchema,
  updateProductSchema,
  createCategorySchema,
  updateCategorySchema,
  createPlanSchema,
  updatePlanSchema,
  createSubscriptionSchema,
  upgradeSubscriptionSchema,
  downgradeSubscriptionSchema,
  cancelSubscriptionSchema,
  pauseSubscriptionSchema,
  resumeSubscriptionSchema,
  clockInSchema,
  clockOutSchema,
  checkinSchema,
  updateOrderStatusSchema,
  createOrderInputSchema,
  validatePromotionSchema,
  redeemPromotionSchema,
  pretixWebhookBodySchema,
  pretixCheckinSchema,
  pretixGenerateSchema,
  updateTableStatusSchema,
  redeemBirthdaySchema,
  mixpostCreatePostSchema,
  mixpostGenerateSchema,
  createReviewSchema,
  payosWebhookSchema,
  erpnextLeadSchema,
  erpnextTagSchema,
  erpnextProductSyncSchema,
  erpnextSalesOrderSchema,
  erpnextPosWebhookSchema,
} from '../../lib/validators';

describe('paymentMethodSchema', () => {
  it('accepts cod and payos', () => {
    expect(paymentMethodSchema.parse('cod')).toBe('cod');
    expect(paymentMethodSchema.parse('payos')).toBe('payos');
  });

  it('rejects invalid values', () => {
    expect(() => paymentMethodSchema.parse('')).toThrow();
    expect(() => paymentMethodSchema.parse('card')).toThrow();
    expect(() => paymentMethodSchema.parse('zalopay')).toThrow();
  });
});

describe('registerSchema', () => {
  it('accepts valid registration', () => {
    const data = registerSchema.parse({ email: 'a@b.com', password: 'Abcdef1!' });
    expect(data.email).toBe('a@b.com');
  });

  it('rejects invalid email', () => {
    expect(() => registerSchema.parse({ email: 'not-email', password: 'Abcdef1!' })).toThrow();
  });

  it('rejects short password', () => {
    expect(() => registerSchema.parse({ email: 'a@b.com', password: 'Ab1!' })).toThrow();
  });
});

describe('loginSchema', () => {
  it('accepts valid login', () => {
    const data = loginSchema.parse({ email: 'a@b.com', password: 'anything' });
    expect(data.email).toBe('a@b.com');
  });

  it('rejects empty email', () => {
    expect(() => loginSchema.parse({ email: '', password: 'x' })).toThrow();
  });
});

describe('contactSchema', () => {
  it('accepts valid contact with VN phone', () => {
    const data = contactSchema.parse({ name: 'Test', phone: '0912345678', content: 'Hello' });
    expect(data.name).toBe('Test');
  });

  it('accepts international format phone', () => {
    const data = contactSchema.parse({ name: 'T', phone: '+84912345678', content: 'Hi' });
    expect(data.phone).toBe('+84912345678');
  });

  it('rejects invalid phone', () => {
    expect(() => contactSchema.parse({ name: 'T', phone: '123', content: 'Hi' })).toThrow();
  });

  it('rejects missing name', () => {
    expect(() => contactSchema.parse({ phone: '0912345678', content: 'Hi' })).toThrow();
  });
});

describe('createOrderSchema', () => {
  const validOrder = {
    items: [{ name: 'Coffee', qty: 2, price: 35000 }],
    total: 70000,
    customer_name: 'Test User',
    customer_phone: '0912345678',
    payment_method: 'cod',
  };

  it('accepts valid order', () => {
    const data = createOrderSchema.parse(validOrder);
    expect(data.items).toHaveLength(1);
    expect(data.payment_method).toBe('cod');
  });

  it('rejects empty items', () => {
    expect(() => createOrderSchema.parse({ ...validOrder, items: [] })).toThrow();
  });

  it('rejects invalid payment method', () => {
    expect(() => createOrderSchema.parse({ ...validOrder, payment_method: 'card' })).toThrow();
  });

  it('accepts optional fields', () => {
    const data = createOrderSchema.parse({ ...validOrder, customer_email: 'a@b.com', notes: 'Please hurry', shipping_fee: 10000 });
    expect(data.customer_email).toBe('a@b.com');
  });
});

describe('reservationSchema', () => {
  it('accepts valid reservation', () => {
    const data = reservationSchema.parse({ table_id: 'tbl_1', customer_name: 'Test', customer_phone: '0912345678', date: '2026-07-15', time: '18:00' });
    expect(data.date).toBe('2026-07-15');
  });

  it('rejects missing required field', () => {
    expect(() => reservationSchema.parse({ table_id: 'tbl_1', customer_name: 'Test' })).toThrow();
  });

  it('rejects invalid date format', () => {
    expect(() => reservationSchema.parse({ table_id: 'tbl_1', customer_name: 'Test', customer_phone: '0912345678', date: '15-07-2026', time: '18:00' })).toThrow();
  });
});

describe('phoneAuthSchema', () => {
  it('accepts valid VN phone', () => {
    expect(phoneAuthSchema.parse({ phone: '0912345678' }).phone).toBe('0912345678');
  });

  it('accepts +84 format', () => {
    expect(phoneAuthSchema.parse({ phone: '+84912345678' }).phone).toBe('+84912345678');
  });

  it('rejects short phone', () => {
    expect(() => phoneAuthSchema.parse({ phone: '123' })).toThrow();
  });
});

describe('menuQuerySchema', () => {
  it('accepts empty query', () => {
    const data = menuQuerySchema.parse({});
    expect(data.limit).toBeUndefined();
  });

  it('parses limit and offset as strings', () => {
    const data = menuQuerySchema.parse({ limit: '10', offset: '5' });
    expect(data.limit).toBe('10');
    expect(data.offset).toBe('5');
  });

  it('parses category filter', () => {
    const data = menuQuerySchema.parse({ category: 'coffee' });
    expect(data.category).toBe('coffee');
  });
});

describe('adminOrdersQuerySchema', () => {
  it('accepts status filter', () => {
    const data = adminOrdersQuerySchema.parse({ status: 'pending' });
    expect(data.status).toBe('pending');
  });

  it('accepts sort parameter', () => {
    const data = adminOrdersQuerySchema.parse({ sort: 'created_at', order: 'desc' });
    expect(data.sort).toBe('created_at');
    expect(data.order).toBe('desc');
  });
});

// ══════════════════════════════════════════════
// PRODUCTS
// ══════════════════════════════════════════════

describe('createProductSchema', () => {
  it('accepts valid product', () => {
    const data = createProductSchema.parse({ name: 'Coffee', price: 35000 });
    expect(data.name).toBe('Coffee');
    expect(data.price).toBe(35000);
  });

  it('accepts product with all optional fields', () => {
    const data = createProductSchema.parse({
      name: 'Cold Brew',
      price: 45000,
      slug: 'cold-brew',
      description: 'Refreshing cold brew coffee',
      compare_at_price: 50000,
      category_id: 'cat_1',
      image_url: 'https://example.com/img.jpg',
      is_available: true,
      sort_order: 1,
    });
    expect(data.slug).toBe('cold-brew');
    expect(data.sort_order).toBe(1);
  });

  it('accepts empty string for image_url', () => {
    const data = createProductSchema.parse({ name: 'Tea', price: 20000, image_url: '' });
    expect(data.image_url).toBe('');
  });

  it('rejects missing name', () => {
    expect(() => createProductSchema.parse({ price: 35000 })).toThrow();
  });

  it('rejects empty name', () => {
    expect(() => createProductSchema.parse({ name: '', price: 35000 })).toThrow();
  });

  it('rejects non-positive price', () => {
    expect(() => createProductSchema.parse({ name: 'Coffee', price: 0 })).toThrow();
  });

  it('rejects invalid image_url', () => {
    expect(() => createProductSchema.parse({ name: 'Coffee', price: 35000, image_url: 'not-a-url' })).toThrow();
  });

  it('rejects non-integer sort_order', () => {
    expect(() => createProductSchema.parse({ name: 'Coffee', price: 35000, sort_order: 1.5 })).toThrow();
  });
});

describe('updateProductSchema', () => {
  it('accepts empty update (all optional)', () => {
    const data = updateProductSchema.parse({});
    expect(Object.keys(data)).toHaveLength(0);
  });

  it('accepts partial update', () => {
    const data = updateProductSchema.parse({ name: 'Updated', price: 50000 });
    expect(data.name).toBe('Updated');
    expect(data.price).toBe(50000);
  });
});

// ══════════════════════════════════════════════
// CATEGORIES
// ══════════════════════════════════════════════

describe('createCategorySchema', () => {
  it('accepts valid category', () => {
    const data = createCategorySchema.parse({ name: 'Drinks' });
    expect(data.name).toBe('Drinks');
  });

  it('accepts category with all fields', () => {
    const data = createCategorySchema.parse({
      name: 'Food',
      slug: 'food',
      sort_order: 2,
      image_url: 'https://example.com/food.jpg',
    });
    expect(data.sort_order).toBe(2);
  });

  it('rejects missing name', () => {
    expect(() => createCategorySchema.parse({})).toThrow();
  });

  it('rejects invalid image_url', () => {
    expect(() => createCategorySchema.parse({ name: 'Test', image_url: 'bad' })).toThrow();
  });
});

describe('updateCategorySchema', () => {
  it('accepts empty update', () => {
    const data = updateCategorySchema.parse({});
    expect(Object.keys(data)).toHaveLength(0);
  });

  it('accepts partial update', () => {
    const data = updateCategorySchema.parse({ name: 'New Name' });
    expect(data.name).toBe('New Name');
  });
});

// ══════════════════════════════════════════════
// SUBSCRIPTIONS — plans
// ══════════════════════════════════════════════

describe('createPlanSchema', () => {
  it('accepts valid plan', () => {
    const data = createPlanSchema.parse({ name: 'Basic', price: 500000 });
    expect(data.name).toBe('Basic');
    expect(data.price).toBe(500000);
  });

  it('accepts plan with optional fields', () => {
    const data = createPlanSchema.parse({
      name: 'Premium',
      price: 1000000,
      billing_cycle: 'monthly',
      features: 'wifi, cleaning',
      description: 'Premium plan',
    });
    expect(data.billing_cycle).toBe('monthly');
    expect(data.features).toBe('wifi, cleaning');
  });

  it('rejects missing name', () => {
    expect(() => createPlanSchema.parse({ price: 500000 })).toThrow();
  });

  it('rejects negative price', () => {
    expect(() => createPlanSchema.parse({ name: 'Test', price: -100 })).toThrow();
  });
});

describe('updatePlanSchema', () => {
  it('accepts empty update', () => {
    const data = updatePlanSchema.parse({});
    expect(Object.keys(data)).toHaveLength(0);
  });

  it('accepts partial update', () => {
    const data = updatePlanSchema.parse({ name: 'Updated Plan' });
    expect(data.name).toBe('Updated Plan');
  });
});

// ══════════════════════════════════════════════
// SUBSCRIPTIONS — lifecycle
// ══════════════════════════════════════════════

describe('createSubscriptionSchema', () => {
  it('accepts valid subscription input', () => {
    const data = createSubscriptionSchema.parse({ plan_id: 'plan_1' });
    expect(data.plan_id).toBe('plan_1');
  });

  it('accepts with customer info', () => {
    const data = createSubscriptionSchema.parse({
      plan_id: 'plan_1',
      customer_name: 'Test',
      customer_email: 'test@example.com',
      customer_phone: '0912345678',
    });
    expect(data.customer_name).toBe('Test');
  });

  it('rejects missing plan_id', () => {
    expect(() => createSubscriptionSchema.parse({})).toThrow();
  });
});

describe('upgradeSubscriptionSchema', () => {
  it('accepts valid upgrade', () => {
    const data = upgradeSubscriptionSchema.parse({ new_plan_id: 'plan_2' });
    expect(data.new_plan_id).toBe('plan_2');
  });

  it('rejects missing new_plan_id', () => {
    expect(() => upgradeSubscriptionSchema.parse({})).toThrow();
  });
});

describe('downgradeSubscriptionSchema', () => {
  it('accepts valid downgrade', () => {
    const data = downgradeSubscriptionSchema.parse({ new_plan_id: 'plan_1' });
    expect(data.new_plan_id).toBe('plan_1');
  });

  it('rejects missing new_plan_id', () => {
    expect(() => downgradeSubscriptionSchema.parse({})).toThrow();
  });
});

describe('cancelSubscriptionSchema', () => {
  it('accepts cancel with reason', () => {
    const data = cancelSubscriptionSchema.parse({ reason: 'Too expensive' });
    expect(data.reason).toBe('Too expensive');
  });

  it('accepts cancel without reason', () => {
    const data = cancelSubscriptionSchema.parse({});
    expect(data.reason).toBeUndefined();
  });
});

describe('pauseSubscriptionSchema', () => {
  it('accepts pause with date', () => {
    const data = pauseSubscriptionSchema.parse({ until_date: '2026-08-01' });
    expect(data.until_date).toBe('2026-08-01');
  });

  it('accepts pause without date', () => {
    const data = pauseSubscriptionSchema.parse({});
    expect(data.until_date).toBeUndefined();
  });
});

describe('resumeSubscriptionSchema', () => {
  it('accepts empty resume body', () => {
    const data = resumeSubscriptionSchema.parse({});
    expect(Object.keys(data)).toHaveLength(0);
  });
});

// ══════════════════════════════════════════════
// SHIFTS
// ══════════════════════════════════════════════

describe('clockInSchema', () => {
  it('accepts valid clock-in', () => {
    const data = clockInSchema.parse({ staff_id: 'staff_1' });
    expect(data.staff_id).toBe('staff_1');
  });

  it('accepts clock-in with optional fields', () => {
    const data = clockInSchema.parse({ staff_id: 'staff_1', staff_name: 'John', notes: 'Late by 5 min' });
    expect(data.staff_name).toBe('John');
  });

  it('rejects missing staff_id', () => {
    expect(() => clockInSchema.parse({})).toThrow();
  });

  it('rejects empty staff_id', () => {
    expect(() => clockInSchema.parse({ staff_id: '' })).toThrow();
  });
});

describe('clockOutSchema', () => {
  it('accepts valid clock-out', () => {
    const data = clockOutSchema.parse({ staff_id: 'staff_1' });
    expect(data.staff_id).toBe('staff_1');
  });

  it('rejects missing staff_id', () => {
    expect(() => clockOutSchema.parse({})).toThrow();
  });
});

// ══════════════════════════════════════════════
// CHECKIN
// ══════════════════════════════════════════════

describe('checkinSchema', () => {
  it('accepts valid checkin', () => {
    const data = checkinSchema.parse({ customer_id: 'cust_1' });
    expect(data.customer_id).toBe('cust_1');
  });

  it('accepts checkin with customer_name', () => {
    const data = checkinSchema.parse({ customer_id: 'cust_1', customer_name: 'Alice' });
    expect(data.customer_name).toBe('Alice');
  });

  it('rejects missing customer_id', () => {
    expect(() => checkinSchema.parse({})).toThrow();
  });
});

// ══════════════════════════════════════════════
// ORDERS-HONO
// ══════════════════════════════════════════════

describe('updateOrderStatusSchema', () => {
  it('accepts valid status', () => {
    const data = updateOrderStatusSchema.parse({ status: 'pending' });
    expect(data.status).toBe('pending');
  });

  it('accepts preparing status', () => {
    const data = updateOrderStatusSchema.parse({ status: 'preparing' });
    expect(data.status).toBe('preparing');
  });

  it('accepts ready status', () => {
    const data = updateOrderStatusSchema.parse({ status: 'ready' });
    expect(data.status).toBe('ready');
  });

  it('accepts served status', () => {
    const data = updateOrderStatusSchema.parse({ status: 'served' });
    expect(data.status).toBe('served');
  });

  it('accepts cancelled status', () => {
    const data = updateOrderStatusSchema.parse({ status: 'cancelled' });
    expect(data.status).toBe('cancelled');
  });

  it('rejects invalid status', () => {
    expect(() => updateOrderStatusSchema.parse({ status: 'invalid' })).toThrow();
  });

  it('rejects unknown status values', () => {
    expect(() => updateOrderStatusSchema.parse({ status: 'delivered' })).toThrow();
  });

  it('rejects missing status', () => {
    expect(() => updateOrderStatusSchema.parse({})).toThrow();
  });
});

describe('createOrderInputSchema', () => {
  const validItems = [{ product_id: 'p1', quantity: 2, price: 35000 }];

  it('accepts valid order input', () => {
    const data = createOrderInputSchema.parse({ items: validItems });
    expect(data.items).toHaveLength(1);
  });

  it('accepts order input with optional fields', () => {
    const data = createOrderInputSchema.parse({
      items: validItems,
      customer_name: 'Test',
      customer_phone: '0912345678',
      notes: 'Please hurry',
    });
    expect(data.customer_name).toBe('Test');
  });

  it('rejects empty items', () => {
    expect(() => createOrderInputSchema.parse({ items: [] })).toThrow();
  });

  it('rejects missing items', () => {
    expect(() => createOrderInputSchema.parse({})).toThrow();
  });

  it('rejects non-positive quantity', () => {
    expect(() => createOrderInputSchema.parse({ items: [{ product_id: 'p1', quantity: 0, price: 35000 }] })).toThrow();
  });

  it('rejects non-positive price', () => {
    expect(() => createOrderInputSchema.parse({ items: [{ product_id: 'p1', quantity: 1, price: 0 }] })).toThrow();
  });
});

// ══════════════════════════════════════════════
// PROMOTIONS
// ══════════════════════════════════════════════

describe('validatePromotionSchema', () => {
  it('accepts valid request', () => {
    const data = validatePromotionSchema.parse({ code: 'SAVE10' });
    expect(data.code).toBe('SAVE10');
  });

  it('accepts with order_total', () => {
    const data = validatePromotionSchema.parse({ code: 'SAVE10', order_total: 100000 });
    expect(data.order_total).toBe(100000);
  });

  it('rejects missing code', () => {
    expect(() => validatePromotionSchema.parse({})).toThrow();
  });

  it('rejects empty code', () => {
    expect(() => validatePromotionSchema.parse({ code: '' })).toThrow();
  });
});

describe('redeemPromotionSchema', () => {
  it('accepts valid redeem request', () => {
    const data = redeemPromotionSchema.parse({ code: 'SAVE10', order_id: 'ORD_1', order_total: 100000 });
    expect(data.code).toBe('SAVE10');
    expect(data.order_id).toBe('ORD_1');
  });

  it('rejects missing code', () => {
    expect(() => redeemPromotionSchema.parse({ order_id: 'ORD_1', order_total: 100000 })).toThrow();
  });

  it('rejects missing order_id', () => {
    expect(() => redeemPromotionSchema.parse({ code: 'SAVE10', order_total: 100000 })).toThrow();
  });

  it('rejects missing order_total', () => {
    expect(() => redeemPromotionSchema.parse({ code: 'SAVE10', order_id: 'ORD_1' })).toThrow();
  });
});

// ══════════════════════════════════════════════
// PRETIX
// ══════════════════════════════════════════════

describe('pretixWebhookBodySchema', () => {
  it('accepts valid webhook body', () => {
    const data = pretixWebhookBodySchema.parse({
      organizer: 'myorg',
      event: 'myevent',
      code: 'ABC123',
      action: 'order.paid',
    });
    expect(data.organizer).toBe('myorg');
    expect(data.code).toBe('ABC123');
  });

  it('accepts with notification_id', () => {
    const data = pretixWebhookBodySchema.parse({
      notification_id: 42,
      organizer: 'myorg',
      event: 'myevent',
      code: 'ABC123',
      action: 'order.paid',
    });
    expect(data.notification_id).toBe(42);
  });

  it('rejects missing organizer', () => {
    expect(() => pretixWebhookBodySchema.parse({ event: 'e', code: 'c', action: 'a' })).toThrow();
  });

  it('rejects empty code', () => {
    expect(() => pretixWebhookBodySchema.parse({ organizer: 'o', event: 'e', code: '', action: 'a' })).toThrow();
  });
});

describe('pretixCheckinSchema', () => {
  it('accepts valid checkin', () => {
    const data = pretixCheckinSchema.parse({ secret: 'ticket_secret_123' });
    expect(data.secret).toBe('ticket_secret_123');
  });

  it('accepts with optional fields', () => {
    const data = pretixCheckinSchema.parse({ secret: 'secret', event: 'myevent', listId: 1 });
    expect(data.event).toBe('myevent');
    expect(data.listId).toBe(1);
  });

  it('rejects missing secret', () => {
    expect(() => pretixCheckinSchema.parse({})).toThrow();
  });
});

describe('pretixGenerateSchema', () => {
  it('accepts valid generate request', () => {
    const data = pretixGenerateSchema.parse({ source: 'event', slug: 'my-event' });
    expect(data.source).toBe('event');
    expect(data.slug).toBe('my-event');
  });

  it('rejects non-event source', () => {
    expect(() => pretixGenerateSchema.parse({ source: 'promotion', slug: 'test' })).toThrow();
  });

  it('rejects missing slug', () => {
    expect(() => pretixGenerateSchema.parse({ source: 'event', slug: '' })).toThrow();
  });
});

// ══════════════════════════════════════════════
// TABLES
// ══════════════════════════════════════════════

describe('updateTableStatusSchema', () => {
  it('accepts Available status', () => {
    const data = updateTableStatusSchema.parse({ status: 'Available' });
    expect(data.status).toBe('Available');
  });

  it('accepts Occupied status', () => {
    const data = updateTableStatusSchema.parse({ status: 'Occupied' });
    expect(data.status).toBe('Occupied');
  });

  it('accepts Reserved status', () => {
    const data = updateTableStatusSchema.parse({ status: 'Reserved' });
    expect(data.status).toBe('Reserved');
  });

  it('accepts Overdue status', () => {
    const data = updateTableStatusSchema.parse({ status: 'Overdue' });
    expect(data.status).toBe('Overdue');
  });

  it('rejects invalid status', () => {
    expect(() => updateTableStatusSchema.parse({ status: 'Invalid' })).toThrow();
  });

  it('rejects missing status', () => {
    expect(() => updateTableStatusSchema.parse({})).toThrow();
  });
});

// ══════════════════════════════════════════════
// BIRTHDAY
// ══════════════════════════════════════════════

describe('redeemBirthdaySchema', () => {
  it('accepts valid redeem', () => {
    const data = redeemBirthdaySchema.parse({ customer_id: 'cust_1' });
    expect(data.customer_id).toBe('cust_1');
  });

  it('accepts with order_id', () => {
    const data = redeemBirthdaySchema.parse({ customer_id: 'cust_1', order_id: 'ORD_1' });
    expect(data.order_id).toBe('ORD_1');
  });

  it('rejects missing customer_id', () => {
    expect(() => redeemBirthdaySchema.parse({})).toThrow();
  });
});

// ══════════════════════════════════════════════
// MIXPOST
// ══════════════════════════════════════════════

describe('mixpostCreatePostSchema', () => {
  it('accepts valid post', () => {
    const data = mixpostCreatePostSchema.parse({ content: 'Hello world', accounts: [1, 2] });
    expect(data.content).toBe('Hello world');
    expect(data.accounts).toEqual([1, 2]);
  });

  it('accepts with optional fields', () => {
    const data = mixpostCreatePostSchema.parse({
      content: 'Hello',
      accounts: [1],
      media_urls: ['https://example.com/img.jpg'],
      scheduled_at: '2026-07-15T10:00:00Z',
    });
    expect(data.media_urls).toHaveLength(1);
  });

  it('rejects missing content', () => {
    expect(() => mixpostCreatePostSchema.parse({ accounts: [1] })).toThrow();
  });

  it('rejects empty accounts', () => {
    expect(() => mixpostCreatePostSchema.parse({ content: 'Hello', accounts: [] })).toThrow();
  });

  it('rejects invalid media URLs', () => {
    expect(() =>
      mixpostCreatePostSchema.parse({ content: 'Hello', accounts: [1], media_urls: ['not-a-url'] })
    ).toThrow();
  });
});

describe('mixpostGenerateSchema', () => {
  it('accepts promotion source', () => {
    const data = mixpostGenerateSchema.parse({ source: 'promotion', id: 'SAVE10' });
    expect(data.source).toBe('promotion');
    expect(data.id).toBe('SAVE10');
  });

  it('accepts menu source with category', () => {
    const data = mixpostGenerateSchema.parse({ source: 'menu', category: 1 });
    expect(data.source).toBe('menu');
    expect(data.category).toBe(1);
  });

  it('rejects unknown source', () => {
    expect(() => mixpostGenerateSchema.parse({ source: 'unknown' })).toThrow();
  });

  it('rejects missing source', () => {
    expect(() => mixpostGenerateSchema.parse({})).toThrow();
  });
});

// ══════════════════════════════════════════════
// REVIEWS
// ══════════════════════════════════════════════

describe('createReviewSchema', () => {
  it('accepts valid review', () => {
    const data = createReviewSchema.parse({ order_id: 'ORD_1', rating: 5 });
    expect(data.order_id).toBe('ORD_1');
    expect(data.rating).toBe(5);
  });

  it('accepts review with optional fields', () => {
    const data = createReviewSchema.parse({
      order_id: 'ORD_1',
      rating: 4,
      comment: 'Great!',
      customer_name: 'Alice',
    });
    expect(data.comment).toBe('Great!');
  });

  it('rejects missing order_id', () => {
    expect(() => createReviewSchema.parse({ rating: 5 })).toThrow();
  });

  it('rejects missing rating', () => {
    expect(() => createReviewSchema.parse({ order_id: 'ORD_1' })).toThrow();
  });

  it('rejects rating below 1', () => {
    expect(() => createReviewSchema.parse({ order_id: 'ORD_1', rating: 0 })).toThrow();
  });

  it('rejects rating above 5', () => {
    expect(() => createReviewSchema.parse({ order_id: 'ORD_1', rating: 6 })).toThrow();
  });

  it('rejects non-integer rating', () => {
    expect(() => createReviewSchema.parse({ order_id: 'ORD_1', rating: 3.5 })).toThrow();
  });
});

// ══════════════════════════════════════════════
// WEBHOOKS — PayOS
// ══════════════════════════════════════════════

describe('payosWebhookSchema', () => {
  it('accepts valid payos webhook', () => {
    const data = payosWebhookSchema.parse({
      success: true,
      data: { orderCode: 12345, amount: 100000, description: 'Order payment', extraField: 'ignored' },
    });
    expect(data.success).toBe(true);
    expect(data.data.orderCode).toBe(12345);
  });

  it('rejects missing success', () => {
    expect(() =>
      payosWebhookSchema.parse({ data: { orderCode: 1, amount: 100, description: 'test' } })
    ).toThrow();
  });

  it('rejects missing data', () => {
    expect(() => payosWebhookSchema.parse({ success: true })).toThrow();
  });
});

// ══════════════════════════════════════════════
// ERPNEXT
// ══════════════════════════════════════════════

describe('erpnextLeadSchema', () => {
  it('accepts complete lead data', () => {
    const data = erpnextLeadSchema.parse({
      id: '1',
      name: 'Test',
      full_name: 'Test User',
      email: 'test@example.com',
      phone: '0912345678',
      phone_number: '+84912345678',
      consent_marketing: true,
      consent_erpnext_sync: true,
    });
    expect(data.name).toBe('Test');
  });

  it('accepts empty lead data', () => {
    const data = erpnextLeadSchema.parse({});
    expect(Object.keys(data)).toHaveLength(0);
  });
});

describe('erpnextTagSchema', () => {
  it('accepts valid tag', () => {
    const data = erpnextTagSchema.parse({ tag: 'VIP' });
    expect(data.tag).toBe('VIP');
  });

  it('rejects missing tag', () => {
    expect(() => erpnextTagSchema.parse({})).toThrow();
  });

  it('rejects empty tag', () => {
    expect(() => erpnextTagSchema.parse({ tag: '' })).toThrow();
  });
});

describe('erpnextProductSyncSchema', () => {
  it('accepts with product_ids', () => {
    const data = erpnextProductSyncSchema.parse({ product_ids: ['p1', 'p2'] });
    expect(data.product_ids).toEqual(['p1', 'p2']);
  });

  it('accepts without product_ids', () => {
    const data = erpnextProductSyncSchema.parse({});
    expect(data.product_ids).toBeUndefined();
  });
});

// ══════════════════════════════════════════════
// ERPNEXT POS
// ══════════════════════════════════════════════

describe('erpnextSalesOrderSchema', () => {
  const validItems = [{ item_code: 'COFFEE-001', qty: 2, rate: 35000 }];

  it('accepts valid sales order', () => {
    const data = erpnextSalesOrderSchema.parse({ items: validItems });
    expect(data.items).toHaveLength(1);
  });

  it('accepts with optional customer fields', () => {
    const data = erpnextSalesOrderSchema.parse({
      customer_name: 'Test',
      customer_phone: '0912345678',
      items: validItems,
      table_id: 'tbl_1',
      notes: 'Extra sugar',
    });
    expect(data.customer_name).toBe('Test');
  });

  it('rejects empty items', () => {
    expect(() => erpnextSalesOrderSchema.parse({ items: [] })).toThrow();
  });

  it('rejects missing items', () => {
    expect(() => erpnextSalesOrderSchema.parse({})).toThrow();
  });

  it('rejects non-positive qty', () => {
    expect(() =>
      erpnextSalesOrderSchema.parse({ items: [{ item_code: 'X', qty: 0, rate: 100 }] })
    ).toThrow();
  });
});

describe('erpnextPosWebhookSchema', () => {
  it('accepts valid webhook payload', () => {
    const data = erpnextPosWebhookSchema.parse({
      doctype: 'Sales Invoice',
      docname: 'SINV-001',
      action: 'submit',
    });
    expect(data.doctype).toBe('Sales Invoice');
  });

  it('accepts empty webhook payload', () => {
    const data = erpnextPosWebhookSchema.parse({});
    expect(Object.keys(data)).toHaveLength(0);
  });

  it('accepts passthrough fields', () => {
    const data = erpnextPosWebhookSchema.parse({ custom_field: 'value', another: 42 });
    expect(data.custom_field).toBe('value');
    expect(data.another).toBe(42);
  });
});
