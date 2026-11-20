import { ENVIRONMENTS } from '@aura/domain-deployment';

function parseUrl(value: unknown): URL | null {
  if (typeof value !== 'string' || !value || value !== value.trim()) return null;
  if ([...value].some((char) => char.charCodeAt(0) < 32 || char.charCodeAt(0) === 127)) return null;
  try {
    const url = new URL(value);
    return url.username || url.password ? null : url;
  } catch {
    return null;
  }
}

export function safePayosCheckoutUrl(value: unknown): string | null {
  const url = parseUrl(value);
  return url?.protocol === 'https:' && url.origin === 'https://pay.payos.vn' ? url.href : null;
}

export function safeVietQrPreviewUrl(value: unknown): string | null {
  const url = parseUrl(value);
  return url?.protocol === 'https:' && url.origin === 'https://img.vietqr.io' && url.pathname.startsWith('/image/') ? url.href : null;
}

export function merchantWebhookUrl(
  payment: { webhookUrl?: string; webhookUrlPath?: string } | null,
  configuredApiBase: string,
  development = false,
): string | null {
  const path = payment?.webhookUrlPath;
  if (!path || !/^\/api\/webhook\/payos\/(?:[\w.!~*'()-]|%[\da-f]{2})+$/i.test(path)) return null;
  const slug = path.slice('/api/webhook/payos/'.length);
  try {
    if (['.', '..'].includes(decodeURIComponent(slug))) return null;
  } catch {
    return null;
  }
  const configured = parseUrl(configuredApiBase);
  const origins = new Set(Object.values(ENVIRONMENTS).map((env) => env.workerUrl));
  // API_BASE is build-time configuration, never request Host/Origin or the Pages origin.
  const configuredIsDirect = configured && !configured.search && !configured.hash &&
    configured.pathname === '/' && (configured.protocol === 'https:' ||
      (development && configured.origin === ENVIRONMENTS.local.workerUrl));
  if (configuredIsDirect) origins.add(configured.origin);
  const direct = parseUrl(payment?.webhookUrl);
  if (direct && origins.has(direct.origin) && direct.pathname === path && !direct.search && !direct.hash &&
      (direct.protocol === 'https:' || development)) return direct.href;
  const fallbackOrigin = configuredIsDirect ? configured.origin :
    (development ? ENVIRONMENTS.local.workerUrl : ENVIRONMENTS.production.workerUrl);
  return `${fallbackOrigin}${path}`;
}
