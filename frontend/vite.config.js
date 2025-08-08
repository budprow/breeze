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
        target: 'http://localhost:3001',
        changeOrigin: true, // This is important for CORS
      },
    },
  },
})