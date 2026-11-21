import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { useParams, useSearchParams } from 'react-router-dom';
import { API_BASE, ApiClientError, apiFetch } from '@/lib/api-client';
import { MD3Button, MD3Card } from '@/components/md3';
import { useStorefrontSeo } from './storefront-seo';
import {
  rememberStorefrontOrderToken,
  sanitizeStorefrontMediaUrl,
} from './storefront-helpers';
import { StorefrontPaymentReturn } from './storefront-payment-return';
import {
  StorefrontPaymentCard,
  type StorefrontOrderResult,
  type StorefrontPaymentConfig,
  type StorefrontPaymentMethod,
} from './storefront-payment-card';

interface StorefrontCategory {
  id: string;
  name: string;
  slug: string;
  description?: string | null;
}

interface StorefrontProduct {
  id: string;
  category_id: string;
  name: string;
  price: number;
  description?: string | null;
  image_url?: string | null;
}

interface StorefrontTable {
  id: string;
  code: string;
  name: string;
  zone?: string | null;
}

interface StorefrontPayload {
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
  payment: StorefrontPaymentConfig;
  categories: StorefrontCategory[];
  products: StorefrontProduct[];
  tables: StorefrontTable[];
}

interface CartItem {
  product: StorefrontProduct;
  quantity: number;
}

const GUEST_FALLBACK_PHONE = '0000000000';

export default function TenantStorefrontPage(): ReactNode {
  const { slug } = useParams<{ slug: string }>();
  return <Storefront key={slug} slug={slug} />;
}

function Storefront({ slug }: { slug?: string }) {
  const [searchParams] = useSearchParams();
  const initialTable = searchParams.get('table') || '';

  const [data, setData] = useState<StorefrontPayload | null>(null);
  const [loadState, setLoadState] = useState<'loading' | 'ready' | 'not_found' | 'error'>('loading');
  const [loadError, setLoadError] = useState<string | null>(null);
  const [retry, setRetry] = useState(0);
  const [activeCategory, setActiveCategory] = useState<string>('all');
  const [selectedTableId, setSelectedTableId] = useState<string>('');
  const [cart, setCart] = useState<CartItem[]>([]);
  const [customerName, setCustomerName] = useState('');
  const [customerPhone, setCustomerPhone] = useState('');
  const [paymentMethod, setPaymentMethod] = useState<StorefrontPaymentMethod>('cod');
  const [submitting, setSubmitting] = useState(false);
  const [orderResult, setOrderResult] = useState<StorefrontOrderResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  const activeSlugRef = useRef<string | undefined>(slug);
  const initialTableRef = useRef(initialTable);
  initialTableRef.current = initialTable;
  const submitGenerationRef = useRef(0);
  const submittingRef = useRef(false);
  const mountedRef = useRef(true);

  useStorefrontSeo({
    slug,
    state: loadState,
    displayName: data?.branding.displayName,
    tagline: data?.branding.tagline,
    address: data?.branding.address,
    logoUrl: data?.branding.logoUrl,
  });

  useEffect(() => {
    mountedRef.current = true;
    activeSlugRef.current = slug;

    if (!slug) {
      setData(null);
      setLoadError(null);
      setLoadState('not_found');
      return () => {
        mountedRef.current = false;
      };
    }

    let cancelled = false;
    const controller = new AbortController();
    setLoadState('loading');
    setLoadError(null);

    void apiFetch<{ success: boolean; data?: StorefrontPayload; error?: string }>(
      `/api/saas/storefront/${encodeURIComponent(slug)}`,
      { silent: true, signal: controller.signal }
    )
      .then((res) => {
        if (cancelled || activeSlugRef.current !== slug) return;
        if (res.success && res.data) {
          setData(res.data);
          setLoadState('ready');
          const tableParam = initialTableRef.current;
          const matchedTable = tableParam
            ? res.data.tables.find(
                (t) =>
                  t.id === tableParam ||
                  String(t.code || '').toLowerCase() === tableParam.toLowerCase()
              )
            : res.data.tables[0];
          setSelectedTableId(matchedTable ? matchedTable.id : '');

          if (res.data.payment.hasPayos) {
            setPaymentMethod('payos');
          } else if (res.data.payment.hasBankTransfer) {
            setPaymentMethod('vietqr');
          } else {
            setPaymentMethod('cod');
          }
        } else {
          setData(null);
          setLoadState('not_found');
        }
      })
      .catch((err: unknown) => {
        if (cancelled || activeSlugRef.current !== slug) return;
        if (
          (err instanceof DOMException && err.name === 'AbortError') ||
          (err instanceof Error && err.name === 'AbortError')
        ) {
          return;
        }
        setData(null);
        const isNotFound =
          err instanceof ApiClientError &&
          (err.status === 404 || err.code === 'store_not_found');
        if (isNotFound) {
          setLoadState('not_found');
          setLoadError(null);
        } else {
          setLoadState('error');
          setLoadError(
            err instanceof Error && err.message
              ? err.message
              : 'Không thể kết nối máy chủ thực đơn lúc này. Vui lòng thử lại.'
          );
        }
      });

    return () => {
      cancelled = true;
      controller.abort();
      mountedRef.current = false;
    };
  }, [slug, retry]);

  useEffect(() => {
    if (!data || !initialTable) return;
    const matchedTable = data.tables.find(
      (t) =>
        t.id === initialTable ||
        String(t.code || '').toLowerCase() === initialTable.toLowerCase()
    );
    if (matchedTable) {
      setSelectedTableId(matchedTable.id);
    }
  }, [data, initialTable]);

  const filteredProducts = useMemo(() => {
    if (!data) return [];
    if (activeCategory === 'all') return data.products;
    return data.products.filter((p) => p.category_id === activeCategory);
  }, [data, activeCategory]);

  const cartTotal = useMemo(
    () => cart.reduce((sum, item) => sum + item.product.price * item.quantity, 0),
    [cart]
  );

  const selectedTableObj = useMemo(
    () => data?.tables.find((t) => t.id === selectedTableId) ?? null,
    [data, selectedTableId]
  );

  function addToCart(product: StorefrontProduct) {
    setCart((prev) => {
      const existing = prev.find((i) => i.product.id === product.id);
      if (existing) {
        return prev.map((i) =>
          i.product.id === product.id ? { product: i.product, quantity: i.quantity + 1 } : i
        );
      }
      return [...prev, { product, quantity: 1 }];
    });
  }

  function updateQty(productId: string, delta: number) {
    setCart((prev) =>
      prev
        .map((i) => (i.product.id === productId ? { ...i, quantity: i.quantity + delta } : i))
        .filter((i) => i.quantity > 0)
    );
  }

  async function placeOrder() {
    if (!data || data.tenant.isReadOnly || cart.length === 0 || submitting || submittingRef.current) return;
    const requestTenant = data.tenant;
    const requestSlug = slug;
    const requestGeneration = submitGenerationRef.current;
    const requestMethod = paymentMethod;
    const requestCart = [...cart];
    const requestCartTotal = cartTotal;
    const requestTableId = selectedTableId;
    const requestTableLabel = selectedTableObj ? selectedTableObj.name : 'Mang đi / Tại quầy';
    const isStaleSubmit = () =>
      !mountedRef.current ||
      submitGenerationRef.current !== requestGeneration ||
      activeSlugRef.current !== requestSlug;

    submittingRef.current = true;
    setError(null);
    setSubmitting(true);
    try {
      const cleanPhone = customerPhone.replace(/\s+/g, '').trim();
      const effectivePhone = cleanPhone.length >= 8 ? cleanPhone.slice(0, 15) : GUEST_FALLBACK_PHONE;
      const effectiveName = customerName.trim() || 'Khách tại bàn';
      const backendMethod: 'cod' | 'payos' = requestMethod === 'payos' ? 'payos' : 'cod';

      // Use clean guest fetch without session cookies or unrelated localStorage staff Bearer tokens
      const orderResp = await fetch(
        `${API_BASE}/api/orders?store=${encodeURIComponent(requestTenant.slug)}`,
        {
          method: 'POST',
          credentials: 'omit',
          headers: {
            'Content-Type': 'application/json',
            'X-Tenant-Slug': requestTenant.slug,
            'X-Tenant-ID': requestTenant.id,
          },
          body: JSON.stringify({
            total: requestCartTotal,
            customer_name: effectiveName,
            customer_phone: effectivePhone,
            payment_method: backendMethod,
            order_type: requestTableId ? 'dine_in' : 'takeaway',
            ...(requestTableId ? { table_id: requestTableId } : {}),
            ...(requestMethod === 'vietqr' ? { notes: 'Chuyển khoản VietQR tại bàn' } : {}),
            items: requestCart.map((i) => ({
              product_id: i.product.id,
              name: i.product.name,
              price: i.product.price,
              quantity: i.quantity,
            })),
          }),
        }
      );

      const res = (await orderResp.json().catch(() => ({}))) as {
        success?: boolean;
        error?: string;
        order_token?: string;
        data?: {
          id?: string;
          order_id?: string;
          order_number?: string;
          total?: number;
          order_token?: string;
        };
        order?: { id?: string; order_number?: string; total?: number };
      };

      if (isStaleSubmit()) return;

      const rawOrderId = res.data?.id ?? res.data?.order_id ?? res.order?.id;
      const orderId =
        typeof rawOrderId === 'string'
          ? rawOrderId.trim()
          : typeof rawOrderId === 'number' && Number.isFinite(rawOrderId)
            ? String(rawOrderId)
            : '';
      const rawOrderNumber = res.data?.order_number ?? res.order?.order_number;
      const parsedOrderNumber =
        typeof rawOrderNumber === 'string'
          ? rawOrderNumber.trim()
          : typeof rawOrderNumber === 'number' && Number.isFinite(rawOrderNumber)
            ? String(rawOrderNumber)
            : '';
      const orderNumber = parsedOrderNumber || orderId.slice(-8) || orderId.slice(0, 8);
      const parsedTotal = Number(res.data?.total ?? res.order?.total ?? requestCartTotal);
      const serverTotal = Number.isFinite(parsedTotal) && parsedTotal >= 0 ? parsedTotal : requestCartTotal;
      const rawOrderToken = res.order_token ?? res.data?.order_token ?? '';
      const orderToken = typeof rawOrderToken === 'string' ? rawOrderToken.trim() : '';

      if (!orderResp.ok || res.success === false || !orderId) {
        setError(res.error || 'Không thể gửi đơn hàng lúc này.');
        return;
      }

      if (orderToken) {
        rememberStorefrontOrderToken(requestTenant.id, requestTenant.slug, orderId, orderToken);
      }

      let payosCheckoutUrl: string | null = null;
      let payosOrderCode: number | null = null;
      let paymentError: string | null = null;

      if (requestMethod === 'payos') {
        try {
          const payResp = await fetch(`${API_BASE}/api/payment/create-link`, {
            method: 'POST',
            credentials: 'omit',
            headers: {
              'Content-Type': 'application/json',
              'X-Tenant-Slug': requestTenant.slug,
              'X-Tenant-ID': requestTenant.id,
              ...(orderToken ? { 'X-Order-Token': orderToken } : {}),
            },
            body: JSON.stringify({
              order_id: orderId,
              amount: serverTotal,
              description: `DH ${orderNumber}`.slice(0, 25),
              customer_name: effectiveName,
            }),
          });
          const payJson = (await payResp.json().catch(() => ({}))) as {
            success?: boolean;
            checkoutUrl?: string;
            checkout_url?: string;
            orderCode?: number;
            error?: string;
            data?: {
              paymentUrl?: string;
              checkoutUrl?: string;
              checkout_url?: string;
              orderCode?: number;
            };
          };
          const resolvedCheckoutUrl = String(
            payJson.checkoutUrl ||
              payJson.checkout_url ||
              payJson.data?.checkoutUrl ||
              payJson.data?.checkout_url ||
              payJson.data?.paymentUrl ||
              ''
          ).trim();
          if (payResp.ok && payJson.success !== false && resolvedCheckoutUrl) {
            payosCheckoutUrl = resolvedCheckoutUrl;
            const codeCandidate = payJson.orderCode ?? payJson.data?.orderCode;
            payosOrderCode =
              typeof codeCandidate === 'number' && Number.isFinite(codeCandidate) ? codeCandidate : null;
          } else {
            paymentError =
              payJson.error ||
              'Chưa tạo được link PayOS. Vui lòng quét mã VietQR bên dưới hoặc thanh toán tại quầy.';
          }
        } catch {
          paymentError =
            'Không kết nối được cổng PayOS. Vui lòng quét mã VietQR bên dưới hoặc thanh toán tại quầy.';
        }
      }

      if (isStaleSubmit()) return;

      setOrderResult({
        orderId,
        orderNumber,
        total: serverTotal,
        tableLabel: requestTableLabel,
        method: requestMethod,
        payosCheckoutUrl,
        payosOrderCode,
        paymentError,
      });
      setCart([]);
    } catch (err) {
      if (!isStaleSubmit()) {
        setError(err instanceof Error ? err.message : 'Lỗi gửi đơn hàng.');
      }
    } finally {
      if (!isStaleSubmit()) {
        submittingRef.current = false;
        setSubmitting(false);
      }
    }
  }

  if (loadState === 'loading') {
    return (
      <div className="min-h-screen bg-slate-950 text-slate-300 flex items-center justify-center p-6">
        Đang tải thực đơn cửa hàng...
      </div>
    );
  }

  if (loadState === 'error') {
    return (
      <div className="min-h-screen bg-slate-950 text-slate-100 flex items-center justify-center p-6">
        <MD3Card
          variant="outlined"
          role="alert"
          className="max-w-md w-full text-center space-y-4 p-8 bg-[var(--md-sys-color-surface-container-low)] text-[var(--md-sys-color-on-surface)]"
        >
          <h1 className="m3-headline-small text-[var(--md-sys-color-on-surface)]">
            Không thể tải thực đơn
          </h1>
          <p className="m3-body-medium text-[var(--md-sys-color-on-surface-variant)]">
            {loadError || 'Kết nối tạm thời bị gián đoạn. Vui lòng thử lại.'}
          </p>
          <div className="pt-1 flex justify-center">
            <MD3Button
              type="button"
              variant="filled"
              className="min-w-[44px]"
              onClick={() => setRetry((n) => n + 1)}
            >
              Thử lại
            </MD3Button>
          </div>
        </MD3Card>
      </div>
    );
  }

  if (loadState === 'not_found' || !data) {
    return (
      <div className="min-h-screen bg-slate-950 text-slate-100 flex items-center justify-center p-6">
        <MD3Card
          variant="outlined"
          className="max-w-md w-full text-center space-y-3 p-8 bg-[var(--md-sys-color-surface-container-low)] text-[var(--md-sys-color-on-surface)]"
        >
          <h1 className="m3-headline-small text-[var(--md-sys-color-on-surface)]">
            Không tìm thấy cửa hàng
          </h1>
          <p className="m3-body-medium text-[var(--md-sys-color-on-surface-variant)]">
            Đường dẫn <span className="font-mono text-amber-400">/s/{slug}</span> không tồn tại hoặc đã thay đổi.
          </p>
        </MD3Card>
      </div>
    );
  }

  const { branding, tenant } = data;
  const safeLogoUrl = sanitizeStorefrontMediaUrl(branding.logoUrl);
  const hasActiveCartBar = cart.length > 0 && !tenant.isReadOnly;

  return (
    <div
      data-storefront-shell={hasActiveCartBar ? 'cart-active' : 'cart-idle'}
      className={`min-h-screen bg-slate-950 text-slate-100 ${hasActiveCartBar ? 'pb-40' : 'pb-12'}`}
    >
      {/* Tenant-branded header */}
      <header
        className="border-b border-white/10 px-4 py-6"
        style={{ backgroundColor: branding.primaryColor || '#1F2937' }}
      >
        <div className="max-w-4xl mx-auto flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            {safeLogoUrl ? (
              <img
                src={safeLogoUrl}
                alt={branding.displayName}
                className="h-12 w-12 rounded-xl object-cover border border-white/20 shrink-0"
              />
            ) : (
              <div
                className="h-12 w-12 rounded-xl flex items-center justify-center font-bold text-lg text-slate-950 shrink-0"
                style={{ backgroundColor: branding.accentColor || '#D97706' }}
              >
                {branding.displayName.slice(0, 1).toUpperCase()}
              </div>
            )}
            <div>
              <h1 className="text-xl font-bold text-white">{branding.displayName}</h1>
              {branding.tagline && <p className="text-xs text-white/80">{branding.tagline}</p>}
              {branding.address && <p className="text-[11px] text-white/60 mt-0.5">{branding.address}</p>}
            </div>
          </div>

          {data.tables.length > 0 && (
            <select
              aria-label="Chọn bàn"
              value={selectedTableId}
              onChange={(e) => setSelectedTableId(e.target.value)}
              className="min-h-[44px] min-w-[44px] rounded-lg bg-black/30 border border-white/20 px-3 py-2 text-xs text-white"
            >
              <option value="" className="bg-slate-900">
                Mang đi / Tại quầy
              </option>
              {data.tables.map((t) => (
                <option key={t.id} value={t.id} className="bg-slate-900">
                  {t.name}
                </option>
              ))}
            </select>
          )}
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-4 py-6 space-y-6">
        {tenant.isReadOnly && (
          <div className="rounded-xl border border-amber-500/40 bg-amber-500/10 px-4 py-3 text-sm text-amber-200">
            Cửa hàng hiện đang tạm ngưng nhận đơn trực tuyến. Vui lòng liên hệ nhân viên tại quầy.
          </div>
        )}

        <StorefrontPaymentReturn tenant={{ id: tenant.id, slug: tenant.slug }} />

        {orderResult && (
          <StorefrontPaymentCard
            order={orderResult}
            payment={data.payment}
            accentColor={branding.accentColor || '#D97706'}
            onDismiss={() => setOrderResult(null)}
          />
        )}

        {error && (
          <div role="alert" className="rounded-xl border border-rose-500/40 bg-rose-500/10 px-4 py-3 text-sm text-rose-200">
            {error}
          </div>
        )}

        {/* Categories */}
        {data.products.length > 0 && (
          <div className="flex gap-2 overflow-x-auto pb-1">
            <button
              type="button"
              onClick={() => setActiveCategory('all')}
              className={`min-h-[44px] min-w-[44px] px-4 py-2 rounded-full text-xs font-semibold whitespace-nowrap border transition ${
                activeCategory === 'all'
                  ? 'text-slate-950 border-transparent'
                  : 'border-slate-800 bg-slate-900 text-slate-300'
              }`}
              style={activeCategory === 'all' ? { backgroundColor: branding.accentColor || '#D97706' } : undefined}
            >
              Tất cả ({data.products.length})
            </button>
            {data.categories.map((cat) => (
              <button
                key={cat.id}
                type="button"
                onClick={() => setActiveCategory(cat.id)}
                className={`min-h-[44px] min-w-[44px] px-4 py-2 rounded-full text-xs font-semibold whitespace-nowrap border transition ${
                  activeCategory === cat.id
                    ? 'text-slate-950 border-transparent'
                    : 'border-slate-800 bg-slate-900 text-slate-300'
                }`}
                style={activeCategory === cat.id ? { backgroundColor: branding.accentColor || '#D97706' } : undefined}
              >
                {cat.name}
              </button>
            ))}
          </div>
        )}

        {/* Products Grid or Empty States */}
        {data.products.length === 0 ? (
          <MD3Card
            variant="outlined"
            className="p-8 text-center space-y-2 bg-[var(--md-sys-color-surface-container-low)] text-[var(--md-sys-color-on-surface)]"
          >
            <h2 className="m3-title-medium text-[var(--md-sys-color-on-surface)]">
              Thực đơn đang được cập nhật
            </h2>
            <p className="m3-body-medium text-[var(--md-sys-color-on-surface-variant)]">
              Cửa hàng chưa có món nào mở bán trực tuyến. Vui lòng quay lại sau hoặc đặt trực tiếp tại quầy.
            </p>
          </MD3Card>
        ) : filteredProducts.length === 0 ? (
          <MD3Card
            variant="outlined"
            className="p-8 text-center space-y-3 bg-[var(--md-sys-color-surface-container-low)] text-[var(--md-sys-color-on-surface)]"
          >
            <h2 className="m3-title-medium text-[var(--md-sys-color-on-surface)]">
              Chưa có món trong danh mục này
            </h2>
            <p className="m3-body-medium text-[var(--md-sys-color-on-surface-variant)]">
              Vui lòng chọn danh mục khác hoặc xem toàn bộ thực đơn hiện có.
            </p>
            <div className="pt-1 flex justify-center">
              <MD3Button
                type="button"
                variant="tonal"
                className="min-w-[44px]"
                onClick={() => setActiveCategory('all')}
              >
                Xem tất cả món
              </MD3Button>
            </div>
          </MD3Card>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {filteredProducts.map((product) => {
              const inCart = cart.find((i) => i.product.id === product.id);
              const safeImageUrl = sanitizeStorefrontMediaUrl(product.image_url);
              return (
                <div
                  key={product.id}
                  className="rounded-xl border border-slate-800 bg-slate-900/80 p-4 flex items-center justify-between gap-3"
                >
                  <div className="flex items-center gap-3 min-w-0">
                    {safeImageUrl && (
                      <img
                        src={safeImageUrl}
                        alt={product.name}
                        loading="lazy"
                        className="h-20 w-20 rounded-xl object-cover shrink-0 border border-slate-800"
                      />
                    )}
                    <div className="space-y-1 min-w-0">
                      <h3 className="font-semibold text-white text-sm">{product.name}</h3>
                      {product.description && (
                        <p className="text-xs text-slate-400 line-clamp-2">{product.description}</p>
                      )}
                      <div className="text-sm font-bold" style={{ color: branding.accentColor || '#F59E0B' }}>
                        {Number(product.price).toLocaleString('vi-VN')}đ
                      </div>
                    </div>
                  </div>

                  {!tenant.isReadOnly && (
                    <div className="flex items-center gap-2 shrink-0">
                      {inCart ? (
                        <>
                          <button
                            type="button"
                            aria-label={`Giảm số lượng ${product.name}`}
                            onClick={() => updateQty(product.id, -1)}
                            className="h-11 w-11 min-h-[44px] min-w-[44px] rounded-lg bg-slate-800 text-white font-bold flex items-center justify-center"
                          >
                            -
                          </button>
                          <span className="w-6 text-center text-sm font-semibold tabular-nums">
                            {inCart.quantity}
                          </span>
                          <button
                            type="button"
                            aria-label={`Tăng số lượng ${product.name}`}
                            onClick={() => updateQty(product.id, 1)}
                            className="h-11 w-11 min-h-[44px] min-w-[44px] rounded-lg text-slate-950 font-bold flex items-center justify-center"
                            style={{ backgroundColor: branding.accentColor || '#D97706' }}
                          >
                            +
                          </button>
                        </>
                      ) : (
                        <button
                          type="button"
                          onClick={() => addToCart(product)}
                          className="min-h-[44px] min-w-[44px] rounded-lg px-4 py-2.5 text-xs font-bold text-slate-950"
                          style={{ backgroundColor: branding.accentColor || '#D97706' }}
                        >
                          + Chọn
                        </button>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </main>

      {/* Bottom Cart Bar */}
      {hasActiveCartBar && (
        <div className="fixed bottom-0 inset-x-0 border-t border-slate-800 bg-slate-900/95 backdrop-blur px-4 pt-4 pb-[max(1rem,env(safe-area-inset-bottom))]">
          <div className="max-w-4xl mx-auto flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="flex items-center gap-2.5 flex-wrap">
              <input
                type="text"
                aria-label="Tên của bạn"
                value={customerName}
                onChange={(e) => setCustomerName(e.target.value)}
                placeholder="Tên của bạn (tùy chọn)"
                className="min-h-[44px] rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-xs text-white"
              />
              <input
                type="tel"
                aria-label="Số điện thoại"
                value={customerPhone}
                onChange={(e) => setCustomerPhone(e.target.value)}
                placeholder="Số ĐT (tùy chọn)"
                className="min-h-[44px] rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-xs text-white w-36"
              />
              <select
                aria-label="Phương thức thanh toán"
                value={paymentMethod}
                onChange={(e) => setPaymentMethod(e.target.value as StorefrontPaymentMethod)}
                className="min-h-[44px] min-w-[44px] rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-xs text-white"
              >
                <option value="cod">Tiền mặt tại quầy</option>
                {data.payment.hasBankTransfer && (
                  <option value="vietqr">
                    Chuyển khoản VietQR{data.payment.bankName ? ` (${data.payment.bankName})` : ''}
                  </option>
                )}
                {data.payment.hasPayos && <option value="payos">Thanh toán tự động PayOS</option>}
              </select>
            </div>
            <button
              type="button"
              disabled={submitting}
              onClick={placeOrder}
              className="min-h-[44px] min-w-[44px] rounded-xl px-6 py-3 text-sm font-bold text-slate-950 disabled:opacity-50"
              style={{ backgroundColor: branding.accentColor || '#D97706' }}
            >
              {submitting
                ? 'Đang gửi đơn...'
                : `Đặt món (${cart.reduce((s, i) => s + i.quantity, 0)}) • ${cartTotal.toLocaleString('vi-VN')}đ`}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
