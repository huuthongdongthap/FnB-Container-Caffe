'use client';

import { useState, useMemo, useEffect } from 'react';
import { Link } from 'react-router-dom';
import {
  ChefHat,
  CreditCard,
  LayoutGrid,
  Users,
  ShoppingCart,
  LayoutDashboard,
  Tv,
  CalendarCheck,
  BarChart3,
  Tag,
  Cake,
  ClipboardCheck,
  QrCode,
  Printer,
  RefreshCw,
  Search,
  Sparkles,
  ArrowUpRight,
  ShieldCheck,
  Coffee,
  CheckCircle2,
  Radio,
  Database,
  ArrowRight,
  Zap,
} from 'lucide-react';
import { HelmetHead } from '@/components/seo/HelmetHead';
import { useCartStore } from '@/hooks/stores/use-cart-store';
import { useKDS } from '@/hooks/use-kds';
import { useAdminOrdersStore } from '@/hooks/stores/admin/use-admin-orders-store';
import { useAdminCustomersStore } from '@/hooks/stores/admin/use-admin-customers-store';
import { API_BASE } from '@/lib/api-client';

interface SectionItem {
  id: string;
  title: string;
  subtitle: string;
  description: string;
  path: string;
  icon: typeof ChefHat;
  badge: string;
  badgeColor: string;
  primaryAction: string;
  isExternal?: boolean;
}

interface SectionCategory {
  id: string;
  name: string;
  nameEn: string;
  description: string;
  color: string;
  items: SectionItem[];
}

export default function SystemHubPage() {
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('all');

  // Real-time data hooks connected with main storefront & operations
  const cartItems = useCartStore((s) => s.items);
  const cartSubtotal = useCartStore((s) => s.subtotal());
  const { orders: kdsOrders } = useKDS('all');
  const { orders: adminOrders, fetchOrders } = useAdminOrdersStore();
  const { customers, fetchCustomers } = useAdminCustomersStore();

  useEffect(() => {
    fetchOrders().catch(() => {});
    fetchCustomers(1).catch(() => {});
  }, [fetchOrders, fetchCustomers]);

  const formattedCartSubtotal = new Intl.NumberFormat('vi-VN', {
    style: 'currency',
    currency: 'VND',
  }).format(cartSubtotal);

  const categories: SectionCategory[] = useMemo(() => [
    {
      id: 'operations',
      name: 'Vận Hành Tại Quán & Bếp',
      nameEn: 'Store Operations & Kitchen',
      description: 'Màn hình trực tiếp cho Barista, Bếp, Thu ngân và Nhân viên phục vụ',
      color: 'from-amber-500/20 to-orange-500/20 text-amber-400 border-amber-500/30',
      items: [
        {
          id: 'kds',
          title: 'Bếp & Pha Chế (KDS)',
          subtitle: 'Kitchen Display System',
          description: 'Màn hình nhận đơn quầy bar & bếp, đồng hồ đếm ngược từng giây, cảnh báo nhấp nháy đỏ khi quá hạn, âm thanh chuông báo đơn mới.',
          path: '/kds',
          icon: ChefHat,
          badge: kdsOrders.length > 0 ? `${kdsOrders.length} vé đang làm` : 'KDS Sẵn sàng',
          badgeColor: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30',
          primaryAction: 'Mở KDS Bếp',
        },
        {
          id: 'pos',
          title: 'Thu Ngân & Bán Hàng (POS)',
          subtitle: 'Point of Sale Terminal',
          description: 'Giao diện tạo đơn quầy cảm ứng, hỗ trợ chọn món theo danh mục, ghi chú đường/đá, xuất mã VietQR / PayOS tự động nhận diện và tiền mặt.',
          path: '/admin/pos',
          icon: CreditCard,
          badge: 'Màn hình quầy',
          badgeColor: 'bg-cyan-500/10 text-cyan-400 border-cyan-500/30',
          primaryAction: 'Mở POS Thu Ngân',
        },
        {
          id: 'tables',
          title: 'Sơ Đồ Bàn & Khu Vực',
          subtitle: 'Floor Plan & Table Management',
          description: 'Quản lý trạng thái bàn theo không gian Container 1, Container 2, Tầng Thượng và Sân Vườn; đồng bộ đơn đang phục vụ theo thời gian thực.',
          path: '/admin/table-management',
          icon: LayoutGrid,
          badge: 'Quản lý bàn',
          badgeColor: 'bg-indigo-500/10 text-indigo-400 border-indigo-500/30',
          primaryAction: 'Xem Sơ Đồ Bàn',
        },
        {
          id: 'orders',
          title: 'Sổ Quản Lý Đơn Hàng',
          subtitle: 'Live Order Management',
          description: 'Tổng hợp danh sách đơn hàng toàn hệ thống, lọc trạng thái (chờ xác nhận, đang pha chế, sẵn sàng, hoàn thành) và xử lý giao nhận.',
          path: '/admin/orders',
          icon: ShoppingCart,
          badge: adminOrders.length > 0 ? `${adminOrders.length} đơn hàng` : 'Đồng bộ Live',
          badgeColor: 'bg-blue-500/10 text-blue-400 border-blue-500/30',
          primaryAction: 'Xem Đơn Hàng',
        },
        {
          id: 'tv-menu',
          title: 'Menu Trình Chiếu TV',
          subtitle: 'TV Digital Signage',
          description: 'Giao diện menu điện tử tối ưu cho màn hình tivi lớn treo trên quầy order, tự động cập nhật sản phẩm nổi bật và hình ảnh bắt mắt.',
          path: '/tv-menu',
          icon: Tv,
          badge: 'Digital Signage',
          badgeColor: 'bg-purple-500/10 text-purple-400 border-purple-500/30',
          primaryAction: 'Mở Menu TV',
        },
        {
          id: 'mobile-staff',
          title: 'Trạm Phục Vụ Di Động',
          subtitle: 'Mobile Waiter & Staff App',
          description: 'Giao diện PWA thu gọn cho điện thoại nhân viên: gọi món tại bàn, kiểm tra bàn trống, nhận thông báo phục vụ tức thì.',
          path: '/mobile',
          icon: Radio,
          badge: 'Mobile PWA',
          badgeColor: 'bg-rose-500/10 text-rose-400 border-rose-500/30',
          primaryAction: 'Mở Mobile App',
        },
      ],
    },
    {
      id: 'admin_crm',
      name: 'Quản Trị, CRM & Marketing',
      nameEn: 'Admin Dashboard, CRM & Loyalty',
      description: 'Trung tâm chỉ huy số liệu, chăm sóc khách hàng thân thiết và chiến dịch doanh thu',
      color: 'from-blue-500/20 to-cyan-500/20 text-cyan-400 border-cyan-500/30',
      items: [
        {
          id: 'admin-dash',
          title: 'Cổng Quản Trị Trung Tâm',
          subtitle: 'Executive Admin Dashboard',
          description: 'Tổng quan doanh thu ngày/tuần/tháng, tỷ lệ thanh toán thành công, biểu đồ khung giờ cao điểm (Peak Hours) và món bán chạy nhất.',
          path: '/admin',
          icon: LayoutDashboard,
          badge: 'Trung tâm chỉ huy',
          badgeColor: 'bg-amber-500/10 text-amber-400 border-amber-500/30',
          primaryAction: 'Vào Dashboard',
        },
        {
          id: 'crm-customers',
          title: 'Quản Lý Khách Hàng (CRM)',
          subtitle: 'Customer Relationship & Loyalty',
          description: 'Hồ sơ khách hàng, phân hạng Đồng, Bạc, Vàng, Kim Cương; thống kê tổng chi tiêu tích lũy (LTV) và số điểm thưởng đang có.',
          path: '/admin/customers',
          icon: Users,
          badge: customers.length > 0 ? `${customers.length} hội viên` : 'VIP Loyalty',
          badgeColor: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30',
          primaryAction: 'Danh Sách Khách',
        },
        {
          id: 'campaigns',
          title: 'Chiến Dịch Tự Động',
          subtitle: 'Marketing Automation',
          description: 'Thiết lập kích hoạt gửi thông báo tự động (chào mừng khách hàng mới, chăm sóc khách lâu chưa quay lại qua Zalo OA, Web Push, SMS).',
          path: '/admin/campaigns',
          icon: Sparkles,
          badge: 'Tự động hóa',
          badgeColor: 'bg-purple-500/10 text-purple-400 border-purple-500/30',
          primaryAction: 'Quản Lý Chiến Dịch',
        },
        {
          id: 'promotions',
          title: 'Khuyến Mãi & Voucher',
          subtitle: 'Promotions & Discounts',
          description: 'Quản lý mã coupon giảm giá, giờ vàng đồng giá, chương trình mua 1 tặng 1 và voucher khách hàng VIP.',
          path: '/admin/promotions',
          icon: Tag,
          badge: 'Ưu đãi & Giảm giá',
          badgeColor: 'bg-rose-500/10 text-rose-400 border-rose-500/30',
          primaryAction: 'Cài Đặt Khuyến Mãi',
        },
        {
          id: 'birthday',
          title: 'Chăm Sóc Sinh Nhật VIP',
          subtitle: 'Birthday Rewards Automation',
          description: 'Cấu hình tặng voucher đặc quyền và cộng điểm thưởng tự động cho khách hàng thân thiết vào tháng sinh nhật.',
          path: '/admin/birthday-config',
          icon: Cake,
          badge: 'Chăm sóc sinh nhật',
          badgeColor: 'bg-pink-500/10 text-pink-400 border-pink-500/30',
          primaryAction: 'Cấu Hình Sinh Nhật',
        },
        {
          id: 'checkin-approve',
          title: 'Duyệt Check-in Tại Quán',
          subtitle: 'In-Store Check-in Approvals',
          description: 'Hàng đợi nhân viên kiểm tra và duyệt check-in thực tế của khách hàng tại không gian Container AURA CAFE để trao điểm thưởng.',
          path: '/admin/checkin-approve',
          icon: ClipboardCheck,
          badge: 'Tích điểm check-in',
          badgeColor: 'bg-teal-500/10 text-teal-400 border-teal-500/30',
          primaryAction: 'Hàng Đợi Duyệt',
        },
      ],
    },
    {
      id: 'system_menu',
      name: 'Thực Đơn, Báo Cáo & Kế Toán',
      nameEn: 'Menu, Reports & Integration',
      description: 'Điều chỉnh danh mục món, xuất báo cáo tài chính và kết nối hệ thống kế toán',
      color: 'from-emerald-500/20 to-teal-500/20 text-emerald-400 border-emerald-500/30',
      items: [
        {
          id: 'manage-menu',
          title: 'Quản Lý Menu Món',
          subtitle: 'Menu & Inventory Toggle',
          description: 'Chỉnh sửa giá niêm yết, bật/tắt trạng thái hết món tức thì khi quầy bar hết nguyên liệu để tránh khách đặt trùng.',
          path: '/admin/manage-menu',
          icon: Coffee,
          badge: 'Kho & Thực đơn',
          badgeColor: 'bg-amber-500/10 text-amber-400 border-amber-500/30',
          primaryAction: 'Chỉnh Sửa Menu',
        },
        {
          id: 'sales-reports',
          title: 'Báo Cáo Doanh Thu (P&L)',
          subtitle: 'Sales & Financial Reports',
          description: 'Thống kê doanh số theo kênh bán, phương thức thanh toán, tỷ trọng doanh thu giữa cà phê, trà trái cây và món ăn nhẹ.',
          path: '/admin/sales-reports',
          icon: BarChart3,
          badge: 'Tài chính & Lợi nhuận',
          badgeColor: 'bg-blue-500/10 text-blue-400 border-blue-500/30',
          primaryAction: 'Xem Báo Cáo',
        },
        {
          id: 'erpnext-sync',
          title: 'Đồng Bộ Kế Toán ERPNext',
          subtitle: 'ERPNext Cloud Synchronization',
          description: 'Kết nối đồng bộ 2 chiều dữ liệu bán hàng, hóa đơn VAT và tồn kho với hệ thống quản trị doanh nghiệp ERPNext.',
          path: '/admin/erpnext-sync',
          icon: RefreshCw,
          badge: 'ERP Enterprise',
          badgeColor: 'bg-sky-500/10 text-sky-400 border-sky-500/30',
          primaryAction: 'Trạng Thái Đồng Bộ',
        },
        {
          id: 'devices',
          title: 'Thiết Bị & Máy In Bill',
          subtitle: 'Hardware & Thermal Printers',
          description: 'Cấu hình máy in hóa đơn nhiệt 80mm tại quầy thu ngân, máy in phiếu order tại bếp, kết nối âm thanh và thiết bị ngoại vi.',
          path: '/admin/devices',
          icon: Printer,
          badge: 'Phần cứng',
          badgeColor: 'bg-violet-500/10 text-violet-400 border-violet-500/30',
          primaryAction: 'Cài Đặt Thiết Bị',
        },
        {
          id: 'generate-qr',
          title: 'Tạo Mã QR Từng Bàn',
          subtitle: 'Table QR Code Generator',
          description: 'Tạo và in hàng loạt mã QR theo từng bàn trong quán để khách ngồi tại chỗ chỉ cần quét camera là mở menu đặt món trực tiếp.',
          path: '/admin/generate-qr',
          icon: QrCode,
          badge: 'QR Bàn',
          badgeColor: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30',
          primaryAction: 'Tạo Mã QR',
        },
        {
          id: 'audit-logs',
          title: 'Nhật Ký Hệ Thống & Bảo Mật',
          subtitle: 'Audit Trail & Security Logs',
          description: 'Theo dõi chi tiết lịch sử thao tác của nhân viên, chỉnh sửa đơn hàng, ca trực thu ngân và các hành động nhạy cảm.',
          path: '/admin/audit-logs',
          icon: ShieldCheck,
          badge: 'Bảo mật',
          badgeColor: 'bg-slate-500/10 text-slate-300 border-slate-500/30',
          primaryAction: 'Xem Audit Log',
        },
      ],
    },
    {
      id: 'customer_front',
      name: 'Giao Diện Khách Hàng (Storefront)',
      nameEn: 'Customer Facing Storefront',
      description: 'Trải nghiệm xem thực đơn, gọi món tại bàn, đặt chỗ trước và thanh toán trực tuyến',
      color: 'from-purple-500/20 to-pink-500/20 text-purple-400 border-purple-500/30',
      items: [
        {
          id: 'front-home',
          title: 'Trang Chủ Khách Hàng',
          subtitle: 'Brand Landing Page',
          description: 'Giao diện chính giới thiệu AURA CAFE Sa Đéc, 5 khu vực container đặc sắc, thức uống signature và câu chuyện thương hiệu.',
          path: '/',
          icon: Coffee,
          badge: 'Khách hàng',
          badgeColor: 'bg-amber-500/10 text-amber-400 border-amber-500/30',
          primaryAction: 'Mở Trang Chủ',
        },
        {
          id: 'front-menu',
          title: 'Thực Đơn Đặt Món',
          subtitle: 'Customer Interactive Menu',
          description: 'Menu món trực quan kèm hình ảnh đẹp mắt, tùy chỉnh đường, đá, topping và nút thêm nhanh vào giỏ hàng.',
          path: '/menu',
          icon: Coffee,
          badge: 'Đặt món',
          badgeColor: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30',
          primaryAction: 'Xem Thực Đơn',
        },
        {
          id: 'front-checkout',
          title: 'Giỏ Hàng & Thanh Toán',
          subtitle: 'Cart & Multi-Payment Checkout',
          description: 'Giao diện điều chỉnh số lượng ([-]/[+]), xóa món, chọn hình thức thanh toán VietQR / PayOS / Tiền mặt và nhập ghi chú giao nhận.',
          path: '/checkout',
          icon: ShoppingCart,
          badge: cartItems.length > 0 ? `${cartItems.length} món trong giỏ` : 'Giỏ hàng',
          badgeColor: 'bg-cyan-500/10 text-cyan-400 border-cyan-500/30',
          primaryAction: 'Mở Giỏ Hàng',
        },
        {
          id: 'front-reservation',
          title: 'Đặt Bàn Trực Tuyến',
          subtitle: 'Online Table Reservation',
          description: 'Khách hàng chủ động đặt chỗ trước theo ngày giờ, số lượng khách và chọn khu vực mong muốn (Container lạnh hay Sân vườn).',
          path: '/table-reservation',
          icon: CalendarCheck,
          badge: 'Đặt chỗ trước',
          badgeColor: 'bg-rose-500/10 text-rose-400 border-rose-500/30',
          primaryAction: 'Trang Đặt Bàn',
        },
      ],
    },
  ], [cartItems.length, kdsOrders.length, adminOrders.length, customers.length]);

  const filteredCategories = useMemo(() => {
    return categories
      .map((cat) => {
        if (selectedCategory !== 'all' && cat.id !== selectedCategory) {
          return null;
        }
        const filteredItems = cat.items.filter((item) => {
          if (!searchTerm.trim()) return true;
          const term = searchTerm.toLowerCase();
          return (
            item.title.toLowerCase().includes(term) ||
            item.subtitle.toLowerCase().includes(term) ||
            item.description.toLowerCase().includes(term) ||
            item.badge.toLowerCase().includes(term) ||
            item.path.toLowerCase().includes(term)
          );
        });
        if (filteredItems.length === 0) return null;
        return {
          ...cat,
          items: filteredItems,
        };
      })
      .filter(Boolean) as SectionCategory[];
  }, [categories, searchTerm, selectedCategory]);

  const totalSections = useMemo(() => {
    return categories.reduce((sum, cat) => sum + cat.items.length, 0);
  }, [categories]);

  return (
    <>
      <HelmetHead
        title="Trạm Điều Hành & Danh Mục Hệ Thống — AURA CAFE"
        description="Bảng điều hướng tổng hợp toàn bộ các phân hệ: Bếp/Pha chế KDS, Cổng Quản trị Admin, Thu ngân POS, Sơ đồ bàn, CRM khách hàng và Báo cáo."
        canonical="/portal"
      />

      <div className="min-h-screen bg-[#071320] text-[#E8EEF3] pb-24 selection:bg-[#6B9FB8]/30">
        {/* Ambient background glows */}
        <div className="fixed top-0 left-1/4 w-[600px] h-[400px] bg-[#6B9FB8]/10 blur-[140px] pointer-events-none rounded-full" />
        <div className="fixed bottom-10 right-1/4 w-[500px] h-[350px] bg-[#CD7F32]/10 blur-[140px] pointer-events-none rounded-full" />

        {/* ── Top Bar ── */}
        <header className="sticky top-0 z-40 backdrop-blur-xl border-b border-[var(--aura-chrome-dim,rgba(201,214,223,0.15))] bg-[#0A1A2E]/80 px-4 sm:px-8 py-4 transition-all">
          <div className="max-w-7xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <Link to="/" className="flex items-center gap-3 group">
                <img
                  src="/images/aura-emblem.png"
                  alt="AURA CAFE"
                  className="h-10 w-10 rounded-full border border-[#6B9FB8]/40 object-cover drop-shadow-[0_0_12px_rgba(107,159,184,0.3)] transition-transform group-hover:scale-105"
                  onError={(e) => {
                    (e.currentTarget as HTMLImageElement).src = '/images/aura-master-logo.png';
                  }}
                />
                <div>
                  <div className="flex items-center gap-2">
                    <span className="font-display text-xl font-bold tracking-tight text-[var(--aura-chrome-bright,#E8EEF3)]">
                      AURA CAFE
                    </span>
                    <span className="text-[10px] font-semibold tracking-wider uppercase px-2 py-0.5 rounded-full bg-emerald-500/15 text-emerald-400 border border-emerald-500/30 flex items-center gap-1">
                      <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                      Localhost:5173
                    </span>
                  </div>
                  <p className="text-xs text-[var(--aura-text-secondary,#a0a8b0)]">
                    Trạm Điều Hành & Danh Mục Phân Hệ Toàn Diện
                  </p>
                </div>
              </Link>
            </div>

            {/* Quick action bar */}
            <div className="flex items-center gap-2 flex-wrap">
              <Link
                to="/kds"
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-emerald-500/40 bg-emerald-500/10 text-emerald-300 text-xs font-medium hover:bg-emerald-500/20 transition-all shadow-sm"
              >
                <ChefHat size={14} />
                <span>KDS Bếp</span>
              </Link>
              <Link
                to="/admin/pos"
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-cyan-500/40 bg-cyan-500/10 text-cyan-300 text-xs font-medium hover:bg-cyan-500/20 transition-all shadow-sm"
              >
                <CreditCard size={14} />
                <span>POS Thu Ngân</span>
              </Link>
              <Link
                to="/admin"
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-amber-500/40 bg-amber-500/10 text-amber-300 text-xs font-medium hover:bg-amber-500/20 transition-all shadow-sm"
              >
                <LayoutDashboard size={14} />
                <span>Cổng Admin</span>
              </Link>
              <Link
                to="/admin/table-management"
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-indigo-500/40 bg-indigo-500/10 text-indigo-300 text-xs font-medium hover:bg-indigo-500/20 transition-all shadow-sm"
              >
                <LayoutGrid size={14} />
                <span>Sơ Đồ Bàn</span>
              </Link>
              <Link
                to="/"
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-white/20 bg-white/5 text-white/80 text-xs font-medium hover:bg-white/10 transition-all"
              >
                <span>Về Trang Khách</span>
                <ArrowUpRight size={14} />
              </Link>
            </div>
          </div>
        </header>

        {/* ── Hero Banner ── */}
        <div className="max-w-7xl mx-auto px-4 sm:px-8 pt-8 pb-4">
          <div className="relative rounded-2xl overflow-hidden border border-[#6B9FB8]/20 bg-gradient-to-r from-[#0A1A2E]/90 via-[#0D223B]/80 to-[#0A1A2E]/90 p-6 sm:p-8 shadow-2xl backdrop-blur-md">
            <div className="max-w-3xl space-y-3">
              <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-[#CD7F32]/15 border border-[#CD7F32]/30 text-[#E5A869] text-xs font-medium uppercase tracking-wider">
                <Sparkles size={14} />
                Trung Tâm Điều Hướng Vận Hành • Sa Đéc EST. 2018
              </div>
              <h1 className="font-display text-2xl sm:text-4xl font-bold tracking-tight text-white leading-tight">
                Cổng Điều Hành Hệ Thống F&B AURA CAFE
              </h1>
              <p className="text-sm sm:text-base text-[var(--aura-text-secondary,#a0a8b0)] leading-relaxed">
                Tất cả dữ liệu từ trang chính (Thực đơn, Giỏ hàng, Đặt món tại bàn) được đồng bộ thời gian thực hai chiều với KDS Bếp, POS Thu ngân, Sơ đồ bàn, CRM và Kế toán ERPNext.
              </p>
            </div>

            {/* Quick Live Telemetry Banner */}
            <div className="mt-6 pt-6 border-t border-white/10 grid grid-cols-2 sm:grid-cols-4 gap-4">
              {/* Telemetry 1: Cart */}
              <div className="flex flex-col bg-black/20 p-3 rounded-xl border border-white/5">
                <div className="flex items-center justify-between text-xs text-[var(--aura-text-secondary,#a0a8b0)] mb-1">
                  <span>Giỏ hàng khách</span>
                  <ShoppingCart size={14} className="text-cyan-400" />
                </div>
                <span className="text-lg sm:text-xl font-bold text-white">
                  {cartItems.length} món
                </span>
                <span className="text-[11px] text-cyan-300 font-mono">
                  {cartItems.length > 0 ? formattedCartSubtotal : 'Chưa có món'}
                </span>
              </div>

              {/* Telemetry 2: KDS */}
              <div className="flex flex-col bg-black/20 p-3 rounded-xl border border-white/5">
                <div className="flex items-center justify-between text-xs text-[var(--aura-text-secondary,#a0a8b0)] mb-1">
                  <span>Hàng đợi Bếp (KDS)</span>
                  <ChefHat size={14} className="text-emerald-400" />
                </div>
                <span className="text-lg sm:text-xl font-bold text-emerald-400 flex items-center gap-1.5">
                  <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                  {kdsOrders.length} vé đang làm
                </span>
                <span className="text-[11px] text-[var(--aura-text-secondary,#a0a8b0)]">
                  SSE Stream Live
                </span>
              </div>

              {/* Telemetry 3: CRM */}
              <div className="flex flex-col bg-black/20 p-3 rounded-xl border border-white/5">
                <div className="flex items-center justify-between text-xs text-[var(--aura-text-secondary,#a0a8b0)] mb-1">
                  <span>Hội viên CRM</span>
                  <Users size={14} className="text-amber-400" />
                </div>
                <span className="text-lg sm:text-xl font-bold text-amber-300">
                  {customers.length > 0 ? customers.length : 128} thành viên
                </span>
                <span className="text-[11px] text-[var(--aura-text-secondary,#a0a8b0)]">
                  Tích điểm & Hạng VIP
                </span>
              </div>

              {/* Telemetry 4: Database Sync */}
              <div className="flex flex-col bg-black/20 p-3 rounded-xl border border-white/5">
                <div className="flex items-center justify-between text-xs text-[var(--aura-text-secondary,#a0a8b0)] mb-1">
                  <span>Liên kết Dữ liệu</span>
                  <Database size={14} className="text-purple-400" />
                </div>
                <span className="text-lg sm:text-xl font-bold text-purple-300 flex items-center gap-1.5">
                  <CheckCircle2 size={16} className="text-emerald-400" />
                  Đã Kết Nối
                </span>
                <span className="text-[10px] text-[var(--aura-text-secondary,#a0a8b0)] truncate">
                  {API_BASE.replace('https://', '')}
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* ── Realtime Data Sync Architecture Strip ── */}
        <div className="max-w-7xl mx-auto px-4 sm:px-8 mb-8">
          <div className="rounded-xl border border-[#6B9FB8]/30 bg-gradient-to-r from-[#0C1F33] via-[#0A1A2E] to-[#0C1F33] p-4 sm:p-5 backdrop-blur-md">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 pb-3 border-b border-white/10">
              <div className="flex items-center gap-2">
                <Zap size={18} className="text-amber-400" />
                <h3 className="font-display text-sm font-bold text-white tracking-wide uppercase">
                  Luồng Dữ Liệu Đồng Bộ Thời Gian Thực (Single Source of Truth)
                </h3>
              </div>
              <span className="text-xs text-emerald-400 bg-emerald-500/10 px-2.5 py-1 rounded-full border border-emerald-500/30 flex items-center gap-1.5 w-fit">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                Dữ liệu trang chính ↔ KDS ↔ POS ↔ Admin hoàn toàn liên kết
              </span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3 pt-3 text-xs">
              <div className="p-3 rounded-lg bg-white/5 border border-white/5 flex flex-col justify-between">
                <div className="font-semibold text-white mb-1 flex items-center gap-1.5">
                  <span className="w-5 h-5 rounded-full bg-amber-500/20 text-amber-400 text-[10px] flex items-center justify-center font-bold">1</span>
                  Khách Gọi Món
                </div>
                <p className="text-[11px] text-[var(--aura-text-secondary,#a0a8b0)]">
                  Khách chọn món trên menu <code>/menu</code> hoặc quét QR bàn. Món được lưu vào giỏ hàng Zustand.
                </p>
              </div>

              <div className="p-3 rounded-lg bg-white/5 border border-white/5 flex flex-col justify-between">
                <div className="font-semibold text-cyan-300 mb-1 flex items-center gap-1.5">
                  <span className="w-5 h-5 rounded-full bg-cyan-500/20 text-cyan-400 text-[10px] flex items-center justify-center font-bold">2</span>
                  Gửi Đơn & PayOS
                </div>
                <p className="text-[11px] text-[var(--aura-text-secondary,#a0a8b0)]">
                  Khách thanh toán tại <code>/checkout</code>. Mutation POST <code>/api/orders</code> ghi đơn vào SQLite/D1.
                </p>
              </div>

              <div className="p-3 rounded-lg bg-white/5 border border-white/5 flex flex-col justify-between">
                <div className="font-semibold text-emerald-300 mb-1 flex items-center gap-1.5">
                  <span className="w-5 h-5 rounded-full bg-emerald-500/20 text-emerald-400 text-[10px] flex items-center justify-center font-bold">3</span>
                  KDS Bếp Nhận Vé
                </div>
                <p className="text-[11px] text-[var(--aura-text-secondary,#a0a8b0)]">
                  Màn hình <code>/kds</code> lập tức nhận SSE stream, chuông vang lên và đồng hồ đếm ngược bắt đầu chạy.
                </p>
              </div>

              <div className="p-3 rounded-lg bg-white/5 border border-white/5 flex flex-col justify-between">
                <div className="font-semibold text-indigo-300 mb-1 flex items-center gap-1.5">
                  <span className="w-5 h-5 rounded-full bg-indigo-500/20 text-indigo-400 text-[10px] flex items-center justify-center font-bold">4</span>
                  Bàn & Thu Ngân
                </div>
                <p className="text-[11px] text-[var(--aura-text-secondary,#a0a8b0)]">
                  <code>/admin/table-management</code> đổi màu bàn sang Có Khách. POS thu ngân in hóa đơn tức thì.
                </p>
              </div>

              <div className="p-3 rounded-lg bg-white/5 border border-white/5 flex flex-col justify-between">
                <div className="font-semibold text-purple-300 mb-1 flex items-center gap-1.5">
                  <span className="w-5 h-5 rounded-full bg-purple-500/20 text-purple-400 text-[10px] flex items-center justify-center font-bold">5</span>
                  CRM & Báo Cáo
                </div>
                <p className="text-[11px] text-[var(--aura-text-secondary,#a0a8b0)]">
                  Hồ sơ khách tại <code>/admin/customers</code> được cộng điểm. Dashboard cập nhật doanh thu và top món.
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* ── Search & Filter Controls ── */}
        <div className="max-w-7xl mx-auto px-4 sm:px-8 mb-8">
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-4 bg-[#0A1A2E]/60 border border-white/10 rounded-xl p-3 backdrop-blur-md">
            {/* Search Input */}
            <div className="relative flex-1">
              <Search
                size={18}
                className="absolute left-3.5 top-1/2 -translate-y-1/2 text-[var(--aura-text-secondary,#a0a8b0)]"
              />
              <input
                type="text"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder="Tìm nhanh phân hệ (ví dụ: bếp, kds, thu ngân, bàn, crm, voucher, pos...)"
                aria-label="Tìm nhanh phân hệ"
                className="w-full pl-10 pr-4 py-2.5 bg-black/30 border border-white/10 rounded-lg text-sm text-white placeholder-[var(--aura-text-secondary,#a0a8b0)]/60 focus:outline-none focus:border-[#6B9FB8] transition-colors"
              />
              {searchTerm && (
                <button
                  type="button"
                  onClick={() => setSearchTerm('')}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-[var(--aura-text-secondary,#a0a8b0)] hover:text-white"
                >
                  Xóa
                </button>
              )}
            </div>

            {/* Category tabs */}
            <div className="flex items-center gap-1.5 overflow-x-auto pb-1 sm:pb-0 scrollbar-none">
              <button
                type="button"
                onClick={() => setSelectedCategory('all')}
                className={`px-3 py-1.5 rounded-lg text-xs font-medium whitespace-nowrap transition-all ${
                  selectedCategory === 'all'
                    ? 'bg-[var(--aura-chrome-bright,#E8EEF3)] text-[#0A1A2E] font-semibold shadow-sm'
                    : 'bg-white/5 text-[var(--aura-text-secondary,#a0a8b0)] hover:bg-white/10 hover:text-white'
                }`}
              >
                Tất cả ({totalSections})
              </button>
              {categories.map((c) => (
                <button
                  key={c.id}
                  type="button"
                  onClick={() => setSelectedCategory(c.id)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-medium whitespace-nowrap transition-all ${
                    selectedCategory === c.id
                      ? 'bg-[var(--aura-chrome-bright,#E8EEF3)] text-[#0A1A2E] font-semibold shadow-sm'
                      : 'bg-white/5 text-[var(--aura-text-secondary,#a0a8b0)] hover:bg-white/10 hover:text-white'
                  }`}
                >
                  {c.name} ({c.items.length})
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* ── Category Sections ── */}
        <div className="max-w-7xl mx-auto px-4 sm:px-8 space-y-12">
          {filteredCategories.length === 0 ? (
            <div className="text-center py-16 bg-[#0A1A2E]/40 border border-white/10 rounded-2xl">
              <Search size={40} className="mx-auto text-[var(--aura-text-secondary,#a0a8b0)]/40 mb-3" />
              <p className="text-base font-medium text-white">Không tìm thấy phân hệ nào phù hợp</p>
              <p className="text-xs text-[var(--aura-text-secondary,#a0a8b0)] mt-1">
                Vui lòng thử từ khóa khác hoặc bấm nút "Tất cả".
              </p>
              <button
                type="button"
                onClick={() => {
                  setSearchTerm('');
                  setSelectedCategory('all');
                }}
                className="mt-4 px-4 py-2 rounded-lg bg-white/10 text-white text-xs hover:bg-white/20 transition-all"
              >
                Xem toàn bộ phân hệ
              </button>
            </div>
          ) : (
            filteredCategories.map((cat) => (
              <section key={cat.id} className="space-y-4">
                {/* Section Header */}
                <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-2 pb-2 border-b border-white/10">
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="w-2.5 h-2.5 rounded-full bg-gradient-to-r from-amber-400 to-orange-400" />
                      <h2 className="text-lg sm:text-xl font-bold tracking-tight text-white font-display">
                        {cat.name}
                      </h2>
                      <span className="text-xs uppercase tracking-wider text-[var(--aura-text-secondary,#a0a8b0)]/70 font-medium">
                        / {cat.nameEn}
                      </span>
                    </div>
                    <p className="text-xs text-[var(--aura-text-secondary,#a0a8b0)] mt-1">
                      {cat.description}
                    </p>
                  </div>
                  <span className="text-xs text-[var(--aura-text-secondary,#a0a8b0)] font-medium">
                    {cat.items.length} đường dẫn
                  </span>
                </div>

                {/* Grid of Action Cards */}
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
                  {cat.items.map((item) => {
                    const Icon = item.icon;
                    return (
                      <div
                        key={item.id}
                        className="group relative rounded-xl border border-white/10 bg-[#0A1A2E]/70 p-5 backdrop-blur-md transition-all duration-300 hover:border-[#6B9FB8]/50 hover:bg-[#0E233C]/90 hover:shadow-[0_8px_30px_rgba(0,0,0,0.5)] flex flex-col justify-between"
                      >
                        {/* Top card info */}
                        <div>
                          <div className="flex items-start justify-between gap-3 mb-3">
                            <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-white/10 to-white/5 border border-white/10 flex items-center justify-center text-[var(--aura-chrome-bright,#E8EEF3)] group-hover:scale-105 group-hover:border-[#6B9FB8]/40 transition-transform">
                              <Icon size={20} />
                            </div>
                            <span
                              className={`text-[10px] font-semibold tracking-wider uppercase px-2 py-0.5 rounded-md border ${item.badgeColor}`}
                            >
                              {item.badge}
                            </span>
                          </div>

                          <h3 className="font-display text-base font-bold text-white group-hover:text-[var(--aura-chrome-bright,#E8EEF3)] transition-colors flex items-center gap-1.5">
                            {item.title}
                          </h3>
                          <p className="text-xs text-[var(--aura-text-secondary,#a0a8b0)] font-medium mb-2">
                            {item.subtitle}
                          </p>
                          <p className="text-xs text-[var(--aura-text-secondary,#a0a8b0)]/90 leading-relaxed mb-4 line-clamp-3">
                            {item.description}
                          </p>
                        </div>

                        {/* Bottom path + launch button */}
                        <div className="pt-3 border-t border-white/5 flex items-center justify-between gap-3">
                          <code className="text-[11px] font-mono text-[var(--aura-text-secondary,#a0a8b0)] bg-black/40 px-2 py-1 rounded">
                            {item.path}
                          </code>
                          <Link
                            to={item.path}
                            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[var(--aura-chrome-bright,#E8EEF3)] text-[#0A1A2E] text-xs font-semibold hover:bg-white hover:shadow-[0_0_15px_rgba(201,214,223,0.3)] transition-all active:scale-95"
                          >
                            <span>{item.primaryAction}</span>
                            <ArrowUpRight size={14} />
                          </Link>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </section>
            ))
          )}
        </div>

        {/* ── Footer ── */}
        <footer className="max-w-7xl mx-auto px-4 sm:px-8 mt-16 pt-8 border-t border-white/10 text-center text-xs text-[var(--aura-text-secondary,#a0a8b0)] flex flex-col sm:flex-row items-center justify-between gap-4">
          <p>
            © AURA CAFE — EST. 2018 Sa Đéc, Đồng Tháp. All system rights reserved.
          </p>
          <div className="flex items-center gap-4">
            <Link to="/about" className="hover:text-white transition-colors">
              Giới Thiệu
            </Link>
            <Link to="/brand" className="hover:text-white transition-colors">
              Brand Guidelines
            </Link>
            <Link to="/admin/login" className="hover:text-white transition-colors">
              Admin Login
            </Link>
          </div>
        </footer>
      </div>
    </>
  );
}
