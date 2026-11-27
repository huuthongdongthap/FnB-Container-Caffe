/**
 * Campaign Templates — Bilingual (VN+EN) message templates per trigger
 */
import type { CampaignTrigger } from './types';

export interface RenderedTemplate {
  subject: string;
  sms: string;
  html: string;
}

const DEFAULT_REVIEW_LINK = 'https://auraspace.cafe/review';

function safeName(name?: string): string {
  return name || 'bạn';
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function sanitizeReviewLink(raw?: unknown): string {
  if (typeof raw !== 'string') {
    return DEFAULT_REVIEW_LINK;
  }
  const trimmed = raw.trim();
  if (!/^https?:\/\//i.test(trimmed)) {
    return DEFAULT_REVIEW_LINK;
  }
  try {
    const parsed = new URL(trimmed);
    if (parsed.protocol !== 'https:' && parsed.protocol !== 'http:') {
      return DEFAULT_REVIEW_LINK;
    }
    return trimmed;
  } catch {
    return DEFAULT_REVIEW_LINK;
  }
}

function formatCurrency(amount: number): string {
  return amount.toLocaleString('vi-VN');
}

export function renderTemplate(
  trigger: CampaignTrigger,
  name?: string,
  data?: Record<string, unknown>,
  locale: 'vi' | 'en' = 'vi'
): RenderedTemplate {
  const n = safeName(name);
  const htmlName = escapeHtml(n);

  switch (trigger) {
  case 'welcome':
    if (locale === 'en') {
      return {
        subject: '🎉 Welcome to AURA CAFE!',
        sms: `Hi ${n}, welcome to AURA! Use code WELCOME10 for 10% off your first order.`,
        html: `<h1>AURA CAFE</h1><p>Hi ${htmlName}, welcome to AURA!</p><p>Use code <strong>WELCOME10</strong> for 10% off your first order.</p>`
      };
    }
    return {
      subject: '🎉 Chào mừng bạn đến với AURA CAFE!',
      sms: `Chao ${n}, chuc mung ban da tro thanh thanh vien AURA! Nhap WELCOME10 de giam 10% don dau tien.`,
      html: `<h1>AURA CAFE</h1><p>Chào ${htmlName}, chúc mừng bạn đã trở thành thành viên AURA!</p><p>Nhập mã <strong>WELCOME10</strong> để giảm 10% đơn đầu tiên.</p>`
    };

  case 'birthday':
    if (locale === 'en') {
      return {
        subject: '🎂 Happy Birthday!',
        sms: `Happy birthday ${n}! AURA gives you 15% off today. Come visit us to claim your gift!`,
        html: `<h1>AURA CAFE</h1><p>🎂 Happy Birthday ${htmlName}!</p><p>AURA gives you <strong>15% off</strong> today. Come visit us to claim your gift!</p>`
      };
    }
    return {
      subject: '🎂 Chúc mừng sinh nhật!',
      sms: `Chuc mung sinh nhat ${n}! AURA tang ban 15% giam gia trong hom nay. Hay den quan de nhan uu dai nhe!`,
      html: `<h1>AURA CAFE</h1><p>🎂 Chúc mừng sinh nhật ${htmlName}!</p><p>AURA tặng bạn <strong>15% giảm giá</strong> trong hôm nay. Hãy đến quán để nhận ưu đãi nhé!</p>`
    };

  case 'winback':
    if (locale === 'en') {
      return {
        subject: 'AURA CAFE — We miss you!',
        sms: `${n}, we haven't seen you in a while. Here's 15% off — come visit us today!`,
        html: `<h1>AURA CAFE</h1><p>${htmlName}, we haven't seen you in a while.</p><p>Here's <strong>15% off</strong> — come visit us today!</p>`
      };
    }
    return {
      subject: 'AURA CAFE — Chúng tôi nhớ bạn!',
      sms: `${n} oi, da lau ban chua ghe AURA. Hom nay giam 15% cho ban. Hen gap lai nhe!`,
      html: `<h1>AURA CAFE</h1><p>${htmlName} ơi, đã lâu bạn chưa ghé AURA.</p><p>Hôm nay giảm <strong>15%</strong> cho bạn. Hẹn gặp lại nhé!</p>`
    };

  case 'post_visit': {
    const reviewLink = sanitizeReviewLink(data?.review_link);
    const htmlReviewLink = escapeHtml(reviewLink);
    if (locale === 'en') {
      return {
        subject: 'Thank you for visiting AURA CAFE!',
        sms: `Thanks ${n} for visiting AURA today! Rate your experience: ${reviewLink}`,
        html: `<h1>AURA CAFE</h1><p>Thank you ${htmlName} for visiting AURA today!</p><p>Rate your experience: <a href="${htmlReviewLink}">${htmlReviewLink}</a></p>`
      };
    }
    return {
      subject: 'Cảm ơn bạn đã ghé AURA CAFE!',
      sms: `Cam on ${n} da ghe AURA hom nay! Danh gia trai nghiem cua ban tai: ${reviewLink}`,
      html: `<h1>AURA CAFE</h1><p>Cảm ơn ${htmlName} đã ghé AURA hôm nay!</p><p>Đánh giá trải nghiệm của bạn tại: <a href="${htmlReviewLink}">${htmlReviewLink}</a></p>`
    };
  }

  case 'cashback_expiry': {
    const amount = typeof data?.amount === 'number' && Number.isFinite(data.amount) ? data.amount : 0;
    const daysLeft = typeof data?.days_left === 'number' && Number.isFinite(data.days_left) ? data.days_left : 7;
    if (locale === 'en') {
      return {
        subject: `⏰ Cashback expiring soon — ${formatCurrency(amount)} VND`,
        sms: `${n}, your ${formatCurrency(amount)} VND cashback expires in ${daysLeft} days. Use it now!`,
        html: `<h1>AURA CAFE</h1><p>${htmlName}, your <strong>${formatCurrency(amount)} VND</strong> cashback expires in <strong>${daysLeft} days</strong>.</p><p>Use it now!</p>`
      };
    }
    return {
      subject: `⏰ Cashback sắp hết hạn — ${formatCurrency(amount)} VND`,
      sms: `${n} oi, ${formatCurrency(amount)} VND cashback cua ban sap het han trong ${daysLeft} ngay. Hay su dung ngay!`,
      html: `<h1>AURA CAFE</h1><p>${htmlName} ơi, <strong>${formatCurrency(amount)} VND</strong> cashback của bạn sắp hết hạn trong <strong>${daysLeft} ngày</strong>.</p><p>Hãy sử dụng ngay!</p>`
    };
  }

  default: {
    const _exhaustive: never = trigger;
    throw new Error(`Unknown trigger: ${_exhaustive}`);
  }
  }
}
