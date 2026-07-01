/**
 * Unit tests for global error handler middleware.
 */

import { describe, it, expect, vi } from 'vitest';
import { errorHandler, AppError } from '../../middleware/error-handler';
import { ZodError, z } from 'zod';

function mockContext(path = '/api/test') {
  return {
    req: { path },
    json: vi.fn().mockReturnValue(new Response('')),
  } as any;
}

describe('errorHandler', () => {
  it('handles ZodError with field-level details', () => {
    const c = mockContext();
    try { z.string().parse(123); } catch (e) {
      errorHandler(e as ZodError, c);
      expect(c.json).toHaveBeenCalledWith(
        expect.objectContaining({ success: false, error: 'Validation failed', fields: expect.any(Array) }),
        400
      );
    }
  });

  it('handles AppError with custom status code', () => {
    const c = mockContext();
    const err = new AppError('Not found', 404);
    errorHandler(err, c);
    expect(c.json).toHaveBeenCalledWith(
      expect.objectContaining({ success: false, error: 'Not found' }),
      404
    );
  });

  it('handles generic Error as 500', () => {
    const c = mockContext();
    errorHandler(new Error('Unexpected'), c);
    expect(c.json).toHaveBeenCalledWith(
      expect.objectContaining({ success: false, error: 'Internal server error' }),
      500
    );
  });

  it('handles non-Error objects', () => {
    const c = mockContext();
    errorHandler('string error' as any, c);
    expect(c.json).toHaveBeenCalledWith(
      expect.objectContaining({ success: false }),
      500
    );
  });
});

describe('AppError', () => {
  it('creates error with default 400 status', () => {
    const err = new AppError('Bad request');
    expect(err.statusCode).toBe(400);
    expect(err.message).toBe('Bad request');
  });

  it('creates error with custom status and detail', () => {
    const err = new AppError('Forbidden', 403, 'Admin only');
    expect(err.statusCode).toBe(403);
    expect(err.detail).toBe('Admin only');
  });
});
