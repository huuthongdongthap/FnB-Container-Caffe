import { createRequire, builtinModules } from 'node:module';
import { mkdtemp, readFile, writeFile } from 'node:fs/promises';
import { existsSync, readdirSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { pbkdf2Sync, createHmac } from 'node:crypto';

const require = createRequire(import.meta.url);
export const ROOT = path.resolve(import.meta.dirname, '../..');
// Reuse an installed stable runtime; never install dependencies or select an alpha implicitly.
const runtimeCandidates = [path.join(ROOT, 'node_modules/miniflare')];
for (const parent of [ROOT, path.dirname(ROOT)]) {
  const store = path.join(parent, 'node_modules/.pnpm');
  if (existsSync(store)) for (const name of readdirSync(store).filter(name => /^miniflare@4\./.test(name)).sort().reverse()) {
    runtimeCandidates.push(path.join(store, name, 'node_modules/miniflare'));
  }
}
const runtimePath = runtimeCandidates.find(candidate => {
  try { return /^4\./.test(require(path.join(candidate, 'package.json')).version); } catch { return false; }
});
if (!runtimePath) throw new Error('An installed stable Miniflare 4 runtime is required for offline flow tests');
const { Miniflare, Log, LogLevel } = require(runtimePath);
const { build } = require('esbuild');
export const REVIEW_PASSWORD = 'Local-review-only-123!';
export const CHECKSUM = 'local-review-checksum-not-a-real-secret';

export async function createLocalRuntime() {
  const scratch = await mkdtemp(path.join(tmpdir(), 'aura-local-review-'));
  const bundle = path.join(scratch, 'worker.mjs');
  // Fixture endpoints exist only in this temporary local bundle, never in product source.
  const entry = `
    import worker, { OrderBroadcaster } from ${JSON.stringify(path.join(ROOT, 'worker/src/index.ts'))};
    export { OrderBroadcaster };
    export default { ...worker, async fetch(request, env, ctx) {
      const pathname = new URL(request.url).pathname;
      if (pathname.startsWith('/__local_review/') && request.headers.get('x-local-review') === 'fixture-only') {
        try {
          const body = await request.json();
          if (pathname.endsWith('/kv')) { await env.AUTH_KV.put(body.key, body.value); return Response.json({ok:true}); }
          if (body.op === 'batch') return Response.json(await env.AURA_DB.batch(body.statements.map(sql => env.AURA_DB.prepare(sql))));
          const statement = env.AURA_DB.prepare(body.sql).bind(...(body.binds || []));
          return Response.json(await statement[body.op]());
        } catch (error) { return Response.json({error:String(error)}, {status:500}); }
      }
      return worker.fetch(request, env, ctx);
    } };
  `;
  await build({
    absWorkingDir: ROOT,
    stdin: { contents: entry, sourcefile: 'local-review-entry.ts', resolveDir: ROOT, loader: 'ts' },
    tsconfig: 'worker/tsconfig.json',
    bundle: true,
    format: 'esm',
    platform: 'node',
    target: 'es2022',
    conditions: ['workerd', 'worker', 'browser'],
    plugins: [{ name: 'local-review-node-compat', setup(builder) {
      builder.onResolve({ filter: /^(node:)?[a-z][a-z0-9_/-]*$/ }, args => {
        const name = args.path.replace(/^node:/, '');
        if (['os', 'fs', 'fs/promises', 'tty', 'http', 'https', 'net', 'tls'].includes(name)) return { path: require.resolve(`unenv/node/${name}`) };
        if (builtinModules.includes(name)) return { path: `node:${name}`, external: true };
      });
    } }],
    external: ['cloudflare:*'],
    outfile: bundle,
    logLevel: 'warning',
  });
  const bundled = await readFile(bundle, 'utf8');
  const required = [...new Set([...bundled.matchAll(/__require\("([^"]+)"\)/g)].map(m => m[1]))];
  const imports = required.map((specifier, i) => `import * as b${i} from ${JSON.stringify(specifier.startsWith('node:') ? specifier : `node:${specifier}`)};`);
  const cases = required.map((specifier, i) => `case ${JSON.stringify(specifier)}: return b${i}.default ?? Object.assign({}, b${i});`);
  await writeFile(bundle, `${imports.join('\n')}\nconst require=(s)=>{switch(s){${cases.join('')}default:throw new Error('Blocked dynamic module: '+s)}};\n${bundled}`);

  const providerRequests = [];
  const deniedNetwork = [];
  let providerDelayMs = 0;
  const providerLinks = new Map();
  const envelope = data => ({ code: '00', desc: 'local provider fixture', data,
    signature: createHmac('sha256', CHECKSUM).update(Object.keys(data).sort().map(key => `${key}=${Array.isArray(data[key]) ? JSON.stringify(data[key]) : data[key] ?? ''}`).join('&')).digest('hex') });
  const options = {
    modules: true,
    rootPath: scratch,
    modulesRoot: scratch,
    scriptPath: bundle,
    compatibilityDate: '2025-01-01',
    compatibilityFlags: ['nodejs_compat'],
    host: '127.0.0.1',
    port: 8797,
    cf: false,
    log: new Log(LogLevel.ERROR),
    d1Databases: { AURA_DB: 'review-db' },
    kvNamespaces: { AUTH_KV: 'review-kv' },
    durableObjects: { ORDER_BROADCASTER: 'OrderBroadcaster' },
    bindings: {
      ENVIRONMENT: 'development',
      JWT_SECRET: 'local-review-jwt-not-a-real-secret',
      PAYOS_CLIENT_ID: 'local-review-client',
      PAYOS_API_KEY: 'local-review-api-key',
      PAYOS_CHECKSUM_KEY: CHECKSUM,
      FE_BASE_URL: 'http://127.0.0.1:5197',
      CORS_ORIGIN: 'http://127.0.0.1:5197',
    },
    outboundService: async (request) => {
      const url = new URL(request.url);
      if (url.hostname === 'api-merchant.payos.vn' && url.pathname === '/v2/payment-requests' && request.method === 'POST') {
        const payload = await request.json();
        providerRequests.push({ kind: 'create', ...payload });
        const data = { orderCode: payload.orderCode, amount: payload.amount, status: 'PENDING',
          checkoutUrl: `https://pay.payos.vn/web/local-${payload.orderCode}`,
          paymentLinkId: `local-${payload.orderCode}`, qrCode: 'local-fixture' };
        providerLinks.set(String(payload.orderCode), data);
        if (providerDelayMs) await new Promise(resolve => setTimeout(resolve, providerDelayMs));
        return Response.json(envelope(data));
      }
      if (url.hostname === 'api-merchant.payos.vn' && /^\/v2\/payment-requests\/\d+$/.test(url.pathname) && request.method === 'GET') {
        const code = url.pathname.split('/').at(-1);
        providerRequests.push({ kind: 'lookup', orderCode: code });
        const data = providerLinks.get(code);
        return data ? Response.json(envelope({ id: data.paymentLinkId, orderCode: data.orderCode,
          amount: data.amount, status: data.status, transactions: [] })) : Response.json({ code: 'not-found' }, { status: 404 });
      }
      if (url.hostname === 'api-merchant.payos.vn' && /\/v2\/payment-requests\/[^/]+\/refund$/.test(url.pathname) && request.method === 'POST') {
        providerRequests.push({ kind: 'refund', ...await request.json() });
        return Response.json({ code: '00', data: { id: 'local-refund' } });
      }
      deniedNetwork.push({ method: request.method, host: url.hostname, path: url.pathname });
      return new Response('External network blocked by local review harness', { status: 502 });
    },
  };
  const mf = new Miniflare(options);
  try {
    const url = (await mf.ready).origin;
    const fixtureCall = async (route, body) => {
      const response = await fetch(`${url}/__local_review/${route}`, {
        method: 'POST', headers: { 'content-type': 'application/json', Connection: 'close', 'x-local-review': 'fixture-only' },
        body: JSON.stringify(body), signal: AbortSignal.timeout(20000),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(JSON.stringify(result));
      return result;
    };
    const db = {
      prepare(sql) { let binds = []; const statement = {
        bind(...values) { binds = values; return statement; },
        run: () => fixtureCall('db', { op: 'run', sql, binds }),
        first: () => fixtureCall('db', { op: 'first', sql, binds }),
        all: () => fixtureCall('db', { op: 'all', sql, binds }),
      }; return statement; },
      exec(sql) {
        let buffer = '', trigger = false; const statements = [];
        for (const line of sql.split('\n')) {
          if (line.trim().startsWith('--') || !line.trim()) continue;
          buffer += `${line}\n`;
          if (/^CREATE TRIGGER/i.test(line.trim())) trigger = true;
          if (line.trim().endsWith(';') && (!trigger || /^END;$/i.test(line.trim()))) {
            statements.push(buffer); buffer = ''; trigger = false;
          }
        }
        if (buffer.trim()) statements.push(buffer);
        return fixtureCall('db', { op: 'batch', statements });
      },
    };
    const kv = { put: (key, value) => fixtureCall('kv', { key, value }) };
    await db.exec(await readFile(path.join(ROOT, 'worker/schema.sql'), 'utf8'));
    await db.prepare('INSERT INTO categories (id,name,slug) VALUES (?,?,?)').bind('review-category', 'Review Coffee', 'review-coffee').run();
    await db.prepare('INSERT INTO products (id,category_id,name,slug,price) VALUES (?,?,?,?,?)').bind('review-coffee', 'review-category', 'Cà phê kiểm thử local', 'review-coffee-product', 20000).run();
    await db.prepare('INSERT INTO menu_items (id,category,name,price) VALUES (?,?,?,?)').bind('review-coffee', 'Review Coffee', 'Cà phê kiểm thử local', 20000).run();
    const identities = [
      ['staff-default', 'staff', 'default'],
      ['cashier-default', 'cashier', 'default'],
      ['kitchen-default', 'kitchen', 'default'],
      ['staff-a', 'staff', 'cafe-a'],
      ['cashier-a', 'cashier', 'cafe-a'],
    ];
    const salt = 'aabbccddeeff00112233445566778899';
    const password = `pbkdf2$100000$${salt}$${pbkdf2Sync(REVIEW_PASSWORD, Buffer.from(salt, 'hex'), 100000, 32, 'sha256').toString('hex')}`;
    for (const [id, role, tenantId] of identities) {
      await db.prepare('INSERT INTO users (id,name,role,tenant_id) VALUES (?,?,?,?)').bind(id, id, role, tenantId).run();
      await kv.put(`user:${id}@local-review.test`, JSON.stringify({ id, email: `${id}@local-review.test`, name: id, role, password }));
    }
    return { mf, url, db, kv, scratch, providerRequests, deniedNetwork,
      setProviderDelay: ms => { providerDelayMs = ms; }, close: () => mf.dispose() };
  } catch (error) {
    await mf.dispose();
    throw error;
  }
}
