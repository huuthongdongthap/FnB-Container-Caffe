import { create } from 'zustand';

/* ═══════════════════════════════════════════════════════════════════
   Cart store — Zustand with localStorage aura_cart migration.
   Reads old vanilla JS cart format on init, migrates to new format.
   ═══════════════════════════════════════════════════════════════════ */

const OLD_KEY = 'aura_cart';
const NEW_KEY = 'aura_cart_v3';

export interface CartItem {
  id: string;
  name: string;
  price: number;
  quantity: number;
  image?: string;
  modifiers?: string[];
  notes?: string;
}

interface CartState {
  items: CartItem[];
  addItem: (item: Omit<CartItem, 'quantity'>) => void;
  removeItem: (id: string) => void;
  updateQuantity: (id: string, quantity: number) => void;
  clearCart: () => void;
  totalItems: () => number;
  subtotal: () => number;
}

function loadInitialItems(): CartItem[] {
  // Try new format first
  try {
    const raw = localStorage.getItem(NEW_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) return parsed;
    }
  } catch { /* ignore parse errors */ }

  // Migrate from old aura_cart format
  try {
    const raw = localStorage.getItem(OLD_KEY);
    if (raw) {
      const oldCart = JSON.parse(raw);
      // Old format: { items: [...] } or direct array
      const items = Array.isArray(oldCart) ? oldCart : oldCart?.items;
      if (Array.isArray(items) && items.length > 0) {
        const migrated: CartItem[] = items.map((item: Record<string, unknown>) => ({
          id: String(item.id || ''),
          name: String(item.name || ''),
          price: Number(item.price || 0),
          quantity: Number(item.quantity || 1),
        }));
        // Persist migration
        localStorage.setItem(NEW_KEY, JSON.stringify(migrated));
        return migrated;
      }
    }
  } catch { /* ignore migration errors */ }

  return [];
}

function persistItems(items: CartItem[]): void {
  try {
    localStorage.setItem(NEW_KEY, JSON.stringify(items));
  } catch { /* storage full or unavailable */ }
}

export const useCartStore = create<CartState>((set, get) => ({
  items: loadInitialItems(),

  addItem: (item) =>
    set((state) => {
      const existing = state.items.find((i) => i.id === item.id);
      const next = existing
        ? state.items.map((i) =>
            i.id === item.id ? { ...i, quantity: i.quantity + 1 } : i,
          )
        : [...state.items, { ...item, quantity: 1 }];
      persistItems(next);
      return { items: next };
    }),

  removeItem: (id) =>
    set((state) => {
      const next = state.items.filter((i) => i.id !== id);
      persistItems(next);
      return { items: next };
    }),

  updateQuantity: (id, quantity) =>
    set((state) => {
      if (quantity <= 0) {
        const next = state.items.filter((i) => i.id !== id);
        persistItems(next);
        return { items: next };
      }
      const next = state.items.map((i) =>
        i.id === id ? { ...i, quantity } : i,
      );
      persistItems(next);
      return { items: next };
    }),

  clearCart: () => {
    localStorage.removeItem(OLD_KEY);
    localStorage.removeItem(NEW_KEY);
    set({ items: [] });
  },

  totalItems: () => get().items.reduce((sum, i) => sum + i.quantity, 0),
  subtotal: () => get().items.reduce((sum, i) => sum + i.price * i.quantity, 0),
}));
