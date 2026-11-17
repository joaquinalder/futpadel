import { defineConfig } from 'vite';
import { resolve } from 'path';

export default defineConfig({
  root: '.',
  base: './',                         // relative paths so Electron can load file://
  server: {
    host: '127.0.0.1',
    port: 5173,
    strictPort: true,
    fs: { allow: ['..'] },            // allow importing from ../shared
  },
  build: {
    outDir: 'dist',
    emptyOutDir: true,
    target: 'es2020',
    rollupOptions: {
      input: resolve(__dirname, 'index.html'),
    },
  },
  resolve: {
    alias: {
      '@shared': resolve(__dirname, '../shared'),
    },
  },
  optimizeDeps: {
    include: ['three', '@colyseus/sdk', 'cannon-es'],
  },
});
