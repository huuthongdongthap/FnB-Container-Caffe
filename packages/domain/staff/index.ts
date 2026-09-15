// @aura/domain-staff — Staff bounded context
// lib (pure domain)
export type { StaffRole } from './lib/staff-roles';
export { STAFF_ROLES, ROLE_LABELS, ROLE_PERMISSIONS, hasPermission, visibleRolesFor } from './lib/staff-roles';
// model
export type { StaffTipRow } from './model/staff-types';
// commands
export { staffMobileLogin, staffTokenRefresh, registerStaffDevice, revokeStaffDevice, listStaffDevices } from './commands/staff-auth';
export { staffTipsRouter } from './commands/staff-tips';
