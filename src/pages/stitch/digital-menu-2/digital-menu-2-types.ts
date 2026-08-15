export interface MenuItem {
  title: string;
  subtitle: string;
  price: string;
  image: string;
  imageAlt: string;
  tag?: string;
  metric: { label: string; value: string; pct: number };
}

export interface FilterBtn {
  label: string;
  active?: boolean;
}
