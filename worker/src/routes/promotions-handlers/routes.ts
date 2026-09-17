import { Hono } from 'hono';
import type { Env } from '../../types/env';
import { registerPromotionAdminHandlers } from './admin-handlers';
import { registerPromotionValidationHandlers } from './validation-handlers';

export const promotionsRouter = new Hono<{ Bindings: Env }>();

registerPromotionAdminHandlers(promotionsRouter);
registerPromotionValidationHandlers(promotionsRouter);

export default promotionsRouter;
