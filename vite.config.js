const { defineConfig } = require('vite');
const react = require('@vitejs/plugin-react');
const path = require('path');

module.exports = defineConfig({
  plugins: [react()],
  root: './',
  server: {
    port: 8080,
    strictPort: false, // ← AUTO-INCREMENT if port is busy
    open: false,
    cors: true,
    proxy: {
      '/api': {
        target: 'http://localhost:3000',
        changeOrigin: true,
      },
      '/ws': {
        target: 'ws://localhost:3000',
        ws: true,
      },
    },
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './frontend'),
    },
  },
  build: {
    outDir: 'dist',
    rollupOptions: {
      input: {
        main: path.resolve(__dirname, 'index.html'),    // ← ADDED
        admin: path.resolve(__dirname, 'admin.html'),
        widget: path.resolve(__dirname, 'widget.html'),
      },
    },
  },
});