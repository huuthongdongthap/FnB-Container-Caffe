import { beforeEach, describe, expect, it, vi } from 'vitest';
import { useCartStore } from '../use-cart-store';
import { invalidateClientSession, saveClientSession, subscribeClientSession } from '@/lib/client-session';

vi.mock('@/lib/offline-db', () => ({ offlineDb: { clearCachesAndSynced: vi.fn().mockResolvedValue(undefined) } }));
const user = { id: 'staff-1', name: 'Staff', role: 'staff', tenantId: 'cafe-1' };

beforeEach(() => {
  invalidateClientSession();
  saveClientSession('old-token', user);
  useCartStore.getState().addItem({ id: 'tc001', name: 'Tea', price: 25000 });
  useCartStore.getState().setTableId('05');
  useCartStore.getState().setAppliedPromo('WELCOME');
});

describe('cart session scope', () => {
  it('preserves items, table, promo and persistence on same-user token refresh while publishing auth updates', () => {
    const listener = vi.fn();
    const unsubscribe = subscribeClientSession(listener);
    try {
      saveClientSession('renewed-token', user);
      expect(listener).toHaveBeenCalledWith(expect.objectContaining({ token: 'renewed-token' }));
      expect(useCartStore.getState()).toMatchObject({ items: [expect.objectContaining({ id: 'tc001' })], tableId: '05', appliedPromo: 'WELCOME' });
      expect(JSON.parse(localStorage.getItem('aura_cart_v3')!)).toHaveLength(1);
    } finally { unsubscribe(); }
  });

  it('treats tenant aliases as the same scope on refresh', () => {
    saveClientSession('renewed-token', { ...user, tenantId: undefined, tenant_id: 'cafe-1' });
    expect(useCartStore.getState().items).toHaveLength(1);
    expect(localStorage.getItem('aura_cart_v3')).not.toBeNull();
  });

  it.each([
    { ...user, id: 'staff-2' },
    { ...user, tenantId: 'cafe-2' },
    { ...user, tenantId: undefined, tenant_id: 'cafe-2' },
    { ...user, role: 'admin' },
  ])('clears state on actual account scope change: %j', nextUser => {
    saveClientSession('old-token', nextUser);
    expect(useCartStore.getState()).toMatchObject({ items: [], tableId: null, appliedPromo: null });
    expect(localStorage.getItem('aura_cart_v3')).toBeNull();
  });

  it('clears state on logout', () => {
    invalidateClientSession();
    expect(useCartStore.getState()).toMatchObject({ items: [], tableId: null, appliedPromo: null });
  });

  it('preserves cart on cross-tab token refresh and clears it on cross-tab scope change', () => {
    localStorage.setItem('aura_auth_token', 'tab-token');
    window.dispatchEvent(new StorageEvent('storage', { key: 'aura_auth_token' }));
    expect(useCartStore.getState().items).toHaveLength(1);
    localStorage.setItem('aura_auth_user', JSON.stringify({ ...user, role: 'admin' }));
    window.dispatchEvent(new StorageEvent('storage', { key: 'aura_auth_user' }));
    expect(useCartStore.getState().items).toEqual([]);
  });
});
