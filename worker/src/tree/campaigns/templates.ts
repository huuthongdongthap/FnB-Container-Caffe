/**
 * Campaign Templates — Bilingual (VN+EN) message templates per trigger
 */
import type { CampaignTrigger } from './types';

export interface RenderedTemplate {
  subject: string;
  sms: string;
  html: string;
}

function safeName(name?: string): string {
  return name || 'bạn';
}

function formatCurrency(amount: number): string {
  return amount.toLocaleString('vi-VN');
}

export function renderTemplate(
  trigger: CampaignTrigger,
  name?: string,
  data?: Record<string, unknown>,
): RenderedTemplate {
  const n = safeName(name);

  switch (trigger) {
    case 'welcome':
      return {
        subject: '🎉 Chào mừng bạn đến với AURA CAFE!',
        sms: `Chao ${n}, chuc mung ban da tro thanh thanh vien AURA! Nhap WELCOME10 de giam 10% don dau tien.`,
        html: `<h1>AURA CAFE</h1><p>Chào ${n}, chúc mừng bạn đã trở thành thành viên AURA!</p><p>Nhập mã <strong>WELCOME10</strong> để giảm 10% đơn đầu tiên.</p>`,
      };

    case 'birthday':
      return {
        subject: '🎂 Chúc mừng sinh nhật!',
        sms: `Chuc mung sinh nhat ${n}! AURA tang ban 15% giam gia trong hom nay. Hay den quan de nhan uu dai nhe!`,
        html: `<h1>AURA CAFE</h1><p>🎂 Chúc mừng sinh nhật ${n}!</p><p>AURA tặng bạn <strong>15% giảm giá</strong> trong hôm nay. Hãy đến quán để nhận ưu đãi nhé!</p>`,
      };

    case 'winback':
      return {
        subject: 'AURA CAFE — Chúng tôi nhớ bạn!',
        sms: `${n} oi, da lau ban chua ghe AURA. Hom nay giam 15% cho ban. Hen gap lai nhe!`,
        html: `<h1>AURA CAFE</h1><p>${n} ơi, đã lâu bạn chưa ghé AURA.</p><p>Hôm nay giảm <strong>15%</strong> cho bạn. Hẹn gặp lại nhé!</p>`,
      };

    case 'post_visit': {
      const reviewLink = (data?.review_link as string) || 'https://auraspace.cafe/review';
      return {
        subject: 'Cảm ơn bạn đã ghé AURA CAFE!',
        sms: `Cam on ${n} da ghe AURA hom nay! Danh gia trai nghiem cua ban tai: ${reviewLink}`,
        html: `<h1>AURA CAFE</h1><p>Cảm ơn ${n} đã ghé AURA hôm nay!</p><p>Đánh giá trải nghiệm của bạn tại: <a href="${reviewLink}">${reviewLink}</a></p>`,
      };
    }

    case 'cashback_expiry': {
      const amount = typeof data?.amount === 'number' ? data.amount : 0;
      const daysLeft = typeof data?.days_left === 'number' ? data.days_left : 7;
      return {
        subject: `⏰ Cashback sắp hết hạn — ${formatCurrency(amount)} VND`,
        sms: `${n} oi, ${formatCurrency(amount)} VND cashback cua ban sap het han trong ${daysLeft} ngay. Hay su dung ngay!`,
        html: `<h1>AURA CAFE</h1><p>${n} ơi, <strong>${formatCurrency(amount)} VND</strong> cashback của bạn sắp hết hạn trong <strong>${daysLeft} ngày</strong>.</p><p>Hãy sử dụng ngay!</p>`,
      };
    }

    default: {
      const _exhaustive: never = trigger;
      throw new Error(`Unknown trigger: ${_exhaustive}`);
    }
  }
}
