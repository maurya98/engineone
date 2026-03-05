import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import type { Plugin } from 'vite';

// SPA fallback: serve index.html for client routes so refresh works.
// Must run before the proxy so /workspaces/:id/repos/:repoId is not sent to the API.
const spaFallback = (): Plugin => ({
  name: 'spa-fallback',
  configureServer(server) {
    server.middlewares.use((req, res, next) => {
      if (req.method !== 'GET' || !req.url) return next();
      const path = req.url.replace(/\?.*$/, '');
      if (/^\/workspaces\/[^/]+\/repos\/[^/]+(\/|$)/.test(path)) {
        req.url = '/index.html';
      }
      next();
    });
  },
});

export default defineConfig({
  plugins: [spaFallback(), react()],
  server: {
    port: 3000,
    proxy: {
      '/auth': 'http://localhost:4000',
      '/users': 'http://localhost:4000',
      '/workspaces': {
        target: 'http://localhost:4000',
        bypass(req) {
          const path = (req.url ?? '').replace(/\?.*$/, '');
          if (/^\/workspaces\/[^/]+\/repos\/[^/]+(\/|$)/.test(path)) {
            return '/index.html';
          }
        },
      },
      '/repos': 'http://localhost:4000',
      '/execute': 'http://localhost:4000',
      '/simulate': 'http://localhost:4000',
      '/health': 'http://localhost:4000',
    },
  },
});
