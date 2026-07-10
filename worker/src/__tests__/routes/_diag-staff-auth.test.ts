import { describe, it } from 'vitest';
import { staffMobileLogin } from '../../routes/staff-auth';

function mkDb() {
  const rowsByToken = new Map<string, any>();
  rowsByToken.set('tok_known', {
    id: 'DEV_1', staff_id: 'USR_1', device_token: 'tok_known',
    pin_hash: 'pin$pbkdf2$100000$dGVzdA==$dGVzdA==', role: 'owner',
  });
  return {
    prepare: (_sql: string) => {
      const stmt: any = { _sql: '', _binds: [] as unknown[] };
      stmt.bind = (...args: unknown[]) => { stmt._binds = args; return stmt; };
      stmt.first = async () => {
        console.log('[diag] first() _binds=', JSON.stringify(stmt._binds));
        const firstArg = stmt._binds[0];
        if (firstArg === undefined) return null;
        return rowsByToken.get(String(firstArg)) ?? null;
      };
      stmt.all = async () => ({ results: [], success: true });
      stmt.run = async () => ({ success: true, changes: 1 });
      return stmt;
    },
  };
}

function mkCtx(body: any) {
  const req = new Request('https://t.test/m', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  return {
    req,
    env: {
      AURA_DB: mkDb(),
      AUTH_KV: {},
      JWT_SECRET: 'secretsigningsecret123456789012345678901234567890!!!',
      JWT_EXPIRY_SECONDS: '3600',
    },
    get: (k: string) => (k === 'user' ? { id: 'USR_1', role: 'owner', email: 'o@t.co', name: 'O' } : undefined),
    set: () => {},
    json: (data: unknown, status = 200) => {
      console.log('[diag] jsonResponse status=', status, 'data=', JSON.stringify(data));
      return new Response(JSON.stringify(data), { status, headers: { 'Content-Type': 'application/json' } });
    },
  };
}

it('diag 1: unknown token', async () => {
  let caught: any = null;
  try {
    const res = await staffMobileLogin(mkCtx({ device_token: 'tok_unknown', pin: '1234' }));
    console.log('[diag] RESULT status=', res.status);
  } catch (e) {
    caught = e;
    console.log('[diag] THREW:', e);
  }
  if (!caught) console.log('[diag] no throw — handler returned normally');
});

it('diag 2: known token bad PIN', async () => {
  let caught: any = null;
  try {
    const res = await staffMobileLogin(mkCtx({ device_token: 'tok_known', pin: '0000' }));
    console.log('[diag] RESULT status=', res.status);
  } catch (e) {
    caught = e;
    console.log('[diag] THREW:', e);
  }
  if (!caught) console.log('[diag] no throw — handler returned normally');
});
