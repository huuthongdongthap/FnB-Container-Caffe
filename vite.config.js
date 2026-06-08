import { defineConfig } from 'vite';
import { resolve } from 'path';
import { readdirSync, existsSync, copyFileSync } from 'fs';

const __rootDir = new URL('.', import.meta.url).pathname;

// Non-app HTML files to exclude from build
const EXCLUDED_HTML = new Set([
  'binh-phap-thi-cong.html',
  'project-brief.html',
  'layout-2d-4k.html',
  'layout-3d.html',
  'lighthouse-report.html',
  'receipt-template.html',
  'test-reviews.html',
  'loyalty-calculator.html', // missing js/css deps
]);

// Auto-detect app HTML files in root + subdirectories
const htmlEntries = {};

// Root HTML
readdirSync(__rootDir)
  .filter(f => f.endsWith('.html') && !EXCLUDED_HTML.has(f))
  .forEach(f => {
    htmlEntries[f.replace('.html', '')] = resolve(__rootDir, f);
  });

// Dashboard + Admin + Signup HTML
['dashboard', 'admin', 'signup'].forEach(dir => {
  const dirPath = resolve(__rootDir, dir);
  if (existsSync(dirPath)) {
    readdirSync(dirPath)
      .filter(f => f.endsWith('.html'))
      .forEach(f => {
        htmlEntries[`${dir}/${f.replace('.html', '')}`] = resolve(dirPath, f);
      });
  }
});

export default defineConfig({
  plugins: [{
    name: 'copy-redirects',
    closeBundle() {
      const src = resolve(__rootDir, '_redirects');
      const dst = resolve(__rootDir, 'dist', '_redirects');
      if (existsSync(src)) { copyFileSync(src, dst); }
    },
  }],
  build: {
    rollupOptions: {
      input: htmlEntries,
    },
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
