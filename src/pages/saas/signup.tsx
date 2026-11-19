import { useEffect, useMemo, useState, type ReactNode } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { apiFetch } from '@/lib/api-client';
import { saveClientSession } from '@/lib/client-session';

interface TemplateItem {
  id: string;
  nameVi: string;
  descriptionVi: string;
  defaultTagline: string;
  primaryColor: string;
  accentColor: string;
  counts: { categories: number; products: number; tables: number; shifts: number };
}

interface PlanItem {
  id: string;
  name: string;
  taglineVi: string;
  monthlyPriceVnd: number;
  annualPriceVnd: number;
  annualMonthlyEquivalentVnd: number;
  popular?: boolean;
  highlightsVi: string[];
}

function slugifyInput(raw: string): string {
  return raw
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/đ/g, 'd')
    .replace(/Đ/g, 'd')
    .toLowerCase()
    .replace(/[^a-z0-9-]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .replace(/-{2,}/g, '-')
    .slice(0, 40);
}

const FALLBACK_TEMPLATES: TemplateItem[] = [
  {
    id: 'container-cafe',
    nameVi: 'Quán Cà Phê & Container Cafe',
    descriptionVi: 'Cà phê phin, espresso, trà trái cây, bánh ngọt và sơ đồ 12 bàn sẵn sàng.',
    defaultTagline: 'Cà phê nguyên bản • Không gian mở',
    primaryColor: '#051424',
    accentColor: '#EFBD8A',
    counts: { categories: 5, products: 18, tables: 12, shifts: 3 },
  },
  {
    id: 'milk-tea-bar',
    nameVi: 'Trà Sữa & Đồ Uống Giới Trẻ',
    descriptionVi: 'Trà sữa topping, trà trái cây nhiệt đới, tùy chọn đường/đá linh hoạt.',
    defaultTagline: 'Trà đậm vị • Topping tươi mỗi ngày',
    primaryColor: '#1E1B4B',
    accentColor: '#F59E0B',
    counts: { categories: 4, products: 16, tables: 10, shifts: 3 },
  },
  {
    id: 'bakery-bistro',
    nameVi: 'Bánh Ngọt & Bistro Cafe',
    descriptionVi: 'Croissant, bánh Âu, brunch, đồ uống specialty và quản lý bếp KDS.',
    defaultTagline: 'Bánh nướng mỗi sáng • Specialty Coffee',
    primaryColor: '#1C1917',
    accentColor: '#D97706',
    counts: { categories: 5, products: 20, tables: 15, shifts: 3 },
  },
];

const FALLBACK_PLANS: PlanItem[] = [
  {
    id: 'starter',
    name: 'Starter',
    taglineVi: 'Tối đa 15 bàn, 3 nhân viên, VietQR 0% phí',
    monthlyPriceVnd: 199_000,
    annualPriceVnd: 1_910_000,
    annualMonthlyEquivalentVnd: 159_000,
    highlightsVi: ['POS & QR Order tại bàn', 'VietQR trực tiếp về tài khoản quán'],
  },
  {
    id: 'pro',
    name: 'Pro',
    taglineVi: 'Không giới hạn bàn & NV, KDS, PayOS riêng, tên miền riêng',
    monthlyPriceVnd: 499_000,
    annualPriceVnd: 4_790_000,
    annualMonthlyEquivalentVnd: 399_000,
    popular: true,
    highlightsVi: ['Không giới hạn bàn & nhân viên', 'KDS realtime & PayOS riêng'],
  },
  {
    id: 'chain',
    name: 'Chain',
    taglineVi: 'Đa chi nhánh, HQ rollup, báo cáo P&L, API & Webhook',
    monthlyPriceVnd: 1_290_000,
    annualPriceVnd: 12_384_000,
    annualMonthlyEquivalentVnd: 1_032_000,
    highlightsVi: ['Quản trị đa chi nhánh tập trung', 'API & Webhook mở rộng'],
  },
];

export default function SaasSignupPage(): ReactNode {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const initialPlan = searchParams.get('plan') || 'pro';

  const [step, setStep] = useState<1 | 2 | 3>(1);
  const [templates, setTemplates] = useState<TemplateItem[]>(FALLBACK_TEMPLATES);
  const [plans, setPlans] = useState<PlanItem[]>(FALLBACK_PLANS);

  const [shopName, setShopName] = useState('');
  const [slug, setSlug] = useState('');
  const [slugTouched, setSlugTouched] = useState(false);
  const [slugStatus, setSlugStatus] = useState<{ checking: boolean; available?: boolean; reason?: string }>({
    checking: false,
  });

  const [templateId, setTemplateId] = useState('container-cafe');
  const [planId, setPlanId] = useState(initialPlan);
  const [ownerName, setOwnerName] = useState('');
  const [ownerEmail, setOwnerEmail] = useState('');
  const [ownerPhone, setOwnerPhone] = useState('');
  const [password, setPassword] = useState('');
  const [address, setAddress] = useState('');

  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [createdStore, setCreatedStore] = useState<{
    slug: string;
    storefrontPath: string;
    trialEndsAt: string;
    seeded: { categories: number; products: number; tables: number; shifts: number };
  } | null>(null);

  useEffect(() => {
    void apiFetch<{ success: boolean; data?: { templates: TemplateItem[] } }>('/api/saas/templates', {
      silent: true,
    })
      .then((res) => {
        if (res.data?.templates && res.data.templates.length > 0) setTemplates(res.data.templates);
      })
      .catch(() => {});

    void apiFetch<{ success: boolean; data?: { plans: PlanItem[] } }>('/api/saas/plans', {
      silent: true,
    })
      .then((res) => {
        if (res.data?.plans && res.data.plans.length > 0) setPlans(res.data.plans);
      })
      .catch(() => {});
  }, []);

  useEffect(() => {
    if (!slugTouched) {
      setSlug(slugifyInput(shopName));
    }
  }, [shopName, slugTouched]);

  useEffect(() => {
    const clean = slugifyInput(slug);
    if (clean.length < 3) {
      setSlugStatus({ checking: false, available: undefined });
      return;
    }
    let cancelled = false;
    setSlugStatus({ checking: true });
    const timer = setTimeout(() => {
      void apiFetch<{ success: boolean; data?: { available: boolean; reason?: string; normalized: string } }>(
        `/api/saas/check-slug?slug=${encodeURIComponent(clean)}`,
        { silent: true }
      )
        .then((res) => {
          if (!cancelled && res.data) {
            setSlugStatus({
              checking: false,
              available: res.data.available,
              reason: res.data.reason,
            });
          }
        })
        .catch(() => {
          if (!cancelled) setSlugStatus({ checking: false });
        });
    }, 350);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [slug]);

  const selectedTemplate = useMemo(
    () => templates.find((t) => t.id === templateId) || templates[0],
    [templates, templateId]
  );

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      const res = await apiFetch<{
        success: boolean;
        error?: string;
        data?: {
          tenantId: string;
          slug: string;
          ownerId: string;
          ownerEmail: string;
          storefrontPath: string;
          trialEndsAt: string;
          token?: string | null;
          seeded: { categories: number; products: number; tables: number; shifts: number };
        };
      }>('/api/saas/signup', {
        method: 'POST',
        body: JSON.stringify({
          shopName,
          slug: slugifyInput(slug),
          templateId,
          planId,
          ownerName,
          ownerEmail,
          ownerPhone,
          password,
          address,
        }),
      });

      if (!res.success || !res.data) {
        setError(res.error || 'Không thể khởi tạo cửa hàng.');
        return;
      }

      if (res.data.token) {
        saveClientSession(res.data.token, {
          id: res.data.ownerId,
          name: ownerName,
          email: res.data.ownerEmail,
          role: 'owner',
          tenantId: res.data.tenantId,
        });
      }

      setCreatedStore({
        slug: res.data.slug,
        storefrontPath: res.data.storefrontPath,
        trialEndsAt: res.data.trialEndsAt,
        seeded: res.data.seeded,
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Lỗi kết nối máy chủ.');
    } finally {
      setSubmitting(false);
    }
  }

  if (createdStore) {
    return (
      <div className="min-h-screen bg-slate-950 text-slate-100 flex items-center justify-center p-6">
        <div className="max-w-xl w-full rounded-2xl border border-emerald-500/30 bg-slate-900/90 p-8 shadow-2xl space-y-6">
          <div className="inline-flex items-center gap-2 rounded-full bg-emerald-500/15 px-3 py-1 text-xs font-semibold text-emerald-300">
            Khởi tạo thành công • Dùng thử miễn phí 14 ngày (Full Pro)
          </div>
          <h1 className="text-2xl font-bold text-white">Quán của bạn đã sẵn sàng nhận đơn!</h1>
          <p className="text-sm text-slate-300">
            Hệ thống đã tự động tạo <strong>{createdStore.seeded.categories} danh mục</strong>,{' '}
            <strong>{createdStore.seeded.products} món mẫu</strong>,{' '}
            <strong>{createdStore.seeded.tables} bàn QR</strong> và{' '}
            <strong>{createdStore.seeded.shifts} ca làm việc</strong> riêng biệt cho quán của bạn.
          </p>
          <div className="rounded-xl bg-slate-800/70 p-4 text-sm space-y-2 border border-slate-700">
            <div className="flex justify-between">
              <span className="text-slate-400">Link thực đơn QR:</span>
              <a href={createdStore.storefrontPath} className="font-mono text-amber-400 hover:underline">
                {window.location.origin}
                {createdStore.storefrontPath}
              </a>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-400">Hết hạn dùng thử:</span>
              <span className="font-medium text-white">
                {new Date(createdStore.trialEndsAt).toLocaleDateString('vi-VN')}
              </span>
            </div>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2">
            <button
              type="button"
              onClick={() => navigate('/admin/saas-settings')}
              className="rounded-xl bg-amber-500 px-4 py-3 text-sm font-semibold text-slate-950 hover:bg-amber-400 transition"
            >
              Cấu hình Thanh toán & Thương hiệu
            </button>
            <button
              type="button"
              onClick={() => navigate(createdStore.storefrontPath)}
              className="rounded-xl border border-slate-700 bg-slate-800 px-4 py-3 text-sm font-semibold text-white hover:bg-slate-700 transition"
            >
              Xem trang đặt món của quán →
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 py-10 px-4">
      <div className="max-w-3xl mx-auto">
        <div className="text-center mb-8 space-y-2">
          <div className="inline-flex items-center gap-2 rounded-full bg-amber-500/15 border border-amber-500/30 px-3 py-1 text-xs font-medium text-amber-300">
            Dùng thử miễn phí 14 ngày • Không cần thẻ tín dụng • 0% phí giao dịch
          </div>
          <h1 className="text-3xl font-bold text-white">Mở hệ thống POS & QR Order cho quán trong 60 giây</h1>
          <p className="text-slate-400 text-sm">
            Tiền bán nước về trực tiếp tài khoản ngân hàng / PayOS của quán bạn.
          </p>
        </div>

        {/* Stepper */}
        <div className="grid grid-cols-3 gap-2 mb-6">
          {[
            { num: 1, label: '1. Tên quán & Mô hình' },
            { num: 2, label: '2. Gói dịch vụ' },
            { num: 3, label: '3. Tài khoản chủ quán' },
          ].map((s) => (
            <button
              key={s.num}
              type="button"
              onClick={() => setStep(s.num as 1 | 2 | 3)}
              className={`rounded-xl px-3 py-2.5 text-xs font-semibold border transition ${
                step === s.num
                  ? 'border-amber-500 bg-amber-500/15 text-amber-300'
                  : step > s.num
                    ? 'border-emerald-500/40 bg-emerald-500/10 text-emerald-300'
                    : 'border-slate-800 bg-slate-900 text-slate-400'
              }`}
            >
              {s.label}
            </button>
          ))}
        </div>

        <form onSubmit={handleSubmit} className="rounded-2xl border border-slate-800 bg-slate-900/90 p-6 sm:p-8 shadow-xl space-y-6">
          {error && (
            <div className="rounded-xl border border-rose-500/40 bg-rose-500/10 px-4 py-3 text-sm text-rose-200">
              {error}
            </div>
          )}

          {step === 1 && (
            <div className="space-y-5">
              <div>
                <label className="block text-sm font-medium text-slate-200 mb-1.5">Tên quán của bạn *</label>
                <input
                  type="text"
                  required
                  value={shopName}
                  onChange={(e) => setShopName(e.target.value)}
                  placeholder="Ví dụ: Cà Phê Vườn Nắng"
                  className="w-full rounded-xl border border-slate-700 bg-slate-950 px-4 py-3 text-white placeholder-slate-500 focus:border-amber-500 focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-200 mb-1.5">Đường dẫn cửa hàng (Slug) *</label>
                <div className="flex items-center rounded-xl border border-slate-700 bg-slate-950 overflow-hidden focus-within:border-amber-500">
                  <span className="px-3 py-3 text-xs text-slate-400 bg-slate-900 border-r border-slate-800 font-mono">
                    /s/
                  </span>
                  <input
                    type="text"
                    required
                    value={slug}
                    onChange={(e) => {
                      setSlugTouched(true);
                      setSlug(slugifyInput(e.target.value));
                    }}
                    placeholder="ca-phe-vuon-nang"
                    className="flex-1 bg-transparent px-3 py-3 text-white font-mono text-sm focus:outline-none"
                  />
                </div>
                {slugStatus.checking && <p className="text-xs text-slate-400 mt-1">Đang kiểm tra đường dẫn...</p>}
                {!slugStatus.checking && slugStatus.available === true && (
                  <p className="text-xs text-emerald-400 mt-1">✓ Đường dẫn hợp lệ và chưa có người dùng.</p>
                )}
                {!slugStatus.checking && slugStatus.available === false && (
                  <p className="text-xs text-rose-400 mt-1">✗ {slugStatus.reason || 'Đường dẫn này đã tồn tại.'}</p>
                )}
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-200 mb-2">Chọn mẫu thực đơn khởi tạo nhanh</label>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {templates.map((tpl) => (
                    <button
                      key={tpl.id}
                      type="button"
                      onClick={() => setTemplateId(tpl.id)}
                      className={`text-left rounded-xl p-4 border transition ${
                        templateId === tpl.id
                          ? 'border-amber-500 bg-amber-500/10'
                          : 'border-slate-800 bg-slate-950/60 hover:border-slate-700'
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <span className="font-semibold text-white text-sm">{tpl.nameVi}</span>
                        <span
                          className="h-3.5 w-3.5 rounded-full border border-white/20"
                          style={{ backgroundColor: tpl.accentColor }}
                        />
                      </div>
                      <p className="text-xs text-slate-400 mt-1">{tpl.descriptionVi}</p>
                      <p className="text-[11px] text-amber-300/90 mt-2">
                        {tpl.counts.products} món • {tpl.counts.tables} bàn • {tpl.counts.shifts} ca
                      </p>
                    </button>
                  ))}
                </div>
              </div>

              <div className="flex justify-end">
                <button
                  type="button"
                  disabled={!shopName.trim() || slug.length < 3 || slugStatus.available === false}
                  onClick={() => setStep(2)}
                  className="rounded-xl bg-amber-500 px-6 py-3 text-sm font-semibold text-slate-950 hover:bg-amber-400 disabled:opacity-40 transition"
                >
                  Tiếp tục →
                </button>
              </div>
            </div>
          )}

          {step === 2 && (
            <div className="space-y-5">
              <p className="text-sm text-slate-300">
                Bạn sẽ được trải nghiệm <strong>đầy đủ tính năng Pro trong 14 ngày đầu miễn phí</strong>. Chọn gói dự kiến sau khi hết dùng thử:
              </p>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                {plans.map((p) => (
                  <button
                    key={p.id}
                    type="button"
                    onClick={() => setPlanId(p.id)}
                    className={`text-left rounded-xl p-4 border transition flex flex-col justify-between ${
                      planId === p.id
                        ? 'border-amber-500 bg-amber-500/10'
                        : 'border-slate-800 bg-slate-950/60 hover:border-slate-700'
                    }`}
                  >
                    <div>
                      <div className="flex items-center justify-between">
                        <span className="font-bold text-white">{p.name}</span>
                        {p.popular && (
                          <span className="text-[10px] uppercase bg-amber-500 text-slate-950 font-bold px-2 py-0.5 rounded-full">
                            Phổ biến
                          </span>
                        )}
                      </div>
                      <div className="mt-2 text-lg font-bold text-amber-400">
                        {p.monthlyPriceVnd.toLocaleString('vi-VN')}đ
                        <span className="text-xs font-normal text-slate-400">/tháng</span>
                      </div>
                      <ul className="mt-3 space-y-1.5 text-xs text-slate-300">
                        {p.highlightsVi.slice(0, 4).map((h) => (
                          <li key={h}>• {h}</li>
                        ))}
                      </ul>
                    </div>
                  </button>
                ))}
              </div>
              <div className="flex justify-between">
                <button
                  type="button"
                  onClick={() => setStep(1)}
                  className="rounded-xl border border-slate-700 px-5 py-2.5 text-sm text-slate-300 hover:bg-slate-800"
                >
                  ← Quay lại
                </button>
                <button
                  type="button"
                  onClick={() => setStep(3)}
                  className="rounded-xl bg-amber-500 px-6 py-3 text-sm font-semibold text-slate-950 hover:bg-amber-400"
                >
                  Tiếp tục →
                </button>
              </div>
            </div>
          )}

          {step === 3 && (
            <div className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-slate-200 mb-1">Họ tên chủ quán *</label>
                  <input
                    type="text"
                    required
                    value={ownerName}
                    onChange={(e) => setOwnerName(e.target.value)}
                    placeholder="Nguyễn Văn A"
                    className="w-full rounded-xl border border-slate-700 bg-slate-950 px-4 py-2.5 text-white focus:border-amber-500 focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-200 mb-1">Số điện thoại</label>
                  <input
                    type="tel"
                    value={ownerPhone}
                    onChange={(e) => setOwnerPhone(e.target.value)}
                    placeholder="0901234567"
                    className="w-full rounded-xl border border-slate-700 bg-slate-950 px-4 py-2.5 text-white focus:border-amber-500 focus:outline-none"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-slate-200 mb-1">Email đăng nhập *</label>
                  <input
                    type="email"
                    required
                    value={ownerEmail}
                    onChange={(e) => setOwnerEmail(e.target.value)}
                    placeholder="chuquan@gmail.com"
                    className="w-full rounded-xl border border-slate-700 bg-slate-950 px-4 py-2.5 text-white focus:border-amber-500 focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-200 mb-1">Mật khẩu (tối thiểu 8 ký tự) *</label>
                  <input
                    type="password"
                    required
                    minLength={8}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="••••••••"
                    className="w-full rounded-xl border border-slate-700 bg-slate-950 px-4 py-2.5 text-white focus:border-amber-500 focus:outline-none"
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-200 mb-1">Địa chỉ quán</label>
                <input
                  type="text"
                  value={address}
                  onChange={(e) => setAddress(e.target.value)}
                  placeholder="Số nhà, đường, quận/huyện, tỉnh/thành"
                  className="w-full rounded-xl border border-slate-700 bg-slate-950 px-4 py-2.5 text-white focus:border-amber-500 focus:outline-none"
                />
              </div>

              {selectedTemplate && (
                <div className="rounded-xl border border-slate-800 bg-slate-950/70 p-3.5 text-xs text-slate-300">
                  Tóm tắt: Khởi tạo quán <strong className="text-white">{shopName}</strong> tại{' '}
                  <span className="font-mono text-amber-400">/s/{slug}</span> với mẫu{' '}
                  <strong className="text-white">{selectedTemplate.nameVi}</strong>.
                </div>
              )}

              <div className="flex justify-between pt-2">
                <button
                  type="button"
                  onClick={() => setStep(2)}
                  className="rounded-xl border border-slate-700 px-5 py-2.5 text-sm text-slate-300 hover:bg-slate-800"
                >
                  ← Quay lại
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="rounded-xl bg-amber-500 px-6 py-3 text-sm font-bold text-slate-950 hover:bg-amber-400 disabled:opacity-50 transition"
                >
                  {submitting ? 'Đang khởi tạo quán...' : 'Khởi tạo quán ngay (Miễn phí 14 ngày)'}
                </button>
              </div>
            </div>
          )}
        </form>
      </div>
    </div>
  );
}
