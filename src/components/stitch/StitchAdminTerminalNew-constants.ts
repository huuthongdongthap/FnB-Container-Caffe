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
  TabletSmartphone,
  LayoutGrid,
  Package,
  Settings,
  TrendingUp,
  DollarSign,
  Flame,
} from 'lucide-react';
import type { NavSectionData } from './StitchAdminTerminalNew-types';

export const SECTIONS: NavSectionData[] = [
  {
    items: [
      { label: 'Tổng quan', labelEn: 'Dashboard', to: '/admin', icon: LayoutDashboard },
    ],
  },
  {
    title: 'Vận hành',
    titleKey: 'terminal.section.operations',
    items: [
      { label: 'Đơn hàng', labelEn: 'Orders', to: '/admin/orders', icon: ShoppingCart },
      { label: 'Bếp / KDS', labelEn: 'Kitchen / KDS', to: '/kds', icon: Flame },
      { label: 'POS', labelEn: 'POS', to: '/admin/pos', icon: CreditCard },
      { label: 'Thực đơn', labelEn: 'Menu', to: '/admin/manage-menu', icon: UtensilsCrossed },
      { label: 'Tồn kho', labelEn: 'Inventory', to: '/admin/inventory', icon: Package },
      { label: 'Quản lý bàn', labelEn: 'Tables', to: '/admin/table-management', icon: LayoutGrid },
      { label: 'Thiết bị', labelEn: 'Devices', to: '/admin/devices', icon: TabletSmartphone },
      { label: 'Đặt bàn', labelEn: 'Reservations', to: '/admin/reservations', icon: CalendarCheck },
      { label: 'Khách hàng', labelEn: 'Customers', to: '/admin/customers', icon: Users },
      { label: 'Nhân viên', labelEn: 'Staff', to: '/admin/staff', icon: UserCog },
    ],
  },
  {
    title: 'Phân tích',
    titleKey: 'terminal.section.analytics',
    items: [
      { label: 'Phân tích', labelEn: 'Metrics', to: '/admin/metrics', icon: BarChart3 },
      { label: 'Báo cáo', labelEn: 'Sales Reports', to: '/admin/sales-reports', icon: FileBarChart },
      { label: 'Lãi lỗ & Giá vốn', labelEn: 'P&L & COGS', to: '/admin/revenue-accounting', icon: TrendingUp },
      { label: 'Nhượng quyền', labelEn: 'Franchise & Royalty', to: '/admin/franchise', icon: DollarSign },
    ],
  },
  {
    title: 'Tiếp thị',
    titleKey: 'terminal.section.marketing',
    items: [
      { label: 'Chiến dịch', labelEn: 'Campaigns', to: '/admin/campaigns', icon: Megaphone },
      { label: 'Khuyến mãi', labelEn: 'Promotions', to: '/admin/promotions', icon: Percent },
      { label: 'Tin nhắn', labelEn: 'Broadcast', to: '/admin/broadcasts', icon: Send },
    ],
  },
  {
    title: 'Giao tiếp',
    titleKey: 'terminal.section.communication',
    items: [
      { label: 'Chat', labelEn: 'Chat', to: '/admin/chat', icon: MessageSquare },
    ],
  },
  {
    title: 'Hệ thống',
    titleKey: 'terminal.section.system',
    items: [
      {
        label: 'Cài đặt cửa hàng & SaaS',
        labelEn: 'Store & SaaS Settings',
        to: '/admin/saas-settings',
        access: 'merchantAdmin',
        icon: Settings,
      },
      {
        label: 'HQ Quản trị SaaS',
        labelEn: 'HQ SaaS Admin',
        to: '/admin/hq-saas',
        access: 'hqAdmin',
        icon: LayoutGrid,
      },
      { label: 'Nhật ký', labelEn: 'Audit Logs', to: '/admin/audit-logs', icon: ScrollText },
      { label: 'Duyệt Check-in', labelEn: 'Check-in Approve', to: '/admin/checkin-approve', icon: ClipboardCheck },
      { label: 'Đồng bộ ERPNext', labelEn: 'ERPNext Sync', to: '/admin/erpnext-sync', icon: RefreshCw },
      { label: 'Gói hội viên tại quán', labelEn: 'In-Store Memberships', to: '/admin/subscriptions', icon: Gem },
      { label: 'Hóa đơn', labelEn: 'Invoices', to: '/admin/invoice-history', icon: Receipt },
      { label: 'QR Code', labelEn: 'QR Codes', to: '/admin/generate-qr', icon: QrCode },
      { label: 'Sinh nhật', labelEn: 'Birthday Config', to: '/admin/birthday-config', icon: Cake },
    ],
  },
];

export const DEFAULT_ADMIN_AVATAR =
  '/photos/IMG_6698.webp';
