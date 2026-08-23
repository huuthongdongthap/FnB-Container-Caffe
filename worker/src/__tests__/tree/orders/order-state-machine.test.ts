import { describe, it, expect } from 'vitest';
import { canTransition, isTerminal, ORDER_TRANSITIONS, TERMINAL_STATES } from '../../../tree/orders/order-state-machine';

describe('canTransition', () => {
  it('allows valid transitions through the lifecycle', () => {
    expect(canTransition('pending', 'confirmed').ok).toBe(true);
    expect(canTransition('confirmed', 'preparing').ok).toBe(true);
    expect(canTransition('preparing', 'ready').ok).toBe(true);
    expect(canTransition('ready', 'served').ok).toBe(true);
    expect(canTransition('served', 'completed').ok).toBe(true);
    expect(canTransition('ready', 'delivered').ok).toBe(true);
    expect(canTransition('delivered', 'completed').ok).toBe(true);
  });

  it('allows cancellation from every pre-completion state', () => {
    for (const s of ['pending', 'confirmed', 'preparing', 'ready']) {
      expect(canTransition(s, 'cancelled').ok).toBe(true);
    }
  });

  it('does not allow cancellation once served/delivered', () => {
    expect(canTransition('served', 'cancelled').ok).toBe(false);
    expect(canTransition('delivered', 'cancelled').ok).toBe(false);
  });

  it('rejects invalid transitions', () => {
    expect(canTransition('pending', 'preparing').ok).toBe(false);
    expect(canTransition('ready', 'pending').ok).toBe(false);
    expect(canTransition('completed', 'pending').ok).toBe(false);
    expect(canTransition('cancelled', 'pending').ok).toBe(false);
  });

  it('rejects transitions out of terminal states', () => {
    expect(canTransition('completed', 'pending').ok).toBe(false);
    expect(canTransition('cancelled', 'pending').ok).toBe(false);
  });

  it('returns ok:true for no-op (same state)', () => {
    expect(canTransition('pending', 'pending').ok).toBe(true);
  });

  it('returns a machine-readable error on rejection', () => {
    const r = canTransition('pending', 'preparing');
    expect(r.ok).toBe(false);
    expect(r.error).toContain('Invalid transition');
    expect(r.error).toContain('pending → preparing');
  });

  it('handles null/undefined current status', () => {
    expect(canTransition(null, 'confirmed').ok).toBe(false);
    expect(canTransition(undefined, 'confirmed').ok).toBe(false);
  });

  it('handles null/undefined target status', () => {
    expect(canTransition('pending', null).ok).toBe(false);
    expect(canTransition('pending', undefined).ok).toBe(false);
  });
});

describe('isTerminal', () => {
  it('returns true for terminal states', () => {
    expect(isTerminal('completed')).toBe(true);
    expect(isTerminal('cancelled')).toBe(true);
  });

  it('returns false for active states', () => {
    expect(isTerminal('pending')).toBe(false);
    expect(isTerminal('ready')).toBe(false);
  });

  it('returns false for null/undefined', () => {
    expect(isTerminal(null)).toBe(false);
    expect(isTerminal(undefined)).toBe(false);
  });
});

describe('ORDER_TRANSITIONS / TERMINAL_STATES', () => {
  it('exposes the full transition graph', () => {
    expect(ORDER_TRANSITIONS.pending).toEqual(['confirmed', 'cancelled']);
    expect(ORDER_TRANSITIONS.completed).toEqual([]);
    expect(ORDER_TRANSITIONS.cancelled).toEqual([]);
  });

  it('lists terminal states', () => {
    expect(TERMINAL_STATES).toEqual(['completed', 'cancelled']);
  });
});