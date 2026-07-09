import { createPretixClient, type PretixClient } from '../../lib/pretix-client';
import type { PretixEnv } from './types';

export function getPretixClient(env: PretixEnv): PretixClient | null {
  if (!env.PRETIX_API_URL || !env.PRETIX_API_TOKEN) {
    return null;
  }
  return createPretixClient(env.PRETIX_API_URL, env.PRETIX_API_TOKEN);
}
