import { describe, it, expect } from 'vitest';
import { isReadyToServeItem } from '../menu-customization';

describe('Menu Customization Rules - isReadyToServeItem', () => {
  describe('Bottled and Canned Beverages', () => {
    it('returns true for items in the bottled category', () => {
      expect(isReadyToServeItem({ id: 'bt001', name: 'Nước suối', category: 'bottled' })).toBe(true);
      expect(isReadyToServeItem({ id: 'bt002', name: 'Sting / Coca / Pepsi / 7UP / Ô long', category: 'bottled' })).toBe(true);
      expect(isReadyToServeItem({ id: 'bt003', name: 'Redbull', category: 'bottled' })).toBe(true);
    });

    it('returns true for items in packaged or canned categories', () => {
      expect(isReadyToServeItem({ id: 'snk01', name: 'Snack khoai tây', category: 'packaged' })).toBe(true);
      expect(isReadyToServeItem({ id: 'can01', name: 'Nước yến ngân nhĩ', category: 'canned' })).toBe(true);
    });
  });

  describe('Special Ready-to-Serve and Non-Craft Items', () => {
    it('returns true for Yaourt hũ (yo004)', () => {
      expect(isReadyToServeItem({ id: 'yo004', name: 'Yaourt hũ', category: 'yogurt' })).toBe(true);
    });

    it('returns true for Dừa trái nguyên quả (jc004)', () => {
      expect(isReadyToServeItem({ id: 'jc004', name: 'Dừa trái', category: 'juice' })).toBe(true);
    });

    it('returns true for Bình trà bắc truyền thống (od002)', () => {
      expect(isReadyToServeItem({ id: 'od002', name: 'Bình trà bắc', category: 'other-drinks' })).toBe(true);
    });
  });

  describe('Keyword Fallback Matching', () => {
    it('detects bottled water and sodas even when category is unmapped', () => {
      expect(isReadyToServeItem({ id: 'custom_1', name: 'Chai Nước suối Lavie 500ml' })).toBe(true);
      expect(isReadyToServeItem({ id: 'custom_2', name: 'Lon Coca Cola Zero' })).toBe(true);
      expect(isReadyToServeItem({ id: 'custom_3', name: 'Lon Redbull Thái' })).toBe(true);
      expect(isReadyToServeItem({ id: 'custom_4', name: 'Sữa chua Yaourt hũ nhà làm' })).toBe(true);
    });
  });

  describe('Craft Drinks (Must require customization)', () => {
    it('returns false for traditional and specialty coffee', () => {
      expect(isReadyToServeItem({ id: 'tc001', name: 'Cà phê máy / phin truyền thống', category: 'traditional-coffee' })).toBe(false);
      expect(isReadyToServeItem({ id: 'tc002', name: 'Cà phê sữa máy / phin', category: 'traditional-coffee' })).toBe(false);
      expect(isReadyToServeItem({ id: 'tc003', name: 'Cà phê / Matcha muối', category: 'traditional-coffee' })).toBe(false);
      expect(isReadyToServeItem({ id: 'hc003', name: 'Cappuccino', category: 'hot-coffee' })).toBe(false);
    });

    it('returns false for teas, smoothies, and crafted yogurts', () => {
      expect(isReadyToServeItem({ id: 'te001', name: 'Trà sen vàng', category: 'tea' })).toBe(false);
      expect(isReadyToServeItem({ id: 'sm001', name: 'Sinh tố bơ sáp', category: 'smoothies' })).toBe(false);
      expect(isReadyToServeItem({ id: 'yo001', name: 'Yaourt hạt chia', category: 'yogurt' })).toBe(false);
      expect(isReadyToServeItem({ id: 'yo002', name: 'Yaourt dâu tây', category: 'yogurt' })).toBe(false);
    });

    it('returns false for crafted juices (freshly pressed)', () => {
      expect(isReadyToServeItem({ id: 'jc001', name: 'Đá chanh', category: 'juice' })).toBe(false);
      expect(isReadyToServeItem({ id: 'jc002', name: 'Rau má', category: 'juice' })).toBe(false);
      expect(isReadyToServeItem({ id: 'jc006', name: 'Cam vắt', category: 'juice' })).toBe(false);
    });
  });

  describe('Boundary / Edge Cases', () => {
    it('returns false for null or undefined item', () => {
      expect(isReadyToServeItem(null)).toBe(false);
      expect(isReadyToServeItem(undefined)).toBe(false);
      expect(isReadyToServeItem({})).toBe(false);
    });
  });
});
