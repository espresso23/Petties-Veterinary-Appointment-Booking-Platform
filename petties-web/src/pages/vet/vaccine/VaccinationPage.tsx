import { useState, useEffect } from 'react'
import { useParams, useNavigate, useSearchParams } from 'react-router-dom'
import { CalendarIcon, PlusIcon, TrashIcon, ArrowLeftIcon, ListBulletIcon, ClockIcon, Squares2X2Icon } from '@heroicons/react/24/outline'
import DatePicker, { registerLocale } from 'react-datepicker'
import { vi } from 'date-fns/locale'
import 'react-datepicker/dist/react-datepicker.css'
import { vaccinationService, type VaccinationRecord } from '../../../services/vaccinationService'
import { vaccineTemplateService, type VaccineTemplate } from '../../../services/api/vaccineTemplateService'
import { petService, type Pet } from '../../../services/api/petService'
import { useToast } from '../../../components/Toast'
import { VaccinationRoadmap } from './components/VaccinationRoadmap'

// Register Vietnamese locale
registerLocale('vi', vi)

const VaccinationPage = () => {
    const { petId } = useParams<{ petId: string }>()
    const navigate = useNavigate()
    const [searchParams] = useSearchParams()
    const bookingId = searchParams.get('bookingId')
    const bookingCode = searchParams.get('bookingCode')
    const { showToast } = useToast()

    const [records, setRecords] = useState<VaccinationRecord[]>([])
    const [templates, setTemplates] = useState<VaccineTemplate[]>([])
    const [pet, setPet] = useState<Pet | null>(null)
    const [isLoading, setIsLoading] = useState(true)
    const [isSubmitting, setIsSubmitting] = useState(false)
    const [templateModalOpen, setTemplateModalOpen] = useState(false)
    const [viewMode, setViewMode] = useState<'list' | 'roadmap'>('list')
    const [selectedTemplateId, setSelectedTemplateId] = useState<string | null>(null)
    const [doseSequence, setDoseSequence] = useState<string>('1')
    const [upcomingRecords, setUpcomingRecords] = useState<VaccinationRecord[]>([])

    // Form State
    const [vaccineName, setVaccineName] = useState('')
    const [vaccinationDate, setVaccinationDate] = useState<Date>(new Date())
    const [nextDueDate, setNextDueDate] = useState<Date | null>(null)
    const [notes, setNotes] = useState('')

    useEffect(() => {
        if (petId) {
            fetchRecords()
            fetchPet()
            fetchTemplates()
            fetchUpcoming()
        }
    }, [petId])

    const fetchUpcoming = async () => {
        if (!petId) return
        try {
            const data = await vaccinationService.getUpcomingVaccinations(petId)
            setUpcomingRecords(data)
        } catch (error) {
            console.error('Failed to fetch upcoming vaccinations:', error)
        }
    }

    const fetchPet = async () => {
        if (!petId) return
        try {
            const data = await petService.getPetById(petId)
            setPet(data)
        } catch (error) {
            console.error('Failed to fetch pet:', error)
        }
    }

    const fetchRecords = async () => {
        if (!petId) return
        try {
            const data = await vaccinationService.getVaccinationsByPet(petId)
            setRecords(data)
        } catch (error) {
            console.error(error)
            showToast('error', 'Không thể tải lịch sử tiêm chủng')
        } finally {
            setIsLoading(false)
        }
    }

    const fetchTemplates = async () => {
        try {
            const data = await vaccineTemplateService.getAllTemplates()
            setTemplates(data)
        } catch (error) {
            console.error('Failed to fetch templates:', error)
        }
    }

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault()
        if (!petId || !vaccineName || !vaccinationDate) {
            showToast('error', 'Vui lòng điền các trường bắt buộc')
            return
        }

        setIsSubmitting(true)
        try {
            await vaccinationService.createVaccination({
                petId,
                bookingId: bookingId || undefined,
                vaccineName,
                vaccineTemplateId: selectedTemplateId || undefined,
                vaccinationDate: vaccinationDate.toISOString().split('T')[0],
                nextDueDate: nextDueDate ? nextDueDate.toISOString().split('T')[0] : undefined,
                doseSequence,
                notes
            })

            showToast('success', 'Đã thêm hồ sơ tiêm chủng')
            resetForm()
            fetchRecords()
            fetchUpcoming()
        } catch (error: any) {
            console.error(error)
            const errorMessage = error?.response?.data?.message || error?.message || 'Lỗi khi thêm hồ sơ'
            showToast('error', errorMessage)
        } finally {
            setIsSubmitting(false)
        }
    }

    const resetForm = () => {
        setVaccineName('')
        setSelectedTemplateId(null)
        setDoseSequence('1')
        setVaccinationDate(new Date())
        setNextDueDate(null)
        setNotes('')
    }

    const handleDelete = async (id: string) => {
        if (!confirm('Bạn có chắc chắn muốn xóa hồ sơ này?')) return

        try {
            await vaccinationService.deleteVaccination(id)
            showToast('success', 'Đã xóa hồ sơ')
            fetchRecords()
            fetchUpcoming()
        } catch (error) {
            console.error(error)
            showToast('error', 'Xóa thất bại')
        }
    }

    const handleSelectTemplate = (template: VaccineTemplate) => {
        setVaccineName(template.name)
        setSelectedTemplateId(template.id)

        // Smart Dose Prediction (Locally)
        const normalize = (s: string) => s.toLowerCase().replace(/[^a-z0-9]/g, '');
        const normalizedInput = normalize(template.name);
        const existingCount = records.filter(r =>
            r.workflowStatus === 'COMPLETED' && normalize(r.vaccineName) === normalizedInput
        ).length;

        if (existingCount >= (template.seriesDoses || 1)) {
            setDoseSequence('ANNUAL');
        } else {
            setDoseSequence(String(existingCount + 1));
        }

        // Calculate next due date
        if (template.repeatIntervalDays) {
            const nextDate = new Date(vaccinationDate)
            nextDate.setDate(nextDate.getDate() + template.repeatIntervalDays)
            setNextDueDate(nextDate)
        }

        // Add note about next dose
        if (template.seriesDoses > 1) {
            setNotes(`Lịch trình: ${template.seriesDoses} mũi, cách nhau ${template.repeatIntervalDays} ngày.`)
        } else if (template.isAnnualRepeat) {
            setNotes('Tái chủng hàng năm.')
        }

        setTemplateModalOpen(false)
        showToast('success', `Đã chọn: ${template.name}`)
    }

    // Filter templates by pet species
    const filteredTemplates = templates.filter(tpl => {
        if (!pet) return true // Show all if pet not loaded yet

        const normalizeSpecies = (s: string) => {
            // Normalize Vietnamese string to remove accents
            const normalized = s.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
            const originalLower = s.toLowerCase();

            if (normalized.includes('dog') || normalized.includes('cho') || originalLower.includes('chó')) return 'DOG';
            if (normalized.includes('cat') || normalized.includes('meo') || originalLower.includes('mèo')) return 'CAT';
            return s.toUpperCase();
        };

        const petSpecies = normalizeSpecies(pet.species);
        const targetSpecies = (tpl.targetSpecies || 'BOTH').toUpperCase();

        if (targetSpecies === 'BOTH') return true;
        if (petSpecies === 'DOG' && targetSpecies === 'DOG') return true;
        if (petSpecies === 'CAT' && targetSpecies === 'CAT') return true;

        return false;
    })

    return (
        <div className="p-8 max-w-6xl mx-auto space-y-8 animate-in fade-in duration-500">
            {/* Header */}
            <div className="flex items-center gap-4">
                <button
                    onClick={() => navigate(-1)}
                    className="p-2 hover:bg-orange-50 rounded-full text-orange-600 transition-colors"
                >
                    <ArrowLeftIcon className="w-6 h-6" />
                </button>
                <div>
                    <h1 className="text-3xl font-bold text-stone-800 tracking-tight">Quản Lý Tiêm Chủng</h1>
                    <p className="text-stone-500 text-sm">Hồ sơ tiêm phòng và nhắc lịch tái chủng</p>
                </div>
            </div>

            {/* Form Section */}
            <div className="bg-white rounded-2xl shadow-sm border border-stone-200 overflow-hidden">
                <div className="bg-orange-50 px-8 py-4 border-b border-orange-100 flex items-center justify-between">
                    <div className="flex items-center gap-2">
                        <PlusIcon className="w-5 h-5 text-orange-600" />
                        <h2 className="text-lg font-bold text-orange-900">Ghi Nhận Mũi Tiêm Mới</h2>
                    </div>
                    {bookingCode && (
                        <div className="px-3 py-1 bg-white text-orange-700 text-xs font-bold rounded-full border border-orange-200 shadow-sm">
                            Booking #{bookingCode}
                        </div>
                    )}
                </div>

                <form onSubmit={handleSubmit} className="p-8 space-y-8">
                    {/* Dose Sequence Selector */}
                    <div className="space-y-3">
                        <label className="block text-sm font-semibold text-stone-600 uppercase tracking-wider">Thông tin mũi tiêm</label>
                        <div className="flex bg-stone-100 p-1.5 rounded-2xl border border-stone-200 w-fit">
                            {['1', '2', '3', 'ANNUAL'].map((seq) => (
                                <button
                                    key={seq}
                                    type="button"
                                    onClick={() => setDoseSequence(seq)}
                                    className={`px-6 py-2.5 rounded-xl text-xs font-black transition-all ${doseSequence === seq
                                        ? 'bg-white text-orange-600 shadow-md border border-stone-200'
                                        : 'text-stone-400 hover:text-stone-600'
                                        }`}
                                >
                                    {seq === 'ANNUAL' ? 'HẰNG NĂM' : `MŨI ${seq}`}
                                </button>
                            ))}
                        </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
                        {/* Vaccine Type */}
                        <div className="space-y-2 lg:col-span-1">
                            <label className="block text-sm font-semibold text-stone-600 uppercase tracking-wider">Loại Vaccine *</label>
                            <div className="flex items-stretch gap-2">
                                <input
                                    type="text"
                                    value={vaccineName}
                                    onChange={(e) => setVaccineName(e.target.value)}
                                    placeholder="Chọn từ danh mục hoặc nhập tên..."
                                    className="flex-1 px-4 py-3 bg-stone-50 border border-stone-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-orange-500 focus:bg-white transition-all font-medium"
                                    required
                                />
                                <button
                                    type="button"
                                    onClick={() => setTemplateModalOpen(true)}
                                    className="px-4 bg-orange-100 text-orange-700 rounded-xl hover:bg-orange-200 transition-colors flex items-center justify-center border border-orange-200"
                                    title="Chọn từ danh mục"
                                >
                                    <ListBulletIcon className="w-5 h-5" />
                                </button>
                            </div>
                        </div>

                        {/* Date Administered */}
                        <div className="space-y-2">
                            <label className="block text-sm font-semibold text-stone-600 uppercase tracking-wider">Ngày Tiêm *</label>
                            <div className="relative">
                                <DatePicker
                                    selected={vaccinationDate}
                                    onChange={(date: Date | null) => {
                                        if (date) {
                                            setVaccinationDate(date);
                                            // Recalculate next due date if template is selected
                                            const template = templates.find(t => t.id === selectedTemplateId);
                                            if (template && template.repeatIntervalDays) {
                                                const nextDate = new Date(date);
                                                nextDate.setDate(nextDate.getDate() + template.repeatIntervalDays);
                                                setNextDueDate(nextDate);
                                            }
                                        }
                                    }}
                                    maxDate={new Date()} // Prevent future dates
                                    dateFormat="dd/MM/yyyy"
                                    locale="vi"
                                    className="w-full px-4 py-3 pl-11 bg-stone-50 border border-stone-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-orange-500 focus:bg-white transition-all font-medium"
                                />
                                <CalendarIcon className="w-5 h-5 text-stone-400 absolute left-4 top-1/2 -translate-y-1/2" />
                            </div>
                        </div>

                        {/* Next Due Date */}
                        <div className="space-y-2">
                            <label className="block text-sm font-semibold text-stone-600 uppercase tracking-wider">Tái Chủng (Dự kiến)</label>
                            <div className="relative">
                                <DatePicker
                                    selected={nextDueDate}
                                    onChange={(date: Date | null) => setNextDueDate(date)}
                                    dateFormat="dd/MM/yyyy"
                                    locale="vi"
                                    placeholderText="dd/mm/yyyy"
                                    className="w-full px-4 py-3 pl-11 bg-stone-50 border border-stone-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-orange-500 focus:bg-white transition-all font-medium"
                                    minDate={vaccinationDate}
                                />
                                <CalendarIcon className="w-5 h-5 text-stone-400 absolute left-4 top-1/2 -translate-y-1/2" />
                            </div>
                        </div>
                    </div>

                    {/* Notes */}
                    <div className="space-y-2">
                        <label className="block text-sm font-semibold text-stone-600 uppercase tracking-wider">Ghi Chú / Phản Ứng</label>
                        <textarea
                            value={notes}
                            onChange={(e) => setNotes(e.target.value)}
                            placeholder="Ghi chú thêm về phản ứng sau tiêm, số lô thuốc..."
                            rows={2}
                            className="w-full px-4 py-3 bg-stone-50 border border-stone-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-orange-500 focus:bg-white transition-all font-medium resize-none"
                        />
                    </div>

                    <div className="flex justify-end">
                        <button
                            type="submit"
                            disabled={isSubmitting}
                            className="px-8 py-3 bg-orange-600 text-white font-bold rounded-xl hover:bg-orange-700 transition-all active:scale-95 disabled:bg-stone-300 shadow-md shadow-orange-100"
                        >
                            {isSubmitting ? 'ĐANG LƯU...' : 'LƯU HỒ SƠ'}
                        </button>
                    </div>
                </form>
            </div>

            {/* View Mode Toggle & History Header */}
            <div className="flex flex-col md:flex-row md:items-end justify-between gap-4 px-1">
                <div className="flex items-center gap-2">
                    <h2 className="text-xl font-bold text-stone-800">Lịch Sử Tiêm Chủng</h2>
                    <div className="h-1 w-20 bg-orange-100 rounded-full ml-4" />
                </div>

                <div className="flex bg-stone-100 p-1 rounded-xl border border-stone-200 w-fit">
                    <button
                        onClick={() => setViewMode('list')}
                        className={`flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-bold transition-all ${viewMode === 'list'
                            ? 'bg-white text-orange-600 shadow-sm border border-stone-200'
                            : 'text-stone-500 hover:text-stone-700'
                            }`}
                    >
                        <ListBulletIcon className="w-4 h-4" />
                        DANH SÁCH
                    </button>
                    <button
                        onClick={() => setViewMode('roadmap')}
                        className={`flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-bold transition-all ${viewMode === 'roadmap'
                            ? 'bg-white text-orange-600 shadow-sm border border-stone-200'
                            : 'text-stone-500 hover:text-stone-700'
                            }`}
                    >
                        <Squares2X2Icon className="w-4 h-4" />
                        LỘ TRÌNH (GRID)
                    </button>
                </div>
            </div>

            {/* Pending Vaccinations Section (Lịch Chờ Tiêm) */}
            {records.filter(r => r.workflowStatus === 'PENDING').length > 0 && (
                <div className="bg-white rounded-2xl shadow-sm border border-amber-200 overflow-hidden">
                    <div className="bg-amber-50 px-6 py-3 border-b border-amber-100 flex items-center gap-2">
                        <ClockIcon className="w-5 h-5 text-amber-600" />
                        <h3 className="text-sm font-bold text-amber-800 uppercase tracking-wider">Lịch Chờ Tiêm</h3>
                        <span className="ml-2 px-2 py-0.5 bg-amber-200 text-amber-800 text-xs font-bold rounded-full">
                            {records.filter(r => r.workflowStatus === 'PENDING').length}
                        </span>
                    </div>
                    <div className="p-4 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                        {records.filter(r => r.workflowStatus === 'PENDING').map((rec) => (
                            <div key={rec.id} className="flex items-center justify-between p-4 bg-amber-50/30 rounded-xl border border-amber-100 group hover:border-amber-300 transition-all">
                                <div>
                                    <div className="font-bold text-stone-800">{rec.vaccineName}</div>
                                    <div className="text-xs text-amber-600 font-bold mt-1">
                                        {rec.doseNumber === 4 ? 'Hàng năm' : `Mũi ${rec.doseNumber}`} • Dự kiến: {vaccinationService.formatDate(rec.nextDueDate)}
                                    </div>
                                    <div className="text-[10px] text-stone-400 mt-0.5 italic">{rec.notes}</div>
                                </div>
                                <button
                                    onClick={() => {
                                        setVaccineName(rec.vaccineName);
                                        setSelectedTemplateId(rec.vaccineTemplateId || null);
                                        setDoseSequence(rec.doseNumber === 4 ? 'ANNUAL' : String(rec.doseNumber || 1));
                                        if (rec.nextDueDate) {
                                            setVaccinationDate(new Date(rec.nextDueDate));
                                        }
                                        window.scrollTo({ top: 0, behavior: 'smooth' });
                                    }}
                                    className="p-2 bg-white text-amber-600 rounded-lg border border-amber-200 shadow-sm hover:bg-amber-600 hover:text-white transition-all opacity-0 group-hover:opacity-100"
                                    title="Ghi nhận mũi tiêm này"
                                >
                                    <PlusIcon className="w-4 h-4" />
                                </button>
                            </div>
                        ))}
                    </div>
                </div>
            )}

            {/* Suggested Doses Section */}
            {upcomingRecords.length > 0 && viewMode === 'roadmap' && (
                <div className="bg-white rounded-2xl shadow-sm border border-orange-200 overflow-hidden">
                    <div className="bg-orange-50 px-6 py-3 border-b border-orange-100 flex items-center gap-2">
                        <ClockIcon className="w-5 h-5 text-orange-600" />
                        <h3 className="text-sm font-bold text-orange-800 uppercase tracking-wider">Mũi Tiêm Gợi Ý (Dự kiến)</h3>
                    </div>
                    <div className="p-4 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                        {upcomingRecords.map((rec, idx) => (
                            <div key={idx} className="flex items-center justify-between p-4 bg-orange-50/30 rounded-xl border border-orange-100 group hover:border-orange-300 transition-all">
                                <div>
                                    <div className="font-bold text-stone-800">{rec.vaccineName}</div>
                                    <div className="text-xs text-orange-600 font-bold mt-1">
                                        {rec.doseNumber === 4 ? 'Hàng năm' : `Mũi ${rec.doseNumber}`} • {vaccinationService.formatDate(rec.nextDueDate)}
                                    </div>
                                    <div className="text-[10px] text-stone-400 mt-0.5 italic">{rec.notes}</div>
                                </div>
                                <button
                                    onClick={() => {
                                        setVaccineName(rec.vaccineName);
                                        setSelectedTemplateId(rec.vaccineTemplateId || null);
                                        setDoseSequence(rec.doseNumber === 4 ? 'ANNUAL' : String(rec.doseNumber));
                                        if (rec.nextDueDate) setNextDueDate(new Date(rec.nextDueDate));
                                        window.scrollTo({ top: 0, behavior: 'smooth' });
                                    }}
                                    className="p-2 bg-white text-orange-600 rounded-lg border border-orange-200 shadow-sm hover:bg-orange-600 hover:text-white transition-all opacity-0 group-hover:opacity-100"
                                    title="Sử dụng gợi ý"
                                >
                                    <PlusIcon className="w-4 h-4" />
                                </button>
                            </div>
                        ))}
                    </div>
                </div>
            )}

            {viewMode === 'roadmap' ? (
                <VaccinationRoadmap records={records} upcomingRecords={upcomingRecords} />
            ) : (
                <div className="bg-white rounded-2xl shadow-sm border border-stone-200 overflow-hidden">
                    <div className="overflow-x-auto">
                        <table className="w-full text-left border-collapse">
                            <thead>
                                <tr className="bg-stone-50 text-stone-500 text-[10px] uppercase font-bold tracking-[0.1em] border-b border-stone-200">
                                    <th className="px-6 py-4">Vaccine</th>
                                    <th className="px-6 py-4">Ngày Tiêm</th>
                                    <th className="px-6 py-4">Tái Chủng</th>
                                    <th className="px-6 py-4">Bác Sĩ</th>
                                    <th className="px-6 py-4">Trạng Thái</th>
                                    <th className="px-6 py-4 text-right"></th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-stone-100">
                                {isLoading ? (
                                    <tr>
                                        <td colSpan={6} className="p-12 text-center text-stone-400 font-medium">Đang tải dữ liệu...</td>
                                    </tr>
                                ) : (
                                    records.length === 0 ? (
                                        <tr>
                                            <td colSpan={6} className="p-12 text-center text-stone-400 font-medium italic">Chưa có lịch sử tiêm chủng.</td>
                                        </tr>
                                    ) : (
                                        records.map((record) => (
                                            <tr key={record.id} className="hover:bg-stone-50 transition-colors group">
                                                <td className="px-6 py-5">
                                                    <div className="flex items-center gap-2">
                                                        <div className="font-bold text-stone-800">{record.vaccineName}</div>
                                                        {record.doseNumber && (
                                                            <span className="px-2 py-0.5 bg-orange-100 text-orange-700 text-[10px] font-bold rounded border border-orange-200">
                                                                {record.doseNumber === 4 ? 'Hàng năm' : `Mũi ${record.doseNumber}`}
                                                                {(() => {
                                                                    if (record.doseNumber === 4) return '';
                                                                    const tpl = templates.find(t => t.id === record.vaccineTemplateId);
                                                                    return tpl && tpl.seriesDoses > 1 ? ` / ${tpl.seriesDoses}` : '';
                                                                })()}
                                                            </span>
                                                        )}
                                                    </div>
                                                    {record.notes && <div className="text-xs text-stone-400 mt-0.5 line-clamp-1 italic">{record.notes}</div>}
                                                </td>
                                                <td className="px-6 py-5 text-stone-600 font-medium">
                                                    {vaccinationService.formatDate(record.vaccinationDate)}
                                                </td>
                                                <td className="px-6 py-5">
                                                    <div className="font-bold text-orange-600">
                                                        {vaccinationService.formatDate(record.nextDueDate)}
                                                    </div>
                                                </td>
                                                <td className="px-6 py-5">
                                                    <div className="flex items-center gap-2">
                                                        <div className="w-8 h-8 rounded-full bg-orange-100 flex items-center justify-center text-xs font-bold text-orange-700">
                                                            {record.vetName ? record.vetName.charAt(0) : '?'}
                                                        </div>
                                                        <span className="text-sm font-medium text-stone-700">{record.vetName || 'Chưa cập nhật'}</span>
                                                    </div>
                                                </td>
                                                <td className="px-6 py-5">
                                                    {record.workflowStatus === 'PENDING' ? (
                                                        <span className="inline-flex items-center px-3 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider border bg-stone-50 text-stone-500 border-stone-200">
                                                            <ClockIcon className="w-3 h-3 mr-1.5" />
                                                            Chờ tiêm
                                                        </span>
                                                    ) : (
                                                        (() => {
                                                            const status = vaccinationService.calculateStatus(record.nextDueDate);
                                                            return (
                                                                <span className={`inline-flex items-center px-3 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider border ${status === 'Valid' ? 'bg-green-50 text-green-700 border-green-100' :
                                                                    status === 'Overdue' ? 'bg-red-50 text-red-700 border-red-100' :
                                                                        'bg-orange-50 text-orange-700 border-orange-100'
                                                                    }`}>
                                                                    <span className={`w-1.5 h-1.5 rounded-full mr-1.5 ${status === 'Valid' ? 'bg-green-600' :
                                                                        status === 'Overdue' ? 'bg-red-600' :
                                                                            'bg-orange-600'
                                                                        }`} />
                                                                    {status === 'Valid' ? 'Hiệu lực' : status === 'Overdue' ? 'Quá hạn' : 'Sắp hết hạn'}
                                                                </span>
                                                            );
                                                        })()
                                                    )}
                                                </td>
                                                <td className="px-6 py-5 text-right">
                                                    <button
                                                        onClick={() => handleDelete(record.id)}
                                                        className="p-2 text-stone-300 hover:text-red-600 transition-colors"
                                                        title="Xóa"
                                                    >
                                                        <TrashIcon className="w-5 h-5" />
                                                    </button>
                                                </td>
                                            </tr>
                                        ))
                                    )
                                )}
                            </tbody>
                        </table>
                    </div>
                </div>
            )}

            {/* Template Selection Modal */}
            {templateModalOpen && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-6 bg-stone-900/40 backdrop-blur-sm">
                    <div className="bg-white rounded-3xl shadow-xl w-full max-w-4xl overflow-hidden max-h-[85vh] flex flex-col animate-in zoom-in-95 duration-200">
                        <div className="p-6 border-b border-stone-100 flex justify-between items-center bg-white">
                            <div>
                                <h2 className="text-xl font-bold text-stone-800">Danh Mục Vaccine</h2>
                                <p className="text-stone-400 text-sm mt-0.5">Chọn loại vaccine phù hợp với loài của thú cưng</p>
                            </div>
                            <button
                                onClick={() => setTemplateModalOpen(false)}
                                className="w-9 h-9 flex items-center justify-center rounded-full hover:bg-stone-100 text-stone-400 transition-colors text-xl"
                            >
                                &times;
                            </button>
                        </div>

                        <div className="flex-1 overflow-y-auto p-4">
                            {filteredTemplates.length === 0 ? (
                                <div className="p-20 text-center space-y-4">
                                    <div className="w-20 h-20 bg-stone-50 rounded-full flex items-center justify-center mx-auto">
                                        <ListBulletIcon className="w-10 h-10 text-stone-200" />
                                    </div>
                                    <p className="text-stone-400 font-medium">Không tìm thấy vaccine phù hợp với loài này.</p>
                                </div>
                            ) : (
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                    {filteredTemplates.map((tpl) => (
                                        <div
                                            key={tpl.id}
                                            onClick={() => handleSelectTemplate(tpl)}
                                            className="p-6 rounded-2xl border border-stone-100 bg-stone-50 hover:border-orange-200 hover:bg-orange-50 cursor-pointer transition-all group"
                                        >
                                            <div className="flex justify-between items-start mb-4">
                                                <div className="font-bold text-stone-800 group-hover:text-orange-700 transition-colors">
                                                    {tpl.name}
                                                </div>
                                                <div className="text-xs font-bold text-orange-600 bg-white px-2 py-1 rounded-lg border border-orange-100 shadow-sm">
                                                    {tpl.defaultPrice?.toLocaleString('vi-VN')}đ
                                                </div>
                                            </div>
                                            <div className="space-y-2">
                                                <div className="flex items-center gap-2 text-[10px] font-bold text-stone-500 uppercase tracking-wider">
                                                    <span className="text-stone-400">Hãng:</span>
                                                    <span className="text-stone-700">{tpl.manufacturer}</span>
                                                </div>
                                                <div className="flex items-center gap-2 text-[10px] font-bold text-stone-500 uppercase tracking-wider">
                                                    <span className="text-stone-400">Lịch tiêm:</span>
                                                    <span className="text-stone-700">{tpl.seriesDoses} mũi • {tpl.repeatIntervalDays} ngày/mũi</span>
                                                </div>
                                            </div>
                                            {tpl.description && (
                                                <p className="text-xs text-stone-400 mt-4 line-clamp-2 italic leading-relaxed">{tpl.description}</p>
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
        </div>
    )
}

export default VaccinationPage
