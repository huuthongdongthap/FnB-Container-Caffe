import { cn } from '@/lib/cn';

interface CategoryFilterProps {
  categories: Array<{ id: string; name: string }>;
  selected: string | null;
  onSelect: (category: string | null) => void;
}

export function CategoryFilter({ categories, selected, onSelect }: CategoryFilterProps) {
  if (categories.length === 0) return null;

  return (
    <nav aria-label="Lọc danh mục" className="flex flex-wrap gap-2">
      <button
        onClick={() => onSelect(null)}
        className={cn(
          'rounded-full px-4 py-2 text-sm font-medium transition-all duration-200',
          selected === null
            ? 'bg-primary text-white shadow-md'
            : 'border border-border bg-background text-muted hover:border-accent hover:text-foreground',
        )}
        aria-pressed={selected === null}
      >
        Tất cả
      </button>
      {categories.map((cat) => (
        <button
          key={cat.id}
          onClick={() => onSelect(cat.id)}
          className={cn(
            'rounded-full px-4 py-2 text-sm font-medium transition-all duration-200',
            selected === cat.id
              ? 'bg-primary text-white shadow-md'
              : 'border border-border bg-background text-muted hover:border-accent hover:text-foreground',
          )}
          aria-pressed={selected === cat.id}
        >
          {cat.name}
        </button>
      ))}
    </nav>
  );
}
