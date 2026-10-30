/**
 * Route map for the admin SOP surface (`/api/sop/admin/*`).
 *
 * Declared as a plain object rather than with `createRoute` because this repo
 * registers routes through `app.openapi(route as any, ...)`; the `as any` is
 * the established idiom here, and mirroring `StaffRoutes` keeps the admin
 * console's generated spec consistent with the staff one.
 */

import { z } from '@hono/zod-openapi';
import { ErrorResponseSchema, SuccessResponseSchema } from './common';
import {
  SopAppealSchema,
  SopApplySanctionSchema,
  SopCreateTemplateSchema,
  SopIdParamsSchema,
  SopMonitorResponseSchema,
  SopRecordViolationSchema,
  SopReminderAcknowledgeResponseSchema,
  SopReminderIdParamsSchema,
  SopReminderListQuerySchema,
  SopReminderListResponseSchema,
  SopRunListQuerySchema,
  SopRunListResponseSchema,
  SopUpdateTemplateSchema,
  SopViolationIdParamsSchema,
  SopViolationListQuerySchema,
  SopViolationListResponseSchema,
  SopViolationSchema,
} from './sop';

const MANAGER_ROLES = ['owner', 'manager', 'admin'];

/** Every admin response shares the same error shape, so the map reads shorter. */
const responses = (ok: z.ZodTypeAny, status: 200 | 201 = 200) => ({
  [status]: { description: 'Success', content: { 'application/json': { schema: SuccessResponseSchema(ok) } } },
  400: { description: 'Invalid request', content: { 'application/json': { schema: ErrorResponseSchema } } },
  403: { description: 'Owner, manager or admin required', content: { 'application/json': { schema: ErrorResponseSchema } } },
  404: { description: 'Not found', content: { 'application/json': { schema: ErrorResponseSchema } } },
  409: { description: 'Rejected by policy', content: { 'application/json': { schema: ErrorResponseSchema } } },
});

export const SopAdminRoutes = {
  monitor: {
    method: 'get',
    path: '/api/sop/admin/monitor',
    summary: 'Oversight: who is running what, what is overdue, completion today',
    tags: ['SOP Admin'],
    security: [{ BearerAuth: [] }],
    responses: responses(SopMonitorResponseSchema),
  },
  runs: {
    method: 'get',
    path: '/api/sop/admin/runs',
    summary: 'Checklist run history, filterable by date, template, status and staff',
    tags: ['SOP Admin'],
    security: [{ BearerAuth: [] }],
    request: { query: SopRunListQuerySchema },
    responses: responses(SopRunListResponseSchema),
  },
  runDetail: {
    method: 'get',
    path: '/api/sop/admin/runs/{id}',
    summary: 'One run with every item and the rules it was judged against',
    tags: ['SOP Admin'],
    security: [{ BearerAuth: [] }],
    request: { params: SopIdParamsSchema },
    // Detail is assembled from the run and its template, both already defined.
    responses: {
      200: { description: 'Run detail', content: { 'application/json': { schema: SuccessResponseSchema(z.object({ run: z.any() })) } } },
      404: { description: 'Not found', content: { 'application/json': { schema: ErrorResponseSchema } } },
    },
  },
  templates: {
    method: 'get',
    path: '/api/sop/admin/templates',
    summary: 'All templates with their items, active or not',
    tags: ['SOP Admin'],
    security: [{ BearerAuth: [] }],
    responses: {
      200: { description: 'Template list', content: { 'application/json': { schema: SuccessResponseSchema(z.array(z.any())) } } },
    },
  },
  reminders: {
    method: 'get',
    path: '/api/sop/admin/reminders',
    summary: 'Recurring-duty notices: monthly duties warned about, missed, or run over',
    tags: ['SOP Admin'],
    security: [{ BearerAuth: [] }],
    request: { query: SopReminderListQuerySchema },
    responses: responses(SopReminderListResponseSchema),
  },
  acknowledgeReminder: {
    method: 'post',
    path: '/api/sop/admin/reminders/{id}/acknowledge',
    summary: 'Mark a notice as handled — the obligation happened, the record stays',
    tags: ['SOP Admin'],
    security: [{ BearerAuth: [] }],
    request: { params: SopReminderIdParamsSchema },
    responses: responses(SopReminderAcknowledgeResponseSchema),
  },
  createTemplate: {
    method: 'post',
    path: '/api/sop/admin/templates',
    summary: 'Create a template with its items',
    tags: ['SOP Admin'],
    security: [{ BearerAuth: [] }],
    request: { body: { content: { 'application/json': { schema: SopCreateTemplateSchema } } } },
    responses: responses(z.any(), 201),
  },
  updateTemplate: {
    method: 'patch',
    path: '/api/sop/admin/templates/{id}',
    summary: 'Edit a template — bumps its version; runs already started keep theirs',
    tags: ['SOP Admin'],
    security: [{ BearerAuth: [] }],
    request: { params: SopIdParamsSchema, body: { content: { 'application/json': { schema: SopUpdateTemplateSchema } } } },
    responses: responses(z.any()),
  },
  violations: {
    method: 'get',
    path: '/api/sop/admin/violations',
    summary: 'Conduct breaches, filterable by status, month and staff',
    tags: ['SOP Admin'],
    security: [{ BearerAuth: [] }],
    request: { query: SopViolationListQuerySchema },
    responses: responses(SopViolationListResponseSchema),
  },
  recordViolation: {
    method: 'post',
    path: '/api/sop/admin/violations',
    summary: 'Record a breach — the first rung of the accountability ladder',
    tags: ['SOP Admin'],
    security: [{ BearerAuth: [] }],
    request: { body: { content: { 'application/json': { schema: SopRecordViolationSchema } } } },
    responses: responses(SopViolationSchema, 201),
  },
  confirmViolation: {
    method: 'post',
    path: '/api/sop/admin/violations/{id}/confirm',
    summary: 'Confirm a recorded breach — only the recorder cannot confirm it',
    tags: ['SOP Admin'],
    security: [{ BearerAuth: [] }],
    request: { params: SopViolationIdParamsSchema },
    responses: responses(SopViolationSchema),
  },
  applyViolation: {
    method: 'post',
    path: '/api/sop/admin/violations/{id}/apply',
    summary: 'Apply a discipline step; termination is owner-only',
    tags: ['SOP Admin'],
    security: [{ BearerAuth: [] }],
    request: {
      params: SopViolationIdParamsSchema,
      body: { content: { 'application/json': { schema: SopApplySanctionSchema } } },
    },
    responses: responses(SopViolationSchema),
  },
  closeViolation: {
    method: 'post',
    path: '/api/sop/admin/violations/{id}/close',
    summary: 'Close the file — terminal, and the appeal is already on it',
    tags: ['SOP Admin'],
    security: [{ BearerAuth: [] }],
    request: { params: SopViolationIdParamsSchema },
    responses: responses(SopViolationSchema),
  },
  appealViolation: {
    method: 'post',
    path: '/api/sop/admin/violations/{id}/appeal',
    summary: "Record the staff member's own account of an applied sanction",
    tags: ['SOP Admin'],
    security: [{ BearerAuth: [] }],
    request: { params: SopViolationIdParamsSchema, body: { content: { 'application/json': { schema: SopAppealSchema } } } },
    responses: responses(SopViolationSchema),
  },
};

export { MANAGER_ROLES };
