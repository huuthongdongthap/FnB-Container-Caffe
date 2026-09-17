/**
 * Campaign Templates — bilingual (VN+EN) message templates per trigger.
 * Pure function: no D1, no env. Returns subject/sms/html for channel render.
 */
import type { CampaignTrigger } from './types';

export interface RenderedTemplate {
  subject: string;
  sms: string;
  html: string;
}

export interface TemplateParams {
  name?: string;
  amount?: number;
  days_left?: number;
}

function safeName(name?: string): string {
  return name?.trim() || 'bạn';
}

function formatCurrency(amount: number): string {
  return amount.toLocaleString('vi-VN');
}

/**
 * Render message content for a trigger + params.
 * Throws on unknown trigger (exhaustive check).
 */
export function renderTemplate(trigger: CampaignTrigger, params: TemplateParams = {}): RenderedTemplate {
  const n = safeName(params.name);
  const amount = params.amount ?? 0;
  const daysLeft = params.days_left ?? 7;

  switch (trigger) {
    case 'welcome':
      return {
        subject: 'Chào mừng đến AURA CAFE!',
        sms: `Xin chao ${n}! Cam ban da den voi AURA CAFE. Dat hang ngay va nhan uu dac dac biet!`,
        html: `<h1>AURA CAFE</h1><p>Xin chào <strong>${n}</strong>!</p><p>Cảm ơn bạn đã đến với AURA CAFE. Đặt hàng ngay và nhận ưu đãi đặc biệt!</p>`
      };

    case 'birthday':
      return {
        subject: 'Sinh nhật vui vẻ — tặng bạn ưu đãi từ AURA!',
        sms: `${n} thân mến, AURA CAFE chúc bạn sinh nhật vui vẻ! Ghé quán hôm nay nhận ngay ưu đãi đặc biệt.`,
        html: `<h1>AURA CAFE</h1><p>${n} thân mến,</p><p>AURA CAFE chúc bạn sinh nhật vui vẻ! Ghé quán hôm nay nhận ngay ưu đãi đặc biệt.</p>`
      };

    case 'winback':
      return {
        subject: 'Nhớ bạn — quà đang chờ từ AURA CAFE',
        sms: `${n} oi, AURA CAFE nho ban! Hay quay lai va nhan uu dac dac biet danh rieng cho ban.`,
        html: `<h1>AURA CAFE</h1><p>${n} ơi, AURA CAFE nhớ bạn!</p><p>Hãy quay lại và nhận ưu đãi đặc biệt dành riêng cho bạn.</p>`
      };

    case 'post_visit':
      return {
        subject: 'Đánh giá trải nghiệm với AURA CAFE',
        sms: `Cam on ${n} da den AURA CAFE! Danh gia trai nghiem cua ban de giup chung toi tot hon.`,
        html: `<h1>AURA CAFE</h1><p>Cảm ơn ${n} đã đến AURA CAFE!</p><p>Đánh giá trải nghiệm của bạn để giúp chúng tốt hơn.</p>`
      };

    case 'cashback_expiry': {
      return {
        subject: `⏰ Cashback sắp hết hạn — ${formatCurrency(amount)} VND`,
        sms: `${n} oi, ${formatCurrency(amount)} VND cashback cua ban sap het han trong ${daysLeft} ngay. Hay su dung ngay!`,
        html: `<h1>AURA CAFE</h1><p>${n} ơi, <strong>${formatCurrency(amount)} VND</strong> cashback của bạn sắp hết hạn trong <strong>${daysLeft} ngày</strong>.</p><p>Hãy sử dụng ngay!</p>`
      };
    }

    default: {
      const _exhaustive: never = trigger;
      throw new Error(`Unknown trigger: ${_exhaustive}`);
    }
  }
}
