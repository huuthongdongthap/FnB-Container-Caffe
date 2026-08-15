/**
 * Horizontal scrolling category filter pills for the mobile order page.
 */
import { useTranslation } from 'react-i18next';
import { clsx } from 'clsx';

type CategoryEntry = { readonly key: string; readonly label: string };

interface CategoryFilterProps {
  categories: readonly CategoryEntry[];
  activeCategory: string;
  onSelect: (key: string) => void;
}

export function CategoryFilter({
  categories,
  activeCategory,
  onSelect,
}: Readonly<CategoryFilterProps>) {
  const { t } = useTranslation();

  return (
    <section
      className="flex overflow-x-auto gap-3 -mx-5 px-5 no-scrollbar items-center"
      aria-label={t('stitch.ordering.categoriesLabel', {
        defaultValue: 'Menu categories',
      })}
    >
      {categories.map((cat) => (
        <button
          key={cat.key}
          type="button"
          onClick={() => onSelect(cat.key)}
          className={clsx(
            'px-6 py-2 rounded-full whitespace-nowrap font-body text-[11px] font-semibold tracking-wider uppercase active:scale-95 transition-all',
            activeCategory === cat.key
              ? 'bg-[rgba(205,127,50,0.25)] text-[var(--aura-chrome-mid)]'
              : 'text-[var(--aura-text-secondary, #a0a8b0)] hover:text-[var(--aura-primary, #c6c6c7)]',
          )}
          style={
            activeCategory !== cat.key
              ? {
                  background: 'rgba(22, 42, 68, 0.4)',
                  backdropFilter: 'blur(24px)',
                  WebkitBackdropFilter: 'blur(24px)',
                  border: '0.5px solid rgba(229, 228, 226, 0.15)',
                }
              : undefined
          }
          aria-label={t('stitch.ordering.categoryFilter', {
            category: cat.label,
            defaultValue: `Filter by ${cat.label}`,
          })}
          aria-pressed={activeCategory === cat.key}
        >
          {cat.label}
        </button>
      ))}
    </section>
  );
}
