/**
 * Re-export shim — payment domain lives in @aura/domain-payment.
 *
 * Old route path stays live and deployable until M2 migrates callers
 * one by one. Do not add new logic here.
 */
export { paymentRouter } from '@aura/domain-payment';
