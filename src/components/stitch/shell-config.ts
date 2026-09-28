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

  // Story & Brand pages — LandingNav + LandingFooter, no mobile bottom nav
  { match: '/about', title: 'Về AURA CAFE', variant: 'small', showNav: false, showTop: false },
  { match: '/gallery', title: 'Không gian & Góc ảnh', variant: 'small', showNav: false, showTop: false },
  { match: '/contact', title: 'Liên hệ', variant: 'small', showNav: false, showTop: false },

  // Functional customer pages — TopAppBar only, KHÔNG Bottom Nav
  { match: '/checkout', title: 'Thanh toán đơn hàng', variant: 'small', showNav: false, showTop: true },
  { match: '/order', title: 'Gọi món tại bàn', variant: 'small', showNav: false, showTop: false },
  { match: '/checkin', title: 'Check-in tại quán', variant: 'small', showNav: false, showTop: true },
  { match: '/track-order', title: 'Tra cứu đơn hàng', variant: 'small', showNav: false, showTop: true },
  { match: '/hub', title: 'Trạm Điều Hành', variant: 'small', showNav: false, showTop: false },
  { match: '/portal', title: 'Trạm Điều Hành', variant: 'small', showNav: false, showTop: false },
];

export function getShellConfig(pathname: string): ShellRouteConfig | undefined {
  const exactHit = MD3_SHELL_CONFIG.find((c) => c.exact && c.match === pathname);
  if (exactHit) return exactHit;
  return MD3_SHELL_CONFIG.find(
    (c) => !c.exact && pathname.startsWith(c.match),
  );
}

/** True when the MD3 bottom NavigationBar is mounted (cart bar must float above it) */
export function hasM3NavBar(pathname: string): boolean {
  return getShellConfig(pathname)?.showNav ?? false;
}
