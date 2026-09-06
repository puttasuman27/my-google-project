import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    proxy: {
      '/api': {
        target: 'https://civicpulse-api-766265720432.us-central1.run.app',
        changeOrigin: true,
        secure: true,
      }
    }
  }
})
