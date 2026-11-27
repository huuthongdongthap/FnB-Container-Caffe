export interface ShellRouteConfig {
  match: string;
  exact?: boolean;
  title: string;
  variant: 'small' | 'center-aligned' | 'medium' | 'large';
  showNav: boolean;
  showTop: boolean;
}

export const MD3_SHELL_CONFIG: ShellRouteConfig[] = [
  // Tab pages — full shell (TopAppBar on mobile if not custom, Bottom NavBar on mobile)
  { match: '/', exact: true, title: 'AURA CAFE', variant: 'small', showNav: true, showTop: false },
  { match: '/menu', title: 'Thực đơn', variant: 'small', showNav: true, showTop: true },
  { match: '/table-reservation', title: 'Đặt bàn', variant: 'small', showNav: true, showTop: false },
  { match: '/promotions', title: 'Ưu đãi hội viên', variant: 'small', showNav: true, showTop: false },
  { match: '/account', title: 'Tài khoản', variant: 'center-aligned', showNav: true, showTop: true },
  { match: '/loyalty', title: 'Thành viên & Tích điểm', variant: 'small', showNav: true, showTop: true },
  { match: '/referral', title: 'Giới thiệu bạn bè', variant: 'small', showNav: true, showTop: true },

  // Story & Brand pages — LandingNav + LandingFooter / own Stitch header, no duplicate shell header
  { match: '/about', title: 'Về AURA CAFE', variant: 'small', showNav: false, showTop: false },
  { match: '/gallery', title: 'Không gian & Góc ảnh', variant: 'small', showNav: false, showTop: false },
  { match: '/reviews', title: 'Đánh giá khách hàng', variant: 'small', showNav: false, showTop: false },
  { match: '/contact', title: 'Liên hệ', variant: 'small', showNav: false, showTop: false },
  { match: '/events', title: 'Sự kiện AURA CAFE', variant: 'small', showNav: false, showTop: false },
  { match: '/tuyen-dung', title: 'Tuyển dụng AURA CAFE', variant: 'small', showNav: false, showTop: false },
  { match: '/ung-tuyen', title: 'Ứng tuyển AURA CAFE', variant: 'small', showNav: false, showTop: false },

  // Tenant storefronts are white-label and must not inherit flagship chrome.
  { match: '/s/', title: '', variant: 'small', showNav: false, showTop: false },

  // Functional customer pages — single TopAppBar where page has no internal header
  { match: '/checkout', title: 'Thanh toán đơn hàng', variant: 'small', showNav: false, showTop: true },
  { match: '/subscriptions', title: 'Gói Hội Viên & Thuê Container', variant: 'small', showNav: false, showTop: true },
  { match: '/loyalty-calculator', title: 'Tính điểm & Hoàn tiền', variant: 'small', showNav: false, showTop: true },
  { match: '/register', title: 'Đăng ký thành viên', variant: 'small', showNav: false, showTop: true },

  { match: '/order-success', title: 'Đặt hàng thành công', variant: 'small', showNav: false, showTop: false },
  { match: '/order-failure', title: 'Thanh toán chưa hoàn tất', variant: 'small', showNav: false, showTop: false },
  { match: '/order', title: 'Gọi món tại bàn', variant: 'small', showNav: false, showTop: false },
  { match: '/checkin', title: 'Check-in tại quán', variant: 'small', showNav: false, showTop: false },
  { match: '/track-order', title: 'Tra cứu đơn hàng', variant: 'small', showNav: false, showTop: false },
  { match: '/hub', title: 'Trạm Điều Hành', variant: 'small', showNav: false, showTop: false },
  { match: '/portal', title: 'Trạm Điều Hành', variant: 'small', showNav: false, showTop: false },
];

export function getShellConfig(pathname: string): ShellRouteConfig | undefined {
  const normalizedPath = pathname.replace(/^\/(vi|en)(?=\/|$)/, '') || '/';
  const exactHit = MD3_SHELL_CONFIG.find((c) => c.exact && c.match === normalizedPath);
  if (exactHit) return exactHit;
  return MD3_SHELL_CONFIG.find(
    (c) => !c.exact && normalizedPath.startsWith(c.match),
  );
}

/** True when the MD3 bottom NavigationBar is mounted (cart bar must float above it) */
export function hasM3NavBar(pathname: string): boolean {
  const entry = getShellConfig(pathname);
  return entry?.showNav ?? false;
}
