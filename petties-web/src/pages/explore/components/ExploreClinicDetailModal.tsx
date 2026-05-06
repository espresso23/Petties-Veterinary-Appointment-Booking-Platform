import { useState, useEffect } from 'react'
import { XMarkIcon, StarIcon, MapPinIcon, PhoneIcon, EnvelopeIcon, UserGroupIcon, BeakerIcon, ClockIcon, ChevronLeftIcon, ChevronRightIcon } from '@heroicons/react/24/outline'
import { clinicService } from '../../../services/api/clinicService'
import { getServicesByClinicId } from '../../../services/endpoints/service'
import { clinicStaffService } from '../../../services/api/clinicStaffService'
import type { ClinicResponse, ClinicImage } from '../../../types/clinic'
import type { ClinicServiceResponse } from '../../../types/service'
import type { StaffMember } from '../../../types/clinicStaff'
import { ClinicLogoDisplay } from '../../../components/clinic/ClinicLogoDisplay'
import { ClinicMapOSM } from '../../../components/clinic/ClinicMapOSM'

interface ExploreClinicDetailModalProps {
  isOpen: boolean
  onClose: () => void
  clinicId: string
}

export function ExploreClinicDetailModal({ isOpen, onClose, clinicId }: ExploreClinicDetailModalProps) {
  const [clinic, setClinic] = useState<ClinicResponse | null>(null)
  const [services, setServices] = useState<ClinicServiceResponse[]>([])
  const [staff, setStaff] = useState<StaffMember[]>([])
  const [loading, setLoading] = useState(true)
  const [activeTab, setActiveTab] = useState<'info' | 'services' | 'staff'>('info')
  const [currentImageIndex, setCurrentImageIndex] = useState(0)
  const [selectedPreviewImage, setSelectedPreviewImage] = useState<string | null>(null)

  useEffect(() => {
    if (isOpen && clinicId) {
      fetchClinicDetails()
    }
  }, [isOpen, clinicId])

  const fetchClinicDetails = async () => {
    setLoading(true)
    try {
      const [clinicData, servicesData, staffData] = await Promise.all([
        clinicService.getClinicById(clinicId),
        getServicesByClinicId(clinicId),
        clinicStaffService.getPublicStaff(clinicId)
      ])
      setClinic(clinicData)
      // Only show active services for guests
      setServices((servicesData || []).filter(s => s.isActive))
      setStaff(staffData || [])
    } catch (error) {
      console.error('Error fetching clinic details:', error)
    } finally {
      setLoading(false)
    }
  }

  const images: ClinicImage[] = clinic?.imageDetails || []
  const primaryImage = images.find(img => img.isPrimary) || images[0]

  const nextImage = () => {
    setCurrentImageIndex((prev) => (prev + 1) % images.length)
  }

  const prevImage = () => {
    setCurrentImageIndex((prev) => (prev - 1 + images.length) % images.length)
  }

  // Refined staff grouping: strictly by specialty to avoid duplicates
  const vets = staff.filter(s => s.specialty === 'VET')
  const groomers = staff.filter(s => s.specialty === 'GROOMER')
  const others = staff.filter(s => s.specialty !== 'VET' && s.specialty !== 'GROOMER')

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-stone-900/50 backdrop-blur-sm">
      <div className="bg-white border-4 border-stone-900 shadow-[12px_12px_0_#1c1917] w-full max-w-5xl max-h-[95vh] overflow-hidden flex flex-col">
        {/* Header with Hero Image */}
        <div className="relative h-48 sm:h-64 border-b-4 border-stone-900 bg-stone-200 overflow-hidden">
          {primaryImage ? (
            <img src={primaryImage.imageUrl} alt={clinic?.name} className="w-full h-full object-cover" />
          ) : (
            <div className="w-full h-full flex items-center justify-center bg-stone-100 italic font-black text-stone-300 text-4xl">PETTIES CLINIC</div>
          )}
          
          {/* Enhanced Overlay for text readability */}
          <div className="absolute inset-0 bg-gradient-to-t from-stone-900 via-stone-900/40 to-transparent"></div>
          
          <div className="absolute bottom-6 left-6 right-20 flex gap-4 items-end z-10">
            <div className="w-20 h-20 sm:w-24 sm:h-24 border-4 border-stone-900 bg-white p-1 flex-shrink-0 shadow-brutal-sm">
              <ClinicLogoDisplay logoUrl={clinic?.logo} alt={clinic?.name || 'Clinic'} size="md" className="w-full h-full border-0 shadow-none" />
            </div>
            <div className="mb-1">
              <h2 className="text-2xl sm:text-3xl font-black uppercase text-white tracking-tight drop-shadow-[0_2px_4px_rgba(0,0,0,0.8)]">{clinic?.name}</h2>
              <div className="flex items-center gap-3 mt-1">
                <div className="flex items-center gap-1 bg-amber-400 border-2 border-stone-900 px-2 py-0.5 shadow-brutal-xs">
                  <StarIcon className="h-4 w-4 fill-stone-900 text-stone-900" />
                  <span className="font-black text-xs">{clinic?.ratingAvg.toFixed(1)}</span>
                </div>
                <span className="text-white font-black uppercase text-[10px] tracking-wider drop-shadow-lg">{clinic?.ratingCount} đánh giá</span>
              </div>
            </div>
          </div>

          <button 
            type="button"
            onClick={onClose} 
            className="absolute top-4 right-4 p-2 border-4 border-stone-900 bg-white hover:bg-stone-100 shadow-brutal-sm active:shadow-none active:translate-x-1 active:translate-y-1 transition-all z-20"
          >
            <XMarkIcon className="h-6 w-6 text-stone-900" />
          </button>
        </div>

        {/* Info bar (Address) */}
        <div className="px-6 py-3 bg-stone-900 text-white flex items-center gap-2 overflow-hidden border-b-4 border-stone-900">
           <MapPinIcon className="h-5 w-5 text-amber-400 flex-shrink-0" />
           <span className="font-bold text-xs sm:text-sm truncate uppercase tracking-tight">{clinic?.address}</span>
        </div>

        {/* Tabs */}
        <div className="flex border-b-4 border-stone-900 bg-stone-100">
          <button
            type="button"
            onClick={() => setActiveTab('info')}
            className={`flex-1 py-4 font-black uppercase text-[10px] sm:text-xs border-r-4 border-stone-900 transition-all ${activeTab === 'info' ? 'bg-white text-amber-600' : 'hover:bg-stone-200'}`}
          >
            Thông tin
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('services')}
            className={`flex-1 py-4 font-black uppercase text-[10px] sm:text-xs border-r-4 border-stone-900 transition-all ${activeTab === 'services' ? 'bg-white text-amber-600' : 'hover:bg-stone-200'}`}
          >
            Dịch vụ ({services.length})
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('staff')}
            className={`flex-1 py-4 font-black uppercase text-[10px] sm:text-xs transition-all ${activeTab === 'staff' ? 'bg-white text-amber-600' : 'hover:bg-stone-200'}`}
          >
            Đội ngũ
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6 sm:p-8 bg-stone-50">
          {loading ? (
            <div className="flex flex-col items-center justify-center py-20">
              <div className="h-16 w-16 animate-spin rounded-full border-8 border-amber-600 border-t-transparent mb-6"></div>
              <p className="font-black uppercase text-stone-400 tracking-[0.2em]">Đang tải dữ liệu...</p>
            </div>
          ) : (
            <>
              {activeTab === 'info' && (
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                  <div className="space-y-8">
                    {/* Image Slider like mobile */}
                    {images.length > 0 && (
                      <section>
                         <h3 className="text-lg font-black uppercase mb-4 flex items-center gap-2">
                           <span className="w-2 h-6 bg-amber-500 border-2 border-stone-900"></span>
                           Hình ảnh phòng khám
                         </h3>
                         <div className="relative group border-4 border-stone-900 shadow-brutal bg-stone-200 aspect-video overflow-hidden">
                           <img 
                             src={images[currentImageIndex].imageUrl} 
                             alt={images[currentImageIndex].caption || 'Clinic'} 
                             className="w-full h-full object-cover transition-opacity duration-500 cursor-zoom-in"
                             onClick={() => setSelectedPreviewImage(images[currentImageIndex].imageUrl)}
                           />
                           
                           {images.length > 1 && (
                             <>
                               <button 
                                 type="button"
                                 onClick={prevImage}
                                 className="absolute left-2 top-1/2 -translate-y-1/2 p-2 bg-white/90 border-2 border-stone-900 shadow-brutal-xs opacity-0 group-hover:opacity-100 transition-opacity"
                               >
                                 <ChevronLeftIcon className="h-6 w-6" />
                               </button>
                               <button 
                                 type="button"
                                 onClick={nextImage}
                                 className="absolute right-2 top-1/2 -translate-y-1/2 p-2 bg-white/90 border-2 border-stone-900 shadow-brutal-xs opacity-0 group-hover:opacity-100 transition-opacity"
                               >
                                 <ChevronRightIcon className="h-6 w-6" />
                               </button>
                               
                               <div className="absolute bottom-4 left-1/2 -translate-x-1/2 flex gap-2">
                                 {images.map((_, idx) => (
                                   <div 
                                     key={idx} 
                                     className={`w-2 h-2 border border-stone-900 ${idx === currentImageIndex ? 'bg-amber-400 w-4' : 'bg-white'} transition-all`}
                                   ></div>
                                 ))}
                               </div>
                             </>
                           )}
                           
                           {images[currentImageIndex].caption && (
                             <div className="absolute top-4 left-4 bg-stone-900/80 text-white text-[10px] font-bold px-2 py-1 uppercase">
                               {images[currentImageIndex].caption}
                             </div>
                           )}
                         </div>
                      </section>
                    )}

                    <section>
                      <h3 className="text-lg font-black uppercase mb-4 flex items-center gap-2">
                        <span className="w-2 h-6 bg-amber-500 border-2 border-stone-900"></span>
                        Giới thiệu
                      </h3>
                      <div className="p-6 border-4 border-stone-900 bg-white shadow-brutal-sm leading-relaxed text-stone-700 font-medium">
                        {clinic?.description || 'Phòng khám chưa cập nhật thông tin giới thiệu.'}
                      </div>
                    </section>
                    
                    <section className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div className="p-4 bg-white border-4 border-stone-900 shadow-brutal-sm">
                        <h4 className="font-black uppercase text-[10px] text-stone-400 mb-3 tracking-widest">Liên hệ</h4>
                        <div className="space-y-2">
                          <div className="flex items-center gap-3">
                            <PhoneIcon className="h-5 w-5 text-amber-600 flex-shrink-0" />
                            <span className="text-stone-900 font-bold text-sm">{clinic?.phone}</span>
                          </div>
                          <div className="flex items-center gap-3">
                            <EnvelopeIcon className="h-5 w-5 text-amber-600 flex-shrink-0" />
                            <span className="text-stone-900 font-bold text-sm truncate">{clinic?.email}</span>
                          </div>
                        </div>
                      </div>
                      
                      <div className="p-4 bg-white border-4 border-stone-900 shadow-brutal-sm">
                        <h4 className="font-black uppercase text-[10px] text-stone-400 mb-3 tracking-widest">Giờ mở cửa</h4>
                        <div className="flex items-center gap-3">
                           <ClockIcon className="h-5 w-5 text-amber-600 flex-shrink-0" />
                           <p className="text-stone-900 font-bold text-sm">8:00 - 20:00</p>
                        </div>
                        <p className="mt-1 text-[9px] text-stone-400 font-bold uppercase italic">* Mở cửa hàng ngày</p>
                      </div>
                    </section>
                  </div>

                  <section className="flex flex-col h-full">
                    <h3 className="text-lg font-black uppercase mb-4 flex items-center gap-2">
                      <span className="w-2 h-6 bg-amber-500 border-2 border-stone-900"></span>
                      Vị trí
                    </h3>
                    <div className="flex-1 min-h-[300px] border-4 border-stone-900 shadow-brutal relative z-0">
                      {clinic && <ClinicMapOSM clinic={clinic} height="100%" zoom={16} />}
                    </div>
                  </section>
                </div>
              )}

              {activeTab === 'services' && (
                <div className="space-y-6">
                  <h3 className="text-xl font-black uppercase mb-6 flex items-center gap-2">
                    <span className="w-3 h-8 bg-amber-500 border-2 border-stone-900"></span>
                    Dịch vụ nổi bật
                  </h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    {services.length > 0 ? (
                      services.map(svc => (
                        <div key={svc.serviceId} className="p-6 border-4 border-stone-900 bg-white shadow-brutal hover:-translate-y-1 transition-all flex flex-col justify-between">
                          <div>
                            <div className="flex justify-between items-start mb-3 gap-2">
                              <h4 className="font-black text-lg text-stone-900 uppercase leading-tight">{svc.name}</h4>
                              <div className="text-right">
                                <div className="font-black text-xl text-amber-600 tracking-tighter">{(svc.basePrice || 0).toLocaleString()}đ</div>
                              </div>
                            </div>
                            <div className="flex gap-2 mb-4">
                              {svc.isHomeVisit && <span className="px-2 py-0.5 bg-blue-500 text-white text-[10px] font-black uppercase border-2 border-stone-900">Tại nhà</span>}
                              <span className="px-2 py-0.5 bg-stone-900 text-white text-[10px] font-black uppercase border-2 border-stone-900">{svc.durationTime || 0} phút</span>
                            </div>
                            <p className="text-xs text-stone-500 font-medium leading-relaxed border-t-2 border-stone-50 pt-3">{svc.description || 'Không có mô tả chi tiết cho dịch vụ này.'}</p>
                          </div>
                        </div>
                      ))
                    ) : (
                      <div className="col-span-full py-20 text-center border-4 border-dashed border-stone-300 bg-white">
                        <BeakerIcon className="h-12 w-12 text-stone-300 mx-auto mb-4" />
                        <p className="text-stone-400 font-black uppercase tracking-widest text-sm">Hiện chưa có dịch vụ nào công khai</p>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {activeTab === 'staff' && (
                <div className="space-y-12">
                  {vets.length > 0 && (
                    <section>
                      <h3 className="text-lg font-black uppercase mb-8 flex items-center gap-2">
                        <span className="w-2 h-6 bg-blue-500 border-2 border-stone-900"></span>
                        Bác sĩ thú y
                      </h3>
                      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-8">
                        {vets.map(member => (
                          <div key={member.userId} className="text-center group">
                            <div className="relative w-28 h-28 sm:w-32 sm:h-32 mx-auto mb-4">
                              <div className="absolute inset-0 bg-stone-900 border-4 border-stone-900 translate-x-2 translate-y-2"></div>
                              <div className="relative w-full h-full border-4 border-stone-900 bg-white overflow-hidden group-hover:-translate-x-1 group-hover:-translate-y-1 transition-transform">
                                {member.avatar ? (
                                  <img src={member.avatar} alt={member.fullName} className="w-full h-full object-cover" />
                                ) : (
                                  <div className="w-full h-full flex items-center justify-center text-3xl bg-stone-100 italic font-black text-stone-200">PET</div>
                                )}
                              </div>
                            </div>
                            <div className="font-black text-stone-900 uppercase text-xs sm:text-sm mb-1 px-2 line-clamp-1">{member.fullName}</div>
                            <div className="text-[9px] font-black uppercase text-blue-600 tracking-tighter">Bác sĩ thú y</div>
                          </div>
                        ))}
                      </div>
                    </section>
                  )}

                  {groomers.length > 0 && (
                    <section>
                      <h3 className="text-lg font-black uppercase mb-8 flex items-center gap-2">
                        <span className="w-2 h-6 bg-pink-500 border-2 border-stone-900"></span>
                        Chuyên viên Grooming
                      </h3>
                      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-8">
                        {groomers.map(member => (
                          <div key={member.userId} className="text-center group">
                            <div className="relative w-28 h-28 sm:w-32 sm:h-32 mx-auto mb-4">
                              <div className="absolute inset-0 bg-stone-900 border-4 border-stone-900 translate-x-2 translate-y-2"></div>
                              <div className="relative w-full h-full border-4 border-stone-900 bg-white overflow-hidden group-hover:-translate-x-1 group-hover:-translate-y-1 transition-transform">
                                {member.avatar ? (
                                  <img src={member.avatar} alt={member.fullName} className="w-full h-full object-cover" />
                                ) : (
                                  <div className="w-full h-full flex items-center justify-center text-3xl bg-stone-100 italic font-black text-stone-200">PET</div>
                                )}
                              </div>
                            </div>
                            <div className="font-black text-stone-900 uppercase text-xs sm:text-sm mb-1 px-2 line-clamp-1">{member.fullName}</div>
                            <div className="text-[9px] font-black uppercase text-pink-600 tracking-tighter">Nhân viên chăm sóc thú cưng</div>
                          </div>
                        ))}
                      </div>
                    </section>
                  )}

                  {others.length > 0 && (
                    <section>
                      <h3 className="text-lg font-black uppercase mb-8 flex items-center gap-2">
                        <span className="w-2 h-6 bg-stone-500 border-2 border-stone-900"></span>
                        Nhân viên khác
                      </h3>
                      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-8">
                        {others.map(member => (
                          <div key={member.userId} className="text-center group">
                            <div className="relative w-28 h-28 sm:w-32 sm:h-32 mx-auto mb-4">
                              <div className="absolute inset-0 bg-stone-900 border-4 border-stone-900 translate-x-2 translate-y-2"></div>
                              <div className="relative w-full h-full border-4 border-stone-900 bg-white overflow-hidden group-hover:-translate-x-1 group-hover:-translate-y-1 transition-transform">
                                {member.avatar ? (
                                  <img src={member.avatar} alt={member.fullName} className="w-full h-full object-cover" />
                                ) : (
                                  <div className="w-full h-full flex items-center justify-center text-3xl bg-stone-100 italic font-black text-stone-200">PET</div>
                                )}
                              </div>
                            </div>
                            <div className="font-black text-stone-900 uppercase text-xs sm:text-sm mb-1 px-2 line-clamp-1">{member.fullName}</div>
                            <div className="text-[9px] font-black uppercase text-stone-500 tracking-tighter">Nhân viên phòng khám</div>
                          </div>
                        ))}
                      </div>
                    </section>
                  )}

                  {staff.length === 0 && (
                    <div className="py-20 text-center border-4 border-dashed border-stone-300 bg-white">
                      <UserGroupIcon className="h-12 w-12 text-stone-300 mx-auto mb-4" />
                      <p className="text-stone-400 font-black uppercase tracking-widest text-sm">Thông tin đội ngũ đang cập nhật</p>
                    </div>
                  )}
                </div>
              )}
            </>
          )}
        </div>

        {/* Footer CTA */}
        <div className="p-6 sm:p-8 border-t-4 border-stone-900 bg-white flex flex-col sm:flex-row items-center justify-between gap-6 shadow-[0_-8px_20px_rgba(0,0,0,0.05)]">
          <div className="flex items-center gap-4">
            <div className="w-10 h-10 sm:w-12 sm:h-12 bg-amber-400 border-4 border-stone-900 flex items-center justify-center font-black text-xl sm:text-2xl shadow-brutal-xs">!</div>
            <p className="text-stone-600 text-[10px] sm:text-xs font-black uppercase tracking-tight max-w-md">
              Bạn cần đăng nhập để thực hiện đặt lịch khám và sử dụng các tính năng chăm sóc thú cưng nâng cao.
            </p>
          </div>
          <div className="flex gap-4 w-full sm:w-auto">
            <button 
              type="button"
              onClick={onClose} 
              className="flex-1 sm:flex-none px-6 py-3 border-4 border-stone-900 bg-white font-black uppercase text-xs shadow-brutal-sm hover:-translate-x-1 hover:-translate-y-1 active:shadow-none active:translate-x-0 active:translate-y-0 transition-all"
            >
              Quay lại
            </button>
            <a 
              href="/auth/login" 
              className="flex-1 sm:flex-none px-8 py-3 border-4 border-stone-900 bg-amber-500 text-stone-900 font-black uppercase text-xs shadow-brutal-sm hover:-translate-x-1 hover:-translate-y-1 active:shadow-none active:translate-x-0 active:translate-y-0 transition-all text-center"
            >
              Đăng nhập ngay
            </a>
          </div>
        </div>
      </div>

      {/* Image Lightbox */}
      {selectedPreviewImage && (
        <div 
          className="fixed inset-0 z-[100] bg-stone-900/95 flex items-center justify-center p-4 cursor-zoom-out"
          onClick={() => setSelectedPreviewImage(null)}
        >
          <div className="relative max-w-5xl w-full h-full flex items-center justify-center">
             <img src={selectedPreviewImage} className="max-w-full max-h-full border-4 border-white shadow-2xl animate-in zoom-in-95 duration-300" alt="Preview" />
             <button 
               type="button"
               className="absolute top-4 right-4 p-2 bg-white border-4 border-stone-900 shadow-brutal-sm"
               onClick={(e) => { e.stopPropagation(); setSelectedPreviewImage(null); }}
             >
               <XMarkIcon className="h-8 w-8 text-stone-900" />
             </button>
          </div>
        </div>
      )}
    </div>
  )
}
