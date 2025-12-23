const fallback = {
  APP_NAME: 'Petties',
  // Development fallbacks
  API_BASE_URL: 'http://localhost:8080/api',
  WS_URL: 'ws://localhost:8080/ws',
  AGENT_SERVICE_URL: 'http://localhost:8000',
}

// Detect environment based on hostname
const getEnvironment = (): 'local' | 'production' => {
  if (typeof window === 'undefined') return 'local' // SSR fallback
  
  const hostname = window.location.hostname
  
  if (hostname === 'localhost' || hostname === '127.0.0.1') {
    return 'local'
  } else {
    return 'production'
  }
}

const environment = getEnvironment()

// Environment-specific URLs
const environmentUrls = {
  local: {
    API_BASE_URL: 'http://localhost:8080/api',
    WS_URL: 'ws://localhost:8080/ws',
    AGENT_SERVICE_URL: 'http://localhost:8000',
  },
  production: {
    API_BASE_URL: 'https://api.petties.world/api',
    WS_URL: 'wss://api.petties.world/ws',
    AGENT_SERVICE_URL: 'https://ai.petties.world',
  },
}

export const env = {
  APP_NAME: import.meta.env.VITE_APP_NAME ?? fallback.APP_NAME,
  
  // Priority: Env var > Environment detection > Fallback
  API_BASE_URL: import.meta.env.VITE_API_BASE_URL ?? 
    environmentUrls[environment].API_BASE_URL ?? 
    fallback.API_BASE_URL,
  
  WS_URL: import.meta.env.VITE_WS_URL ?? 
    environmentUrls[environment].WS_URL ?? 
    fallback.WS_URL,
  
  AGENT_SERVICE_URL: import.meta.env.VITE_AGENT_SERVICE_URL ?? 
    environmentUrls[environment].AGENT_SERVICE_URL ?? 
    fallback.AGENT_SERVICE_URL,
  
  // Google Maps API Key
  GOOGLE_MAPS_API_KEY: import.meta.env.VITE_GOOGLE_MAPS_API_KEY ?? '',
  
  // Goong API Key (dùng cho Places API và Map Tiles)
  GOONG_API_KEY: import.meta.env.VITE_GOONG_API_KEY ?? '',
  
  // Goong Map Tiles Key (có thể dùng chung với GOONG_API_KEY hoặc key riêng)
  GOONG_MAP_TILES_KEY: import.meta.env.VITE_GOONG_MAP_TILES_KEY ?? import.meta.env.VITE_GOONG_API_KEY ?? '',
}

// Debug log (only in development)
if (import.meta.env.DEV) {
  console.log('Environment Config:', {
    environment,
    hostname: typeof window !== 'undefined' ? window.location.hostname : 'N/A',
    API_BASE_URL: env.API_BASE_URL,
    WS_URL: env.WS_URL,
    AGENT_SERVICE_URL: env.AGENT_SERVICE_URL,
    hasGoongApiKey: !!env.GOONG_API_KEY,
    hasGoongMapTilesKey: !!env.GOONG_MAP_TILES_KEY,
    goongApiKeyLength: env.GOONG_API_KEY?.length || 0,
    goongMapTilesKeyLength: env.GOONG_MAP_TILES_KEY?.length || 0,
  })
}

