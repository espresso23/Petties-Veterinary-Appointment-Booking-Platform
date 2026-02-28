import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    host: '0.0.0.0', // Cho phép truy cập từ Docker/Network
    strictPort: true,
    allowedHosts: [
      'hasty-unvociferously-madalyn.ngrok-free.dev',
      'localhost',
    ],
  },
  define: {
    // Fix for sockjs-client which expects Node.js globals
    global: 'globalThis',
  },
})
