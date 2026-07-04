import { useTranslation } from 'react-i18next';
import { cn } from '@/lib/cn';

interface CategoryFilterProps {
  categories: Array<{ id: string; name: string }>;
  selected: string | null;
  onSelect: (category: string | null) => void;
}

export function CategoryFilter({ categories, selected, onSelect }: CategoryFilterProps) {
  const { t } = useTranslation();
  if (categories.length === 0) return null;

  return (
    <nav aria-label={t('menu.filterAriaLabel')} className="flex flex-nowrap gap-0 border-b border-white/[0.08]">
      <button
        onClick={() => onSelect(null)}
        className={cn(
          'relative whitespace-nowrap px-4 py-3 text-sm font-medium transition-all duration-200',
          selected === null
            ? 'text-[#b8c7e2]'
            : 'text-[#8A8E96] hover:text-[#e4e2e4]',
        )}
        aria-pressed={selected === null}
      >
        {t('menu.all')}
        {selected === null && (
          <span className="absolute bottom-0 left-1/2 h-0.5 w-8 -translate-x-1/2 rounded-full bg-[#b8c7e2]" />
        )}
      </button>
      {categories.map((cat) => (
        <button
          key={cat.id}
          onClick={() => onSelect(cat.id)}
          className={cn(
            'relative whitespace-nowrap px-4 py-3 text-sm font-medium transition-all duration-200',
            selected === cat.id
              ? 'text-[#b8c7e2]'
              : 'text-[#8A8E96] hover:text-[#e4e2e4]',
          )}
          aria-pressed={selected === cat.id}
        >
          {cat.name}
          {selected === cat.id && (
            <span className="absolute bottom-0 left-1/2 h-0.5 w-8 -translate-x-1/2 rounded-full bg-[#b8c7e2]" />
          )}
        </button>
      ))}
    </nav>
  );
}
