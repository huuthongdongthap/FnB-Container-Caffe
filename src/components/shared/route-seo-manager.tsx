import { useEffect } from 'react';
import { useLocation } from 'react-router-dom';

const SITE_ORIGIN = 'https://auraspace.cafe';

interface RouteSeoEntry {
  title: string;
  description: string;
  markdownHref?: string;
  noindex?: boolean;
}

const ROUTE_SEO: Record<string, RouteSeoEntry> = {
  '/': {
    title: 'AURA CAFE — Container Caffe Sa Đéc & AURA SPACE SaaS',
    description:
      'AURA CAFE — Cà phê container Sa Đéc mộc mạc, bản địa (07:00–23:00) & nền tảng AURA SPACE SaaS v3.0 (POS, QR Order, KDS, 0% hoa hồng) cho quán F&B.',
    markdownHref: '/index.html.md',
  },
  '/menu': {
    title: 'Thực đơn — AURA CAFE Sa Đéc',
    description:
      'Khám phá thực đơn cà phê muối, specialty coffee, trà trái cây Đồng Tháp và đồ ăn nhẹ tại AURA CAFE Sa Đéc. Đặt món QR tại bàn hoặc giao tận nơi.',
    markdownHref: '/menu.md',
  },
  '/pricing': {
    title: 'Bảng giá AURA SPACE SaaS — POS, QR Order & KDS cho quán F&B',
    description:
      'Bảng giá phần mềm quản lý quán cà phê AURA SPACE: Starter 199k, Pro 499k, Chain 1.290k/tháng. 0% hoa hồng đơn hàng, dùng thử miễn phí 14 ngày.',
    markdownHref: '/pricing.md',
  },
  '/signup': {
    title: 'Đăng ký mở quán trong 60 giây — AURA SPACE SaaS',
    description:
      'Tạo hệ thống POS, menu QR tại bàn (/s/:slug) và màn hình bếp KDS cho quán cà phê trong 60 giây. Dùng thử miễn phí 14 ngày, không cần thẻ tín dụng.',
    markdownHref: '/signup.md',
  },
  '/table-reservation': {
    title: 'Đặt bàn — AURA CAFE Sa Đéc',
    description:
      'Đặt bàn trực tuyến tại AURA CAFE Sa Đéc (29 Nguyễn Tất Thành): chọn khu Rooftop, Lounge Thủy Mộc, Phòng Container máy lạnh hoặc Sân Vườn.',
    markdownHref: '/table-reservation.md',
  },
  '/events': {
    title: 'Sự kiện & Acoustic — AURA CAFE Sa Đéc',
    description:
      'Lịch đêm nhạc acoustic, workshop pha chế và sự kiện cộng đồng tại không gian container AURA CAFE Sa Đéc.',
    markdownHref: '/events.md',
  },
  '/promotions': {
    title: 'Ưu đãi & Khuyến mãi — AURA CAFE Sa Đéc',
    description:
      'Cập nhật mã giảm giá, combo đồ uống theo mùa và đặc quyền hội viên AURA Points tại AURA CAFE Sa Đéc.',
    markdownHref: '/promotions.md',
  },
  '/loyalty': {
    title: 'Hội viên AURA Points — AURA CAFE Sa Đéc',
    description:
      'Tích điểm AURA Points mỗi lần ghé quán hoặc đặt món qua QR, thăng hạng thành viên và đổi quà tặng tại AURA CAFE.',
    markdownHref: '/loyalty.md',
  },
  '/about-us': {
    title: 'Câu chuyện AURA CAFE — Kiến trúc Container Bản Địa Sa Đéc',
    description:
      'Hành trình kiến tạo không gian cà phê từ 3 khối container tái chế, thép, kính mờ và gỗ tự nhiên tại Sa Đéc từ năm 2018.',
    markdownHref: '/about-us.md',
  },
  '/contact': {
    title: 'Liên hệ & Chỉ đường — AURA CAFE Sa Đéc',
    description:
      'Địa chỉ AURA CAFE: 29 Nguyễn Tất Thành, Phường 1, TP. Sa Đéc, Đồng Tháp. Mở cửa 07:00 – 23:00 mỗi ngày. Hotline: +84 946 013 633.',
    markdownHref: '/contact.md',
  },
  '/brand-guideline': {
    title: 'Brand Guideline — AURA CAFE Industrial Luxury',
    description:
      'Hệ thống nhận diện thương hiệu Industrial Luxury của AURA CAFE: bảng màu Navy/Bronze/Silver và quy chuẩn thiết kế.',
    markdownHref: '/brand-guideline.md',
  },
};

const NOINDEX_PREFIXES = [
  '/admin',
  '/kds',
  '/kitchen-display',
  '/auth',
  '/portal',
  '/dashboard',
  '/checkout',
  '/success',
  '/failure',
  '/mobile',
];

function setMeta(selector: string, attrName: 'name' | 'property', attrValue: string, content: string): void {
  let el = document.head.querySelector<HTMLMetaElement>(selector);
  if (!el) {
    el = document.createElement('meta');
    el.setAttribute(attrName, attrValue);
    document.head.appendChild(el);
  }
  el.setAttribute('content', content);
}

export function RouteSeoManager(): null {
  const { pathname } = useLocation();

  useEffect(() => {
    const normalized = pathname === '/' ? '/' : pathname.replace(/\/+$/, '');
    const isNoindex = NOINDEX_PREFIXES.some(
      (prefix) => normalized === prefix || normalized.startsWith(`${prefix}/`),
    );

    const entry = ROUTE_SEO[normalized];
    const title = entry?.title ?? 'AURA CAFE — Container Caffe Sa Đéc & AURA SPACE';
    const description =
      entry?.description ??
      'AURA CAFE Sa Đéc — không gian cà phê container bản địa & nền tảng vận hành quán F&B AURA SPACE.';
    const canonicalUrl = `${SITE_ORIGIN}${normalized === '/' ? '/' : normalized}`;

    document.title = title;
    setMeta('meta[name="description"]', 'name', 'description', description);
    setMeta(
      'meta[name="robots"]',
      'name',
      'robots',
      isNoindex || entry?.noindex ? 'noindex, nofollow' : 'index, follow',
    );
    setMeta('meta[property="og:title"]', 'property', 'og:title', title);
    setMeta('meta[property="og:description"]', 'property', 'og:description', description);
    setMeta('meta[property="og:url"]', 'property', 'og:url', canonicalUrl);
    setMeta('meta[name="twitter:title"]', 'name', 'twitter:title', title);
    setMeta('meta[name="twitter:description"]', 'name', 'twitter:description', description);

    let canonical = document.head.querySelector<HTMLLinkElement>('link[rel="canonical"]');
    if (!canonical) {
      canonical = document.createElement('link');
      canonical.setAttribute('rel', 'canonical');
      document.head.appendChild(canonical);
    }
    canonical.setAttribute('href', canonicalUrl);

    if (entry?.markdownHref) {
      let mdAlt = document.head.querySelector<HTMLLinkElement>('link[rel="alternate"][type="text/markdown"]');
      if (!mdAlt) {
        mdAlt = document.createElement('link');
        mdAlt.setAttribute('rel', 'alternate');
        mdAlt.setAttribute('type', 'text/markdown');
        document.head.appendChild(mdAlt);
      }
      mdAlt.setAttribute('href', entry.markdownHref);
    }
  }, [pathname]);

  return null;
}
