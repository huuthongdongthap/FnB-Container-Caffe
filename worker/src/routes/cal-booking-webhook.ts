/**
 * Cal.com Booking Webhook Routes — /api/cal-booking-webhook barrel re-export
 * Split into worker/src/routes/cal-booking-webhook-handlers/
 * - types.ts: CalBookingPayload, BookingRecord, calBookingPayloadSchema
 * - webhook-handler.ts: POST /webhook handler, handleCalBookingWebhook for cron/test
 * - bookings-handler.ts: GET /bookings list endpoint
 * - routes.ts: Router setup
 * - index.ts: Barrel export
 */

import { calBookingWebhookRouter } from './cal-booking-webhook-handlers';

export { calBookingWebhookRouter } from './cal-booking-webhook-handlers';
export { registerWebhookHandler, handleCalBookingWebhook } from './cal-booking-webhook-handlers';
export { registerBookingsHandler } from './cal-booking-webhook-handlers';
export type { CalBookingPayload, BookingRecord } from './cal-booking-webhook-handlers';
export { calBookingPayloadSchema } from './cal-booking-webhook-handlers';

export default calBookingWebhookRouter;