/**
 * Subscriptions Routes — /api/subscriptions
 * Thin Hono router — business logic extracted to tree/subscriptions/.
 */

import { Hono } from 'hono';
import type { Env } from '../types/env';

import { listPlans, getPlan, createPlan, updatePlan } from '../tree/subscriptions/plan-handlers';
import {
  listSubscriptions, getStatsHandler, getMRRTrend, getSubscription,
  createSubscription, updateSubscription, cancelSubscription,
  pauseSubscription, resumeSubscription, deleteSubscription
} from '../tree/subscriptions/sub-handlers';
import { listInvoices, payInvoice, generateInvoices } from '../tree/subscriptions/invoice-handlers';

export const subscriptionsRouter = new Hono<{ Bindings: Env }>();

// ── Plans ──
subscriptionsRouter.get('/plans', listPlans);
subscriptionsRouter.get('/plans/:id', getPlan);
subscriptionsRouter.post('/plans', createPlan);
subscriptionsRouter.put('/plans/:id', updatePlan);

// ── Subscriptions ──
subscriptionsRouter.get('/', listSubscriptions);
subscriptionsRouter.get('/stats', getStatsHandler);
subscriptionsRouter.get('/mrr', getMRRTrend);
subscriptionsRouter.get('/:id', getSubscription);
subscriptionsRouter.post('/', createSubscription);
subscriptionsRouter.put('/:id', updateSubscription);
subscriptionsRouter.post('/:id/cancel', cancelSubscription);
subscriptionsRouter.post('/:id/pause', pauseSubscription);
subscriptionsRouter.post('/:id/resume', resumeSubscription);
subscriptionsRouter.delete('/:id', deleteSubscription);

// ── Invoices ──
subscriptionsRouter.get('/invoices/list', listInvoices);
subscriptionsRouter.post('/invoices/:id/pay', payInvoice);
subscriptionsRouter.post('/invoices/generate', generateInvoices);
