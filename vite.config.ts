import tailwindcss from '@tailwindcss/vite'
import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'
import { VitePWA } from 'vite-plugin-pwa'

export default defineConfig({
  plugins: [
    react(),
    tailwindcss(),
    VitePWA({
      registerType: 'autoUpdate',
      workbox: {
        // txt so the ~1.1 MB public/dictionary.txt is precached for offline play.
        globPatterns: ['**/*.{js,css,html,svg,png,txt}'],
        maximumFileSizeToCacheInBytes: 3 * 1024 * 1024,
        // Data comes from Supabase through the offline repo; never cache API responses here.
        runtimeCaching: [
          {
            urlPattern: ({ url }: { url: URL }) => url.hostname.endsWith('.supabase.co'),
            handler: 'NetworkOnly',
          },
        ],
      },
      includeAssets: ['favicon.svg', 'apple-touch-icon.png'],
      manifest: {
        name: 'SpellKick',
        short_name: 'SpellKick',
        description: 'Spelling practice for kids',
        display: 'standalone',
        start_url: '/',
        theme_color: '#4f5bd5',
        background_color: '#ffffff',
        icons: [
          { src: 'icon-192.png', sizes: '192x192', type: 'image/png' },
          { src: 'icon-512.png', sizes: '512x512', type: 'image/png' },
          { src: 'icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ],
      },
    }),
  ],
})
