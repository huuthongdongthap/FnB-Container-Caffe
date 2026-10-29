import { create } from 'zustand';
import { apiFetch, ApiClientError } from '@/lib/api-client';
import { offlineDb } from '@/lib/offline-db';
import { resolveMenuDrinkImage } from '@/lib/menu-drink-images';

/* ═══════════════════════════════════════════════════════════════════
   Menu store — Zustand, no persistence.
   Fetches GET /api/menu, caches items + derived categories in state.
   ═══════════════════════════════════════════════════════════════════ */


export interface MenuItem {
  id: string;
  name: string;
  description: string;
  price: number;
  category: string;
  image_url?: string;
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
  fetchMenuItem: (id: string) => Promise<MenuItem | null>;
  searchMenu: (query: string) => void;
}

interface RawStoreMenuItem {
  id: string;
  name: string;
  description?: string;
  priceCents?: number;
  price?: number | string;
  category: string;
  imageUrl?: string;
  image_url?: string;
  available?: boolean;
  tags?: string[];
}

interface RawMenuStoreResponse {
  items?: RawStoreMenuItem[];
  data?: {
    categories?: Array<{ items?: RawStoreMenuItem[] }>;
  };
}

interface RawSingleMenuStoreResponse {
  item?: RawStoreMenuItem;
  data?: RawStoreMenuItem;
}

function mapRawStoreMenuItem(item: RawStoreMenuItem): MenuItem {
  return {
    id: item.id,
    name: item.name,
    description: item.description ?? '',
    price: item.priceCents ?? (typeof item.price === 'string' ? parseInt(item.price, 10) : item.price) ?? 0,
    category: item.category,
    image_url: resolveMenuDrinkImage(item.id, item.imageUrl ?? item.image_url),
    available: Boolean(item.available),
    tags: Array.isArray(item.tags) ? item.tags : [],
  };
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
          const items = (cachedItems as MenuItem[]).map((item) => ({
            ...item,
            image_url: resolveMenuDrinkImage(item.id, item.image_url),
          }));
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
      const body = await apiFetch<RawMenuStoreResponse>('/api/menu?available=true');

      let rawList: RawStoreMenuItem[] = [];
      if (Array.isArray(body?.items) && body.items.length > 0) {
        rawList = body.items;
      } else if (Array.isArray(body?.data?.categories)) {
        rawList = body.data.categories.flatMap((cat) => cat.items || []);
      }

      const items: MenuItem[] = rawList.map(mapRawStoreMenuItem);

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
      const message =
        err instanceof ApiClientError
          ? (err.status === 0 ? 'Lỗi kết nối' : err.message)
          : 'Lỗi kết nối';
      set({ loading: false, error: message });
    }
  },

  fetchMenuItem: async (id: string) => {
    try {
      const body = await apiFetch<RawSingleMenuStoreResponse>(`/api/menu/${id}`);
      const raw = body?.item ?? body?.data;
      if (!raw) return null;
      return mapRawStoreMenuItem(raw);
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
