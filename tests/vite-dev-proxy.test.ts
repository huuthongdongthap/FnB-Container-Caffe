// @vitest-environment node
import { afterEach, describe, expect, it, vi } from 'vitest';
import { createServer as createHttpServer, type Server } from 'node:http';
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { createServer, loadConfigFromFile } from 'vite';

afterEach(() => vi.unstubAllEnvs());

describe('default Vite dev proxy', () => {
  it('loads the selected mode target without using the production browser API base', async () => {
    const dir = await mkdtemp(join(process.cwd(), '.vite-mode-fixture-'));
    try {
      // Copy only the config, so loadEnv reads isolated files while package
      // imports still resolve to this repo's installed dependencies.
      await writeFile(join(dir, 'vite.config.mjs'), await readFile('vite.config.js'));
      await writeFile(join(dir, '.env.development'), 'VITE_DEV_PROXY_TARGET=http://127.0.0.1:8787');
      await writeFile(join(dir, '.env.pilot'), 'VITE_DEV_PROXY_TARGET=http://127.0.0.1:8788');
      vi.stubEnv('VITE_DEV_PROXY_TARGET', undefined);
      vi.stubEnv('VITE_API_BASE', 'https://production.invalid');
      for (const mode of ['development', 'pilot', 'unconfigured']) {
        const loaded = await loadConfigFromFile({ mode, command: 'serve' }, join(dir, 'vite.config.mjs'));
        const config = loaded!.config;
        const target = mode === 'unconfigured' ? 'http://localhost:8787'
          : `http://127.0.0.1:${mode === 'pilot' ? 8788 : 8787}`;
        expect(config.server?.proxy?.['/api']).toMatchObject({ target });
        expect(config.server?.proxy?.['/mobile']).toBeDefined();
      }
    } finally { await rm(dir, { recursive: true, force: true }); }
  });

  it('forwards API requests and serves the SPA on HTML navigation, without proxy overrides', async () => {
    const calls: string[] = [];
    const fixture = createHttpServer((req, res) => {
      calls.push(`${req.method} ${req.url}`);
      res.setHeader('Content-Type', 'application/json');
      res.end(JSON.stringify({ success: true, path: req.url }));
    });
    await new Promise<void>((resolve, reject) => {
      fixture.once('error', reject);
      fixture.listen(0, '127.0.0.1', resolve);
    });
    const { port } = fixture.address() as { port: number };
    vi.stubEnv('VITE_DEV_PROXY_TARGET', `http://127.0.0.1:${port}`);
    const server = await createServer({ server: { host: '127.0.0.1', port: 0 }, optimizeDeps: { noDiscovery: true }, logLevel: 'silent' });
    try {
      await server.listen();
      const origin = server.resolvedUrls!.local[0];
      for (const [method, path] of [['GET', '/api/health'], ['POST', '/mobile/login'], ['POST', '/mobile/refresh'], ['GET', '/mobile/me?probe=1']]) {
        const response = await fetch(new URL(path, origin), { method, headers: { Accept: 'application/json' } });
        expect(response.status).toBe(200);
        expect(await response.json()).toMatchObject({ path });
      }
      for (const path of ['/mobile/login', '/mobile/kds?station=1', '/mobile/orders']) {
        const response = await fetch(new URL(path, origin), { headers: { Accept: 'text/html' } });
        expect(response.status).toBe(200);
        expect(response.headers.get('Content-Type')).toContain('text/html');
        expect(await response.text()).toMatch(/<div\s+id="root"[\s>]/);
        const head = await fetch(new URL(path, origin), { method: 'HEAD', headers: { Accept: 'text/html' } });
        expect(head.status).toBe(200);
      }
      expect(calls).toEqual(['GET /api/health', 'POST /mobile/login', 'POST /mobile/refresh', 'GET /mobile/me?probe=1']);
    } finally {
      await server.close();
      await new Promise<void>(resolve => (fixture as Server).close(() => resolve()));
    }
  }, 30_000);
});
