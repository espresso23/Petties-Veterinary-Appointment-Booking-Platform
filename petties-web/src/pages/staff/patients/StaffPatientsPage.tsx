import { useState, useEffect } from 'react'
import { useToast } from '../../../components/Toast'
import { useNavigate } from 'react-router-dom'
import {
    MagnifyingGlassIcon,
    PlusIcon,
    XMarkIcon,
    PencilSquareIcon,
    TrashIcon,
    LockClosedIcon,
} from '@heroicons/react/24/outline'
import { emrService } from '../../../services/emrService'
import { getStaffPatients, type StaffPatient } from '../../../services/api/petService'
import { tokenStorage } from '../../../services/authService'
import type { EmrRecord } from '../../../services/emrService'
import { vaccinationService, type VaccinationRecord } from '../../../services/vaccinationService'
import { vaccineTemplateService, type VaccineTemplate } from '../../../services/api/vaccineTemplateService'
import { getBookingsByStaff } from '../../../services/bookingService'
import type { Booking } from '../../../types/booking'
import { useAuthStore } from '../../../store/authStore'
import { VaccinationRoadmap } from '../vaccine/components/VaccinationRoadmap'
import { Squares2X2Icon, ListBulletIcon, PencilIcon, ClockIcon } from '@heroicons/react/24/outline'
import { SmartVaccinationForm, type VaccinationFormData } from '../../../components/vaccination/SmartVaccinationForm'
import { ConfirmModal } from '../../../components/ConfirmModal'
import type { Pet } from '../../../services/api/petService'
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

    // Modal states
    const [selectedPatient, setSelectedPatient] = useState<Patient | null>(null)
    const [activeTab, setActiveTab] = useState<DetailTab>('emr')
    const [emrRecords, setEmrRecords] = useState<EmrRecord[]>([])
    const [isLoadingEmr, setIsLoadingEmr] = useState(false)

    // Vaccination Tab State
    const [vaccinationRecords, setVaccinationRecords] = useState<VaccinationRecord[]>([])
    const [upcomingRecords, setUpcomingRecords] = useState<VaccinationRecord[]>([]) // Add state
    const [isLoadingVaccinations, setIsLoadingVaccinations] = useState(false)
    const [selectedVaccination, setSelectedVaccination] = useState<VaccinationRecord | null>(null)
    const [viewMode, setViewMode] = useState<'list' | 'roadmap'>('list')
    const [formKey, setFormKey] = useState(0) // To reset SmartForm

    const [isSubmittingVaccination, setIsSubmittingVaccination] = useState(false)

    const [isEditingVaccination, setIsEditingVaccination] = useState(false)
    // Add initial data for form population
    const [formInitialData, setFormInitialData] = useState<Partial<VaccinationFormData> | undefined>(undefined)

    // Delete Confirmation State
    const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false)
    const [recordIdToDelete, setRecordIdToDelete] = useState<string | null>(null)

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

    const handleAddVaccination = async (data: VaccinationFormData) => {
        if (!selectedPatient) {
            showToast('error', 'Vui lòng chọn bệnh nhân')
            return
        }

        setIsSubmittingVaccination(true)
        try {
            if (isEditingVaccination && selectedVaccination) {
                // UPDATE
                await vaccinationService.updateVaccination(selectedVaccination.id, {
                    petId: selectedPatient.id,
                    vaccineName: data.vaccineName,
                    vaccineTemplateId: data.vaccineTemplateId,
                    vaccinationDate: data.vaccinationDate.toISOString().split('T')[0],
                    nextDueDate: data.nextDueDate ? data.nextDueDate.toISOString().split('T')[0] : undefined,
                    doseSequence: data.doseSequence,
                    notes: data.notes || '',
                    workflowStatus: 'COMPLETED'
                })
                showToast('success', 'Đã cập nhật hồ sơ tiêm chủng')
                setIsEditingVaccination(false)
                setSelectedVaccination(null)
            } else {
                // CREATE
                const activeBooking = bookings.find(b =>
                    b.petId === selectedPatient.id &&
                    (b.status === 'IN_PROGRESS' || b.status === 'ASSIGNED')
                )

                await vaccinationService.createVaccination({
                    petId: selectedPatient.id,
                    bookingId: activeBooking?.bookingId,
                    vaccineName: data.vaccineName,
                    vaccineTemplateId: data.vaccineTemplateId,
                    vaccinationDate: data.vaccinationDate.toISOString().split('T')[0],
                    nextDueDate: data.nextDueDate ? data.nextDueDate.toISOString().split('T')[0] : undefined,
                    doseSequence: data.doseSequence,
                    notes: data.notes || '',
                    workflowStatus: 'COMPLETED'
                })
                showToast('success', 'Đã thêm hồ sơ tiêm chủng')
            }

            setFormKey(prev => prev + 1) // Reset form
            setFormInitialData(undefined) // Clear initial data
            fetchVaccinations()
        } catch (error) {
            console.error(error)
            showToast('error', 'Lỗi khi lưu hồ sơ')
            const errorMessage = (error as any)?.response?.data?.message || (error as any)?.message || 'Lỗi khi lưu hồ sơ'
            showToast('error', errorMessage)
        } finally {
            setIsSubmittingVaccination(false)
        }
    }

    const handleDeleteVaccination = (id: string, e?: React.MouseEvent) => {
        e?.stopPropagation()
        setRecordIdToDelete(id)
        setIsDeleteModalOpen(true)
    }

    const confirmDelete = async () => {
        if (!recordIdToDelete) return
        try {
            await vaccinationService.deleteVaccination(recordIdToDelete)
            showToast('success', 'Đã xóa hồ sơ')
            if (selectedVaccination?.id === recordIdToDelete) setSelectedVaccination(null)
            fetchVaccinations()
        } catch (error) {
            console.error(error)
            showToast('error', 'Xóa thất bại')
        } finally {
            setIsDeleteModalOpen(false)
            setRecordIdToDelete(null)
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

                                        <div className="pt-2">
                                            <SmartVaccinationForm
                                                key={formKey}
                                                pet={selectedPatient as unknown as Pet}
                                                records={vaccinationRecords}
                                                templates={vaccineTemplates}
                                                bookingCode={(() => {
                                                    const activeBooking = bookings.find(b =>
                                                        b.petId === selectedPatient?.id &&
                                                        (b.status === 'IN_PROGRESS' || b.status === 'ASSIGNED')
                                                    )
                                                    return activeBooking?.bookingCode
                                                })()}
                                                isSubmitting={isSubmittingVaccination}
                                                onSubmit={handleAddVaccination}
                                                // Pass initial data and edit mode
                                                initialData={formInitialData}
                                                isEditing={isEditingVaccination && !!selectedVaccination && selectedVaccination.workflowStatus === 'COMPLETED'}
                                            // Note: We might be "editing" a PENDING record (which acts like create flow but with ID), 
                                            // or "editing" a COMPLETED record (true edit). 
                                            // SmartVaccinationForm handles isEditing mostly for button text and title. 
                                            // If we are confirming a pending record, we might want it to look like "Create" but with pre-filled ID logic. 
                                            // However, SmartVaccinationForm relies on parent to handle API call distinction.
                                            // Let's keep isEditing related to COMPLETED records for now to avoid confusion, 
                                            // OR we can pass it as true if we have selectedVaccination.
                                            />
                                        </div>
                                    </div>

                                    {/* SECTION 1.5: UPCOMING / PENDING SUGGESTIONS (New) */}
                                    {(() => {
                                        const pendingRecords = vaccinationRecords.filter(r => r.workflowStatus === 'PENDING');

                                        // Merge logic: If a vaccine has a PENDING record, use it. Otherwise use upcoming suggestions.
                                        const combinedFutures = [...upcomingRecords];

                                        pendingRecords.forEach(pending => {
                                            const idx = combinedFutures.findIndex(u => u.vaccineName === pending.vaccineName);
                                            if (idx !== -1) {
                                                // Replace suggestion with actual pending record
                                                combinedFutures[idx] = pending;
                                            } else {
                                                combinedFutures.push(pending);
                                            }
                                        });

                                        if (combinedFutures.length === 0) return null;

                                        return (
                                            <div className="bg-white rounded-2xl shadow-sm border border-orange-200 overflow-hidden mb-6">
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
                                                <div className="p-4 grid grid-cols-1 md:grid-cols-2 gap-4">
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
                                                                        {rec.notes && rec.notes !== 'Tự động tạo từ lịch hẹn' ? rec.notes : (isPending ? 'Mũi tiêm đã được đặt lịch' : 'Theo lộ trình dự kiến')}
                                                                    </div>
                                                                </div>
                                                                <button
                                                                    onClick={() => {
                                                                        if (isPending && (rec as any).id) {
                                                                            setSelectedVaccination(rec as VaccinationRecord);
                                                                            setIsEditingVaccination(true); // Treat as edit to update PENDING -> COMPLETED
                                                                        } else {
                                                                            setSelectedVaccination(null);
                                                                            setIsEditingVaccination(false);
                                                                        }

                                                                        const newVaccDate = rec.nextDueDate ? new Date(rec.nextDueDate) : new Date();
                                                                        let nextDueDateObj = undefined;

                                                                        if (rec.vaccineTemplateId) {
                                                                            const tpl = vaccineTemplates.find(t => t.id === rec.vaccineTemplateId);
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

                                                                        // Scroll to form (top of tab content)
                                                                        // Since we are in a modal, we might need to scroll the container
                                                                        const container = document.querySelector('.overflow-y-auto');
                                                                        if (container) container.scrollTo({ top: 0, behavior: 'smooth' });
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
                                            <VaccinationRoadmap
                                                records={vaccinationRecords.filter(r => r.workflowStatus === 'COMPLETED')}
                                                upcomingRecords={upcomingRecords}
                                            />
                                        ) : vaccinationRecords.filter(r => r.workflowStatus === 'COMPLETED').length === 0 ? (
                                            <div className="p-12 text-center text-stone-500 bg-stone-50 rounded-xl border border-stone-200">
                                                Chưa có lịch sử tiêm chủng. Hãy thêm mũi tiêm cấu tiên bên trên.
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
                                                        {vaccinationRecords.filter(r => r.workflowStatus === 'COMPLETED').map((record) => (
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



            {/* ============= VACCINATION DETAIL/EDIT MODAL (Level 2) ============= */}
            {selectedVaccination && (
                <div
                    className="fixed inset-0 bg-stone-900/40 backdrop-blur-xl z-[60] flex items-center justify-center p-4 animate-in fade-in duration-500"
                    onClick={() => {
                        setSelectedVaccination(null)
                        setIsEditingVaccination(false)
                    }}
                >
                    <div
                        className="bg-white/95 w-full max-w-lg rounded-[3rem] shadow-[0_32px_64px_-16px_rgba(0,0,0,0.2)] overflow-hidden flex flex-col animate-in zoom-in-95 slide-in-from-bottom-8 duration-500 border border-white/20"
                        onClick={e => e.stopPropagation()}
                    >
                        {/* Header */}
                        <div className="px-10 py-8 border-b border-stone-100 flex justify-between items-center bg-stone-50/50">
                            <div>
                                <h2 className="text-2xl font-black text-stone-900 tracking-tight">
                                    {isEditingVaccination ? 'Chỉnh Sửa Hồ Sơ' : 'Chi Tiết Mũi Tiêm'}
                                </h2>
                                <p className="text-[10px] text-stone-400 font-bold uppercase tracking-[0.2em] opacity-70">Thông tin quản lý tiêm chủng</p>
                            </div>
                            <button
                                onClick={() => {
                                    setSelectedVaccination(null)
                                    setIsEditingVaccination(false)
                                }}
                                className="p-2.5 hover:bg-stone-100 rounded-full transition-all text-stone-300 hover:text-stone-600 active:scale-90"
                            >
                                <XMarkIcon className="w-6 h-6" />
                            </button>
                        </div>

                        {/* Content Area */}
                        <div className="px-10 py-10 overflow-y-auto max-h-[70vh]">
                            {isEditingVaccination ? (
                                <SmartVaccinationForm
                                    pet={selectedPatient as unknown as Pet}
                                    records={vaccinationRecords}
                                    templates={vaccineTemplates}
                                    isSubmitting={isSubmittingVaccination}
                                    onSubmit={handleAddVaccination}
                                    initialData={{
                                        vaccineName: selectedVaccination.vaccineName,
                                        vaccineTemplateId: selectedVaccination.vaccineTemplateId || undefined,
                                        vaccinationDate: selectedVaccination.vaccinationDate ? new Date(selectedVaccination.vaccinationDate) : new Date(),
                                        nextDueDate: selectedVaccination.nextDueDate ? new Date(selectedVaccination.nextDueDate) : undefined,
                                        doseSequence: selectedVaccination.doseNumber === 4 ? 'ANNUAL' : String(selectedVaccination.doseNumber || 1),
                                        notes: selectedVaccination.notes || ''
                                    }}
                                    isEditing={true}
                                    onCancel={() => setIsEditingVaccination(false)}
                                />
                            ) : (
                                <div className="space-y-8">
                                    {/* Vaccine Hero Section */}
                                    <div className="flex items-center gap-6">
                                        <div className="w-20 h-20 bg-gradient-to-br from-blue-500 to-blue-600 rounded-[2rem] shadow-xl shadow-blue-100 flex items-center justify-center text-4xl">
                                            💉
                                        </div>
                                        <div className="space-y-1">
                                            <h3 className="text-2xl font-black text-stone-900 tracking-tight leading-tight">{selectedVaccination.vaccineName}</h3>
                                            <div className="flex items-center gap-2">
                                                <span className={`inline-flex items-center px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-wider border ${getStatusColor(selectedVaccination.status)}`}>
                                                    <span className={`w-1.5 h-1.5 rounded-full mr-1.5 ${selectedVaccination.status === 'Valid' ? 'bg-green-600' : 'bg-red-600'}`} />
                                                    {selectedVaccination.status === 'Valid' ? 'Đang Hiệu lực' : selectedVaccination.status === 'Overdue' ? 'Đã Quá hạn' : 'Sắp hết hạn'}
                                                </span>
                                                {selectedVaccination.doseNumber && (
                                                    <span className="px-2 py-0.5 bg-orange-50 text-orange-600 text-[10px] font-black rounded-lg border border-orange-100 uppercase tracking-widest">
                                                        Mũi {selectedVaccination.doseNumber === 4 ? 'HÀNG NĂM' : selectedVaccination.doseNumber}
                                                    </span>
                                                )}
                                            </div>
                                        </div>
                                    </div>

                                    {/* Info Grid */}
                                    <div className="grid grid-cols-2 gap-4">
                                        <div className="bg-stone-50 p-6 rounded-[2rem] border border-stone-100 space-y-1">
                                            <p className="text-[10px] text-stone-400 font-bold uppercase tracking-widest">Ngày tiêm</p>
                                            <p className="font-black text-stone-800 text-lg">
                                                {selectedVaccination.vaccinationDate ? new Date(selectedVaccination.vaccinationDate).toLocaleDateString('vi-VN') : '—'}
                                            </p>
                                        </div>
                                        <div className="bg-stone-50 p-6 rounded-[2rem] border border-stone-100 space-y-1">
                                            <p className="text-[10px] text-stone-400 font-bold uppercase tracking-widest">Tái chủng</p>
                                            <p className={`font-black text-lg ${selectedVaccination.nextDueDate ? 'text-blue-600' : 'text-stone-300'}`}>
                                                {selectedVaccination.nextDueDate ? new Date(selectedVaccination.nextDueDate).toLocaleDateString('vi-VN') : 'KHÔNG CÓ'}
                                            </p>
                                        </div>
                                        <div className="col-span-2 bg-stone-50 p-6 rounded-[2rem] border border-stone-100 space-y-1">
                                            <p className="text-[10px] text-stone-400 font-bold uppercase tracking-widest">Bác sĩ thực hiện</p>
                                            <div className="flex items-center gap-2">
                                                <div className="w-6 h-6 rounded-full bg-orange-100 flex items-center justify-center text-[10px] font-black text-orange-600">
                                                    {selectedVaccination.staffName ? selectedVaccination.staffName.charAt(0) : '?'}
                                                </div>
                                                <p className="font-black text-stone-800 uppercase tracking-tight">
                                                    {selectedVaccination.staffName || 'Chưa cập nhật'}
                                                </p>
                                            </div>
                                        </div>
                                    </div>

                                    {/* Notes */}
                                    {selectedVaccination.notes && (
                                        <div className="space-y-2">
                                            <p className="text-[10px] text-stone-400 font-bold uppercase tracking-widest ml-1 text-center">Ghi chú & Phản ứng</p>
                                            <div className="bg-white p-6 rounded-[2.5rem] border border-stone-100 text-stone-500 font-medium italic text-sm text-center leading-relaxed shadow-inner">
                                                "{selectedVaccination.notes}"
                                            </div>
                                        </div>
                                    )}

                                    {/* Footer Actions */}
                                    <div className="flex items-center justify-center gap-6 pt-4">
                                        <button
                                            onClick={() => setIsEditingVaccination(true)}
                                            className="px-8 py-3 bg-white border border-stone-200 text-stone-600 font-black text-xs uppercase tracking-widest rounded-full shadow-sm hover:shadow-md hover:bg-stone-50 transition-all flex items-center gap-2 active:scale-95"
                                        >
                                            <PencilIcon className="w-4 h-4" />
                                            Sửa Hồ Sơ
                                        </button>
                                        <button
                                            onClick={(e) => handleDeleteVaccination(selectedVaccination.id, e)}
                                            className="px-8 py-3 bg-red-50 border border-red-100 text-red-500 font-black text-xs uppercase tracking-widest rounded-full shadow-sm hover:bg-red-100 transition-all flex items-center gap-2 active:scale-95"
                                        >
                                            <TrashIcon className="w-4 h-4" />
                                            Xóa Hồ Sơ
                                        </button>
                                    </div>
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            )}

            {/* Delete Confirmation Modal */}
            <ConfirmModal
                isOpen={isDeleteModalOpen}
                title="Xóa Hồ Sơ"
                message="Bạn có chắc chắn muốn xóa hồ sơ tiêm chủng này không? Hành động này không thể hoàn tác."
                confirmLabel="XÓA NGAY"
                cancelLabel="QUAY LẠI"
                isDanger={true}
                onConfirm={confirmDelete}
                onCancel={() => setIsDeleteModalOpen(false)}
            />
        </div >
    )
}

export default StaffPatientsPage
