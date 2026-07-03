import { useState, useEffect, useCallback } from 'react';
import { cn } from '@/lib/cn';
import type { MenuGroup } from '@/hooks/use-tv-menu';
import { ClipboardList, Clock, Smartphone } from 'lucide-react';

interface MenuSlideshowProps {
  menuGroups: MenuGroup[];
  isHappyHour: boolean;
  lastUpdated: Date | null;
  totalItems: number;
}

export function MenuSlideshow({ menuGroups, isHappyHour, lastUpdated, totalItems }: MenuSlideshowProps) {
  const [currentPage, setCurrentPage] = useState(0);
  const itemsPerPage = 6;
  const totalPages = Math.ceil(menuGroups.length / itemsPerPage) || 1;

  const goNext = useCallback(() => {
    setCurrentPage((prev) => (prev + 1) % totalPages);
  }, [totalPages]);

  useEffect(() => {
    if (!menuGroups.length) return;
    const interval = setInterval(goNext, 15_000);
    return () => clearInterval(interval);
  }, [menuGroups.length, goNext]);

  const visibleGroups = menuGroups.slice(
    currentPage * itemsPerPage,
    (currentPage + 1) * itemsPerPage
  );

  return (
    <div className="tv-menu-slideshow flex flex-col h-full">
      {/* Header */}
      <header className="tv-header flex justify-between items-end pb-5 border-b border-gold mb-6 shrink-0">
        <div>
          <h1 className="font-display text-5xl font-semibold text-gold tracking-wide">
            AURA CAFE
          </h1>
          <span className="text-sm text-gray-400 uppercase tracking-widest ml-1">
            Thực Đơn Hôm Nay
          </span>
        </div>
        <div className="flex items-center gap-4 text-sm text-gray-400">
          <span>
            <span className="w-2 h-2 bg-green-500 rounded-full inline-block mr-1.5" />
            <span id="lastUpdate">
              {lastUpdated
                ? `Cập nhật: ${lastUpdated.toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' })}`
                : 'Đang tải...'}
            </span>
          </span>
        </div>
      </header>

      {/* Happy Hour */}
      {isHappyHour && (
        <div className="happy-hour-banner bg-gold/10 border border-gold rounded-xl px-7 py-3 mb-5 flex items-center justify-center gap-4 shrink-0 animate-pulse">
          <span className="text-2xl"><Clock size={24} className="inline" /></span>
          <span className="text-gold font-medium">HAPPY HOUR &mdash; Giảm</span>
          <span className="text-gold font-mono font-bold">20%</span>
          <span className="text-gold font-medium">đồ uống</span>
          <span className="text-gold font-mono font-bold">14:00 &ndash; 16:00</span>
        </div>
      )}

      {/* Menu Content */}
      <div className="flex-1 overflow-y-auto">
        {menuGroups.length === 0 ? (
          <div className="flex items-center justify-center h-full text-gray-500">
            <span className="text-4xl mr-3"><ClipboardList size={36} className="inline" /></span>
            <span>Thực đơn hiện chưa có món nào</span>
          </div>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-6">
            {visibleGroups.map((group) => (
              <div
                key={group.category}
                className="bg-surface rounded-xl p-6 border border-border/50"
              >
                <h2 className="font-display text-3xl font-semibold text-gold pb-3 mb-4 border-b border-gold/30 tracking-wide">
                  {group.category}
                </h2>
                <div className="space-y-1">
                  {group.items.map((item) => (
                    <div
                      key={item.id}
                      className="flex justify-between items-baseline py-1.5 border-b border-border/30 last:border-b-0"
                    >
                      <span className="text-lg font-body text-gray-200 flex-1 pr-4">
                        {item.name}
                      </span>
                      <span className="text-xl font-medium text-gold whitespace-nowrap">
                        {item.price.toLocaleString('vi-VN')}đ
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Footer */}
      <footer className="shrink-0 flex justify-between items-center pt-5 mt-5 border-t border-border text-sm text-gray-500">
        <span>{totalItems} món</span>
        <span className="flex items-center gap-2 text-gold">
          <span className="text-xl"><Smartphone size={24} className="inline" /></span>
          Quét mã QR để đặt món
        </span>
        <span className="flex items-center gap-1">
          <span className={cn('w-2 h-2 rounded-full', menuGroups.length > 0 ? 'bg-green-500' : 'bg-red-500')} />
          {menuGroups.length > 0 ? 'Online' : 'Lỗi kết nối'}
        </span>
      </footer>

      {/* Page indicator */}
      {totalPages > 1 && (
        <div className="flex justify-center gap-2 mt-4">
          {Array.from({ length: totalPages }, (_, i) => (
            <button
              key={i}
              onClick={() => setCurrentPage(i)}
              className={cn(
                'w-2 h-2 rounded-full transition-all',
                i === currentPage ? 'bg-gold w-4' : 'bg-gray-600'
              )}
              aria-label={`Trang ${i + 1}`}
            />
          ))}
        </div>
      )}
    </div>
  );
}
