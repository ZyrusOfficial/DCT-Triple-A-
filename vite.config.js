import { defineConfig } from 'vite';

export default defineConfig({
  server: {
    host: '0.0.0.0',
    port: 5173,
    strictPort: true,
    // The Arena preview proxies through *.e2b.app; don't reject the Host header.
    allowedHosts: true,
    cors: true,
  },
  preview: { host: '0.0.0.0', port: 5173, allowedHosts: true },
  build: {
    target: 'es2022',
    sourcemap: false,
    chunkSizeWarningLimit: 2000,
  },
});
