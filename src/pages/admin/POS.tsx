import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardBody, CardHeader } from '@/components/ui/card';
import { useMenu } from '@/hooks/use-menu';
import { useCheckout } from '@/hooks/use-checkout';
import type { OrderApiPayload } from '@/lib/validators';

interface PosCartItem {
  id: string;
  name: string;
  price: number;
  quantity: number;
}

export default function AdminPOSPage() {
  const { data: menuData, isLoading: menuLoading } = useMenu({ available: true, limit: 100 });
  const checkoutMutation = useCheckout();
  const [cart, setCart] = useState<PosCartItem[]>([]);
  const [search, setSearch] = useState('');
  const [tableNumber, setTableNumber] = useState('');
  const [customerName, setCustomerName] = useState('');
  const [customerPhone, setCustomerPhone] = useState('');

  const menuItems = menuData?.items || [];

  const filteredMenu = menuItems.filter((item) =>
    item.name.toLowerCase().includes(search.toLowerCase())
  );

  const addToCart = (item: typeof menuItems[0]) => {
    setCart((prev) => {
      const existing = prev.find((ci) => ci.id === String(item.id));
      if (existing) {
        return prev.map((ci) =>
          ci.id === String(item.id) ? { ...ci, quantity: ci.quantity + 1 } : ci
        );
      }
      return [...prev, { id: String(item.id), name: item.name, price: item.price, quantity: 1 }];
    });
  };

  const updateQuantity = (itemId: string, delta: number) => {
    setCart((prev) =>
      prev
        .map((ci) =>
          ci.id === itemId ? { ...ci, quantity: Math.max(0, ci.quantity + delta) } : ci
        )
        .filter((ci) => ci.quantity > 0)
    );
  };

  const subtotal = cart.reduce((sum, item) => sum + item.price * item.quantity, 0);

  const handleCheckout = async () => {
    if (cart.length === 0) return;

    try {
      const result = await checkoutMutation.mutateAsync({
        items: cart.map((ci) => ({
          id: ci.id,
          name: ci.name,
          price: ci.price,
          quantity: ci.quantity,
        })),
        total: subtotal,
        customer_name: customerName || 'Khách tại quán',
        customer_phone: customerPhone || '0900000000',
        customer_email: undefined,
        customer_address: 'Tại quán',
        payment_method: 'cod' as const,
        notes: tableNumber ? `Bàn số: ${tableNumber}` : undefined,
      } as OrderApiPayload);

      if (result.success) {
        setCart([]);
        setTableNumber('');
        setCustomerName('');
        setCustomerPhone('');
      }
    } catch {
      // Error from mutation
    }
  };

  const categories = [...new Set(menuItems.map((item) => item.category))];

  return (
    <div className="min-h-screen bg-background p-6">
      <div className="max-w-7xl mx-auto">
        <h1 className="text-2xl font-display font-bold mb-6">POS &mdash; Nhập đơn</h1>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Menu items */}
          <div className="lg:col-span-2">
            <Card>
              <CardHeader>
                <Input
                  placeholder="Tìm kiếm món..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                />
              </CardHeader>
              <CardBody>
                {menuLoading ? (
                  <div className="text-center py-8 text-muted text-sm">Đang tải thực đơn...</div>
                ) : (
                  categories.map((cat) => {
                    const catItems = filteredMenu.filter((item) => item.category === cat);
                    if (catItems.length === 0) return null;
                    return (
                      <div key={cat} className="mb-4">
                        <h3 className="text-xs font-medium text-muted uppercase tracking-wider mb-2">
                          {cat}
                        </h3>
                        <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
                          {catItems.map((item) => (
                            <button
                              key={item.id}
                              onClick={() => addToCart(item)}
                              className="p-3 rounded-lg border border-border bg-white hover:bg-blue-50 hover:border-blue-300 text-left transition-colors text-sm"
                            >
                              <div className="font-medium">{item.name}</div>
                              <div className="text-xs text-muted font-mono">
                                {item.price.toLocaleString('vi-VN')}₫
                              </div>
                            </button>
                          ))}
                        </div>
                      </div>
                    );
                  })
                )}
              </CardBody>
            </Card>
          </div>

          {/* Cart */}
          <div>
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <h2 className="font-display font-semibold">Giỏ hàng</h2>
                  <span className="text-xs text-muted">{cart.length} món</span>
                </div>
              </CardHeader>
              <CardBody>
                {/* Table & Customer */}
                <div className="space-y-2 mb-4">
                  <Input
                    placeholder="Số bàn (VD: 5)"
                    value={tableNumber}
                    onChange={(e) => setTableNumber(e.target.value)}
                  />
                  <Input
                    placeholder="Tên khách"
                    value={customerName}
                    onChange={(e) => setCustomerName(e.target.value)}
                  />
                  <Input
                    placeholder="SĐT khách"
                    value={customerPhone}
                    onChange={(e) => setCustomerPhone(e.target.value)}
                  />
                </div>

                {/* Cart items */}
                {cart.length === 0 ? (
                  <div className="text-center py-8 text-muted text-sm">
                    Chưa có món nào
                  </div>
                ) : (
                  <div className="space-y-2 mb-4 max-h-80 overflow-y-auto">
                    {cart.map((item) => (
                      <div
                        key={item.id}
                        className="flex items-center justify-between py-2 border-b border-border/60"
                      >
                        <div className="flex-1">
                          <p className="text-sm font-medium">{item.name}</p>
                          <p className="text-xs text-muted font-mono">
                            {item.price.toLocaleString('vi-VN')}₫
                          </p>
                        </div>
                        <div className="flex items-center gap-2">
                          <button
                            onClick={() => updateQuantity(item.id, -1)}
                            className="w-7 h-7 rounded-full border border-border flex items-center justify-center text-sm hover:bg-gray-100"
                          >
                            -
                          </button>
                          <span className="w-6 text-center text-sm font-mono">
                            {item.quantity}
                          </span>
                          <button
                            onClick={() => updateQuantity(item.id, 1)}
                            className="w-7 h-7 rounded-full border border-border flex items-center justify-center text-sm hover:bg-gray-100"
                          >
                            +
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}

                {/* Totals */}
                <div className="border-t border-border pt-3 mb-4">
                  <div className="flex justify-between text-sm">
                    <span className="text-muted">Tạm tính</span>
                    <span className="font-mono">{subtotal.toLocaleString('vi-VN')}₫</span>
                  </div>
                  <div className="flex justify-between text-sm font-bold mt-1">
                    <span>Tổng cộng</span>
                    <span className="font-mono">{subtotal.toLocaleString('vi-VN')}₫</span>
                  </div>
                </div>

                {/* Checkout error */}
                {checkoutMutation.isError && (
                  <div className="mb-3 text-xs text-red-600">
                    {checkoutMutation.error?.message || 'Không thể tạo đơn hàng'}
                  </div>
                )}

                {/* Checkout success */}
                {checkoutMutation.isSuccess && (
                  <div className="mb-3 text-xs text-green-600">
                    Đã tạo đơn thành công!
                  </div>
                )}

                {/* Actions */}
                <div className="grid grid-cols-2 gap-2">
                  <Button
                    variant="secondary"
                    onClick={() => setCart([])}
                    disabled={cart.length === 0}
                  >
                    Xoá
                  </Button>
                  <Button
                    onClick={handleCheckout}
                    disabled={cart.length === 0 || checkoutMutation.isPending}
                    loading={checkoutMutation.isPending}
                  >
                    {checkoutMutation.isPending ? 'Đang tạo...' : 'Thanh toán'}
                  </Button>
                </div>
              </CardBody>
            </Card>
          </div>
        </div>
      </div>
    </div>
  );
}
