const fallback = {
  APP_NAME: 'Petties',
  API_BASE_URL: 'http://localhost:8080/api',
  WS_URL: 'ws://localhost:8080/ws',
}

export const env = {
  APP_NAME: import.meta.env.VITE_APP_NAME ?? fallback.APP_NAME,
  API_BASE_URL: import.meta.env.VITE_API_BASE_URL ?? fallback.API_BASE_URL,
  WS_URL: import.meta.env.VITE_WS_URL ?? fallback.WS_URL,
}

