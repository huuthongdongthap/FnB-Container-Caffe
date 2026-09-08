import { EventCard } from './events-types';

export const EVENT_CARDS: EventCard[] = [
  {
    id: 'midnight-roast',
    category: 'Workshop',
    icon: '🎪',
    titleVn: 'Hội thảo Rang Đêm',
    titleEn: 'Midnight Roast Workshop',
    date: 'Jul 28',
    time: '7:00 PM',
    spots: 25,
    price: '$45',
    descriptionVn:
      'Khám phá nghệ thuật rang cà phê ban đêm với chuyên gia đầu ngành. Mỗi hạt cà phê có câu chuyện của riêng mình.',
    descriptionEn:
      'Explore the art of after-hours coffee roasting with master roasters. Every bean has its own story to tell.',
    image:
      '/photos/IMG_6697.webp',
    ctaVn: 'Đặt chỗ',
    ctaEn: 'Reserve',
    ctaStyle: 'solid',
  },
  {
    id: 'bronze-tasting',
    category: 'Tasting',
    icon: '🍫',
    titleVn: 'Thử nghiệm Đồng',
    titleEn: 'Bronze Tasting Flight',
    date: 'Aug 3',
    time: '6:30 PM',
    spots: 15,
    price: '$35',
    descriptionVn:
      'Hành trình vị giác qua các loại socola và dessert kết hợp cà phê đặc trưng của AURA.',
    descriptionEn:
      'A sensory journey through artisan chocolates and desserts paired with AURA signature coffee blends.',
    image:
      '/photos/IMG_6565.webp',
    ctaVn: 'Đặt chỗ',
    ctaEn: 'Reserve',
    ctaStyle: 'solid',
  },
  {
    id: 'industrial-night',
    category: 'Seasonal',
    icon: '🎵',
    titleVn: 'Đêm Công nghiệp',
    titleEn: 'Industrial Night',
    date: 'Aug 15',
    time: '8:00 PM',
    spots: 100,
    price: 'Free',
    descriptionVn:
      'Đêm nhạc sống trong không gian công nghiệp, ánh sáng đồng ấm áp. Trải nghiệm âm nhạc và cà phê đỉnh cao.',
    descriptionEn:
      'Live music in an industrial venue bathed in warm bronze light. An immersive audio and coffee experience.',
    image:
      '/photos/IMG_6566.webp',
    ctaVn: 'Đăng ký',
    ctaEn: 'RSVP',
    ctaStyle: 'outline',
  },
];

export const FILTER_TABS = [
  { key: 'all', labelEn: 'All', labelVn: 'Tất cả' },
  { key: 'Workshop', labelEn: 'Workshop', labelVn: 'Hội thảo' },
  { key: 'Tasting', labelEn: 'Tasting', labelVn: 'Thử nghiệm' },
  { key: 'Seasonal', labelEn: 'Seasonal', labelVn: 'Theo mùa' },
];
