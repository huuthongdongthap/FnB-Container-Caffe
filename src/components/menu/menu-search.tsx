import { useTranslation } from 'react-i18next';
import { Search, X } from 'lucide-react';
import { Input } from '@/components/ui/input';

interface MenuSearchProps {
  value: string;
  onChange: (value: string) => void;
}

export function MenuSearch({ value, onChange }: MenuSearchProps) {
  const { t } = useTranslation();
  return (
    <div className="relative w-full max-w-md">
      <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[#8A8E96]" />
      <Input
        type="search"
        placeholder={t('menu.searchPlaceholder')}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="border-white/[0.08] bg-white/[0.03] pl-10 pr-10 text-[#e4e2e4] placeholder:text-[#8A8E96] backdrop-blur-md focus:border-[#b8c7e2] focus:ring-[#b8c7e2]"
        aria-label={t('menu.searchAriaLabel')}
      />
      {value && (
        <button
          type="button"
          onClick={() => onChange('')}
          className="absolute right-3 top-1/2 -translate-y-1/2 text-[#8A8E96] transition-colors hover:text-[#e4e2e4]"
          aria-label={t('menu.clearSearchAriaLabel')}
        >
          <X className="h-4 w-4" />
        </button>
      )}
    </div>
  );
}
