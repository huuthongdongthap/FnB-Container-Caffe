/** Public store binding is deployment configuration, never a request parameter. */
export class PilotStoreError extends Error {
  readonly status = 503;
  readonly code = 'PILOT_STORE_UNAVAILABLE';
  constructor() { super('Store configuration is unavailable'); }
}

export function resolvePilotStore(env: { [key: string]: unknown }): string {
  const rawValue = env.PILOT_TENANT_ID;
  const value = typeof rawValue === 'string' ? rawValue.trim() : rawValue;
  const production = env.ENVIRONMENT === 'production' || env.NODE_ENV === 'production';
  if ((value === undefined || value === '') && !production) return 'default';
  if (typeof value !== 'string' || !/^[a-zA-Z0-9][a-zA-Z0-9_-]{0,99}$/.test(value)
    || value === 'hq') throw new PilotStoreError();
  return value;
}

export function pilotStoreErrorResponse(error: unknown): Response | null {
  return error instanceof PilotStoreError
    ? Response.json({ success: false, error: error.message, code: error.code }, { status: error.status }) : null;
}
