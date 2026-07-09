import { describe, it, expect } from 'vitest';
import type { PlanRecord, SubscriptionRecord, InvoiceRecord, JwtPayload } from '../../../tree/subscriptions/types';

describe('subscriptions types', () => {
  describe('PlanRecord', () => {
    it('constructs a valid PlanRecord', () => {
      const plan: PlanRecord = {
        id: 'plan_1',
        name: 'Basic',
        slug: 'basic',
        description: '20ft container',
        container_size: '20ft',
        monthly_price_vnd: 500000,
        deposit_vnd: 0,
        features: '["wifi","pool"]',
        max_occupants: 2,
        is_popular: 1,
        is_active: 1,
        sort_order: 1,
        created_at: '2026-01-01',
        updated_at: '2026-01-01'
      };
      expect(plan.id).toBe('plan_1');
      expect(plan.monthly_price_vnd).toBe(500000);
      expect(typeof plan.features).toBe('string');
    });
  });

  describe('SubscriptionRecord', () => {
    it('constructs with all fields', () => {
      const sub: SubscriptionRecord = {
        id: 'sub_1',
        plan_id: 'plan_1',
        customer_id: 'cust_1',
        customer_name: 'Nguyen Van A',
        customer_email: 'a@example.com',
        customer_phone: '0909123456',
        container_number: 'CONT-001',
        zone: 'Sky Deck',
        status: 'active',
        billing_cycle: 'monthly',
        current_period_start: '2026-01-01',
        current_period_end: '2026-02-01',
        next_billing_date: '2026-02-01',
        amount_vnd: 500000,
        deposit_paid: 1,
        deposit_vnd: 100000,
        notes: '',
        created_at: '2026-01-01',
        updated_at: '2026-01-01',
        paused_at: null,
        cancelled_at: null,
        cancellation_reason: null
      };
      expect(sub.status).toBe('active');
      expect(sub.container_number).toBe('CONT-001');
      expect(sub.cancelled_at).toBeNull();
    });

    it('supports cancelled state', () => {
      const sub: SubscriptionRecord = {
        id: 'sub_cancelled',
        plan_id: 'plan_1',
        customer_id: null,
        customer_name: 'Test',
        customer_email: '',
        customer_phone: '',
        container_number: null,
        zone: 'Sky Deck',
        status: 'cancelled',
        billing_cycle: 'monthly',
        current_period_start: '2026-01-01',
        current_period_end: '2026-01-31',
        next_billing_date: '2026-01-31',
        amount_vnd: 500000,
        deposit_paid: 0,
        deposit_vnd: 0,
        notes: 'moved out',
        created_at: '2026-01-01',
        updated_at: '2026-02-01',
        paused_at: null,
        cancelled_at: '2026-02-01',
        cancellation_reason: 'moved out'
      };
      expect(sub.status).toBe('cancelled');
      expect(sub.cancellation_reason).toBe('moved out');
      expect(sub.cancelled_at).not.toBeNull();
    });
  });

  describe('InvoiceRecord', () => {
    it('constructs a valid InvoiceRecord', () => {
      const inv: InvoiceRecord = {
        id: 'inv_1',
        subscription_id: 'sub_1',
        amount_vnd: 500000,
        status: 'pending',
        period_start: '2026-01-01',
        period_end: '2026-02-01',
        invoice_number: 'INV-ABC123',
        payment_method: null,
        payment_ref: null,
        paid_at: null,
        created_at: '2026-01-01'
      };
      expect(inv.status).toBe('pending');
      expect(inv.invoice_number).toBe('INV-ABC123');
      expect(inv.paid_at).toBeNull();
    });
  });

  describe('JwtPayload', () => {
    it('constructs an owner payload', () => {
      const payload: JwtPayload = {
        id: 'user_1',
        role: 'owner',
        sub: 'user_1',
        customerId: undefined
      };
      expect(payload.role).toBe('owner');
      expect(payload.customerId).toBeUndefined();
    });

    it('constructs a vendor payload with customerId', () => {
      const payload: JwtPayload = {
        id: 'user_2',
        role: 'vendor',
        sub: 'user_2',
        customerId: 'cust_1'
      };
      expect(payload.role).toBe('vendor');
      expect(payload.customerId).toBe('cust_1');
    });
  });
});
