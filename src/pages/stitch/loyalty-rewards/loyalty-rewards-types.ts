export interface NavLink {
  label: string;
  href: string;
  active?: boolean;
}

export interface Activity {
  activity: string;
  date: string;
  status: string;
  points: string;
}

export interface Reward {
  title: string;
  points: string;
  image: string;
  alt?: string;
}
