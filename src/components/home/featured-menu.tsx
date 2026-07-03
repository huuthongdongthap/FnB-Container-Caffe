import { useEffect } from 'react';
import { Link } from 'react-router-dom';
import { useMenuStore } from '@/hooks/stores/use-menu-store';
import { MenuCard } from '@/components/menu/menu-card';
import { useCart } from '@/hooks/use-cart';
import type { MenuItem } from '@/hooks/use-menu';

export function FeaturedMenu() {
  const { items, loading, fetchMenu } = useMenuStore();
  const { addItem } = useCart();

  useEffect(() => {
    fetchMenu();
  }, [fetchMenu]);

  const handleAddToCart = (item: MenuItem) => {
    addItem({
      id: String(item.id),
      name: item.name,
      price: item.price,
      image: item.image,
    });
  };

  return (
    <section className="bg-gradient-to-b from-[#050D1A] to-[#0A1A2E] py-20" aria-label="Thực đơn nổi bật">
      <div className="mx-auto max-w-6xl px-4">
        <div className="mb-10 text-center">
          <span className="text-xs font-semibold uppercase tracking-[0.2em] text-chrome-mid/60">
            01 &mdash; THỰC ĐƠN NỔI BẬT
          </span>
          <h2 className="mt-3 font-display text-3xl font-bold text-chrome-bright sm:text-4xl">
            Món Được Yêu Thích Nhất
          </h2>
          <p className="mx-auto mt-3 max-w-2xl text-chrome-light/60">
            Specialty coffee &amp; đồ uống signature độc quyền &mdash; chế biến thủ công
            mỗi ngày từ hạt cà phê mộc nguyên chất.
          </p>
        </div>

        {loading ? (
          <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="aspect-[3/4] animate-shimmer rounded-xl border border-chrome-light/5" />
            ))}
          </div>
        ) : items.length === 0 ? (
          <p className="text-center text-chrome-light/40">Chưa có món nổi bật.</p>
        ) : (
          <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {items.filter((i) => i.available).slice(0, 6).map((item) => (
              <MenuCard key={item.id} item={item} onAddToCart={handleAddToCart} />
            ))}
          </div>
        )}

        <div className="mt-10 text-center">
          <Link
            to="/menu"
            className="inline-flex min-h-[44px] items-center gap-2 text-sm font-semibold text-chrome-light transition-colors hover:text-chrome-bright"
          >
            Xem Toàn Bộ Menu <span>&rarr;</span>
          </Link>
        </div>
      </div>
    </section>
  );
}
