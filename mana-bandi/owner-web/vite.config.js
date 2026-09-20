import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// In development, calls to /api are proxied to the .NET backend once it exists.
// Today every page talks to src/lib/api.js, which serves mock data from src/mock/.
// VITE_BASE='./' + VITE_ROUTER=hash + VITE_OFFLINE_MAP=1 produce a self-contained build that runs
// from any static folder or a sandboxed host without map tiles (used for the shared prototype).
export default defineConfig({
  base: process.env.VITE_BASE || '/',
  plugins: [react()],
  server: {
    port: 5174,
    proxy: {
      '/api': {
        target: process.env.VITE_DEV_API_PROXY || 'http://localhost:5080',
        changeOrigin: true,
      },
    },
  },
})
