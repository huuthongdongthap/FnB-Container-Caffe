import { describe, it, expect } from 'vitest';
import { checkoutFormSchema, orderApiPayloadSchema, PAYMENT_METHODS } from '@/lib/validators';

describe('checkoutFormSchema', () => {
  it('passes with valid data', () => {
    const result = checkoutFormSchema.safeParse({
      fullName: 'Nguyễn Văn A',
      phone: '0912345678',
      address: '39 Nguyễn Tất Thành, Phường 1',
      paymentMethod: 'cod',
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.deliveryTime).toBe('now');
      expect(result.data.tip).toBe(0);
    }
  });

  it('fails when phone format is invalid', () => {
    const result = checkoutFormSchema.safeParse({
      fullName: 'Nguyễn Văn A',
      phone: '12345',
      address: '39 Nguyễn Tất Thành',
      paymentMethod: 'cod',
    });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues[0]?.path).toContain('phone');
    }
  });

  it('fails when address is too short', () => {
    const result = checkoutFormSchema.safeParse({
      fullName: 'Nguyễn Văn A',
      phone: '0912345678',
      address: 'Abc',
      paymentMethod: 'cod',
    });
    expect(result.success).toBe(false);
  });

  it('fails when fullName is empty', () => {
    const result = checkoutFormSchema.safeParse({
      fullName: '',
      phone: '0912345678',
      address: '39 Nguyễn Tất Thành',
      paymentMethod: 'cod',
    });
    expect(result.success).toBe(false);
  });

  it('accepts +84 phone format', () => {
    const result = checkoutFormSchema.safeParse({
      fullName: 'Nguyễn Văn A',
      phone: '+84912345678',
      address: '39 Nguyễn Tất Thành',
      paymentMethod: 'cod',
    });
    expect(result.success).toBe(true);
  });

  it('validates paymentMethod is cod or payos only', () => {
    const result = checkoutFormSchema.safeParse({
      fullName: 'Nguyễn Văn A',
      phone: '0912345678',
      address: '39 Nguyễn Tất Thành',
      paymentMethod: 'momo',
    });
    expect(result.success).toBe(false);

    const result2 = checkoutFormSchema.safeParse({
      fullName: 'Nguyễn Văn A',
      phone: '0912345678',
      address: '39 Nguyễn Tất Thành',
      paymentMethod: 'payos',
    });
    expect(result2.success).toBe(true);
  });

  it('validates optional email field', () => {
    const result = checkoutFormSchema.safeParse({
      fullName: 'Nguyễn Văn A',
      phone: '0912345678',
      address: '39 Nguyễn Tất Thành',
      paymentMethod: 'cod',
      email: 'invalid-email',
    });
    expect(result.success).toBe(false);

    const result2 = checkoutFormSchema.safeParse({
      fullName: 'Nguyễn Văn A',
      phone: '0912345678',
      address: '39 Nguyễn Tất Thành',
      paymentMethod: 'cod',
      email: 'test@example.com',
    });
    expect(result2.success).toBe(true);
  });

  it('validates tip is within range', () => {
    const result = checkoutFormSchema.safeParse({
      fullName: 'Nguyễn Văn A',
      phone: '0912345678',
      address: '39 Nguyễn Tất Thành',
      paymentMethod: 'cod',
      tip: 2000000,
    });
    expect(result.success).toBe(false);

    const result2 = checkoutFormSchema.safeParse({
      fullName: 'Nguyễn Văn A',
      phone: '0912345678',
      address: '39 Nguyễn Tất Thành',
      paymentMethod: 'cod',
      tip: 50000,
    });
    expect(result2.success).toBe(true);
  });
});

describe('PAYMENT_METHODS', () => {
  it('includes only cod and payos', () => {
    expect(PAYMENT_METHODS).toEqual(['cod', 'payos']);
    expect(PAYMENT_METHODS).not.toContain('momo');
    expect(PAYMENT_METHODS).not.toContain('vnpay');
  });
});

describe('orderApiPayloadSchema', () => {
  it('passes with valid order payload', () => {
    const result = orderApiPayloadSchema.safeParse({
      items: [{ id: '1', name: 'Coffee', price: 35000, quantity: 2 }],
      total: 70000,
      customer_name: 'Nguyễn Văn A',
      customer_phone: '0912345678',
      customer_address: '39 Nguyễn Tất Thành',
      payment_method: 'cod',
    });
    expect(result.success).toBe(true);
  });

  it('fails with empty items array', () => {
    const result = orderApiPayloadSchema.safeParse({
      items: [],
      total: 0,
      customer_name: 'Nguyễn Văn A',
      customer_phone: '0912345678',
      customer_address: '39 Nguyễn Tất Thành',
      payment_method: 'cod',
    });
    expect(result.success).toBe(false);
  });

  it('fails with invalid payment method', () => {
    const result = orderApiPayloadSchema.safeParse({
      items: [{ id: '1', name: 'Coffee', price: 35000, quantity: 2 }],
      total: 70000,
      customer_name: 'Nguyễn Văn A',
      customer_phone: '0912345678',
      customer_address: '39 Nguyễn Tất Thành',
      payment_method: 'momo',
    });
    expect(result.success).toBe(false);
  });
});
