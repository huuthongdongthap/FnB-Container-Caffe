import { useEffect, useState, type ReactNode } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { HelmetProvider } from 'react-helmet-async';
import { MemoryRouter, Route, Routes, useLocation, useNavigate } from 'react-router-dom';
import CustomerShell from '@/components/stitch/CustomerShell';
import { RouteSeoManager } from '@/components/shared/route-seo-manager';
import { Breadcrumbs } from '@/components/shared/Breadcrumbs';
import { HelmetHead } from '@/components/seo/HelmetHead';
import { useCartStore } from '@/hooks/stores/use-cart-store';
import TenantStorefrontPage from '../storefront';
import {
  STOREFRONT_ORDER_TOKENS_KEY,
  rememberStorefrontOrderToken,
  sanitizePayosCheckoutUrl,
  sanitizeStorefrontMediaUrl,
} from '../storefront-helpers';
import { StorefrontPaymentCard } from '../storefront-payment-card';

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key?: string, fallback?: string | { defaultValue?: string }) => {
      const map: Record<string, string> = {
        'nav.home': 'Trang chủ',
        'nav.menu': 'Thực đơn',
        'nav.reservations': 'Đặt bàn',
        'nav.promotions': 'Ưu đãi',
        'nav.account': 'Tài khoản',
      };
      if (map[key ?? '']) return map[key ?? ''];
      if (typeof fallback === 'string') return fallback;
      if (fallback && typeof fallback === 'object' && 'defaultValue' in fallback) {
        return fallback.defaultValue ?? key ?? '';
      }
      return key ?? '';
    },
    i18n: { language: 'vi', changeLanguage: vi.fn() },
  }),
  Trans: ({ children }: { children: ReactNode }) => children,
}));

interface MockStorefrontFixture {
  tenant: {
    id: string;
    slug: string;
    name: string;
    lifecycleState: string;
    isReadOnly: boolean;
  };
  branding: {
    displayName: string;
    tagline: string;
    logoUrl: string;
    primaryColor: string;
    accentColor: string;
    address: string;
    phone: string;
    receiptFooter: string;
  };
  payment: {
    provider: string;
    hasPayos: boolean;
    hasBankTransfer: boolean;
    bankName: string | null;
    bankBin?: string | null;
    bankAccountNo?: string | null;
    bankAccountName?: string | null;
  };
  categories: Array<{ id: string; name: string; slug: string }>;
  products: Array<{
    id: string;
    category_id: string;
    name: string;
    price: number;
    description?: string | null;
    image_url?: string | null;
  }>;
  tables: Array<{ id: string; code: string; name: string }>;
}

function makeFixture(overrides: Partial<MockStorefrontFixture> = {}): MockStorefrontFixture {
  return {
    tenant: {
      id: 'tenant-hoasen',
      slug: 'cafe-hoa-sen',
      name: 'Cà Phê Hoa Sen',
      lifecycleState: 'active',
      isReadOnly: false,
    },
    branding: {
      displayName: 'Cà Phê Hoa Sen',
      tagline: 'Cà phê rang mộc bên bờ sông',
      logoUrl: 'https://cdn.hoasen.vn/logo.webp',
      primaryColor: '#1E293B',
      accentColor: '#D97706',
      address: '12 Hùng Vương, Cao Lãnh',
      phone: '0909123456',
      receiptFooter: 'Cảm ơn quý khách',
    },
    payment: {
      provider: 'payos',
      hasPayos: true,
      hasBankTransfer: true,
      bankName: 'MB Bank',
      bankBin: '970422',
      bankAccountNo: '0123456789',
      bankAccountName: 'CA PHE HOA SEN',
    },
    categories: [
      { id: 'cat-coffee', name: 'Cà phê', slug: 'ca-phe' },
      { id: 'cat-tea', name: 'Trà trái cây', slug: 'tra-trai-cay' },
      { id: 'cat-empty', name: 'Bánh ngọt', slug: 'banh-ngot' },
    ],
    products: [
      {
        id: 'prod-1',
        category_id: 'cat-coffee',
        name: 'Cà Phê Muối Hoa Sen',
        price: 39000,
        description: 'Kem muối béo nhẹ',
        image_url: 'https://cdn.hoasen.vn/salt-coffee.jpg',
      },
      {
        id: 'prod-2',
        category_id: 'cat-tea',
        name: 'Trà Sen Vàng',
        price: 45000,
        description: 'Trà ô long hương sen',
        image_url: '/photos/tra-sen.webp',
      },
    ],
    tables: [
      { id: 'tbl-1', code: 'B01', name: 'Bàn 01' },
      { id: 'tbl-2', code: 'B02', name: 'Bàn 02' },
    ],
    ...overrides,
  };
}

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

function seedFlagshipHead(): void {
  document.head.innerHTML = '';
  document.title = 'AURA CAFE — Container Caffe Sa Đéc & AURA SPACE SaaS';
  delete document.documentElement.dataset.flagshipHeadSuspended;

  const addMeta = (attr: 'name' | 'property', key: string, content: string) => {
    const el = document.createElement('meta');
    el.setAttribute(attr, key);
    el.setAttribute('content', content);
    document.head.appendChild(el);
  };
  addMeta('name', 'description', 'AURA CAFE — Cà phê container Sa Đéc');
  addMeta('name', 'robots', 'index, follow');
  addMeta('name', 'application-name', 'AURA CAFE');
  addMeta('name', 'apple-mobile-web-app-title', 'AURA CAFE');
  addMeta('property', 'og:title', 'AURA CAFE — Container Caffe Sa Đéc');
  addMeta('property', 'og:site_name', 'AURA CAFE');
  addMeta('property', 'og:image', 'https://auraspace.cafe/photos/flagship.webp');
  addMeta('name', 'twitter:title', 'AURA CAFE');

  const canonical = document.createElement('link');
  canonical.rel = 'canonical';
  canonical.href = 'https://auraspace.cafe/';
  document.head.appendChild(canonical);

  const mdAlt = document.createElement('link');
  mdAlt.rel = 'alternate';
  mdAlt.type = 'text/markdown';
  mdAlt.href = '/index.html.md';
  document.head.appendChild(mdAlt);

  const orgLd = document.createElement('script');
  orgLd.type = 'application/ld+json';
  orgLd.textContent = JSON.stringify({
    '@context': 'https://schema.org',
    '@type': 'CafeOrCoffeeShop',
    name: 'AURA CAFE',
  });
  document.head.appendChild(orgLd);
}

function LocationProbe() {
  const loc = useLocation();
  return <div data-testid="location-probe">{`${loc.pathname}${loc.search}`}</div>;
}

function NavHelper() {
  const navigate = useNavigate();
  return (
    <div data-testid="nav-helper">
      <button type="button" onClick={() => navigate('/s/cafe-hoa-sen')}>
        go-hoa-sen
      </button>
      <button type="button" onClick={() => navigate('/s/cafe-sa-dec')}>
        go-sa-dec
      </button>
      <button type="button" onClick={() => navigate('/pricing')}>
        go-pricing
      </button>
      <button type="button" onClick={() => navigate('/admin/dashboard')}>
        go-admin
      </button>
      <button type="button" onClick={() => navigate('/menu')}>
        go-menu
      </button>
      <button type="button" onClick={() => navigate('/brand-guideline')}>
        go-brand
      </button>
    </div>
  );
}

describe('Storefront branding, SEO isolation and payment flow', () => {
  beforeEach(() => {
    seedFlagshipHead();
    sessionStorage.clear();
    useCartStore.getState().clearCart();
    vi.spyOn(window, 'scrollTo').mockImplementation(() => {});
  });

  afterEach(() => {
    cleanup();
    vi.restoreAllMocks();
    useCartStore.getState().clearCart();
    sessionStorage.clear();
  });

  describe('White-label shell chrome, flagship cart hiding, and tenant cart isolation', () => {
    it('hides flagship TopAppBar, Bottom NavigationBar, and CartBottomBar on /s/:slug even when flagship cart has items', async () => {
      const fixture = makeFixture();
      vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(
        jsonResponse({ success: true, data: fixture }),
      );

      useCartStore.getState().addItem({
        id: 'flagship-latte',
        name: 'AURA Signature Latte',
        price: 59000,
      });

      render(
        <MemoryRouter initialEntries={['/s/cafe-hoa-sen']}>
          <CustomerShell>
            <Routes>
              <Route path="/s/:slug" element={<TenantStorefrontPage />} />
            </Routes>
          </CustomerShell>
        </MemoryRouter>,
      );

      expect(await screen.findByText('Cà Phê Hoa Sen')).toBeInTheDocument();
      // Flagship top app bar, bottom nav bar, and flagship floating cart bar must not render.
      expect(screen.queryByRole('navigation')).not.toBeInTheDocument();
      expect(screen.queryByText('AURA CAFE')).not.toBeInTheDocument();
      expect(screen.queryByLabelText(/Thanh toán 1 món/i)).not.toBeInTheDocument();

      // Adding a tenant item does not leak into flagship useCartStore.
      const firstAdd = screen.getAllByRole('button', { name: '+ Chọn' })[0];
      expect(firstAdd).toBeDefined();
      fireEvent.click(firstAdd!);
      expect(useCartStore.getState().items).toHaveLength(1);
      expect(useCartStore.getState().items[0]?.id).toBe('flagship-latte');
    });

    it('keeps flagship CustomerShell chrome and CartBottomBar visible on /menu', () => {
      useCartStore.getState().addItem({
        id: 'flagship-latte',
        name: 'AURA Signature Latte',
        price: 59000,
      });

      render(
        <MemoryRouter initialEntries={['/menu']}>
          <CustomerShell>
            <div>Menu Page</div>
          </CustomerShell>
        </MemoryRouter>,
      );

      expect(screen.getByRole('banner')).toBeInTheDocument();
      expect(screen.getByRole('navigation')).toBeInTheDocument();
      expect(screen.getByLabelText(/Thanh toán 1 món/i)).toBeInTheDocument();
    });

    it('resets tenant cart when switching from one tenant storefront to another', async () => {
      const hoaSen = makeFixture();
      const saDec = makeFixture({
        tenant: {
          id: 'tenant-sadec',
          slug: 'cafe-sa-dec',
          name: 'Tiệm Trà Sa Đéc',
          lifecycleState: 'active',
          isReadOnly: false,
        },
        branding: {
          ...hoaSen.branding,
          displayName: 'Tiệm Trà Sa Đéc',
          logoUrl: '',
        },
        products: [
          {
            id: 'prod-sadec-1',
            category_id: 'cat-tea',
            name: 'Trà Quýt Hồng',
            price: 42000,
          },
        ],
      });

      vi.spyOn(globalThis, 'fetch').mockImplementation(async (input) => {
        const url = String(input);
        if (url.includes('/api/saas/storefront/cafe-hoa-sen')) {
          return jsonResponse({ success: true, data: hoaSen });
        }
        if (url.includes('/api/saas/storefront/cafe-sa-dec')) {
          return jsonResponse({ success: true, data: saDec });
        }
        return jsonResponse({ success: false }, 404);
      });

      render(
        <MemoryRouter initialEntries={['/s/cafe-hoa-sen']}>
          <NavHelper />
          <Routes>
            <Route path="/s/:slug" element={<TenantStorefrontPage />} />
          </Routes>
        </MemoryRouter>,
      );

      expect(await screen.findByText('Cà Phê Muối Hoa Sen')).toBeInTheDocument();
      const firstAdd = screen.getAllByRole('button', { name: '+ Chọn' })[0];
      expect(firstAdd).toBeDefined();
      fireEvent.click(firstAdd!);
      expect(screen.getByRole('button', { name: /Đặt món \(1\)/ })).toBeInTheDocument();

      fireEvent.click(screen.getByText('go-sa-dec'));
      expect(await screen.findByText('Tiệm Trà Sa Đéc')).toBeInTheDocument();
      expect(screen.queryByRole('button', { name: /Đặt món/ })).not.toBeInTheDocument();
    });
  });

  describe('SEO ownership isolation, navigation cleanup, and non-duplication', () => {
    it('isolates SEO across loading, ready, tenant switch, leaving storefront, and admin routes', async () => {
      const hoaSen = makeFixture();
      const saDec = makeFixture({
        tenant: {
          id: 'tenant-sadec',
          slug: 'cafe-sa-dec',
          name: 'Tiệm Trà Sa Đéc',
          lifecycleState: 'active',
          isReadOnly: false,
        },
        branding: {
          ...hoaSen.branding,
          displayName: 'Tiệm Trà Sa Đéc',
          tagline: 'Hương quýt hồng bản địa',
          logoUrl: '',
        },
      });

      const pendingStorefront: { resolve: ((resp: Response) => void) | null } = { resolve: null };
      vi.spyOn(globalThis, 'fetch').mockImplementation((input) => {
        const url = String(input);
        if (url.includes('/api/saas/storefront/cafe-hoa-sen')) {
          return new Promise<Response>((resolve) => {
            pendingStorefront.resolve = resolve;
          });
        }
        if (url.includes('/api/saas/storefront/cafe-sa-dec')) {
          return Promise.resolve(jsonResponse({ success: true, data: saDec }));
        }
        return Promise.resolve(jsonResponse({ success: false }, 404));
      });

      render(
        <MemoryRouter initialEntries={['/s/cafe-hoa-sen']}>
          <RouteSeoManager />
          <NavHelper />
          <Routes>
            <Route path="/s/:slug" element={<TenantStorefrontPage />} />
            <Route path="/pricing" element={<div>Pricing Page</div>} />
            <Route path="/admin/dashboard" element={<div>Admin Dashboard</div>} />
          </Routes>
        </MemoryRouter>,
      );

      // Loading state: zero flagship tags, neutral title, noindex, no stale markdown alternate.
      expect(document.title).toBe('Đang tải thực đơn cửa hàng');
      expect(document.head.querySelector('meta[name="robots"]')?.getAttribute('content')).toBe(
        'noindex, nofollow',
      );
      expect(document.head.querySelector('meta[name="application-name"]')).toBeNull();
      expect(
        document.head.querySelector('link[rel="alternate"][type="text/markdown"]'),
      ).toBeNull();
      expect(document.head.innerHTML).not.toContain('AURA CAFE');

      // Ready state for Hoa Sen.
      pendingStorefront.resolve?.(jsonResponse({ success: true, data: hoaSen }));
      expect(await screen.findByText('Cà Phê Hoa Sen')).toBeInTheDocument();
      await waitFor(() => {
        expect(document.title).toBe('Cà Phê Hoa Sen — Đặt món QR');
      });
      expect(document.head.querySelector('meta[name="robots"]')?.getAttribute('content')).toBe(
        'index, follow',
      );
      expect(document.head.querySelector('meta[property="og:site_name"]')?.getAttribute('content')).toBe(
        'Cà Phê Hoa Sen',
      );
      expect(document.head.querySelector('meta[property="og:image"]')?.getAttribute('content')).toBe(
        'https://cdn.hoasen.vn/logo.webp',
      );
      expect(document.head.querySelector('link[rel="canonical"]')?.getAttribute('href')).toBe(
        'https://auraspace.cafe/s/cafe-hoa-sen',
      );
      expect(document.head.innerHTML).not.toContain('AURA CAFE');

      // Tenant switch: Hoa Sen -> Sa Dec (no logo => old og:image removed).
      fireEvent.click(screen.getByText('go-sa-dec'));
      expect(await screen.findByText('Tiệm Trà Sa Đéc')).toBeInTheDocument();
      await waitFor(() => {
        expect(document.title).toBe('Tiệm Trà Sa Đéc — Đặt món QR');
      });
      expect(document.head.querySelector('meta[property="og:image"]')).toBeNull();
      expect(document.head.querySelector('link[rel="canonical"]')?.getAttribute('href')).toBe(
        'https://auraspace.cafe/s/cafe-sa-dec',
      );
      expect(document.head.innerHTML).not.toContain('Cà Phê Hoa Sen');

      // Leave storefront -> /pricing: flagship SEO + markdown alternate + route breadcrumb restored.
      fireEvent.click(screen.getByText('go-pricing'));
      expect(await screen.findByText('Pricing Page')).toBeInTheDocument();
      await waitFor(() => {
        expect(document.title).toContain('Bảng giá AURA SPACE SaaS');
      });
      expect(
        document.head
          .querySelector('link[rel="alternate"][type="text/markdown"]')
          ?.getAttribute('href'),
      ).toBe('/pricing.md');
      expect(document.getElementById('route-breadcrumb-ld')).not.toBeNull();
      expect(document.head.querySelectorAll('[data-storefront-seo="true"]')).toHaveLength(0);

      // Navigate /pricing -> /admin/dashboard: stale markdown alternate and breadcrumb removed, noindex set.
      fireEvent.click(screen.getByText('go-admin'));
      expect(await screen.findByText('Admin Dashboard')).toBeInTheDocument();
      await waitFor(() => {
        expect(document.head.querySelector('meta[name="robots"]')?.getAttribute('content')).toBe(
          'noindex, nofollow',
        );
      });
      expect(
        document.head.querySelector('link[rel="alternate"][type="text/markdown"]'),
      ).toBeNull();
      expect(document.getElementById('route-breadcrumb-ld')).toBeNull();
    });

    it('avoids duplicating HelmetHead meta/canonical tags and Breadcrumbs BreadcrumbList JSON-LD', async () => {
      function BrandPageWithBreadcrumbs() {
        const [show, setShow] = useState(false);
        useEffect(() => {
          setShow(true);
        }, []);
        return (
          <div>
            Brand Page
            {show && (
              <Breadcrumbs
                items={[
                  { label: 'Trang chủ', to: '/' },
                  { label: 'Brand Guideline', to: '/brand-guideline' },
                ]}
              />
            )}
          </div>
        );
      }

      render(
        <HelmetProvider>
          <MemoryRouter initialEntries={['/menu']}>
            <RouteSeoManager />
            <NavHelper />
            <Routes>
              <Route
                path="/menu"
                element={
                  <>
                    <HelmetHead
                      title="Thực Đơn"
                      description="Menu riêng từ HelmetHead"
                      canonical="/menu"
                    />
                    <div>Menu Helmet Route</div>
                  </>
                }
              />
              <Route path="/brand-guideline" element={<BrandPageWithBreadcrumbs />} />
            </Routes>
          </MemoryRouter>
        </HelmetProvider>,
      );

      expect(await screen.findByText('Menu Helmet Route')).toBeInTheDocument();
      await waitFor(() => {
        expect(document.head.querySelectorAll('meta[name="description"]')).toHaveLength(1);
        expect(document.head.querySelectorAll('link[rel="canonical"]')).toHaveLength(1);
        expect(document.head.querySelectorAll('meta[property="og:title"]')).toHaveLength(1);
        expect(document.head.querySelectorAll('meta[property="og:image"]')).toHaveLength(1);
        expect(document.head.querySelectorAll('meta[property="og:site_name"]')).toHaveLength(1);
      });
      expect(document.head.querySelector('meta[name="description"]')?.getAttribute('content')).toBe(
        'Menu riêng từ HelmetHead',
      );

      // Navigate to /brand-guideline where page mounts <Breadcrumbs /> -> strictly one BreadcrumbList script.
      fireEvent.click(screen.getByText('go-brand'));
      expect(await screen.findByText('Brand Page')).toBeInTheDocument();
      await waitFor(() => {
        const breadcrumbScripts = Array.from(
          document.querySelectorAll<HTMLScriptElement>('script[type="application/ld+json"]'),
        ).filter((s) => s.textContent?.includes('"BreadcrumbList"'));
        expect(breadcrumbScripts).toHaveLength(1);
      });
      expect(document.getElementById('route-breadcrumb-ld')).toBeNull();
    });
  });

  describe('PayOS return verification, spoofing resistance, and safe dismissal', () => {
    it('never claims paid/settled on spoofed ?payment=success without tenant token, strips url order_token, and preserves table on dismiss', async () => {
      const fixture = makeFixture();
      const fetchSpy = vi
        .spyOn(globalThis, 'fetch')
        .mockResolvedValueOnce(jsonResponse({ success: true, data: fixture }));

      render(
        <MemoryRouter
          initialEntries={[
            '/s/cafe-hoa-sen?order_id=ord-spoof&payment=success&order_token=evil-url-token&table=B02',
          ]}
        >
          <LocationProbe />
          <Routes>
            <Route path="/s/:slug" element={<TenantStorefrontPage />} />
          </Routes>
        </MemoryRouter>,
      );

      const banner = await screen.findByRole('status');
      expect(banner).toHaveAttribute('data-payment-return-state', 'unverified');
      expect(banner.textContent).not.toMatch(/đã xác nhận thanh toán|đã thanh toán|thành công|paid|settled/i);

      // Must NOT fetch /api/orders with URL-supplied token.
      expect(fetchSpy).toHaveBeenCalledTimes(1);
      await waitFor(() => {
        expect(screen.getByTestId('location-probe').textContent).not.toContain('order_token');
        expect(screen.getByTestId('location-probe').textContent).toContain('table=B02');
      });

      // Safe dismissal clears only payment & order_id, preserving table=B02.
      fireEvent.click(screen.getByRole('button', { name: 'Đóng' }));
      await waitFor(() => {
        expect(screen.queryByRole('status')).not.toBeInTheDocument();
      });
      expect(screen.getByTestId('location-probe').textContent).toBe('/s/cafe-hoa-sen?table=B02');
    });

    it('isolates order tokens across tenants so Tenant A token is never reused on Tenant B', async () => {
      rememberStorefrontOrderToken('tenant-hoasen', 'cafe-hoa-sen', 'ord-shared', 'tok-tenant-a');
      const saDec = makeFixture({
        tenant: {
          id: 'tenant-sadec',
          slug: 'cafe-sa-dec',
          name: 'Tiệm Trà Sa Đéc',
          lifecycleState: 'active',
          isReadOnly: false,
        },
      });
      const fetchSpy = vi
        .spyOn(globalThis, 'fetch')
        .mockResolvedValueOnce(jsonResponse({ success: true, data: saDec }));

      render(
        <MemoryRouter initialEntries={['/s/cafe-sa-dec?order_id=ord-shared&payment=success']}>
          <Routes>
            <Route path="/s/:slug" element={<TenantStorefrontPage />} />
          </Routes>
        </MemoryRouter>,
      );

      const banner = await screen.findByRole('status');
      expect(banner).toHaveAttribute('data-payment-return-state', 'unverified');
      expect(fetchSpy).toHaveBeenCalledTimes(1);
    });

    it('verifies settlement only via authenticated server response with X-Order-Token header and stores token in sessionStorage on order creation', async () => {
      const fixture = makeFixture();
      let serverPaymentStatus = 'pending';

      const fetchSpy = vi.spyOn(globalThis, 'fetch').mockImplementation(async (input, init) => {
        const url = String(input);
        if (url.includes('/api/saas/storefront/cafe-hoa-sen')) {
          return jsonResponse({ success: true, data: fixture });
        }
        if (url.includes('/api/orders/ord-200')) {
          const headers = new Headers(init?.headers);
          expect(init?.credentials).toBe('omit');
          expect(url).not.toContain('tok-ord-200');
          expect(headers.get('X-Order-Token')).toBe('tok-ord-200');
          expect(headers.get('X-Tenant-Slug')).toBe('cafe-hoa-sen');
          expect(headers.get('X-Tenant-ID')).toBe('tenant-hoasen');
          return jsonResponse({
            success: true,
            data: {
              id: 'ord-200',
              orderNumber: 'HS-200',
              status: 'pending',
              paymentStatus: serverPaymentStatus,
            },
          });
        }
        return jsonResponse({ success: false }, 404);
      });

      rememberStorefrontOrderToken('tenant-hoasen', 'cafe-hoa-sen', 'ord-200', 'tok-ord-200');

      render(
        <MemoryRouter initialEntries={['/s/cafe-hoa-sen?order_id=ord-200&payment=success&table=B01']}>
          <Routes>
            <Route path="/s/:slug" element={<TenantStorefrontPage />} />
          </Routes>
        </MemoryRouter>,
      );

      await waitFor(() => {
        expect(screen.getByRole('status')).toHaveAttribute('data-payment-return-state', 'pending');
      });
      expect(screen.getByRole('status').textContent).not.toMatch(/đã xác nhận thanh toán/i);

      // Once webhook marks order paid on server, clicking recheck proves settlement.
      serverPaymentStatus = 'paid';
      fireEvent.click(screen.getByRole('button', { name: 'Kiểm tra lại' }));
      await waitFor(() => {
        expect(screen.getByRole('status')).toHaveAttribute(
          'data-payment-return-state',
          'verified_paid',
        );
      });
      expect(screen.getByRole('status')).toHaveTextContent('Đã xác nhận thanh toán đơn #HS-200');
      expect(fetchSpy).toHaveBeenCalledTimes(3);
    });

    it('stores returned order_token in tenant-scoped sessionStorage (never URL) when placing a PayOS order', async () => {
      const fixture = makeFixture();
      vi.spyOn(globalThis, 'fetch').mockImplementation(async (input) => {
        const url = String(input);
        if (url.includes('/api/saas/storefront/cafe-hoa-sen')) {
          return jsonResponse({ success: true, data: fixture });
        }
        if (url.includes('/api/orders?store=cafe-hoa-sen')) {
          return jsonResponse({
            success: true,
            order_token: 'tok-fresh-order',
            data: { id: 'ord-301', order_number: 'HS-301', total: 39000 },
          });
        }
        if (url.includes('/api/payment/create-link')) {
          return jsonResponse({
            success: true,
            checkoutUrl: 'https://pay.payos.vn/web/301',
            orderCode: 301001,
          });
        }
        return jsonResponse({ success: false }, 404);
      });

      render(
        <MemoryRouter initialEntries={['/s/cafe-hoa-sen?table=B01']}>
          <LocationProbe />
          <Routes>
            <Route path="/s/:slug" element={<TenantStorefrontPage />} />
          </Routes>
        </MemoryRouter>,
      );

      expect(await screen.findByText('Cà Phê Muối Hoa Sen')).toBeInTheDocument();
      const orderAdd = screen.getAllByRole('button', { name: '+ Chọn' })[0];
      expect(orderAdd).toBeDefined();
      fireEvent.click(orderAdd!);
      fireEvent.click(screen.getByRole('button', { name: /Đặt món \(1\)/ }));

      expect(await screen.findByText(/Đã gửi đơn #HS-301 thành công/)).toBeInTheDocument();
      expect(screen.getByTestId('location-probe').textContent).not.toContain('tok-fresh-order');
      const stored = sessionStorage.getItem(STOREFRONT_ORDER_TOKENS_KEY) || '';
      expect(stored).toContain('tenant-hoasen::cafe-hoa-sen::ord-301');
      expect(stored).toContain('tok-fresh-order');
    });

    it('shows cancelled banner on ?payment=cancelled and preserves table on dismiss', async () => {
      const fixture = makeFixture();
      vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(
        jsonResponse({ success: true, data: fixture }),
      );

      render(
        <MemoryRouter initialEntries={['/s/cafe-hoa-sen?order_id=ord-9&payment=cancelled&table=B01']}>
          <LocationProbe />
          <Routes>
            <Route path="/s/:slug" element={<TenantStorefrontPage />} />
          </Routes>
        </MemoryRouter>,
      );

      const banner = await screen.findByRole('status');
      expect(banner).toHaveAttribute('data-payment-return-state', 'cancelled');
      expect(banner).toHaveTextContent('Thanh toán PayOS chưa hoàn tất');

      fireEvent.click(screen.getByRole('button', { name: 'Đóng' }));
      expect(screen.getByTestId('location-probe').textContent).toBe('/s/cafe-hoa-sen?table=B01');
    });
  });

  describe('404 not-found vs transient retry, safe media, empty states, spacing, and touch targets', () => {
    it('renders explicit not-found screen on HTTP 404 without Retry button', async () => {
      vi.spyOn(globalThis, 'fetch').mockImplementation(async (input) => {
        const url = String(input);
        if (url.includes('/api/client-error')) return new Response(null, { status: 204 });
        return jsonResponse({ success: false, code: 'store_not_found', error: 'Store not found' }, 404);
      });

      render(
        <MemoryRouter initialEntries={['/s/khong-ton-tai']}>
          <Routes>
            <Route path="/s/:slug" element={<TenantStorefrontPage />} />
          </Routes>
        </MemoryRouter>,
      );

      expect(await screen.findByText('Không tìm thấy cửa hàng')).toBeInTheDocument();
      expect(screen.queryByRole('button', { name: 'Thử lại' })).not.toBeInTheDocument();
      expect(document.head.querySelector('meta[name="robots"]')?.getAttribute('content')).toBe(
        'noindex, nofollow',
      );
    });

    it('distinguishes transient 503 error from 404 and recovers when clicking Retry', async () => {
      const fixture = makeFixture();
      let storefrontAttempts = 0;
      vi.spyOn(globalThis, 'fetch').mockImplementation(async (input) => {
        const url = String(input);
        if (url.includes('/api/client-error')) return new Response(null, { status: 204 });
        if (url.includes('/api/saas/storefront/cafe-hoa-sen')) {
          storefrontAttempts += 1;
          if (storefrontAttempts === 1) {
            return jsonResponse({ success: false, error: 'Upstream timeout' }, 503);
          }
          return jsonResponse({ success: true, data: fixture }, 200);
        }
        return jsonResponse({ success: false }, 404);
      });

      render(
        <MemoryRouter initialEntries={['/s/cafe-hoa-sen']}>
          <Routes>
            <Route path="/s/:slug" element={<TenantStorefrontPage />} />
          </Routes>
        </MemoryRouter>,
      );

      expect(await screen.findByText('Không thể tải thực đơn')).toBeInTheDocument();
      expect(document.title).toBe('Không thể tải thực đơn cửa hàng');
      expect(document.head.querySelector('meta[name="robots"]')?.getAttribute('content')).toBe(
        'noindex, nofollow',
      );
      expect(document.head.innerHTML).not.toContain('AURA CAFE');
      const retryBtn = screen.getByRole('button', { name: 'Thử lại' });
      expect(retryBtn.className).toContain('min-h-[48px]');

      fireEvent.click(retryBtn);
      expect(await screen.findByText('Cà Phê Muối Hoa Sen')).toBeInTheDocument();
      expect(storefrontAttempts).toBe(2);
    });

    it('renders only safe product and logo URLs and rejects protocol-relative, http, javascript, and data URLs', async () => {
      expect(sanitizeStorefrontMediaUrl('https://cdn.hoasen.vn/img.webp')).toBe(
        'https://cdn.hoasen.vn/img.webp',
      );
      expect(sanitizeStorefrontMediaUrl('/uploads/coffee.png')).toBe('/uploads/coffee.png');
      expect(sanitizeStorefrontMediaUrl('//evil.com/p.png')).toBeNull();
      expect(sanitizeStorefrontMediaUrl('/\\evil.com/p.png')).toBeNull();
      expect(sanitizeStorefrontMediaUrl('http://insecure.example/p.png')).toBeNull();
      expect(sanitizeStorefrontMediaUrl('javascript:alert(1)')).toBeNull();
      expect(sanitizeStorefrontMediaUrl('data:image/svg+xml,<svg/>')).toBeNull();
      expect(sanitizePayosCheckoutUrl('https://example.test/123')).toBeNull();
      expect(sanitizePayosCheckoutUrl('http://pay.payos.vn/123')).toBeNull();
      expect(sanitizePayosCheckoutUrl('https://pay.payos.vn/123')).toBe('https://pay.payos.vn/123');

      const fixture = makeFixture({
        branding: {
          ...makeFixture().branding,
          logoUrl: '//evil.com/logo.png',
        },
        products: [
          {
            id: 'p-safe-https',
            category_id: 'cat-coffee',
            name: 'Món Ảnh HTTPS',
            price: 35000,
            image_url: 'https://cdn.hoasen.vn/safe.webp',
          },
          {
            id: 'p-safe-rel',
            category_id: 'cat-coffee',
            name: 'Món Ảnh Relative',
            price: 35000,
            image_url: '/photos/local.webp',
          },
          {
            id: 'p-proto-rel',
            category_id: 'cat-coffee',
            name: 'Món Protocol Relative',
            price: 35000,
            image_url: '//evil.com/phish.webp',
          },
          {
            id: 'p-js',
            category_id: 'cat-coffee',
            name: 'Món JS URL',
            price: 35000,
            image_url: 'javascript:alert(1)',
          },
          {
            id: 'p-http',
            category_id: 'cat-coffee',
            name: 'Món HTTP Thường',
            price: 35000,
            image_url: 'http://insecure.example/a.jpg',
          },
        ],
      });

      vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(
        jsonResponse({ success: true, data: fixture }),
      );

      render(
        <MemoryRouter initialEntries={['/s/cafe-hoa-sen']}>
          <Routes>
            <Route path="/s/:slug" element={<TenantStorefrontPage />} />
          </Routes>
        </MemoryRouter>,
      );

      expect(await screen.findByText('Món Ảnh HTTPS')).toBeInTheDocument();
      expect(screen.getByAltText('Món Ảnh HTTPS')).toHaveAttribute(
        'src',
        'https://cdn.hoasen.vn/safe.webp',
      );
      expect(screen.getByAltText('Món Ảnh Relative')).toHaveAttribute('src', '/photos/local.webp');
      expect(screen.queryByAltText('Món Protocol Relative')).not.toBeInTheDocument();
      expect(screen.queryByAltText('Món JS URL')).not.toBeInTheDocument();
      expect(screen.queryByAltText('Món HTTP Thường')).not.toBeInTheDocument();
      // Unsafe logo URL falls back to monogram, no <img> rendered for tenant logo.
      expect(screen.queryByAltText('Cà Phê Hoa Sen')).not.toBeInTheDocument();

      // StorefrontPaymentCard also refuses non-HTTPS PayOS checkout URLs.
      render(
        <StorefrontPaymentCard
          order={{
            orderId: 'o1',
            orderNumber: 'HS-1',
            total: 35000,
            tableLabel: 'Bàn 01',
            method: 'payos',
            payosCheckoutUrl: 'http://insecure-payos.example/checkout',
          }}
          payment={fixture.payment}
          accentColor="#D97706"
          onDismiss={vi.fn()}
        />,
      );
      expect(screen.queryByText(/Mở cổng thanh toán PayOS/)).not.toBeInTheDocument();
    });

    it('renders empty-menu state when store has zero products, empty-category state with reset, active cart pb-40 spacing, and >=44x44 controls', async () => {
      const emptyFixture = makeFixture({ products: [] });
      vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(
        jsonResponse({ success: true, data: emptyFixture }),
      );

      const { unmount } = render(
        <MemoryRouter initialEntries={['/s/cafe-hoa-sen']}>
          <Routes>
            <Route path="/s/:slug" element={<TenantStorefrontPage />} />
          </Routes>
        </MemoryRouter>,
      );

      expect(await screen.findByText('Thực đơn đang được cập nhật')).toBeInTheDocument();
      unmount();

      // Now mount store with products + an empty category to test empty-category, spacing, and touch targets.
      const populated = makeFixture();
      vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(
        jsonResponse({ success: true, data: populated }),
      );

      const { container } = render(
        <MemoryRouter initialEntries={['/s/cafe-hoa-sen']}>
          <Routes>
            <Route path="/s/:slug" element={<TenantStorefrontPage />} />
          </Routes>
        </MemoryRouter>,
      );

      expect(await screen.findByText('Cà Phê Muối Hoa Sen')).toBeInTheDocument();
      const shell = container.querySelector('[data-storefront-shell]');
      expect(shell).toHaveClass('pb-12');

      // Switch to empty category ("Bánh ngọt") and reset via "Xem tất cả món".
      const emptyCatBtn = screen.getByRole('button', { name: 'Bánh ngọt' });
      expect(emptyCatBtn.className).toContain('min-h-[44px]');
      fireEvent.click(emptyCatBtn);
      expect(screen.getByText('Chưa có món trong danh mục này')).toBeInTheDocument();
      fireEvent.click(screen.getByRole('button', { name: 'Xem tất cả món' }));
      expect(screen.getByText('Cà Phê Muối Hoa Sen')).toBeInTheDocument();

      // Add item -> cart bar activates -> shell gets safe pb-40 bottom spacing + >=44x44 qty controls.
      const addBtn = screen.getAllByRole('button', { name: '+ Chọn' })[0];
      expect(addBtn).toBeDefined();
      expect(addBtn!.className).toContain('min-h-[44px]');
      fireEvent.click(addBtn!);

      expect(shell).toHaveClass('pb-40');
      const decBtn = screen.getByRole('button', { name: 'Giảm số lượng Cà Phê Muối Hoa Sen' });
      const incBtn = screen.getByRole('button', { name: 'Tăng số lượng Cà Phê Muối Hoa Sen' });
      const submitBtn = screen.getByRole('button', { name: /Đặt món \(1\)/ });
      const tableSelect = screen.getByLabelText('Chọn bàn');

      expect(decBtn.className).toContain('min-h-[44px]');
      expect(decBtn.className).toContain('min-w-[44px]');
      expect(incBtn.className).toContain('min-h-[44px]');
      expect(incBtn.className).toContain('min-w-[44px]');
      expect(submitBtn.className).toContain('min-h-[44px]');
      expect(tableSelect.className).toContain('min-h-[44px]');
    });
  });
});
