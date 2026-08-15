export interface Zone {
  id: string;
  number: string;
  name: string;
  subtitle: string;
  badge: string;
  tagline: string;
  description: string;
  specs: Array<{ label: string; value: string }>;
  icon: string;
}

export const ZONES: Zone[] = [
  {
    id: 'jade-counter',
    number: '01',
    name: 'Quầy Bar',
    subtitle: 'Jade Counter',
    badge: 'JADE COUNTER',
    tagline: 'Mộc Mạc & Tự Nhiên',
    description:
      'Nằm cuối bên phải tầng trệt, quầy container 20ft được chế tác tinh xảo từ gỗ óc chó cao cấp kết hợp mặt đá ngọc bích sang trọng. Bao quanh bởi các chậu cây xanh tươi mát, không gian này mang phong cách Forest Green thanh lịch.',
    specs: [
      { label: 'Thiết kế', value: 'Walnut & Jade' },
      { label: 'Sức chứa', value: '15 khách' },
      { label: 'Phong cách', value: 'Forest Green' },
    ],
    icon: 'leaf',
  },
  {
    id: 'sky-deck',
    number: '02',
    name: 'Rooftop',
    subtitle: 'Sky Deck',
    badge: 'SKY DECK',
    tagline: 'Khoáng Đạt & Lộng Gió',
    description:
      'Sân thượng container tầng 2 thoáng đãng, ngắm trọn vẹn cảnh trời đêm phố thị Sa Đéc lung linh. Lý tưởng để thưởng thức Cold Brew mát lạnh giữa không gian lãng mạn vô tận.',
    specs: [
      { label: 'Độ cao', value: '8m so với mặt phố' },
      { label: 'Sức chứa', value: '40 khách' },
      { label: 'Tầm nhìn', value: 'Phố Sa Đéc lung linh' },
    ],
    icon: 'sunrise',
  },
  {
    id: 'noir-cabin',
    number: '03',
    name: 'Container Seating',
    subtitle: 'Noir Cabin',
    badge: 'NOIR CABIN',
    tagline: 'Ấm Cúng & Công Nghiệp',
    description:
      'Không gian khép kín bên trong container 40ft. Vách thép đen rỉ tự nhiên thô mộc, kết hợp sofa da navy sang trọng. Riêng tư tuyệt đối, ấm cúng.',
    specs: [
      { label: 'Tiện nghi', value: 'Điều hòa & Cách âm' },
      { label: 'Sức chứa', value: '25 khách' },
      { label: 'Vật liệu', value: 'Thép đen rỉ & Da navy' },
    ],
    icon: 'sofa',
  },
  {
    id: 'aura-lounge',
    number: '04',
    name: 'Sunset Corner',
    subtitle: 'Aura Lounge',
    badge: 'AURA LOUNGE',
    tagline: 'Tây Hướng Hoàng Hôn',
    description:
      'Góc Tây đón trọn ánh hoàng hôn rực rỡ. Inox gương và chrome bóng bẩy phản chiếu ánh sáng cực chất &mdash; Industrial Luxury đẳng cấp.',
    specs: [
      { label: 'Giờ vàng', value: '16:30 - 18:00' },
      { label: 'Sức chứa', value: '20 khách' },
      { label: 'Vật liệu', value: 'Inox gương & Chrome' },
    ],
    icon: 'sunset',
  },
  {
    id: 'vip-steel-nest',
    number: '05',
    name: 'VIP Steel Nest',
    subtitle: 'Ban Công Treo',
    badge: 'VIP STEEL NEST',
    tagline: 'Yên Tĩnh & Độc Bản',
    description:
      'Ban công container treo lơ lửng giữa không trung. Biệt lập tuyệt đối, thích hợp cho gặp gỡ đối tác hay những cuộc trò chuyện sâu lắng.',
    specs: [
      { label: 'Vị trí', value: 'Ban công container treo' },
      { label: 'Sức chứa', value: '10 khách' },
      { label: 'Đặc điểm', value: 'Biệt lập & Yên tĩnh' },
    ],
    icon: 'building',
  },
];
