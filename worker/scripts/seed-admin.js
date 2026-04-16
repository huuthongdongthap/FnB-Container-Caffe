/**
 * Seed Admin Script
 * Run once via: node worker/scripts/seed-admin.js
 * Or manually PUT into AUTH_KV via Wrangler CLI:
 *   wrangler kv:key put --namespace-id=<AUTH_KV_ID> "user:admin@auraspace.vn" '<json>'
 *
 * This script outputs the JSON value to paste into KV.
 */

async function hashPassword(password) {
  const encoder = new TextEncoder();
  const data = encoder.encode(password);
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
}

async function main() {
  const email = 'admin@auraspace.vn';
  const password = 'AuraAdmin2026!';
  const hashed = await hashPassword(password);

  const adminUser = {
    id: 'USR_OWNER_001',
    email,
    name: 'AURA Owner',
    phone: '0901234567',
    password: hashed,
    role: 'owner',
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  };

  console.log('╔═══════════════════════════════════════════╗');
  console.log('║   AURA SPACE — Seed Admin Account         ║');
  console.log('╠═══════════════════════════════════════════╣');
  console.log(`║  Email:    ${email}`);
  console.log(`║  Password: ${password}`);
  console.log(`║  Role:     owner`);
  console.log('╠═══════════════════════════════════════════╣');
  console.log('║  Run this command to seed AUTH_KV:         ║');
  console.log('╚═══════════════════════════════════════════╝');
  console.log('');
  console.log(`wrangler kv:key put --namespace-id=789e7cf1894e4d4c9e8f8cd51b2dbe16 "user:${email}" '${JSON.stringify(adminUser)}'`);
  console.log('');
}

main().catch(console.error);
