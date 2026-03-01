import { useState, useEffect } from 'react'
import { CalendarIcon, ListBulletIcon, XMarkIcon } from '@heroicons/react/24/outline'
import DatePicker, { registerLocale } from 'react-datepicker'
import { vi } from 'date-fns/locale'
import 'react-datepicker/dist/react-datepicker.css'
import type { VaccinationRecord } from '../../services/vaccinationService'
import type { VaccineTemplate } from '../../services/api/vaccineTemplateService'
import type { Pet } from '../../services/api/petService'
import type { ClinicServiceResponse } from '../../types/service'
import { getAllServices } from '../../services/endpoints/service'

// Register Vietnamese locale
registerLocale('vi', vi)

export interface VaccinationFormData {
    vaccineName: string
    vaccineTemplateId?: string
    vaccinationDate: Date
    nextDueDate?: Date
    doseSequence: string
    notes: string
}

interface SmartVaccinationFormProps {
    pet: Pet | null
    records: VaccinationRecord[]
    templates: VaccineTemplate[]
    initialData?: Partial<VaccinationFormData>
    bookingCode?: string
    isSubmitting: boolean
    onSubmit: (data: VaccinationFormData) => void
    onCancel?: () => void
    isEditing?: boolean
    showTitle?: boolean
}

export const SmartVaccinationForm = ({
    records,
    templates,
    initialData,
    // bookingCode, // TODO: Implement visual feedback for booking context
    isSubmitting,
    onSubmit,
    onCancel,
    isEditing = false,
    showTitle = false
}: SmartVaccinationFormProps) => {
    // Form State
    const [vaccineName, setVaccineName] = useState('')
    const [selectedTemplateId, setSelectedTemplateId] = useState<string | null>(null)
    const [doseSequence, setDoseSequence] = useState<string>('1')
    const [vaccinationDate, setVaccinationDate] = useState<Date>(new Date())
    const [nextDueDate, setNextDueDate] = useState<Date | null>(null)
    const [notes, setNotes] = useState('')

    // Modal State
    const [templateModalOpen, setTemplateModalOpen] = useState(false)

    // Clinic Services State
    const [errorServices, setErrorServices] = useState<string | null>(null)
    const [clinicServices, setClinicServices] = useState<ClinicServiceResponse[]>([])
    const [isLoadingServices, setIsLoadingServices] = useState(false)

    // Fetch Clinic Services on Modal Open
    useEffect(() => {
        if (templateModalOpen && clinicServices.length === 0) {
            setIsLoadingServices(true)
            setErrorServices(null)
            getAllServices()
                .then(services => {
                    // Filter only VACCINATION category
                    const vaccServices = services.filter(s => s.serviceCategory === 'VACCINATION')
                    setClinicServices(vaccServices)
                })
                .catch(err => {
                    console.error('Failed to fetch clinic services:', err)
                    setErrorServices('Không thể tải danh sách dịch vụ. Vui lòng kiểm tra quyền truy cập.')
                })
                .finally(() => setIsLoadingServices(false))
        }
    }, [templateModalOpen])

    // Load Initial Data
    useEffect(() => {
        if (initialData) {
            setVaccineName(initialData.vaccineName || '')
            setSelectedTemplateId(initialData.vaccineTemplateId || null)
            setDoseSequence(initialData.doseSequence || '1')
            setVaccinationDate(initialData.vaccinationDate || new Date())
            setNextDueDate(initialData.nextDueDate || null)

            // Clear temporary/predicted notes so they don't become permanent
            const initialNotes = initialData.notes || '';
            const isTemporaryNote = initialNotes.startsWith('Dự kiến:') || initialNotes.startsWith('Tự động tạo');
            setNotes(isTemporaryNote ? '' : initialNotes)
        } else {
            // Reset if no initial data (Create Mode default)
            setVaccineName('')
            setSelectedTemplateId(null)
            setDoseSequence('1')
            setVaccinationDate(new Date())
            setNextDueDate(null)
            setNotes('')
        }
    }, [initialData])

    // Auto-calculate next due date when dose sequence or vaccination date changes
    useEffect(() => {
        if (!selectedTemplateId) return;
        const template = templates.find(t => t.id === selectedTemplateId);
        if (!template) return;

        // Only auto-recalculate if nextDueDate is not manually set OR if it's the first time
        // Actually, let's always recalculate if it's not ANNUAL and it's not the final dose
        if (doseSequence === 'ANNUAL') {
            const nextDate = new Date(vaccinationDate)
            nextDate.setFullYear(nextDate.getFullYear() + 1)
            setNextDueDate(nextDate)
        } else if (template.repeatIntervalDays) {
            const seqNum = parseInt(doseSequence);
            if (!isNaN(seqNum) && seqNum < template.seriesDoses) {
                const nextDate = new Date(vaccinationDate)
                nextDate.setDate(nextDate.getDate() + template.repeatIntervalDays)
                setNextDueDate(nextDate)
            } else if (!isNaN(seqNum) && seqNum >= template.seriesDoses) {
                // Final dose in series, suggest annual follow up
                const nextDate = new Date(vaccinationDate)
                nextDate.setFullYear(nextDate.getFullYear() + 1)
                setNextDueDate(nextDate)
            }
        }
    }, [doseSequence, vaccinationDate, selectedTemplateId, templates])



    // Handle selecting a clinic service
    const handleSelectClinicService = (service: ClinicServiceResponse) => {
        setVaccineName(service.name)
        // If service has a linked template, use that
        if (service.vaccineTemplateId) {
            setSelectedTemplateId(service.vaccineTemplateId)
            // Find the template to get interval info
            const tpl = templates.find(t => t.id === service.vaccineTemplateId)
            if (tpl) {
                // Smart Dose Prediction
                const normalize = (s: string) => s.toLowerCase().replace(/[^a-z0-9]/g, '');
                const normalizedInput = normalize(service.name);
                const existingCount = records.filter(r =>
                    r.workflowStatus === 'COMPLETED' && normalize(r.vaccineName) === normalizedInput
                ).length;

                if (existingCount >= (tpl.seriesDoses || 1)) {
                    setDoseSequence('ANNUAL');
                } else {
                    setDoseSequence(String(existingCount + 1));
                }

                if (tpl.repeatIntervalDays) {
                    const nextDate = new Date(vaccinationDate)
                    nextDate.setDate(nextDate.getDate() + tpl.repeatIntervalDays)
                    setNextDueDate(nextDate)
                }

                if (tpl.seriesDoses > 1) {
                    setNotes(`Lịch trình: ${tpl.seriesDoses} mũi, cách nhau ${tpl.repeatIntervalDays} ngày.`)
                } else if (tpl.isAnnualRepeat) {
                    setNotes('Tái chủng hàng năm.')
                }
            }
        } else {
            setSelectedTemplateId(null)
            // For services without template, assume annual by default
            const nextDate = new Date(vaccinationDate)
            nextDate.setFullYear(nextDate.getFullYear() + 1)
            setNextDueDate(nextDate)
            setNotes('Tái chủng hàng năm.')
        }

        setTemplateModalOpen(false)
    }

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault()
        onSubmit({
            vaccineName,
            vaccineTemplateId: selectedTemplateId || undefined,
            vaccinationDate,
            nextDueDate: nextDueDate || undefined,
            doseSequence,
            notes
        })
    }

    return (
        <>
            <form onSubmit={handleSubmit} className="space-y-8">
                {showTitle && (
                    <div className="relative pb-4 border-b border-stone-100">
                        <h3 className="text-2xl font-black text-stone-900 tracking-tight">
                            {isEditing ? 'Chỉnh Sửa Hồ Sơ' : 'Ghi Nhận Tiêm Chủng'}
                        </h3>
                        <p className="text-xs text-stone-400 font-bold uppercase tracking-[0.2em] mt-1">Thông tin quản lý tiêm chủng</p>
                        <div className="absolute bottom-0 left-0 w-12 h-1 bg-orange-500 rounded-full" />
                    </div>
                )}

                {/* Dose Sequence Selector */}
                <div className="space-y-4">
                    <label className="flex items-center gap-2 text-[11px] font-black text-stone-400 uppercase tracking-widest bg-stone-50/50 w-fit px-4 py-1.5 rounded-full border border-stone-200/60 shadow-sm">
                        <ListBulletIcon className="w-3.5 h-3.5" />
                        Trình tự mũi tiêm
                    </label>
                    <div className="inline-flex bg-stone-100/80 p-1.5 rounded-2xl border border-stone-200/60 backdrop-blur-sm shadow-sm transition-all hover:shadow-md">
                        {['1', '2', '3', 'ANNUAL'].map((seq) => (
                            <button
                                key={seq}
                                type="button"
                                onClick={() => setDoseSequence(seq)}
                                className={`relative px-5 md:px-8 py-2.5 rounded-xl text-[11px] font-black tracking-wider transition-all duration-300 ${doseSequence === seq
                                    ? 'bg-white text-orange-600 shadow-[0_4px_12px_rgba(234,88,12,0.12)] border border-orange-100 ring-1 ring-orange-50/50'
                                    : 'text-stone-400 hover:text-stone-600 hover:bg-white/50'
                                    }`}
                            >
                                {seq === 'ANNUAL' ? 'HÀNG NĂM' : `MŨI ${seq}`}
                                {doseSequence === seq && (
                                    <span className="absolute -top-1 -right-1 w-2 h-2 bg-orange-500 rounded-full animate-pulse shadow-sm shadow-orange-500/50" />
                                )}
                            </button>
                        ))}
                    </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-12 gap-x-8 gap-y-6">
                    {/* Vaccine Type */}
                    <div className="md:col-span-12 lg:col-span-6 space-y-3">
                        <label className="block text-[11px] font-black text-stone-400 uppercase tracking-widest pl-1 mb-1">Loại Vaccine *</label>
                        <div className="group relative flex items-stretch gap-2">
                            <div className="flex-1 relative">
                                <input
                                    type="text"
                                    value={vaccineName}
                                    onChange={(e) => setVaccineName(e.target.value)}
                                    placeholder="Nhập tên hoặc chọn từ danh mục..."
                                    className="w-full px-5 py-4 bg-white border-2 border-stone-100 rounded-2xl focus:outline-none focus:border-orange-400 focus:ring-4 focus:ring-orange-50 transition-all font-bold text-stone-800 placeholder:text-stone-300 placeholder:font-medium shadow-sm hover:border-stone-200"
                                    required
                                />
                                {vaccineName && (
                                    <button
                                        type="button"
                                        onClick={() => setVaccineName('')}
                                        className="absolute right-3 top-1/2 -translate-y-1/2 p-1 hover:bg-stone-100 rounded-full text-stone-300 hover:text-stone-500 transition-colors"
                                    >
                                        <XMarkIcon className="w-4 h-4" />
                                    </button>
                                )}
                            </div>
                            <button
                                type="button"
                                onClick={() => setTemplateModalOpen(true)}
                                className="px-5 bg-orange-600 text-white rounded-2xl hover:bg-orange-700 active:scale-95 transition-all flex items-center justify-center shadow-lg shadow-orange-200 border-2 border-orange-600 hover:border-orange-700"
                                title="Mở danh mục dịch vụ"
                            >
                                <ListBulletIcon className="w-6 h-6" />
                            </button>
                        </div>
                    </div>

                    {/* Date Administered */}
                    <div className="md:col-span-6 lg:col-span-3 space-y-3">
                        <label className="block text-[11px] font-black text-stone-400 uppercase tracking-widest pl-1 mb-1">Ngày Tiêm *</label>
                        <div className="relative group">
                            <DatePicker
                                selected={vaccinationDate}
                                onChange={(date: Date | null) => {
                                    if (date) {
                                        setVaccinationDate(date);
                                        const template = templates.find(t => t.id === selectedTemplateId);
                                        if (template && template.repeatIntervalDays) {
                                            const nextDate = new Date(date);
                                            nextDate.setDate(nextDate.getDate() + template.repeatIntervalDays);
                                            setNextDueDate(nextDate);
                                        }
                                    }
                                }}
                                maxDate={new Date()}
                                dateFormat="dd/MM/yyyy"
                                locale="vi"
                                className="w-full px-5 py-4 pl-12 bg-white border-2 border-stone-100 rounded-2xl focus:outline-none focus:border-orange-400 focus:ring-4 focus:ring-orange-50 transition-all font-bold text-stone-800 shadow-sm hover:border-stone-200 cursor-pointer"
                            />
                            <CalendarIcon className="w-5 h-5 text-stone-300 absolute left-4 top-1/2 -translate-y-1/2 group-focus-within:text-orange-500 transition-colors" />
                        </div>
                    </div>

                    {/* Next Due Date */}
                    <div className="md:col-span-6 lg:col-span-3 space-y-3">
                        <label className="block text-[11px] font-black text-stone-400 uppercase tracking-widest pl-1 mb-1">Tái Chủng (Dự kiến)</label>
                        <div className="relative group">
                            <DatePicker
                                selected={nextDueDate}
                                onChange={(date: Date | null) => setNextDueDate(date)}
                                dateFormat="dd/MM/yyyy"
                                locale="vi"
                                placeholderText="Chọn ngày..."
                                className="w-full px-5 py-4 pl-12 bg-white border-2 border-stone-100 rounded-2xl focus:outline-none focus:border-orange-400 focus:ring-4 focus:ring-orange-50 transition-all font-bold text-stone-800 shadow-sm hover:border-stone-200 cursor-pointer placeholder:text-stone-300 placeholder:font-medium"
                                minDate={vaccinationDate}
                            />
                            <CalendarIcon className="w-5 h-5 text-stone-300 absolute left-4 top-1/2 -translate-y-1/2 group-focus-within:text-orange-500 transition-colors" />
                        </div>
                    </div>
                </div>

                {/* Notes */}
                <div className="space-y-3">
                    <label className="block text-[11px] font-black text-stone-400 uppercase tracking-widest pl-1 mb-1">Ghi Chú / Phản Ứng Sau Tiêm</label>
                    <textarea
                        value={notes}
                        onChange={(e) => setNotes(e.target.value)}
                        placeholder="VD: Không có phản ứng phụ, thú cưng khỏe mạnh..."
                        rows={3}
                        className="w-full px-5 py-4 bg-white border-2 border-stone-100 rounded-2xl focus:outline-none focus:border-orange-400 focus:ring-4 focus:ring-orange-50 transition-all font-bold text-stone-800 placeholder:text-stone-300 placeholder:font-medium shadow-sm hover:border-stone-200 resize-none leading-relaxed"
                    />
                </div>

                <div className="flex items-center justify-end gap-4 pt-4 border-t border-stone-100/50">
                    {onCancel && (
                        <button
                            type="button"
                            onClick={onCancel}
                            className="px-8 py-3.5 bg-stone-100 text-stone-500 font-black rounded-2xl hover:bg-stone-200 hover:text-stone-700 active:scale-95 transition-all text-xs tracking-widest"
                        >
                            HỦY BỎ
                        </button>
                    )}
                    <button
                        type="submit"
                        disabled={isSubmitting}
                        className={`min-w-[160px] px-10 py-3.5 text-white font-black rounded-2xl transition-all active:scale-95 disabled:bg-stone-200 disabled:text-stone-400 disabled:shadow-none shadow-xl text-xs tracking-widest ${isSubmitting
                            ? 'bg-stone-200'
                            : isEditing
                                ? 'bg-indigo-600 hover:bg-indigo-700 shadow-indigo-200 border-2 border-indigo-600'
                                : 'bg-orange-600 hover:bg-orange-700 shadow-orange-200 border-2 border-orange-600'
                            }`}
                    >
                        {isSubmitting ? (
                            <div className="flex items-center justify-center gap-2">
                                <div className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                                <span>ĐANG LƯU...</span>
                            </div>
                        ) : (
                            isEditing ? 'CẬP NHẬT HỒ SƠ' : 'LƯU HỒ SƠ TIÊM'
                        )}
                    </button>
                </div>
            </form>

            {/* Template Selection Modal */}
            {templateModalOpen && (
                <div className="fixed inset-0 bg-black/60 z-[70] flex items-center justify-center p-4 backdrop-blur-sm animate-in fade-in duration-200">
                    <div className="bg-white w-full max-w-2xl rounded-3xl shadow-2xl overflow-hidden flex flex-col max-h-[85vh]">
                        <div className="p-6 border-b border-stone-100 bg-stone-50/50 flex justify-between items-center sticky top-0 z-10">
                            <div>
                                <h2 className="text-xl font-bold text-stone-800">Danh Mục Dịch Vụ Clinic</h2>
                                <p className="text-stone-500 text-xs mt-1">Chọn từ danh sách dịch vụ tiêm phòng của phòng khám</p>
                            </div>
                            <button onClick={() => setTemplateModalOpen(false)} className="p-2 hover:bg-stone-200 rounded-full transition-colors">
                                <XMarkIcon className="w-6 h-6 text-stone-400" />
                            </button>
                        </div>

                        <div className="flex-1 overflow-y-auto p-6 md:p-8 min-h-[300px] md:min-h-[400px]">
                            {isLoadingServices ? (
                                <div className="flex flex-col items-center justify-center h-full space-y-4 animate-pulse">
                                    <div className="w-12 h-12 rounded-full border-4 border-orange-100 border-t-orange-500 animate-spin" />
                                    <div className="text-stone-400 text-sm font-medium italic">Đang tải danh mục dịch vụ...</div>
                                </div>
                            ) : errorServices ? (
                                <div className="flex flex-col items-center justify-center h-full space-y-4 text-center">
                                    <div className="w-16 h-16 bg-red-50 rounded-full flex items-center justify-center">
                                        <XMarkIcon className="w-8 h-8 text-red-500" />
                                    </div>
                                    <div className="space-y-1">
                                        <h3 className="text-stone-900 font-bold">Lỗi tải dữ liệu</h3>
                                        <p className="text-stone-500 text-sm max-w-[250px]">{errorServices}</p>
                                    </div>
                                </div>
                            ) : clinicServices.length === 0 ? (
                                <div className="flex flex-col items-center justify-center h-full space-y-4 text-center">
                                    <div className="w-16 h-16 bg-stone-50 rounded-full flex items-center justify-center">
                                        <ListBulletIcon className="w-8 h-8 text-stone-300" />
                                    </div>
                                    <div className="space-y-1">
                                        <h3 className="text-stone-900 font-bold">Danh mục trống</h3>
                                        <p className="text-stone-500 text-sm max-w-[250px]">Clinic chưa có dịch vụ tiêm phòng nào.</p>
                                    </div>
                                </div>
                            ) : (
                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                    {clinicServices.map(svc => (
                                        <div
                                            key={svc.serviceId}
                                            onClick={() => handleSelectClinicService(svc)}
                                            className="group relative bg-white p-5 rounded-2xl border border-stone-100 shadow-sm hover:shadow-md hover:border-orange-200 hover:ring-2 hover:ring-orange-100 cursor-pointer transition-all duration-300"
                                        >
                                            <div className="flex justify-between items-start mb-3">
                                                <div className="font-bold text-stone-800 group-hover:text-orange-700 transition-colors">
                                                    {svc.name}
                                                </div>
                                                <div className="text-xs font-bold text-orange-600 bg-white px-2 py-1 rounded-lg border border-orange-100 shadow-sm">
                                                    {svc.basePrice?.toLocaleString('vi-VN')}đ
                                                </div>
                                            </div>
                                            {svc.dosePrices && svc.dosePrices.length > 0 && (
                                                <div className="flex flex-wrap gap-1 mb-2">
                                                    {svc.dosePrices.filter(d => d.isActive).map(dose => (
                                                        <span key={dose.doseNumber} className="px-2 py-0.5 bg-amber-50 text-amber-700 text-[10px] font-bold rounded border border-amber-100">
                                                            {dose.doseLabel}: {dose.price?.toLocaleString('vi-VN')}đ
                                                        </span>
                                                    ))}
                                                </div>
                                            )}
                                            {svc.description && (
                                                <p className="text-xs text-stone-400 line-clamp-2 italic leading-relaxed">{svc.description}</p>
                                            )}
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>

                        <div className="p-6 bg-stone-50 border-t border-stone-100 text-center">
                            <button
                                onClick={() => setTemplateModalOpen(false)}
                                className="text-sm font-bold text-stone-400 hover:text-stone-600 transition-colors uppercase tracking-widest"
                            >
                                Đóng danh mục
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </>
    )
}
