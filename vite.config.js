import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  base: './',
  plugins: [react()],
  server: {
    port: 5173,
    proxy: {
      '/api/getHSNAndGST': {
        target: 'http://127.0.0.1:5001',
        changeOrigin: true,
        secure: false,
        rewrite: () => '/stockpilotv1/us-central1/generateHSNAndGST',
      },
    },
  },
  build: {
    outDir: 'dist',
  },
});