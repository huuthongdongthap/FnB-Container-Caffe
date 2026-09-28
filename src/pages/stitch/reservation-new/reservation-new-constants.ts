export const GUEST_OPTIONS = ['1 khách', '2 khách', '3 - 4 khách', '5 - 8 khách', 'Nhóm 10+'] as const;
export const TIMES = ['07:30', '09:00', '10:30', '14:00', '16:30', '18:00', '19:30', '20:30', '21:30'] as const;
export const WEEK_DAYS = ['T2', 'T3', 'T4', 'T5', 'T6', 'T7', 'CN'] as const;

export interface Zone {
  id: number;
  name: string;
  subtitle: string;
  desc: string;
  image: string;
  alt: string;
}

export const ZONES: readonly Zone[] = [
  {
    id: 1,
    name: 'Quầy Bar Container',
    subtitle: 'Tầng Trệt • Container 01',
    desc: 'Xem barista pha chế trực tiếp, nhâm nhi cà phê máy & trò chuyện gần gũi.',
    image: '/photos/IMG_6693.webp',
    alt: 'Quầy Bar Container tại AURA CAFE Sa Đéc.',
  },
  {
    id: 2,
    name: 'Phòng Container',
    subtitle: 'Container 40ft • Máy Lạnh',
    desc: 'Ghế mây và ghế nệm êm ái trong không gian container mát lạnh, yên tĩnh — phù hợp làm việc hoặc họp nhóm.',
    image: '/photos/IMG_6565.webp',
    alt: 'Phòng Container mát lạnh tại AURA CAFE Sa Đéc.',
  },
  {
    id: 3,
    name: 'Sân Thượng Rooftop',
    subtitle: 'Tầng Lầu • Không Gian Mở',
    desc: 'Lộng gió trời mát rượi, ngắm hoàng hôn và toàn cảnh Sa Đéc lung linh về đêm.',
    image: '/photos/IMG_6631.webp',
    alt: 'Sân Thượng Rooftop AURA CAFE Sa Đéc.',
  },
  {
    id: 4,
    name: 'Cabin Yên Tĩnh',
    subtitle: 'Góc Làm Việc & Họp Nhóm',
    desc: 'Yên tĩnh, đầy đủ ổ điện, wifi mạnh cho học tập, làm việc hoặc gặp gỡ đối tác.',
    image: '/photos/IMG_6694.webp',
    alt: 'Cabin Yên Tĩnh AURA CAFE Sa Đéc.',
  },
  {
    id: 5,
    name: 'Khu Sân Vườn Ngoài Trời',
    subtitle: 'Khuôn Viên Xanh Làng Hoa',
    desc: 'Bàn gỗ mộc dưới bóng cây hoa lá Sa Đéc, hòa mình vào không khí thoáng đãng.',
    image: '/photos/IMG_6697.webp',
    alt: 'Khu Sân Vườn Ngoài Trời AURA CAFE Sa Đéc.',
  },
] as const;
