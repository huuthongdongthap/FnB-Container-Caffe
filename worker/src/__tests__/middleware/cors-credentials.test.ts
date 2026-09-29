import { describe, it, expect } from 'vitest';
import { corsHeaders, getCorsOrigin, jsonResponse, errorResponse } from '../../middleware/cors';

describe('CORS — Credential Reflection & Error Handling', () => {
  describe('getCorsOrigin', () => {
    it('reflects exact allowed production origins', () => {
      expect(getCorsOrigin('https://auracafe.vn')).toBe('https://auracafe.vn');
      expect(getCorsOrigin('https://staging.auracafe.vn')).toBe('https://staging.auracafe.vn');
    });

    it('reflects localhost ports for local development', () => {
      expect(getCorsOrigin('http://localhost:5173')).toBe('http://localhost:5173');
      expect(getCorsOrigin('http://localhost:3000')).toBe('http://localhost:3000');
      expect(getCorsOrigin('http://localhost:8787')).toBe('http://localhost:8787');
    });

    it('reflects subdomains of auracafe.vn', () => {
      expect(getCorsOrigin('https://admin.auracafe.vn')).toBe('https://admin.auracafe.vn');
      expect(getCorsOrigin('https://pos.auracafe.vn')).toBe('https://pos.auracafe.vn');
    });

    it('falls back to default origin when untrusted origin is passed', () => {
      expect(getCorsOrigin('https://malicious-site.com')).toBe('http://localhost:5173');
      expect(getCorsOrigin(null)).toBe('http://localhost:5173');
      expect(getCorsOrigin(undefined)).toBe('http://localhost:5173');
    });
  });

  describe('corsHeaders', () => {
    it('sets Access-Control-Allow-Credentials: true when withCredentials is true', () => {
      const headers = corsHeaders('https://auracafe.vn', true);
      expect(headers['Access-Control-Allow-Origin']).toBe('https://auracafe.vn');
      expect(headers['Access-Control-Allow-Credentials']).toBe('true');
      expect(headers.Vary).toBe('Origin');
    });

    it('replaces wildcard * with safe default origin when withCredentials is true', () => {
      const headers = corsHeaders('*', true);
      expect(headers['Access-Control-Allow-Origin']).not.toBe('*');
      expect(headers['Access-Control-Allow-Origin']).toBe('http://localhost:5173');
      expect(headers['Access-Control-Allow-Credentials']).toBe('true');
    });
  });

  describe('errorResponse', () => {
    it('never emits wildcard * origin when returning error responses', () => {
      const res = errorResponse('Bad Request', 400);
      expect(res.status).toBe(400);
      expect(res.headers.get('Access-Control-Allow-Origin')).not.toBe('*');
      expect(res.headers.get('Access-Control-Allow-Credentials')).toBe('true');
      expect(res.headers.get('Vary')).toBe('Origin');
    });

    it('dynamically reflects caller origin when valid', () => {
      const res = errorResponse('Unauthorized', 401, {}, 'https://auracafe.vn');
      expect(res.status).toBe(401);
      expect(res.headers.get('Access-Control-Allow-Origin')).toBe('https://auracafe.vn');
      expect(res.headers.get('Access-Control-Allow-Credentials')).toBe('true');
    });

    it('includes Idempotency-Key in allowed headers', () => {
      const res = errorResponse('Internal Error', 500);
      expect(res.headers.get('Access-Control-Allow-Headers')).toContain('Idempotency-Key');
    });
  });
});
