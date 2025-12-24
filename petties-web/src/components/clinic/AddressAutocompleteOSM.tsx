import { useState, useRef, useEffect } from 'react'
import 'leaflet/dist/leaflet.css'
import L from 'leaflet'
import { env } from '../../config/env'

// Helper function to parse district and province from address string
const parseAddressFromString = (address: string): { district?: string; province?: string } => {
  const result: { district?: string; province?: string } = {}
  
  // Common patterns for Vietnamese addresses
  // Format: ..., Quận/Huyện X, Tỉnh/Thành phố Y
  const districtPatterns = [
    /(?:Quận|Huyện|Q\.|H\.)\s*([^,]+)/i,
    /(?:Quận|Huyện)\s*(\d+)/i,
  ]
  
  const provincePatterns = [
    /(?:Tỉnh|Thành phố|TP\.|T\.)\s*([^,]+)/i,
    /(?:TP\.|Tp\.)\s*([^,]+)/i,
  ]
  
  // Try to find district
  for (const pattern of districtPatterns) {
    const match = address.match(pattern)
    if (match && match[1]) {
      result.district = match[1].trim()
      break
    }
  }
  
  // Try to find province
  for (const pattern of provincePatterns) {
    const match = address.match(pattern)
    if (match && match[1]) {
      result.province = match[1].trim()
      break
    }
  }
  
  // If not found, try common city names
  const cities = ['Hồ Chí Minh', 'Hà Nội', 'Đà Nẵng', 'Hải Phòng', 'Cần Thơ']
  for (const city of cities) {
    if (address.includes(city)) {
      result.province = city
      break
    }
  }
  
  return result
}

interface AddressAutocompleteProps {
  value: string
  onChange: (address: string) => void
  onPlaceSelect?: (place: {
    address: string
    latitude?: number
    longitude?: number
    district?: string
    province?: string
  }) => void
  placeholder?: string
  className?: string
  disabled?: boolean
}

interface Location {
  latitude: number
  longitude: number
}

interface GoongPlaceResult {
  description: string
  place_id: string
  structured_formatting?: {
    main_text: string
    secondary_text: string
  }
}

export function AddressAutocompleteOSM({
  value,
  onChange,
  onPlaceSelect,
  placeholder = 'Nhập địa chỉ...',
  className = '',
  disabled = false,
}: AddressAutocompleteProps) {
  const [suggestions, setSuggestions] = useState<GoongPlaceResult[]>([])
  const [showSuggestions, setShowSuggestions] = useState(false)
  const [location, setLocation] = useState<Location | null>(null)
  const [isGeocoding, setIsGeocoding] = useState(false)
  const mapRef = useRef<HTMLDivElement>(null)
  const mapInstanceRef = useRef<L.Map | null>(null)
  const markerRef = useRef<L.Marker | null>(null)
  const inputRef = useRef<HTMLInputElement>(null)
  const debounceRef = useRef<NodeJS.Timeout>()

  // Debounced search function using Goong Places API
  const searchAddress = async (query: string) => {
    if (!query || query.length < 3) {
      setSuggestions([])
      setShowSuggestions(false)
      return
    }

    if (!env.GOONG_API_KEY) {
      console.warn('Goong API key is not configured')
      setSuggestions([])
      return
    }

    try {
      setIsGeocoding(true)
      // Goong Places Autocomplete API
      const response = await fetch(
        `https://rsapi.goong.io/Place/AutoComplete?api_key=${env.GOONG_API_KEY}&input=${encodeURIComponent(query)}&limit=5`,
        {
          method: 'GET',
        }
      )
      
      if (!response.ok) {
        throw new Error(`Goong API error: ${response.status}`)
      }
      
      const data = await response.json()
      // Goong API returns { predictions: [...] }
      const predictions: GoongPlaceResult[] = data.predictions || []
      setSuggestions(predictions)
      setShowSuggestions(true)
    } catch (error) {
      console.error('Goong Places API error:', error)
      setSuggestions([])
    } finally {
      setIsGeocoding(false)
    }
  }

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newValue = e.target.value
    onChange(newValue)

    // Clear location if address is cleared
    if (!newValue.trim()) {
      setLocation(null)
      setSuggestions([])
      setShowSuggestions(false)
      return
    }

    // Debounce API calls
    if (debounceRef.current) {
      clearTimeout(debounceRef.current)
    }

    debounceRef.current = setTimeout(() => {
      searchAddress(newValue)
    }, 500) // 500ms debounce
  }

  const handleSelectSuggestion = async (suggestion: GoongPlaceResult) => {
    if (!env.GOONG_API_KEY) {
      console.error('Goong API key is not configured')
      return
    }

    try {
      // Get place details to get coordinates
      const response = await fetch(
        `https://rsapi.goong.io/Place/Detail?place_id=${suggestion.place_id}&api_key=${env.GOONG_API_KEY}`
      )
      
      if (!response.ok) {
        throw new Error(`Goong API error: ${response.status}`)
      }
      
      const data = await response.json()
      const place = data.result
      const address = suggestion.description
      const lat = place.geometry?.location?.lat
      const lon = place.geometry?.location?.lng

      // Parse district and province from address components or address string
      let district: string | undefined
      let province: string | undefined

      // Try to parse from address_components if available
      if (place.address_components && Array.isArray(place.address_components)) {
        place.address_components.forEach((component: any) => {
          const types = component.types || []
          // District: administrative_area_level_2 or sublocality_level_1
          if (types.includes('administrative_area_level_2') || types.includes('sublocality_level_1')) {
            district = component.long_name || component.short_name
          }
          // Province: administrative_area_level_1 (province level)
          if (types.includes('administrative_area_level_1')) {
            province = component.long_name || component.short_name
          }
        })
      }

      // Fallback: Parse from address string if address_components not available
      if (!district || !province) {
        const parsed = parseAddressFromString(address)
        district = district || parsed.district
        province = province || parsed.province
      }

      if (lat && lon) {
        onChange(address)
        setShowSuggestions(false)
        setSuggestions([])

        setLocation({ latitude: lat, longitude: lon })

        if (onPlaceSelect) {
          onPlaceSelect({
            address,
            latitude: lat,
            longitude: lon,
            district,
            province,
          })
        }
      }
    } catch (error) {
      console.error('Error getting place details:', error)
      // Fallback: just set address without coordinates
      onChange(suggestion.description)
      setShowSuggestions(false)
      setSuggestions([])
    }
  }

  // Initialize map preview when location is available
  useEffect(() => {
    if (!location || !mapRef.current) {
      if (mapInstanceRef.current) {
        mapInstanceRef.current.remove()
        mapInstanceRef.current = null
        markerRef.current = null
      }
      return
    }

    if (!mapInstanceRef.current) {
      console.log('[AddressAutocomplete] Initializing map...', {
        location,
        hasMapTilesKey: !!env.GOONG_MAP_TILES_KEY,
        mapTilesKeyLength: env.GOONG_MAP_TILES_KEY?.length || 0,
      })

      // Initialize Leaflet map
      mapInstanceRef.current = L.map(mapRef.current, {
        center: [location.latitude, location.longitude],
        zoom: 15,
        zoomControl: false,
        attributionControl: false,
      })

      // Add Goong Map tiles
      // Goong Map Tiles format for Leaflet
      if (env.GOONG_MAP_TILES_KEY) {
        // Goong raster tiles format - thử nhiều format
        const goongTileUrl = `https://tiles.goong.io/assets/goong_map_web/{z}/{x}/{y}.png?api_key=${env.GOONG_MAP_TILES_KEY}`
        
        console.log('[AddressAutocomplete] Initializing Goong map tiles...', {
          hasKey: !!env.GOONG_MAP_TILES_KEY,
          keyLength: env.GOONG_MAP_TILES_KEY?.length || 0,
          tileUrl: goongTileUrl.replace(env.GOONG_MAP_TILES_KEY, '***'),
        })
        
        const tileLayer = L.tileLayer(goongTileUrl, {
          maxZoom: 20,
          minZoom: 1,
          attribution: '© Goong',
          tileSize: 256,
          zoomOffset: 0,
        })
        
        tileLayer.on('tileerror', (error) => {
          console.error('[AddressAutocomplete] Goong tile error:', error)
          // Fallback to OpenStreetMap if Goong fails
          if (!mapInstanceRef.current) return
          const osmLayer = L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
            maxZoom: 19,
            attribution: '© OpenStreetMap contributors',
          })
          mapInstanceRef.current.eachLayer((layer) => {
            if (layer instanceof L.TileLayer) {
              mapInstanceRef.current?.removeLayer(layer)
            }
          })
          osmLayer.addTo(mapInstanceRef.current)
        })
        
        tileLayer.addTo(mapInstanceRef.current)
      } else {
        console.warn('[AddressAutocomplete] No Goong Map Tiles Key, using OpenStreetMap fallback')
        // Fallback to OpenStreetMap
        L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
          maxZoom: 19,
          attribution: '© OpenStreetMap contributors',
        }).addTo(mapInstanceRef.current)
      }

      // Add marker with brutalist style
      const icon = L.divIcon({
        className: 'custom-marker',
        html: `<div style="
          width: 20px;
          height: 20px;
          background-color: #d97706;
          border: 3px solid #1c1917;
          border-radius: 50%;
          box-shadow: 2px 2px 0 #1c1917;
        "></div>`,
        iconSize: [20, 20],
        iconAnchor: [10, 10],
      })

      markerRef.current = L.marker([location.latitude, location.longitude], { icon })
        .addTo(mapInstanceRef.current)
    } else {
      // Update map center and marker
      mapInstanceRef.current.setView([location.latitude, location.longitude], 15)
      if (markerRef.current) {
        markerRef.current.setLatLng([location.latitude, location.longitude])
      }
    }

    return () => {
      if (mapInstanceRef.current) {
        mapInstanceRef.current.remove()
        mapInstanceRef.current = null
        markerRef.current = null
      }
    }
  }, [location])

  // Clear location when value is cleared externally
  useEffect(() => {
    if (!value.trim() && location) {
      setLocation(null)
    }
  }, [value, location])

  return (
    <div className="space-y-3">
      <div className="relative">
        <input
          ref={inputRef}
          type="text"
          value={value}
          onChange={handleInputChange}
          onFocus={() => {
            if (suggestions.length > 0) {
              setShowSuggestions(true)
            }
          }}
          onBlur={() => {
            // Delay to allow click on suggestion
            setTimeout(() => setShowSuggestions(false), 200)
          }}
          className="input-brutal w-full"
          placeholder={placeholder}
          disabled={disabled}
        />
        {isGeocoding && (
          <div className="absolute right-4 top-1/2 -translate-y-1/2 text-xs text-stone-500 font-bold uppercase pointer-events-none">
            Searching...
          </div>
        )}

        {/* Suggestions dropdown */}
        {showSuggestions && suggestions.length > 0 && (
          <div className="absolute z-[100] w-full mt-1 bg-white border-4 border-stone-900 shadow-brutal max-h-60 overflow-y-auto">
            {suggestions.map((suggestion) => (
              <button
                key={suggestion.place_id}
                type="button"
                onClick={() => handleSelectSuggestion(suggestion)}
                className="w-full text-left p-3 hover:bg-stone-100 border-b-2 border-stone-900 last:border-b-0 font-bold text-sm text-stone-900 transition-colors"
              >
                {suggestion.description}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Map Preview */}
      {location && (
        <div className="card-brutal overflow-hidden">
          <div
            ref={mapRef}
            style={{ height: '200px', width: '100%' }}
            className="bg-stone-200"
          />
        </div>
      )}
    </div>
  )
}


