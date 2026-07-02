import { useState, useMemo, useEffect, useCallback } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { ShoppingBag } from 'lucide-react';
import { useMenuStore } from '@/hooks/stores/use-menu-store';
import { useCart } from '@/hooks/use-cart';
import { MenuGrid } from '@/components/menu/menu-grid';
import { CategoryFilter } from '@/components/menu/category-filter';
import { MenuSearch } from '@/components/menu/menu-search';
import { CartDrawer } from '@/components/order/cart-drawer';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import type { MenuItem } from '@/hooks/use-menu';

export function MenuPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const navigate = useNavigate();

  const urlCategory = searchParams.get('category');
  const [selectedCategory, setSelectedCategory] = useState<string | null>(urlCategory);
  const [searchQuery, setSearchQuery] = useState('');
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

  const {
    items: menuItems,
    categories,
    loading,
    error,
    searchResults,
    fetchMenu,
    searchMenu,
  } = useMenuStore();

  // Fetch menu on mount
  useEffect(() => {
    fetchMenu();
  }, [fetchMenu]);

  // Client-side category + search filtering
  const displayedItems = useMemo(() => {
    let filtered = searchResults ?? menuItems;
    if (selectedCategory) {
      filtered = filtered.filter((item) => item.category === selectedCategory);
    }
    return filtered;
  }, [menuItems, searchResults, selectedCategory]);

  // Sync URL param → state
  useEffect(() => {
    const cat = searchParams.get('category');
    setSelectedCategory(cat || null);
  }, [searchParams]);

  const handleSearchChange = useCallback((value: string) => {
    setSearchQuery(value);
    searchMenu(value);
  }, [searchMenu]);

  const handleCategoryChange = (cat: string | null) => {
    setSelectedCategory(cat);
    setSearchParams(cat ? { category: cat } : {});
  };

  const handleAddToCart = (menuItem: MenuItem) => {
    addItem({
      id: String(menuItem.id),
      name: menuItem.name,
      price: menuItem.price,
      image: menuItem.image,
    });
  };

  const handleCheckout = () => {
    setCartOpen(false);
    navigate('/checkout');
  };

  return (
    <>
      <div className="min-h-screen bg-gradient-to-b from-[#050D1A] via-[#0A1A2E] to-[#0F172A]">
        {/* Header */}
        <div className="border-b border-chrome-light/10 bg-[#0A1A2E]/80 backdrop-blur-sm">
          <div className="mx-auto max-w-6xl px-4 py-6">
            <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <h1 className="font-display text-2xl font-bold text-chrome-bright sm:text-3xl">
                  Thực đơn
                </h1>
                <p className="mt-1 text-sm text-chrome-light/60">
                  {displayedItems.length} món &middot; Cà phê mộc nguyên chất
                </p>
              </div>

              {/* Cart button */}
              <Button
                variant="secondary"
                size="sm"
                onClick={() => setCartOpen(true)}
                className="relative"
              >
                <ShoppingBag className="h-4 w-4" />
                Giỏ hàng
                {totalItems > 0 && (
                  <Badge variant="info" className="ml-1">
                    {totalItems}
                  </Badge>
                )}
              </Button>
            </div>
          </div>
        </div>

        <div className="mx-auto max-w-6xl px-4 py-6">
          {/* Search bar */}
          <div className="mb-6">
            <MenuSearch value={searchQuery} onChange={handleSearchChange} />
          </div>

          {/* Category filter */}
          <div className="mb-8 overflow-x-auto pb-2">
            <CategoryFilter
              categories={categories}
              selected={selectedCategory}
              onSelect={handleCategoryChange}
            />
          </div>

          {/* Menu grid */}
          <MenuGrid
            items={displayedItems}
            isLoading={loading}
            error={error}
            onAddToCart={handleAddToCart}
          />
        </div>
      </div>

      {/* Cart Drawer */}
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
