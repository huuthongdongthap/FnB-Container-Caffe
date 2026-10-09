// @aura/domain-audit — Canonical Audit Trail & Operational Event Bounded Context
export type {
  AuditOutcome,
  AuditFailurePolicy,
  AuditActor,
  AuditDiff,
  AuditPayload,
  CanonicalAuditRecord,
} from './src/model/audit-types';

export {
  redactSensitiveValue,
  redactSensitiveData,
} from './src/policies/audit-redaction-policy';

export {
  calculateSafeDiff,
  buildCanonicalAuditRecord,
  writeCanonicalAuditLog,
  recordAuthorizationFailure,
} from './src/policies/audit-writer-policy';
