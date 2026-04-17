// AI-driven UI component

interface Clinic {
  id: string
  name: string
  address: string
  logo?: string
  rating?: number
  distance?: string
}

interface ClinicListProps {
  data: {
    items: Clinic[]
  }
}

export function ClinicList({ data }: ClinicListProps) {
  if (!data.items || data.items.length === 0) {
    return (
      <div className="bg-white border-2 border-stone-900 p-4 rounded-xl shadow-[4px_4px_0_#1c1917] text-center italic text-stone-500 text-sm">
        Không tìm thấy phòng khám phù hợp
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-4">
      {data.items.slice(0, 3).map((clinic) => (
        <div key={clinic.id} className="bg-white border-2 border-stone-900 rounded-xl p-4 shadow-[4px_4px_0_#1c1917] flex gap-4 hover:-translate-y-0.5 transition-transform cursor-pointer">
          {clinic.logo ? (
            <img 
              src={clinic.logo} 
              alt={clinic.name} 
              className="w-16 h-16 rounded-lg object-cover border-2 border-stone-900"
            />
          ) : (
            <div className="w-16 h-16 rounded-lg bg-amber-100 border-2 border-stone-900 flex items-center justify-center text-amber-600">
              <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
              </svg>
            </div>
          )}
          
          <div className="flex flex-col flex-grow justify-between py-1">
            <div>
              <h4 className="font-bold text-stone-900 text-sm">{clinic.name}</h4>
              <p className="text-[11px] text-stone-500 line-clamp-2 mt-1 leading-snug">{clinic.address}</p>
            </div>
            
            <div className="flex items-center gap-3 mt-2">
              {clinic.rating && (
                <div className="flex items-center gap-1 bg-yellow-400 border-2 border-stone-900 px-1.5 py-0.5 rounded-lg text-[10px] font-bold">
                  <span>★</span>
                  <span>{clinic.rating}</span>
                </div>
              )}
              {clinic.distance && (
                <span className="text-[10px] font-bold text-stone-700 uppercase">
                  Cách đây {clinic.distance}
                </span>
              )}
            </div>
          </div>
        </div>
      ))}
    </div>
  )
}
