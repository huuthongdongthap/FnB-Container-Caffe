import type { ZnsData } from './types';

export const TEMPLATE_IDS: Record<string, string> = {
  welcome_signup: 'YOUR_WELCOME_TEMPLATE_ID',
  cashback_earned: 'YOUR_CASHBACK_TEMPLATE_ID',
  tier_upgrade: 'YOUR_TIER_TEMPLATE_ID',
  cashback_expiry_warning: 'YOUR_EXPIRY_TEMPLATE_ID',
  order_status_update: 'YOUR_ORDER_STATUS_TEMPLATE_ID',
};

export function buildTemplateData(template_key: string, data: ZnsData): Record<string, string> {
  switch (template_key) {
    case 'welcome_signup':
      return {
        customer_name: data.name || '',
        member_id: data.member_id || '',
        balance: (data.balance || 0).toLocaleString('vi-VN') + 'đ',
        qr_url: data.qr_url || 'https://fnb-caffe-container.pages.dev/dang-ky-thanh-vien',
      };
    case 'cashback_earned':
      return {
        customer_name: data.name || '',
        amount_earned: (data.amount || 0).toLocaleString('vi-VN') + 'đ',
        new_balance: (data.balance || 0).toLocaleString('vi-VN') + 'đ',
        order_id: 'AC' + String(data.order_id || '').slice(0, 8).toUpperCase(),
      };
    case 'tier_upgrade':
      return {
        customer_name: data.name || '',
        new_tier: data.new_tier_vi || data.new_tier || '',
        cashback_rate: ((data.new_rate || 0) * 100) + '%',
      };
    case 'cashback_expiry_warning':
      return {
        customer_name: data.name || '',
        expiring_amount: (data.amount || 0).toLocaleString('vi-VN') + 'đ',
        days_remaining: String(data.days || 7),
      };
    case 'order_status_update':
      return {
        customer_name: data.name || '',
        order_id: 'AC' + String(data.order_id || '').slice(0, 8).toUpperCase(),
        status: data.status || '',
        amount: (data.amount || 0).toLocaleString('vi-VN') + 'đ',
      };
    default:
      return {};
  }
}
