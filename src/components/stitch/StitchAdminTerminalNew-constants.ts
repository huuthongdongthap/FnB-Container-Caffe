import {
  LayoutDashboard,
  ShoppingCart,
  CreditCard,
  UtensilsCrossed,
  CalendarCheck,
  Users,
  UserCog,
  BarChart3,
  FileBarChart,
  Megaphone,
  Percent,
  Send,
  MessageSquare,
  ScrollText,
  ClipboardCheck,
  RefreshCw,
  Gem,
  Receipt,
  QrCode,
  Cake,
} from 'lucide-react';
import type { NavSectionData } from './StitchAdminTerminalNew-types';

export const SECTIONS: NavSectionData[] = [
  {
    items: [
      { label: 'Tổng quan', labelEn: 'Dashboard', to: '/admin', icon: LayoutDashboard },
    ],
  },
  {
    title: 'Vận hành / Operations',
    items: [
      { label: 'Đơn hàng', labelEn: 'Orders', to: '/admin/orders', icon: ShoppingCart },
      { label: 'POS', labelEn: 'POS', to: '/admin/pos', icon: CreditCard },
      { label: 'Thực đơn', labelEn: 'Menu', to: '/admin/manage-menu', icon: UtensilsCrossed },
      { label: 'Đặt bàn', labelEn: 'Reservations', to: '/admin/reservations', icon: CalendarCheck },
      { label: 'Khách hàng', labelEn: 'Customers', to: '/admin/customers', icon: Users },
      { label: 'Nhân viên', labelEn: 'Staff', to: '/admin/staff', icon: UserCog },
    ],
  },
  {
    title: 'Phân tích / Analytics',
    items: [
      { label: 'Phân tích', labelEn: 'Metrics', to: '/admin/metrics', icon: BarChart3 },
      { label: 'Báo cáo', labelEn: 'Sales Reports', to: '/admin/sales-reports', icon: FileBarChart },
    ],
  },
  {
    title: 'Tiếp thị / Marketing',
    items: [
      { label: 'Chiến dịch', labelEn: 'Campaigns', to: '/admin/campaigns', icon: Megaphone },
      { label: 'Khuyến mãi', labelEn: 'Promotions', to: '/admin/promotions', icon: Percent },
      { label: 'Tin nhắn', labelEn: 'Broadcast', to: '/admin/broadcasts', icon: Send },
    ],
  },
  {
    title: 'Giao tiếp / Communication',
    items: [
      { label: 'Chat', labelEn: 'Chat', to: '/admin/chat', icon: MessageSquare },
    ],
  },
  {
    title: 'Hệ thống / System',
    items: [
      { label: 'Nhật ký', labelEn: 'Audit Logs', to: '/admin/audit-logs', icon: ScrollText },
      { label: 'Duyệt Check-in', labelEn: 'Check-in Approve', to: '/admin/checkin-approve', icon: ClipboardCheck },
      { label: 'Đồng bộ ERPNext', labelEn: 'ERPNext Sync', to: '/admin/erpnext-sync', icon: RefreshCw },
      { label: 'Gói thuê bao', labelEn: 'Subscriptions', to: '/admin/subscriptions', icon: Gem },
      { label: 'Hóa đơn', labelEn: 'Invoices', to: '/admin/invoice-history', icon: Receipt },
      { label: 'QR Code', labelEn: 'QR Codes', to: '/admin/generate-qr', icon: QrCode },
      { label: 'Sinh nhật', labelEn: 'Birthday Config', to: '/admin/birthday-config', icon: Cake },
    ],
  },
];

export const DEFAULT_ADMIN_AVATAR =
  'https://lh3.googleusercontent.com/aida-public/AB6AXuA1O_JHnI2TB5NXoAW5JCxJk1sSSA5-VpsSne05ApSN-rAJ-0nZByALpEIQP0jDi81VcUdUTqmqIPUxAISZG8ce8lE1zr0g9utVt3TdasEGgtqlvwwh5jtT51uOTNZ3Yu5WSCvwy2JgQY8SqO96F5PMwz94ZpMPu4hXscVEgQXsFKCcPEUiXJ3uYozgXn41R0wWQxhmP0CHH6Sf43J3-RX3Mx5wz98iZ2QUlKfUhx-OWXscVee7kNzMR5FbWYCY5z2ZmVc3VODJBqM';
