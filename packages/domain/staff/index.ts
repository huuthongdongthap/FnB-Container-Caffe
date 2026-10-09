// @aura/domain-staff — Staff bounded context
// lib (pure domain)
export type { StaffRole } from './lib/staff-roles';
export { STAFF_ROLES, ROLE_LABELS, ROLE_PERMISSIONS, hasPermission, visibleRolesFor } from './lib/staff-roles';
// model
export type { StaffTipRow } from './model/staff-types';
export type {
  RoleType,
  ResourceType,
  ActionType,
  ActorContext,
  ResourceContext,
  AuthorizationDecision,
} from './src/model/authorization-types';
// commands
export { staffMobileLogin, staffTokenRefresh, registerStaffDevice, revokeStaffDevice, listStaffDevices } from './commands/staff-auth';
export { staffTipsRouter } from './commands/staff-tips';
// policies
export {
  isHQSuperAdmin,
  validateOperatingUnitScope,
  authorizeAction,
} from './src/policies/authorization-policy';
