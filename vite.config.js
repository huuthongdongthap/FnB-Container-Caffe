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
          if (id.includes('node_modules/i18next/') || id.includes('node_modules/react-i18next/')) return 'vendor-i18n';
          if (id.includes('node_modules/lucide-react/') || id.includes('node_modules/clsx/') || id.includes('node_modules/zustand/')) return 'vendor-ui';
          if (id.includes('node_modules/@tanstack/react-query')) return 'vendor-query';
        },
      },
    },
  },
  server: {
    port: 8081,
    open: true,
  },
});
