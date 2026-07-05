import { create } from 'zustand';

/* ═══════════════════════════════════════════════════════════════════
   Favorites store — Zustand with localStorage persistence.
   Stores menu item IDs that the user has favorited.
   ═══════════════════════════════════════════════════════════════════ */

const STORAGE_KEY = 'aura_favorites';

interface FavoritesState {
  items: string[];
  toggle: (itemId: string) => void;
  isFavorite: (itemId: string) => boolean;
  getAll: () => string[];
}

function loadInitialFavorites(): string[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) return parsed;
    }
  } catch { /* ignore parse errors */ }
  return [];
}

function persistFavorites(items: string[]): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(items));
  } catch { /* storage full or unavailable */ }
}

export const useFavoritesStore = create<FavoritesState>((set, get) => ({
  items: loadInitialFavorites(),

  toggle: (itemId) =>
    set((state) => {
      const exists = state.items.includes(itemId);
      const next = exists
        ? state.items.filter((id) => id !== itemId)
        : [...state.items, itemId];
      persistFavorites(next);
      return { items: next };
    }),

  isFavorite: (itemId) => get().items.includes(itemId),

  getAll: () => get().items,
}));
