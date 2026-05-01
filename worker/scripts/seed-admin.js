/**
 * Seed Admin Script
 * Run once via: node worker/scripts/seed-admin.js
 *
 * IMPORTANT: Set these env vars before running:
 *   ADMIN_EMAIL, ADMIN_PASSWORD, KV_NAMESPACE_ID
 *
 * Or manually PUT into AUTH_KV via Wrangler CLI:
 *   wrangler kv:key put --namespace-id=<AUTH_KV_ID> "user:<email>" '<json>'
 */

async function hashPassword(password) {
  const encoder = new TextEncoder();
  const data = encoder.encode(password);
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
}

async function main() {
  const email = process.env.ADMIN_EMAIL;
  const password = process.env.ADMIN_PASSWORD;
  const kvNamespaceId = process.env.KV_NAMESPACE_ID;

  if (!email || !password || !kvNamespaceId) {
    console.error('ERROR: Set ADMIN_EMAIL, ADMIN_PASSWORD, KV_NAMESPACE_ID env vars first.');
    console.error('Example:');
    console.error('  ADMIN_EMAIL=admin@auraspace.vn ADMIN_PASSWORD=YourSecurePass123! KV_NAMESPACE_ID=abc123 node worker/scripts/seed-admin.js');
    process.exit(1);
  }

  const hashed = await hashPassword(password);

  const adminUser = {
    id: 'USR_OWNER_001',
    email,
    name: 'AURA Owner',
    phone: '',
    password: hashed,
    role: 'owner',
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  };

  console.log('AURA · CAFE — Seed Admin Account');
  console.log(`Email: ${email}`);
  console.log(`Role:  owner`);
  console.log('');
  console.log('Run this command to seed AUTH_KV:');
  console.log(`wrangler kv:key put --namespace-id=${kvNamespaceId} "user:${email}" '${JSON.stringify(adminUser)}'`);
  console.log('');
}

main().catch(console.error);
