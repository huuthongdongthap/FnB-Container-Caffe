import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  rememberGuestOrderToken,
  getGuestOrderToken,
  clearGuestOrderTokens,
  captureGuestOrderTokenFromResponse,
} from '@/lib/guest-order-token';
import {
  offlineDb,
  tryAcquireOfflineSyncLock,
  releaseOfflineSyncLock,
} from '@/lib/offline-db';

describe('guest-order-token cross-tab persistence, split-bill capture, and offline sync lock', () => {
  beforeEach(() => {
    clearGuestOrderTokens();
    sessionStorage.clear();
    localStorage.clear();
    releaseOfflineSyncLock();
  });

  it('mirrors guest capability tokens into localStorage so new-tab banking returns retain SSE/detail access and purges both storages on clear', () => {
    rememberGuestOrderToken('ORD_TAB_1', 'tok_secret_tab_1');
    expect(getGuestOrderToken('ORD_TAB_1')).toBe('tok_secret_tab_1');

    // Simulate opening a fresh browser tab after PayOS / mobile banking redirect (empty sessionStorage, intact localStorage)
    const persistedBackup = localStorage.getItem('aura_guest_order_tokens_v1');
    expect(persistedBackup).toBeTruthy();
    sessionStorage.clear();

    expect(getGuestOrderToken('ORD_TAB_1')).toBe('tok_secret_tab_1');

    // Logout / session reset clears memory, sessionStorage, and localStorage
    clearGuestOrderTokens();
    expect(getGuestOrderToken('ORD_TAB_1')).toBeNull();
    expect(sessionStorage.getItem('aura_guest_order_tokens_v1')).toBeNull();
    expect(localStorage.getItem('aura_guest_order_tokens_v1')).toBeNull();
  });

  it('captures per-order tokens from split-bill order_tokens map and orders array responses', () => {
    captureGuestOrderTokenFromResponse({
      success: true,
      order_tokens: {
        ORD_SPLIT_A: 'split_token_alpha_192',
        ORD_SPLIT_B: 'split_token_bravo_192',
      },
      orders: [
        { id: 'ORD_SPLIT_A', order_token: 'split_token_alpha_192' },
        { id: 'ORD_SPLIT_B', order_token: 'split_token_bravo_192' },
      ],
    });

    expect(getGuestOrderToken('ORD_SPLIT_A')).toBe('split_token_alpha_192');
    expect(getGuestOrderToken('ORD_SPLIT_B')).toBe('split_token_bravo_192');
  });

  it('expires stale tokens past 24-hour TTL and bounds stored entries to 32', () => {
    const nowSpy = vi.spyOn(Date, 'now');
    nowSpy.mockReturnValue(1_700_000_000_000);

    for (let i = 0; i < 36; i++) {
      nowSpy.mockReturnValue(1_700_000_000_000 + i * 1000);
      rememberGuestOrderToken(`ORD_BOUND_${i}`, `tok_bound_${i}`);
    }
    // Oldest 4 evicted
    expect(getGuestOrderToken('ORD_BOUND_0')).toBeNull();
    expect(getGuestOrderToken('ORD_BOUND_3')).toBeNull();
    expect(getGuestOrderToken('ORD_BOUND_35')).toBe('tok_bound_35');

    // Advance past 24h TTL
    nowSpy.mockReturnValue(1_700_000_000_000 + 25 * 60 * 60 * 1000);
    expect(getGuestOrderToken('ORD_BOUND_35')).toBeNull();
    nowSpy.mockRestore();
  });

  it('prevents concurrent offline queue consumers from acquiring the shared sync lock simultaneously', () => {
    expect(offlineDb.tryAcquireSyncLock()).toBe(true);
    expect(tryAcquireOfflineSyncLock()).toBe(false);
    expect(offlineDb.tryAcquireSyncLock()).toBe(false);

    offlineDb.releaseSyncLock();
    expect(tryAcquireOfflineSyncLock()).toBe(true);
    releaseOfflineSyncLock();
  });
});
