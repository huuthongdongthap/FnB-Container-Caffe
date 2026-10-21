/**
 * Customer-facing "tracking is over" set for the order-tracking poll loop.
 *
 * Deliberately NOT the backend lifecycle terminal set (see
 * `packages/domain/order/model/order-state-machine.ts` `isTerminal`): the two
 * answer different questions.
 *
 * - Backend `isTerminal` = no further lifecycle movement (completed, cancelled,
 *   failed, expired).
 * - This set = the customer has nothing left to wait for, so the fallback poller
 *   and the SSE-driven poll-stop should stand down.
 *
 * `delivered` belongs here and not to the backend set: once an order reaches the
 * customer the tracking view has shown everything, even though the backend may
 * still move it to `completed` for reporting. `failed`/`expired` are omitted
 * because no code path writes them to `orders.status` today.
 */
export const TERMINAL_STATUSES = ['delivered', 'cancelled', 'completed'];

export const POLL_INTERVAL = 15_000;
