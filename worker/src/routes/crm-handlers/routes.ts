import { Hono } from 'hono';
import type { Env } from '../../types/env';
import { registerCustomerHandlers } from './customer-handlers';
import { registerAccountHandlers } from './account-handlers';
import { registerOrderHandlers } from './order-handlers';
import { registerSegmentHandlers } from './segment-handlers';

export const crmRouter = new Hono<{ Bindings: Env }>();

registerCustomerHandlers(crmRouter);
registerAccountHandlers(crmRouter);
registerOrderHandlers(crmRouter);
registerSegmentHandlers(crmRouter);

export default crmRouter;
