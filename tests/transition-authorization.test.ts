import { describe, it, expect } from 'vitest';
import { canActorTransition, toActorRole } from '../packages/domain/order';

describe('toActorRole role resolution', () => {
  it('passes known canonical roles through unchanged', () => {
    expect(toActorRole('customer')).toBe('customer');
    expect(toActorRole('staff')).toBe('staff');
    expect(toActorRole('kitchen')).toBe('kitchen');
    expect(toActorRole('rider')).toBe('rider');
    expect(toActorRole('manager')).toBe('manager');
    expect(toActorRole('admin')).toBe('admin');
  });

  it('normalizes common aliases to their domain equivalents', () => {
    expect(toActorRole('owner')).toBe('admin');
    expect(toActorRole('waiter')).toBe('staff');
    expect(toActorRole('cashier')).toBe('staff');
    expect(toActorRole('barista')).toBe('kitchen');
    expect(toActorRole('chef')).toBe('kitchen');
    expect(toActorRole('driver')).toBe('rider');
    expect(toActorRole('delivery')).toBe('rider');
  });

  it('falls back to customer for missing or unknown roles', () => {
    expect(toActorRole(null)).toBe('customer');
    expect(toActorRole(undefined)).toBe('customer');
    expect(toActorRole('')).toBe('customer');
    expect(toActorRole('intruder')).toBe('customer');
    expect(toActorRole('ANONYMOUS')).toBe('customer');
  });
});

describe('canActorTransition role-based matrix', () => {
  describe('structural constraints precede role checks', () => {
    it('blocks illegal forward jumps regardless of privileged role', () => {
      // pending → ready is structurally invalid (must pass confirmed → preparing)
      expect(canActorTransition('admin', 'pending', 'ready').ok).toBe(false);
      expect(canActorTransition('manager', 'pending', 'ready').ok).toBe(false);
    });

    it('blocks transitions out of terminal states regardless of role', () => {
      expect(canActorTransition('admin', 'completed', 'pending').ok).toBe(false);
      expect(canActorTransition('admin', 'cancelled', 'confirmed').ok).toBe(false);
    });

    it('always permits no-op transitions', () => {
      expect(canActorTransition('customer', 'pending', 'pending').ok).toBe(true);
      expect(canActorTransition('kitchen', 'preparing', 'preparing').ok).toBe(true);
    });
  });

  describe('customer permissions', () => {
    it('allows a customer to cancel their own pending order', () => {
      expect(canActorTransition('customer', 'pending', 'cancelled').ok).toBe(true);
    });

    it('forbids a customer from cancelling once preparation has begun', () => {
      expect(canActorTransition('customer', 'confirmed', 'cancelled').ok).toBe(false);
      expect(canActorTransition('customer', 'preparing', 'cancelled').ok).toBe(false);
    });

    it('forbids a customer from advancing fulfillment states', () => {
      expect(canActorTransition('customer', 'pending', 'confirmed').ok).toBe(false);
      expect(canActorTransition('customer', 'confirmed', 'preparing').ok).toBe(false);
      expect(canActorTransition('customer', 'ready', 'served').ok).toBe(false);
    });
  });

  describe('staff permissions', () => {
    it('allows full forward operational progression', () => {
      expect(canActorTransition('staff', 'pending', 'confirmed').ok).toBe(true);
      expect(canActorTransition('staff', 'confirmed', 'preparing').ok).toBe(true);
      expect(canActorTransition('staff', 'preparing', 'ready').ok).toBe(true);
      expect(canActorTransition('staff', 'ready', 'served').ok).toBe(true);
      expect(canActorTransition('staff', 'served', 'completed').ok).toBe(true);
    });

    it('allows cancellation before final fulfillment', () => {
      expect(canActorTransition('staff', 'pending', 'cancelled').ok).toBe(true);
      expect(canActorTransition('staff', 'confirmed', 'cancelled').ok).toBe(true);
      expect(canActorTransition('staff', 'preparing', 'cancelled').ok).toBe(true);
      expect(canActorTransition('staff', 'ready', 'cancelled').ok).toBe(true);
    });

    it('forbids staff from cancelling orders that have already been handed over', () => {
      expect(canActorTransition('staff', 'served', 'cancelled').ok).toBe(false);
      expect(canActorTransition('staff', 'delivered', 'cancelled').ok).toBe(false);
    });
  });

  describe('kitchen permissions', () => {
    it('only permits movement across the prep boundary', () => {
      expect(canActorTransition('kitchen', 'confirmed', 'preparing').ok).toBe(true);
      expect(canActorTransition('kitchen', 'preparing', 'ready').ok).toBe(true);
    });

    it('forbids intake, billing, or delivery moves', () => {
      expect(canActorTransition('kitchen', 'pending', 'confirmed').ok).toBe(false);
      expect(canActorTransition('kitchen', 'ready', 'served').ok).toBe(false);
      expect(canActorTransition('kitchen', 'served', 'completed').ok).toBe(false);
      expect(canActorTransition('kitchen', 'pending', 'cancelled').ok).toBe(false);
    });
  });

  describe('rider permissions', () => {
    it('owns delivery fulfillment states once the order is ready', () => {
      expect(canActorTransition('rider', 'ready', 'delivered').ok).toBe(true);
      expect(canActorTransition('rider', 'delivered', 'completed').ok).toBe(true);
    });

    it('forbids kitchen or dining-room actions', () => {
      expect(canActorTransition('rider', 'confirmed', 'preparing').ok).toBe(false);
      expect(canActorTransition('rider', 'preparing', 'ready').ok).toBe(false);
      expect(canActorTransition('rider', 'ready', 'served').ok).toBe(false);
    });
  });

  describe('privileged operators', () => {
    it('manager can authorize any structurally-valid non-terminal move', () => {
      expect(canActorTransition('manager', 'pending', 'confirmed').ok).toBe(true);
      expect(canActorTransition('manager', 'ready', 'delivered').ok).toBe(true);
      expect(canActorTransition('manager', 'ready', 'cancelled').ok).toBe(true);
    });

    it('admin cannot override structural boundaries', () => {
      // served -> cancelled is structurally illegal; admin cannot bypass this
      expect(canActorTransition('admin', 'served', 'cancelled').ok).toBe(false);
    });

    it('admin can authorize any structurally-valid non-terminal move', () => {
      expect(canActorTransition('admin', 'pending', 'cancelled').ok).toBe(true);
      expect(canActorTransition('admin', 'delivered', 'completed').ok).toBe(true);
    });
  });
});
