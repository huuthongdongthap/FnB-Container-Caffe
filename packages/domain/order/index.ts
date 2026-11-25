// @aura/domain-order — Order bounded context
// model
export { ORDER_STATUSES, ORDER_TRANSITIONS, TERMINAL_STATES, canTransition, isTerminal, isFinal } from './model/order-state-machine';
export type { OrderStatus, TransitionResult } from './model/order-state-machine';
export { generateId, generateOrderNumber, sanitizeOrderNotes, parseJSON } from './model/helpers';
// commands
export { createOrder } from './commands/create-order';
export { formatKdsPushOriginLabel } from './commands/create-order-side-effects';
export { updateOrder } from './commands/update-order';
export { splitOrders } from './commands/split-orders';
// queries
export { getOrder } from './queries/get-order';
export { getAdminOrders } from './queries/admin-orders';
export { getStats } from './queries/stats';
export { buildOrderFilterClause, buildOrderTail } from './queries/shared-listing';
export type { OrderSortColumn, OrderListOptions } from './queries/shared-listing';
export { getLatestOrderTimestamp } from './queries/latest-timestamp';
// policies
export {
  dispatchOrderBroadcast,
  fanOutOrderBroadcast,
  resolveOrderBroadcastChannels,
  parseBroadcastItems,
  parseBroadcastTimestamp,
  normalizeBroadcastTotal,
} from './policies/order-broadcast';
export type { OrderBroadcasterNamespaceLike, OrderBroadcasterStubLike } from './policies/order-broadcast';
export { creditLoyaltyIfEligible } from './policies/loyalty-trigger';
export { restoreLoyaltyVoucherForOrder } from './loyalty-voucher';
export { releaseTableIfNoActiveOrders } from './policies/table-occupancy-release';
export { compensateVoidedOrder, adjustShiftCustodyForCashRefund } from './policies/order-rollback';
export type { CompensateVoidedOrderParams, CashRefundShiftAdjustmentParams } from './policies/order-rollback';
export { calculateOrderSnapshot } from './policies/order-snapshot';
export { VOID_STATUSES, isVoidStatus } from './policies/order-status-transition';
export { canActorTransition, toActorRole } from './policies/transition-authorization';
export type { ActorRole } from './policies/transition-authorization';
export {
  canAccessOrder,
  generateOrderToken,
  hashOrderToken,
  verifyGuestOrderToken,
  projectCustomerOrderPayload,
  publishOrderEvent,
} from './policies/customer-order-payload';
export type {
  CustomerOrderItemPayload,
  CustomerOrderPayload,
} from './policies/customer-order-payload';
export type {
  RawOrderItemInput,
  EvaluatedOrderItem,
  OrderSnapshotInput,
  OrderSnapshotRejection,
  OrderSnapshotResult,
} from './policies/order-snapshot';
// notifications
export { notifyOrderStatus } from './notifications/notify-order-status';
export { notifyTelegram } from './notifications/telegram';
