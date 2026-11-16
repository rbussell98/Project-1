import react from '@vitejs/plugin-react';
import { defineConfig, type Plugin } from 'vite';
import { VitePWA } from 'vite-plugin-pwa';

const UA = 'Sleeve/1.0 (rbussell98@gmail.com)';

function devProxy(): Plugin {
  return {
    name: 'sleeve-dev-proxy',
    configureServer(server) {
      server.middlewares.use(async (req, res, next) => {
        const base = server.config.base.replace(/\/$/, '');
        let url = req.url || '';
        if (base && url.startsWith(base + '/')) url = url.slice(base.length);
        let target = '';
        if (url.startsWith('/mb/')) target = 'https://musicbrainz.org' + url.slice(3);
        else if (url.startsWith('/caa/')) target = 'https://coverartarchive.org' + url.slice(4);
        else return next();
        try {
          const upstream = await fetch(target, {
            headers: { 'User-Agent': UA, Accept: req.headers.accept || '*/*' },
            redirect: 'follow',
          });
          res.statusCode = upstream.status;
          const type = upstream.headers.get('content-type');
          if (type) res.setHeader('content-type', type);
          res.setHeader('access-control-allow-origin', '*');
          const buf = Buffer.from(await upstream.arrayBuffer());
          res.end(buf);
        } catch (err) {
          res.statusCode = 502;
          res.end(err instanceof Error ? err.message : 'proxy failed');
        }
      });
    },
  };
}

export default defineConfig({
  plugins: [
    react(),
    devProxy(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['favicon.png', 'apple-touch-icon.png', 'icon-192.png', 'icon-512.png'],
      manifest: {
        name: 'Sleeve',
        short_name: 'Sleeve',
        description: 'A quiet shelf for the records you own and the ones you want.',
        // Leave start_url and scope unset so they follow Vite's base
        // (`/` locally, `/Project-1/` on GitHub Pages).
        display: 'standalone',
        orientation: 'portrait',
        background_color: '#1E1713',
        theme_color: '#1E1713',
        icons: [
          { src: 'icon-192.png', sizes: '192x192', type: 'image/png', purpose: 'any' },
          { src: 'icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'any' },
          { src: 'icon-maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ],
      },
      workbox: {
        // The shell precaches only the UI. OpenCV, Tesseract, the ONNX runtime,
        // and the album index stay out of the first install and cache on use.
        globPatterns: ['**/*.{js,css,html,ico,png,svg,woff2,webmanifest}'],
        globIgnores: ['**/opencv/**', '**/tesseract/**', '**/ort/**', '**/index/**', '**/zxing/**'],
        maximumFileSizeToCacheInBytes: 4 * 1024 * 1024,
        navigateFallback: 'index.html',
        runtimeCaching: [
          {
            urlPattern: /\/(opencv|tesseract|ort|index|zxing)\//,
            handler: 'CacheFirst',
            options: {
              cacheName: 'sleeve-runtime',
              expiration: { maxEntries: 40, maxAgeSeconds: 60 * 60 * 24 * 30 },
            },
          },
          {
            urlPattern: /^https:\/\/([^/]+\.)?(huggingface\.co|hf\.co)\//i,
            handler: 'CacheFirst',
            options: {
              cacheName: 'sleeve-models',
              expiration: { maxEntries: 24, maxAgeSeconds: 60 * 60 * 24 * 365 },
              cacheableResponse: { statuses: [0, 200] },
            },
          },
        ],
      },
      devOptions: { enabled: false },
    }),
  ],
  server: { host: true, port: 5173 },
  worker: { format: 'es' },
  build: { target: 'esnext' },
  optimizeDeps: {
    exclude: ['@huggingface/transformers', '@techstark/opencv-js'],
    include: ['tesseract.js'],
  },
});
