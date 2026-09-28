import type { Review } from './review-types';

export const FILTERS = ['Tất cả', '5 Sao', 'Có ảnh', 'Mới nhất'] as const;

export const REVIEWS: Review[] = [
  {
    name: 'Hoàng Minh Quân',
    initials: 'HQ',
    date: '15 Thg 03, 2026',
    rating: 5,
    text: '"Không gian container độc nhất vô nhị tại Sa Đéc. Mình ngồi khu sân thượng Rooftop lúc hoàng hôn lộng gió, ngắm view phố hoa cực kỳ chill. Cà phê đậm vị mộc, latte art chuẩn chỉnh. Nhân viên thân thiện và chu đáo."',
    likes: 42,
    isChefsChoice: true,
    photos: [
      '/photos/IMG_6565.webp',
      '/photos/IMG_6631.webp',
    ],
  },
  {
    name: 'Trần Thị Mai Phương',
    initials: 'MP',
    date: '12 Thg 03, 2026',
    rating: 5,
    text: 'Quán có gu thẩm mỹ cao từ kiến trúc kim loại kết hợp kính trong suốt và hồ cảnh Thủy Mộc. Menu phong phú, ly Matcha Latte và Trà Dâu Tằm rất ngon, độ ngọt thanh vừa phải. Rất đáng trải nghiệm khi đến Sa Đéc!',
    likes: 28,
    photos: [
      '/photos/IMG_6696.webp',
    ],
  },
  {
    name: 'Nguyễn Quốc Bảo',
    initials: 'QB',
    date: '08 Thg 03, 2026',
    rating: 5,
    text: 'Khu Cabin làm việc yên tĩnh, wifi cáp quang mạnh, bàn ghế công thái học ngồi cả buổi không mỏi. Gọi món bằng mã QR trên bàn tiện lợi và thanh toán VietQR cực nhanh.',
    likes: 35,
  },
  {
    name: 'Lê Thanh Thảo',
    initials: 'TT',
    date: '01 Thg 03, 2026',
    rating: 5,
    text: 'AURA CAFE có vibe ban đêm lung linh ánh đèn vàng ấm áp rất sang trọng. Cà phê cốt dừa béo ngậy và trà ủ lạnh thơm nức. Gia đình mình ghé cuối tuần ai cũng khen tấm tắc.',
    likes: 19,
    photos: [
      '/photos/IMG_6703.webp',
    ],
  },
  {
    name: 'Phạm Đức Duy',
    initials: 'DD',
    date: '24 Thg 02, 2026',
    rating: 5,
    text: 'Điểm cộng lớn là bãi đỗ xe rộng rãi, phục vụ niềm nở đậm chất người miền Tây hiếu khách. 3 khối container được bố trí bài bản, góc nào lên hình cũng sang xịn.',
    likes: 54,
    photos: [
      '/photos/IMG_6693.webp',
    ],
  },
  {
    name: 'Võ Thị Bích Ngân',
    initials: 'BN',
    date: '18 Thg 02, 2026',
    rating: 5,
    text: 'Âm nhạc lofi nhẹ nhàng, không bị ồn ào. Thích nhất là không gian xanh mát giữa lòng thành phố Sa Đéc. Sẽ còn quay lại thường xuyên!',
    likes: 16,
  },
] as const;
