/**
 * Auth domain helpers
 * Extracted from openapi-auth.ts for modularization
 */

import {
  hashPassword as hashPasswordPBKDF2,
  verifyPassword as verifyPasswordPBKDF2,
} from '../../lib/jwt';

export async function hashPassword(password: string): Promise<string> {
  return hashPasswordPBKDF2(password);
}

export async function verifyPassword(password: string, hash: string): Promise<boolean> {
  if (!hash) return false;
  return verifyPasswordPBKDF2(password, hash);
}

export function generateToken(): string {
  return crypto.randomUUID().replace(/-/g, '') + crypto.randomUUID().replace(/-/g, '');
}
