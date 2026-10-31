import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    port: 3000,
    open: true,
    host: true,
    strictPort: false,
    // Proxy API calls to the Node/Express backend so the frontend can use
    // relative URLs like fetch('/api/orders').
    proxy: {
      '/api': 'http://localhost:4000'
    }
  }
})
