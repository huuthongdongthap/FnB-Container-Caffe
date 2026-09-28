export interface TimelineItem {
  readonly phase: string;
  readonly title: string;
  readonly desc: string;
  readonly img: string;
  readonly alt: string;
}

export interface TeamMember {
  readonly name: string;
  readonly role: string;
  readonly img: string;
  readonly alt: string;
}

export const TIMELINE: readonly TimelineItem[] = [
  {
    phase: 'GIAI ĐOẠN 01: 2018',
    title: 'Khởi Nguồn Ý Tưởng & Đam Mê',
    desc: 'Khởi nguồn từ niềm đam mê hạt cà phê mộc và mong muốn kiến tạo một không gian cà phê độc bản giao hòa giữa kiến trúc hiện đại và bản sắc phù sa Sa Đéc.',
    img: '/photos/IMG_6698.webp',
    alt: 'Bản vẽ phác thảo kiến trúc các khối container AURA CAFE.',
  },
  {
    phase: 'GIAI ĐOẠN 02: 2021 - 2023',
    title: 'Kiến Thiết Không Gian Container Độc Bản',
    desc: 'Cải tạo và lắp ghép 3 khối container hàng hải tại 29 Nguyễn Tất Thành, phân bổ thành 5 khu vực trải nghiệm với khung thép kiên cố, vách kính mở toàn cảnh và phủ xanh khuôn viên phong thủy Thủy — Mộc.',
    img: '/photos/IMG_6703.webp',
    alt: 'Quá trình thi công hoàn thiện khung container và vách kính AURA CAFE.',
  },
  {
    phase: 'GIAI ĐOẠN 03: 2024 - 2026',
    title: 'Nâng Tầm Trải Nghiệm & Vận Hành Số',
    desc: 'AURA CAFE chính thức ra mắt nhận diện Luxury Coffee Experience, 5 phân khu trải nghiệm, tiên phong tích hợp gọi món QR, thanh toán số và chăm sóc khách hàng thân thiết.',
    img: '/photos/IMG_6631.webp',
    alt: 'Toàn cảnh AURA CAFE lung linh ánh đèn về đêm tại Sa Đéc.',
  },
] as const;

export const TEAM: readonly TeamMember[] = [
  {
    name: 'Nguyễn Hữu Còn',
    role: 'Nhà Sáng Lập & Điều Hành',
    img: '/photos/IMG_6593.webp',
    alt: 'Chân dung anh Nguyễn Hữu Còn, người sáng lập AURA CAFE Sa Đéc.',
  },
  {
    name: 'Quản Lý Vận Hành',
    role: 'Điều Phối Dịch Vụ & Trải Nghiệm',
    img: '/photos/IMG_6581.webp',
    alt: 'Đội ngũ quản lý vận hành AURA CAFE.',
  },
  {
    name: 'Đội Ngũ Barista',
    role: 'Pha Chế Chuyên Nghiệp',
    img: '/photos/IMG_6554-frame.webp',
    alt: 'Barista tay nghề cao tại quầy bar AURA CAFE.',
  },
  {
    name: 'Đội Ngũ Phục Vụ',
    role: 'Tận Tâm & Chu Đáo',
    img: '/photos/IMG_6555-frame.webp',
    alt: 'Nhân viên phục vụ nhiệt huyết và hiếu khách.',
  },
] as const;

export const HERO_BG =
  '/photos/IMG_6699.webp';
