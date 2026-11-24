/**
 * Promotion announcement draft helpers shared across Admin Marketing screens.
 */

import type { Promotion } from './types';

export interface PromotionZnsDraft {
  title: string;
  message: string;
  promo_code: string;
  discount: string;
  expires_at: string;
}

export function formatPromotionDiscount(promo: Promotion): string {
  const base = `${promo.percent}%`;
  if (promo.max_discount > 0) {
    return `${base} (tối đa ${promo.max_discount.toLocaleString('vi-VN')}đ)`;
  }
  return base;
}

export function formatPromotionExpiry(expiresAt: string | null): string {
  if (!expiresAt) return '';
  const d = new Date(expiresAt);
  if (Number.isNaN(d.getTime())) return '';
  return d.toLocaleDateString('vi-VN', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  });
}

export function buildPromotionZnsDraft(promo: Promotion): PromotionZnsDraft {
  const discount = formatPromotionDiscount(promo);
  const expiresAt = formatPromotionExpiry(promo.expires_at);
  const conditions: string[] = [];
  if (promo.min_order > 0) {
    conditions.push(`Đơn tối thiểu ${promo.min_order.toLocaleString('vi-VN')}đ.`);
  }
  if (expiresAt) {
    conditions.push(`HSD: ${expiresAt}.`);
  }
  const suffix = conditions.length > 0 ? ` ${conditions.join(' ')}` : '';
  return {
    title: `Ưu đãi ${promo.code} — Giảm ${promo.percent}%`,
    message: `Nhập mã ${promo.code} để giảm ${discount} tại AURA CAFE.${suffix}`,
    promo_code: promo.code,
    discount,
    expires_at: expiresAt,
  };
}

export function buildPromotionFacebookDraft(promo: Promotion): string {
  const discount = formatPromotionDiscount(promo);
  const expiresAt = formatPromotionExpiry(promo.expires_at);
  const lines = [
    `🔥 Ưu đãi ${promo.code}: Giảm ${discount} — AURA CAFE`,
  ];
  if (promo.min_order > 0) {
    lines.push(`Áp dụng cho đơn từ ${promo.min_order.toLocaleString('vi-VN')}đ.`);
  }
  if (expiresAt) {
    lines.push(`Hiệu lực đến: ${expiresAt}.`);
  }
  lines.push('#AuraCafe #KhuyenMai');
  return lines.join('\n');
}
