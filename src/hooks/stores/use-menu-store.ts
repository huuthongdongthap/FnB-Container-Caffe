import { create } from 'zustand';
import { apiFetch, ApiClientError } from '@/lib/api-client';
import { offlineDb } from '@/lib/offline-db';

/* ═══════════════════════════════════════════════════════════════════
   Menu store — Zustand, no persistence.
   Fetches GET /api/menu, caches items + derived categories in state.
   ═══════════════════════════════════════════════════════════════════ */


export interface MenuItem {
  id: number;
  name: string;
  description: string;
  price: number;
  category: string;
  image?: string;
  available: boolean;
  tags: string[];
  prep_time?: number; // estimated prep time in minutes
}

export interface MenuCategory {
  id: string;
  name: string;
}

const CATEGORY_LABELS: Record<string, string> = {
  coffee: 'Cà phê',
  'traditional-coffee': 'Cà phê truyền thống',
  'hot-coffee': 'Cà phê nóng',
  frappuccino: 'Frappuccino',
  tea: 'Trà',
  smoothies: 'Sinh tố',
  juice: 'Nước ép',
  yogurt: 'Sữa chua',
  soda: 'Soda',
  'other-drinks': 'Đồ uống khác',
  bottled: 'Chai/lon',
  signature: 'Signature',
  snacks: 'Ăn vặt',
  food: 'Đồ ăn',
  combo: 'Combo',
};

interface MenuState {
  items: MenuItem[];
  categories: MenuCategory[];
  loading: boolean;
  error: string | null;
  /** null = showing all items, array = filtered by searchMenu() */
  searchResults: MenuItem[] | null;

  fetchMenu: () => Promise<void>;
  fetchMenuItem: (id: number) => Promise<MenuItem | null>;
  searchMenu: (query: string) => void;
}

function extractCategories(items: MenuItem[]): MenuCategory[] {
  const seen = new Set<string>();
  const cats: MenuCategory[] = [];
  for (const item of items) {
    if (!seen.has(item.category)) {
      seen.add(item.category);
      cats.push({
        id: item.category,
        name: CATEGORY_LABELS[item.category] || item.category,
      });
    }
  }
  return cats;
}

export const useMenuStore = create<MenuState>((set, get) => ({
  items: [],
  categories: [],
  loading: false,
  error: null,
  searchResults: null,

  fetchMenu: async () => {
    set({ loading: true, error: null });

    // Offline path: hydrate from IndexedDB before attempting network
    if (!navigator.onLine) {
      try {
        const [cachedItems, cachedCats] = await Promise.all([
          offlineDb.getMenuItems(),
          offlineDb.getMenuCategories(),
        ]);
        if (cachedItems.length > 0) {
          const items = cachedItems as MenuItem[];
          const cats = cachedCats?.items
            ? (cachedCats.items as { id: string; name: string }[])
            : extractCategories(items);
          set({
            items,
            categories: cats,
            loading: false,
            error: null,
            searchResults: null,
          });
          return; // do not attempt network
        }
      } catch {
        // cache miss — fall through to API attempt (will fail, show error)
      }
    }

    // Online: normal fetch
    try {
      const body = await apiFetch<{ items?: MenuItem[] }>('/api/menu?available=true');

      const items: MenuItem[] = (body as { items?: MenuItem[] }).items ?? [];
      const categories = extractCategories(items);
      set({ items, categories, loading: false, error: null, searchResults: null });

      // Persist to IndexedDB for next offline visit
      try {
        await offlineDb.saveMenuItems(items as unknown[]);
        await offlineDb.saveMenuCategories(categories);
      } catch {
        // non-fatal
      }
    } catch (err) {
      const message = err instanceof ApiClientError ? (err as ApiClientError).message : 'Lỗi kết nối';
      set({ loading: false, error: message });
    }
  },

  fetchMenuItem: async (id: number) => {
    try {
      const body = await apiFetch<{ item?: MenuItem }>(`/api/menu/${id}`);
      return (body as { item?: MenuItem }).item ?? null;
    } catch {
      return null;
    }
  },

  searchMenu: (query: string) => {
    const { items } = get();
    if (!query.trim()) {
      set({ searchResults: null });
      return;
    }
    const q = query.toLowerCase().trim();
    const results = items.filter(
      (item) =>
        item.name.toLowerCase().includes(q) ||
        item.description?.toLowerCase().includes(q),
    );
    set({ searchResults: results });
  },
}));
