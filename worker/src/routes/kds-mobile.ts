/**
 * Re-export shim — kitchen domain lives in @aura/domain-kitchen.
 *
 * Old route path stays live and deployable until M2 migrates callers
 * one by one. Do not add new logic here.
 */
export { getKdsMobile, updateKdsStatus } from '@aura/domain-kitchen';
