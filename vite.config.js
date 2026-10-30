import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import { resolve } from 'path';
import { existsSync, copyFileSync } from 'fs';

const __rootDir = new URL('.', import.meta.url).pathname;

// The config module loads before Vite's own env system is up, so import.meta.env
// is undefined here. loadEnv reads .env* directly and is the only supported way
// to seed the dev proxy target.
const DEFAULT_WORKER_ORIGIN = 'http://localhost:8787';

// `server` must be a plain object. Vite merges it with its own server defaults and
// never invokes a function form, so a config function here silently drops every
// server option — including the proxy. defineConfig's callback receives the mode
// actually being served, which is what makes loadEnv(mode, ...) resolve the target
// for that mode instead of a hardcoded one.
export default defineConfig(({ mode }) => {
  // VITE_API_BASE is the origin the browser calls. It is deliberately empty in
  // .env.local so the client walks through this same-origin proxy instead of
  // addressing the worker cross-origin — so the proxy target needs its own variable
  // and must not fall back to a value the client overwrote.
  const workerTarget = loadEnv(mode, __rootDir, 'VITE_').VITE_DEV_PROXY_TARGET
    || DEFAULT_WORKER_ORIGIN;

  // Staff mobile calls /mobile/* with API_BASE empty, so those requests never pass
  // through the /api prefix. A browser navigating to /mobile/login expects the SPA
  // shell, not a JSON body from the worker, so only API-shaped requests cross over.
  const devProxy = {
    '/api': {
      target: workerTarget,
      changeOrigin: true,
      secure: false,
    },
    '/mobile': {
      target: workerTarget,
      changeOrigin: true,
      secure: false,
      bypass(req) {
        if ((req.method === 'GET' || req.method === 'HEAD') && (req.headers.accept || '').includes('text/html')) {
          return '/index.html';
        }
        return undefined;
      },
    },
  };

  return {
    plugins: [
      tailwindcss(),
      react(),
      {
        name: 'dev-api-beacons',
        configureServer(server) {
          server.middlewares.use((req, res, next) => {
            if (req.url === '/api/vitals' || req.url === '/api/errors') {
              res.statusCode = 200;
              res.setHeader('Content-Type', 'application/json');
              res.end(JSON.stringify({ success: true }));
              return;
            }
            next();
          });
        },
      },
      {
        name: 'copy-cloudflare-config',
        closeBundle() {
          const dist = resolve(__rootDir, 'dist');
          if (!existsSync(dist)) return; // build failed, skip copy
          // Copy _redirects for Cloudflare Pages SPA routing
          const redirects = resolve(__rootDir, '_redirects');
          if (existsSync(redirects)) copyFileSync(redirects, resolve(dist, '_redirects'));
          // Copy _headers for Cloudflare Pages CSP
          const headers = resolve(__rootDir, '_headers');
          if (existsSync(headers)) copyFileSync(headers, resolve(dist, '_headers'));
        },
      },
    ],
    resolve: {
      alias: {
        '@': resolve(__rootDir, 'src'),
        '@aura/domain-catalog': resolve(__rootDir, 'packages/domain/catalog/index.ts'),
        '@aura/domain-audit': resolve(__rootDir, 'packages/domain/audit/index.ts'),
        '@aura/domain-notification': resolve(__rootDir, 'packages/domain/notification/index.ts'),
        '@aura/domain-integration': resolve(__rootDir, 'packages/domain/integration/index.ts'),
        '@aura/domain-observability': resolve(__rootDir, 'packages/domain/observability/index.ts'),
        '@aura/domain-deployment': resolve(__rootDir, 'packages/domain/deployment/index.ts'),
        '@aura/domain-security': resolve(__rootDir, 'packages/domain/security/index.ts'),
        '@aura/domain-continuity': resolve(__rootDir, 'packages/domain/continuity/index.ts'),
        '@aura/domain-migration': resolve(__rootDir, 'packages/domain/migration/index.ts'),
        '@aura/domain-customer': resolve(__rootDir, 'packages/domain/customer/index.ts'),
        '@aura/domain-crm': resolve(__rootDir, 'packages/domain/crm/index.ts'),
        '@aura/domain-order': resolve(__rootDir, 'packages/domain/order/index.ts'),
        '@aura/domain-payment': resolve(__rootDir, 'packages/domain/payment/index.ts'),
        '@aura/domain-kitchen': resolve(__rootDir, 'packages/domain/kitchen/index.ts'),
        '@aura/domain-table': resolve(__rootDir, 'packages/domain/table/index.ts'),
        '@aura/domain-staff': resolve(__rootDir, 'packages/domain/staff/index.ts'),
        '@aura/domain-shift': resolve(__rootDir, 'packages/domain/shift/index.ts'),
        '@aura/domain-sop': resolve(__rootDir, 'packages/domain/sop/index.ts'),
        '@aura/domain-reservation': resolve(__rootDir, 'packages/domain/reservation/index.ts'),
        '@aura/domain-inventory': resolve(__rootDir, 'packages/domain/inventory/index.ts'),
        'worker/src': resolve(__rootDir, 'worker/src'),
      },
    },
    build: {
      outDir: 'dist',
      emptyOutDir: true,
      chunkSizeWarningLimit: 1024,
      minify: 'terser',
      terserOptions: {
        compress: { drop_console: false },
        mangle: true,
      },
      cssMinify: true,
      rollupOptions: {
        output: {
          manualChunks(id) {
            if (id.includes('node_modules/react/') || id.includes('node_modules/react-dom/') || id.includes('node_modules/react-router-dom/')) return 'vendor-react';
            if (id.includes('node_modules/i18next/') || id.includes('node_modules/react-i18next/')) return 'vendor-i18next';
            if (id.includes('node_modules/lucide-react/') || id.includes('node_modules/clsx/') || id.includes('node_modules/zustand/')) return 'vendor-ui';
            if (id.includes('node_modules/@tanstack/react-query')) return 'vendor-query';
          },
        },
      },
    },
    server: {
      port: 5173,
      host: process.env.VITE_DEV_HOST || '127.0.0.1',
      proxy: devProxy,
    },
  };
});
