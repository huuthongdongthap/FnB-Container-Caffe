import type { PretixEnv } from '../../tree/pretix/types';

export { type PretixItemsResponse, type PretixEventResponse, type PretixItem, type PretixEnv } from '../../tree/pretix/types';

export function getOrganizer(env: PretixEnv): string {
  return (env.PRETIX_ORGANIZER as string) || 'default';
}

