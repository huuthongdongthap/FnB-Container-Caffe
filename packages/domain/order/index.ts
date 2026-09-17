// @aura/domain-order — Order bounded context
// model
export { ORDER_STATUSES, ORDER_TRANSITIONS, TERMINAL_STATES, canTransition, isTerminal, isFinal } from './model/order-state-machine';
export type { OrderStatus, TransitionResult } from './model/order-state-machine';
export { generateId, parseJSON } from './model/helpers';
// commands
export { createOrder } from './commands/create-order';
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
export { creditLoyaltyIfEligible } from './policies/loyalty-trigger';
// notifications
export { notifyOrderStatus } from './notifications/notify-order-status';
export { notifyTelegram } from './notifications/telegram';
