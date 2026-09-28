/**
 * ERPNext Client — Compatibility Barrel
 *
 * Re-exports from the modularized `erpnext/client` domain modules.
 * Retained so existing import paths keep resolving; remove only after
 * verifying zero consumers remain.
 */

export * from '../erpnext/client';

import clientDefault from '../erpnext/client';

export default clientDefault;
