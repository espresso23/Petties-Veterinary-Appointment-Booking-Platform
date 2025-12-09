/**
 * Token Utilities - JWT validation and expiration checking
 */

/**
 * Decode JWT token (without verification)
 * Note: This only decodes, does NOT verify signature
 */
export function decodeJWT(token: string): { exp?: number; iat?: number; [key: string]: any } | null {
  try {
    const parts = token.split('.')
    if (parts.length !== 3) {
      return null
    }
    
    const payload = parts[1]
    const decoded = JSON.parse(atob(payload.replace(/-/g, '+').replace(/_/g, '/')))
    return decoded
  } catch {
    return null
  }
}

/**
 * Check if token is expired
 */
export function isTokenExpired(token: string | null): boolean {
  if (!token) return true
  
  const decoded = decodeJWT(token)
  if (!decoded || !decoded.exp) {
    // If no expiration claim, assume expired for safety
    return true
  }
  
  // exp is in seconds, Date.now() is in milliseconds
  const expirationTime = decoded.exp * 1000
  const currentTime = Date.now()
  
  // Add 60 second buffer to avoid edge cases
  return currentTime >= (expirationTime - 60000)
}

/**
 * Get token expiration time (in milliseconds)
 */
export function getTokenExpiration(token: string | null): number | null {
  if (!token) return null
  
  const decoded = decodeJWT(token)
  if (!decoded || !decoded.exp) {
    return null
  }
  
  return decoded.exp * 1000
}

/**
 * Check if token is valid (exists and not expired)
 */
export function isTokenValid(token: string | null): boolean {
  if (!token) return false
  return !isTokenExpired(token)
}

/**
 * Get time until token expires (in milliseconds)
 * Returns negative if already expired
 */
export function getTimeUntilExpiration(token: string | null): number | null {
  if (!token) return null
  
  const expiration = getTokenExpiration(token)
  if (!expiration) return null
  
  return expiration - Date.now()
}

