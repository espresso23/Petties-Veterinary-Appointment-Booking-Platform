import react from '@vitejs/plugin-react'
import { defineConfig, loadEnv } from 'vite'

function resolveTunnelHost(value?: string) {
  if (!value) {
    return undefined
  }

  try {
    const url = new URL(value)
    if (url.hostname === 'localhost' || url.hostname === '127.0.0.1') {
      return undefined
    }
    return url.hostname
  } catch {
    const hostname = value
      .replace(/^https?:\/\//, '')
      .replace(/\/.*$/, '')
      .trim()

    if (!hostname || hostname === 'localhost' || hostname === '127.0.0.1') {
      return undefined
    }

    return hostname
  }
}

// https://vite.dev/config/
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '')
  const tunnelHost =
    resolveTunnelHost(env.VITE_NGROK_HOST) ?? resolveTunnelHost(env.VITE_API_BASE_URL)
  const isTunnelMode = Boolean(tunnelHost)
  const ngrokStabilityPlugin = {
    name: 'ngrok-stability-mode',
    transformIndexHtml(html: string) {
      if (!isTunnelMode) {
        return html
      }

      return html
        .replace(/\s*<script type="module" src="\/@vite\/client"><\/script>/, '')
        .replace(
          /\s*<script type="module">import \{ injectIntoGlobalHook \} from "\/@react-refresh";[\s\S]*?<\/script>/,
          '',
        )
    },
  }

  return {
    plugins: [react(), ngrokStabilityPlugin],
    server: {
      port: 5173,
      host: '0.0.0.0',
      strictPort: true,
      origin: tunnelHost ? `https://${tunnelHost}` : undefined,
      allowedHosts: tunnelHost ? [tunnelHost, 'localhost'] : ['localhost'],
      hmr: isTunnelMode ? false : undefined,
    },
    define: {
      global: 'globalThis',
    },
    test: {
      globals: true,
      environment: 'jsdom',
      setupFiles: './src/setupTests.ts',
    },
  }
})
