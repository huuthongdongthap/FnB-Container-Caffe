import type { D1Database, D1PreparedStatement } from '@cloudflare/workers-types';

type Resource = 'customer' | 'recruitment';
export class ResourceCreationError extends Error {
  constructor(readonly status: 400 | 409 | 503, readonly code: string, message: string) { super(message); }
}
export interface CreationIntent {
  id: string; scopeKey: string; fingerprint: string; resource: Resource; tenantId: string; actorId: string;
}
async function hash(value: unknown): Promise<string> {
  const bytes = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(JSON.stringify(value)));
  return Array.from(new Uint8Array(bytes), byte => byte.toString(16).padStart(2, '0')).join('');
}

/** New UI retries reuse a key. Legacy callers without one receive a fresh request. */
export async function prepareResourceCreation(request: Request, input: {
  resource: Resource; tenantId: string; actorId: string; payload: unknown;
}): Promise<CreationIntent> {
  const supplied = request.headers.get('Idempotency-Key');
  if (supplied !== null && !/^[A-Za-z0-9_-]{8,200}$/.test(supplied)) {
    throw new ResourceCreationError(400, 'INVALID_IDEMPOTENCY_KEY', 'Invalid submission key');
  }
  const scopeKey = await hash([input.resource, input.tenantId, input.actorId, supplied ?? crypto.randomUUID()]);
  return { ...input, scopeKey, fingerprint: await hash(input.payload),
    id: `${input.resource === 'customer' ? 'c' : 'APP'}_${scopeKey}` };
}

/** Immediately follows the claim INSERT in the same batch; a replay cannot resurrect a deleted entity. */
export function creationInsertGuard(intent: CreationIntent): { sql: string; binds: string[] } {
  return { sql: `changes() = 1 AND EXISTS (SELECT 1 FROM resource_creation_requests
    WHERE scope_key = ? AND request_hash = ? AND resource_id = ?)`,
  binds: [intent.scopeKey, intent.fingerprint, intent.id] };
}

export async function commitResourceCreation(db: D1Database, intent: CreationIntent, insert: D1PreparedStatement) {
  try {
    const results = await db.batch([
      db.prepare(`INSERT INTO resource_creation_requests
        (scope_key, request_hash, resource_id, resource_type, tenant_id, actor_id)
        VALUES (?, ?, ?, ?, ?, ?) ON CONFLICT(scope_key) DO NOTHING`)
        .bind(intent.scopeKey, intent.fingerprint, intent.id, intent.resource, intent.tenantId, intent.actorId),
      insert,
    ]);
    if (results.length !== 2 || results.some(result => !result.success)) throw new Error('Creation batch failed');
    const claim = await db.prepare('SELECT request_hash, resource_id FROM resource_creation_requests WHERE scope_key = ?')
      .bind(intent.scopeKey).first<{ request_hash: string; resource_id: string }>();
    if (!claim) throw new Error('Missing durable submission');
    if (claim.request_hash !== intent.fingerprint || claim.resource_id !== intent.id) {
      throw new ResourceCreationError(409, 'IDEMPOTENCY_CONFLICT', 'Submission key was already used for different data');
    }
    const table = intent.resource === 'customer' ? 'customers' : 'recruitment_applications';
    const row = await db.prepare(`SELECT id FROM ${table} WHERE id = ? AND tenant_id = ?`)
      .bind(intent.id, intent.tenantId).first();
    if (!row) throw new ResourceCreationError(409, 'RESOURCE_REMOVED', 'The submitted record is no longer available');
    return { id: intent.id, replayed: (results[0].meta?.changes ?? 0) === 0 };
  } catch (error) {
    if (error instanceof ResourceCreationError) throw error;
    throw new ResourceCreationError(503, 'RESOURCE_STATE_UNAVAILABLE', 'Cannot confirm that the record was saved');
  }
}

export function resourceCreationErrorResponse(error: unknown): Response | null {
  return error instanceof ResourceCreationError
    ? Response.json({ success: false, error: error.message, code: error.code }, { status: error.status }) : null;
}
