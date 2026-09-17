/**
 * DinDin / AURA CAFE menu-ordering Admin Routes
 * Re-exported from modular dindin-handlers/
 * - types.ts: Shared types, error codes, helpers, schemas
 * - config-handlers.ts: GET/PUT /config (menu settings)
 * - cart-handlers.ts: GET/PATCH /cart/:sessionId (cart operations)
 * - checkout-handlers.ts: POST /checkout (order creation)
 */

import { dindinRouter } from './dindin-handlers';

export { dindinRouter } from './dindin-handlers';
export {
  dindinCheckoutSchema,
  err,
  errorResponse,
  type DinDinErrorCode,
  type DinDinError,
  type Cart,
} from './dindin-handlers';
export default dindinRouter;