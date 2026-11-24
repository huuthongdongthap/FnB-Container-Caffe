import type { ZnsData } from './types';

export const TEMPLATE_IDS: Record<string, string> = {
  welcome_signup: 'YOUR_WELCOME_TEMPLATE_ID',
  welcome_new: 'YOUR_WELCOME_TEMPLATE_ID',
  cashback_earned: 'YOUR_CASHBACK_TEMPLATE_ID',
  tier_upgrade: 'YOUR_TIER_TEMPLATE_ID',
  cashback_expiry_warning: 'YOUR_EXPIRY_TEMPLATE_ID',
  cashback_expiring: 'YOUR_EXPIRY_TEMPLATE_ID',
  birthday_promotion: 'YOUR_BIRTHDAY_TEMPLATE_ID',
  winback_offer: 'YOUR_WINBACK_TEMPLATE_ID',
  post_visit_review: 'YOUR_POST_VISIT_TEMPLATE_ID',
  general_promotion: 'YOUR_GENERAL_PROMO_TEMPLATE_ID'
};

/**
 * Resolve an approved Zalo ZNS template ID.
 * Prefers environment secret `ZALO_ZNS_TEMPLATE_<UPPER_KEY>`, falling back to TEMPLATE_IDS.
 * Returns null when unconfigured or still using a placeholder `YOUR_` value.
 */
export function resolveTemplateId(
  template_key: string,
  env?: Record<string, unknown>
): string | null {
  const normalizedKey = String(template_key || '').trim();
  if (!normalizedKey) return null;

  const envKey = `ZALO_ZNS_TEMPLATE_${normalizedKey.toUpperCase()}`;
  const envValue = env?.[envKey];
  if (typeof envValue === 'string') {
    const trimmedEnv = envValue.trim();
    if (trimmedEnv && !trimmedEnv.startsWith('YOUR_')) {
      return trimmedEnv;
    }
  }

  const fallback = TEMPLATE_IDS[normalizedKey];
  if (typeof fallback === 'string') {
    const trimmedFallback = fallback.trim();
    if (trimmedFallback && !trimmedFallback.startsWith('YOUR_')) {
      return trimmedFallback;
    }
  }

  return null;
}

export function buildTemplateData(template_key: string, data: ZnsData): Record<string, string> {
  switch (template_key) {
  case 'welcome_signup':
  case 'welcome_new':
    return {
      customer_name: data.name || '',
      member_id: data.member_id || '',
      balance: `${(data.balance || 0).toLocaleString('vi-VN')}đ`,
      qr_url: data.qr_url || 'https://fnb-caffe-container.pages.dev/dang-ky-thanh-vien'
    };
  case 'cashback_earned':
    return {
      customer_name: data.name || '',
      amount_earned: `${(data.amount || 0).toLocaleString('vi-VN')}đ`,
      new_balance: `${(data.balance || 0).toLocaleString('vi-VN')}đ`,
      order_id: `AC${String(data.order_id || '').slice(0, 8).toUpperCase()}`
    };
  case 'tier_upgrade':
    return {
      customer_name: data.name || '',
      new_tier: data.new_tier_vi || data.new_tier || '',
      cashback_rate: `${(data.new_rate || 0) * 100}%`
    };
  case 'cashback_expiry_warning':
  case 'cashback_expiring':
    return {
      customer_name: data.name || '',
      expiring_amount: `${(data.amount || 0).toLocaleString('vi-VN')}đ`,
      days_remaining: String(data.days || 7)
    };
  case 'general_promotion':
    return {
      customer_name: data.name || '',
      title: data.title || '',
      message: data.message || '',
      promo_code: data.promo_code || '',
      discount: data.discount || '',
      expires_at: data.expires_at || ''
    };
  default:
    return {};
  }
}
