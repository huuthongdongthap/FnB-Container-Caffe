/**
 * Staff Mobile SOP Router
 *
 * Checklist execution for an operator on shift: see what to run, tick items,
 * close it out or record why it was dropped.
 *
 * Role gating follows `staff-mobile.ts`: the parent declares the guard on both
 * the bare path and its wildcard, and the sub-app repeats it on `'*'` so a
 * request cannot reach a handler by matching only the outer `use`.
 */

import { Hono } from 'hono';
import { requireStaff } from '../middleware/staff-auth';
import { SOP_ROLES } from '@aura/domain-sop';
import { getMyViolation, getSopRunDetail, getSopRunsToday, getSopTemplates } from './sop-mobile/queries';
import {
  postAbandonSopRun,
  postAppealMyViolation,
  postCheckSopItem,
  postCompleteSopRun,
  postStartSopRun,
} from './sop-mobile/mutations';
import type { Env } from '../types/env';

export const sopMobileRouter = new Hono<{ Bindings: Env }>();

// ── Protected: SOP checklists ──
sopMobileRouter.use('/', requireStaff([...SOP_ROLES]));
sopMobileRouter.use('/*', requireStaff([...SOP_ROLES]));

const mobileSop = new Hono<{ Bindings: Env }>();
mobileSop.use('*', requireStaff([...SOP_ROLES]));

mobileSop.get('/templates', getSopTemplates);
mobileSop.get('/runs/today', getSopRunsToday);
mobileSop.get('/runs/:id', getSopRunDetail);
mobileSop.post('/runs', postStartSopRun);
mobileSop.post('/runs/:id/items/:itemId', postCheckSopItem);
mobileSop.post('/runs/:id/complete', postCompleteSopRun);
mobileSop.post('/runs/:id/abandon', postAbandonSopRun);
// The employee's own conduct file: read it, answer it. Both gated on ownership
// inside the handler rather than on a role, because the right belongs to the
// named staff member and to nobody else.
mobileSop.get('/violations/:id', getMyViolation);
mobileSop.post('/violations/:id/appeal', postAppealMyViolation);

sopMobileRouter.route('/', mobileSop);
