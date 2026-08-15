export interface Review {
  name: string;
  initials: string;
  date: string;
  rating: number;
  text: string;
  likes: number;
  isChefsChoice?: boolean;
  photos?: string[];
}
