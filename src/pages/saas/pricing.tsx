import { useEffect, useState, type ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { apiFetch } from '@/lib/api-client';

interface SaasPlan {
  id: string;
  name: string;
  taglineVi: string;
  monthlyPriceVnd: number;
  annualPriceVnd: number;
  annualMonthlyEquivalentVnd: number;
  popular?: boolean;
  highlightsVi: string[];
}

export default function SaasPricingPage(): ReactNode {
  const [plans, setPlans] = useState<SaasPlan[]>([]);
  const [billingCycle, setBillingCycle] = useState<'monthly' | 'annual'>('annual');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    void apiFetch<{ success: boolean; data?: { plans: SaasPlan[] } }>('/api/saas/plans', { silent: true })
      .then((res) => {
        if (res.data?.plans) setPlans(res.data.plans);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 py-14 px-4">
      <div className="max-w-5xl mx-auto space-y-10">
        <div className="text-center space-y-4">
          <span className="inline-flex items-center rounded-full bg-amber-500/15 border border-amber-500/30 px-3.5 py-1 text-xs font-semibold text-amber-300">
            0% hoa hồng đơn hàng • Dùng thử miễn phí 14 ngày
          </span>
          <h1 className="text-3xl sm:text-4xl font-bold text-white">
            Bảng giá nền tảng POS, QR Order & KDS cho quán F&B
          </h1>
          <p className="text-slate-400 max-w-2xl mx-auto text-sm sm:text-base">
            Tiền bán hàng về thẳng tài khoản ngân hàng hoặc PayOS riêng của quán bạn. Không phí ẩn, nâng cấp bất cứ lúc nào.
          </p>

          {/* Billing cycle toggle */}
          <div className="inline-flex items-center rounded-xl bg-slate-900 border border-slate-800 p-1">
            <button
              type="button"
              onClick={() => setBillingCycle('monthly')}
              className={`px-4 py-2 rounded-lg text-xs font-semibold transition ${
                billingCycle === 'monthly' ? 'bg-amber-500 text-slate-950' : 'text-slate-300'
              }`}
            >
              Thanh toán theo tháng
            </button>
            <button
              type="button"
              onClick={() => setBillingCycle('annual')}
              className={`px-4 py-2 rounded-lg text-xs font-semibold transition flex items-center gap-1.5 ${
                billingCycle === 'annual' ? 'bg-amber-500 text-slate-950' : 'text-slate-300'
              }`}
            >
              Thanh toán theo năm
              <span className="rounded-full bg-emerald-500/20 text-emerald-300 px-1.5 py-0.5 text-[10px]">
                Tiết kiệm 20%
              </span>
            </button>
          </div>
        </div>

        {loading ? (
          <div className="text-center text-slate-400 py-12">Đang tải bảng giá...</div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {plans.map((plan) => {
              const displayPrice =
                billingCycle === 'annual' ? plan.annualMonthlyEquivalentVnd : plan.monthlyPriceVnd;
              return (
                <div
                  key={plan.id}
                  className={`rounded-2xl p-6 border flex flex-col justify-between ${
                    plan.popular
                      ? 'border-amber-500 bg-slate-900 shadow-lg shadow-amber-500/10'
                      : 'border-slate-800 bg-slate-900/70'
                  }`}
                >
                  <div className="space-y-4">
                    <div className="flex items-center justify-between">
                      <h2 className="text-xl font-bold text-white">{plan.name}</h2>
                      {plan.popular && (
                        <span className="rounded-full bg-amber-500 px-2.5 py-0.5 text-[11px] font-bold text-slate-950">
                          Phổ biến nhất
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-slate-400">{plan.taglineVi}</p>
                    <div>
                      <div className="text-3xl font-extrabold text-white">
                        {displayPrice.toLocaleString('vi-VN')}đ
                        <span className="text-sm font-normal text-slate-400">/tháng</span>
                      </div>
                      {billingCycle === 'annual' && (
                        <p className="text-xs text-emerald-400 mt-1">
                          Thanh toán {plan.annualPriceVnd.toLocaleString('vi-VN')}đ / năm
                        </p>
                      )}
                    </div>
                    <ul className="space-y-2.5 pt-2 text-sm text-slate-200">
                      {plan.highlightsVi.map((item) => (
                        <li key={item} className="flex items-start gap-2">
                          <span className="text-emerald-400 mt-0.5">✓</span>
                          <span>{item}</span>
                        </li>
                      ))}
                    </ul>
                  </div>

                  <Link
                    to={`/signup?plan=${plan.id}`}
                    className={`mt-8 block w-full text-center rounded-xl py-3 text-sm font-bold transition ${
                      plan.popular
                        ? 'bg-amber-500 text-slate-950 hover:bg-amber-400'
                        : 'bg-slate-800 text-white hover:bg-slate-700'
                    }`}
                  >
                    Dùng thử 14 ngày miễn phí
                  </Link>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
