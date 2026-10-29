// @aura/domain-sop — Staff SOP digitization bounded context
// model
export type {
  SopSource,
  SopShiftType,
  SopViolationCategory,
  SopDisciplineStep,
  SopTemplate,
  SopTemplateItem,
  SopRun,
  SopRunItem,
  SopViolation,
} from './model/sop-types';
export type { SopRunStatus, SopViolationStatus } from './src/model/sop-state';
// D1 row mapping — the only place that knows the snake_case column spelling
export {
  toTemplate,
  toRun,
  toViolation,
  toReminder,
} from './src/model/sop-row-mapper';
export type {
  SopTemplateRow,
  SopTemplateItemRow,
  SopRunRow,
  SopRunItemRow,
  SopViolationRow,
} from './src/model/sop-row-mapper';
// commands
export {
  SOP_ROLES,
  SOP_VIOLATION_ROLES,
  SopAccessError,
  sopScope,
  assertActorOrManager,
  businessDate,
  storeHour,
  assertId,
  type SopScope,
} from './commands/sop-access';
export {
  findRun,
  toRunListRow,
  listRunsForStaffDay,
} from './commands/sop-read-repository';
export {
  listTemplates,
  listAllTemplates,
  findTemplate,
  findTemplateByCode,
} from './commands/sop-template-reads';
export { listViolations, countConfirmedInMonth } from './commands/sop-violation-reads';
export {
  listReminders,
  countOpenReminders,
  acknowledgeReminder,
} from './commands/sop-reminder-reads';
export { startRunForStaff, type StartRunRequest } from './commands/sop-write-repository';
export {
  findOpenShift,
  linkOpenShift,
  linkRunToOpenShift,
  type OpenShift,
  type SopRunShift,
} from './commands/sop-open-shift';
export {
  setItemChecked,
  completeRunForStaff,
  abandonRunForStaff,
} from './commands/sop-run-mutations';
export { findViolation, recordViolation, type RecordViolationInput } from './commands/sop-violation-repository';
export {
  confirmViolation,
  applyViolation,
  appealViolation,
  appealOwnViolation,
  closeViolation,
  type ApplyViolationInput,
} from './commands/sop-violation-ladder';
export {
  createTemplate,
  updateTemplate,
  type CreateTemplateInput,
  type TemplateItemInput,
} from './commands/sop-template-repository';
// state guards
export {
  isRunTerminal,
  isViolationTerminal,
  canTransitionRun,
  canTransitionViolation,
} from './src/model/sop-state';
// policies
export {
  isTemplateExecutable,
  startRun,
  checkItem,
  blockingCriticalItems,
  completeRun,
  abandonRun,
  computeProgress,
} from './src/policies/checklist-lifecycle-policy';
export type { StartRunInput, CheckItemInput, CompleteRunInput, AbandonRunInput } from './src/policies/checklist-lifecycle-policy';
// Policies are pure; the `*Policy` suffix keeps them distinguishable from the
// repository functions of the same name, which are the ones routes call.
export {
  nextDisciplineStep,
  canApplyAction,
  escalationLevel,
  isSeriousCategory,
  applySanction as applySanctionPolicy,
  appealViolation as appealViolationPolicy,
  closeViolation as closeViolationPolicy,
} from './src/policies/violation-policy';
export type { DisciplineInput, AuthorityInput, ApplySanctionInput, ViolationAction } from './src/policies/violation-policy';
export {
  SHIFT_BOUNDARIES,
  isDeepCleanDay,
  isAuditDay,
  nextDeepClean,
  nextAudit,
  deriveShiftType,
  sopForShift,
  isOverdue,
} from './src/policies/recurrence-policy';
export type { TemplateMatch, TemplateMatchInput } from './src/policies/recurrence-policy';
