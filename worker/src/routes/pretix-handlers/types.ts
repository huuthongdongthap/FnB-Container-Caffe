import type { PretixItemsResponse, PretixEventResponse, PretixItem } from '../../tree/pretix/types';

export { type PretixItemsResponse, type PretixEventResponse, type PretixItem } from '../../tree/pretix/types';

export interface PretixEnv {
  AURA_DB: import('@cloudflare/workers-types').D1Database;
  PRETIX_API_URL?: string;
  PRETIX_API_TOKEN?: string;
  PRETIX_ORGANIZER?: string;
  PRETIX_WEBHOOK_SECRET?: string;
}

export function getOrganizer(env: PretixEnv): string {
  return (env.PRETIX_ORGANIZER as string) || 'default';
}