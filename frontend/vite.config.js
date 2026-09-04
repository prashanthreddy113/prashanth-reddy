import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// In development, API calls to /api are proxied to the .NET backend.
// In production (Netlify), set VITE_API_URL to the deployed backend URL.
export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    proxy: {
      '/api': {
        target: process.env.VITE_DEV_API_PROXY || 'http://localhost:5080',
        changeOrigin: true,
      },
    },
  },
})
