import { describe, it, expect } from 'vitest';
import { TEMPLATE_IDS, buildTemplateData } from '../../../tree/zalo/zns-templates.js';
import type { ZnsData } from '../../../tree/zalo/types.js';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeData(overrides?: Partial<ZnsData>): ZnsData {
  return {
    name: 'Nguyen Van A',
    member_id: 'M001',
    balance: 150000,
    qr_url: 'https://example.com/qr',
    amount: 50000,
    order_id: 'ORD-abc123',
    status: 'paid',
    new_tier: 'GOLD',
    new_tier_vi: 'Vàng',
    new_rate: 0.08,
    days: 5,
    ...overrides
  };
}

// ---------------------------------------------------------------------------
// TEMPLATE_IDS
// ---------------------------------------------------------------------------

describe('TEMPLATE_IDS', () => {
  it('contains all five expected template keys', () => {
    expect(TEMPLATE_IDS).toHaveProperty('welcome_signup');
    expect(TEMPLATE_IDS).toHaveProperty('cashback_earned');
    expect(TEMPLATE_IDS).toHaveProperty('tier_upgrade');
    expect(TEMPLATE_IDS).toHaveProperty('cashback_expiry_warning');
    expect(TEMPLATE_IDS).toHaveProperty('general_promotion');
  });

  it('unconfigured templates have YOUR_ prefix', () => {
    const unconfigured = Object.values(TEMPLATE_IDS).filter((id) => id.startsWith('YOUR_'));
    expect(unconfigured.length).toBeGreaterThan(0);
  });

  it('all values are non-empty strings', () => {
    for (const [key, value] of Object.entries(TEMPLATE_IDS)) {
      expect(typeof value).toBe('string');
      expect(value.length).toBeGreaterThan(0);
    }
  });
});

// ---------------------------------------------------------------------------
// buildTemplateData — per-template cases
// ---------------------------------------------------------------------------

describe('buildTemplateData', () => {
  // --- welcome_signup ---

  describe('welcome_signup', () => {
    it('maps all fields with defaults', () => {
      const result = buildTemplateData('welcome_signup', makeData());
      expect(result).toEqual({
        customer_name: 'Nguyen Van A',
        member_id: 'M001',
        balance: '150.000đ',
        qr_url: 'https://example.com/qr'
      });
    });

    it('falls back name to empty string when missing', () => {
      const result = buildTemplateData('welcome_signup', {});
      expect(result.customer_name).toBe('');
    });

    it('falls back member_id to empty string when missing', () => {
      const result = buildTemplateData('welcome_signup', { name: 'Test' });
      expect(result.member_id).toBe('');
    });

    it('formats balance with vi-VN locale and appends dong symbol', () => {
      const result = buildTemplateData('welcome_signup', { name: 'X', balance: 1000 });
      expect(result.balance).toBe('1.000đ');
    });

    it('handles zero balance', () => {
      const result = buildTemplateData('welcome_signup', { name: 'X', balance: 0 });
      expect(result.balance).toBe('0đ');
    });

    it('falls back qr_url to default signup page when missing', () => {
      const result = buildTemplateData('welcome_signup', {});
      expect(result.qr_url).toBe('https://fnb-caffe-container.pages.dev/dang-ky-thanh-vien');
    });
  });

  // --- cashback_earned ---

  describe('cashback_earned', () => {
    it('maps all fields with defaults', () => {
      const result = buildTemplateData('cashback_earned', makeData());
      // order_id: 'AC' + slice(0,8).toUpperCase()
      expect(result).toEqual({
        customer_name: 'Nguyen Van A',
        amount_earned: '50.000đ',
        new_balance: '150.000đ',
        order_id: 'ACORD-ABC1'
      });
    });

    it('formats amount_earned with vi-VN locale', () => {
      const result = buildTemplateData('cashback_earned', { name: 'X', amount: 2500, balance: 0 });
      expect(result.amount_earned).toBe('2.500đ');
    });

    it('upcases and truncates order_id to 8 chars', () => {
      const result = buildTemplateData('cashback_earned', { name: 'X', order_id: 'a1b2c3d4e5f6' });
      expect(result.order_id).toBe('ACA1B2C3D4');
    });

    it('upcases a short order_id with AC prefix', () => {
      const result = buildTemplateData('cashback_earned', { name: 'X', order_id: 'ord' });
      expect(result.order_id).toBe('ACORD');
    });

    it('falls back missing order_id to empty AC prefix', () => {
      const result = buildTemplateData('cashback_earned', { name: 'X' });
      expect(result.order_id).toBe('AC');
    });

    it('falls back amount to 0 when missing', () => {
      const result = buildTemplateData('cashback_earned', { name: 'X' });
      expect(result.amount_earned).toBe('0đ');
    });
  });

  // --- tier_upgrade ---

  describe('tier_upgrade', () => {
    it('prefers new_tier_vi over new_tier', () => {
      const result = buildTemplateData('tier_upgrade', makeData());
      expect(result.new_tier).toBe('Vàng');
    });

    it('falls back to new_tier when new_tier_vi is missing', () => {
      const result = buildTemplateData('tier_upgrade', { name: 'X', new_tier: 'PLATINUM', new_rate: 0.1 });
      expect(result.new_tier).toBe('PLATINUM');
    });

    it('formats new_rate as percentage string', () => {
      const result = buildTemplateData('tier_upgrade', makeData());
      expect(result.cashback_rate).toBe('8%');
    });

    it('handles 100% rate', () => {
      const result = buildTemplateData('tier_upgrade', { name: 'X', new_rate: 1 });
      expect(result.cashback_rate).toBe('100%');
    });

    it('falls back new_rate to 0 when missing', () => {
      const result = buildTemplateData('tier_upgrade', { name: 'X' });
      expect(result.cashback_rate).toBe('0%');
    });

    it('falls back new_tier to empty string when both tier fields missing', () => {
      const result = buildTemplateData('tier_upgrade', { name: 'X' });
      expect(result.new_tier).toBe('');
    });
  });

  // --- cashback_expiry_warning ---

  describe('cashback_expiry_warning', () => {
    it('maps all fields with defaults', () => {
      const result = buildTemplateData('cashback_expiry_warning', makeData());
      expect(result).toEqual({
        customer_name: 'Nguyen Van A',
        expiring_amount: '50.000đ',
        days_remaining: '5'
      });
    });

    it('formats expiring_amount with locale', () => {
      const result = buildTemplateData('cashback_expiry_warning', { name: 'X', amount: 999 });
      expect(result.expiring_amount).toBe('999đ');
    });

    it('falls back days_remaining to 7 when missing', () => {
      const result = buildTemplateData('cashback_expiry_warning', { name: 'X' });
      expect(result.days_remaining).toBe('7');
    });

    it('converts days to string', () => {
      const result = buildTemplateData('cashback_expiry_warning', { name: 'X', days: 30 });
      expect(result.days_remaining).toBe('30');
    });
  });

  // --- general_promotion ---

  describe('general_promotion', () => {
    it('returns empty object for unknown template', () => {

      const result = buildTemplateData('general_promotion', makeData());
      expect(result).toEqual({});
    });

    it('returns empty object for any unregistered template key', () => {

      const result = buildTemplateData('nonexistent_template', {});
      expect(result).toEqual({});
    });
  });
});
