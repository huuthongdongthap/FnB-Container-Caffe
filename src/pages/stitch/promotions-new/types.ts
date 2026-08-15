export interface CardOffer {
  id: number;
  badge: string;
  title: string;
  desc: string;
  image: string;
  tag?: string;
  iconAfter?: string;
  btnLabel?: string;
  isFullWidth?: boolean;
}
