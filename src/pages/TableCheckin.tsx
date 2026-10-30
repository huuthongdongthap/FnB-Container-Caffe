'use client';

import { useState, useEffect } from 'react';
function useQueryParams() {
  const [params, setParams] = useState<URLSearchParams>(() => new URLSearchParams(window.location.search));
  useEffect(() => {
    const handler = () => setParams(new URLSearchParams(window.location.search));
    window.addEventListener('popstate', handler);
    return () => window.removeEventListener('popstate', handler);
  }, []);
  return params;
}

function navigate(path: string) { window.location.href = path; }

import { useTranslation } from 'react-i18next';
import { HelmetHead } from '@/components/seo/HelmetHead';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { apiFetch } from '@/lib/api-client';

export default function TableCheckinPage() {
  const { t: _t } = useTranslation();
   const search = useQueryParams();
 const tableSlug = search.get('table') || '';

  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!tableSlug) {
      setError('Thiếu thông tin bàn. Vui lòng quét lại mã QR.');
    }
  }, [tableSlug]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!name.trim() || !phone.trim()) {
      setError('Vui lòng nhập đầy đủ tên và số điện thoại.');
      return;
    }

    setLoading(true);
    try {
      const body = await apiFetch<{ success: boolean; data?: { id?: string }; error?: string }>('/api/orders/guest-checkin', {
        method: 'POST',
        body: JSON.stringify({ customer_name: name.trim(), customer_phone: phone.trim(), table_id: tableSlug }),
      });
      if (!body.success) {
        setError(body.error || 'Không thể xác nhận. Vui lòng thử lại.');
        setLoading(false);
        return;
      }
      const orderId = body.data?.id;
      navigate(`/order?table=${encodeURIComponent(tableSlug)}${orderId ? '&orderId=' + encodeURIComponent(orderId) : ''}`);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Lỗi kết nối. Vui lòng thử lại.';
      setError(message);
      setLoading(false);
    }
  };

  if (!tableSlug) {
    return (
      <div className="min-h-screen bg-[color:var(--aura-noir-deep)] flex items-center justify-center px-4">
        <div className="text-center">
          <p className="text-[color:var(--aura-chrome-bright)] mb-4">Thiếu thông tin bàn</p>
          <Button onClick={() => navigate('/')}>Về trang chủ</Button>
        </div>
      </div>
    );
  }

  return (
    <>
      <HelmetHead title={`Check-in Bàn ${tableSlug}`} description="Xác nhận thông tin để bắt đầu đặt món" canonical="/table-checkin" />
      <div className="min-h-screen bg-[color:var(--aura-noir-deep)] flex items-center justify-center px-4 py-8">
        <div className="w-full max-w-sm">
          {/* Header */}
          <div className="text-center mb-8">
            <p className="text-xs text-[color:var(--aura-chrome-bright)] uppercase tracking-widest mb-1">Bàn</p>
            <h1 className="text-4xl font-display font-bold text-[color:var(--aura-forest-primary)]">{tableSlug}</h1>
            <p className="text-sm text-[color:var(--aura-chrome-bright)] mt-2">Nhập thông tin để xác nhận</p>
          </div>

          {/* Error banner */}
          {error && <div className="mb-4 p-3 rounded-lg bg-red-500/10 border border-red-400/30 text-red-400 text-sm">{error}</div>}

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label htmlFor="table-checkin-name" className="block text-xs text-[color:var(--aura-chrome-bright)] mb-1.5 uppercase tracking-wider">Tên của bạn</label>
              <Input id="table-checkin-name" value={name} onChange={e => setName(e.target.value)} placeholder="Nguyễn Văn A" disabled={loading} className="bg-white/5 border-white/10 text-white placeholder:text-white/30" />
            </div>
            <div>
              <label htmlFor="table-checkin-phone" className="block text-xs text-[color:var(--aura-chrome-bright)] mb-1.5 uppercase tracking-wider">Số điện thoại</label>
              <Input id="table-checkin-phone" value={phone} onChange={e => setPhone(e.target.value)} placeholder="0912 345 678" disabled={loading} className="bg-white/5 border-white/10 text-white placeholder:text-white/30" />
            </div>
            <Button type="submit" disabled={loading} className="w-full h-12 text-base">
              {loading ? <span className="w-4 h-4 border-2 border-white/20 border-t-white rounded-full animate-spin inline-block mr-2" /> : 'Xác nhận'}
            </Button>
          </form>

          <p className="text-center text-xs text-[color:var(--aura-chrome-bright)] mt-6">
            Đây là tính năng quét mã QR — không cần tài khoản.
          </p>
        </div>
      </div>
    </>
  );
}
