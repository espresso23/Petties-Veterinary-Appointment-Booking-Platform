import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    strictPort: true, // Nếu port bị chiếm, sẽ báo lỗi thay vì tự động chuyển port
    host: '0.0.0.0', // Bind to all interfaces for Docker access
    allowedHosts: [
      'localhost',
      '127.0.0.1',
      'host.docker.internal',
      '.ngrok-free.dev', // Allow all ngrok subdomains
      '.ngrok.io',
      '.ngrok-free.app',
    ],
  },
  define: {
    // Fix for sockjs-client which expects Node.js globals
    global: 'globalThis',
  },
})
