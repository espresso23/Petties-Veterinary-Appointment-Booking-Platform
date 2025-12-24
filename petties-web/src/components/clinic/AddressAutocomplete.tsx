import { useRef, useEffect, useState } from 'react'

interface AddressAutocompleteProps {
  value: string
  onChange: (address: string) => void
  onPlaceSelect?: (place: {
    address: string
    latitude?: number
    longitude?: number
  }) => void
  placeholder?: string
  className?: string
  disabled?: boolean
}

interface Location {
  latitude: number
  longitude: number
}

/**
 * Address Autocomplete component using Google Places API (New)
 * Uses PlaceAutocompleteElement - recommended by Google for new customers
 * 
 * Migration from google.maps.places.Autocomplete to PlaceAutocompleteElement
 * See: https://developers.google.com/maps/documentation/javascript/places-migration-overview
 */
export function AddressAutocomplete({
  value,
  onChange,
  onPlaceSelect,
  placeholder = 'Enter address...',
  className = '',
  disabled = false,
}: AddressAutocompleteProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const autocompleteRef = useRef<google.maps.places.PlaceAutocompleteElement | null>(null)
  const mapRef = useRef<HTMLDivElement>(null)
  const mapInstanceRef = useRef<google.maps.Map | null>(null)
  const markerRef = useRef<google.maps.Marker | null>(null)
  const [isLoaded, setIsLoaded] = useState(false)
  const [apiError, setApiError] = useState(false) // Track if API has billing/error issues
  const [location, setLocation] = useState<Location | null>(null)
  const scriptLoadedRef = useRef(false)

  useEffect(() => {
    // Prevent loading script multiple times
    if (scriptLoadedRef.current) {
      if (window.google?.maps?.places?.PlaceAutocompleteElement) {
        setIsLoaded(true)
      }
      return
    }

    // Check if Google Maps is already loaded
    if (typeof window !== 'undefined' && window.google?.maps?.places?.PlaceAutocompleteElement) {
      setIsLoaded(true)
      scriptLoadedRef.current = true
      return
    }

    // Check if script is already in the document
    const existingScript = document.querySelector('script[src*="maps.googleapis.com/maps/api/js"]')
    if (existingScript) {
      scriptLoadedRef.current = true
      // Wait for it to load
      const checkLoaded = setInterval(() => {
        if (window.google?.maps?.places?.PlaceAutocompleteElement) {
          setIsLoaded(true)
          clearInterval(checkLoaded)
        }
      }, 100)
      setTimeout(() => clearInterval(checkLoaded), 10000)
      return
    }

    // Load Google Maps script with Places API (New)
    scriptLoadedRef.current = true
    const script = document.createElement('script')
    script.src = `https://maps.googleapis.com/maps/api/js?key=${import.meta.env.VITE_GOOGLE_MAPS_API_KEY || ''}&libraries=places&loading=async`
    script.async = true
    script.defer = true
    script.onload = () => {
      // Wait for PlaceAutocompleteElement to be available
      const checkLoaded = setInterval(() => {
        if (window.google?.maps?.places?.PlaceAutocompleteElement) {
          setIsLoaded(true)
          clearInterval(checkLoaded)
        }
      }, 100)
      
      // Timeout after 10 seconds
      setTimeout(() => {
        clearInterval(checkLoaded)
        if (!window.google?.maps?.places?.PlaceAutocompleteElement) {
          console.error('PlaceAutocompleteElement not available. Make sure Places API (New) is enabled.')
        }
      }, 10000)
    }
    script.onerror = () => {
      console.error('Failed to load Google Maps script')
      scriptLoadedRef.current = false
      setApiError(true)
    }
    document.head.appendChild(script)
  }, [])

  useEffect(() => {
    if (!isLoaded || !containerRef.current || disabled) return

    // Initialize PlaceAutocompleteElement
    if (!autocompleteRef.current) {
      // Create PlaceAutocompleteElement (no options in constructor)
      const autocomplete = new google.maps.places.PlaceAutocompleteElement()

      // Note: Component restrictions may need to be configured differently
      // For now, we'll rely on the API's default behavior
      // If country restriction is needed, it may need to be set via Google Cloud Console API restrictions

      // Set initial value
      if (value) {
        autocomplete.value = value
      }

      // Apply styling to match brutalist design
      autocomplete.style.width = '100%'
      autocomplete.style.fontFamily = 'inherit'
      autocomplete.style.border = '3px solid #000'
      autocomplete.style.borderRadius = '0'
      autocomplete.style.padding = '0.75rem'
      autocomplete.style.fontSize = '1rem'
      autocomplete.style.fontWeight = 'bold'
      autocomplete.style.backgroundColor = '#fff'
      autocomplete.style.boxShadow = '4px 4px 0px 0px #000'

      // Set placeholder via attribute
      if (placeholder) {
        autocomplete.setAttribute('placeholder', placeholder)
      }

      // Listen for errors (billing, network, etc.)
      autocomplete.addEventListener('gmp-error', (event: any) => {
        console.warn('Google Places API error:', event)
        setApiError(true)
        // Fallback to regular input
        if (containerRef.current) {
          containerRef.current.innerHTML = ''
          const fallbackInput = document.createElement('input')
          fallbackInput.type = 'text'
          fallbackInput.value = value
          fallbackInput.className = 'input-brutal w-full'
          fallbackInput.placeholder = placeholder
          fallbackInput.disabled = disabled
          fallbackInput.onchange = (e) => {
            const target = e.target as HTMLInputElement
            onChange(target.value)
          }
          containerRef.current.appendChild(fallbackInput)
        }
      })

      // Listen for place selection event (gmp-placeselect, not place_changed)
      autocomplete.addEventListener('gmp-placeselect', (event: any) => {
        const place = event.place
        if (place) {
          // Get address from place
          const address = place.formattedAddress || place.displayName || place.name || ''
          onChange(address)

          // Get location - PlaceAutocompleteElement uses different structure
          const placeLocation = place.location || place.geometry?.location
          if (placeLocation) {
            const lat = typeof placeLocation.lat === 'function' ? placeLocation.lat() : placeLocation.lat
            const lng = typeof placeLocation.lng === 'function' ? placeLocation.lng() : placeLocation.lng
            
            // Save location for map preview
            setLocation({ latitude: lat, longitude: lng })

            if (onPlaceSelect) {
              onPlaceSelect({
                address,
                latitude: lat,
                longitude: lng,
              })
            }
          }
        }
      })

      // Listen for input changes (user typing)
      autocomplete.addEventListener('input', (event: any) => {
        const inputValue = event.target?.value || autocomplete.value || ''
        if (inputValue !== value) {
          onChange(inputValue)
          // Clear location if address is cleared
          if (!inputValue.trim()) {
            setLocation(null)
          }
        }
      })

      // Clear container and append autocomplete element
      containerRef.current.innerHTML = ''
      containerRef.current.appendChild(autocomplete)
      
      autocompleteRef.current = autocomplete
    } else {
      // Update value if it changed externally
      if (autocompleteRef.current.value !== value) {
        autocompleteRef.current.value = value
      }
    }

    return () => {
      if (autocompleteRef.current && containerRef.current) {
        // Remove event listeners
        autocompleteRef.current.removeEventListener('gmp-placeselect', () => {})
        autocompleteRef.current.removeEventListener('input', () => {})
        // Remove from DOM
        if (containerRef.current.contains(autocompleteRef.current)) {
          containerRef.current.removeChild(autocompleteRef.current)
        }
        autocompleteRef.current = null
      }
    }
  }, [isLoaded, value, onChange, onPlaceSelect, disabled, placeholder])

  // Clear location when value is cleared externally
  useEffect(() => {
    if (!value.trim() && location) {
      setLocation(null)
    }
  }, [value, location])

  // Initialize map preview when location is available
  useEffect(() => {
    if (!isLoaded || !location || !mapRef.current) {
      // Clear map if location is removed
      if (!location && mapInstanceRef.current) {
        if (markerRef.current) {
          markerRef.current.setMap(null)
          markerRef.current = null
        }
        mapInstanceRef.current = null
      }
      return
    }

    // Initialize map
    if (!mapInstanceRef.current) {
      const position = { lat: location.latitude, lng: location.longitude }

      mapInstanceRef.current = new google.maps.Map(mapRef.current, {
        center: position,
        zoom: 15,
        mapTypeId: 'roadmap',
        disableDefaultUI: true,
        zoomControl: false,
        mapTypeControl: false,
        scaleControl: false,
        streetViewControl: false,
        fullscreenControl: false,
        styles: [
          // Brutalist-inspired map style
          {
            featureType: 'all',
            elementType: 'geometry',
            stylers: [{ color: '#fafaf9' }], // stone-50
          },
          {
            featureType: 'road',
            elementType: 'geometry',
            stylers: [{ color: '#ffffff' }],
          },
          {
            featureType: 'road',
            elementType: 'geometry.stroke',
            stylers: [{ color: '#1c1917', weight: 2 }], // stone-900
          },
          {
            featureType: 'water',
            elementType: 'geometry',
            stylers: [{ color: '#a8d5e2' }],
          },
          {
            featureType: 'poi',
            elementType: 'labels',
            stylers: [{ visibility: 'off' }],
          },
        ],
      })

      // Add marker
      markerRef.current = new google.maps.Marker({
        position: position,
        map: mapInstanceRef.current,
        icon: {
          path: google.maps.SymbolPath.CIRCLE,
          scale: 10,
          fillColor: '#d97706', // amber-600
          fillOpacity: 1,
          strokeColor: '#1c1917', // stone-900
          strokeWeight: 3,
        },
      })
    } else {
      // Update map center and marker position if location changes
      const position = { lat: location.latitude, lng: location.longitude }
      mapInstanceRef.current.setCenter(position)
      if (markerRef.current) {
        markerRef.current.setPosition(position)
      }
    }

    return () => {
      if (markerRef.current) {
        markerRef.current.setMap(null)
        markerRef.current = null
      }
    }
  }, [isLoaded, location])

  // Fallback to regular input if API has errors
  if (apiError || (!isLoaded && scriptLoadedRef.current)) {
    return (
      <div className="space-y-3">
        {apiError && (
          <div className="card-brutal p-3 bg-amber-50 border-amber-600">
            <div className="text-xs font-bold uppercase text-amber-800">
              Autocomplete không khả dụng. Vui lòng nhập địa chỉ thủ công.
            </div>
            <div className="text-xs text-amber-700 mt-1">
              Để sử dụng autocomplete, cần bật billing trong Google Cloud Console.
            </div>
          </div>
        )}
        <div className="relative">
          <input
            type="text"
            value={value}
            onChange={(e) => onChange(e.target.value)}
            className="input-brutal w-full"
            placeholder={placeholder}
            disabled={disabled}
          />
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-3">
      <div className="relative">
        <div
          ref={containerRef}
          className={`${className}`}
        >
          {!isLoaded && (
            <input
              type="text"
              value={value}
              onChange={(e) => onChange(e.target.value)}
              className="input-brutal w-full"
              placeholder={placeholder}
              disabled={disabled}
            />
          )}
        </div>
        {!isLoaded && (
          <div className="absolute right-4 top-1/2 -translate-y-1/2 text-xs text-stone-500 font-bold uppercase pointer-events-none">
            Loading...
          </div>
        )}
      </div>

      {/* Map Preview - Hiển thị khi có location */}
      {location && isLoaded && (
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

