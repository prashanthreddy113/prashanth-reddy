import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
// In dev, VITE_STORE_SLUG picks the tenant (sent as X-Store-Slug). In production the subdomain does.
export default defineConfig({ plugins: [react()], server: { port: 5174, proxy: { '/api': 'http://localhost:5000' } } })
