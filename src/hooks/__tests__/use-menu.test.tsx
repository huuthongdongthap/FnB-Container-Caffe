import { createElement, type ReactNode } from 'react';
import { cleanup, renderHook, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { useMenu, useMenuItem, type MenuItem } from '../use-menu';
import { useMenuStore, type MenuItem as StoreMenuItem } from '../stores/use-menu-store';

const { api, cache } = vi.hoisted(() => ({
  api: vi.fn(),
  cache: { getMenuItems: vi.fn(), getMenuCategories: vi.fn(), saveMenuItems: vi.fn(), saveMenuCategories: vi.fn() },
}));
vi.mock('@/lib/api-client', async (importOriginal) => ({
  ...await importOriginal<typeof import('@/lib/api-client')>(), apiFetch: api,
}));
vi.mock('@/lib/offline-db', () => ({ offlineDb: cache }));

// One catalog response spans real legacy boundaries: free items, string prices,
// uploaded/legacy images, omitted fields and malformed server values.
const rawItems = [
  { id: 'tc001', name: 'Free coffee', category: 'coffee', priceCents: 0, price: '45000', imageUrl: '/uploads/admin.webp', image_url: '/uploads/ignored.webp', available: true, tags: ['featured'] },
  { id: 'tc002', name: 'String price', category: 'coffee', price: '35000.99 VND', image_url: '/menu/ca-phe-sua.jpg' },
  { id: 'unknown', name: 'Defaults', category: 'food', tags: 'invalid' },
  { id: 'invalid-price', name: 'Malformed price', category: 'food', price: 'bad' },
];
const normalized: MenuItem[] = [
  { id: 'tc001', name: 'Free coffee', category: 'coffee', price: 0, image_url: '/uploads/admin.webp', description: '', available: true, tags: ['featured'] },
  { id: 'tc002', name: 'String price', category: 'coffee', price: 35000, image_url: '/menu/aura-drinks/ca-phe-sua.webp', description: '', available: false, tags: [] },
  { id: 'unknown', name: 'Defaults', category: 'food', price: 0, image_url: '', description: '', available: false, tags: [] },
  { id: 'invalid-price', name: 'Malformed price', category: 'food', price: NaN, image_url: '', description: '', available: false, tags: [] },
];
const grouped = { categories: [{ items: rawItems.slice(0, 2) }, {}, { items: rawItems.slice(2) }] };
const flatItem = {
  ...normalized[0]!, price: 48000, priceCents: 0, imageUrl: '/uploads/unused-camel.webp',
  image_url: '/uploads/flat-snake.webp', prep_time: 8, modifierGroupIds: ['legacy-group'],
};
let client: QueryClient;
function mount<T>(hook: () => T) {
  return renderHook(hook, {
    wrapper: ({ children }: { children: ReactNode }) => createElement(QueryClientProvider, { client }, children),
  });
}

beforeEach(() => {
  api.mockReset();
  Object.values(cache).forEach(mock => mock.mockReset());
  client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  useMenuStore.setState({ items: [], categories: [], loading: false, error: null, searchResults: null });
  vi.spyOn(navigator, 'onLine', 'get').mockReturnValue(true);
});
afterEach(() => { cleanup(); client.clear(); vi.restoreAllMocks(); });

describe('legacy menu hook response contracts', () => {
  it('normalizes grouped data while preserving query filters, key and fallback pagination', async () => {
    api.mockResolvedValue({ data: grouped });
    const params = { category: 'coffee', available: false, search: 'milk tea', limit: 10, offset: 2 };
    const { result } = mount(() => useMenu(params));
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(api).toHaveBeenCalledExactlyOnceWith('/api/menu?category=coffee&available=false&search=milk+tea&limit=10&offset=2');
    expect(result.current.data).toEqual({ success: true, items: normalized, pagination: { total: 4, limit: 4, offset: 0 } });
    expect(client.getQueryData(['menu', params])).toEqual(result.current.data);
  });

  it('keeps flat item prices, snake-case images and extra fields without applying grouped normalization', async () => {
    const pagination = { total: 19, limit: 1, offset: 3 };
    api.mockResolvedValue({ success: false, items: [flatItem], data: grouped, pagination });
    const { result } = mount(() => useMenu());
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data).toEqual({ success: false, items: [flatItem], pagination });
    expect(api).toHaveBeenCalledExactlyOnceWith('/api/menu');
  });

  it('respects an empty flat array even when grouped data exists', async () => {
    api.mockResolvedValue({ items: [], data: grouped });
    const { result } = mount(() => useMenu());
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data?.items).toEqual([]);
  });

  it.each(['item', 'data'])('normalizes a single %s envelope and keeps item precedence', async (envelope) => {
    api.mockResolvedValue(envelope === 'item' ? { item: rawItems[0], data: rawItems[1] } : { data: rawItems[0] });
    const { result } = mount(() => useMenuItem('tc001'));
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data).toEqual({ success: true, item: normalized[0] });
    expect(api).toHaveBeenCalledExactlyOnceWith('/api/menu/tc001');
    expect(client.getQueryData(['menu', 'tc001'])).toEqual(result.current.data);
  });

  it('keeps an empty single-item ID disabled', () => {
    const { result } = mount(() => useMenuItem(''));
    expect(result.current.fetchStatus).toBe('idle');
    expect(api).not.toHaveBeenCalled();
  });
});

describe('legacy menu store response/cache contracts', () => {
  it.each(['flat', 'grouped', 'empty-flat'])('normalizes %s online data before deriving and persisting categories', async (shape) => {
    api.mockResolvedValue(shape === 'flat' ? { items: rawItems } : { items: shape === 'empty-flat' ? [] : undefined, data: grouped });
    await useMenuStore.getState().fetchMenu();
    const categories = [{ id: 'coffee', name: 'Cà phê' }, { id: 'food', name: 'Đồ ăn' }];
    expect(useMenuStore.getState()).toMatchObject({ items: normalized, categories, loading: false, error: null, searchResults: null });
    expect(api).toHaveBeenCalledExactlyOnceWith('/api/menu?available=true');
    expect(cache.saveMenuItems).toHaveBeenCalledExactlyOnceWith(normalized);
    expect(cache.saveMenuCategories).toHaveBeenCalledExactlyOnceWith(categories);
  });

  it.each(['item', 'data'])('normalizes a single %s envelope without changing store state', async (envelope) => {
    api.mockResolvedValue(envelope === 'item' ? { item: rawItems[0], data: rawItems[1] } : { data: rawItems[0] });
    expect(await useMenuStore.getState().fetchMenuItem('tc001')).toEqual(normalized[0]);
    expect(api).toHaveBeenCalledExactlyOnceWith('/api/menu/tc001');
    expect(useMenuStore.getState().items).toEqual([]);
    expect(cache.saveMenuItems).not.toHaveBeenCalled();
  });

  it('hydrates offline items with extra fields and cached category labels without fetching or renormalizing', async () => {
    vi.spyOn(navigator, 'onLine', 'get').mockReturnValue(false);
    const cached: StoreMenuItem = flatItem;
    const categories = [{ id: 'coffee', name: 'Cached category label' }];
    cache.getMenuItems.mockResolvedValue([cached]);
    cache.getMenuCategories.mockResolvedValue({ items: categories });
    await useMenuStore.getState().fetchMenu();
    expect(useMenuStore.getState()).toMatchObject({ items: [flatItem], categories, loading: false, error: null });
    expect(api).not.toHaveBeenCalled();
    expect(cache.saveMenuItems).not.toHaveBeenCalled();
  });
});
