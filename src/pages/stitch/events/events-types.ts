export interface EventCard {
  id: string;
  category: string;
  icon: string;
  titleVn: string;
  titleEn: string;
  date: string;
  time: string;
  spots: number;
  price: string;
  descriptionVn: string;
  descriptionEn: string;
  image: string;
  ctaVn: string;
  ctaEn: string;
  ctaStyle: 'solid' | 'outline';
}
