import { useState, useEffect } from 'react'
import { useSearchParams } from 'react-router-dom'
import { MagnifyingGlassIcon, MapPinIcon, StarIcon, AdjustmentsHorizontalIcon } from '@heroicons/react/24/outline'
import { clinicService } from '../../services/api/clinicService'
import type { ClinicResponse } from '../../types/clinic'
import { ClinicLogoDisplay } from '../../components/clinic/ClinicLogoDisplay'
import { ClinicsMapOSM } from '../../components/clinic/ClinicsMapOSM'
import { NavigationBar } from '../../components/onboarding/NavigationBar'
import { ExploreClinicDetailModal } from './components/ExploreClinicDetailModal'

export default function ExploreClinicsPage() {
  const [searchParams, setSearchParams] = useSearchParams()
  const initialQuery = searchParams.get('q') || ''
  
  const [searchQuery, setSearchQuery] = useState(initialQuery)
  const [clinics, setClinics] = useState<ClinicResponse[]>([])
  const [loading, setLoading] = useState(true)
  const [selectedClinicId, setSelectedClinicId] = useState<string | null>(null)
  const [isDetailOpen, setIsDetailOpen] = useState(false)
  
  // Filters
  const [ratingFilter, setRatingFilter] = useState<number>(0)
  const [nearMe, setNearMe] = useState(false)
  const [userLocation, setUserLocation] = useState<{lat: number, lng: number} | null>(null)

  useEffect(() => {
    fetchClinics()
  }, [initialQuery, ratingFilter, nearMe])

  useEffect(() => {
    const handleOpenDetail = (e: any) => {
      if (e.detail) {
        openClinicDetail(e.detail)
      }
    }
    window.addEventListener('open-clinic-detail', handleOpenDetail)
    return () => window.removeEventListener('open-clinic-detail', handleOpenDetail)
  }, [])

  const fetchClinics = async () => {
    setLoading(true)
    try {
      let data: ClinicResponse[] = []
      
      if (nearMe && userLocation) {
        const res = await clinicService.findNearbyClinics({
          latitude: userLocation.lat,
          longitude: userLocation.lng,
          radius: 10
        })
        data = res.content
      } else if (initialQuery) {
        const res = await clinicService.searchClinics(initialQuery)
        data = res.content
      } else {
        // Use search with empty string to get all approved clinics publicly
        const res = await clinicService.searchClinics('')
        data = res.content
      }
      
      // Filter by rating locally
      if (ratingFilter > 0) {
        data = data.filter(c => c.ratingAvg >= ratingFilter)
      }
      
      setClinics(data)
    } catch (error) {
      console.error('Error fetching clinics:', error)
    } finally {
      setLoading(false)
    }
  }

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault()
    setSearchParams({ q: searchQuery })
  }

  const handleNearMeToggle = () => {
    if (!nearMe) {
      if ('geolocation' in navigator) {
        navigator.geolocation.getCurrentPosition((pos) => {
          setUserLocation({ lat: pos.coords.latitude, lng: pos.coords.longitude })
          setNearMe(true)
        }, (err) => {
          alert('Không thể lấy vị trí của bạn. Vui lòng cho phép truy cập vị trí.')
        })
      }
    } else {
      setNearMe(false)
    }
  }

  const openClinicDetail = (id: string) => {
    setSelectedClinicId(id)
    setIsDetailOpen(true)
  }

  const closeClinicDetail = () => {
    setIsDetailOpen(false)
    setSelectedClinicId(null)
  }

  return (
    <div className="min-h-screen bg-stone-50 flex flex-col">
      <NavigationBar />
      
      <main className="flex-1 flex flex-col md:flex-row pt-20">
        {/* Left Sidebar: Search & List */}
        <div className="w-full md:w-[400px] lg:w-[450px] h-[calc(100vh-80px)] overflow-y-auto border-r-4 border-stone-900 p-6 bg-white z-10 shadow-brutal">
          <form onSubmit={handleSearch} className="mb-6">
            <div className="relative group">
              <input
                type="text"
                placeholder="Tìm tên phòng khám, địa chỉ..."
                className="w-full pl-12 pr-4 py-4 border-4 border-stone-900 shadow-brutal-sm focus:outline-none focus:ring-0 text-lg font-bold placeholder:text-stone-400 group-hover:-translate-x-1 group-hover:-translate-y-1 transition-transform bg-white"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
              <MagnifyingGlassIcon className="absolute left-4 top-4.5 h-6 w-6 text-stone-900" />
            </div>
          </form>

          <div className="space-y-6 mb-8">
            <button 
              onClick={handleNearMeToggle}
              className={`w-full flex items-center justify-center gap-3 py-3 border-4 font-black uppercase transition-all shadow-brutal-sm active:shadow-none active:translate-x-1 active:translate-y-1 ${nearMe ? 'bg-amber-500 text-white border-stone-900' : 'bg-white text-stone-900 border-stone-900 hover:bg-stone-50'}`}
            >
              <MapPinIcon className="h-6 w-6" />
              {nearMe ? 'Đang tìm gần đây' : 'Tìm quanh đây'}
            </button>

            <div className="flex flex-col gap-2">
              <span className="text-xs font-black uppercase text-stone-500 tracking-wider">Lọc theo đánh giá:</span>
              <div className="flex gap-2">
                {[1, 2, 3, 4, 5].map(star => (
                  <button
                    key={star}
                    onClick={() => setRatingFilter(ratingFilter === star ? 0 : star)}
                    className={`flex-1 flex items-center justify-center py-2 border-4 border-stone-900 shadow-brutal-xs transition-all active:shadow-none active:translate-y-0.5 ${ratingFilter >= star ? 'bg-amber-400' : 'bg-white hover:bg-stone-50'}`}
                  >
                    <StarIcon className={`h-5 w-5 ${ratingFilter >= star ? 'fill-stone-900 text-stone-900' : 'text-stone-300'}`} />
                  </button>
                ))}
              </div>
            </div>
          </div>

          <div className="space-y-6">
            <div className="flex items-center justify-between border-b-4 border-stone-900 pb-2">
               <h2 className="text-xl font-black uppercase tracking-tight">
                 Kết quả ({clinics.length})
               </h2>
               {loading && <div className="h-5 w-5 animate-spin rounded-full border-2 border-amber-600 border-t-transparent" />}
            </div>
            
            <div className="space-y-6 pb-10">
              {loading && clinics.length === 0 ? (
                <div className="py-20 text-center">
                  <div className="inline-block h-12 w-12 animate-spin rounded-full border-4 border-amber-600 border-t-transparent mb-4"></div>
                  <p className="font-black uppercase text-stone-500 text-sm tracking-widest">Đang tải phòng khám...</p>
                </div>
              ) : clinics.length > 0 ? (
                clinics.map(clinic => (
                  <div 
                    key={clinic.clinicId} 
                    onClick={() => setSelectedClinicId(clinic.clinicId)} 
                    className="cursor-pointer group"
                  >
                    <div className={`p-5 border-4 border-stone-900 shadow-brutal transition-all group-hover:-translate-x-1 group-hover:-translate-y-1 active:translate-x-0 active:translate-y-0 active:shadow-none ${selectedClinicId === clinic.clinicId ? 'bg-amber-50 ring-4 ring-amber-400 ring-offset-2' : 'bg-white'}`}>
                      <div className="flex gap-4">
                        <div className="w-20 h-20 flex-shrink-0">
                          <ClinicLogoDisplay 
                            logoUrl={clinic.logo} 
                            alt={clinic.name} 
                            size="md" 
                            className="w-full h-full border-4 border-stone-900 shadow-brutal-xs bg-stone-50"
                          />
                        </div>
                        <div className="flex-1 min-w-0">
                          <h3 className="font-black text-stone-900 truncate text-lg group-hover:text-amber-600 transition-colors uppercase leading-tight">
                            {clinic.name}
                          </h3>
                          <div className="flex items-center gap-2 mt-1 mb-2">
                             <div className="flex items-center gap-0.5 bg-amber-400 border-2 border-stone-900 px-1.5 py-0.5 shadow-brutal-xs">
                               <StarIcon className="h-3.5 w-3.5 fill-stone-900" />
                               <span className="text-xs font-black">{clinic.ratingAvg.toFixed(1)}</span>
                             </div>
                             <span className="text-[10px] font-black text-stone-400 uppercase tracking-tighter">({clinic.ratingCount} đánh giá)</span>
                          </div>
                          <p className="text-xs text-stone-600 font-bold line-clamp-2 leading-snug">
                            <MapPinIcon className="h-3 w-3 inline mr-1" />
                            {clinic.address}
                          </p>
                        </div>
                      </div>
                      <button 
                        type="button"
                        onClick={(e) => { e.stopPropagation(); openClinicDetail(clinic.clinicId) }}
                        className="mt-4 w-full py-3 border-4 border-stone-900 bg-stone-900 text-white font-black uppercase text-xs tracking-widest hover:bg-stone-800 transition-colors shadow-brutal-sm"
                      >
                        Xem chi tiết
                      </button>
                    </div>
                  </div>
                ))
              ) : (
                <div className="py-20 text-center border-4 border-dashed border-stone-300 bg-stone-50">
                  <p className="text-stone-500 font-black uppercase text-xs tracking-widest">Không tìm thấy phòng khám nào</p>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Right Content: Map */}
        <div className="flex-1 h-[500px] md:h-[calc(100vh-80px)] relative z-0">
          <ClinicsMapOSM 
            clinics={clinics} 
            height="100%" 
            highlightedClinicId={selectedClinicId}
            userLocation={userLocation}
            onMarkerClick={(id) => {
              setSelectedClinicId(id)
            }}
          />
        </div>
      </main>

      {selectedClinicId && (
        <ExploreClinicDetailModal 
          isOpen={isDetailOpen} 
          onClose={closeClinicDetail} 
          clinicId={selectedClinicId} 
        />
      )}
    </div>
  )
}
