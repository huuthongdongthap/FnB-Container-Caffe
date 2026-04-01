import { defineConfig } from 'vite';
import { resolve } from 'path';
import { readdirSync } from 'fs';

// Auto-detect all HTML files in the root directory
const htmlFiles = readdirSync(__dirname)
  .filter(file => file.endsWith('.html'))
  .reduce((entries, file) => {
    const name = file.replace('.html', '');
    entries[name] = resolve(__dirname, file);
    return entries;
  }, {});

export default defineConfig({
  build: {
    rollupOptions: {
      input: htmlFiles
    },
    outDir: 'dist',
    emptyOutDir: true
  },
  server: {
    port: 8081,
    open: true
  }
});
