/**
 * Unit tests for Zod validation schemas.
 */

import { describe, it, expect } from 'vitest';
import { paymentMethodSchema, createOrderSchema, registerSchema, loginSchema, contactSchema, reservationSchema, phoneAuthSchema, menuQuerySchema, adminOrdersQuerySchema } from '../../lib/validators';

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
