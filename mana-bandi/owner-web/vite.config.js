import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// In development, calls to /api are proxied to the .NET backend once it exists.
// Today every page talks to src/lib/api.js, which serves mock data from src/mock/.
export default defineConfig({
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
