import { useTranslation } from 'react-i18next';
import { MenuGridProps } from './StitchMenu2New-types';
import { MenuCard } from './StitchMenu2New-menu-card';

export function MenuGrid({ items, addedItems, onAddToOrder }: MenuGridProps) {
  const { t } = useTranslation();

  if (items.length === 0) {
    return (
      <div className="py-20 text-center" role="status">
        <p className="font-body text-lg text-[#c4c6ce]">
          {t('stitch.menu2.emptyMenu')}
        </p>
      </div>
    );
  }

  return (
    <div className="mb-32 grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-4">
      {items.map((item) => {
        const isAdded = addedItems.has(item.id);
        return (
          <MenuCard
            key={item.id}
            item={item}
            isAdded={isAdded}
            onAddToOrder={onAddToOrder}
          />
        );
      })}
    </div>
  );
}
