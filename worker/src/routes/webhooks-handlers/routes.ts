import { Hono } from 'hono';
import type { Env } from '../../types/env';
import { momoWebhook } from '../webhooks/momo';
import { registerPayosWebhook } from './payos';

export const webhookRouter = new Hono<{ Bindings: Env }>();

registerPayosWebhook(webhookRouter);
momoWebhook(webhookRouter);

export default webhookRouter;
