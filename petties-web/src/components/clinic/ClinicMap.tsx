import { useEffect, useRef, useState } from 'react'
import type { ClinicResponse } from '../../types/clinic'

interface ClinicMapProps {
  clinic: ClinicResponse
  height?: string
  zoom?: number
}

/**
 * ClinicMap component - Displays clinic location on Google Maps
 * Requires Google Maps API key
 */
export function ClinicMap({ clinic, height = '400px', zoom = 15 }: ClinicMapProps) {
  const mapRef = useRef<HTMLDivElement>(null)
  const mapInstanceRef = useRef<google.maps.Map | null>(null)
  const markerRef = useRef<google.maps.Marker | null>(null)
  const [isLoaded, setIsLoaded] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    // Load Google Maps script if not already loaded
    if (typeof window !== 'undefined' && !window.google?.maps) {
      const script = document.createElement('script')
      script.src = `https://maps.googleapis.com/maps/api/js?key=${import.meta.env.VITE_GOOGLE_MAPS_API_KEY || ''}`
      script.async = true
      script.defer = true
      script.onload = () => {
        setIsLoaded(true)
      }
      script.onerror = () => {
        setError('Failed to load Google Maps')
      }
      document.head.appendChild(script)
    } else if (window.google?.maps) {
      setIsLoaded(true)
    }
  }, [])

  useEffect(() => {
    if (!isLoaded || !mapRef.current || !clinic.latitude || !clinic.longitude) return

    // Initialize map
    if (!mapInstanceRef.current) {
      const position = { lat: clinic.latitude, lng: clinic.longitude }

      mapInstanceRef.current = new google.maps.Map(mapRef.current, {
        center: position,
        zoom: zoom,
        mapTypeId: 'roadmap',
        styles: [
          // Brutalist-inspired map style (minimal, high contrast)
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
        title: clinic.name,
        icon: {
          path: google.maps.SymbolPath.CIRCLE,
          scale: 10,
          fillColor: '#d97706', // amber-600
          fillOpacity: 1,
          strokeColor: '#1c1917', // stone-900
          strokeWeight: 3,
        },
      })

      // Add info window
      const infoWindow = new google.maps.InfoWindow({
        content: `
          <div style="padding: 8px; font-family: system-ui, sans-serif;">
            <div style="font-weight: 700; font-size: 14px; margin-bottom: 4px; text-transform: uppercase;">
              ${clinic.name}
            </div>
            <div style="font-size: 12px; color: #57534e;">
              ${clinic.address}
            </div>
          </div>
        `,
      })

      markerRef.current.addListener('click', () => {
        infoWindow.open(mapInstanceRef.current, markerRef.current)
      })
    }

    return () => {
      if (markerRef.current) {
        markerRef.current.setMap(null)
        markerRef.current = null
      }
    }
  }, [isLoaded, clinic, zoom])

  if (error) {
    return (
      <div className="card-brutal p-6 bg-red-50 border-red-600">
        <div className="text-red-800 font-bold uppercase mb-1">Map Error</div>
        <div className="text-red-700 text-sm">{error}</div>
      </div>
    )
  }

  if (!clinic.latitude || !clinic.longitude) {
    return (
      <div className="card-brutal p-6 bg-amber-50 border-amber-600">
        <div className="text-amber-800 font-bold uppercase mb-1">No Location</div>
        <div className="text-amber-700 text-sm">This clinic does not have location coordinates.</div>
      </div>
    )
  }

  return (
    <div className="card-brutal overflow-hidden">
      <div
        ref={mapRef}
        style={{ height, width: '100%' }}
        className="bg-stone-200"
      />
      {!isLoaded && (
        <div className="absolute inset-0 flex items-center justify-center bg-stone-200">
          <div className="text-stone-600 font-bold uppercase">Loading Map...</div>
        </div>
      )}
    </div>
  )
}

