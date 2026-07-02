import { Link } from 'react-router-dom';
import { MapPin, Phone, Clock } from 'lucide-react';

export interface StitchFooterProps {
  className?: string;
}

export default function StitchFooter({ className = '' }: StitchFooterProps) {
  return (
    <footer className={'bg-[#0A1A2E] border-t border-white/[0.06] w-full ' + className}>
      <div className="mx-auto max-w-6xl px-4 py-16">
        {/* 3-column grid */}
        <div className="grid grid-cols-1 gap-10 md:grid-cols-3">
          {/* About */}
          <div>
            <Link
              to="/"
              className="text-gradient inline-block font-display text-xl font-bold tracking-wide"
            >
              AURA CAFE
            </Link>
            <p className="mt-4 text-sm leading-relaxed text-[#a0a8b0]">
              Không gian cà phê phong cách container hiện đại tại Sa Dec, Dong Thap.
              Nơi hội tụ của những trải nghiệm ẩm thực độc đáo và kiến trúc sáng tạo.
            </p>
            <div className="mt-6">
              <h4 className="text-gradient font-display text-xs font-semibold uppercase tracking-widest">
                Dịch vụ
              </h4>
              <div className="mt-3 flex flex-wrap gap-x-5 gap-y-2">
                <Link
                  to="/menu"
                  className="text-sm text-[#a0a8b0] transition-colors hover:text-[#b8c7e2]"
                >
                  Thực đơn
                </Link>
                <Link
                  to="/table-reservation"
                  className="text-sm text-[#a0a8b0] transition-colors hover:text-[#b8c7e2]"
                >
                  Đặt bàn
                </Link>
                <Link
                  to="/track-order"
                  className="text-sm text-[#a0a8b0] transition-colors hover:text-[#b8c7e2]"
                >
                  Tra cứu đơn
                </Link>
                <Link
                  to="/reviews"
                  className="text-sm text-[#a0a8b0] transition-colors hover:text-[#b8c7e2]"
                >
                  Đánh giá
                </Link>
                <Link
                  to="/subscriptions"
                  className="text-sm text-[#a0a8b0] transition-colors hover:text-[#b8c7e2]"
                >
                  Thuê Container
                </Link>
              </div>
            </div>
          </div>

          {/* Contact */}
          <div>
            <h3 className="text-gradient font-display text-lg font-semibold tracking-wide">
              Liên hệ
            </h3>
            <ul className="mt-4 space-y-4">
              <li className="flex items-start gap-3 text-sm text-[#a0a8b0]">
                <MapPin className="mt-0.5 h-4 w-4 shrink-0 text-[#b8c7e2]" />
                <span>39 Nguyen Tat Thanh, Sa Dec, Dong Thap</span>
              </li>
              <li className="flex items-start gap-3 text-sm text-[#a0a8b0]">
                <Phone className="mt-0.5 h-4 w-4 shrink-0 text-[#b8c7e2]" />
                <a
                  href="tel:0946013633"
                  className="transition-colors hover:text-[#b8c7e2]"
                >
                  0946 013 633
                </a>
              </li>
              <li className="flex items-start gap-3 text-sm text-[#a0a8b0]">
                <Clock className="mt-0.5 h-4 w-4 shrink-0 text-[#b8c7e2]" />
                <div>
                  <p>Thứ 2 - Thứ 6: 6:00 - 22:00</p>
                  <p>Thứ 7 - Chủ Nhật: 6:00 - 23:00</p>
                </div>
              </li>
            </ul>
          </div>

          {/* Social */}
          <div>
            <h3 className="text-gradient font-display text-lg font-semibold tracking-wide">
              Kết nối
            </h3>
            <div className="mt-4 flex gap-3">
              {/* Facebook */}
              <a
                href="https://facebook.com/auracafe"
                target="_blank"
                rel="noopener noreferrer"
                className="flex h-10 w-10 items-center justify-center rounded-full border border-white/[0.08] text-[#b8c7e2] transition-all hover:bg-[#b8c7e2] hover:text-[#0A1A2E]"
                aria-label="Facebook"
              >
                <svg className="h-5 w-5" fill="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                  <path d="M22 12c0-5.523-4.477-10-10-10S2 6.477 2 12c0 4.991 3.657 9.128 8.438 9.878v-6.987h-2.54V12h2.54V9.797c0-2.506 1.492-3.89 3.777-3.89 1.094 0 2.238.195 2.238.195v2.46h-1.26c-1.243 0-1.63.771-1.63 1.562V12h2.773l-.443 2.89h-2.33v6.988C18.343 21.128 22 16.991 22 12z" />
                </svg>
              </a>
              {/* Instagram */}
              <a
                href="https://instagram.com/auracafe"
                target="_blank"
                rel="noopener noreferrer"
                className="flex h-10 w-10 items-center justify-center rounded-full border border-white/[0.08] text-[#b8c7e2] transition-all hover:bg-[#b8c7e2] hover:text-[#0A1A2E]"
                aria-label="Instagram"
              >
                <svg className="h-5 w-5" fill="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                  <path d="M12.315 2c2.43 0 2.784.013 3.808.06 1.064.049 1.791.218 2.427.465a4.902 4.902 0 011.772 1.153 4.902 4.902 0 011.153 1.772c.247.636.416 1.363.465 2.427.048 1.067.06 1.407.06 4.123v.08c0 2.643-.012 2.987-.06 4.043-.049 1.064-.218 1.791-.465 2.427a4.902 4.902 0 01-1.153 1.772 4.902 4.902 0 01-1.772 1.153c-.636.247-1.363.416-2.427.465-1.067.048-1.407.06-4.123.06h-.08c-2.643 0-2.987-.012-4.043-.06-1.064-.049-1.791-.218-2.427-.465a4.902 4.902 0 01-1.772-1.153 4.902 4.902 0 01-1.153-1.772c-.247-.636-.416-1.363-.465-2.427-.047-1.024-.06-1.379-.06-3.808v-.63c0-2.43.013-2.784.06-3.808.049-1.064.218-1.791.465-2.427a4.902 4.902 0 011.153-1.772A4.902 4.902 0 016.38 2.525c.636-.247 1.363-.416 2.427-.465C8.56 2.013 8.914 2 11.372 2h.943z" />
                  <path fillRule="evenodd" clipRule="evenodd" d="M12.315 17.632a5.632 5.632 0 100-11.264 5.632 5.632 0 000 11.264zm0-2.09a3.542 3.542 0 110-7.084 3.542 3.542 0 010 7.084z" />
                  <circle cx="17.736" cy="6.264" r="1.317" />
                </svg>
              </a>
              {/* TikTok */}
              <a
                href="https://tiktok.com/@auracafe"
                target="_blank"
                rel="noopener noreferrer"
                className="flex h-10 w-10 items-center justify-center rounded-full border border-white/[0.08] text-[#b8c7e2] transition-all hover:bg-[#b8c7e2] hover:text-[#0A1A2E]"
                aria-label="TikTok"
              >
                <svg className="h-5 w-5" fill="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                  <path d="M12.525.02c1.31-.02 2.61-.01 3.91-.02.08 1.53.63 3.09 1.75 4.17 1.12 1.11 2.7 1.62 4.24 1.79v4.03c-1.44-.05-2.89-.35-4.2-.97-.57-.26-1.1-.59-1.62-.93-.01 2.92.01 5.84-.02 8.75-.08 1.4-.54 2.79-1.35 3.94-1.31 1.92-3.58 3.17-5.91 3.21-1.43.08-2.86-.31-4.08-1.03-2.02-1.19-3.44-3.37-3.65-5.71-.02-.5-.03-1-.01-1.49.18-1.9 1.12-3.72 2.58-4.96 1.66-1.44 3.98-2.13 6.15-1.72.02 1.48-.04 2.96-.04 4.44-.99-.32-2.15-.23-3.02.37-.63.41-1.11 1.04-1.36 1.75-.21.51-.15 1.07-.14 1.61.24 1.64 1.82 3.02 3.5 2.87 1.12-.01 2.19-.66 2.77-1.61.19-.33.4-.67.41-1.06.1-1.79.06-3.57.07-5.36.01-4.03-.01-8.05.02-12.07z" />
                </svg>
              </a>
            </div>
          </div>
        </div>

        {/* Copyright */}
        <div className="mt-12 border-t border-white/[0.06] pt-6 text-center">
          <p className="text-xs text-[#a0a8b0]">
            &copy; {new Date().getFullYear()} AURA CAFE &middot; 39 Nguyen Tat Thanh, Sa Dec, Dong Thap
          </p>
        </div>
      </div>
    </footer>
  );
}
