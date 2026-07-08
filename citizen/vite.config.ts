import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { VitePWA } from 'vite-plugin-pwa'

export default defineConfig({
  plugins: [
    react(),
    tailwindcss(),
    VitePWA({
      registerType: 'autoUpdate',
      manifest: {
        id: '/',
        name: 'FixMyCity',
        short_name: 'FixMyCity',
        description: 'Report local issues. Track every fix.',
        theme_color: '#0B2545',
        background_color: '#FAFAFA',
        display: 'standalone',
        start_url: '/',
        scope: '/',
        orientation: 'portrait',
        icons: [
          { src: '/icon-192.png', sizes: '192x192', type: 'image/png', purpose: 'any' },
          { src: '/icon-192.png', sizes: '192x192', type: 'image/png', purpose: 'maskable' },
          { src: '/icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'any' },
          { src: '/icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' }
        ]
      },
      workbox: {
        // reopening the installed app offline/on flaky signal falls back to the
        // cached shell instead of a browser error page. No runtimeCaching entry
        // exists for the Supabase host, so those API/storage calls are never
        // intercepted by the service worker — they always hit the network live.
        navigateFallback: '/index.html'
      }
    })
  ],
  server: { port: 5173 }
})
