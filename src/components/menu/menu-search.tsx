import { Search, X } from 'lucide-react';
import { Input } from '@/components/ui/input';

interface MenuSearchProps {
  value: string;
  onChange: (value: string) => void;
}

export function MenuSearch({ value, onChange }: MenuSearchProps) {
  return (
    <div className="relative w-full max-w-md">
      <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted" />
      <Input
        type="search"
        placeholder="Tìm món..."
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="pl-10 pr-10"
        aria-label="Tìm kiếm món ăn"
      />
      {value && (
        <button
          type="button"
          onClick={() => onChange('')}
          className="absolute right-3 top-1/2 -translate-y-1/2 text-muted hover:text-foreground transition-colors"
          aria-label="Xoá tìm kiếm"
        >
          <X className="h-4 w-4" />
        </button>
      )}
    </div>
  );
}
