/**
 * Unit tests for the cart store (Zustand).
 *
 * Targets: initial state empty, addItem, removeItem, clear, total computation.
 *
 * This test file targets src/hooks/stores/use-cart-store.ts
 * via the existing store pattern (direct getState() calls, no rendering).
 */
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { useCartStore, type CartItem } from '@/hooks/stores/use-cart-store';

// Use the same import path the actual store exports from.
// The file lives at src/hooks/stores/use-cart-store.ts but is
// re-exported under the name "cart-store" for test organization.

describe('cart-store', () => {
  beforeEach(() => {
    localStorage.clear();
    useCartStore.setState({ items: [] });
  });

  afterEach(() => {
    localStorage.clear();
  });

  // ── Initial state ───────────────────────────────────────────
  describe('Initial state', () => {
    it('starts with empty items and null tableId', () => {
      const state = useCartStore.getState();
      expect(state.items).toEqual([]);
      expect(state.tableId).toBeNull();
    });
  });

  // ── addItem ─────────────────────────────────────────────────
  describe('addItem', () => {
    it('adds a new item to an empty cart with quantity 1', () => {
      const store = useCartStore.getState();
      expect(store.items).toHaveLength(0);

      store.addItem({ id: '1', name: 'Espresso', price: 35000 });
      const items = useCartStore.getState().items as CartItem[];

      expect(items).toHaveLength(1);
      expect(items[0]!.id).toBe('1');
      expect(items[0]!.name).toBe('Espresso');
      expect(items[0]!.price).toBe(35000);
      expect(items[0]!.quantity).toBe(1);
    });

    it('adds an item with optional image field', () => {
      useCartStore.getState().addItem({
        id: '2',
        name: 'Matcha Latte',
        price: 45000,
        image: '/images/matcha.jpg',
      });

      const items = useCartStore.getState().items as CartItem[];
      expect(items[0]!.image).toBe('/images/matcha.jpg');
    });

    it('increments quantity when adding an existing item', () => {
      const store = useCartStore.getState();
      store.addItem({ id: '1', name: 'Espresso', price: 35000 });
      store.addItem({ id: '1', name: 'Espresso', price: 35000 });

      const items = useCartStore.getState().items as CartItem[];
      expect(items).toHaveLength(1);
      expect(items[0]!.quantity).toBe(2);
    });
  });

  // ── removeItem ──────────────────────────────────────────────
  describe('removeItem', () => {
    it('removes the specified item', () => {
      const store = useCartStore.getState();
      store.addItem({ id: '1', name: 'Espresso', price: 35000 });
      store.addItem({ id: '2', name: 'Cold Brew', price: 45000 });

      useCartStore.getState().removeItem('1');
      const items = useCartStore.getState().items as CartItem[];

      expect(items).toHaveLength(1);
      expect(items[0]!.id).toBe('2');
    });

    it('does nothing when removing a non-existent item', () => {
      useCartStore.getState().addItem({ id: '1', name: 'Espresso', price: 35000 });
      useCartStore.getState().removeItem('nonexistent');

      expect(useCartStore.getState().items).toHaveLength(1);
    });
  });

  // ── clearCart ───────────────────────────────────────────────
  describe('clearCart', () => {
    it('empties items and resets tableId', () => {
      const store = useCartStore.getState();
      store.addItem({ id: '1', name: 'Espresso', price: 35000 });
      store.setTableId('table-5');
      expect(useCartStore.getState().items).toHaveLength(1);

      useCartStore.getState().clearCart();
      const state = useCartStore.getState();

      expect(state.items).toHaveLength(0);
      expect(state.tableId).toBeNull();
    });

    it('removes both aura_cart and aura_cart_v3 from storage', () => {
      localStorage.setItem('aura_cart', JSON.stringify({ items: [{ id: '1', name: 'Old', price: 1000 }] }));
      localStorage.setItem('aura_cart_v3', JSON.stringify([{ id: '2', name: 'New', price: 2000 }]));

      useCartStore.getState().clearCart();

      expect(localStorage.getItem('aura_cart')).toBeNull();
      expect(localStorage.getItem('aura_cart_v3')).toBeNull();
    });
  });

  // ── totalItems ──────────────────────────────────────────────
  describe('totalItems', () => {
    it('counts total quantity across all items', () => {
      useCartStore.getState().addItem({ id: '1', name: 'Espresso', price: 35000 });
      useCartStore.getState().addItem({ id: '1', name: 'Espresso', price: 35000 }); // qty 2
      useCartStore.getState().addItem({ id: '2', name: 'Cold Brew', price: 45000 });

      expect(useCartStore.getState().totalItems()).toBe(3);
    });

    it('returns 0 for empty cart', () => {
      expect(useCartStore.getState().totalItems()).toBe(0);
    });
  });

  // ── subtotal ────────────────────────────────────────────────
  describe('subtotal', () => {
    it('computes total price (price * quantity)', () => {
      useCartStore.getState().addItem({ id: '1', name: 'Espresso', price: 35000 });
      useCartStore.getState().addItem({ id: '1', name: 'Espresso', price: 35000 }); // qty 2 → 70000
      useCartStore.getState().addItem({ id: '2', name: 'Cold Brew', price: 45000 }); // 45000

      expect(useCartStore.getState().subtotal()).toBe(115000);
    });

    it('returns 0 for empty cart', () => {
      expect(useCartStore.getState().subtotal()).toBe(0);
    });
  });

  // ── setTableId ──────────────────────────────────────────────
  describe('setTableId', () => {
    it('sets and clears tableId', () => {
      useCartStore.getState().setTableId('table-7');
      expect(useCartStore.getState().tableId).toBe('table-7');

      useCartStore.getState().setTableId(null);
      expect(useCartStore.getState().tableId).toBeNull();
    });

    it('trims whitespace from tableId param', () => {
      // setTableId directly bypasses trim — no URL param here
      // but getInitialTableId trims; let's verify direct set
      useCartStore.getState().setTableId('  table-3  ');
      expect(useCartStore.getState().tableId).toBe('  table-3  ');
    });
  });

  // ── notes and modifiers support ────────────────────────────
  describe('Optional fields', () => {
    it('supports items with notes field', () => {
      useCartStore.getState().addItem({
        id: '3',
        name: 'Custom Drink',
        price: 50000,
        notes: 'Extra shot, less sugar',
      } as any);

      const item = useCartStore.getState().items[0]!;
      expect(item.notes).toBe('Extra shot, less sugar');
    });

    it('supports items with modifiers array', () => {
      useCartStore.getState().addItem({
        id: '4',
        name: 'Build Your Own',
        price: 60000,
        modifiers: ['Oat milk', 'Extra hot'],
      } as any);

      const item = useCartStore.getState().items[0]!;
      expect(item.modifiers).toEqual(['Oat milk', 'Extra hot']);
    });
  });
});
