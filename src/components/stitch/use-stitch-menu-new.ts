import { useState, useCallback, useRef, useEffect } from 'react';
import { useFavoritesStore } from '@/hooks/stores/use-favorites-store';
import type { MenuItemData } from './StitchMenuNew-types';

const ADDED_TIMEOUT_MS = 2000;

function normalizeVietnameseSearch(value: string): string {
  return value
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[đĐ]/g, 'd')
    .toLowerCase()
    .trim();
}

export function useStitchMenuNew(items: MenuItemData[]) {
  const [activeCategory, setActiveCategory] = useState('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [addedItems, setAddedItems] = useState<Set<string>>(new Set());
  const [showFavoritesOnly, setShowFavoritesOnly] = useState(false);
  const timersRef = useRef<Map<string, ReturnType<typeof setTimeout>>>(new Map());

  const { items: favIds, toggle: toggleFavorite, isFavorite } = useFavoritesStore();
  const normalizedQuery = normalizeVietnameseSearch(searchQuery);

  const filteredItems = items.filter((item) => {
    const matchesCategory = activeCategory === 'all' || item.category === activeCategory;
    const matchesSearch =
      normalizedQuery === '' ||
      normalizeVietnameseSearch(item.name).includes(normalizedQuery) ||
      normalizeVietnameseSearch(item.description).includes(normalizedQuery);
    const matchesFavorites = !showFavoritesOnly || isFavorite(item.id);
    return matchesCategory && matchesSearch && matchesFavorites;
  });

  const handleAddToCart = useCallback(
    (item: MenuItemData, onAddToCart?: (item: MenuItemData) => void) => {
      onAddToCart?.(item);
      setAddedItems((prev) => {
        const next = new Set(prev);
        next.add(item.id);
        return next;
      });

      const existing = timersRef.current.get(item.id);
      if (existing) clearTimeout(existing);

      const timer = setTimeout(() => {
        setAddedItems((prev) => {
          const next = new Set(prev);
          next.delete(item.id);
          return next;
        });
        timersRef.current.delete(item.id);
      }, ADDED_TIMEOUT_MS);
      timersRef.current.set(item.id, timer);
    },
    [],
  );

  useEffect(() => {
    return () => {
      timersRef.current.forEach((t) => clearTimeout(t));
      timersRef.current.clear();
    };
  }, []);

  const hasNoResults = normalizedQuery !== '' && filteredItems.length === 0;
  const hasNoItemsInCategory =
    activeCategory !== 'all' && normalizedQuery === '' && filteredItems.length === 0;

  return {
    activeCategory,
    setActiveCategory,
    searchQuery,
    setSearchQuery,
    addedItems,
    showFavoritesOnly,
    setShowFavoritesOnly,
    favIds,
    toggleFavorite,
    isFavorite,
    filteredItems,
    handleAddToCart,
    hasNoResults,
    hasNoItemsInCategory,
  };
}
