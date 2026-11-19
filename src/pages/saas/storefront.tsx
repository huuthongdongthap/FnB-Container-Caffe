import { useEffect, useMemo, useState, type ReactNode } from 'react';
import { useParams, useSearchParams } from 'react-router-dom';
import { apiFetch } from '@/lib/api-client';

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
  payment: {
    provider: string;
    hasBankTransfer: boolean;
    bankName: string | null;
  };
  categories: StorefrontCategory[];
  products: StorefrontProduct[];
  tables: StorefrontTable[];
}

interface CartItem {
  product: StorefrontProduct;
  quantity: number;
}

export default function TenantStorefrontPage(): ReactNode {
  const { slug } = useParams<{ slug: string }>();
  const [searchParams] = useSearchParams();
  const initialTable = searchParams.get('table') || '';

  const [data, setData] = useState<StorefrontPayload | null>(null);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);
  const [activeCategory, setActiveCategory] = useState<string>('all');
  const [selectedTable, setSelectedTable] = useState<string>(initialTable);
  const [cart, setCart] = useState<CartItem[]>([]);
  const [customerName, setCustomerName] = useState('');
  const [paymentMethod, setPaymentMethod] = useState<'cash' | 'payos'>('cash');
  const [submitting, setSubmitting] = useState(false);
  const [orderResult, setOrderResult] = useState<{ orderId: string; orderNumber: string; total: number } | null>(
    null
  );
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!slug) return;
    setLoading(true);
    setNotFound(false);
    void apiFetch<{ success: boolean; data?: StorefrontPayload }>(
      `/api/saas/storefront/${encodeURIComponent(slug)}`,
      { silent: true }
    )
      .then((res) => {
        if (res.success && res.data) {
          setData(res.data);
          if (!initialTable && res.data.tables[0]) {
            setSelectedTable(res.data.tables[0].code);
          }
        } else {
          setNotFound(true);
        }
      })
      .catch(() => setNotFound(true))
      .finally(() => setLoading(false));
  }, [slug, initialTable]);

  const filteredProducts = useMemo(() => {
    if (!data) return [];
    if (activeCategory === 'all') return data.products;
    return data.products.filter((p) => p.category_id === activeCategory);
  }, [data, activeCategory]);

  const cartTotal = useMemo(
    () => cart.reduce((sum, item) => sum + item.product.price * item.quantity, 0),
    [cart]
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
    if (!data || cart.length === 0) return;
    setError(null);
    setSubmitting(true);
    try {
      const res = await apiFetch<{
        success: boolean;
        error?: string;
        data?: { id?: string; order_id?: string; order_number?: string; total?: number };
        order?: { id?: string; order_number?: string; total?: number };
      }>(`/api/orders?store=${encodeURIComponent(data.tenant.slug)}`, {
        method: 'POST',
        headers: {
          'X-Tenant-Slug': data.tenant.slug,
          'X-Tenant-ID': data.tenant.id,
        },
        body: JSON.stringify({
          table_number: selectedTable || 'TAKEAWAY',
          customer_name: customerName.trim() || 'Khách tại bàn',
          payment_method: paymentMethod,
          items: cart.map((i) => ({
            product_id: i.product.id,
            name: i.product.name,
            price: i.product.price,
            quantity: i.quantity,
          })),
        }),
      });

      const orderId = res.data?.id || res.data?.order_id || res.order?.id || '';
      const orderNumber = res.data?.order_number || res.order?.order_number || orderId.slice(0, 8);
      if (!res.success && !orderId) {
        setError(res.error || 'Không thể gửi đơn hàng lúc này.');
        return;
      }
      setOrderResult({ orderId, orderNumber, total: cartTotal });
      setCart([]);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Lỗi gửi đơn hàng.');
    } finally {
      setSubmitting(false);
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-950 text-slate-300 flex items-center justify-center">
        Đang tải thực đơn cửa hàng...
      </div>
    );
  }

  if (notFound || !data) {
    return (
      <div className="min-h-screen bg-slate-950 text-slate-100 flex items-center justify-center p-6">
        <div className="max-w-md text-center space-y-3 rounded-2xl border border-slate-800 bg-slate-900 p-8">
          <h1 className="text-xl font-bold">Không tìm thấy cửa hàng</h1>
          <p className="text-sm text-slate-400">
            Đường dẫn <span className="font-mono text-amber-400">/s/{slug}</span> không tồn tại hoặc đã thay đổi.
          </p>
        </div>
      </div>
    );
  }

  const { branding, tenant } = data;

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 pb-28">
      {/* Tenant-branded header */}
      <header
        className="border-b border-white/10 px-4 py-6"
        style={{ backgroundColor: branding.primaryColor || '#1F2937' }}
      >
        <div className="max-w-4xl mx-auto flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            {branding.logoUrl ? (
              <img
                src={branding.logoUrl}
                alt={branding.displayName}
                className="h-12 w-12 rounded-xl object-cover border border-white/20"
              />
            ) : (
              <div
                className="h-12 w-12 rounded-xl flex items-center justify-center font-bold text-lg text-slate-950"
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
              value={selectedTable}
              onChange={(e) => setSelectedTable(e.target.value)}
              className="rounded-lg bg-black/30 border border-white/20 px-3 py-2 text-xs text-white"
            >
              {data.tables.map((t) => (
                <option key={t.id} value={t.code} className="bg-slate-900">
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

        {orderResult && (
          <div className="rounded-xl border border-emerald-500/40 bg-emerald-500/10 p-4 space-y-1">
            <div className="text-sm font-bold text-emerald-300">
              ✓ Đã gửi đơn #{orderResult.orderNumber} thành công!
            </div>
            <div className="text-xs text-slate-300">
              Tổng cộng: <strong>{orderResult.total.toLocaleString('vi-VN')}đ</strong> — Bàn{' '}
              <strong>{selectedTable || 'Tại quầy'}</strong>.
            </div>
          </div>
        )}

        {error && (
          <div className="rounded-xl border border-rose-500/40 bg-rose-500/10 px-4 py-3 text-sm text-rose-200">
            {error}
          </div>
        )}

        {/* Categories */}
        <div className="flex gap-2 overflow-x-auto pb-1">
          <button
            type="button"
            onClick={() => setActiveCategory('all')}
            className={`px-4 py-2 rounded-full text-xs font-semibold whitespace-nowrap border transition ${
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
              className={`px-4 py-2 rounded-full text-xs font-semibold whitespace-nowrap border transition ${
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

        {/* Products Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {filteredProducts.map((product) => {
            const inCart = cart.find((i) => i.product.id === product.id);
            return (
              <div
                key={product.id}
                className="rounded-xl border border-slate-800 bg-slate-900/80 p-4 flex items-center justify-between gap-3"
              >
                <div className="space-y-1">
                  <h3 className="font-semibold text-white text-sm">{product.name}</h3>
                  {product.description && (
                    <p className="text-xs text-slate-400 line-clamp-2">{product.description}</p>
                  )}
                  <div className="text-sm font-bold" style={{ color: branding.accentColor || '#F59E0B' }}>
                    {Number(product.price).toLocaleString('vi-VN')}đ
                  </div>
                </div>

                {!tenant.isReadOnly && (
                  <div className="flex items-center gap-2">
                    {inCart ? (
                      <>
                        <button
                          type="button"
                          onClick={() => updateQty(product.id, -1)}
                          className="h-8 w-8 rounded-lg bg-slate-800 text-white font-bold"
                        >
                          -
                        </button>
                        <span className="w-5 text-center text-sm font-semibold">{inCart.quantity}</span>
                        <button
                          type="button"
                          onClick={() => updateQty(product.id, 1)}
                          className="h-8 w-8 rounded-lg text-slate-950 font-bold"
                          style={{ backgroundColor: branding.accentColor || '#D97706' }}
                        >
                          +
                        </button>
                      </>
                    ) : (
                      <button
                        type="button"
                        onClick={() => addToCart(product)}
                        className="rounded-lg px-3.5 py-2 text-xs font-bold text-slate-950"
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
      </main>

      {/* Bottom Cart Bar */}
      {cart.length > 0 && !tenant.isReadOnly && (
        <div className="fixed bottom-0 inset-x-0 border-t border-slate-800 bg-slate-900/95 backdrop-blur p-4">
          <div className="max-w-4xl mx-auto flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="flex items-center gap-3 flex-wrap">
              <input
                type="text"
                value={customerName}
                onChange={(e) => setCustomerName(e.target.value)}
                placeholder="Tên của bạn (tùy chọn)"
                className="rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-xs text-white"
              />
              <select
                value={paymentMethod}
                onChange={(e) => setPaymentMethod(e.target.value as 'cash' | 'payos')}
                className="rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-xs text-white"
              >
                <option value="cash">Tiền mặt / Chuyển khoản tại quầy</option>
                {data.payment.provider === 'payos' && <option value="payos">Thanh toán QR PayOS</option>}
              </select>
            </div>
            <button
              type="button"
              disabled={submitting}
              onClick={placeOrder}
              className="rounded-xl px-6 py-3 text-sm font-bold text-slate-950 disabled:opacity-50"
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
