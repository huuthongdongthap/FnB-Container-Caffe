/**
 * Canonical SaaS Plan Definitions & Server-Side Pricing Rules.
 *
 * Distinct from the legacy container-rental `subscription_plans` module.
 * All pricing and resource limits are enforced strictly on the server.
 */

export type SaasPlanId = 'starter' | 'pro' | 'chain';
export type SaasBillingCycle = 'monthly' | 'annual';

export type SaasFeatureKey =
  | 'qr'
  | 'pos'
  | 'kds'
  | 'vietqr'
  | 'bom'
  | 'pnl'
  | 'crm'
  | 'payos'
  | 'custom_domain'
  | 'multi_branch'
  | 'ai'
  | 'erp_zalo';

export interface SaasPlanDefinition {
  id: SaasPlanId;
  name: string;
  nameVi: string;
  taglineVi: string;
  monthlyPriceVnd: number;
  annualPriceVnd: number;
  annualMonthlyEquivalentVnd: number;
  maxTables: number | null;
  maxStaff: number | null;
  features: readonly SaasFeatureKey[];
  isRecommended?: boolean;
  highlightsVi: readonly string[];
  caveatsVi: readonly string[];
}

export const TRIAL_DAYS = 14;
export const GRACE_DAYS = 3;
export const ANNUAL_DISCOUNT_RATE = 0.2;

export function computeAnnualPriceVnd(monthlyPriceVnd: number): number {
  return Math.round(monthlyPriceVnd * 12 * (1 - ANNUAL_DISCOUNT_RATE));
}

export const SAAS_PLANS: Record<SaasPlanId, SaasPlanDefinition> = {
  starter: {
    id: 'starter',
    name: 'Starter',
    nameVi: 'Starter',
    taglineVi: 'Dành cho quán nhỏ, kiosk hoặc quán mới khai trương',
    monthlyPriceVnd: 199_000,
    annualPriceVnd: computeAnnualPriceVnd(199_000), // 1,910,400 VND
    annualMonthlyEquivalentVnd: Math.round(computeAnnualPriceVnd(199_000) / 12),
    maxTables: 15,
    maxStaff: 3,
    features: ['qr', 'pos', 'kds', 'vietqr'],
    highlightsVi: [
      'Đặt món QR tại bàn & Storefront /s/:slug riêng',
      'POS thu ngân, KDS màn hình bếp & in hóa đơn nhiệt',
      'Thanh toán chuyển khoản VietQR về thẳng tài khoản chủ quán',
      'Tối đa 15 bàn và 3 tài khoản nhân viên',
    ],
    caveatsVi: [
      'Chưa bao gồm BOM định lượng, P&L, CRM và cổng PayOS tự động',
    ],
  },
  pro: {
    id: 'pro',
    name: 'Pro',
    nameVi: 'Pro',
    taglineVi: 'Dành cho quán cà phê, trà sữa, bistro đang tăng trưởng',
    monthlyPriceVnd: 499_000,
    annualPriceVnd: computeAnnualPriceVnd(499_000), // 4,790,400 VND
    annualMonthlyEquivalentVnd: Math.round(computeAnnualPriceVnd(499_000) / 12),
    maxTables: 50,
    maxStaff: 15,
    features: ['qr', 'pos', 'kds', 'vietqr', 'bom', 'pnl', 'crm', 'payos', 'custom_domain'],
    isRecommended: true,
    highlightsVi: [
      'Toàn bộ tính năng gói Starter',
      'Công thức BOM định lượng, tồn kho & báo cáo P&L theo quán',
      'CRM khách hàng, tích điểm & chiến dịch khuyến mãi',
      'Tích hợp tài khoản PayOS riêng của quán (mã hóa AES-256-GCM)',
      'Tên miền riêng (Custom Domain) xác minh DNS TXT',
      'Tối đa 50 bàn và 15 tài khoản nhân viên',
    ],
    caveatsVi: [
      'Custom domain cần chủ quán tự trỏ bản ghi DNS và TXT xác minh',
    ],
  },
  chain: {
    id: 'chain',
    name: 'Chain',
    nameVi: 'Chain',
    taglineVi: 'Dành cho chuỗi nhiều chi nhánh và vận hành quy mô lớn',
    monthlyPriceVnd: 1_290_000,
    annualPriceVnd: computeAnnualPriceVnd(1_290_000), // 12,384,000 VND
    annualMonthlyEquivalentVnd: Math.round(computeAnnualPriceVnd(1_290_000) / 12),
    maxTables: null,
    maxStaff: null,
    features: [
      'qr',
      'pos',
      'kds',
      'vietqr',
      'bom',
      'pnl',
      'crm',
      'payos',
      'custom_domain',
      'multi_branch',
      'ai',
      'erp_zalo',
    ],
    highlightsVi: [
      'Toàn bộ tính năng gói Pro',
      'Không giới hạn số bàn và số lượng nhân viên',
      'Quản trị nhiều chi nhánh & báo cáo tổng hợp',
      'Trợ lý AI gợi ý món & đồng bộ ERPNext / Zalo OA',
    ],
    caveatsVi: [
      'Tích hợp ERPNext và Zalo OA yêu cầu chủ quán tự cung cấp khóa API & tài khoản doanh nghiệp',
    ],
  },
};

export const SAAS_PLAN_LIST: readonly SaasPlanDefinition[] = [
  SAAS_PLANS.starter,
  SAAS_PLANS.pro,
  SAAS_PLANS.chain,
];

/**
 * Normalize both v3 plan IDs ('starter' | 'pro' | 'chain') and legacy tier strings
 * ('BASIC' | 'PREMIUM' | 'ENTERPRISE' | 'MASTER') into a canonical SaasPlanId.
 */
export function normalizeSaasPlanId(raw: string | null | undefined): SaasPlanId {
  const normalized = String(raw || '').trim().toLowerCase();
  if (normalized === 'pro' || normalized === 'premium' || normalized === 'silver') return 'pro';
  if (
    normalized === 'chain' ||
    normalized === 'enterprise' ||
    normalized === 'master' ||
    normalized === 'gold' ||
    normalized === 'platinum' ||
    normalized === 'diamond'
  ) {
    return 'chain';
  }
  return 'starter';
}

export function normalizeBillingCycle(raw: string | null | undefined): SaasBillingCycle {
  const normalized = String(raw || '').trim().toLowerCase();
  if (normalized === 'annual' || normalized === 'yearly' || normalized === 'year') {
    return 'annual';
  }
  return 'monthly';
}

export function calculatePlanAmountVnd(planId: SaasPlanId, cycle: SaasBillingCycle): number {
  const plan = SAAS_PLANS[planId];
  return cycle === 'annual' ? plan.annualPriceVnd : plan.monthlyPriceVnd;
}
