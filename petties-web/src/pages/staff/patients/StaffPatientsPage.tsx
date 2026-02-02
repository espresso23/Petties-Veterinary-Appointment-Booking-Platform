import { useState, useEffect } from 'react'
import { useToast } from '../../../components/Toast'
import { useNavigate } from 'react-router-dom'
import {
    MagnifyingGlassIcon,
    PlusIcon,
    XMarkIcon,
    PencilSquareIcon,
    CalendarIcon,
    TrashIcon,
    LockClosedIcon,
} from '@heroicons/react/24/outline'
import { emrService } from '../../../services/emrService'
import { getStaffPatients, type StaffPatient } from '../../../services/api/petService'
import { tokenStorage } from '../../../services/authService'
import type { EmrRecord } from '../../../services/emrService'
import { vaccinationService, type VaccinationRecord } from '../../../services/vaccinationService'
import { vaccineTemplateService, type VaccineTemplate } from '../../../services/api/vaccineTemplateService'
import DatePicker, { registerLocale } from 'react-datepicker'
import { vi } from 'date-fns/locale'
import 'react-datepicker/dist/react-datepicker.css'
import { getBookingsByStaff } from '../../../services/bookingService'
import type { Booking } from '../../../types/booking'
import { useAuthStore } from '../../../store/authStore'
import { VaccinationRoadmap } from '../vaccine/components/VaccinationRoadmap'
import { Squares2X2Icon, ListBulletIcon } from '@heroicons/react/24/outline'

// Register Vietnamese locale
registerLocale('vi', vi)

const VACCINE_TYPES = [
    'Dại (Rabies)',
    'Đa giá (DHPP)',
    'Ho cũi chó (Bordetella)',
    'Xoắn khuẩn (Lepto)',
    'Bệnh Lyme',
    'Đa giá Mèo (FVRCP)',
    'Bạch cầu Mèo (FeLV)',
    'Khác'
]

// ============= INTERFACES =============
interface Patient {
    id: string
    name: string
    species: string
    breed: string
    age: string
    sex?: string
    weight?: number
    color?: string
    imageUrl?: string
    ownerName: string
    ownerPhone?: string
    allergies?: string
    microchip?: string
    lastExamDate?: string

    // New fields
    isAssignedToMe?: boolean
    bookingStatus?: string
    nextAppointment?: string
}

type DetailTab = 'overview' | 'emr' | 'vaccinations' | 'lab' | 'documents'

// ============= COMPONENT =============
export const StaffPatientsPage = () => {
    const navigate = useNavigate()
    const { showToast } = useToast()
    const { user } = useAuthStore()

    // State
    const [bookings, setBookings] = useState<Booking[]>([])

    // Fetch active bookings for this staff to link with patients
    useEffect(() => {
        const fetchActiveBookings = async () => {
            if (!user?.userId) return
            try {
                // Fetch IN_PROGRESS and ASSIGNED bookings
                const [inProgress, assigned] = await Promise.all([
                    getBookingsByStaff(user.userId, 'IN_PROGRESS', 0, 100).catch(() => ({ content: [] })),
                    getBookingsByStaff(user.userId, 'ASSIGNED', 0, 100).catch(() => ({ content: [] }))
                ])
                // Merge lists
                const all = [...(inProgress.content || []), ...(assigned.content || [])]
                setBookings(all)
            } catch (err) {
                console.error("Failed to fetch bookings for linking", err)
            }
        }

        if (user?.userId) {
            fetchActiveBookings()
        }
    }, [user?.userId])

    // State
    const [patients, setPatients] = useState<Patient[]>([])
    const [isLoadingPatients, setIsLoadingPatients] = useState(true)
    const [searchQuery, setSearchQuery] = useState('')
    const [speciesFilter, setSpeciesFilter] = useState<string>('all')
    const [sortBy, setSortBy] = useState<string>('priority') // Default to priority
    const [currentPage, setCurrentPage] = useState(1)
    const [rowsPerPage, setRowsPerPage] = useState(10)
    const [totalPatients, setTotalPatients] = useState(0)

    // Vaccine Templates
    const [vaccineTemplates, setVaccineTemplates] = useState<VaccineTemplate[]>([])
    const [selectedTemplateId, setSelectedTemplateId] = useState<string>('')

    // Modal states
    const [selectedPatient, setSelectedPatient] = useState<Patient | null>(null)
    const [activeTab, setActiveTab] = useState<DetailTab>('emr')
    const [emrRecords, setEmrRecords] = useState<EmrRecord[]>([])
    const [isLoadingEmr, setIsLoadingEmr] = useState(false)

    // Vaccination Tab State
    const [vaccinationRecords, setVaccinationRecords] = useState<VaccinationRecord[]>([])
    const [upcomingRecords, setUpcomingRecords] = useState<VaccinationRecord[]>([]) // Add state
    const [isLoadingVaccinations, setIsLoadingVaccinations] = useState(false)
    const [isAddVaccinationModalOpen, setIsAddVaccinationModalOpen] = useState(false)
    const [selectedVaccination, setSelectedVaccination] = useState<VaccinationRecord | null>(null)
    const [viewMode, setViewMode] = useState<'list' | 'roadmap'>('list')

    // Add Vaccination Form State
    const [vaccineName, setVaccineName] = useState('')
    const [vaccinationDate, setVaccinationDate] = useState<Date | null>(null)
    const [nextDueDate, setNextDueDate] = useState<Date | null>(null)
    const [vaccinationNotes, setVaccinationNotes] = useState('')
    const [doseSequence, setDoseSequence] = useState<string>('1')
    const [isSubmittingVaccination, setIsSubmittingVaccination] = useState(false)

    // Fetch Templates on mount
    useEffect(() => {
        vaccineTemplateService.getAllTemplates().then(setVaccineTemplates).catch(console.error)
    }, [])

    // Load patients from API (Prioritized)
    useEffect(() => {
        const loadPatients = async () => {
            if (!user?.userId || !user?.workingClinicId) return

            setIsLoadingPatients(true)
            try {
                // Use the new prioritized API
                const staffPatients = await getStaffPatients(user.workingClinicId, user.userId)

                const mappedPatients: Patient[] = staffPatients.map((pet: StaffPatient) => {
                    return {
                        id: pet.petId,
                        name: pet.petName,
                        species: pet.species,
                        breed: pet.breed || 'N/A',
                        age: `${pet.ageYears} tuổi ${pet.ageMonths} tháng`,
                        sex: pet.gender === 'MALE' ? 'Đực' : pet.gender === 'FEMALE' ? 'Cái' : pet.gender,
                        weight: pet.weight,
                        imageUrl: pet.imageUrl,
                        ownerName: pet.ownerName || 'N/A',
                        ownerPhone: pet.ownerPhone,
                        isAssignedToMe: pet.isAssignedToMe,
                        bookingStatus: pet.bookingStatus,
                        nextAppointment: pet.nextAppointment,
                        lastExamDate: pet.lastVisitDate,
                        allergies: pet.allergies // Map allergies field
                    }
                })
                setPatients(mappedPatients)
                setTotalPatients(mappedPatients.length)
            } catch (err) {
                console.error('Error loading patients:', err)
                setPatients([])
                setTotalPatients(0)
            } finally {
                setIsLoadingPatients(false)
            }
        }
        if (user?.userId) {
            loadPatients()
        }
    }, [user?.userId, user?.workingClinicId])

    // Load Data based on Tab
    useEffect(() => {
        if (!selectedPatient) return

        if (activeTab === 'emr') {
            setIsLoadingEmr(true)
            emrService.getEmrsByPetId(selectedPatient.id)
                .then(records => setEmrRecords(records))
                .catch(() => setEmrRecords([]))
                .finally(() => setIsLoadingEmr(false))
        } else if (activeTab === 'vaccinations') {
            fetchVaccinations()
        }
    }, [selectedPatient, activeTab])

    const fetchVaccinations = async () => {
        if (!selectedPatient) return
        setIsLoadingVaccinations(true)
        try {
            const [records, upcoming] = await Promise.all([
                vaccinationService.getVaccinationsByPet(selectedPatient.id),
                vaccinationService.getUpcomingVaccinations(selectedPatient.id)
            ])
            setVaccinationRecords(records)
            setUpcomingRecords(upcoming)
        } catch (err) {
            console.error(err)
            showToast('error', 'Không thể tải lịch sử tiêm chủng')
        } finally {
            setIsLoadingVaccinations(false)
        }
    }

    const handleAddVaccination = async (e: React.FormEvent) => {
        e.preventDefault()
        if (!selectedPatient || !vaccineName || !vaccinationDate) {
            showToast('error', 'Vui lòng điền các trường bắt buộc')
            return
        }

        setIsSubmittingVaccination(true)
        try {
            // Find active booking
            const activeBooking = bookings.find(b =>
                b.petId === selectedPatient.id &&
                (b.status === 'IN_PROGRESS' || b.status === 'ASSIGNED')
            )

            await vaccinationService.createVaccination({
                petId: selectedPatient.id,
                bookingId: activeBooking?.bookingId,
                vaccineName,
                // batchNumber removed from Service but kept in UI if user wants to log in notes
                vaccineTemplateId: selectedTemplateId !== 'manual' ? selectedTemplateId : undefined,
                vaccinationDate: vaccinationDate.toISOString().split('T')[0],
                nextDueDate: nextDueDate ? nextDueDate.toISOString().split('T')[0] : undefined,
                doseSequence,
                notes: vaccinationNotes
            })

            showToast('success', 'Đã thêm hồ sơ tiêm chủng')
            resetVaccinationForm()
            setIsAddVaccinationModalOpen(false)
            fetchVaccinations()
        } catch (error) {
            console.error(error)
            showToast('error', 'Lỗi khi thêm hồ sơ')
        } finally {
            setIsSubmittingVaccination(false)
        }
    }

    const resetVaccinationForm = () => {
        setVaccineName('')
        setSelectedTemplateId('')
        setDoseSequence('1')
        setVaccinationDate(new Date())
        setNextDueDate(null)
        setVaccinationNotes('')
    }

    const handleDeleteVaccination = async (id: string, e?: React.MouseEvent) => {
        e?.stopPropagation()
        if (!confirm('Bạn có chắc chắn muốn xóa hồ sơ này?')) return

        try {
            await vaccinationService.deleteVaccination(id)
            showToast('success', 'Đã xóa hồ sơ')
            if (selectedVaccination?.id === id) setSelectedVaccination(null)
            fetchVaccinations()
        } catch (error) {
            console.error(error)
            showToast('error', 'Xóa thất bại')
        }
    }

    // Filter patients (client-side for search)
    const filteredPatients = patients.filter((p) => {
        const matchesSearch = p.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
            p.ownerName.toLowerCase().includes(searchQuery.toLowerCase())
        const matchesSpecies = speciesFilter === 'all' ||
            (speciesFilter === 'dog' && p.species.toLowerCase().includes('chó')) ||
            (speciesFilter === 'dog' && p.species.toLowerCase() === 'dog') ||
            (speciesFilter === 'cat' && p.species.toLowerCase().includes('mèo')) ||
            (speciesFilter === 'cat' && p.species.toLowerCase() === 'cat') ||
            (speciesFilter === 'other' && !['chó', 'dog', 'mèo', 'cat'].some(s => p.species.toLowerCase().includes(s)))
        return matchesSearch && matchesSpecies
    })

    // Sort patients
    const sortedPatients = [...filteredPatients].sort((a, b) => {
        switch (sortBy) {
            case 'priority':
                // Assuming original 'patients' list is sorted by API (which it is)
                // We trust the original order. But since filter creates a new array, 
                // and the original order is index based, if we just return 0, it keeps current order.
                // However, let's explicit: 
                // Primary: Assigned to Me
                if (a.isAssignedToMe !== b.isAssignedToMe) return a.isAssignedToMe ? -1 : 1
                return 0
            case 'name-asc':
                return a.name.localeCompare(b.name, 'vi')
            case 'name-desc':
                return b.name.localeCompare(a.name, 'vi')

            default:
                return 0
        }
    })

    // Pagination
    const totalPages = Math.ceil(totalPatients / rowsPerPage) || 1

    const getSpeciesEmoji = (species: string) => {
        const s = species.toLowerCase()
        if (s.includes('chó') || s === 'dog') return 'Chó'
        if (s.includes('mèo') || s === 'cat') return 'Mèo'
        if (s.includes('thỏ') || s === 'rabbit') return 'Thỏ'
        return 'Pet'
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
        <div className="p-8 bg-stone-50 min-h-screen">
            {/* Header */}
            <h1 className="text-3xl font-black text-stone-800 mb-6">DANH SÁCH BỆNH NHÂN</h1>

            {/* Filters */}
            <div className="flex flex-wrap items-center gap-4 mb-6 bg-white p-4 rounded-xl border border-stone-200 shadow-sm relative z-20 overflow-visible">
                {/* Search */}
                <div className="relative flex-1 min-w-[280px]">
                    <MagnifyingGlassIcon className="w-5 h-5 absolute left-3 top-1/2 -translate-y-1/2 text-stone-400" />
                    <input
                        type="text"
                        placeholder="Tìm kiếm theo tên, chủ nuôi..."
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        className="w-full pl-10 pr-4 py-2.5 border border-stone-200 rounded-lg focus:border-amber-500 focus:ring-2 focus:ring-amber-100 focus:outline-none bg-stone-50 transition-all"
                    />
                </div>

                {/* Divider */}
                <div className="h-8 w-px bg-stone-200 hidden md:block"></div>

                {/* Species Filter */}
                <div className="flex items-center gap-2">
                    <span className="text-sm font-medium text-stone-500">Loài:</span>
                    <select
                        value={speciesFilter}
                        onChange={(e) => setSpeciesFilter(e.target.value)}
                        className="px-3 py-2 border border-stone-200 rounded-lg focus:border-amber-500 focus:ring-2 focus:ring-amber-100 focus:outline-none bg-stone-50 text-sm font-medium transition-all cursor-pointer"
                    >
                        <option value="all">Tất cả</option>
                        <option value="dog">Chó</option>
                        <option value="cat">Mèo</option>
                        <option value="other">Khác</option>
                    </select>
                </div>

                {/* Divider */}
                <div className="h-8 w-px bg-stone-200 hidden md:block"></div>

                {/* Sort */}
                <div className="flex items-center gap-2">
                    <span className="text-sm font-medium text-stone-500">Sắp xếp:</span>
                    <select
                        value={sortBy}
                        onChange={(e) => setSortBy(e.target.value)}
                        className="px-3 py-2 border border-stone-200 rounded-lg focus:border-amber-500 focus:ring-2 focus:ring-amber-100 focus:outline-none bg-stone-50 text-sm font-medium transition-all cursor-pointer"
                    >
                        <option value="priority">Độ ưu tiên</option>
                        <option value="name-asc">Tên A → Z</option>
                        <option value="name-desc">Tên Z → A</option>

                    </select>
                </div>
            </div>

            {/* Table */}
            <div className="bg-white rounded-xl border border-stone-200 shadow-sm">
                {isLoadingPatients ? (
                    <div className="p-12 text-center text-stone-500">Đang tải...</div>
                ) : patients.length === 0 ? (
                    <div className="p-12 text-center text-stone-500">Chưa có bệnh nhân nào</div>
                ) : (
                    <>
                        <table className="w-full">
                            <thead className="bg-stone-50 border-b border-stone-200">
                                <tr>
                                    <th className="text-left px-4 py-3 text-sm font-bold text-stone-600">#</th>
                                    <th className="text-left px-4 py-3 text-sm font-bold text-stone-600">Thú cưng</th>
                                    <th className="text-left px-4 py-3 text-sm font-bold text-stone-600">Trạng thái</th>
                                    <th className="text-left px-4 py-3 text-sm font-bold text-stone-600">Loài/Giống</th>
                                    <th className="text-left px-4 py-3 text-sm font-bold text-stone-600">Chủ nuôi</th>
                                    <th className="text-left px-4 py-3 text-sm font-bold text-stone-600">Cân nặng</th>
                                </tr>
                            </thead>
                            <tbody>
                                {sortedPatients.map((patient, idx) => (
                                    <tr
                                        key={patient.id}
                                        onClick={() => setSelectedPatient(patient)}
                                        className="border-b border-stone-100 hover:bg-amber-50 cursor-pointer transition-colors"
                                    >
                                        <td className="px-4 py-3 text-stone-500">{(currentPage - 1) * rowsPerPage + idx + 1}</td>
                                        <td className="px-4 py-3">
                                            <div className="flex items-center gap-3">
                                                {patient.imageUrl ? (
                                                    <img src={patient.imageUrl} alt={patient.name} className="w-10 h-10 rounded-full object-cover" />
                                                ) : (
                                                    <div className="w-10 h-10 bg-stone-200 rounded-full flex items-center justify-center text-lg">
                                                        {getSpeciesEmoji(patient.species)}
                                                    </div>
                                                )}
                                                <div className="flex flex-col">
                                                    <div className="flex items-center gap-2">
                                                        <span className="font-bold text-stone-800">{patient.name}</span>
                                                        {patient.isAssignedToMe && (
                                                            <span className="px-1.5 py-0.5 bg-blue-100 text-blue-700 text-[10px] font-bold uppercase tracking-wider rounded border border-blue-200">
                                                                Của tôi
                                                            </span>
                                                        )}
                                                    </div>
                                                </div>
                                            </div>
                                        </td>
                                        <td className="px-4 py-3">
                                            {patient.bookingStatus && ['IN_PROGRESS', 'CONFIRMED', 'ASSIGNED', 'COMPLETED'].includes(patient.bookingStatus) ? (
                                                <span className={`px-2.5 py-1 rounded-full text-xs font-bold border ${(() => {
                                                    switch (patient.bookingStatus) {
                                                        case 'IN_PROGRESS': return 'bg-blue-100 text-blue-700 border-blue-200'
                                                        case 'CONFIRMED':
                                                        case 'ASSIGNED': return 'bg-orange-100 text-orange-700 border-orange-200'
                                                        case 'COMPLETED': return 'bg-green-100 text-green-700 border-green-200'
                                                        default: return 'bg-stone-100 text-stone-600 border-stone-200'
                                                    }
                                                })()}`}>
                                                    {patient.bookingStatus === 'IN_PROGRESS' ? 'Đang khám' :
                                                        (patient.bookingStatus === 'CONFIRMED' || patient.bookingStatus === 'ASSIGNED') ? 'Chờ khám' :
                                                            patient.bookingStatus === 'COMPLETED' ? 'Đã khám' : ''}
                                                </span>
                                            ) : (
                                                <span className="text-stone-400 text-xs italic">Không có lịch</span>
                                            )}
                                        </td>
                                        <td className="px-4 py-3 text-stone-600">{patient.species} / {patient.breed}</td>
                                        <td className="px-4 py-3 text-stone-600">{patient.ownerName}</td>
                                        <td className="px-4 py-3 text-stone-600">{patient.weight ? `${patient.weight} kg` : '--'}</td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>

                        {/* Pagination */}
                        <div className="flex items-center justify-between px-4 py-3 border-t border-stone-200 bg-stone-50">
                            <span className="text-sm text-stone-600">
                                Hiển thị {filteredPatients.length} / {totalPatients} bệnh nhân
                            </span>
                            <div className="flex items-center gap-2">
                                <button
                                    onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                                    disabled={currentPage === 1}
                                    className="px-3 py-1 border border-stone-300 rounded text-sm disabled:opacity-50"
                                >
                                    Trước
                                </button>
                                <span className="text-sm text-stone-600">Trang {currentPage} / {totalPages}</span>
                                <button
                                    onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                                    disabled={currentPage === totalPages}
                                    className="px-3 py-1 border border-stone-300 rounded text-sm disabled:opacity-50"
                                >
                                    Sau
                                </button>
                                <select
                                    value={rowsPerPage}
                                    onChange={(e) => setRowsPerPage(Number(e.target.value))}
                                    className="px-2 py-1 border border-stone-300 rounded text-sm"
                                >
                                    <option value={10}>10</option>
                                    <option value={25}>25</option>
                                    <option value={50}>50</option>
                                </select>
                            </div>
                        </div>
                    </>
                )}
            </div>

            {/* ============= PATIENT DETAIL MODAL ============= */}
            {selectedPatient && (
                <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
                    <div className="bg-white rounded-2xl w-full max-w-5xl max-h-[95vh] overflow-hidden shadow-2xl">

                        {/* ===== HEADER SECTION ===== */}
                        <div className="p-6 border-b border-stone-200">
                            <div className="flex items-start gap-6">
                                {/* Pet Avatar */}
                                <div className="relative">
                                    <div className="w-28 h-28 bg-gradient-to-br from-amber-100 to-amber-50 rounded-2xl flex items-center justify-center text-6xl border-2 border-amber-200 overflow-hidden">
                                        {selectedPatient.imageUrl ? (
                                            <img src={selectedPatient.imageUrl} alt={selectedPatient.name} className="w-full h-full object-cover" />
                                        ) : (
                                            getSpeciesEmoji(selectedPatient.species)
                                        )}
                                    </div>

                                </div>

                                {/* Pet Info */}
                                <div className="flex-1">
                                    <div className="flex items-center justify-between mb-2">
                                        <h2 className="text-3xl font-black text-stone-800">{selectedPatient.name}</h2>
                                        <button onClick={() => setSelectedPatient(null)} className="p-2 hover:bg-stone-100 rounded-full ml-2">
                                            <XMarkIcon className="w-5 h-5" />
                                        </button>
                                    </div>

                                    {/* Owner & Contact */}
                                    <div className="flex items-center gap-4 text-sm text-stone-600 mb-3">
                                        <span>Chủ nuôi: {selectedPatient.ownerName}</span>
                                        {selectedPatient.ownerPhone && <span>SĐT: {selectedPatient.ownerPhone}</span>}
                                    </div>

                                    {/* Allergies Section - Read Only */}
                                    <div className="flex items-center gap-2 mb-4 flex-wrap">
                                        {selectedPatient.allergies ? (
                                            <span className="px-3 py-1 bg-red-100 text-red-700 text-xs font-bold rounded-full border border-red-300">
                                                Dị ứng: {selectedPatient.allergies}
                                            </span>
                                        ) : (
                                            <span className="px-3 py-1 bg-stone-100 text-stone-500 text-xs font-bold rounded-full border border-stone-200">
                                                Chưa có thông tin dị ứng
                                            </span>
                                        )}
                                    </div>

                                    {/* Stats Row */}
                                    <div className="grid grid-cols-5 gap-4 bg-stone-50 rounded-xl p-4">
                                        <div>
                                            <p className="text-xs text-stone-500 uppercase font-bold">Loài</p>
                                            <p className="font-bold text-stone-800">{selectedPatient.species}</p>
                                        </div>
                                        <div>
                                            <p className="text-xs text-stone-500 uppercase font-bold">Giống</p>
                                            <p className="font-bold text-stone-800">{selectedPatient.breed}</p>
                                        </div>
                                        <div>
                                            <p className="text-xs text-stone-500 uppercase font-bold">Màu lông</p>
                                            <p className="font-bold text-stone-800">{selectedPatient.color || 'Không rõ'}</p>
                                        </div>
                                        <div>
                                            <p className="text-xs text-stone-500 uppercase font-bold">Tuổi / Giới tính</p>
                                            <p className="font-bold text-stone-800">{selectedPatient.age} / {selectedPatient.sex || 'N/A'}</p>
                                        </div>
                                        <div>
                                            <p className="text-xs text-stone-500 uppercase font-bold">Cân nặng</p>
                                            <p className="font-bold text-stone-800">{selectedPatient.weight || '--'} kg</p>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>

                        {/* ===== TABS ===== */}
                        <div className="border-b border-stone-200">
                            <div className="flex px-6">
                                {[
                                    { key: 'emr', label: 'Lịch sử bệnh án' },
                                    { key: 'vaccinations', label: 'Tiêm phòng' },
                                    { key: 'documents', label: 'Tài liệu' },
                                ].map(tab => (
                                    <button
                                        key={tab.key}
                                        onClick={() => setActiveTab(tab.key as DetailTab)}
                                        className={`px-4 py-3 font-semibold text-sm transition-colors border-b-2 ${activeTab === tab.key
                                            ? 'text-blue-600 border-blue-600'
                                            : 'text-stone-500 border-transparent hover:text-stone-700'
                                            }`}
                                    >
                                        {tab.label}
                                    </button>
                                ))}
                            </div>
                        </div>

                        {/* ===== TAB CONTENT ===== */}
                        <div className="p-6 overflow-y-auto max-h-[calc(95vh-320px)]">

                            {/* EMR / SOAP Tab */}
                            {activeTab === 'emr' && (
                                <div>
                                    {/* Header with buttons */}
                                    <div className="flex items-center justify-between mb-6">
                                        <div>
                                            <h3 className="text-xl font-bold text-stone-800">
                                                Lịch sử bệnh án
                                            </h3>
                                            {/* Show Active Booking Indicator */}
                                            {(() => {
                                                const activeBooking = bookings.find(b =>
                                                    b.petId === selectedPatient.id &&
                                                    (b.status === 'IN_PROGRESS' || b.status === 'ASSIGNED')
                                                )
                                                if (activeBooking) {
                                                    return (
                                                        <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-bold bg-blue-100 text-blue-800 mt-1">
                                                            <span className="w-1.5 h-1.5 rounded-full bg-blue-600 animate-pulse"></span>
                                                            Booking #{activeBooking.bookingCode}
                                                        </span>
                                                    )
                                                }
                                                return null
                                            })()}
                                        </div>
                                        <div className="flex gap-3">
                                            <button
                                                onClick={() => {
                                                    const activeBooking = bookings.find(b =>
                                                        b.petId === selectedPatient.id &&
                                                        (b.status === 'IN_PROGRESS' || b.status === 'ASSIGNED')
                                                    )

                                                    // Check if EMR already exists for this booking
                                                    const existingEmr = activeBooking
                                                        ? emrRecords.find(e => e.bookingId === activeBooking.bookingId)
                                                        : null

                                                    if (existingEmr) {
                                                        // If exists, go to Detail or Edit depending on lock status
                                                        if (!existingEmr.isLocked && String(user?.userId) === String(existingEmr.staffId)) {
                                                            navigate(`/staff/emr/edit/${existingEmr.id}`)
                                                        } else {
                                                            navigate(`/staff/emr/detail/${existingEmr.id}`)
                                                        }
                                                        return
                                                    }

                                                    let url = `/staff/emr/create/${selectedPatient.id}`
                                                    if (activeBooking) {
                                                        url += `?bookingId=${activeBooking.bookingId}&bookingCode=${activeBooking.bookingCode}`
                                                    }
                                                    navigate(url)
                                                }}
                                                className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white font-bold rounded-lg hover:bg-blue-700"
                                            >
                                                <PlusIcon className="w-4 h-4" />
                                                Thêm Bệnh án
                                            </button>
                                        </div>
                                    </div>

                                    {/* EMR List */}
                                    {isLoadingEmr ? (
                                        <p className="text-stone-500 text-center py-12">Đang tải...</p>
                                    ) : emrRecords.length === 0 ? (
                                        <div className="text-center py-12 bg-stone-50 rounded-xl">
                                            <p className="text-stone-500 mb-4">Chưa có bệnh án nào</p>
                                            <button
                                                onClick={() => navigate(`/staff/emr/create/${selectedPatient.id}`)}
                                                className="px-4 py-2 bg-blue-600 text-white font-bold rounded-lg"
                                            >
                                                Tạo Bệnh án Đầu tiên
                                            </button>
                                        </div>
                                    ) : (
                                        <div className="space-y-6">
                                            {emrRecords.map(emr => (
                                                <div key={emr.id} className="border border-stone-200 rounded-xl overflow-hidden">
                                                    {/* EMR Header */}
                                                    <div className="bg-stone-50 px-5 py-4 border-b border-stone-200">
                                                        <div className="flex items-start justify-between">
                                                            <div>
                                                                <button
                                                                    onClick={() => navigate(`/staff/emr/detail/${emr.id}`)}
                                                                    className="font-bold text-stone-800 text-lg hover:text-blue-600 hover:underline text-left transition-colors line-clamp-1 w-full block"
                                                                    title={emr.assessment}
                                                                >
                                                                    {emr.assessment || 'Chưa có chẩn đoán'}
                                                                </button>
                                                                <p className="text-sm text-stone-500">
                                                                    {new Date(emr.examinationDate).toLocaleDateString('vi-VN')}
                                                                    <span className="mx-2">•</span>
                                                                    BS. {emr.staffName}
                                                                    {emr.bookingCode && (
                                                                        <span className="ml-2 font-mono text-xs bg-stone-100 px-1.5 py-0.5 rounded border border-stone-200">
                                                                            #{emr.bookingCode}
                                                                        </span>
                                                                    )}
                                                                </p>
                                                            </div>
                                                            <div className="flex items-center gap-2">
                                                                {/* Edit Button - Only if not locked and owned by current staff */}
                                                                {(() => {
                                                                    const isWithin24h = (new Date().getTime() - new Date(emr.createdAt).getTime()) < 24 * 60 * 60 * 1000;
                                                                    const isOwner = String(tokenStorage.getUser()?.userId) === String(emr.staffId);
                                                                    const canEdit = !emr.isLocked && isOwner && isWithin24h;

                                                                    return canEdit ? (
                                                                        <button
                                                                            onClick={() => navigate(`/staff/emr/edit/${emr.id}`)}
                                                                            className="px-3 py-1.5 bg-white border border-stone-200 text-stone-600 hover:text-amber-600 hover:border-amber-200 hover:bg-amber-50 rounded-lg transition-all flex items-center gap-1.5 shadow-sm"
                                                                            title="Chỉnh sửa bệnh án (Trong vòng 24h)"
                                                                        >
                                                                            <PencilSquareIcon className="w-4 h-4" />
                                                                            <span className="text-xs font-bold">Sửa</span>
                                                                        </button>
                                                                    ) : (
                                                                        <div className="flex items-center gap-1.5 px-3 py-1.5 bg-stone-50 text-stone-400 rounded-lg border border-stone-100 select-none">
                                                                            <LockClosedIcon className="w-3.5 h-3.5" />
                                                                            <span className="text-xs font-medium">Chỉ xem</span>
                                                                        </div>
                                                                    );
                                                                })()}
                                                                {emr.clinicId && (
                                                                    <span className="px-3 py-1.5 bg-amber-100 text-amber-800 text-xs font-bold rounded-lg">
                                                                        Nguồn: {emr.clinicName}
                                                                    </span>
                                                                )}
                                                            </div>
                                                        </div>
                                                    </div>

                                                    {/* SOAP Content */}
                                                    <div className="p-5 grid grid-cols-2 gap-6">
                                                        {/* Subjective */}
                                                        {emr.subjective && (
                                                            <div>
                                                                <h5 className="text-sm font-bold text-amber-600 uppercase mb-2">
                                                                    S - Chủ quan
                                                                </h5>
                                                                <p className="text-stone-700 text-sm">{emr.subjective}</p>
                                                            </div>
                                                        )}

                                                        {/* Assessment */}
                                                        <div>
                                                            <h5 className="text-sm font-bold text-amber-600 uppercase mb-2">
                                                                A - Chẩn đoán
                                                            </h5>
                                                            <p className="text-stone-700 text-sm">{emr.assessment}</p>
                                                        </div>

                                                        {/* Objective */}
                                                        {emr.objective && (
                                                            <div>
                                                                <h5 className="text-sm font-bold text-amber-600 uppercase mb-2">
                                                                    O - Khách quan
                                                                </h5>
                                                                <p className="text-stone-700 text-sm whitespace-pre-line">{emr.objective}</p>
                                                            </div>
                                                        )}

                                                        {/* Plan */}
                                                        <div>
                                                            <h5 className="text-sm font-bold text-amber-600 uppercase mb-2">
                                                                P - Kế hoạch
                                                            </h5>
                                                            <p className="text-stone-700 text-sm whitespace-pre-line">{emr.plan}</p>
                                                        </div>
                                                    </div>
                                                </div>
                                            ))}
                                        </div>
                                    )}
                                </div>
                            )}

                            {activeTab === 'vaccinations' && (
                                <div className="space-y-8">
                                    {/* SECTION 1: RECORD NEW VACCINATION (INLINE FORM) */}
                                    <div className="bg-stone-50 border border-stone-200 rounded-2xl p-6">
                                        <div className="flex items-center gap-2 mb-6">
                                            <div className="w-8 h-8 rounded-full bg-orange-100 flex items-center justify-center text-orange-600">
                                                <PlusIcon className="w-5 h-5" />
                                            </div>
                                            <h3 className="text-lg font-bold text-stone-800">Ghi Nhận Mũi Tiêm Mới</h3>
                                        </div>

                                        <form onSubmit={handleAddVaccination} className="space-y-6">
                                            {/* Show Active Booking if found */}
                                            {(() => {
                                                const activeBooking = bookings.find(b =>
                                                    b.petId === selectedPatient.id &&
                                                    (b.status === 'IN_PROGRESS' || b.status === 'ASSIGNED')
                                                )

                                                if (activeBooking) {
                                                    return (
                                                        <div className="bg-orange-50 border border-orange-200 rounded-lg p-3 flex items-center justify-between">
                                                            <div className="flex items-center gap-2">
                                                                <span className="w-2 h-2 rounded-full bg-orange-500 animate-pulse"></span>
                                                                <span className="text-sm font-bold text-orange-800">
                                                                    Đang có lịch hẹn: #{activeBooking.bookingCode}
                                                                </span>
                                                            </div>
                                                            <div className="text-xs text-orange-600 font-medium">
                                                                Sẽ được liên kết vào hồ sơ này
                                                            </div>
                                                        </div>
                                                    )
                                                }
                                                return null
                                            })()}

                                            {/* Dose Sequence Selector */}
                                            <div className="space-y-2 mt-4">
                                                <label className="block text-[10px] font-black text-stone-400 uppercase tracking-widest">Loại mũi tiêm</label>
                                                <div className="flex bg-stone-100 p-1 rounded-xl border border-stone-200 w-fit">
                                                    {['1', '2', '3', 'BOOSTER'].map((seq) => (
                                                        <button
                                                            key={seq}
                                                            type="button"
                                                            onClick={() => setDoseSequence(seq)}
                                                            className={`px-4 py-1.5 rounded-lg text-[10px] font-black transition-all ${doseSequence === seq
                                                                ? 'bg-white text-orange-600 shadow-sm border border-stone-200'
                                                                : 'text-stone-400 hover:text-stone-600'
                                                                }`}
                                                        >
                                                            {seq === 'BOOSTER' ? 'TIÊM NHẮC' : `MŨI ${seq}`}
                                                        </button>
                                                    ))}
                                                </div>
                                            </div>

                                            <div className="grid grid-cols-4 gap-4">
                                                {/* Vaccine Type */}
                                                {/* Vaccine Template Selection */}
                                                <div className="space-y-1.5 col-span-1">
                                                    <label className="block text-xs font-bold text-stone-600 uppercase">Loại Vaccine</label>
                                                    <select
                                                        value={selectedTemplateId}
                                                        onChange={(e) => {
                                                            const tmplId = e.target.value
                                                            setSelectedTemplateId(tmplId)

                                                            const tmpl = vaccineTemplates.find(t => t.id === tmplId)
                                                            if (tmpl) {
                                                                setVaccineName(tmpl.name)

                                                                // Smart Dose Prediction (Locally)
                                                                const normalize = (s: string) => s.toLowerCase().replace(/[^a-z0-9]/g, '');
                                                                const normalizedInput = normalize(tmpl.name);
                                                                const existingCount = vaccinationRecords.filter(r =>
                                                                    r.workflowStatus === 'COMPLETED' && normalize(r.vaccineName) === normalizedInput
                                                                ).length;

                                                                if (existingCount >= (tmpl.seriesDoses || 1)) {
                                                                    setDoseSequence('BOOSTER');
                                                                } else {
                                                                    setDoseSequence(String(existingCount + 1));
                                                                }

                                                                // Auto-calculate next due date if vaccination date is set
                                                                const vDate = vaccinationDate || new Date();
                                                                if (!vaccinationDate) setVaccinationDate(vDate);

                                                                if (tmpl.repeatIntervalDays) {
                                                                    const nextDate = new Date(vDate)
                                                                    nextDate.setDate(nextDate.getDate() + tmpl.repeatIntervalDays)
                                                                    setNextDueDate(nextDate)
                                                                }
                                                            } else {
                                                                setVaccineName('')
                                                                setDoseSequence('1')
                                                            }
                                                        }}
                                                        className="w-full px-4 py-2.5 bg-white border border-stone-300 rounded-lg text-sm focus:outline-none focus:border-orange-500 font-medium cursor-pointer"
                                                    >
                                                        <option value="">-- Chọn Vaccine Mẫu --</option>
                                                        {vaccineTemplates.map(t => (
                                                            <option key={t.id} value={t.id}>
                                                                {t.name} ({t.manufacturer})
                                                            </option>
                                                        ))}
                                                        <option value="manual">Nhập thủ công...</option>
                                                    </select>
                                                </div>

                                                {/* Manual Name Input (if needed or manual selected) */}
                                                {(selectedTemplateId === 'manual' || !selectedTemplateId) && (
                                                    <div className="space-y-1.5 col-span-1">
                                                        <label className="block text-xs font-bold text-stone-600 uppercase">Tên Vaccine (Thủ công)</label>
                                                        <input
                                                            type="text"
                                                            value={vaccineName}
                                                            onChange={(e) => setVaccineName(e.target.value)}
                                                            placeholder="Nhập tên..."
                                                            className="w-full px-4 py-2.5 bg-white border border-stone-300 rounded-lg text-sm focus:outline-none focus:border-blue-500 font-medium"
                                                        />
                                                    </div>
                                                )}

                                                {/* Date Administered */}
                                                <div className="space-y-1.5 col-span-1">
                                                    <label className="block text-xs font-bold text-stone-600 uppercase">Ngày Tiêm</label>
                                                    <div className="relative">
                                                        <DatePicker
                                                            selected={vaccinationDate}
                                                            onChange={(date: Date | null) => setVaccinationDate(date)}
                                                            dateFormat="dd/MM/yyyy"
                                                            locale="vi"
                                                            placeholderText="dd/mm/yyyy"
                                                            className="w-full pl-10 pr-4 py-2.5 bg-white border border-stone-300 rounded-lg text-sm focus:outline-none focus:border-blue-500 font-medium"
                                                        />
                                                        <CalendarIcon className="w-5 h-5 text-stone-400 absolute left-3 top-1/2 -translate-y-1/2" />
                                                    </div>
                                                </div>

                                                {/* Next Due Date */}
                                                <div className="space-y-1.5 col-span-1">
                                                    <label className="block text-xs font-bold text-stone-600 uppercase">Ngày Tái Chủng</label>
                                                    <div className="relative">
                                                        <DatePicker
                                                            selected={nextDueDate}
                                                            onChange={(date: Date | null) => setNextDueDate(date)}
                                                            dateFormat="dd/MM/yyyy"
                                                            locale="vi"
                                                            placeholderText="dd/mm/yyyy"
                                                            className="w-full pl-10 pr-4 py-2.5 bg-white border border-stone-300 rounded-lg text-sm focus:outline-none focus:border-blue-500 font-medium"
                                                            minDate={vaccinationDate || undefined}
                                                        />
                                                        <CalendarIcon className="w-5 h-5 text-stone-400 absolute left-3 top-1/2 -translate-y-1/2" />
                                                    </div>
                                                </div>

                                                {/* Batch No - HIDDEN per requirement */}
                                                {/*
                                                <div className="space-y-1.5 col-span-1">
                                                    <label className="block text-xs font-bold text-stone-600 uppercase">Số Lô (Batch)</label>
                                                    <input
                                                        type="text"
                                                        value={batchNumber}
                                                        onChange={(e) => setBatchNumber(e.target.value)}
                                                        placeholder="VD: RB-992"
                                                        className="w-full px-4 py-2.5 bg-white border border-stone-300 rounded-lg text-sm focus:outline-none focus:border-blue-500 font-medium font-mono"
                                                    />
                                                </div>
                                                */}
                                            </div>

                                            {/* Notes & Button */}
                                            <div className="flex gap-4 items-end">
                                                <div className="space-y-1.5 flex-1">
                                                    <label className="block text-xs font-bold text-stone-600 uppercase">Ghi Chú / Phản Ứng</label>
                                                    <input
                                                        type="text"
                                                        value={vaccinationNotes}
                                                        onChange={(e) => setVaccinationNotes(e.target.value)}
                                                        placeholder="Ghi chú thêm về phản ứng sau tiêm..."
                                                        className="w-full px-4 py-2.5 bg-white border border-stone-300 rounded-lg text-sm focus:outline-none focus:border-blue-500"
                                                    />
                                                </div>
                                                <button
                                                    type="submit"
                                                    disabled={isSubmittingVaccination}
                                                    className="px-6 py-2.5 bg-orange-600 text-white font-bold rounded-lg hover:bg-orange-700 disabled:opacity-50 shadow-lg shadow-orange-100 flex items-center gap-2 whitespace-nowrap h-[42px]"
                                                >
                                                    {isSubmittingVaccination ? 'Đang lưu...' : 'Lưu Hồ Sơ'}
                                                </button>
                                            </div>
                                        </form>
                                    </div>

                                    {/* SECTION 2: HISTORY TABLE */}
                                    <div>
                                        <div className="flex items-center justify-between mb-4">
                                            <div className="flex items-center gap-2">
                                                <span className="text-2xl">↺</span>
                                                <h3 className="text-xl font-bold text-stone-800">Lịch Sử Tiêm Chủng</h3>
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
                                                    LỘ TRÌNH
                                                </button>
                                            </div>
                                        </div>

                                        {isLoadingVaccinations ? (
                                            <div className="p-12 text-center text-stone-500 bg-stone-50 rounded-xl border border-stone-200">Đang tải dữ liệu...</div>
                                        ) : viewMode === 'roadmap' ? (
                                            <VaccinationRoadmap records={vaccinationRecords} upcomingRecords={upcomingRecords} />
                                        ) : vaccinationRecords.length === 0 ? (
                                            <div className="p-12 text-center text-stone-500 bg-stone-50 rounded-xl border border-stone-200">
                                                Chưa có lịch sử tiêm chủng. Hãy thêm mũi tiêm đầu tiên bên trên.
                                            </div>
                                        ) : (
                                            <div className="border border-stone-200 rounded-xl overflow-hidden shadow-sm bg-white">
                                                {/* Existing Table Code */}
                                                <table className="w-full text-left">
                                                    <thead className="bg-stone-50 border-b border-stone-200">
                                                        <tr>
                                                            <th className="p-4 text-xs font-black text-stone-400 uppercase tracking-wider">TÊN VACCINE</th>
                                                            <th className="p-4 text-xs font-black text-stone-400 uppercase tracking-wider">NGÀY TIÊM</th>
                                                            <th className="p-4 text-xs font-black text-stone-400 uppercase tracking-wider">TÁI CHỦNG</th>

                                                            <th className="p-4 text-xs font-black text-stone-400 uppercase tracking-wider">BÁC SĨ</th>
                                                            <th className="p-4 text-xs font-black text-stone-400 uppercase tracking-wider">TRẠNG THÁI</th>
                                                            <th className="p-4 text-xs font-black text-stone-400 uppercase tracking-wider text-right">THAO TÁC</th>
                                                        </tr>
                                                    </thead>
                                                    <tbody className="divide-y divide-stone-100">
                                                        {vaccinationRecords.map((record) => (
                                                            <tr
                                                                key={record.id}
                                                                className="hover:bg-blue-50 cursor-pointer transition-colors group"
                                                                onClick={() => setSelectedVaccination(record)}
                                                            >
                                                                <td className="p-4">
                                                                    <div className="flex items-center gap-3">

                                                                        <div>
                                                                            <div className="flex items-center gap-2">
                                                                                <div className="font-bold text-stone-900">{record.vaccineName}</div>
                                                                                {record.doseNumber && (
                                                                                    <span className="px-1.5 py-0.5 bg-orange-100 text-orange-700 text-[9px] font-black uppercase tracking-wider rounded border border-orange-200">
                                                                                        Mũi {record.doseNumber}
                                                                                        {(() => {
                                                                                            const tpl = vaccineTemplates.find(t => t.id === record.vaccineTemplateId);
                                                                                            return tpl && tpl.seriesDoses > 1 ? ` / ${tpl.seriesDoses}` : '';
                                                                                        })()}
                                                                                    </span>
                                                                                )}
                                                                            </div>
                                                                            {/* Subtitle if needed, e.g. "Core Vaccine" - currently mocked */}
                                                                            <div className="text-xs text-stone-400">Vaccine</div>
                                                                        </div>
                                                                    </div>
                                                                </td>
                                                                <td className="p-4">
                                                                    <span className="font-bold text-stone-700">
                                                                        {vaccinationService.formatDate(record.vaccinationDate)}
                                                                    </span>
                                                                </td>
                                                                <td className="p-4">
                                                                    <div className="flex flex-col">
                                                                        <span className="font-bold text-stone-700">
                                                                            {vaccinationService.formatDate(record.nextDueDate)}
                                                                        </span>
                                                                    </div>
                                                                </td>

                                                                <td className="p-4">
                                                                    <div className="flex items-center gap-2">
                                                                        <div className="w-6 h-6 rounded-full bg-stone-200 flex items-center justify-center text-[10px] font-bold text-stone-600">
                                                                            {record.staffName ? record.staffName.charAt(0) : '?'}
                                                                        </div>
                                                                        <div className="text-sm font-medium text-stone-700">
                                                                            {record.staffName ? `Dr. ${record.staffName.split(' ').pop()}` : 'Chưa phân công'}
                                                                        </div>
                                                                    </div>
                                                                </td>
                                                                <td className="p-4">
                                                                    {record.workflowStatus === 'PENDING' ? (
                                                                        <span className="px-3 py-1 rounded-full text-xs font-bold border bg-stone-50 text-stone-500 border-stone-200">
                                                                            Chờ tiêm
                                                                        </span>
                                                                    ) : (
                                                                        new Date(record.vaccinationDate || '').getFullYear() > 1970 ? (
                                                                            <span className={`px-3 py-1 rounded-full text-xs font-bold border ${getStatusColor(vaccinationService.calculateStatus(record.nextDueDate))}`}>
                                                                                {vaccinationService.calculateStatus(record.nextDueDate) === 'Valid' ? 'Hiệu lực' :
                                                                                    vaccinationService.calculateStatus(record.nextDueDate) === 'Overdue' ? 'Quá hạn' :
                                                                                        vaccinationService.calculateStatus(record.nextDueDate) === 'Expiring Soon' ? 'Sắp hết hạn' : 'N/A'}
                                                                            </span>
                                                                        ) : (
                                                                            <span className="px-3 py-1 rounded-full text-xs font-bold border bg-stone-100 text-stone-400">PENDING</span>
                                                                        )
                                                                    )}
                                                                </td>
                                                                <td className="p-4 text-right">
                                                                    <button
                                                                        onClick={(e) => handleDeleteVaccination(record.id, e)}
                                                                        className="p-2 hover:bg-red-50 text-stone-300 hover:text-red-600 rounded-full transition-colors"
                                                                    >
                                                                        <TrashIcon className="w-5 h-5" />
                                                                    </button>
                                                                </td>
                                                            </tr>
                                                        ))}
                                                    </tbody>
                                                </table>
                                            </div>
                                        )}
                                    </div>
                                </div>
                            )}

                            {activeTab === 'documents' && (
                                <div className="text-center py-12 text-stone-500">
                                    Đang phát triển...
                                </div>
                            )}
                        </div>
                    </div>
                </div >
            )
            }

            {/* ============= ADD VACCINATION MODAL (Level 2) ============= */}
            {
                isAddVaccinationModalOpen && (
                    <div className="fixed inset-0 bg-black/50 z-[60] flex items-center justify-center p-4">
                        <div className="bg-white w-full max-w-lg rounded-2xl shadow-2xl overflow-hidden animate-in fade-in zoom-in duration-200">
                            <div className="p-6 border-b border-stone-200 flex justify-between items-center bg-stone-50">
                                <h2 className="text-xl font-bold text-stone-800 flex items-center gap-2">
                                    <PlusIcon className="w-6 h-6 text-blue-600" />
                                    Thêm Mũi Tiêm
                                </h2>
                                <button onClick={() => setIsAddVaccinationModalOpen(false)} className="p-2 hover:bg-stone-200 rounded-full">
                                    <XMarkIcon className="w-6 h-6 text-stone-500" />
                                </button>
                            </div>

                            <form onSubmit={handleAddVaccination} className="p-6 space-y-4">
                                {/* Active Booking Banner */}
                                {(() => {
                                    const activeBooking = bookings.find(b =>
                                        b.petId === selectedPatient?.id &&
                                        (b.status === 'IN_PROGRESS' || b.status === 'ASSIGNED')
                                    )
                                    if (activeBooking) {
                                        return (
                                            <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 flex items-center justify-between mb-2">
                                                <div className="flex items-center gap-2">
                                                    <span className="w-2 h-2 rounded-full bg-blue-500 animate-pulse"></span>
                                                    <span className="text-sm font-bold text-blue-800">
                                                        Liên kết với Booking #{activeBooking.bookingCode}
                                                    </span>
                                                </div>
                                            </div>
                                        )
                                    }
                                })()}
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
                                        autoFocus
                                    />
                                    <datalist id="vaccine-types">
                                        {VACCINE_TYPES.map(type => (
                                            <option key={type} value={type} />
                                        ))}
                                    </datalist>
                                </div>

                                <div className="grid grid-cols-2 gap-4">
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
                                        <label className="block text-sm font-bold text-stone-700">Tái Chủng</label>
                                        <div className="relative">
                                            <DatePicker
                                                selected={nextDueDate}
                                                onChange={(date: Date | null) => setNextDueDate(date)}
                                                dateFormat="dd/MM/yyyy"
                                                locale="vi"
                                                placeholderText="dd/mm/yyyy"
                                                className="input-brutal w-full pl-10"
                                                minDate={vaccinationDate ?? undefined}
                                            />
                                            <CalendarIcon className="w-5 h-5 text-stone-500 absolute left-3 top-1/2 -translate-y-1/2" />
                                        </div>
                                    </div>
                                </div>



                                {/* Notes */}
                                <div className="space-y-1">
                                    <label className="block text-sm font-bold text-stone-700">Ghi Chú</label>
                                    <textarea
                                        value={vaccinationNotes}
                                        onChange={(e) => setVaccinationNotes(e.target.value)}
                                        placeholder="Phản ứng sau tiêm..."
                                        className="input-brutal w-full min-h-[60px]"
                                    />
                                </div>

                                <div className="flex justify-end pt-4 border-t border-stone-100">
                                    <button
                                        type="button"
                                        onClick={() => setIsAddVaccinationModalOpen(false)}
                                        className="mr-3 px-4 py-2 text-stone-600 font-bold hover:bg-stone-100 rounded-lg"
                                    >
                                        Hủy
                                    </button>
                                    <button
                                        type="submit"
                                        disabled={isSubmittingVaccination}
                                        className="btn-brutal bg-blue-600 text-white hover:bg-blue-700 disabled:bg-stone-400"
                                    >
                                        {isSubmittingVaccination ? 'Đang lưu...' : 'Lưu Hồ Sơ'}
                                    </button>
                                </div>
                            </form>
                        </div>
                    </div>
                )
            }

            {/* ============= VACCINATION DETAIL MODAL (Level 2) ============= */}
            {
                selectedVaccination && (
                    <div className="fixed inset-0 bg-black/50 z-[60] flex items-center justify-center p-4" onClick={() => setSelectedVaccination(null)}>
                        <div className="bg-white w-full max-w-md rounded-2xl shadow-2xl overflow-hidden animate-in fade-in zoom-in duration-200" onClick={e => e.stopPropagation()}>
                            <div className="p-6 border-b border-stone-200 flex justify-between items-center bg-stone-50">
                                <h2 className="text-xl font-bold text-stone-800">Chi Tiết Mũi Tiêm</h2>
                                <button onClick={() => setSelectedVaccination(null)} className="p-2 hover:bg-stone-200 rounded-full">
                                    <XMarkIcon className="w-6 h-6 text-stone-500" />
                                </button>
                            </div>
                            <div className="p-6 space-y-6">
                                <div className="flex items-center gap-4">
                                    <div className="w-16 h-16 bg-blue-100 rounded-xl flex items-center justify-center text-3xl">
                                        💉
                                    </div>
                                    <div>
                                        <h3 className="text-xl font-black text-stone-900">{selectedVaccination.vaccineName}</h3>
                                        <span className={`inline-block mt-1 px-3 py-1 rounded-full text-xs font-bold border ${getStatusColor(selectedVaccination.status)}`}>
                                            {selectedVaccination.status === 'Valid' ? 'Đang Hiệu lực' : selectedVaccination.status === 'Overdue' ? 'Đã Quá hạn' : 'Sắp hết hạn'}
                                        </span>
                                    </div>
                                </div>

                                <div className="grid grid-cols-2 gap-4 bg-stone-50 p-4 rounded-xl border border-stone-200">
                                    <div>
                                        <p className="text-xs text-stone-500 font-bold uppercase">Ngày tiêm</p>
                                        <p className="font-bold text-stone-800 text-lg">
                                            {selectedVaccination.vaccinationDate ? new Date(selectedVaccination.vaccinationDate).toLocaleDateString('vi-VN') : 'Chưa tiêm'}
                                        </p>
                                    </div>
                                    <div>
                                        <p className="text-xs text-stone-500 font-bold uppercase">Tái chủng</p>
                                        <p className={`font-bold text-lg ${selectedVaccination.nextDueDate ? 'text-blue-600' : 'text-stone-400'}`}>
                                            {selectedVaccination.nextDueDate ? new Date(selectedVaccination.nextDueDate).toLocaleDateString('vi-VN') : 'Không có'}
                                        </p>
                                    </div>

                                    <div className="col-span-2">
                                        <p className="text-xs text-stone-500 font-bold uppercase">Bác sĩ thực hiện</p>
                                        <p className="font-bold text-stone-800">
                                            {selectedVaccination.staffName}
                                        </p>
                                    </div>
                                </div>

                                {selectedVaccination.notes && (
                                    <div>
                                        <p className="text-xs text-stone-500 font-bold uppercase mb-2">Ghi chú</p>
                                        <div className="bg-stone-50 p-3 rounded-lg border border-stone-200 text-stone-700 italic text-sm">
                                            {selectedVaccination.notes}
                                        </div>
                                    </div>
                                )}
                            </div>
                            <div className="p-4 bg-stone-50 border-t border-stone-200 flex justify-end">
                                <button
                                    onClick={(e) => handleDeleteVaccination(selectedVaccination.id, e)}
                                    className="px-4 py-2 bg-white border border-red-200 text-red-600 font-bold rounded-lg hover:bg-red-50 flex items-center gap-2"
                                >
                                    <TrashIcon className="w-4 h-4" />
                                    Xóa Hồ Sơ
                                </button>
                            </div>
                        </div>
                    </div>
                )
            }
        </div >
    )
}

export default StaffPatientsPage
