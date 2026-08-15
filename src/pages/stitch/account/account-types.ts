export interface OrderItem {
  icon: string;
  name: string;
  nameEn: string;
  time: string;
  status: string;
  statusVariant: 'default' | 'delivered';
}

export interface BottomNavItem {
  icon: string;
  label: string;
  labelEn: string;
  href?: string;
  active?: boolean;
}
