/**
 * Push notification role vocabulary.
 *
 * The subscribe path stores whatever role the client declares, and the send
 * paths query push_subscriptions with an exact-match role literal. Those two
 * strings are written in different files: when they drift, the query runs,
 * matches nothing, and returns `{ sent: 0, failed: 0 }` — no error, no log
 * line, no visible failure. One constant shared by both sides removes that
 * class of drift.
 */

/** Role a KDS/staff device subscribes with and the new-order send queries by. */
export const STAFF_PUSH_ROLE = 'staff-kitchen';

/** Role stored when a caller declares none, so the row still reads as staff. */
export const DEFAULT_STAFF_PUSH_ROLE = 'staff';

/** Roles that must never receive a staff-targeted send. */
export const CUSTOMER_PUSH_ROLE = 'customer';
