import { z } from 'zod';
import { openapi } from '@hono/zod-openapi';
import {
  PaginationQuerySchema,
  PaginationMetaSchema,
  SuccessResponseSchema,
  ErrorResponseSchema,
  IdParamsSchema,
  LocaleEnum,
  DateTimeSchema,
  StaffRoleEnum,
  MoneySchema,
  ReferenceSchema,
} from './common';

/**
 * Staff management schemas
 */

export const StaffCreateSchema = z.object({
  name: z.string().min(1).max(100),
  email: z.string().email(),
  phone: z.string().max(20).optional(),
  password: z.string().min(8).max(128),
  role: StaffRoleEnum.default('waiter'),
  locale: LocaleEnum.default('vi'),
  hourlyRate: MoneySchema.optional(),
  locationId: z.string().uuid().optional(),
}).openapi('StaffCreate');

export const StaffUpdateSchema = z.object({
  name: z.string().min(1).max(100).optional(),
  email: z.string().email().optional(),
  phone: z.string().max(20).optional(),
  role: StaffRoleEnum.optional(),
  locale: LocaleEnum.optional(),
  isActive: z.boolean().optional(),
  hourlyRate: MoneySchema.optional(),
  locationId: z.string().uuid().optional(),
  avatarUrl: z.string().url().optional(),
}).openapi('StaffUpdate');

export const StaffResponseSchema = z.object({
  id: z.string().uuid(),
  name: z.string(),
  email: z.string().email(),
  phone: z.string().nullable(),
  role: StaffRoleEnum,
  locale: LocaleEnum,
  isActive: z.boolean(),
  hourlyRate: MoneySchema.nullable(),
  locationId: z.string().uuid().nullable(),
  location: ReferenceSchema.nullable().optional(),
  avatarUrl: z.string().url().nullable(),
  lastLoginAt: DateTimeSchema.nullable(),
  createdAt: DateTimeSchema,
  updatedAt: DateTimeSchema,
}).openapi('Staff');

export const StaffListResponseSchema = z.object({
  staff: z.array(StaffResponseSchema),
  meta: PaginationMetaSchema,
}).openapi('StaffListResponse');

export const ShiftSchema = z.object({
  id: z.string().uuid(),
  staffId: z.string().uuid(),
  staff: ReferenceSchema.nullable().optional(),
  locationId: z.string().uuid(),
  date: z.string().date(),
  startTime: z.string().time(),
  endTime: z.string().time(),
  breakMinutes: z.number().int().nonnegative().default(0),
  status: z.enum(['scheduled', 'in_progress', 'completed', 'cancelled']).default('scheduled'),
  notes: z.string().max(500).optional(),
  createdAt: DateTimeSchema,
  updatedAt: DateTimeSchema,
}).openapi('Shift');

export const ShiftCreateSchema = z.object({
  staffId: z.string().uuid(),
  locationId: z.string().uuid(),
  date: z.string().date(),
  startTime: z.string().time(),
  endTime: z.string().time(),
  breakMinutes: z.number().int().nonnegative().default(0),
  notes: z.string().max(500).optional(),
}).openapi('ShiftCreate');

export const ShiftUpdateSchema = z.object({
  staffId: z.string().uuid().optional(),
  date: z.string().date().optional(),
  startTime: z.string().time().optional(),
  endTime: z.string().time().optional(),
  breakMinutes: z.number().int().nonnegative().optional(),
  status: z.enum(['scheduled', 'in_progress', 'completed', 'cancelled']).optional(),
  notes: z.string().max(500).optional(),
}).openapi('ShiftUpdate');

export const ShiftListResponseSchema = z.object({
  shifts: z.array(ShiftSchema),
  meta: PaginationMetaSchema,
}).openapi('ShiftListResponse');

export const AttendanceSchema = z.object({
  id: z.string().uuid(),
  staffId: z.string().uuid(),
  shiftId: z.string().uuid().nullable(),
  checkIn: DateTimeSchema,
  checkOut: DateTimeSchema.nullable(),
  breakStart: DateTimeSchema.nullable(),
  breakEnd: DateTimeSchema.nullable(),
  locationId: z.string().uuid(),
  deviceFingerprint: z.string().nullable(),
  notes: z.string().max(500).optional(),
}).openapi('Attendance');

export const AttendanceCheckInSchema = z.object({
  shiftId: z.string().uuid().optional(),
  locationId: z.string().uuid(),
  deviceFingerprint: z.string().optional(),
}).openapi('AttendanceCheckIn');

export const AttendanceCheckOutSchema = z.object({
  attendanceId: z.string().uuid(),
  deviceFingerprint: z.string().optional(),
}).openapi('AttendanceCheckOut');

// Export types
export type StaffCreate = z.infer<typeof StaffCreateSchema>;
export type StaffUpdate = z.infer<typeof StaffUpdateSchema>;
export type StaffResponse = z.infer<typeof StaffResponseSchema>;
export type StaffListResponse = z.infer<typeof StaffListResponseSchema>;
export type Shift = z.infer<typeof ShiftSchema>;
export type ShiftCreate = z.infer<typeof ShiftCreateSchema>;
export type ShiftUpdate = z.infer<typeof ShiftUpdateSchema>;
export type ShiftListResponse = z.infer<typeof ShiftListResponseSchema>;
export type Attendance = z.infer<typeof AttendanceSchema>;
export type AttendanceCheckIn = z.infer<typeof AttendanceCheckInSchema>;
export type AttendanceCheckOut = z.infer<typeof AttendanceCheckOutSchema>;

// OpenAPI route definitions
export const StaffRoutes = {
  list: {
    method: 'get',
    path: '/api/staff',
    summary: 'List staff with pagination and filtering',
    tags: ['Staff'],
    security: [{ BearerAuth: [] }],
    request: {
      query: PaginationQuerySchema.extend({
        role: StaffRoleEnum.optional(),
        isActive: z.coerce.boolean().optional(),
        locationId: z.string().uuid().optional(),
      }),
    },
    responses: {
      200: { description: 'Staff list', content: { 'application/json': { schema: SuccessResponseSchema(StaffListResponseSchema) } } },
      400: { description: 'Invalid query', content: { 'application/json': { schema: ErrorResponseSchema } } },
    },
  },
  get: {
    method: 'get',
    path: '/api/staff/{id}',
    summary: 'Get staff by ID',
    tags: ['Staff'],
    security: [{ BearerAuth: [] }],
    request: { params: IdParamsSchema },
    responses: {
      200: { description: 'Staff details', content: { 'application/json': { schema: SuccessResponseSchema(StaffResponseSchema) } } },
      404: { description: 'Not found', content: { 'application/json': { schema: ErrorResponseSchema } } },
    },
  },
  create: {
    method: 'post',
    path: '/api/staff',
    summary: 'Create new staff member',
    tags: ['Staff'],
    security: [{ BearerAuth: [] }],
    request: { body: { content: { 'application/json': { schema: StaffCreateSchema } } } },
    responses: {
      201: { description: 'Created', content: { 'application/json': { schema: SuccessResponseSchema(StaffResponseSchema) } } },
      400: { description: 'Validation error', content: { 'application/json': { schema: ErrorResponseSchema } } },
      409: { description: 'Email already exists', content: { 'application/json': { schema: ErrorResponseSchema } } },
    },
  },
  update: {
    method: 'patch',
    path: '/api/staff/{id}',
    summary: 'Update staff',
    tags: ['Staff'],
    security: [{ BearerAuth: [] }],
    request: { params: IdParamsSchema, body: { content: { 'application/json': { schema: StaffUpdateSchema } } } },
    responses: {
      200: { description: 'Updated', content: { 'application/json': { schema: SuccessResponseSchema(StaffResponseSchema) } } },
      404: { description: 'Not found', content: { 'application/json': { schema: ErrorResponseSchema } } },
    },
  },
  delete: {
    method: 'delete',
    path: '/api/staff/{id}',
    summary: 'Delete staff (soft delete - deactivate)',
    tags: ['Staff'],
    security: [{ BearerAuth: [] }],
    request: { params: IdParamsSchema },
    responses: {
      200: { description: 'Deactivated', content: { 'application/json': { schema: SuccessResponseSchema(z.object({ success: z.literal(true) })) } } },
      404: { description: 'Not found', content: { 'application/json': { schema: ErrorResponseSchema } } },
    },
  },
  shifts: {
    list: {
      method: 'get',
      path: '/api/staff/shifts',
      summary: 'List shifts with pagination and filtering',
      tags: ['Staff'],
      security: [{ BearerAuth: [] }],
      request: {
        query: PaginationQuerySchema.extend({
          staffId: z.string().uuid().optional(),
          locationId: z.string().uuid().optional(),
          dateFrom: z.string().date().optional(),
          dateTo: z.string().date().optional(),
          status: z.enum(['scheduled', 'in_progress', 'completed', 'cancelled']).optional(),
        }),
      },
      responses: {
        200: { description: 'Shift list', content: { 'application/json': { schema: SuccessResponseSchema(ShiftListResponseSchema) } } },
        400: { description: 'Invalid query', content: { 'application/json': { schema: ErrorResponseSchema } } },
      },
    },
    get: {
      method: 'get',
      path: '/api/staff/shifts/{id}',
      summary: 'Get shift by ID',
      tags: ['Staff'],
      security: [{ BearerAuth: [] }],
      request: { params: IdParamsSchema },
      responses: {
        200: { description: 'Shift details', content: { 'application/json': { schema: SuccessResponseSchema(ShiftSchema) } } },
        404: { description: 'Not found', content: { 'application/json': { schema: ErrorResponseSchema } } },
      },
    },
    create: {
      method: 'post',
      path: '/api/staff/shifts',
      summary: 'Create new shift',
      tags: ['Staff'],
      security: [{ BearerAuth: [] }],
      request: { body: { content: { 'application/json': { schema: ShiftCreateSchema } } } },
      responses: {
        201: { description: 'Created', content: { 'application/json': { schema: SuccessResponseSchema(ShiftSchema) } } },
        400: { description: 'Validation error', content: { 'application/json': { schema: ErrorResponseSchema } } },
        409: { description: 'Shift overlap', content: { 'application/json': { schema: ErrorResponseSchema } } },
      },
    },
    update: {
      method: 'patch',
      path: '/api/staff/shifts/{id}',
      summary: 'Update shift',
      tags: ['Staff'],
      security: [{ BearerAuth: [] }],
      request: { params: IdParamsSchema, body: { content: { 'application/json': { schema: ShiftUpdateSchema } } } },
      responses: {
        200: { description: 'Updated', content: { 'application/json': { schema: SuccessResponseSchema(ShiftSchema) } } },
        404: { description: 'Not found', content: { 'application/json': { schema: ErrorResponseSchema } } },
      },
    },
    delete: {
      method: 'delete',
      path: '/api/staff/shifts/{id}',
      summary: 'Cancel shift',
      tags: ['Staff'],
      security: [{ BearerAuth: [] }],
      request: { params: IdParamsSchema },
      responses: {
        200: { description: 'Cancelled', content: { 'application/json': { schema: SuccessResponseSchema(z.object({ success: z.literal(true) })) } } },
        404: { description: 'Not found', content: { 'application/json': { schema: ErrorResponseSchema } } },
      },
    },
  },
  attendance: {
    list: {
      method: 'get',
      path: '/api/staff/attendance',
      summary: 'List attendance records',
      tags: ['Staff'],
      security: [{ BearerAuth: [] }],
      request: {
        query: PaginationQuerySchema.extend({
          staffId: z.string().uuid().optional(),
          locationId: z.string().uuid().optional(),
          dateFrom: z.string().date().optional(),
          dateTo: z.string().date().optional(),
        }),
      },
      responses: {
        200: { description: 'Attendance list', content: { 'application/json': { schema: SuccessResponseSchema(z.array(AttendanceSchema)) } } },
      },
    },
    checkIn: {
      method: 'post',
      path: '/api/staff/attendance/check-in',
      summary: 'Check in for shift',
      tags: ['Staff'],
      security: [{ BearerAuth: [] }],
      request: { body: { content: { 'application/json': { schema: AttendanceCheckInSchema } } } },
      responses: {
        201: { description: 'Checked in', content: { 'application/json': { schema: SuccessResponseSchema(AttendanceSchema) } } },
        400: { description: 'Validation error', content: { 'application/json': { schema: ErrorResponseSchema } } },
        409: { description: 'Already checked in', content: { 'application/json': { schema: ErrorResponseSchema } } },
      },
    },
    checkOut: {
      method: 'post',
      path: '/api/staff/attendance/check-out',
      summary: 'Check out from shift',
      tags: ['Staff'],
      security: [{ BearerAuth: [] }],
      request: { body: { content: { 'application/json': { schema: AttendanceCheckOutSchema } } } },
      responses: {
        200: { description: 'Checked out', content: { 'application/json': { schema: SuccessResponseSchema(AttendanceSchema) } } },
        404: { description: 'Attendance not found', content: { 'application/json': { schema: ErrorResponseSchema } } },
      },
    },
  },
};
