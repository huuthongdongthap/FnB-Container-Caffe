import { Link } from 'react-router-dom';

export function Footer() {
  return (
    <footer className="border-t border-border bg-primary text-white">
      <div className="mx-auto max-w-6xl px-4 py-12">
        {/* 5-Zone grid */}
        <div className="grid grid-cols-2 gap-8 md:grid-cols-5">
          <div>
            <h3 className="font-utility text-xs font-semibold uppercase tracking-wider text-accent">AURA CAFE</h3>
            <ul className="mt-3 space-y-2">
              <li><Link to="/about-us" className="text-sm text-white/70 hover:text-accent-warm">Về chúng tôi</Link></li>
              <li><Link to="/brand-guideline" className="text-sm text-white/70 hover:text-accent-warm">Thương hiệu</Link></li>
              <li><Link to="/contact" className="text-sm text-white/70 hover:text-accent-warm">Liên hệ</Link></li>
            </ul>
          </div>
          <div>
            <h3 className="font-utility text-xs font-semibold uppercase tracking-wider text-accent">Thực đơn</h3>
            <ul className="mt-3 space-y-2">
              <li><Link to="/menu" className="text-sm text-white/70 hover:text-accent-warm">Tất cả</Link></li>
              <li><Link to="/menu?category=cafe" className="text-sm text-white/70 hover:text-accent-warm">Cà phê</Link></li>
              <li><Link to="/menu?category=tra" className="text-sm text-white/70 hover:text-accent-warm">Trà</Link></li>
            </ul>
          </div>
          <div>
            <h3 className="font-utility text-xs font-semibold uppercase tracking-wider text-accent">Dịch vụ</h3>
            <ul className="mt-3 space-y-2">
              <li><Link to="/table-reservation" className="text-sm text-white/70 hover:text-accent-warm">Đặt bàn</Link></li>
              <li><Link to="/track-order" className="text-sm text-white/70 hover:text-accent-warm">Tra cứu đơn</Link></li>
              <li><Link to="/loyalty" className="text-sm text-white/70 hover:text-accent-warm">Tích điểm</Link></li>
            </ul>
          </div>
          <div>
            <h3 className="font-utility text-xs font-semibold uppercase tracking-wider text-accent">Không gian</h3>
            <ul className="mt-3 space-y-2">
              <li><span className="text-sm text-white/70">Jade Counter</span></li>
              <li><span className="text-sm text-white/70">Sky Deck</span></li>
              <li><span className="text-sm text-white/70">Noir Cabin</span></li>
              <li><span className="text-sm text-white/70">Aura Lounge</span></li>
              <li><span className="text-sm text-white/70">VIP Steel Nest</span></li>
            </ul>
          </div>
          <div>
            <h3 className="font-utility text-xs font-semibold uppercase tracking-wider text-accent">Giờ mở cửa</h3>
            <ul className="mt-3 space-y-1">
              <li className="text-sm text-white/70">Thứ 2 - Thứ 6</li>
              <li className="text-sm text-white">6:00 - 22:00</li>
              <li className="mt-2 text-sm text-white/70">Thứ 7 - Chủ Nhật</li>
              <li className="text-sm text-white">6:00 - 23:00</li>
            </ul>
          </div>
        </div>

        <div className="mt-10 border-t border-white/10 pt-6 text-center">
          <p className="text-sm text-white/50">
            © {new Date().getFullYear()} AURA CAFE · 39 Nguyễn Tất Thành, Sa Đéc, Đồng Tháp
          </p>
        </div>
      </div>
    </footer>
  );
}
