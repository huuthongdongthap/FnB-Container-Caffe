import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import { resolve } from 'path';
import { existsSync, copyFileSync } from 'fs';

const __rootDir = new URL('.', import.meta.url).pathname;

export default defineConfig({
  plugins: [
    tailwindcss(),
    react(),
    {
      name: 'copy-cloudflare-config',
      closeBundle() {
        const dist = resolve(__rootDir, 'dist');
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
    },
  },
  build: {
    outDir: 'dist',
    emptyOutDir: true,
    minify: 'terser',
    terserOptions: {
      compress: { drop_console: false },
      mangle: true,
    },
    cssMinify: true,
  },
  server: {
    port: 8081,
    open: true,
  },
});
