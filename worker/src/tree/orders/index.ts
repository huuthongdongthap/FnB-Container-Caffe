/**
 * Re-export shim — order domain lives in @aura/domain-order.
 *
 * Old tree/ path stays live and deployable until M2 migrates callers
 * one by one. Do not add new logic here.
 */
export {
  createOrder,
  updateOrder,
  splitOrders,
  getOrder,
  getAdminOrders,
  getStats,
  buildOrderFilterClause,
  buildOrderTail,
  getLatestOrderTimestamp,
  creditLoyaltyIfEligible,
  notifyOrderStatus,
  notifyTelegram,
  ORDER_TRANSITIONS,
  TERMINAL_STATES,
  canTransition,
  isTerminal,
  isFinal,
  generateId,
  parseJSON,
} from '@aura/domain-order';
export type {
  OrderStatus,
  TransitionResult,
  OrderSortColumn,
  OrderListOptions,
} from '@aura/domain-order';
