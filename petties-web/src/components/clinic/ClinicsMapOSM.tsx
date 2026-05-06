import { useEffect, useRef } from 'react'
import 'leaflet/dist/leaflet.css'
import L from 'leaflet'
import type { ClinicResponse, ClinicImage } from '../../types/clinic'
import { env } from '../../config/env'

interface ClinicsMapOSMProps {
  clinics: ClinicResponse[]
  height?: string
  zoom?: number
  center?: [number, number]
  onMarkerClick?: (clinicId: string) => void
  highlightedClinicId?: string | null
  userLocation?: { lat: number; lng: number } | null
}

export function ClinicsMapOSM({
  clinics,
  height = '600px',
  zoom = 13,
  center,
  onMarkerClick,
  highlightedClinicId,
  userLocation
}: ClinicsMapOSMProps) {
  const mapRef = useRef<HTMLDivElement>(null)
  const mapInstanceRef = useRef<L.Map | null>(null)
  const markersRef = useRef<Record<string, L.Marker>>({})
  const userMarkerRef = useRef<L.Marker | null>(null)

  useEffect(() => {
    if (!mapRef.current) return

    if (!mapInstanceRef.current) {
      // Default center: TP.HCM (or use the first clinic with coords)
      const firstWithCoords = clinics.find(c => c.latitude && c.longitude)
      const initialCenter: [number, number] = center ||
        (firstWithCoords ? [firstWithCoords.latitude!, firstWithCoords.longitude!] : [10.762622, 106.660172])

      mapInstanceRef.current = L.map(mapRef.current, {
        center: initialCenter,
        zoom: zoom,
        zoomControl: true,
        attributionControl: true,
      })

      // Add Tile Layer (Goong or OSM)
      const goongUrl = env.GOONG_MAP_TILES_KEY 
        ? `https://tiles.goong.io/assets/goong_map_web/{z}/{x}/{y}.png?api_key=${env.GOONG_MAP_TILES_KEY}`
        : null

      const tileLayer = L.tileLayer(goongUrl || 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        maxZoom: goongUrl ? 20 : 19,
        attribution: goongUrl ? '© Goong' : '© OpenStreetMap contributors',
      })
      
      tileLayer.addTo(mapInstanceRef.current)

      // Fallback to OSM if Goong tiles fail to load
      if (goongUrl) {
        tileLayer.on('tileerror', () => {
          console.warn('[ClinicsMap] Goong tiles failed to load, falling back to OSM')
          if (!mapInstanceRef.current) return
          mapInstanceRef.current.removeLayer(tileLayer)
          L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
            maxZoom: 19,
            attribution: '© OpenStreetMap contributors',
          }).addTo(mapInstanceRef.current)
        })
      }
    }

    // Handle User Location Marker
    if (userLocation && mapInstanceRef.current) {
      if (userMarkerRef.current) userMarkerRef.current.remove()
      
      const userIcon = L.divIcon({
        className: 'user-marker',
        html: `<div style="
          width: 24px;
          height: 24px;
          background-color: #3b82f6;
          border: 4px solid white;
          border-radius: 50%;
          box-shadow: 0 0 0 4px rgba(59, 130, 246, 0.4), 4px 4px 0 rgba(0,0,0,0.2);
        "></div>`,
        iconSize: [24, 24],
        iconAnchor: [12, 12],
      })

      userMarkerRef.current = L.marker([userLocation.lat, userLocation.lng], { icon: userIcon, zIndexOffset: 2000 })
        .addTo(mapInstanceRef.current)
        .bindPopup('<div style="font-weight: 800; text-transform: uppercase; font-size: 12px; font-family: system-ui;">Vị trí của bạn</div>')
    }

    // Force refresh logic
    const forceRefresh = () => {
        if (mapInstanceRef.current) {
            mapInstanceRef.current.invalidateSize()
        }
    }

    const resizeObserver = new ResizeObserver(() => forceRefresh())
    if (mapRef.current) resizeObserver.observe(mapRef.current)

    forceRefresh()
    const t1 = setTimeout(forceRefresh, 100)
    const t2 = setTimeout(forceRefresh, 500)

    // Clear old markers
    Object.values(markersRef.current).forEach(m => m.remove())
    markersRef.current = {}

    // Add new markers
    clinics.forEach(clinic => {
      if (!clinic.latitude || !clinic.longitude) return

      const isHighlighted = clinic.clinicId === highlightedClinicId

      // Get primary image or fallback to logo
      const primaryImg = clinic.imageDetails?.find(img => img.isPrimary)?.imageUrl || 
                         (typeof clinic.images?.[0] === 'string' ? clinic.images[0] : (clinic.images?.[0] as ClinicImage)?.imageUrl) ||
                         clinic.logo;

      const icon = L.divIcon({
        className: 'custom-marker',
        html: `<div style="
          width: ${isHighlighted ? '40px' : '32px'};
          height: ${isHighlighted ? '40px' : '32px'};
          background-color: ${isHighlighted ? '#f59e0b' : '#d97706'};
          border: 4px solid #1c1917;
          border-radius: 4px;
          box-shadow: ${isHighlighted ? '6px 6px 0 #1c1917' : '4px 4px 0 #1c1917'};
          transition: all 0.2s cubic-bezier(0.175, 0.885, 0.32, 1.275);
          display: flex;
          align-items: center;
          justify-content: center;
          transform: ${isHighlighted ? 'scale(1.2)' : 'scale(1)'};
          z-index: ${isHighlighted ? '1000' : '1'};
        ">
          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" style="width: 18px; height: 18px; color: white;">
            <path d="M11.584 2.376a.75.75 0 0 1 .832 0l9 6a.75.75 0 1 1-.832 1.248L12 3.901 3.416 9.624a.75.75 0 0 1-.832-1.248l9-6Z" />
            <path fill-rule="evenodd" d="M20.25 10.332v9.918H21a.75.75 0 0 1 0 1.5H3a.75.75 0 0 1 0-1.5h.75v-9.918a.75.75 0 0 1 .634-.74L12 8.126l7.616 1.465a.75.75 0 0 1 .634.741ZM4.5 20.25h15V11.06l-7.5-1.444-7.5 1.444v9.19ZM8.25 13.5a.75.75 0 0 1 .75-.75h1.5a.75.75 0 0 1 .75.75v3a.75.75 0 0 1-.75.75H9a.75.75 0 0 1-.75-.75v-3Zm5.25-.75a.75.75 0 0 0-.75.75v3c0 .414.336.75.75.75h1.5a.75.75 0 0 0 .75-.75v-3a.75.75 0 0 0-.75-.75h-1.5Z" clip-rule="evenodd" />
          </svg>
        </div>`,
        iconSize: isHighlighted ? [40, 40] : [32, 32],
        iconAnchor: isHighlighted ? [20, 20] : [16, 16],
      })

      const marker = L.marker([clinic.latitude, clinic.longitude], { icon })
        .addTo(mapInstanceRef.current!)
        .on('click', () => {
          if (onMarkerClick) onMarkerClick(clinic.clinicId)
        })

      marker.bindPopup(`
        <div style="width: 240px; padding: 0; font-family: system-ui, sans-serif; overflow: hidden; border: 3px solid #1c1917; box-shadow: 6px 6px 0 #1c1917;">
          <div style="height: 120px; background-color: #f59e0b; overflow: hidden; border-bottom: 3px solid #1c1917; position: relative;">
            ${primaryImg ? 
              `<img src="${primaryImg}" style="width: 100%; height: 100%; object-fit: cover;" />` : 
              `<div style="width: 100%; height: 100%; display: flex; align-items: center; justify-content: center; font-weight: 900; color: white; font-size: 20px;">PETTIES</div>`
            }
            ${clinic.logo ? `<img src="${clinic.logo}" style="position: absolute; bottom: 8px; left: 8px; width: 32px; height: 32px; border: 2px solid #1c1917; background: white; padding: 2px; box-shadow: 2px 2px 0 #1c1917;" />` : ''}
          </div>
          <div style="padding: 12px; background: white;">
            <div style="font-weight: 900; font-size: 15px; text-transform: uppercase; margin-bottom: 6px; color: #1c1917; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">${clinic.name}</div>
            
            <div style="display: flex; align-items: start; gap: 4px; margin-bottom: 8px;">
               <div style="color: #d97706; margin-top: 2px; flex-shrink: 0;">
                 <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" style="width: 14px; height: 14px;">
                   <path fill-rule="evenodd" d="m9.69 18.933.003.001C9.89 19.02 10 19 10 19s.11.02.308-.066l.002-.001.006-.003.018-.008a5.741 5.741 0 0 0 .281-.14c.186-.096.446-.24.757-.433.62-.384 1.445-.966 2.274-1.765C15.302 14.988 17 12.493 17 9A7 7 0 1 0 3 9c0 3.492 1.698 5.988 3.355 7.584a13.731 13.731 0 0 0 2.273 1.765 11.842 11.842 0 0 0 .976.544l.062.029.017.008.006.003ZM10 11.25a2.25 2.25 0 1 0 0-4.5 2.25 2.25 0 0 0 0 4.5Z" clip-rule="evenodd" />
                 </svg>
               </div>
               <div style="font-size: 11px; color: #57534e; font-weight: 600; line-height: 1.3;">${clinic.address}</div>
            </div>

            <p style="font-size: 10px; color: #78716c; margin-bottom: 12px; line-clamp: 2; display: -webkit-box; -webkit-box-orient: vertical; overflow: hidden; font-style: italic;">
              ${clinic.description || 'Chưa có mô tả chi tiết cho phòng khám này.'}
            </p>

            <button 
              onclick="window.dispatchEvent(new CustomEvent('open-clinic-detail', { detail: '${clinic.clinicId}' }))"
              style="width: 100%; background: #1c1917; color: white; border: none; padding: 8px 0; font-weight: 900; font-size: 11px; text-transform: uppercase; cursor: pointer; border: 3px solid #1c1917; box-shadow: 3px 3px 0 #d97706; transition: all 0.1s;"
              onmousedown="this.style.transform='translate(2px, 2px)'; this.style.boxShadow='1px 1px 0 #d97706'"
              onmouseup="this.style.transform='translate(0, 0)'; this.style.boxShadow='3px 3px 0 #d97706'"
            >
              Xem chi tiết
            </button>
          </div>
        </div>
      `, {
        maxWidth: 250,
        className: 'brutal-popup'
      })

      markersRef.current[clinic.clinicId] = marker
    })

    // If highlighted, center on it
    if (highlightedClinicId && markersRef.current[highlightedClinicId]) {
      const hMarker = markersRef.current[highlightedClinicId]
      mapInstanceRef.current.setView(hMarker.getLatLng(), zoom + 1)
      hMarker.openPopup()
    } else if (clinics.length > 0 && !center) {
        // Fit bounds if no center specified and we have clinics
        const coords = clinics.filter(c => c.latitude && c.longitude).map(c => [c.latitude!, c.longitude!] as [number, number])
        if (coords.length > 0) {
            mapInstanceRef.current.fitBounds(coords, { padding: [50, 50] })
        }
    }

    return () => {
        clearTimeout(t1)
        clearTimeout(t2)
        resizeObserver.disconnect()
    }

  }, [clinics, highlightedClinicId, zoom, center, onMarkerClick, userLocation])

  return (
    <div className="card-brutal overflow-hidden h-full w-full">
      <div
        ref={mapRef}
        style={{ height, width: '100%' }}
        className="bg-stone-200 h-full w-full"
      />
    </div>
  )
}
