import type { OpenAPIHono } from '@hono/zod-openapi';
import type { Env } from '../../types/env';
import { PaymentRoutes } from '../../schemas/payments';
import { handlePayosWebhook } from '../webhooks-handlers/payos';

export function registerPaymentWebhookHandlers(router: OpenAPIHono<{ Bindings: Env }>): void {
  router.openapi(PaymentRoutes.webhook.payos as any, (c: any) => handlePayosWebhook(c, true));
}
