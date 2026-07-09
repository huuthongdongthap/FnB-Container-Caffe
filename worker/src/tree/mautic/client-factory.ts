/**
 * Mautic Bridge — Mautic client factory
 * Extracted from routes/mautic-bridge.ts to tree/mautic/.
 */

import { createMauticClient } from '../../lib/mautic-client';
import type { MauticBridgeEnv } from './types';

export function getMauticClient(env: MauticBridgeEnv): ReturnType<typeof createMauticClient> {
  return createMauticClient({
    MAUTIC_BASE_URL: env.MAUTIC_BASE_URL as string,
    MAUTIC_CLIENT_ID: env.MAUTIC_CLIENT_ID as string,
    MAUTIC_CLIENT_SECRET: env.MAUTIC_CLIENT_SECRET as string
  });
}
