import type { SectionCategory } from './system-hub-types';

/**
 * Narrows the catalog by the active category chip and the free-text query.
 * A category whose items all filter out is dropped entirely.
 */
export function filterSystemHubCategories(
  categories: SectionCategory[],
  searchTerm: string,
  selectedCategory: string,
): SectionCategory[] {
  return categories
    .map((cat) => {
      if (selectedCategory !== 'all' && cat.id !== selectedCategory) return null;
      const items = cat.items.filter((item) => {
        if (!searchTerm.trim()) return true;
        const term = searchTerm.toLowerCase();
        return (
          item.title.toLowerCase().includes(term) ||
          item.subtitle.toLowerCase().includes(term) ||
          item.description.toLowerCase().includes(term) ||
          item.badge.toLowerCase().includes(term) ||
          item.path.toLowerCase().includes(term)
        );
      });
      if (items.length === 0) return null;
      return { ...cat, items };
    })
    .filter((cat): cat is SectionCategory => cat !== null);
}

/** Total card count across every category, shown in the hub header. */
export function countSystemHubSections(categories: SectionCategory[]): number {
  return categories.reduce((sum, cat) => sum + cat.items.length, 0);
}
