import { describe, it } from 'vitest';
import { listStaffDevices } from '../../routes/staff-auth';

function mkDb(allResult) {
  let capturedSql = '';
  return {
    prepare: (_sql) => {
      capturedSql = _sql;
      return {
        all: async () => {
          console.log('[diag.sql]', capturedSql);
          return allResult;
        },
      };
    },
  };
}

function mkCtx(role, userId) {
  return {
    req: {},
    env: {},
    get: (k) => k === 'user' ? { id: userId, role } : undefined,
    json: (d, s = 200) => new Response(JSON.stringify(d), { status: s }),
  };
}

describe('diag listStaffDevices SQL', () => {
  it('owner sql', async () => {
    const res = await listStaffDevices(mkCtx('owner', 'USR_1'));
    const body = await res.json();
    console.log('[diag.owner]', body);
  });
  it('staff sql', async () => {
    const db = mkDb({ results: [{ id: 'DEV_2', staff_id: 'USR_2' }], success: true });
    const ctx = mkCtx('staff', 'USR_2');
    ctx.env = { AURA_DB: db };
    const res = await listStaffDevices(ctx);
    const body = await res.json();
    console.log('[diag.staff]', body);
  });
});
