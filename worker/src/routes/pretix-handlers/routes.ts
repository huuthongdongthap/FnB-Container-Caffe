import { Hono } from 'hono';
import { registerWebhookHandler } from './webhook-handler';
import { registerEventHandlers } from './event-handlers';
import { registerCheckinHandler } from './checkin-handler';
import { registerGenerateHandler } from './generate-handler';

export const pretixRouter = new Hono();

registerWebhookHandler(pretixRouter);
registerEventHandlers(pretixRouter);
registerCheckinHandler(pretixRouter);
registerGenerateHandler(pretixRouter);