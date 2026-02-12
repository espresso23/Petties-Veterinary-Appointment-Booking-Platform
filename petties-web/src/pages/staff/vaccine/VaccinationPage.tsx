import { useState, useEffect } from 'react'
import { useParams, useNavigate, useSearchParams } from 'react-router-dom'
import { PlusIcon, TrashIcon, ArrowLeftIcon, ListBulletIcon, ClockIcon, Squares2X2Icon, PencilIcon, XMarkIcon } from '@heroicons/react/24/outline'
import { registerLocale } from 'react-datepicker'
import { vi } from 'date-fns/locale'
import 'react-datepicker/dist/react-datepicker.css'
import { vaccinationService, type VaccinationRecord } from '../../../services/vaccinationService'
import { vaccineTemplateService, type VaccineTemplate } from '../../../services/api/vaccineTemplateService'
import { petService, type Pet } from '../../../services/api/petService'
import { SmartVaccinationForm, type VaccinationFormData } from '../../../components/vaccination/SmartVaccinationForm'
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
    const [viewMode, setViewMode] = useState<'list' | 'roadmap'>('list')
    const [upcomingRecords, setUpcomingRecords] = useState<VaccinationRecord[]>([])

    // Edit State
    const [editingId, setEditingId] = useState<string | null>(null)
    const [formInitialData, setFormInitialData] = useState<Partial<VaccinationFormData> | undefined>(undefined)

    useEffect(() => {
        if (petId) {
            fetchRecords()
            fetchPet()
            fetchTemplates()
            fetchUpcoming()
        }
    }, [petId])

    // Auto-prefill if bookingId is provided
    useEffect(() => {
        if (bookingId && !isLoading && templates.length > 0 && !editingId) {
            console.log('Search query for draft records. BookingId:', bookingId);

            // Find records that match bookingId (UUID) - use case-insensitive matching
            const targetBookingId = bookingId.toLowerCase();
            const pendingRecords = records.filter(r =>
                r.bookingId?.toLowerCase() === targetBookingId &&
                r.workflowStatus === 'PENDING'
            );

            if (pendingRecords.length > 0) {
                // Focus on the first pending record
                const pendingRecord = pendingRecords[0];
                console.log('Found draft record for booking:', pendingRecord);

                // Set editing mode for this pending draft
                setEditingId(pendingRecord.id);

                const newVaccDate = pendingRecord.vaccinationDate ? new Date(pendingRecord.vaccinationDate) : new Date();
                let nextDueDateObj: Date | undefined = undefined;

                if (pendingRecord.vaccineTemplateId) {
                    const tpl = templates.find(t => t.id === pendingRecord.vaccineTemplateId);
                    if (tpl && tpl.repeatIntervalDays) {
                        const nextDate = new Date(newVaccDate);
                        nextDate.setDate(nextDate.getDate() + tpl.repeatIntervalDays);
                        nextDueDateObj = nextDate;
                    }
                }

                setFormInitialData({
                    vaccineName: pendingRecord.vaccineName,
                    vaccineTemplateId: pendingRecord.vaccineTemplateId || undefined,
                    doseSequence: pendingRecord.doseNumber === 4 ? 'ANNUAL' : String(pendingRecord.doseNumber || 1),
                    vaccinationDate: newVaccDate,
                    nextDueDate: nextDueDateObj,
                    notes: pendingRecord.notes || ''
                });

                if (pendingRecords.length > 1) {
                    showToast('info', `Tìm thấy ${pendingRecords.length} mũi tiêm nháp. Đã điền mũi đầu tiên.`);
                } else {
                    showToast('info', `Đã tự động điền thông tin vắc-xin từ lịch hẹn.`);
                }
            } else {
                console.warn('No PENDING record found in records list for bookingId:', bookingId);
                console.log('Available records:', records);

                // Check if any record exists at all for this booking
                const anyRecordForBooking = records.some(r => r.bookingId?.toLowerCase() === targetBookingId);
                if (anyRecordForBooking) {
                    console.info('Found existing records for this booking, but none are PENDING.');
                }
            }
        }
    }, [bookingId, records, templates, editingId, isLoading])

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

    const handleSubmit = async (data: VaccinationFormData) => {
        if (!petId) {
            showToast('error', 'Vui lòng điền các trường bắt buộc')
            return
        }

        setIsSubmitting(true)
        try {
            const { vaccineName, vaccineTemplateId, vaccinationDate, nextDueDate, doseSequence, notes } = data

            if (editingId) {
                // UPDATE mode
                await vaccinationService.updateVaccination(editingId, {
                    petId,
                    vaccineName,
                    vaccineTemplateId,
                    vaccinationDate: vaccinationDate.toISOString().split('T')[0],
                    nextDueDate: nextDueDate ? nextDueDate.toISOString().split('T')[0] : undefined,
                    doseSequence,
                    notes,
                    workflowStatus: 'COMPLETED' // Explicitly mark as completed
                })
                showToast('success', 'Đã cập nhật hồ sơ tiêm chủng')
            } else {
                // CREATE mode
                await vaccinationService.createVaccination({
                    petId,
                    bookingId: bookingId || undefined,
                    vaccineName,
                    vaccineTemplateId,
                    vaccinationDate: vaccinationDate.toISOString().split('T')[0],
                    nextDueDate: nextDueDate ? nextDueDate.toISOString().split('T')[0] : undefined,
                    doseSequence,
                    notes,
                    workflowStatus: 'COMPLETED' // Explicitly mark as completed
                })
                showToast('success', 'Đã thêm hồ sơ tiêm chủng')
            }
            resetForm()
            fetchRecords()
            fetchUpcoming()
        } catch (error: any) {
            console.error(error)
            const errorMessage = error?.response?.data?.message || error?.message || 'Lỗi khi lưu hồ sơ'
            showToast('error', errorMessage)
        } finally {
            setIsSubmitting(false)
        }
    }

    const resetForm = () => {
        setEditingId(null)
        setFormInitialData(undefined)
    }

    const handleEdit = (record: VaccinationRecord) => {
        setEditingId(record.id)
        setFormInitialData({
            vaccineName: record.vaccineName,
            vaccineTemplateId: record.vaccineTemplateId || undefined,
            vaccinationDate: record.vaccinationDate ? new Date(record.vaccinationDate) : new Date(),
            nextDueDate: record.nextDueDate ? new Date(record.nextDueDate) : undefined,
            doseSequence: record.doseNumber === 4 ? 'ANNUAL' : String(record.doseNumber || 1),
            notes: record.notes || ''
        })
        window.scrollTo({ top: 0, behavior: 'smooth' })
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
            <div className={`bg-white rounded-[32px] shadow-sm border overflow-hidden ${editingId ? 'border-blue-300 ring-2 ring-blue-100' : 'border-stone-200'}`}>
                <div className={`px-10 py-5 border-b flex items-center justify-between ${editingId ? 'bg-blue-50 border-blue-100' : 'bg-orange-50 border-orange-100'}`}>
                    <div className="flex items-center gap-2">
                        {editingId ? (
                            <>
                                <PencilIcon className="w-5 h-5 text-blue-600" />
                                <h2 className="text-lg font-bold text-blue-900">Chỉnh Sửa Hồ Sơ</h2>
                            </>
                        ) : (
                            <>
                                <PlusIcon className="w-5 h-5 text-orange-600" />
                                <h2 className="text-lg font-bold text-orange-900">Ghi Nhận Mũi Tiêm Mới</h2>
                            </>
                        )}
                    </div>
                    <div className="flex items-center gap-2">
                        {editingId && (
                            <button
                                type="button"
                                onClick={resetForm}
                                className="px-3 py-1 bg-white text-stone-600 text-xs font-bold rounded-full border border-stone-200 shadow-sm hover:bg-stone-100 flex items-center gap-1"
                            >
                                <XMarkIcon className="w-4 h-4" />
                                Hủy
                            </button>
                        )}
                        {bookingCode && !editingId && (
                            <div className="px-3 py-1 bg-white text-orange-700 text-xs font-bold rounded-full border border-orange-200 shadow-sm">
                                Booking #{bookingCode}
                            </div>
                        )}
                    </div>
                </div>

                <div className="px-10 py-8">
                    <SmartVaccinationForm
                        pet={pet}
                        records={records}
                        templates={templates}
                        initialData={formInitialData}
                        bookingCode={bookingCode || undefined}
                        isSubmitting={isSubmitting}
                        onSubmit={handleSubmit}
                        isEditing={!!editingId}
                        onCancel={editingId ? resetForm : undefined}
                    />
                </div>
            </div>

            {/* View Mode Toggle & History Header */}
            <div className="flex flex-col md:flex-row md:items-end justify-between gap-4 px-1">
                <div className="flex items-center gap-2">
                    <h2 className="text-xl font-bold text-stone-800">Lịch Sử Tiêm Chủng</h2>
                    <div className="h-1 w-20 bg-orange-100 rounded-full ml-4" />
                </div>

                <div className="flex bg-stone-100/80 p-1.5 rounded-2xl border border-stone-200/60 w-fit backdrop-blur-sm">
                    <button
                        onClick={() => setViewMode('list')}
                        className={`flex items-center gap-2 px-6 py-2.5 rounded-xl text-xs font-black transition-all ${viewMode === 'list'
                            ? 'bg-white text-orange-600 shadow-sm border border-stone-200 ring-1 ring-orange-50/50'
                            : 'text-stone-400 hover:text-stone-600'
                            }`}
                    >
                        <ListBulletIcon className="w-4 h-4" />
                        DANH SÁCH
                    </button>
                    <button
                        onClick={() => setViewMode('roadmap')}
                        className={`flex items-center gap-2 px-6 py-2.5 rounded-xl text-xs font-black transition-all ${viewMode === 'roadmap'
                            ? 'bg-white text-orange-600 shadow-sm border border-stone-200 ring-1 ring-orange-50/50'
                            : 'text-stone-400 hover:text-stone-700'
                            }`}
                    >
                        <Squares2X2Icon className="w-4 h-4" />
                        LỘ TRÌNH (GRID)
                    </button>
                </div>
            </div>

            {/* Combined Future Section (Predictions + Actual Bookings) */}
            {(() => {
                const pendingRecords = records.filter(r => r.workflowStatus === 'PENDING');

                // Merge logic: If a vaccine has a PENDING record, use it. Otherwise use upcoming suggestions.
                // This removes the redundancy noted by the user.
                const combinedFutures = [...upcomingRecords];

                // Add pending records that are NOT already in upcoming (by name)
                // Actually, PENDING records usually ARE the next dose, so they should replace suggestions for the same vaccine
                pendingRecords.forEach(pending => {
                    const idx = combinedFutures.findIndex(u => u.vaccineName === pending.vaccineName);
                    if (idx !== -1) {
                        // Replace suggestion with actual pending record (it has real booking info)
                        combinedFutures[idx] = pending;
                    } else {
                        combinedFutures.push(pending);
                    }
                });

                if (combinedFutures.length === 0) return null;

                return (
                    <div className="bg-white rounded-2xl shadow-sm border border-orange-200 overflow-hidden">
                        <div className="bg-orange-50 px-6 py-3 border-b border-orange-100 flex items-center justify-between">
                            <div className="flex items-center gap-2">
                                <ClockIcon className="w-5 h-5 text-orange-600" />
                                <h3 className="text-sm font-bold text-orange-800 uppercase tracking-wider">Mũi Tiêm Tiếp Theo & Gợi Ý</h3>
                                <span className="ml-2 px-2 py-0.5 bg-orange-200 text-orange-800 text-xs font-bold rounded-full">
                                    {combinedFutures.length}
                                </span>
                            </div>
                            <div className="text-[10px] text-orange-600 font-bold uppercase tracking-widest hidden md:block">
                                Tự động gợi ý dựa trên lịch sử tiêm
                            </div>
                        </div>
                        <div className="p-4 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                            {combinedFutures.map((rec, idx) => {
                                const isPending = 'workflowStatus' in rec && rec.workflowStatus === 'PENDING';
                                return (
                                    <div key={idx} className={`flex items-center justify-between p-4 rounded-xl border transition-all group ${isPending ? 'bg-amber-50/40 border-amber-200 hover:border-amber-400' : 'bg-orange-50/30 border-orange-100 hover:border-orange-300'
                                        }`}>
                                        <div>
                                            <div className="font-bold text-stone-800 flex items-center gap-2">
                                                {rec.vaccineName}
                                                {isPending && (
                                                    <span className="text-[9px] bg-amber-200 text-amber-800 px-1.5 py-0.5 rounded uppercase font-black">Chờ Tiêm</span>
                                                )}
                                            </div>
                                            <div className={`text-xs font-bold mt-1 ${isPending ? 'text-amber-700' : 'text-orange-600'}`}>
                                                {rec.doseNumber === 4 ? 'Hàng năm' : `Mũi ${rec.doseNumber}`} • {vaccinationService.formatDate(rec.nextDueDate)}
                                            </div>
                                            <div className="text-[10px] text-stone-400 mt-0.5 italic line-clamp-1">
                                                {rec.notes || (isPending ? 'Mũi tiêm đã được đặt lịch' : 'Theo lộ trình dự kiến')}
                                            </div>
                                        </div>
                                        <button
                                            onClick={() => {
                                                if (isPending && (rec as any).id) {
                                                    setEditingId((rec as any).id);
                                                } else {
                                                    setEditingId(null);
                                                }

                                                const newVaccDate = rec.nextDueDate ? new Date(rec.nextDueDate) : new Date();
                                                let nextDueDateObj = undefined;

                                                if (rec.vaccineTemplateId) {
                                                    const tpl = templates.find(t => t.id === rec.vaccineTemplateId);
                                                    if (tpl && tpl.repeatIntervalDays) {
                                                        const nextDate = new Date(newVaccDate);
                                                        nextDate.setDate(nextDate.getDate() + tpl.repeatIntervalDays);
                                                        nextDueDateObj = nextDate;
                                                    }
                                                }

                                                setFormInitialData({
                                                    vaccineName: rec.vaccineName,
                                                    vaccineTemplateId: rec.vaccineTemplateId || undefined,
                                                    doseSequence: rec.doseNumber === 4 ? 'ANNUAL' : String(rec.doseNumber || 1),
                                                    vaccinationDate: newVaccDate,
                                                    nextDueDate: nextDueDateObj,
                                                    notes: isPending ? (rec.notes || '') : ''
                                                });

                                                window.scrollTo({ top: 0, behavior: 'smooth' });
                                                if (isPending) showToast('info', 'Đã tải thông tin lịch hẹn.');
                                            }}
                                            className={`p-2 rounded-lg border shadow-sm transition-all opacity-0 group-hover:opacity-100 ${isPending
                                                    ? 'bg-white text-amber-600 border-amber-200 hover:bg-amber-600 hover:text-white'
                                                    : 'bg-white text-orange-600 border-orange-200 hover:bg-orange-600 hover:text-white'
                                                }`}
                                            title={isPending ? "Xác nhận thực hiện mũi tiêm này" : "Ghi nhận theo gợi ý"}
                                        >
                                            <PlusIcon className="w-4 h-4" />
                                        </button>
                                    </div>
                                );
                            })}
                        </div>
                    </div>
                );
            })()}

            {viewMode === 'roadmap' ? (
                <VaccinationRoadmap
                    records={records.filter(r => r.workflowStatus === 'COMPLETED')}
                    upcomingRecords={upcomingRecords}
                />
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
                                    records.filter(r => r.workflowStatus === 'COMPLETED').length === 0 ? (
                                        <tr>
                                            <td colSpan={6} className="p-12 text-center text-stone-400 font-medium italic">Chưa có lịch sử tiêm chủng.</td>
                                        </tr>
                                    ) : (
                                        records.filter(r => r.workflowStatus === 'COMPLETED').map((record) => (
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
                                                    {(() => {
                                                        const status = vaccinationService.calculateStatus(record.nextDueDate);
                                                        const textColor = status === 'Valid' || status === 'N/A' ? 'text-green-600' :
                                                            status === 'Overdue' ? 'text-red-600' :
                                                                'text-orange-600';

                                                        return (
                                                            <div className={`font-bold ${textColor}`}>
                                                                {vaccinationService.formatDate(record.nextDueDate)}
                                                            </div>
                                                        );
                                                    })()}
                                                </td>
                                                <td className="px-6 py-5">
                                                    <div className="flex items-center gap-2">
                                                        <div className="w-8 h-8 rounded-full bg-orange-100 flex items-center justify-center text-xs font-bold text-orange-700">
                                                            {record.staffName ? record.staffName.charAt(0) : '?'}
                                                        </div>
                                                        <span className="text-sm font-medium text-stone-700">{record.staffName || 'Chưa cập nhật'}</span>
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
                                                            const colorClass = status === 'Valid' || status === 'N/A' ? 'bg-green-50 text-green-700 border-green-100' :
                                                                status === 'Overdue' ? 'bg-red-50 text-red-700 border-red-100' :
                                                                    'bg-orange-50 text-orange-700 border-orange-100'; // Expiring Soon

                                                            const dotClass = status === 'Valid' || status === 'N/A' ? 'bg-green-600' :
                                                                status === 'Overdue' ? 'bg-red-600' :
                                                                    'bg-orange-600';

                                                            const label = status === 'Valid' || status === 'N/A' ? 'Hiệu lực' :
                                                                status === 'Overdue' ? 'Quá hạn' : 'Sắp hết hạn';

                                                            return (
                                                                <span className={`inline-flex items-center px-3 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider border ${colorClass}`}>
                                                                    <span className={`w-1.5 h-1.5 rounded-full mr-1.5 ${dotClass}`} />
                                                                    {label}
                                                                </span>
                                                            );
                                                        })()
                                                    )}
                                                </td>
                                                <td className="px-6 py-5 text-right">
                                                    <div className="flex items-center justify-end gap-1">
                                                        <button
                                                            onClick={() => handleEdit(record)}
                                                            className="p-2 text-stone-300 hover:text-blue-600 transition-colors"
                                                            title="Sửa"
                                                        >
                                                            <PencilIcon className="w-5 h-5" />
                                                        </button>
                                                        <button
                                                            onClick={() => handleDelete(record.id)}
                                                            className="p-2 text-stone-300 hover:text-red-600 transition-colors"
                                                            title="Xóa"
                                                        >
                                                            <TrashIcon className="w-5 h-5" />
                                                        </button>
                                                    </div>
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
        </div >
    )
}

export default VaccinationPage
