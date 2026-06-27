/**
 * Odoo CRM Mapper Unit Tests — Phase 3 (CRM Sync)
 * Tests for customer → lead mapping and loyalty tier conversion
 *
 * @jest-test-type unit
 */
import {
  mapCustomerToLead,
  mapLoyaltyTier,
} from '../worker/src/lib/odoo-crm-mapper.js';

describe('Odoo CRM Mapper — Phase 3 (CRM Sync)', () => {
  // ── mapLoyaltyTier ──────────────────────────────────────────────────

  describe('mapLoyaltyTier', () => {
    test('should map bronze tier', () => {
      expect(mapLoyaltyTier('bronze')).toEqual(['Bronze Member']);
    });

    test('should map silver tier', () => {
      expect(mapLoyaltyTier('silver')).toEqual(['Silver Member']);
    });

    test('should map gold tier', () => {
      expect(mapLoyaltyTier('gold')).toEqual(['Gold Member']);
    });

    test('should map platinum tier', () => {
      expect(mapLoyaltyTier('platinum')).toEqual(['VIP', 'Platinum Member']);
    });

    test('should handle uppercase input', () => {
      expect(mapLoyaltyTier('GOLD')).toEqual(['Gold Member']);
      expect(mapLoyaltyTier('BRONZE')).toEqual(['Bronze Member']);
    });

    test('should handle mixed case input', () => {
      expect(mapLoyaltyTier('Silver')).toEqual(['Silver Member']);
    });

    test('should return empty array for unknown tier', () => {
      expect(mapLoyaltyTier('unknown')).toEqual([]);
    });

    test('should return empty array for null', () => {
      expect(mapLoyaltyTier(null)).toEqual([]);
    });

    test('should return empty array for undefined', () => {
      expect(mapLoyaltyTier(undefined)).toEqual([]);
    });

    test('should return empty array for empty string', () => {
      expect(mapLoyaltyTier('')).toEqual([]);
    });
  });

  // ── mapCustomerToLead ───────────────────────────────────────────────

  describe('mapCustomerToLead', () => {
    test('should map a normal customer', () => {
      const customer = {
        id: 'cust_001',
        name: 'Nguyen Van A',
        phone: '0912345678',
        email: 'nguyena@example.com',
        loyalty_tier: 'gold',
      };
      const result = mapCustomerToLead(customer);
      expect(result.name).toBe('Nguyen Van A');
      expect(result.phone).toBe('0912345678');
      expect(result.email).toBe('nguyena@example.com');
      expect(result.x_our_customer_id).toBe('cust_001');
      expect(result.tag_ids).toEqual(['Gold Member']);
    });

    test('should fallback name to phone', () => {
      const result = mapCustomerToLead({ phone: '0909999999' });
      expect(result.name).toBe('0909999999');
    });

    test('should fallback name to "New Lead" when no name or phone', () => {
      const result = mapCustomerToLead({ id: 'cust_002' });
      expect(result.name).toBe('New Lead');
    });

    test('should handle null customer', () => {
      expect(() => mapCustomerToLead(null)).toThrow();
    });

    test('should handle undefined customer', () => {
      expect(() => mapCustomerToLead(undefined)).toThrow();
    });

    test('should include loyalty tier tags', () => {
      const tiers = ['bronze', 'silver', 'gold', 'platinum'];
      const expectedTags = [
        ['Bronze Member'],
        ['Silver Member'],
        ['Gold Member'],
        ['VIP', 'Platinum Member'],
      ];
      tiers.forEach((tier, i) => {
        const result = mapCustomerToLead({ loyalty_tier: tier });
        expect(result.tag_ids).toEqual(expectedTags[i]);
      });
    });

    test('should handle missing loyalty_tier (defaults to bronze)', () => {
      const result = mapCustomerToLead({ id: 'cust_003' });
      expect(result.tag_ids).toEqual(['Bronze Member']);
    });

    test('should handle empty string tier', () => {
      const result = mapCustomerToLead({ id: 'cust_004', loyalty_tier: '' });
      expect(result.tag_ids).toEqual([]);
    });

    test('should handle tier field alias', () => {
      const result = mapCustomerToLead({ id: 'cust_005', tier: 'silver' });
      expect(result.tag_ids).toEqual(['Silver Member']);
    });

    test('should include x_our_customer_id for idempotency', () => {
      const result = mapCustomerToLead({ id: 'cust_006' });
      expect(result.x_our_customer_id).toBe('cust_006');
    });
  });
});
