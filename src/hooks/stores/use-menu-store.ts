import { create } from 'zustand';
import { API_BASE } from '@/lib/api-client';

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
    try {
      const res = await fetch(`${API_BASE}/api/menu?available=true`);

      const body = await res.json();

      if (!res.ok) {
        set({ loading: false, error: body.message || `Lỗi tải menu (${res.status})` });
        return;
      }

      const items: MenuItem[] = body.items ?? [];
      const categories = extractCategories(items);
      set({ items, categories, loading: false, error: null, searchResults: null });
    } catch (err) {
      set({ loading: false, error: err instanceof Error ? err.message : 'Lỗi kết nối' });
    }
  },

  fetchMenuItem: async (id: number) => {
    try {
      const res = await fetch(`${API_BASE}/api/menu/${id}`);
      if (!res.ok) return null;
      const body = await res.json();
      return body.item ?? null;
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
