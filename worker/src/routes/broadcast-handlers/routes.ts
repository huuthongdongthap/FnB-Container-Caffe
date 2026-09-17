import { Hono } from 'hono';
import type { Env } from '../../types/env';
import { registerSendHandler } from './send-handler';

export const broadcastRouter = new Hono<{ Bindings: Env }>();

registerSendHandler(broadcastRouter);

export default broadcastRouter;
