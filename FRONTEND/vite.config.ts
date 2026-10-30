import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '')
  const apiUrl = env.VITE_API_URL ?? 'http://localhost:8000'
  let apiOrigin = ''
  try { apiOrigin = new URL(apiUrl).origin } catch { /* relative / empty URL */ }

  return {
    plugins: [
      react(),
      VitePWA({
        registerType: 'autoUpdate',
        includeAssets: ['favicon.svg', 'icons/icon.svg'],
        manifest: {
          name: 'Field Evidence Logger',
          short_name: 'EvidenceLog',
          description: 'Offline-first evidentiary logging for field drug tests',
          theme_color: '#0f172a',
          background_color: '#0f172a',
          display: 'standalone',
          start_url: '/',
          icons: [
            { src: '/icons/icon.svg', sizes: 'any', type: 'image/svg+xml', purpose: 'any' }
          ]
        },
        workbox: {
          globPatterns: ['**/*.{js,css,html,svg,png,ico,woff2}'],
          navigateFallback: '/index.html',
          navigateFallbackDenylist: [/^\/api\//, /^\/auth\//],
          runtimeCaching: [
            {
              urlPattern: ({ url }) =>
                url.pathname.startsWith('/api/') ||
                url.pathname.startsWith('/auth/') ||
                (apiOrigin !== '' && url.origin === apiOrigin),
              handler: 'NetworkOnly'
            },
            {
              urlPattern: /^https:\/\/tile\.openstreetmap\.org\/.*/,
              handler: 'CacheFirst',
              options: {
                cacheName: 'osm-tiles',
                expiration: { maxEntries: 400, maxAgeSeconds: 60 * 60 * 24 * 30 }
              }
            }
          ]
        }
      })
    ],
    server: {
      port: 5173,
      proxy: {
        '/api': { target: env.VITE_PROXY_TARGET || 'http://localhost:8000', changeOrigin: true },
        '/auth': { target: env.VITE_PROXY_TARGET || 'http://localhost:8000', changeOrigin: true }
      }
    }
  }
})
