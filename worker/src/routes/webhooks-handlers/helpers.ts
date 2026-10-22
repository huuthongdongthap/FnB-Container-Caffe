import { createLogger } from '../../middleware/logger';

export const log = createLogger({ route: 'webhooks' });

export { verifyPayOSSignature as verifySignature } from '../../../../packages/domain/payment/policies/payos-signature';
