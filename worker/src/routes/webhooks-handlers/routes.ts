import { Hono } from 'hono';
import type { Env } from '../../types/env';
import { registerPayosWebhook } from './payos';

export const webhookRouter = new Hono<{ Bindings: Env }>();

registerPayosWebhook(webhookRouter);

export default webhookRouter;
