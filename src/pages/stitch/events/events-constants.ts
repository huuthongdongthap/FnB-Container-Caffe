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
      'https://lh3.googleusercontent.com/aida-public/AB6AXuB_G8xW5eK_rUqNKtqePhbkH5m_vJrDvmyKSJqFWtxXK-mLvBTDRflKGExMk3N7ZWKsIYnq-Udo6xKIc4p8ijmxmQXbiG1U3_mHXb6L-p7KxksDL78hIqX_0d_eJ0iEc3j20M-hNgJjH92cq2WT3vPzNbB_9tKxCHKXqJZpd3h0cGuw1cb5Mg3-F1x8lQqz5mVP4uENveXSlQPDNomPMz4EVoTfJb63KS0WkAM94U1C5A_9g90TS5GpqVypGgS5GJYwqKk51GO7KI',
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
      'https://lh3.googleusercontent.com/aida-public/AB6AXuCC1nb_nUo9P9Eiz_DjUbpDMrOkh0qShE-Pb1l3fZ7NMjeb_PpJFuBOmKE6FVQyK8x3ls2mb4aBnMVyCV9TMrM3zMwhcOC9bYnDPaJoIm2h4ur5bPKhy3z14d9o9pp-YGrKBZJVDoyLPGvl9mNymNh1Rxftr_7-_Xtj6mI5wDveq0wXhwHr492W-Plcpl8jCfmOBhIouXxPne9qKwf1DCJa7kbVzWEpcNISnLfQo0XPDemdtBF90BaBb-I-j0tGEMnItl72a6c9xw',
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
      'https://lh3.googleusercontent.com/aida-public/AB6AXuDfEHLvxB1M_BDEwW50gq0d5VfKxp1qLd9lHzJZKfJpKJP9pPeBy7lUh8hIVrQen2wrLhFomPBgQa1xBj3fDHcxC6xDRryXMlPU19VFW_6faZ0bbGc4j--wNUPxGjCOUgyr7vFpKMTxsbV8urO0-ZnNznJWZBb3l8ZIauwsJ80IHRCPGpYqF2xf8W5zi6J_phb1mj0MLsURLqd4U9OHyNwgJkQLwnrN-5Si6JKjMgtgGTLGo6tnVhYAsAETQFv7eWcI6UgKljH5kF8',
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
