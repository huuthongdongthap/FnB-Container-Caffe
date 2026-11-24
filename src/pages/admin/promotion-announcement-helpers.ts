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

const FIXED_DISCOUNT_TYPES = new Set(['fixed', 'fixed_amount', 'amount']);

export function isFixedDiscountPromotion(promo: Promotion): boolean {
  const rawType = String(promo.discount_type ?? promo.type ?? '').trim().toLowerCase();
  return FIXED_DISCOUNT_TYPES.has(rawType);
}

export function formatPromotionBaseDiscount(promo: Promotion): string {
  if (isFixedDiscountPromotion(promo)) {
    const rawValue = Number(promo.discount_value ?? promo.value ?? promo.percent ?? 0);
    return `${Math.round(rawValue).toLocaleString('vi-VN')}đ`;
  }
  const pct = Number(promo.percent ?? promo.discount_value ?? promo.value ?? 0);
  return `${pct}%`;
}

export function formatPromotionDiscount(promo: Promotion): string {
  const base = formatPromotionBaseDiscount(promo);
  if (!isFixedDiscountPromotion(promo) && promo.max_discount > 0) {
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
  const baseDiscount = formatPromotionBaseDiscount(promo);
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
    title: `Ưu đãi ${promo.code} — Giảm ${baseDiscount}`,
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
