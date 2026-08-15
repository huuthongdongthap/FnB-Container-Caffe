import type { OrderItem, BottomNavItem } from './account-types';

export const ORDERS: readonly OrderItem[] = [
  { icon: '☕', name: 'Cà phê Truffle', nameEn: 'Truffle Cortado', time: 'Today 08:45AM', status: 'Preparing', statusVariant: 'default' },
  { icon: '🥐', name: 'Croissant Lá Vàng', nameEn: 'Gold Leaf Croissant', time: 'Yesterday 09:12AM', status: 'Delivered', statusVariant: 'delivered' },
  { icon: '🧊', name: 'Cà phê Đen Đói', nameEn: 'Iced Obsidian Brew', time: 'Oct 24 02:30PM', status: 'Delivered', statusVariant: 'delivered' },
] as const;

export const BOTTOM_NAV: readonly BottomNavItem[] = [
  { icon: '☕', label: 'Reserve', labelEn: 'Reserve', href: '/stitch/reservation' },
  { icon: '✣', label: 'Đơn hàng', labelEn: 'Orders', href: '/stitch/admin-orders' },
  { icon: '⭐', label: 'Điêm thưßng', labelEn: 'Loyalty', href: '/stitch/loyalty' },
  { icon: '👤', label: 'Tài khoãn', labelEn: 'Account', active: true },
  { icon: '⋅', label: 'Thêm', labelEn: 'More', href: '#' },
];
