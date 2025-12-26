import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    strictPort: true, // Nếu port bị chiếm, sẽ báo lỗi thay vì tự động chuyển port
  },
})
