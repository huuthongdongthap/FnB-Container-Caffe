import { useState, useCallback, useRef, useEffect } from 'react';
import { useFavoritesStore } from '@/hooks/stores/use-favorites-store';
import type { MenuItemData } from './StitchMenuNew-types';

const ADDED_TIMEOUT_MS = 2000;

export function useStitchMenuNew(items: MenuItemData[]) {
  const [activeCategory, setActiveCategory] = useState('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [addedItems, setAddedItems] = useState<Set<string>>(new Set());
  const [showFavoritesOnly, setShowFavoritesOnly] = useState(false);
  const timersRef = useRef<Map<string, ReturnType<typeof setTimeout>>>(new Map());

  const { items: favIds, toggle: toggleFavorite, isFavorite } = useFavoritesStore();

  const filteredItems = items.filter((item) => {
    const matchesCategory = activeCategory === 'all' || item.category === activeCategory;
    const matchesSearch =
      searchQuery === '' ||
      item.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      item.description.toLowerCase().includes(searchQuery.toLowerCase());
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

  const hasNoResults = searchQuery !== '' && filteredItems.length === 0;
  const hasNoItemsInCategory =
    activeCategory !== 'all' && searchQuery === '' && filteredItems.length === 0;

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
