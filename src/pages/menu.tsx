import { useState, useMemo } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { HelmetHead } from '@/components/seo/HelmetHead';
import { useCustomerMenu, type CustomerMenu, type CustomerMenuItem } from '@/hooks/useCustomerMenu';
import { useCart } from '@/hooks/use-cart';
import { useToast } from '@/components/ui/toast';
import { StitchMenuNew } from '@/components/stitch/StitchMenuNew';
import { StitchMenuNewSkeleton } from '@/components/stitch/StitchMenuNew-skeleton';
import { DEFAULT_ITEMS } from '@/components/stitch/StitchMenuNew-data';
import { LandingNav } from '@/components/stitch/StitchLandingNew-nav';
import { CartDrawer } from '@/components/order/cart-drawer';
import { RecommendationSection } from '@/components/menu/recommendation-section';
import { DrinkCustomizerModal } from '@/components/menu/DrinkCustomizerModal';
import { MapPin, UtensilsCrossed, AlertCircle } from 'lucide-react';
import type { MenuItemData } from '@/components/stitch/StitchMenuNew';

function transformToStitchItem(item: CustomerMenuItem): MenuItemData {
  return {
    id: item.id,
    name: item.name,
    description: item.description ?? '',
    price: new Intl.NumberFormat('vi-VN').format(item.priceCents) + '₫',
    imageSrc: item.imageUrl ?? '',
    imageAlt: item.name,
    category: item.category,
    badge: item.tags?.includes('featured') ? 'NỔI BẬT' : undefined,
  };
}

function flattenMenu(menu: CustomerMenu): CustomerMenuItem[] {
  return menu.categories?.flatMap((cat) => cat.items) ?? [];
}

export function MenuPage() {
  const { t, i18n } = useTranslation();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { showToast } = useToast();

  const rawTable = searchParams.get('table') || searchParams.get('ban');
  const tableNumber = rawTable?.trim();

  const [cartOpen, setCartOpen] = useState(false);

  const {
    items: cartItems,
    totalItems,
    subtotal,
    serviceFee,
    total,
    qualifiesForFreeDelivery,
    remainingForFreeDelivery,
    addItem,
    removeItem,
    updateQuantity,
    clearCart,
  } = useCart();

  const { data: menu, isLoading, error } = useCustomerMenu({
    locale: i18n.language?.startsWith('en') ? 'en-US' : 'vi-VN',
  });

  /* Transform domain catalog → Stitch format with safe fallback to DEFAULT_ITEMS */
  const stitchItems: MenuItemData[] = useMemo(() => {
    if (menu && menu.categories && menu.categories.length > 0) {
      const items = flattenMenu(menu).map(transformToStitchItem);
      if (items.length > 0) return items;
    }
    return DEFAULT_ITEMS;
  }, [menu]);

  const [customizingItem, setCustomizingItem] = useState<MenuItemData | null>(null);

  const handleAddToCart = (stitchItem: MenuItemData) => {
    // Open customization modal so customer can choose sweetness, ice, size, toppings
    setCustomizingItem(stitchItem);
  };

  const handleConfirmCustomization = ({
    item,
    quantity,
    finalPrice,
    modifiers,
    notes,
  }: {
    item: MenuItemData;
    quantity: number;
    finalPrice: number;
    modifiers: string[];
    notes: string;
  }) => {
    const modKey = modifiers.length > 0 ? `-${modifiers.join('_')}` : '';
    const noteKey = notes ? `-${notes}` : '';
    for (let i = 0; i < quantity; i++) {
      addItem({
        id: `${item.id}${modKey}${noteKey}`,
        name: item.name,
        price: finalPrice,
        image: item.imageSrc || undefined,
        modifiers,
        notes: notes || undefined,
      });
    }
    showToast(`Đã thêm ${quantity > 1 ? `${quantity}x ` : ''}${item.name} vào giỏ hàng`, 'success');
  };

  const handleCheckout = () => {
    setCartOpen(false);
    navigate(tableNumber ? `/checkout?table=${encodeURIComponent(tableNumber)}` : '/checkout');
  };

  return (
    <div className="relative min-h-screen bg-[var(--aura-noir-deep)] text-[var(--aura-chrome-bright)] font-body selection:bg-[var(--aura-chrome-mid)] selection:text-[var(--aura-noir-deep)]">
      <HelmetHead
        title={t('menuSeoTitle', 'Thực Đơn & Gọi Món — AURA CAFE')}
        description={t('menuSeoDescription', 'Khám phá thực đơn đồ uống đặc sắc tại quán cà phê Container AURA CAFE Sa Đéc')}
        canonical="/menu"
      />

      <LandingNav />

      {/* Table Notification Banner if customer is dining in */}
      {tableNumber && (
        <aside
          aria-label="Thông tin bàn phục vụ"
          className="fixed top-20 left-1/2 -translate-x-1/2 z-40 w-full max-w-3xl px-4 pointer-events-none"
        >
          <div className="pointer-events-auto flex items-center justify-between gap-3 px-5 py-2.5 rounded-full bg-[var(--aura-noir-bright)]/90 border border-[var(--aura-chrome-mid)]/50 backdrop-blur-md shadow-2xl text-xs sm:text-sm text-[var(--aura-chrome-bright)]">
            <div className="flex items-center gap-2">
              <span className="flex h-2.5 w-2.5 rounded-full bg-[var(--aura-forest-light)] animate-pulse" />
              <UtensilsCrossed className="w-4 h-4 text-[var(--aura-chrome-mid)]" />
              <span>
                Quý khách đang gọi món tại <strong className="text-white font-semibold underline decoration-[var(--aura-chrome-mid)]">Bàn {tableNumber}</strong>
              </span>
            </div>
            <a
              href="/order"
              className="text-[11px] font-semibold text-[var(--aura-chrome-mid)] hover:text-white uppercase tracking-wider"
            >
              Đổi bàn
            </a>
          </div>
        </aside>
      )}

      {isLoading ? (
        <StitchMenuNewSkeleton />
      ) : (
        <StitchMenuNew
          items={stitchItems}
          brandName="AURA CAFE"
          onAddToCart={handleAddToCart}
          onCartClick={() => setCartOpen(true)}
          cartItemCount={totalItems}
        >
          <div className="mt-12">
            <RecommendationSection
              excludeIds={new Set(cartItems.map((i) => i.id))}
            />
          </div>
        </StitchMenuNew>
      )}

      <DrinkCustomizerModal
        item={customizingItem}
        isOpen={Boolean(customizingItem)}
        onClose={() => setCustomizingItem(null)}
        onConfirm={handleConfirmCustomization}
      />

      <CartDrawer
        open={cartOpen}
        onClose={() => setCartOpen(false)}
        items={cartItems}
        subtotal={subtotal}
        serviceFee={serviceFee}
        total={total}
        qualifiesForFreeDelivery={qualifiesForFreeDelivery}
        remainingForFreeDelivery={remainingForFreeDelivery}
        onUpdateQuantity={updateQuantity}
        onRemove={removeItem}
        onClearCart={clearCart}
        onCheckout={handleCheckout}
      />
    </div>
  );
}

export default MenuPage;