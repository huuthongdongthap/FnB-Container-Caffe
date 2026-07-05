import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { HelmetHead } from '@/components/seo/HelmetHead';
import { useMenuStore } from '@/hooks/stores/use-menu-store';
import { useCart } from '@/hooks/use-cart';
import { StitchMenuNew } from '@/components/stitch/StitchMenuNew';
import { CartDrawer } from '@/components/order/cart-drawer';
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

export function MenuPage() {
  const { t } = useTranslation();
  const navigate = useNavigate();

  const [cartOpen, setCartOpen] = useState(false);
  const [initDone, setInitDone] = useState(false);

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

  const {
    items: menuItems,
    loading,
    fetchMenu,
  } = useMenuStore();

  // Fetch menu on mount
  useEffect(() => {
    fetchMenu().finally(() => setInitDone(true));
  }, [fetchMenu]);

  // Transform API items to Stitch format
  const stitchItems: MenuItemData[] = menuItems.map((item) => ({
    id: String(item.id),
    name: item.name,
    description: item.description,
    price: new Intl.NumberFormat('vi-VN').format(item.price) + '₫',
    imageSrc: item.image ?? '',
    imageAlt: item.name,
    category: CATEGORY_MAP[item.category] ?? item.category,
    badge: item.tags?.includes('featured') ? 'FEATURED' : undefined,
  }));

  const handleAddToCart = (stitchItem: MenuItemData) => {
    const original = menuItems.find((i) => String(i.id) === stitchItem.id);
    addItem({
      id: stitchItem.id,
      name: stitchItem.name,
      price: original?.price ?? 0,
      image: stitchItem.imageSrc || undefined,
    });
  };

  const handleCheckout = () => {
    setCartOpen(false);
    navigate('/checkout');
  };

  // Loading state while initial data arrives
  if (loading || !initDone) {
    return (
      <div className="min-h-screen bg-[color:var(--aura-noir-deep)] flex items-center justify-center">
        <div className="flex flex-col items-center gap-4">
          <div className="h-8 w-8 animate-spin rounded-full border-2 border-[color:var(--aura-forest-primary)] border-t-transparent" />
          <p className="text-sm text-[color:var(--aura-chrome-bright-variant)]">Loading menu...</p>
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
