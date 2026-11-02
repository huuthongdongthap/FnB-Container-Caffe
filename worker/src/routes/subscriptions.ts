/**
 * Subscriptions Routes — /api/subscriptions
 * Thin Hono router — business logic extracted to tree/subscriptions/.
 */

import { Hono } from 'hono';
import type { Env } from '../types/env';
import { optionalAuth } from '../middleware/auth';

import { listPlans, getPlan, createPlan, updatePlan } from '../tree/subscriptions/plan-handlers';
import {
  listSubscriptions, getStatsHandler, getMRRTrend, getSubscription,
  createSubscription, updateSubscription, cancelSubscription,
  pauseSubscription, resumeSubscription, deleteSubscription, deletePlan
} from '../tree/subscriptions/sub-handlers';
import { listInvoices, payInvoice, generateInvoices } from '../tree/subscriptions/invoice-handlers';
import { requireSubAdminMiddleware, requireSubAuthMiddleware } from '../tree/subscriptions/middleware';

export const subscriptionsRouter = new Hono<{ Bindings: Env }>();
subscriptionsRouter.use('*', async (c, next) => {
  if (!c.get('user' as any) && c.req.header('Authorization')) {
    return optionalAuth()(c, next);
  }
  await next();
});

// ── Plans ──
subscriptionsRouter.get('/plans', listPlans);
subscriptionsRouter.get('/plans/:id', getPlan);
subscriptionsRouter.post('/plans', createPlan);
subscriptionsRouter.put('/plans/:id', updatePlan);
subscriptionsRouter.delete('/plans/:id', deletePlan);

// ── Subscriptions ──
subscriptionsRouter.get('/', requireSubAuthMiddleware, listSubscriptions);
subscriptionsRouter.get('/stats', requireSubAdminMiddleware, getStatsHandler);
subscriptionsRouter.get('/mrr', requireSubAdminMiddleware, getMRRTrend);
subscriptionsRouter.get('/:id', requireSubAuthMiddleware, getSubscription);
subscriptionsRouter.post('/', requireSubAuthMiddleware, createSubscription);
subscriptionsRouter.put('/:id', updateSubscription);
subscriptionsRouter.post('/:id/cancel', cancelSubscription);
subscriptionsRouter.post('/:id/pause', pauseSubscription);
subscriptionsRouter.post('/:id/resume', resumeSubscription);
subscriptionsRouter.delete('/:id', deleteSubscription);

// ── Invoices ──
subscriptionsRouter.get('/invoices/list', requireSubAuthMiddleware, listInvoices);
subscriptionsRouter.post('/invoices/:id/pay', payInvoice);
subscriptionsRouter.post('/invoices/generate', generateInvoices);
