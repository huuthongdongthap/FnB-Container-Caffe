export interface ShellRouteConfig {
  match: string;
  exact?: boolean;
  title: string;
  variant: 'small' | 'center-aligned' | 'medium' | 'large';
  showNav: boolean;
  showTop: boolean;
}

export const MD3_SHELL_CONFIG: ShellRouteConfig[] = [
  // Tab pages — full shell (TopAppBar + NavBar)
  { match: '/', exact: true, title: 'AURA CAFE', variant: 'small', showNav: true, showTop: false },
  { match: '/menu', title: 'Thực đơn', variant: 'small', showNav: true, showTop: true },
  { match: '/table-reservation', title: 'Đặt bàn', variant: 'small', showNav: true, showTop: true },
  { match: '/promotions', title: 'Ưu đãi', variant: 'small', showNav: true, showTop: true },
  { match: '/account', title: 'Tài khoản', variant: 'center-aligned', showNav: true, showTop: true },
  { match: '/loyalty', title: 'Thành viên', variant: 'small', showNav: true, showTop: true },
  { match: '/referral', title: 'Giới thiệu', variant: 'small', showNav: true, showTop: true },

  // Functional customer pages — TopAppBar only, KHÔNG Bottom Nav
  { match: '/checkout', title: 'Thanh toán', variant: 'small', showNav: false, showTop: true },
  { match: '/order', title: 'Đặt món', variant: 'small', showNav: false, showTop: true },
  { match: '/checkin', title: 'Check-in', variant: 'small', showNav: false, showTop: true },
  { match: '/track-order', title: 'Tra cứu', variant: 'small', showNav: false, showTop: true },
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
