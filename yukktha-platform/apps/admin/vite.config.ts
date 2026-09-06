import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'

export default defineConfig({
  plugins: [react(), VitePWA({
    registerType: 'autoUpdate',
    manifest: {
      name: 'Yukktha Admin', short_name: 'Yukktha', display: 'standalone', start_url: '/', lang: 'te',
      theme_color: '#6C3FE0', background_color: '#F7F5FF',
      icons: [{ src: '/icon.svg', sizes: 'any', type: 'image/svg+xml', purpose: 'any' }]
    }
  })],
  server: { port: 5173, proxy: { '/api': 'http://localhost:5000' } }
})
