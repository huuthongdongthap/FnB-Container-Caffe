import { Hono } from 'hono';
import type { Env } from '../../types/env';
import { registerWebhookHandler } from './webhook-handler';
import { registerBookingsHandler } from './bookings-handler';

export const calBookingWebhookRouter = new Hono<{ Bindings: Env }>();

registerWebhookHandler(calBookingWebhookRouter);
registerBookingsHandler(calBookingWebhookRouter);