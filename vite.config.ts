import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
export default defineConfig({
  plugins: [react()],
  server: { port: 5173, proxy: { '/api': 'http://127.0.0.1:3001' } },
  preview: { port: 5173, proxy: { '/api': 'http://127.0.0.1:3001' } },
  build: {
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (id.includes('/@firebase/firestore/')) return 'firebase-firestore';
          if (id.includes('/@firebase/auth/')) return 'firebase-auth';
          if (id.includes('/zod/')) return 'validation';
          if (/\/node_modules\/(react|react-dom|scheduler)\//.test(id)) return 'react';
        },
      },
    },
  },
});
