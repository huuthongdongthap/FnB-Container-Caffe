import { useState, useMemo, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { HelmetHead } from '@/components/seo/HelmetHead';
import { useCustomerMenu, type CustomerMenu, type CustomerMenuItem } from '@/hooks/useCustomerMenu';
import { useCart } from '@/hooks/use-cart';
import { useCartStore } from '@/hooks/stores/use-cart-store';
import { useToast } from '@/components/ui/toast';
import { StitchMenuNew } from '@/components/stitch/StitchMenuNew';
import { StitchMenuNewSkeleton } from '@/components/stitch/StitchMenuNew-skeleton';
import { LandingNav } from '@/components/stitch/StitchLandingNew-nav';
import { CartDrawer } from '@/components/order/cart-drawer';
import { RecommendationSection } from '@/components/menu/recommendation-section';
import { DrinkCustomizerModal } from '@/components/menu/DrinkCustomizerModal';
import {
  MenuCatalogUnavailableState,
  MenuTableBanner,
} from '@/components/menu/menu-catalog-unavailable-state';
import { isReadyToServeItem } from '@/lib/menu-customization';
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
    // Preserved so the customizer can decide which options apply to this drink.
    tags: item.tags,
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

  useEffect(() => {
    if (!tableNumber) return;
    useCartStore.getState().setTableId(tableNumber);
    try {
      const savedFormRaw = localStorage.getItem('aura_checkout_form');
      const savedForm = savedFormRaw ? JSON.parse(savedFormRaw) : {};
      localStorage.setItem(
        'aura_checkout_form',
        JSON.stringify({
          ...savedForm,
          orderType: 'dine_in',
          tableNumber,
        }),
      );
    } catch {
      /* ignore storage errors */
    }
  }, [tableNumber]);

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

  const { data: menu, isLoading, error, refetch } = useCustomerMenu({
    locale: i18n.language?.startsWith('en') ? 'en-US' : 'vi-VN',
  });

  const stitchItems: MenuItemData[] = useMemo(() => {
    if (!menu?.categories?.length) return [];
    return flattenMenu(menu).map(transformToStitchItem);
  }, [menu]);

  const isCatalogUnavailable = Boolean(error) || stitchItems.length === 0;

  const [customizingItem, setCustomizingItem] = useState<MenuItemData | null>(null);

  const handleAddToCart = (stitchItem: MenuItemData) => {
    // Packaged / Ready-to-serve items (bottled water, canned drinks, yogurt cups, etc.)
    // do not have barista formulation (sweetness, ice, toppings, size).
    // Directly add to cart with 1 click for instant zero-friction experience!
    if (isReadyToServeItem(stitchItem)) {
      const priceNum = parseInt(stitchItem.price.replace(/\D/g, ''), 10) || 0;
      addItem({
        id: stitchItem.id,
        productId: stitchItem.id,
        name: stitchItem.name,
        price: priceNum,
        image: stitchItem.imageSrc || undefined,
        modifiers: [],
        notes: undefined,
      });
      showToast(`Đã thêm ${stitchItem.name} vào giỏ hàng`, 'success');
      return;
    }

    // Craft drinks: Open customization modal so customer can choose sweetness and ice
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
        productId: item.id,
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

      {tableNumber && <MenuTableBanner tableNumber={tableNumber} />}

      {isLoading ? (
        <StitchMenuNewSkeleton />
      ) : isCatalogUnavailable ? (
        <MenuCatalogUnavailableState
          hasError={Boolean(error)}
          onRetry={() => {
            void refetch();
          }}
        />
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
              excludeIds={new Set(cartItems.map((i) => i.productId || i.id))}
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
