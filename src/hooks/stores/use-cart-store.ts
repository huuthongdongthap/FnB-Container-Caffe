import { create } from 'zustand';

/* ═══════════════════════════════════════════════════════════════════
   Cart store — Zustand with localStorage aura_cart migration.
   Reads old vanilla JS cart format on init, migrates to new format.
   ═══════════════════════════════════════════════════════════════════ */

const OLD_KEY = 'aura_cart';
const NEW_KEY = 'aura_cart_v3';

export interface CartItem {
  id: string;
  productId?: string;
  name: string;
  price: number;
  quantity: number;
  image?: string;
  modifiers?: string[];
  notes?: string;
}

interface CartState {
  items: CartItem[];
  tableId: string | null;
  addItem: (item: Omit<CartItem, 'quantity'>) => void;
  removeItem: (id: string) => void;
  updateQuantity: (id: string, quantity: number) => void;
  clearCart: () => void;
  setTableId: (id: string | null) => void;
  totalItems: () => number;
  subtotal: () => number;
}

function getInitialTableId(): string | null {
  try {
    const params = new URLSearchParams(window.location.search);
    const id = params.get('table');
    return id && id.trim().length > 0 ? id.trim() : null;
  } catch {
    return null;
  }
}

function sanitizeCartItem(item: CartItem): CartItem {
  const rawId = item.productId || item.id || '';
  const baseId = (rawId.includes('-') || rawId.includes('_')) ? rawId.split(/[-_]/)[0]?.trim() || rawId : rawId;

  // Ready to serve items check (bottled, snack, packaged)
  const isReadyToServe = baseId.startsWith('bt') || baseId === 'od002' || baseId === 'yo004' || baseId === 'yg004' || baseId === 'jc004';
  if (isReadyToServe) {
    return {
      ...item,
      id: baseId,
      productId: baseId,
      modifiers: [],
      notes: undefined,
    };
  }

  return {
    ...item,
    productId: baseId || item.productId || item.id,
  };
}

function loadInitialItems(): CartItem[] {
  // Support clearing cart via URL parameter ?clear=true or ?reset=true
  try {
    const params = new URLSearchParams(window.location.search);
    if (params.get('clear') === 'true' || params.get('clear_cart') === '1' || params.get('reset') === 'true') {
      localStorage.removeItem(OLD_KEY);
      localStorage.removeItem(NEW_KEY);
      return [];
    }
  } catch { /* ignore */ }

  // Try new format first
  try {
    const raw = localStorage.getItem(NEW_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) {
        const sanitized = parsed.map(sanitizeCartItem);
        persistItems(sanitized);
        return sanitized;
      }
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
        const migrated: CartItem[] = items.map((item: Record<string, unknown>) => {
          const rawId = String(item.productId || item.product_id || item.id || '');
          const baseId = (rawId.includes('-') || rawId.includes('_')) ? rawId.split(/[-_]/)[0]?.trim() || rawId : rawId;
          const isReadyToServe = baseId.startsWith('bt') || baseId === 'od002' || baseId === 'yo004' || baseId === 'yg004' || baseId === 'jc004';
          return {
            id: isReadyToServe ? baseId : String(item.id || ''),
            productId: baseId,
            name: String(item.name || ''),
            price: Math.max(0, Number(item.price || 0) || 0),
            quantity: Math.max(1, Math.floor(Number(item.quantity || 1) || 1)),
            modifiers: isReadyToServe ? [] : (Array.isArray(item.modifiers) ? (item.modifiers as string[]) : undefined),
            notes: isReadyToServe ? undefined : (typeof item.notes === 'string' ? item.notes : undefined),
          };
        });
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
  tableId: getInitialTableId(),

  addItem: (item) =>
    set((state) => {
      const sanitized = sanitizeCartItem({ ...item, quantity: 1 });
      const existing = state.items.find((i) => i.id === sanitized.id);
      const next = existing
        ? state.items.map((i) =>
            i.id === sanitized.id ? { ...i, quantity: i.quantity + 1 } : i,
          )
        : [...state.items, sanitized];
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
    set({ items: [], tableId: null });
  },

  setTableId: (id) => set({ tableId: id }),

  totalItems: () => get().items.reduce((sum, i) => sum + i.quantity, 0),
  subtotal: () => get().items.reduce((sum, i) => sum + i.price * i.quantity, 0),
}));
