import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  // --- ADD THIS SERVER CONFIGURATION BLOCK ---
  server: {
    proxy: {
      // Any request that starts with "/api"
      '/api': {
        // will be forwarded to your backend server.
        target: 'http://127.0.0.1:5001/breeze-9c703/us-central1/api',
        changeOrigin: true, // This is important for CORS
      },
    },
  },
})