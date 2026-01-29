import { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { CalendarIcon, PlusIcon, TrashIcon, ArrowLeftIcon } from '@heroicons/react/24/outline'
import DatePicker, { registerLocale } from 'react-datepicker'
import { vi } from 'date-fns/locale'
import 'react-datepicker/dist/react-datepicker.css'
import { vaccinationService, type VaccinationRecord } from '../../../services/vaccinationService'
import { useToast } from '../../../components/Toast'

// Register Vietnamese locale
registerLocale('vi', vi)

const VACCINE_TYPES = [
    'Rabies',
    'DHPP (Distemper/Parvo)',
    'Bordetella',
    'Leptospirosis',
    'Lyme Disease',
    'FVRCP (Cats)',
    'FeLV (Cats)',
    'Other'
]

const VaccinationPage = () => {
    const { petId } = useParams<{ petId: string }>()
    const navigate = useNavigate()
    const { showToast } = useToast()

    const [records, setRecords] = useState<VaccinationRecord[]>([])
    const [isLoading, setIsLoading] = useState(true)
    const [isSubmitting, setIsSubmitting] = useState(false)

    // Form State
    const [vaccineName, setVaccineName] = useState('')
    const [batchNumber, setBatchNumber] = useState('')
    const [vaccinationDate, setVaccinationDate] = useState<Date>(new Date())
    const [nextDueDate, setNextDueDate] = useState<Date | null>(null)
    const [notes, setNotes] = useState('')

    useEffect(() => {
        if (petId) fetchRecords()
    }, [petId])

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
                vaccineName,
                batchNumber,
                vaccinationDate: vaccinationDate.toISOString().split('T')[0],
                nextDueDate: nextDueDate ? nextDueDate.toISOString().split('T')[0] : undefined,
                notes
            })

            showToast('success', 'Đã thêm hồ sơ tiêm chủng')
            resetForm()
            fetchRecords()
        } catch (error) {
            console.error(error)
            showToast('error', 'Lỗi khi thêm hồ sơ')
        } finally {
            setIsSubmitting(false)
        }
    }

    const resetForm = () => {
        setVaccineName('')
        setBatchNumber('')
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
        } catch (error) {
            console.error(error)
            showToast('error', 'Xóa thất bại')
        }
    }

    const getStatusColor = (status: string) => {
        switch (status) {
            case 'Valid': return 'bg-green-100 text-green-700 border-green-200'
            case 'Expiring Soon': return 'bg-yellow-100 text-yellow-700 border-yellow-200'
            case 'Overdue': return 'bg-red-100 text-red-700 border-red-200'
            default: return 'bg-stone-100 text-stone-700 border-stone-200'
        }
    }

    return (
        <div className="p-8 max-w-6xl mx-auto space-y-8">
            <div className="flex items-center justify-between">
                <div className="flex items-center gap-4">
                    <button onClick={() => navigate(-1)} className="p-2 hover:bg-stone-100 rounded-full">
                        <ArrowLeftIcon className="w-6 h-6 text-stone-600" />
                    </button>
                    <h1 className="heading-brutal text-3xl">Quản Lý Tiêm Chủng</h1>
                </div>
            </div>

            {/* Form Section */}
            <div className="border-brutal bg-white p-6 shadow-brutal">
                <div className="flex items-center gap-2 mb-6 text-blue-600">
                    <PlusIcon className="w-5 h-5" />
                    <h2 className="text-lg font-bold">Ghi Nhận Mũi Tiêm Mới</h2>
                </div>

                <form onSubmit={handleSubmit} className="space-y-6">
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                        {/* Vaccine Type */}
                        <div className="space-y-1">
                            <label className="block text-sm font-bold text-stone-700">Loại Vaccine *</label>
                            <input
                                type="text"
                                list="vaccine-types"
                                value={vaccineName}
                                onChange={(e) => setVaccineName(e.target.value)}
                                placeholder="Chọn hoặc nhập tên..."
                                className="input-brutal w-full"
                                required
                            />
                            <datalist id="vaccine-types">
                                {VACCINE_TYPES.map(type => (
                                    <option key={type} value={type} />
                                ))}
                            </datalist>
                        </div>

                        {/* Date Administered */}
                        <div className="space-y-1">
                            <label className="block text-sm font-bold text-stone-700">Ngày Tiêm *</label>
                            <div className="relative">
                                <DatePicker
                                    selected={vaccinationDate}
                                    onChange={(date: Date | null) => setVaccinationDate(date || new Date())}
                                    dateFormat="dd/MM/yyyy"
                                    locale="vi"
                                    className="input-brutal w-full pl-10"
                                />
                                <CalendarIcon className="w-5 h-5 text-stone-500 absolute left-3 top-1/2 -translate-y-1/2" />
                            </div>
                        </div>

                        {/* Next Due Date */}
                        <div className="space-y-1">
                            <label className="block text-sm font-bold text-stone-700">Ngày Tái Chủng (Dự kiến)</label>
                            <div className="relative">
                                <DatePicker
                                    selected={nextDueDate}
                                    onChange={(date: Date | null) => setNextDueDate(date)}
                                    dateFormat="dd/MM/yyyy"
                                    locale="vi"
                                    placeholderText="dd/mm/yyyy"
                                    className="input-brutal w-full pl-10"
                                    minDate={vaccinationDate}
                                />
                                <CalendarIcon className="w-5 h-5 text-stone-500 absolute left-3 top-1/2 -translate-y-1/2" />
                            </div>
                        </div>

                        {/* Batch No */}
                        <div className="space-y-1">
                            <label className="block text-sm font-bold text-stone-700">Số Lô (Batch No.)</label>
                            <input
                                type="text"
                                value={batchNumber}
                                onChange={(e) => setBatchNumber(e.target.value)}
                                placeholder="VD: RB-992"
                                className="input-brutal w-full"
                            />
                        </div>
                    </div>

                    {/* Notes */}
                    <div className="space-y-1">
                        <label className="block text-sm font-bold text-stone-700">Ghi Chú / Phản Ứng</label>
                        <input
                            type="text"
                            value={notes}
                            onChange={(e) => setNotes(e.target.value)}
                            placeholder="Ghi chú thêm về phản ứng sau tiêm..."
                            className="input-brutal w-full"
                        />
                    </div>

                    <div className="flex justify-end">
                        <button
                            type="submit"
                            disabled={isSubmitting}
                            className="btn-brutal bg-blue-600 text-white hover:bg-blue-700 disabled:bg-stone-400"
                        >
                            {isSubmitting ? 'Đang lưu...' : 'Lưu Hồ Sơ'}
                        </button>
                    </div>
                </form>
            </div>

            {/* History Table */}
            <div className="space-y-4">
                <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                        <span className="text-xl font-bold text-stone-800">↻</span>
                        <h2 className="text-xl font-bold text-stone-900">Lịch Sử Tiêm Chủng</h2>
                    </div>
                    {/* Add Filter/Export buttons here if needed */}
                </div>

                <div className="border-brutal bg-white overflow-hidden">
                    <div className="overflow-x-auto">
                        <table className="w-full text-left border-collapse">
                            <thead>
                                <tr className="bg-stone-50 border-b-2 border-stone-900 text-stone-600 text-xs uppercase tracking-wider">
                                    <th className="p-4">Vaccine</th>
                                    <th className="p-4">Ngày Tiêm</th>
                                    <th className="p-4">Tái Chủng</th>
                                    <th className="p-4">Số Lô</th>
                                    <th className="p-4">Bác Sĩ</th>
                                    <th className="p-4">Trạng Thái</th>
                                    <th className="p-4 text-right"></th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-stone-200">
                                {isLoading ? (
                                    <tr>
                                        <td colSpan={7} className="p-8 text-center text-stone-500">Đang tải dữ liệu...</td>
                                    </tr>
                                ) : records.length === 0 ? (
                                    <tr>
                                        <td colSpan={7} className="p-8 text-center text-stone-500">Chưa có lịch sử tiêm chủng nào.</td>
                                    </tr>
                                ) : (
                                    records.map((record) => (
                                        <tr key={record.id} className="hover:bg-stone-50">
                                            <td className="p-4">
                                                <div className="font-bold text-stone-900">{record.vaccineName}</div>
                                                {record.notes && <div className="text-xs text-stone-500 truncate max-w-[150px]">{record.notes}</div>}
                                            </td>
                                            <td className="p-4 text-stone-700">
                                                {new Date(record.vaccinationDate).toLocaleDateString('vi-VN')}
                                            </td>
                                            <td className="p-4 text-stone-700">
                                                {record.nextDueDate ? (
                                                    <div className="font-medium">
                                                        {new Date(record.nextDueDate).toLocaleDateString('vi-VN')}
                                                    </div>
                                                ) : (
                                                    <span className="text-stone-400">-</span>
                                                )}
                                            </td>
                                            <td className="p-4 text-stone-600 font-mono text-sm">
                                                {record.batchNumber || '-'}
                                            </td>
                                            <td className="p-4">
                                                <div className="flex items-center gap-2">
                                                    <div className="w-6 h-6 rounded-full bg-amber-100 flex items-center justify-center text-xs font-bold text-amber-600">
                                                        {record.staffName.charAt(0)}
                                                    </div>
                                                    <span className="text-sm font-medium">{record.staffName}</span>
                                                </div>
                                            </td>
                                            <td className="p-4">
                                                <span className={`px-3 py-1 rounded-full text-xs font-bold border ${getStatusColor(record.status)}`}>
                                                    {record.status === 'Valid' ? 'Hiệu lực' : record.status === 'Overdue' ? 'Quá hạn' : 'Sắp hết hạn'}
                                                </span>
                                            </td>
                                            <td className="p-4 text-right">
                                                <button
                                                    onClick={() => handleDelete(record.id)}
                                                    className="p-1 hover:bg-red-50 text-stone-400 hover:text-red-600 rounded"
                                                    title="Xóa"
                                                >
                                                    <TrashIcon className="w-5 h-5" />
                                                </button>
                                            </td>
                                        </tr>
                                    ))
                                )}
                            </tbody>
                        </table>
                    </div>
                </div>
            </div>
        </div>
    )
}

export default VaccinationPage
