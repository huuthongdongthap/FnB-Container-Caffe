import { useState } from 'react';
import { HelmetHead } from '@/components/seo/HelmetHead';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardBody } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { useAuthStore } from '@/hooks/stores/use-auth-store';
import { useAccount, type OrderSummary } from '@/hooks/use-account';
import { Link } from 'react-router-dom';

type Tab = 'profile' | 'orders' | 'rewards';

function formatCurrency(vnd: number): string {
  return new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND' }).format(vnd);
}

function parseItems(items: string): { product_name: string; quantity: number }[] {
  try { return JSON.parse(items); } catch { return []; }
}

function statusBadge(status: string) {
  const colors: Record<string, string> = {
    pending: 'bg-amber-100 text-amber-800',
    confirmed: 'bg-blue-100 text-blue-800',
    preparing: 'bg-purple-100 text-purple-800',
    ready: 'bg-green-100 text-green-800',
    served: 'bg-gray-100 text-gray-800',
    completed: 'bg-green-100 text-green-800',
    cancelled: 'bg-red-100 text-red-800',
  };
  const labels: Record<string, string> = {
    pending: 'Chờ xác nhận', confirmed: 'Đã xác nhận', preparing: 'Đang pha chế',
    ready: 'Sẵn sàng', served: 'Đã phục vụ', completed: 'Hoàn thành', cancelled: 'Đã huỷ',
  };
  return (
    <span className={`inline-block rounded-full px-2.5 py-0.5 text-xs font-medium ${colors[status] || 'bg-gray-100 text-gray-800'}`}>
      {labels[status] || status}
    </span>
  );
}

function ProfileTab() {
  const user = useAuthStore((s) => s.user);
  const { profile, loading, error, updateProfile, updateLoading } = useAccount();
  const [editing, setEditing] = useState(false);
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [saveSuccess, setSaveSuccess] = useState(false);

  const handleEdit = () => {
    if (!profile) return;
    setName(profile.name);
    setPhone(profile.phone);
    setSaveSuccess(false);
    setEditing(true);
  };

  const handleSave = async () => {
    const data: Record<string, string> = {};
    if (name !== profile?.name) data.name = name;
    if (phone !== profile?.phone) data.phone = phone;

    if (Object.keys(data).length === 0) { setEditing(false); return; }

    const ok = await updateProfile(data);
    if (ok) {
      setSaveSuccess(true);
      setEditing(false);
    }
  };

  if (loading) {
    return <div className="space-y-4"><Skeleton className="h-8 w-48" /><Skeleton className="h-12 w-full" /><Skeleton className="h-12 w-full" /><Skeleton className="h-12 w-full" /></div>;
  }

  if (!profile && !error) {
    return <p className="text-sm text-muted/60">Chưa có thông tin tài khoản.</p>;
  }

  if (!profile) {
    return <p className="text-sm text-red-400">{error || 'Không thể tải thông tin'}</p>;
  }

  return (
    <div className="space-y-5">
      {error && <p className="text-xs text-red-400">{error}</p>}
      {saveSuccess && <p className="text-xs text-green-400">✅ Đã cập nhật thành công!</p>}

      {editing ? (
        <>
          <Input label="Họ và tên" value={name} onChange={(e) => setName(e.target.value)} />
          <Input label="Số điện thoại" value={phone} onChange={(e) => setPhone(e.target.value)} />
          <div className="flex gap-3 pt-2">
            <Button onClick={handleSave} disabled={updateLoading}>{updateLoading ? 'Đang lưu...' : 'Lưu'}</Button>
            <Button variant="ghost" onClick={() => setEditing(false)}>Huỷ</Button>
          </div>
        </>
      ) : (
        <>
          <div className="flex items-center justify-between">
            <div>
              <p className="text-lg font-semibold">{profile.name}</p>
              <p className="text-sm text-muted/60">{user?.email || profile.email}</p>
            </div>
            <Button variant="ghost" size="sm" onClick={handleEdit}>✏️ Sửa</Button>
          </div>
          <div className="grid grid-cols-2 gap-4 rounded-xl bg-white/5 p-4">
            <div>
              <p className="text-xs text-muted/60">Số điện thoại</p>
              <p className="text-sm font-medium">{profile.phone}</p>
            </div>
            <div>
              <p className="text-xs text-muted/60">Hạng thành viên</p>
              <p className="text-sm font-medium capitalize">{profile.loyalty_tier || 'bronze'}</p>
            </div>
            <div>
              <p className="text-xs text-muted/60">Tổng chi tiêu</p>
              <p className="text-sm font-medium">{formatCurrency(profile.total_spent)}</p>
            </div>
            <div>
              <p className="text-xs text-muted/60">Số lần ghé thăm</p>
              <p className="text-sm font-medium">{profile.visit_count}</p>
            </div>
            <div>
              <p className="text-xs text-muted/60">Cashback khả dụng</p>
              <p className="text-sm font-medium text-green-400">{formatCurrency(profile.cashback_balance)}</p>
            </div>
          </div>
          <p className="text-xs text-muted/40">
            Thành viên từ {new Date(profile.created_at).toLocaleDateString('vi-VN')}
          </p>
        </>
      )}
    </div>
  );
}

function OrdersTab() {
  const { orders, ordersLoading, ordersError } = useAccount();
  const token = useAuthStore((s) => s.token);

  if (!token) {
    return <p className="text-sm text-muted/60">Vui lòng đăng nhập để xem lịch sử đơn hàng.</p>;
  }

  if (ordersLoading) {
    return <div className="space-y-3"><Skeleton className="h-20 w-full" /><Skeleton className="h-20 w-full" /><Skeleton className="h-20 w-full" /></div>;
  }

  if (ordersError) {
    return (
      <div className="rounded-xl bg-white/5 p-8 text-center">
        <p className="mb-2 text-lg">⚠️</p>
        <p className="mb-1 text-sm text-muted/60">{ordersError}</p>
        <button onClick={() => window.location.reload()} className="text-xs text-accent underline underline-offset-2">
          Thử lại
        </button>
      </div>
    );
  }

  if (orders.length === 0) {
    return (
      <div className="rounded-xl bg-white/5 p-8 text-center">
        <p className="mb-2 text-lg">☕</p>
        <p className="mb-1 text-sm text-muted/60">Chưa có đơn hàng nào</p>
        <p className="mb-4 text-xs text-muted/40">Hãy đặt món để bắt đầu tích điểm!</p>
        <Link to="/menu">
          <Button size="sm">🛒 Đặt món ngay</Button>
        </Link>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {orders.map((order: OrderSummary) => {
        const items = parseItems(order.items);
        return (
          <Card key={order.id}>
            <CardBody>
              <div className="flex items-start justify-between">
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <p className="text-xs text-muted/40">{new Date(order.created_at).toLocaleDateString('vi-VN')}</p>
                    {statusBadge(order.status)}
                  </div>
                  <p className="mt-1 text-sm font-medium">
                    <span className="text-muted/60">{items.length} món</span>
                    {items.slice(0, 3).map((item, i) => (
                      <span key={i} className="ml-1">· {item.product_name}</span>
                    ))}
                    {items.length > 3 && <span className="ml-1 text-xs text-muted/40">+{items.length - 3}</span>}
                  </p>
                  <p className="text-sm font-semibold text-accent">{formatCurrency(order.total)}</p>
                </div>
                <p className="shrink-0 text-[10px] uppercase text-muted/30">{order.payment_method}</p>
              </div>
            </CardBody>
          </Card>
        );
      })}
    </div>
  );
}

function RewardsTab() {
  const user = useAuthStore((s) => s.user);
  const { profile, loading } = useAccount();
  const tierLabels: Record<string, string> = { bronze: 'Đồng', silver: 'Bạc', gold: 'Vàng', platinum: 'Bạch Kim' };
  const tierColors: Record<string, string> = { bronze: 'text-amber-600', silver: 'text-gray-400', gold: 'text-yellow-500', platinum: 'text-cyan-400' };

  if (!user) return <p className="text-sm text-muted/60">Vui lòng đăng nhập để xem ưu đãi.</p>;

  if (loading) return <div className="space-y-4"><Skeleton className="h-16 w-full" /><Skeleton className="h-16 w-full" /></div>;

  return (
    <div className="space-y-5">
      {/* Tier info */}
      <Card>
        <CardBody>
          <p className="mb-1 text-xs text-muted/60">Hạng thành viên</p>
          <p className={`text-2xl font-bold capitalize ${tierColors[profile?.loyalty_tier || 'bronze']}`}>
            {tierLabels[profile?.loyalty_tier || 'bronze']}
          </p>
          <div className="mt-3 grid grid-cols-2 gap-3">
            <div>
              <p className="text-xs text-muted/60">Điểm tích luỹ</p>
              <p className="text-lg font-bold">{profile?.cashback_balance?.toLocaleString('vi-VN') || 0}</p>
            </div>
            <div>
              <p className="text-xs text-muted/60">Số lần ghé thăm</p>
              <p className="text-lg font-bold">{profile?.visit_count || 0}</p>
            </div>
          </div>
        </CardBody>
      </Card>

      {/* Quick links */}
      <div className="space-y-2">
        <Link to="/loyalty" className="block rounded-xl bg-white/5 p-4 transition-colors hover:bg-white/10">
          <p className="text-sm font-medium">🎯 Chương trình khách hàng thân thiết</p>
          <p className="mt-0.5 text-xs text-muted/60">Xem chi tiết 4 hạng thành viên và ưu đãi</p>
        </Link>
        <Link to="/referral" className="block rounded-xl bg-white/5 p-4 transition-colors hover:bg-white/10">
          <p className="text-sm font-medium">🤝 Giới thiệu bạn bè</p>
          <p className="mt-0.5 text-xs text-muted/60">Nhận 10.000đ cashback cho mỗi bạn bè giới thiệu</p>
        </Link>
        <Link to="/loyalty-calculator" className="block rounded-xl bg-white/5 p-4 transition-colors hover:bg-white/10">
          <p className="text-sm font-medium">💰 Mô phỏng tài chính</p>
          <p className="mt-0.5 text-xs text-muted/60">Tính toán cashback và điểm theo từng hạng</p>
        </Link>
        <Link to="/promotions" className="block rounded-xl bg-white/5 p-4 transition-colors hover:bg-white/10">
          <p className="text-sm font-medium">🏷️ Khuyến mãi hiện có</p>
          <p className="mt-0.5 text-xs text-muted/60">Xem các chương trình giảm giá đang áp dụng</p>
        </Link>
      </div>
    </div>
  );
}

export default function AccountPage() {
  const [activeTab, setActiveTab] = useState<Tab>('profile');
  const user = useAuthStore((s) => s.user);
  const logout = useAuthStore((s) => s.logout);

  const tabs: { key: Tab; label: string }[] = [
    { key: 'profile', label: 'Thông tin' },
    { key: 'orders', label: 'Đơn hàng' },
    { key: 'rewards', label: 'Ưu đãi' },
  ];

  return (
    <>
      <HelmetHead
        title="Tài khoản của tôi"
        description="Quản lý thông tin cá nhân, lịch sử đơn hàng và ưu đãi thành viên tại AURA CAFE."
        canonical="/account"
      />
      <main className="mx-auto max-w-2xl px-4 py-24">
        {/* Header */}
        <div className="mb-8">
          <p className="mb-1 text-xs font-semibold uppercase tracking-[0.25em] text-accent">AURA Account</p>
          <h1 className="font-display text-3xl font-bold">
            {user ? `👋 ${user.name}` : 'Tài khoản'}
          </h1>
          <p className="mt-1 text-sm text-muted/60">
            {user ? 'Quản lý thông tin và theo dõi đơn hàng' : 'Đăng nhập để xem thông tin cá nhân'}
          </p>
        </div>

        {!user ? (
          <div className="rounded-xl bg-white/5 p-10 text-center">
            <p className="mb-4 text-lg">🔒</p>
            <p className="mb-1 text-sm text-muted/60">Vui lòng đăng nhập</p>
            <p className="mb-4 text-xs text-muted/40">Đăng nhập để xem lịch sử đơn hàng và ưu đãi thành viên</p>
            <Link to="/menu">
              <Button>Đặt món ngay</Button>
            </Link>
          </div>
        ) : (
          <>
            {/* Tab bar */}
            <div className="mb-6 flex gap-1 rounded-xl bg-white/5 p-1">
              {tabs.map((tab) => (
                <button
                  key={tab.key}
                  onClick={() => setActiveTab(tab.key)}
                  className={`flex-1 rounded-lg px-4 py-2 text-sm font-medium transition-all ${
                    activeTab === tab.key
                      ? 'bg-accent text-white shadow-sm'
                      : 'text-muted/60 hover:text-muted/80'
                  }`}
                >
                  {tab.label}
                </button>
              ))}
            </div>

            {/* Tab content */}
            <Card>
              <CardBody>
                {activeTab === 'profile' && <ProfileTab />}
                {activeTab === 'orders' && <OrdersTab />}
                {activeTab === 'rewards' && <RewardsTab />}
              </CardBody>
            </Card>

            {/* Logout */}
            <div className="mt-6 text-center">
              <button
                onClick={logout}
                className="text-xs text-muted/40 underline underline-offset-2 hover:text-muted/60"
              >
                Đăng xuất
              </button>
            </div>
          </>
        )}
      </main>
    </>
  );
}
