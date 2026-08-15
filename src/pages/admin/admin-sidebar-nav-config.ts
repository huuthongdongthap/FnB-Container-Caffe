import {
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
  MessageSquare,
  ScrollText,
  ClipboardCheck,
  RefreshCw,
  Gem,
  Receipt,
  QrCode,
  LayoutDashboard,
  Bell,
  TabletSmartphone,
  Cake,
} from 'lucide-react';

export type NavItem = {
  label: string;
  to: string;
  icon: typeof ShoppingCart;
};

export type NavSection = {
  title?: string;
  items: NavItem[];
};

export function getSections(t: (key: string) => string): NavSection[] {
  const item = (key: string, to: string, icon: typeof ShoppingCart): NavItem =>
    ({ label: t(`adminSidebar.items.${key}`), to, icon });
  return [
    {
      items: [
        item('dashboard', '/admin', LayoutDashboard),
      ],
    },
    {
      title: t('adminSidebar.sectionOperations'),
      items: [
        item('orders', '/admin/orders', ShoppingCart),
        item('pos', '/admin/pos', CreditCard),
        item('menu', '/admin/manage-menu', UtensilsCrossed),
        item('reservations', '/admin/reservations', CalendarCheck),
        item('customers', '/admin/customers', Users),
        item('staff', '/admin/staff', UserCog),
        item('devices', '/admin/devices', TabletSmartphone),
      ],
    },
    {
      title: t('adminSidebar.sectionAnalytics'),
      items: [
        item('metrics', '/admin/metrics', BarChart3),
        item('salesReports', '/admin/sales-reports', FileBarChart),
      ],
    },
    {
      title: t('adminSidebar.sectionMarketing'),
      items: [
        item('promotions', '/admin/promotions', Percent),
        item('broadcast', '/admin/broadcast', Megaphone),
        item('chat', '/admin/chat', MessageSquare),
      ],
    },
    {
      title: t('adminSidebar.sectionSystem'),
      items: [
        item('auditLogs', '/admin/audit-logs', ScrollText),
        item('checkinApprove', '/admin/checkin-approve', ClipboardCheck),
        item('erpnext', '/admin/erpnext-sync', RefreshCw),
        item('subscriptions', '/admin/subscriptions', Gem),
        item('invoices', '/admin/invoice-history', Receipt),
        item('qrCodes', '/admin/generate-qr', QrCode),
        item('notifications', '/admin/notification-settings', Bell),
        item('birthdayConfig', '/admin/birthday-config', Cake),
      ],
    },
  ];
}
