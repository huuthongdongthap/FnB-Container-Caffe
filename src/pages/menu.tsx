import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { HelmetHead } from '@/components/seo/HelmetHead';
import { useCustomerMenu, type CustomerMenu, type CustomerMenuItem } from '@/hooks/useCustomerMenu';
import { useCart } from '@/hooks/use-cart';
import { useToast } from '@/components/ui/toast';
import { StitchMenuNew } from '@/components/stitch/StitchMenuNew';
import { CartDrawer } from '@/components/order/cart-drawer';
import { RecommendationSection } from '@/components/menu/recommendation-section';
import type { MenuItemData } from '@/components/stitch/StitchMenuNew';

/* ── Category mapping: API categories → Stitch categories ── */
const CATEGORY_MAP: Record<string, string> = {
  coffee: 'coffee',
  'traditional-coffee': 'coffee',
  'hot-coffee': 'coffee',
  frappuccino: 'coffee',
  tea: 'tea',
  smoothies: 'cold-brew',
  juice: 'cold-brew',
  yogurt: 'cold-brew',
  soda: 'cold-brew',
  'other-drinks': 'cold-brew',
  bottled: 'cold-brew',
  signature: 'signature',
  snacks: 'signature',
  food: 'signature',
  combo: 'signature',
};

function transformToStitchItem(item: CustomerMenuItem): MenuItemData {
  return {
    id: item.id,
    name: item.name,
    description: item.description ?? '',
    price: new Intl.NumberFormat('vi-VN').format(item.priceCents) + '₫',
    imageSrc: item.imageUrl ?? '',
    imageAlt: item.name,
    category: CATEGORY_MAP[item.category] ?? item.category,
    badge: item.tags?.includes('featured') ? 'FEATURED' : undefined,
  };
}

function flattenMenu(menu: CustomerMenu): CustomerMenuItem[] {
  return menu.categories.flatMap((cat) => cat.items);
}

export function MenuPage() {
  const { t, i18n } = useTranslation();
  const navigate = useNavigate();
  const { showToast } = useToast();

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

  /* Transform domain catalog → Stitch format */
  const stitchItems: MenuItemData[] = menu ? flattenMenu(menu).map(transformToStitchItem) : [];

  const handleAddToCart = (stitchItem: MenuItemData) => {
    const original = flattenMenu(menu ?? { categories: [], totalItems: 0 }).find((i) => String(i.id) === stitchItem.id);
    addItem({
      id: stitchItem.id,
      name: stitchItem.name,
      price: original?.priceCents ?? 0,
      image: stitchItem.imageSrc || undefined,
    });
    showToast(`Đã thêm ${stitchItem.name}`, 'success');
  };

  const handleCheckout = () => {
    setCartOpen(false);
    navigate('/checkout');
  };

  const handleRetry = () => {
    refetch();
  };

  /* Loading state while initial data arrives */
  if (isLoading) {
    return (
      <div className="min-h-screen bg-[var(--md-sys-color-surface)] flex items-center justify-center">
        <div className="flex flex-col items-center gap-4">
          <div className="h-8 w-8 animate-spin rounded-full border-2 border-[var(--md-sys-color-primary)] border-t-transparent" />
          <p className="text-sm text-[var(--md-sys-color-on-surface-variant)]">{t('common.loading', 'Đang tải thực đơn...')}</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-[var(--md-sys-color-surface)] flex items-center justify-center p-6">
        <div className="max-w-md text-center">
          <div className="text-6xl mb-4">⚠️</div>
          <h2 className="text-xl font-semibold text-[var(--md-sys-color-on-surface)] mb-2">
            {t('menu.loadError', 'Không thể tải thực đơn')}
          </h2>
          <p className="text-[var(--md-sys-color-on-surface-variant)] mb-6">
            {error instanceof Error ? error.message : String(error)}
          </p>
          <button
            onClick={handleRetry}
            className="inline-flex items-center gap-2 px-6 py-3 bg-[var(--md-sys-color-primary)] text-[var(--md-sys-color-on-primary)] rounded-[var(--md-sys-shape-corner-full)] font-medium"
          >
            {t('common.retry', 'Thử lại')}
          </button>
        </div>
      </div>
    );
  }

  return (
    <>
      <HelmetHead
        title={t('menuSeoTitle', 'Thực Đơn — AURA CAFE')}
        description={t('menuSeoDescription', 'Khám phá thực đơn đồ uống đặc sắc tại AURA CAFE')}
        canonical="/menu"
      />
      <StitchMenuNew
        items={stitchItems}
        brandName="AURA CAFE"
        onAddToCart={handleAddToCart}
        onCartClick={() => setCartOpen(true)}
        cartItemCount={totalItems}
      />

      <RecommendationSection
        excludeIds={new Set(cartItems.map((i) => i.id))}
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
    </>
  );
}

export default MenuPage;