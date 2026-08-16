/**
 * RecommendationSection — "Bạn có thể thích" section for the menu page.
 * Shows personalized recommendations based on order history,
 * or popular items as fallback.
 *
 * Compact horizontal scroll layout matching Aura Cafe design system.
 */
import { useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useOrderStore } from '@/hooks/stores/use-order-store';
import { useMenuStore } from '@/hooks/stores/use-menu-store';
import { useCartStore } from '@/hooks/stores/use-cart-store';
import { getRecommendations, getPopularItems, type RecommendationItem } from '@/lib/recommendations';
import { useToast } from '@/components/ui/toast';

interface RecommendationSectionProps {
  /** IDs to exclude from recommendations (e.g., items already in cart) */
  excludeIds?: Set<string>;
}

export function RecommendationSection({ excludeIds = new Set() }: RecommendationSectionProps) {
  const navigate = useNavigate();
  const { showToast } = useToast();
  const orderHistory = useOrderStore((s) => s.orderHistory);
  const menuItems = useMenuStore((s) => s.items);
  const addItem = useCartStore((s) => s.addItem);

  const recommendations = useMemo(() => {
    if (menuItems.length === 0) return [];

    // Build order history from past orders
    const history: Array<Array<{ id: string; name: string; quantity: number }>> = [];
    for (const order of orderHistory) {
      if (Array.isArray(order.items) && order.items.length > 0) {
        history.push(
          order.items
            .filter((i) => i.id)
            .map((i) => ({ id: String(i.id), name: i.name, quantity: i.quantity })),
        );
      }
    }

    const menuForRecs = menuItems.map((i) => ({
      id: String(i.id),
      name: i.name,
      price: i.price,
      image: i.image,
      tags: i.tags,
    }));

    const recs = history.length > 0
      ? getRecommendations(history, menuForRecs, excludeIds)
      : getPopularItems(menuForRecs, excludeIds);

    return recs;
  }, [orderHistory, menuItems, excludeIds]);

  if (recommendations.length === 0) return null;

  const handleAddToCart = (item: RecommendationItem) => {
    addItem({ id: item.id, name: item.name, price: item.price });
    showToast(`Đã thêm ${item.name}`, 'success');
  };

  return (
    <section className="px-5 py-6">
      <h2
        className="text-xl font-medium text-[var(--aura-chrome-bright)] mb-4"
        style={{ fontFamily: '"EB Garamond", Georgia, serif' }}
      >
        Bạn có thể thích
      </h2>

      <div className="flex gap-3 overflow-x-auto pb-2 scrollbar-hide -mx-5 px-5">
        {recommendations.map((item) => (
          <div
            key={item.id}
            className="flex-shrink-0 w-40 rounded-xl overflow-hidden aura-glass"
          >
            {item.image && (
              <img
                src={item.image}
                alt={item.name}
                className="w-full h-28 object-cover"
                loading="lazy"
              />
            )}
            <div className="p-3">
              <p
                className="text-sm font-medium text-[var(--aura-chrome-bright)] truncate"
                style={{ fontFamily: '"EB Garamond", Georgia, serif' }}
              >
                {item.name}
              </p>
              <p className="text-[10px] text-[var(--aura-chrome-mid)] mt-0.5 truncate">
                {item.reason}
              </p>
              <div className="flex items-center justify-between mt-2">
                <span className="text-xs font-semibold text-[var(--aura-chrome-bright)]">
                  {new Intl.NumberFormat('vi-VN').format(item.price)}₫
                </span>
                <button
                  type="button"
                  onClick={() => handleAddToCart(item)}
                  className="w-7 h-7 rounded-full bg-[var(--aura-chrome-mid)]/20 flex items-center justify-center
                    text-[var(--aura-chrome-bright)] hover:bg-[var(--aura-chrome-mid)]/30 transition-colors active:scale-90"
                  aria-label={`Thêm ${item.name}`}
                >
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
                    <line x1="12" y1="5" x2="12" y2="19" />
                    <line x1="5" y1="12" x2="19" y2="12" />
                  </svg>
                </button>
              </div>
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}
