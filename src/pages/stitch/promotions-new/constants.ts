import type { CardOffer } from './types';

export const OFFERS: CardOffer[] = [
  {
    id: 1,
    badge: 'MÃ WELCOME -10%',
    title: 'Chào Bạn Mới — Giảm 10% Cho Đơn Đầu Tiên',
    desc: 'Tặng ngay 10% (tối đa 30.000₫) cho tất cả khách hàng lần đầu trải nghiệm cà phê container tại AURA CAFE Sa Đéc.',
    image: '/images/promo-welcome.jpg',
  },
  {
    id: 2,
    badge: 'ĐẶC QUYỀN HỘI VIÊN',
    title: 'Hoàn Tiền Tích Lũy 4 Hạng Thẻ Ví AURA',
    desc: 'Hoàn tiền tự động vào ví từ 3% đến 10% theo từng bậc hội viên: Đồng 1.0x, Bạc 1.1x, Vàng 1.3x, Bạch Kim 1.5x.',
    image: '/images/promo-vip-card.jpg',
    tag: 'CASHBACK ĐẾN 10%',
  },
  {
    id: 3,
    badge: 'GIAO TẬN NƠI',
    title: 'Cà Phê Container Giao Nhanh Tận Nhà',
    desc: 'Giao nhanh nội ô TP. Sa Đéc trong 20 phút, đảm bảo trọn vẹn hương vị mộc nguyên bản và đá xay mát lạnh.',
    image: '/images/promo-delivery.jpg',
    tag: 'GIAO NHANH NỘI Ô',
  },
  {
    id: 4,
    badge: 'KIẾN TRÚC CONTAINER',
    title: 'Không Gian Container Độc Bản & Rooftop',
    desc: 'Khám phá 5 phân khu độc đáo từ 3 khối container hàng hải kiên cố: Quầy Bar, Lounge Thủy Mộc, Sân Thượng Rooftop, Cabin Yên Tĩnh & Sân Vườn Làng Hoa.',
    image: '/images/promo-space.jpg',
    isFullWidth: true,
    btnLabel: 'Khám phá không gian ngay',
  },
];
