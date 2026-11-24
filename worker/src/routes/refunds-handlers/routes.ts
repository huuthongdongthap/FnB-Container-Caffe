import { Hono } from 'hono';
import type { Env } from '../../types/env';
import { registerRefundMutationHandlers } from './mutation-handlers';
import { registerRefundReadHandlers } from './read-handlers';
import { registerRefundReadinessHandlers } from './readiness-handlers';

export const refundRouter = new Hono<{ Bindings: Env }>();

registerRefundMutationHandlers(refundRouter);
registerRefundReadHandlers(refundRouter);
registerRefundReadinessHandlers(refundRouter);

export default refundRouter;
