import { useEffect, useRef } from 'react'
import 'leaflet/dist/leaflet.css'
import L from 'leaflet'
import type { ClinicResponse } from '../../types/clinic'
import { env } from '../../config/env'

interface ClinicMapOSMProps {
  clinic: ClinicResponse
  height?: string
  zoom?: number
}

export function ClinicMapOSM({ clinic, height = '400px', zoom = 15 }: ClinicMapOSMProps) {
  const mapRef = useRef<HTMLDivElement>(null)
  const mapInstanceRef = useRef<L.Map | null>(null)
  const markerRef = useRef<L.Marker | null>(null)

  useEffect(() => {
    if (!mapRef.current || !clinic.latitude || !clinic.longitude) return

    if (!mapInstanceRef.current) {
      console.log('[ClinicMap] Initializing map...', {
        clinic: clinic.name,
        coordinates: { lat: clinic.latitude, lng: clinic.longitude },
        hasMapTilesKey: !!env.GOONG_MAP_TILES_KEY,
        mapTilesKeyLength: env.GOONG_MAP_TILES_KEY?.length || 0,
      })

      // Initialize Leaflet map
      mapInstanceRef.current = L.map(mapRef.current, {
        center: [clinic.latitude, clinic.longitude],
        zoom: zoom,
        zoomControl: true,
        attributionControl: true,
      })

      // Add Goong Map tiles
      if (env.GOONG_MAP_TILES_KEY) {
        const goongTileUrl = `https://tiles.goong.io/assets/goong_map_web/{z}/{x}/{y}.png?api_key=${env.GOONG_MAP_TILES_KEY}`
        
        console.log('[ClinicMap] Initializing Goong map tiles...', {
          clinic: clinic.name,
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
          console.error('[ClinicMap] Goong tile error:', error)
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
        
        tileLayer.on('tileload', () => {
          console.log('[ClinicMap] Tile loaded successfully')
        })
        
        tileLayer.addTo(mapInstanceRef.current)
      } else {
        console.warn('[ClinicMap] No Goong Map Tiles Key, using OpenStreetMap fallback')
        // Fallback to OpenStreetMap
        L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
          maxZoom: 19,
          attribution: '© OpenStreetMap contributors',
        }).addTo(mapInstanceRef.current)
      }

      // Create custom marker icon (brutalist style)
      const icon = L.divIcon({
        className: 'custom-marker',
        html: `<div style="
          width: 24px;
          height: 24px;
          background-color: #d97706;
          border: 3px solid #1c1917;
          border-radius: 50%;
          box-shadow: 3px 3px 0 #1c1917;
        "></div>`,
        iconSize: [24, 24],
        iconAnchor: [12, 12],
      })

      // Add marker
      markerRef.current = L.marker([clinic.latitude, clinic.longitude], { icon })
        .addTo(mapInstanceRef.current)

      // Add popup
      markerRef.current.bindPopup(`
        <div style="padding: 8px; font-family: system-ui, sans-serif;">
          <div style="font-weight: 700; font-size: 14px; margin-bottom: 4px; text-transform: uppercase;">
            ${clinic.name}
          </div>
          <div style="font-size: 12px; color: #57534e;">
            ${clinic.address}
          </div>
        </div>
      `)
    } else {
      // Update map if clinic changes
      mapInstanceRef.current.setView([clinic.latitude, clinic.longitude], zoom)
      if (markerRef.current) {
        markerRef.current.setLatLng([clinic.latitude, clinic.longitude])
      }
    }

    return () => {
      if (mapInstanceRef.current) {
        mapInstanceRef.current.remove()
        mapInstanceRef.current = null
        markerRef.current = null
      }
    }
  }, [clinic, zoom])

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
    </div>
  )
}


