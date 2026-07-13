import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';
import tailwindcss from '@tailwindcss/vite';

export default defineConfig({
  plugins: [
    react(),
    tailwindcss(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['favicon.ico', 'robots.txt', 'apple-touch-icon.png'],
      
      // ✅ SOLUCIÓN: Aumenta el límite de tamaño de archivo a 5 MB (5,000,000 bytes)
      workbox: {
        maximumFileSizeToCacheInBytes: 5000000,
      },
      
      manifest: {
        name: 'Sistema de Calificaciones',
        short_name: 'Calificaciones',
        description: 'Sistema de gestión de notas escolares',
        theme_color: '#3b82f6',
        background_color: '#ffffff',
        display: 'standalone',
        icons: [
          {
            src: '/icon-192.png',
            sizes: '192x192',
            type: 'image/png'
          },
          {
            src: '/icon-512.png',
            sizes: '512x512',
            type: 'image/png'
          }
        ]
      }
    })
  ]
});