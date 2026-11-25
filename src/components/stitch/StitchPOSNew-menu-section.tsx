'use client';

import { useTranslation } from 'react-i18next';
import { cn } from '@/lib/cn';
import { Search, Coffee } from 'lucide-react';
import { MenuItemCard } from './StitchPOSNew-menu-item-card';
import { AddOnChip } from './StitchPOSNew-add-on-chip';
import type { POSNewMenuItem, POSNewAddOn, POSOrderType } from './StitchPOSNew-types';
import { MENU_CATEGORIES, resolvePosCategoryLabel } from './StitchPOSNew-types';

interface MenuSectionProps {
  searchQuery: string;
  onSearchChange: (q: string) => void;
  activeCategory: string;
  onCategoryChange: (c: string) => void;
  categories?: string[];
  categoryLabels?: Record<string, string>;
  filteredItems: POSNewMenuItem[];
  addOns: POSNewAddOn[];
  getQuantity: (id: string) => number;
  addToCart: (item: { id: string; name: string; price: number; category?: string }) => void;
  removeFromCart: (id: string) => void;
  cartOpen: boolean;
  orderType?: POSOrderType;
  onOrderTypeChange?: (type: POSOrderType) => void;
  deliveryAddress?: string;
  onDeliveryAddressChange?: (address: string) => void;
  deliveryRecipientName?: string;
  onDeliveryRecipientNameChange?: (name: string) => void;
  deliveryRecipientPhone?: string;
  onDeliveryRecipientPhoneChange?: (phone: string) => void;
  hasSelectedCustomer?: boolean;
}

export function MenuSection({
  searchQuery,
  onSearchChange,
  activeCategory,
  onCategoryChange,
  categories = MENU_CATEGORIES,
  categoryLabels,
  filteredItems,
  addOns,
  getQuantity,
  addToCart,
  removeFromCart,
  cartOpen,
  orderType,
  onOrderTypeChange,
  deliveryAddress = '',
  onDeliveryAddressChange,
  deliveryRecipientName = '',
  onDeliveryRecipientNameChange,
  deliveryRecipientPhone = '',
  onDeliveryRecipientPhoneChange,
  hasSelectedCustomer = false,
}: MenuSectionProps) {
  const { t } = useTranslation();
  return (
    <section
      className={cn(
        'flex-1 flex flex-col h-full overflow-hidden px-5 py-4',
        cartOpen ? 'lg:mr-96' : ''
      )}
      aria-label={t('posNew.menuSection')}
    >
      {/* Search, Order Channel & Category Filters */}
      <div className="flex flex-col gap-3 mb-4 shrink-0">
        <div className="flex flex-wrap items-center gap-3">
          <div className="relative flex-1 min-w-[220px] max-w-xl">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-[var(--aura-text-muted,#8A8E96)]" aria-hidden="true" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => onSearchChange(e.target.value)}
              placeholder={t('posNew.searchPlaceholder')}
              className="w-full bg-[var(--aura-noir-void,#050814)]/60 border border-[var(--aura-chrome-light,#B8C5D0)]/15 rounded-lg py-2.5 pl-11 pr-4 text-[14px] text-[var(--aura-text-primary,#eae1db)] focus:outline-none focus:border-[var(--aura-chrome-light,#B8C5D0)]/45 transition-all placeholder:text-[var(--aura-text-muted,#8A8E96)] font-body"
              aria-label={t('posNew.searchPlaceholder')}
            />
          </div>
          {orderType && onOrderTypeChange && (
            <div
              role="group"
              data-testid="pos-channel-switcher"
              aria-label={t('orderMgmt.channelFilter', { defaultValue: 'Loại đơn' })}
              className="flex items-center gap-1 rounded-xl border border-white/15 bg-[var(--aura-noir-deep,#0A1A2E)]/95 p-1 shadow-sm shrink-0"
            >
              {(
                [
                  { key: 'dine_in', label: t('orderMgmt.channel.dine_in', { defaultValue: 'Tại quán' }) },
                  { key: 'takeaway', label: t('orderMgmt.channel.takeaway', { defaultValue: 'Mang đi' }) },
                  { key: 'delivery', label: t('orderMgmt.channel.delivery', { defaultValue: 'Giao hàng' }) },
                ] as const
              ).map((opt) => (
                <button
                  key={opt.key}
                  type="button"
                  onClick={() => onOrderTypeChange(opt.key)}
                  aria-pressed={orderType === opt.key}
                  className={cn(
                    'rounded-lg px-3 py-1.5 text-xs font-semibold transition-colors whitespace-nowrap cursor-pointer',
                    orderType === opt.key
                      ? 'bg-amber-400/20 text-amber-200 border border-amber-400/40'
                      : 'text-slate-300 border border-transparent hover:bg-white/10 hover:text-white'
                  )}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          )}
        </div>
        {orderType === 'delivery' && onDeliveryAddressChange && (
          <div className="flex flex-col gap-2 max-w-2xl">
            <input
              type="text"
              data-testid="pos-delivery-address-input"
              value={deliveryAddress}
              onChange={(e) => onDeliveryAddressChange(e.target.value)}
              placeholder={t('orderMgmt.searchField.address', { defaultValue: 'Địa chỉ giao hàng (bắt buộc)' })}
              aria-label={t('orderMgmt.searchField.address', { defaultValue: 'Địa chỉ giao hàng' })}
              className={cn(
                'w-full rounded-lg border bg-[var(--aura-noir-void,#050814)]/75 px-3.5 py-2 text-xs text-[var(--aura-text-primary,#eae1db)] placeholder:text-[var(--aura-text-muted,#8A8E96)] outline-none focus:border-amber-400',
                !deliveryAddress.trim() ? 'border-amber-400/50' : 'border-white/15'
              )}
            />
            {(onDeliveryRecipientNameChange || onDeliveryRecipientPhoneChange) && (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                {onDeliveryRecipientNameChange && (
                  <input
                    type="text"
                    required={!hasSelectedCustomer}
                    aria-required={!hasSelectedCustomer}
                    data-testid="pos-delivery-recipient-name"
                    value={deliveryRecipientName}
                    onChange={(e) => onDeliveryRecipientNameChange(e.target.value)}
                    placeholder="Tên người nhận (bắt buộc)"
                    aria-label="Tên người nhận"
                    className={cn(
                      'w-full rounded-lg border bg-[var(--aura-noir-void,#050814)]/75 px-3.5 py-2 text-xs text-[var(--aura-text-primary,#eae1db)] placeholder:text-[var(--aura-text-muted,#8A8E96)] outline-none focus:border-amber-400',
                      !hasSelectedCustomer && !deliveryRecipientName.trim() ? 'border-amber-400/50' : 'border-white/15',
                    )}
                  />
                )}
                {onDeliveryRecipientPhoneChange && (
                  <input
                    type="tel"
                    required={!hasSelectedCustomer}
                    aria-required={!hasSelectedCustomer}
                    data-testid="pos-delivery-recipient-phone"
                    value={deliveryRecipientPhone}
                    onChange={(e) => onDeliveryRecipientPhoneChange(e.target.value)}
                    placeholder="SĐT người nhận (bắt buộc)"
                    aria-label="SĐT người nhận"
                    className={cn(
                      'w-full rounded-lg border bg-[var(--aura-noir-void,#050814)]/75 px-3.5 py-2 text-xs text-[var(--aura-text-primary,#eae1db)] placeholder:text-[var(--aura-text-muted,#8A8E96)] outline-none focus:border-amber-400',
                      !hasSelectedCustomer && !deliveryRecipientPhone.trim() ? 'border-amber-400/50' : 'border-white/15',
                    )}
                  />
                )}
              </div>
            )}
          </div>
        )}
        <div className="flex gap-2.5 overflow-x-auto pb-1.5 custom-scrollbar-pos" role="tablist" aria-label={t('posNew.categoryFilter')}>
          {categories.map((cat) => {
            const label = resolvePosCategoryLabel(cat, categoryLabels);
            return (
              <button
                key={cat}
                type="button"
                onClick={() => onCategoryChange(cat)}
                className={cn(
                  'shrink-0 px-4 py-2 rounded-lg border text-[12px] font-semibold tracking-wide whitespace-nowrap active:scale-95 transition-all font-body cursor-pointer',
                  activeCategory === cat
                    ? 'bg-[#f2c08d] text-[#1a1008] border-[#f2c08d]'
                    : 'bg-[var(--aura-noir-void,#050814)]/60 text-[var(--aura-text-muted,#b8a898)] border-[var(--aura-chrome-light,#B8C5D0)]/15 hover:text-[var(--aura-text-primary,#eae1db)] hover:border-[var(--aura-chrome-light,#B8C5D0)]/35'
                )}
                role="tab"
                aria-selected={activeCategory === cat}
                aria-label={`${label} ${t('posNew.category')}`}
              >
                {label}
              </button>
            );
          })}
        </div>
      </div>

      {/* Menu Grid Area */}
      <div className="flex-1 overflow-y-auto pr-2 pb-8 custom-scrollbar-pos">
        {filteredItems.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-center">
            <Coffee className="w-12 h-12 text-[var(--aura-chrome-light,#B8C5D0)]/20 mb-4" />
            <p className="text-[14px] text-[var(--aura-text-muted,#8a7a6a)] font-body">
              {searchQuery ? t('posNew.noResults') : t('posNew.noItemsInCategory')}
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-4 gap-4 mb-6">
            {filteredItems.map((item) => (
              <MenuItemCard
                key={item.id}
                item={item}
                quantity={getQuantity(item.id)}
                onAdd={() => addToCart(item)}
                onRemove={() => removeFromCart(item.id)}
              />
            ))}
          </div>
        )}

        {addOns.length > 0 && (
          <div className="mb-6">
            <h2 className="text-[13px] text-[var(--aura-text-muted,#8a7a6a)] uppercase tracking-widest mb-3 font-body">
              {t('posNew.popularAddOns')}
            </h2>
            <div className="flex gap-3 flex-wrap">
              {addOns.map((addon) => (
                <AddOnChip
                  key={addon.id}
                  addon={addon}
                  onAdd={() =>
                    addToCart({
                      id: addon.id,
                      name: addon.name,
                      price: addon.price,
                      category: 'Add-ons',
                    })
                  }
                />
              ))}
            </div>
          </div>
        )}
      </div>
    </section>
  );
}
