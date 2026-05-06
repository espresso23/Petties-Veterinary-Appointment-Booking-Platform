import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { MagnifyingGlassIcon, MapPinIcon } from '@heroicons/react/24/outline'

export const ExplorePreviewSection = () => {
  const [query, setQuery] = useState('')
  const navigate = useNavigate()

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault()
    navigate(`/explore?q=${encodeURIComponent(query)}`)
  }

  return (
    <section className="py-20 bg-amber-50 border-y-4 border-stone-900">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 items-center">
          <div>
            <h2 className="text-4xl sm:text-5xl font-black uppercase text-stone-900 mb-6 leading-tight">
              Khám Phá <span className="text-amber-600">Phòng Khám</span> Gần Bạn
            </h2>
            <p className="text-xl text-stone-700 mb-8 font-medium">
              Tìm kiếm các phòng khám thú y uy tín, xem dịch vụ và đội ngũ bác sĩ ngay lập tức mà không cần đăng nhập.
            </p>
            
            <form onSubmit={handleSearch} className="flex flex-col sm:flex-row gap-4">
              <div className="flex-1 relative">
                <input
                  type="text"
                  placeholder="Tên phòng khám hoặc địa chỉ..."
                  className="w-full pl-12 pr-4 py-4 border-4 border-stone-900 shadow-brutal focus:outline-none focus:ring-0 text-lg font-bold"
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                />
                <MagnifyingGlassIcon className="absolute left-4 top-4.5 h-6 w-6 text-stone-400" />
              </div>
              <button
                type="submit"
                className="btn-brutal bg-stone-900 text-white px-8 py-4 text-lg"
              >
                Tìm Kiếm
              </button>
            </form>
            
            <div className="mt-8 flex flex-wrap gap-4">
              <button 
                onClick={() => navigate('/explore')}
                className="flex items-center gap-2 font-bold text-stone-600 hover:text-stone-900 transition-colors uppercase text-sm"
              >
                <MapPinIcon className="h-5 w-5" />
                Xem tất cả trên bản đồ
              </button>
            </div>
          </div>
          
          <div className="relative">
            <div className="border-4 border-stone-900 shadow-brutal overflow-hidden bg-white rotate-2 hover:rotate-0 transition-transform duration-500">
               <img 
                 src="https://images.unsplash.com/photo-1583337130417-3346a1be7dee?auto=format&fit=crop&q=80&w=800" 
                 alt="Explore Clinics" 
                 className="w-full h-80 object-cover"
               />
               <div className="p-4 bg-white border-t-4 border-stone-900">
                 <div className="flex justify-between items-center">
                   <div>
                     <div className="font-black uppercase text-stone-900">Petties Central Clinic</div>
                     <div className="text-xs text-stone-500 font-bold uppercase">Quận 1, TP. Hồ Chí Minh</div>
                   </div>
                   <div className="bg-amber-400 border-2 border-stone-900 px-2 py-1 font-black text-xs">
                     4.9 ★
                   </div>
                 </div>
               </div>
            </div>
            
            {/* Decoration elements */}
            <div className="absolute -bottom-6 -left-6 w-24 h-24 bg-amber-400 border-4 border-stone-900 -z-10 shadow-brutal"></div>
            <div className="absolute -top-6 -right-6 w-32 h-32 bg-stone-900 -z-10 shadow-brutal opacity-10"></div>
          </div>
        </div>
      </div>
    </section>
  )
}
