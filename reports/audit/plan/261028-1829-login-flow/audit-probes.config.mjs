import base from '../../../../vitest.config.ts';

// Audit-only configuration; product test discovery is unchanged.
export default {
  ...base,
  test: {
    ...base.test,
    include: ['reports/audit/plan/261028-1829-login-flow/evidence/*.audit.test.{ts,tsx}'],
  },
};
