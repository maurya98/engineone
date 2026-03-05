import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import type { Plugin } from 'vite';

// SPA fallback: serve index.html for client routes so refresh works.
// Must run before the proxy so /workspaces/* is not sent to the API as document requests.
const spaFallback = (): Plugin => ({
  name: 'spa-fallback',
  configureServer(server) {
    server.middlewares.use((req, res, next) => {
      if (req.method !== 'GET' || !req.url) return next();
      const path = req.url.replace(/\?.*$/, '');
      const isDocRequest = (req.headers.accept || '').includes('text/html');
      // Client routes: /workspaces/:id or /workspaces/:id/repos/:id - serve index.html so browser gets the SPA (no Auth header on document request).
      if (isDocRequest && /^\/workspaces\/[^/]+(\/|$)/.test(path)) {
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
          const isDocRequest = (req.headers.accept || '').includes('text/html');
          // Don't proxy document requests for client routes – serve index.html so refresh works (no Auth header on doc request).
          if (req.method === 'GET' && isDocRequest && /^\/workspaces\/[^/]+(\/|$)/.test(path)) {
            return '/index.html';
          }
          if (/^\/workspaces\/[^/]+\/repos\/[^/]+(\/|$)/.test(path)) {
            return '/index.html';
          }
        },
      },
      '/repos': 'http://localhost:4000',
      '/admin': 'http://localhost:4000',
      '/execute': 'http://localhost:4000',
      '/simulate': 'http://localhost:4000',
      '/health': 'http://localhost:4000',
    },
  },
});
