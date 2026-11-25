/**
 * KDS Orders Router — the queue surface for the Kitchen Display System.
 *
 * Mounted at /api/kds/orders. Keeping this as its own router (rather than a
 * second mount of the full unified orders router) means the KDS surface only
 * exposes the routes KDS actually consumes, and no handler has to infer which
 * prefix it was reached through.
 */

import { Hono } from 'hono';
import type { Env } from '../types/env';
import { requireAuth } from '../middleware/auth';
import { markKdsOrderItemReady } from '@aura/domain-kitchen';
import {
  handleGetKdsOrders,
  handleGetKdsRecentOrders,
  handleRecallKdsOrder,
  KDS_PREP_ROLES,
  KDS_ROLES,
} from './orders-hono-handlers/kds-handlers';

export const kdsOrdersRouter = new Hono<{ Bindings: Env }>();

kdsOrdersRouter.get('/recent', requireAuth(KDS_ROLES), handleGetKdsRecentOrders);
kdsOrdersRouter.get('/', requireAuth(KDS_ROLES), handleGetKdsOrders);
kdsOrdersRouter.post('/:id/ready', requireAuth(KDS_PREP_ROLES), (c) => markKdsOrderItemReady(c));
kdsOrdersRouter.post('/:id/recall', requireAuth(KDS_PREP_ROLES), handleRecallKdsOrder);

export default kdsOrdersRouter;
