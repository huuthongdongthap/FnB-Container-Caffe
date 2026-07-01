import { describe, it, expect, beforeEach, vi } from 'vitest';
import { useMenuStore } from '@/hooks/stores/use-menu-store';

const MOCK_ITEMS = [
  { id: 1, name: 'Cà phê sữa đá', description: 'Cà phê sữa đá thơm ngon', price: 35000, category: 'coffee', image: '/img1.jpg', available: true, tags: ['bestseller'] },
  { id: 2, name: 'Trà đào cam sả', description: 'Trà đào mát lạnh', price: 45000, category: 'tea', image: '/img2.jpg', available: true, tags: ['hot'] },
  { id: 3, name: 'Sinh tố bơ', description: 'Sinh tố bơ thơm béo', price: 55000, category: 'smoothies', available: false, tags: [] },
];

function mockFetch(status: number, body: unknown) {
  vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
    ok: status >= 200 && status < 300,
    status,
    json: () => Promise.resolve(body),
  }));
}

describe('useMenuStore', () => {
  beforeEach(() => {
    useMenuStore.setState({
      items: [],
      categories: [],
      loading: false,
      error: null,
      searchResults: null,
    });
    vi.restoreAllMocks();
  });

  /* ── Initial state ── */
  it('starts with empty items, categories, loading=false', () => {
    const s = useMenuStore.getState();
    expect(s.items).toEqual([]);
    expect(s.categories).toEqual([]);
    expect(s.loading).toBe(false);
    expect(s.error).toBeNull();
    expect(s.searchResults).toBeNull();
  });

  /* ── fetchMenu ── */
  it('fetchMenu(): populates items and categories on success', async () => {
    mockFetch(200, {
      success: true,
      items: MOCK_ITEMS,
      pagination: { total: 3, limit: 50, offset: 0 },
    });

    await useMenuStore.getState().fetchMenu();

    const s = useMenuStore.getState();
    expect(s.items).toHaveLength(3);
    expect(s.categories.length).toBeGreaterThanOrEqual(2);
    expect(s.categories.find((c) => c.id === 'coffee')).toBeTruthy();
    expect(s.categories.find((c) => c.id === 'tea')).toBeTruthy();
    expect(s.loading).toBe(false);
    expect(s.error).toBeNull();
  });

  it('fetchMenu(): sets error on network failure', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('Network error')));

    await useMenuStore.getState().fetchMenu();

    const s = useMenuStore.getState();
    expect(s.error).toContain('Network');
    expect(s.loading).toBe(false);
    expect(s.items).toEqual([]);
  });

  it('fetchMenu(): sets error on API failure (500)', async () => {
    mockFetch(500, { message: 'Internal server error' });

    await useMenuStore.getState().fetchMenu();

    const s = useMenuStore.getState();
    expect(s.error).toContain('Internal');
    expect(s.loading).toBe(false);
  });

  it('fetchMenu(): sets error on non-JSON error response', async () => {
    mockFetch(503, 'Service Unavailable');

    await useMenuStore.getState().fetchMenu();

    const s = useMenuStore.getState();
    expect(s.error).toContain('503');
    expect(s.loading).toBe(false);
  });

  /* ── fetchMenuItem ── */
  it('fetchMenuItem(id): returns single item by ID', async () => {
    mockFetch(200, { success: true, item: MOCK_ITEMS[0] });

    const item = await useMenuStore.getState().fetchMenuItem(1);

    expect(item).toEqual(MOCK_ITEMS[0]);
  });

  it('fetchMenuItem(id): returns null when item not found (404)', async () => {
    mockFetch(404, { message: 'Not found' });

    const item = await useMenuStore.getState().fetchMenuItem(999);

    expect(item).toBeNull();
  });

  it('fetchMenuItem(id): returns null on network failure', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('Network error')));

    const item = await useMenuStore.getState().fetchMenuItem(1);

    expect(item).toBeNull();
  });

  /* ── searchMenu ── */
  it('searchMenu(query): filters items by name match', () => {
    useMenuStore.setState({ items: MOCK_ITEMS as typeof MOCK_ITEMS });

    useMenuStore.getState().searchMenu('cà phê');

    const s = useMenuStore.getState();
    expect(s.searchResults).toHaveLength(1);
    const first = s.searchResults![0];
    expect(first).toBeDefined();
    expect(first!.name).toContain('Cà phê');
  });

  it('searchMenu(query): returns multiple matches for partial name', () => {
    useMenuStore.setState({ items: MOCK_ITEMS as typeof MOCK_ITEMS });

    useMenuStore.getState().searchMenu('trà');

    const s = useMenuStore.getState();
    expect(s.searchResults).toHaveLength(1);
    const first = s.searchResults![0];
    expect(first).toBeDefined();
    expect(first!.name).toContain('Trà');
  });

  it('searchMenu(""): clears search results (null)', () => {
    useMenuStore.setState({
      items: MOCK_ITEMS as typeof MOCK_ITEMS,
      searchResults: [MOCK_ITEMS[0] as unknown as typeof MOCK_ITEMS[0]],
    });

    useMenuStore.getState().searchMenu('');

    expect(useMenuStore.getState().searchResults).toBeNull();
  });

  it('searchMenu(query): returns empty array when no match', () => {
    useMenuStore.setState({ items: MOCK_ITEMS as typeof MOCK_ITEMS });

    useMenuStore.getState().searchMenu('zzzzzzz');

    const s = useMenuStore.getState();
    expect(s.searchResults).toHaveLength(0);
  });
});
