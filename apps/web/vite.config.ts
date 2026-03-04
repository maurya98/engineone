import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  server: {
    port: 3000,
    proxy: {
      '/auth': 'http://localhost:4000',
      '/users': 'http://localhost:4000',
      '/workspaces': 'http://localhost:4000',
      '/repos': 'http://localhost:4000',
      '/execute': 'http://localhost:4000',
      '/health': 'http://localhost:4000',
    },
  },
});
