/**
 * Environment variable bindings for Cloudflare Worker
 * Typed interface for all env vars used across routes.
 */
export interface Env {
  // ── D1 Database ──
  AURA_DB: import('@cloudflare/workers-types').D1Database;

  // ── KV Namespace ──
  AUTH_KV: import('@cloudflare/workers-types').KVNamespace;

  // ── Auth ──
  JWT_SECRET: string;
  JWT_EXPIRY_SECONDS?: string;
  RESET_KEY?: string;
  CORS_ORIGIN?: string;

  // ── PayOS ──
  PAYOS_CLIENT_ID?: string;
  PAYOS_API_KEY?: string;
  PAYOS_CHECKSUM_KEY?: string;

  // ── Frontend base URL (for payment return URLs) ──
  FE_BASE_URL?: string;

  // ── Telegram ──
  TELEGRAM_BOT_TOKEN?: string;
  TELEGRAM_CHAT_ID?: string;

  // ── SLA ──
  SLA_THRESHOLD_MINUTES?: string;

  // ── Mixpost ──
  MIXPOST_API_URL?: string;
  MIXPOST_API_TOKEN?: string;
  MIXPOST_ACCOUNTS?: string;

  // ── pretix ──
  PRETIX_API_URL?: string;
  PRETIX_API_TOKEN?: string;
  PRETIX_ORGANIZER?: string;
  PRETIX_WEBHOOK_SECRET?: string;

  // ── ERPNext ──
  ERP_NEXT_API_URL?: string;
  ERP_NEXT_API_KEY?: string;
  ERP_NEXT_API_SECRET?: string;

  // ── Resend (email) ──
  RESEND_API_KEY?: string;

  // ── SpeedSMS ──
  SPEEDSMS_API_KEY?: string;

  // ── Web Push ──
  VAPID_PUBLIC_KEY?: string;
  VAPID_PRIVATE_KEY?: string;
  VAPID_EMAIL?: string;  // mailto: contact for VAPID

  // ── Zalo ──
  ZALO_APP_ID?: string;
  ZALO_APP_SECRET?: string;
  ZALO_ACCESS_TOKEN?: string;
  ZALO_REFRESH_TOKEN?: string;
  ZALO_OA_TOKEN?: string;

  // ── Mautic ──
  MAUTIC_API_URL?: string;
  MAUTIC_API_USER?: string;
  MAUTIC_API_PASSWORD?: string;

  // ── Cal.com ──
  CAL_WEBHOOK_SECRET?: string;

  // ── Xibo (Signage) ──
  XIBO_API_URL?: string;
  XIBO_API_KEY?: string;

  // ── Cron ──
  CRON_SECRET?: string;

  // ── General ──
  ENVIRONMENT?: string;

  // ── Dynamic access for legacy patterns ──
  [key: string]: unknown;
}
