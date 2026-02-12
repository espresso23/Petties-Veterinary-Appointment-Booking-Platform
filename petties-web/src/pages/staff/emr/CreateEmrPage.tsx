import { useState, useEffect } from 'react'
import { useToast } from '../../../components/Toast'
import { useNavigate, useParams, useSearchParams } from 'react-router-dom'
import {
    PlusIcon,
    TrashIcon,
    PhotoIcon,
    CalendarDaysIcon,
    CalendarIcon,
    XMarkIcon
} from '@heroicons/react/24/outline'
import { ConfirmModal } from '../../../components/ConfirmModal'
import { emrService } from '../../../services/emrService'
import { petService } from '../../../services/api/petService'
import DatePicker, { registerLocale } from "react-datepicker";
import "react-datepicker/dist/react-datepicker.css";
import { vi } from 'date-fns/locale';
import Select from 'react-select';

registerLocale('vi', vi);
import type { Prescription, EmrImage, CreateEmrRequest, EmrRecord } from '../../../services/emrService'

// ============= INTERFACES =============
interface PetInfo {
    id: string
    name: string
    species: string
    breed: string
    gender: string
    age: string
    weight?: number
    imageUrl?: string
    ownerName: string
    ownerPhone?: string
    allergies?: string[]
    color?: string
}

interface FieldErrors {
    subjective?: string
    objective?: string
    assessment?: string
    plan?: string
    temperature?: string
    prescriptions?: string
    images?: string
}

// ============= COMPONENT =============
export const CreateEmrPage = () => {
    const navigate = useNavigate()
    const { petId } = useParams<{ petId: string }>()
    const [searchParams] = useSearchParams()
    const bookingId = searchParams.get('bookingId')
    const bookingCode = searchParams.get('bookingCode')
    const { showToast } = useToast()

    // State for pet info (loaded from API)
    const [petInfo, setPetInfo] = useState<PetInfo | null>(null)
    const [isLoadingPet, setIsLoadingPet] = useState(true)
    const [medicalHistory, setMedicalHistory] = useState<{ date: string; diagnosis: string }[]>([])

    // Load pet info from API
    useEffect(() => {
        if (petId) {
            setIsLoadingPet(true)
            Promise.all([
                petService.getPetById(petId),
                emrService.getEmrsByPetId(petId).catch(() => [])
            ]).then(([pet, emrs]) => {
                // Calculate age from dateOfBirth
                let ageStr = 'N/A'
                if (pet.dateOfBirth) {
                    const birthDate = new Date(pet.dateOfBirth)
                    const today = new Date()
                    const ageYears = today.getFullYear() - birthDate.getFullYear()
                    ageStr = `${ageYears} tuổi`
                }
                setPetInfo({
                    id: pet.id,
                    name: pet.name,
                    species: pet.species,
                    breed: pet.breed || 'N/A',
                    gender: pet.gender || 'N/A',
                    age: ageStr,
                    weight: pet.weight,
                    imageUrl: pet.imageUrl,
                    ownerName: pet.ownerName || 'N/A',
                    ownerPhone: pet.ownerPhone,
                    allergies: pet.allergies ? pet.allergies.split(',').map(a => a.trim()) : [],
                    color: pet.color || 'Không rõ',
                })
                // Initialize weight field
                if (pet.weight) setWeight(pet.weight.toString())
                // Convert EMR records to medical history
                setMedicalHistory(emrs.map((emr: EmrRecord) => ({
                    date: new Date(emr.examinationDate).toLocaleDateString('vi-VN'),
                    diagnosis: emr.assessment?.substring(0, 50) || 'N/A'
                })))
            }).catch(err => {
                console.error('Error loading pet:', err)
            }).finally(() => {
                setIsLoadingPet(false)
            })
        }
    }, [petId])

    // ============= FORM STATE =============
    const [subjective, setSubjective] = useState('')
    const [temperature, setTemperature] = useState('')
    const [heartRate, setHeartRate] = useState('')
    const [bcs, setBcs] = useState<number | null>(null)
    const [objective, setObjective] = useState('')
    const [assessment, setAssessment] = useState('')
    const [plan, setPlan] = useState('')
    const [notes, setNotes] = useState('')
    const [weight, setWeight] = useState<string>('')
    const [allergies, setAllergies] = useState('')

    const [prescriptions, setPrescriptions] = useState<Prescription[]>([])
    const [reExaminationDate, setReExaminationDate] = useState('')
    const [reExamAmount, setReExamAmount] = useState(1)
    const [reExamUnit, setReExamUnit] = useState('Tuần')
    const [hasReExam, setHasReExam] = useState(false)


    // Update date when amount/unit changes
    useEffect(() => {
        if (!reExamAmount || reExamAmount <= 0) return

        const date = new Date()
        if (reExamUnit === 'Ngày') date.setDate(date.getDate() + reExamAmount)
        if (reExamUnit === 'Tuần') date.setDate(date.getDate() + (reExamAmount * 7))
        if (reExamUnit === 'Tháng') date.setMonth(date.getMonth() + reExamAmount)
        if (reExamUnit === 'Năm') date.setFullYear(date.getFullYear() + reExamAmount)

        setReExaminationDate(date.toISOString().split('T')[0])
    }, [reExamAmount, reExamUnit])

    const [images, setImages] = useState<EmrImage[]>([])
    const [isLoading, setIsLoading] = useState(false)
    const [errors, setErrors] = useState<FieldErrors>({})
    const [previewImage, setPreviewImage] = useState<EmrImage | null>(null)

    // Prescription modal
    const [showPrescriptionModal, setShowPrescriptionModal] = useState(false)
    const [showResetConfirm, setShowResetConfirm] = useState(false)
    const [tempPrescriptions, setTempPrescriptions] = useState<Prescription[]>([])

    // Initialize fields when petInfo loads
    useEffect(() => {
        if (petInfo) {
            if (petInfo.allergies) setAllergies(petInfo.allergies.join(', '))
        }
    }, [petInfo])

    // Prescription Modal Handlers (Internal to Modal)
    const handleOpenPrescriptionModal = () => {
        setTempPrescriptions(prescriptions.length > 0 ? [...prescriptions] : [{ medicineName: '', frequency: '', durationDays: 0, dosage: '', instructions: '' }])
        setShowPrescriptionModal(true)
    }

    const handleAddPrescriptionRow = () => {
        setTempPrescriptions([...tempPrescriptions, { medicineName: '', frequency: '', durationDays: 0, dosage: '', instructions: '' }])
    }

    const handleUpdatePrescription = (index: number, field: keyof Prescription, value: string | number) => {
        const updated = [...tempPrescriptions]
        updated[index] = { ...updated[index], [field]: value }
        setTempPrescriptions(updated)
    }

    const handleRemovePrescription = (index: number) => {
        setTempPrescriptions(tempPrescriptions.filter((_, i) => i !== index))
    }

    const handleSavePrescriptions = () => {
        // Filter out empty rows if any
        const valid = tempPrescriptions.filter(p => p.medicineName.trim() !== '')
        setPrescriptions(valid)
        setShowPrescriptionModal(false)
    }

    const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0]
        if (!file) return
        try {
            setErrors(prev => ({ ...prev, general: undefined }))
            const result = await emrService.uploadEmrImage(file)
            setImages([...images, { url: result.url }])
        } catch (err: any) {
            console.error('Upload error:', err)
            setErrors(prev => ({ ...prev, general: `Lỗi upload: ${err.response?.data?.message || err.message} ` }))
        }
    }

    const validateForm = (): boolean => {
        const newErrors: FieldErrors = {}

        if (!assessment.trim()) {
            newErrors.assessment = 'Không được bỏ trống.'
        }

        if (!plan.trim()) {
            newErrors.plan = 'Không được bỏ trống.'
        }

        setErrors(newErrors)
        return Object.keys(newErrors).length === 0
    }

    const handleSubmit = async () => {
        if (!validateForm()) return

        setIsLoading(true)
        setErrors({})

        try {


            // Format dates to YYYY-MM-DDTHH:mm:ss (LocalDateTime compatible)
            const now = new Date()
            const pad = (n: number) => n.toString().padStart(2, '0')
            const examinationDate = `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}T${pad(now.getHours())}:${pad(now.getMinutes())}:${pad(now.getSeconds())}`

            const request: CreateEmrRequest = {
                petId: petId!,
                bookingId: bookingId || undefined,
                subjective: subjective || undefined,
                objective: objective || undefined,
                assessment,
                plan,
                notes: notes || undefined,
                weightKg: weight ? parseFloat(weight.replace(',', '.')) : undefined,
                temperatureC: temperature ? parseFloat(temperature.replace(',', '.')) : undefined,
                heartRate: heartRate ? parseInt(heartRate) : undefined,
                bcs: bcs || undefined,
                prescriptions,
                images,


                reExaminationDate: hasReExam ? (reExaminationDate ? `${reExaminationDate}T00:00:00` : undefined) : undefined,
                examinationDate
            }

            await emrService.createEmr(request)

            // Update pet weight in profile if changed
            if (weight && petInfo) {
                const parsedWeight = parseFloat(weight.replace(',', '.'));
                if (parsedWeight !== petInfo.weight) {
                    try {
                        await petService.updateWeight(petInfo.id, parsedWeight)
                    } catch (weightErr) {
                        console.error('Failed to update pet weight:', weightErr)
                        // Don't block EMR save if weight update fails
                    }
                }
            }

            // Update allergies if changed
            if (petInfo && allergies !== (petInfo.allergies?.join(', ') || '')) {
                try {
                    await petService.updateAllergies(petInfo.id, allergies)
                } catch (allergyErr) {
                    console.error('Failed to update allergies:', allergyErr)
                }
            }

            showToast('success', 'Lưu Bệnh án thành công!')
            navigate(-1)
        } catch (err: any) {
            // Parse backend error to show at correct field
            const errorMsg = err.response?.data?.message || ''
            const newErrors: FieldErrors = {}

            if (errorMsg.includes('pet') || errorMsg.includes('thú cưng')) {
                newErrors.assessment = 'Không tìm thấy thú cưng.'
                setErrors(newErrors)
            } else {
                showToast('error', errorMsg || 'Không thể lưu. Vui lòng thử lại.')
            }
        } finally {
            setIsLoading(false)
        }
    }

    // ============= RENDER =============
    // Loading state
    if (isLoadingPet) {
        return (
            <div className="min-h-screen bg-stone-100 flex items-center justify-center">
                <p className="text-stone-500">Đang tải thông tin thú cưng...</p>
            </div>
        )
    }

    if (!petInfo) {
        return (
            <div className="min-h-screen bg-stone-100 flex items-center justify-center">
                <div className="text-center">
                    <p className="text-stone-500 mb-4">Không tìm thấy thông tin thú cưng</p>
                    <button onClick={() => navigate(-1)} className="px-4 py-2 bg-blue-600 text-white rounded-lg">
                        Quay lại
                    </button>
                </div>
            </div>
        )
    }

    return (
        <div className="min-h-screen bg-stone-100 p-6">
            <div className="max-w-7xl mx-auto">
                {/* Main Grid */}
                <div className="grid grid-cols-12 gap-6">

                    {/* ========== LEFT SIDEBAR ========== */}
                    <div className="col-span-3 space-y-4">
                        {/* Pet Info Card */}
                        <div className="bg-white rounded-2xl p-6 shadow-sm">
                            <div className="flex flex-col items-center mb-4">
                                <div className="w-24 h-24 bg-stone-200 rounded-full flex items-center justify-center text-5xl mb-3 border-4 border-stone-300 overflow-hidden">
                                    {petInfo.imageUrl ? (
                                        <img src={petInfo.imageUrl} alt={petInfo.name} className="w-full h-full object-cover" />
                                    ) : (
                                        <span className="font-bold text-amber-600">{petInfo.name.charAt(0)}</span>
                                    )}
                                </div>
                                <h2 className="text-2xl font-black text-stone-800">{petInfo.name}</h2>
                            </div>

                            <div className="space-y-2 text-sm">
                                <div className="flex justify-between">
                                    <span className="text-stone-500">Giống:</span>
                                    <span className="font-semibold text-stone-800">{petInfo.breed}</span>
                                </div>
                                <div className="flex justify-between">
                                    <span className="text-stone-500">Màu lông:</span>
                                    <span className="font-semibold text-stone-800">{petInfo.color}</span>
                                </div>
                                <div className="flex justify-between">
                                    <span className="text-stone-500">Giới tính:</span>
                                    <span className="font-semibold text-stone-800">{petInfo.gender === 'MALE' ? 'Đực' : petInfo.gender === 'FEMALE' ? 'Cái' : petInfo.gender}</span>
                                </div>
                                <div className="flex justify-between">
                                    <span className="text-stone-500">Tuổi:</span>
                                    <span className="font-semibold text-stone-800">{petInfo.age}</span>
                                </div>
                                <div className="flex justify-between items-center">
                                    <span className="text-stone-500">Cân nặng (kg):</span>
                                    <input
                                        type="number"
                                        step="0.1"
                                        value={weight}
                                        onChange={(e) => setWeight(e.target.value)}
                                        className="w-20 text-right font-semibold text-stone-800 border border-stone-300 rounded px-2 py-1 focus:border-amber-500 focus:outline-none"
                                        placeholder="0"
                                    />
                                </div>
                            </div>

                            <div className="border-t border-stone-200 mt-4 pt-4 space-y-1 text-sm">
                                <div className="flex justify-between">
                                    <span className="text-stone-500">Chủ sở hữu:</span>
                                    <span className="font-semibold">{petInfo.ownerName}</span>
                                </div>
                                <div className="flex justify-between">
                                    <span className="text-stone-500">Liên hệ:</span>
                                    <span className="font-semibold">{petInfo.ownerPhone}</span>
                                </div>
                            </div>

                            <div className="mt-4 border-t border-stone-200 pt-4">
                                <label className="text-stone-500 text-sm font-semibold flex items-center justify-between mb-1">
                                    Dị ứng / Lưu ý:
                                </label>
                                <textarea
                                    value={allergies}
                                    onChange={(e) => setAllergies(e.target.value)}
                                    placeholder="Không có ghi nhận dị ứng."
                                    rows={2}
                                    className="w-full text-sm border border-stone-300 rounded-lg p-2 focus:outline-none focus:border-amber-500 bg-amber-50 text-amber-900 placeholder-amber-900/50"
                                />
                            </div>
                        </div>

                        {/* Medical History Summary */}
                        <div className="bg-white rounded-2xl p-4 shadow-sm">
                            <h3 className="font-bold text-stone-700 mb-3">Tóm tắt Bệnh sử</h3>
                            <div className="space-y-2 text-sm">
                                {medicalHistory.map((h, i) => (
                                    <p key={i} className="text-stone-600">
                                        <span className="font-medium">{h.date}:</span> {h.diagnosis}
                                    </p>
                                ))}
                                {medicalHistory.length === 0 && (
                                    <p className="text-stone-400 text-sm">Chưa có lịch sử khám</p>
                                )}
                            </div>
                        </div>
                    </div>

                    {/* ========== CENTER - SOAP FORM ========== */}
                    <div className="col-span-5 space-y-4">
                        <div className="bg-white rounded-2xl p-6 shadow-sm">
                            <div className="flex justify-between items-center mb-6">
                                <h2 className="text-xl font-black text-stone-800">Biểu mẫu SOAP</h2>
                                {bookingCode && (
                                    <div className="px-3 py-1 bg-blue-50 text-blue-700 text-sm font-bold rounded-lg border border-blue-200">
                                        Booking #{bookingCode}
                                    </div>
                                )}
                            </div>

                            {/* S - Subjective */}
                            <div className="mb-6">
                                <div className="flex items-center gap-3 mb-2">
                                    <span className="w-1 h-6 bg-orange-600 rounded-full"></span>
                                    <h2 className="text-lg font-bold text-orange-800 tracking-tight uppercase">S - CHỦ QUAN (Subjective)</h2>
                                </div>
                                <p className="text-xs text-stone-400 mb-2">Ghi triệu chứng theo lời kể của chủ nuôi</p>
                                <textarea
                                    value={subjective}
                                    onChange={(e) => {
                                        setSubjective(e.target.value)
                                        if (errors.subjective) setErrors(prev => ({ ...prev, subjective: undefined }))
                                    }}
                                    placeholder="VD: Chó bỏ ăn 2 ngày, nôn 3 lần, đi tiêu lỏng..."
                                    rows={3}
                                    className={`w-full border rounded-lg p-3 text-sm focus:outline-none ${errors.subjective ? 'border-red-400' : 'border-stone-300 focus:border-amber-500'}`}
                                />
                                {errors.subjective && <p className="text-red-500 text-xs mt-1">{errors.subjective}</p>}
                            </div>

                            {/* A - Assessment */}
                            <div className="mb-6">
                                <div className="flex items-center gap-3 mb-2">
                                    <span className="w-1 h-6 bg-orange-600 rounded-full"></span>
                                    <h2 className="text-lg font-bold text-orange-800 tracking-tight uppercase">A - ĐÁNH GIÁ (Assessment) <span className="text-red-500">*</span></h2>
                                </div>
                                <textarea
                                    value={assessment}
                                    onChange={(e) => {
                                        setAssessment(e.target.value)
                                        if (errors.assessment) setErrors(prev => ({ ...prev, assessment: undefined }))
                                    }}
                                    placeholder="Chẩn đoán sơ bộ và đánh giá tình trạng bệnh..."
                                    rows={3}
                                    className={`w-full border rounded-lg p-3 text-sm focus:outline-none ${errors.assessment ? 'border-red-400 focus:border-red-500' : 'border-stone-300 focus:border-amber-500'}`}
                                />
                                {errors.assessment && (
                                    <p className="text-red-500 text-sm mt-1">{errors.assessment}</p>
                                )}
                            </div>
                        </div>

                        {/* Prescription Section */}
                        <div className="bg-white rounded-2xl p-6 shadow-sm relative overflow-hidden">
                            <div className="flex items-center justify-between mb-8">
                                <div className="flex items-center gap-3">
                                    <span className="w-1 h-6 bg-orange-600 rounded-full"></span>
                                    <div>
                                        <h2 className="text-lg font-bold text-orange-800 tracking-tight uppercase">ĐƠN THUỐC ĐIỀU TRỊ</h2>
                                        <p className="text-stone-400 text-[10px] mt-0.5 font-medium uppercase tracking-widest">Danh mục thuốc được chỉ định chi tiết</p>
                                    </div>
                                </div>
                                <button
                                    onClick={handleOpenPrescriptionModal}
                                    className="px-6 py-2 bg-orange-50 text-orange-700 font-bold border border-orange-200 rounded-xl hover:bg-orange-100 transition-all flex items-center gap-2 text-sm active:scale-95"
                                >
                                    <PlusIcon className="w-4 h-4" />
                                    {prescriptions.length > 0 ? 'CHỈNH SỬA ĐƠN' : 'KÊ ĐƠN NGAY'}
                                </button>
                            </div>

                            {prescriptions.length > 0 ? (
                                <div className="space-y-4">
                                    {prescriptions.map((p, i) => (
                                        <div key={i} className="group p-4 bg-white rounded-2xl border border-stone-100 flex flex-col md:flex-row gap-4 items-start md:items-center relative overflow-hidden">
                                            <div className="absolute left-0 top-0 bottom-0 w-1 bg-orange-500/30"></div>
                                            <div className="pl-3 flex-1 min-w-0">
                                                <div className="font-bold text-stone-800 text-sm tracking-tight">{p.medicineName}</div>
                                                <div className="mt-1 flex flex-wrap items-center gap-3 text-[10px] text-stone-400 font-medium uppercase tracking-widest">
                                                    <span className="flex items-center gap-1.5 whitespace-nowrap">
                                                        <span className="w-1 h-1 rounded-full bg-stone-200"></span>
                                                        {(p.dosage || '').toLowerCase().includes('viên') ? p.dosage : `${p.dosage || ''} viên/lần`}
                                                    </span>
                                                    <span className="flex items-center gap-1.5 whitespace-nowrap">
                                                        <span className="w-1 h-1 rounded-full bg-stone-200"></span>
                                                        {(p.frequency || '').toLowerCase().includes('lần') ? p.frequency : `${p.frequency || ''} lần/ngày`}
                                                    </span>
                                                    <span className="flex items-center gap-1.5 text-orange-600 font-bold whitespace-nowrap">
                                                        <span className="w-1 h-1 rounded-full bg-orange-500"></span>
                                                        {p.durationDays} NGÀY
                                                    </span>
                                                </div>
                                            </div>

                                            {p.instructions && (
                                                <div className="md:w-1/3 p-3 bg-stone-50/50 rounded-xl border border-stone-100 text-[11px] text-stone-500 italic">
                                                    <span className="block not-italic font-bold text-stone-400 text-[9px] uppercase mb-1 tracking-tighter opacity-50">Hướng dẫn sử dụng</span>
                                                    {p.instructions}
                                                </div>
                                            )}
                                        </div>
                                    ))}
                                </div>
                            ) : (
                                <div
                                    onClick={handleOpenPrescriptionModal}
                                    className="group cursor-pointer py-12 bg-stone-50 rounded-3xl border-2 border-dashed border-stone-200 flex flex-col items-center justify-center transition-all hover:bg-amber-50/30 hover:border-amber-200"
                                >
                                    <div className="w-12 h-12 bg-white rounded-2xl flex items-center justify-center shadow-sm mb-4 group-hover:scale-105 group-hover:shadow-md transition-all border border-stone-100">
                                        <PlusIcon className="w-6 h-6 text-stone-400 group-hover:text-amber-600" />
                                    </div>
                                    <p className="text-stone-400 text-xs font-semibold group-hover:text-stone-600 tracking-widest uppercase">Bấm để bắt đầu kê đơn</p>
                                </div>
                            )}
                        </div >

                        {/* Prescription Modal */}
                        {
                            showPrescriptionModal && (
                                <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-stone-900/60 backdrop-blur-md animate-in fade-in duration-300">
                                    <div className="bg-white w-full max-w-5xl rounded-[2.5rem] shadow-2xl overflow-hidden flex flex-col max-h-[90vh] animate-in zoom-in-95 duration-300 border border-stone-200">
                                        {/* Modal Header */}
                                        <div className="px-8 py-4 border-b border-stone-100 flex items-center justify-between bg-stone-50/50">
                                            <div>
                                                <h2 className="text-xl font-bold text-stone-800 tracking-tight">Lập đơn thuốc</h2>
                                                <p className="text-stone-400 text-[10px] mt-0.5 font-medium">Chi tiết liều lượng và phác đồ điều trị tiêu chuẩn</p>
                                            </div>
                                            <button
                                                onClick={() => setShowPrescriptionModal(false)}
                                                className="group p-2 hover:bg-white hover:shadow-md rounded-xl transition-all text-stone-300 hover:text-stone-500 border border-transparent hover:border-stone-100"
                                            >
                                                <XMarkIcon className="w-6 h-6" />
                                            </button>
                                        </div>

                                        <div className="flex-1 overflow-y-auto p-6 bg-white">
                                            <div className="space-y-4">
                                                {/* Table Header */}
                                                <div className="grid grid-cols-12 gap-2 px-4 py-2 bg-orange-50/50 border border-orange-100 rounded-xl text-[11px] font-bold text-orange-800 uppercase tracking-widest text-center">
                                                    <div className="col-span-3">Tên thuốc</div>
                                                    <div className="col-span-1">Liều</div>
                                                    <div className="col-span-1">T.Suất</div>
                                                    <div className="col-span-1">Ngày</div>
                                                    <div className="col-span-5">Hướng dẫn sử dụng</div>
                                                    <div className="col-span-1"></div>
                                                </div>

                                                {/* Rows */}
                                                <div className="space-y-2">
                                                    {tempPrescriptions.map((p, i) => (
                                                        <div key={i} className="grid grid-cols-12 gap-2 items-center p-2 rounded-2xl hover:bg-stone-50 transition-all border border-transparent hover:border-stone-100 group">
                                                            <div className="col-span-3">
                                                                <input
                                                                    type="text"
                                                                    list="medicine-list-modal"
                                                                    value={p.medicineName}
                                                                    onChange={(e) => handleUpdatePrescription(i, 'medicineName', e.target.value)}
                                                                    placeholder="Tên thuốc..."
                                                                    className="w-full bg-white border border-stone-200 rounded-xl px-3 py-1.5 text-sm font-semibold text-stone-700 focus:ring-4 focus:ring-amber-500/10 focus:border-amber-600 outline-none transition-all placeholder:font-normal placeholder:text-stone-300"
                                                                />
                                                            </div>
                                                            <div className="col-span-1">
                                                                <input
                                                                    type="text"
                                                                    value={p.dosage || ''}
                                                                    onChange={(e) => handleUpdatePrescription(i, 'dosage', e.target.value)}
                                                                    placeholder="1"
                                                                    className="w-full bg-white border border-stone-200 rounded-xl px-1 py-1.5 text-sm text-center font-medium focus:ring-4 focus:ring-amber-500/10 focus:border-amber-600 outline-none transition-all placeholder:text-stone-300"
                                                                />
                                                            </div>
                                                            <div className="col-span-1">
                                                                <input
                                                                    type="text"
                                                                    value={p.frequency}
                                                                    onChange={(e) => handleUpdatePrescription(i, 'frequency', e.target.value)}
                                                                    placeholder="2"
                                                                    className="w-full bg-white border border-stone-200 rounded-xl px-1 py-1.5 text-sm text-center font-medium focus:ring-4 focus:ring-amber-500/10 focus:border-amber-600 outline-none transition-all placeholder:text-stone-300"
                                                                />
                                                            </div>
                                                            <div className="col-span-1">
                                                                <input
                                                                    type="number"
                                                                    value={p.durationDays || ''}
                                                                    onChange={(e) => handleUpdatePrescription(i, 'durationDays', parseInt(e.target.value) || 0)}
                                                                    placeholder="7"
                                                                    className="w-full bg-white border border-stone-200 rounded-xl px-1 py-1.5 text-sm text-center font-bold text-orange-600 focus:ring-4 focus:ring-orange-500/10 focus:border-orange-600 outline-none transition-all shadow-sm shadow-orange-50"
                                                                />
                                                            </div>
                                                            <div className="col-span-5">
                                                                <input
                                                                    type="text"
                                                                    value={p.instructions || ''}
                                                                    onChange={(e) => handleUpdatePrescription(i, 'instructions', e.target.value)}
                                                                    placeholder="Hướng dẫn sử dụng chi tiết..."
                                                                    className="w-full bg-white border border-stone-200 rounded-xl px-4 py-1.5 text-sm font-medium focus:ring-4 focus:ring-amber-500/10 focus:border-amber-600 outline-none transition-all placeholder:font-normal placeholder:text-stone-300 italic"
                                                                />
                                                            </div>
                                                            <div className="col-span-1 flex justify-center">
                                                                <button
                                                                    onClick={() => handleRemovePrescription(i)}
                                                                    className="p-2 text-stone-300 hover:text-red-500 hover:bg-red-50 rounded-lg transition-all opacity-0 group-hover:opacity-100 active:scale-90"
                                                                >
                                                                    <TrashIcon className="w-4 h-4" />
                                                                </button>
                                                            </div>
                                                        </div>
                                                    ))}
                                                </div>

                                                <datalist id="medicine-list-modal">
                                                    <option value="Amoxicillin 500mg" />
                                                    <option value="Metronidazole 250mg" />
                                                    <option value="Doxycycline 100mg" />
                                                    <option value="NexGard Spectra" />
                                                    <option value="Bravecto" />
                                                </datalist>

                                                <button
                                                    onClick={handleAddPrescriptionRow}
                                                    className="w-full py-3 border-2 border-dashed border-stone-100 rounded-2xl text-stone-400 font-semibold hover:border-orange-500 hover:text-orange-700 hover:bg-orange-50/20 transition-all flex items-center justify-center gap-3 mt-4 group"
                                                >
                                                    <div className="w-5 h-5 rounded-md bg-stone-50 flex items-center justify-center group-hover:bg-orange-100 group-hover:text-orange-700 transition-all">
                                                        <PlusIcon className="w-3.5 h-3.5" />
                                                    </div>
                                                    <span className="uppercase tracking-widest text-[8px]">Thêm loại thuốc mới</span>
                                                </button>
                                            </div>
                                        </div>

                                        {/* Modal Footer */}
                                        <div className="px-8 py-4 border-t border-stone-100 flex items-center justify-between bg-stone-50/30">
                                            <button
                                                onClick={() => setShowResetConfirm(true)}
                                                className="text-stone-400 hover:text-red-500 font-bold text-[10px] uppercase tracking-widest transition-colors"
                                            >
                                                Xóa toàn bộ
                                            </button>
                                            <div className="flex items-center gap-4">
                                                <button
                                                    onClick={() => setShowPrescriptionModal(false)}
                                                    className="px-6 py-2.5 text-stone-500 font-semibold hover:bg-white hover:shadow-sm rounded-xl transition-all text-sm"
                                                >
                                                    QUAY LẠI
                                                </button>
                                                <button
                                                    onClick={handleSavePrescriptions}
                                                    className="px-8 py-2.5 bg-orange-600 text-white font-bold rounded-xl hover:bg-orange-700 shadow-xl shadow-orange-100 transition-all active:scale-95 text-sm uppercase tracking-wider"
                                                >
                                                    Xác nhận đơn
                                                </button>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            )
                        }

                        <ConfirmModal
                            isOpen={showResetConfirm}
                            title="Xác nhận xóa"
                            message="Bạn có chắc chắn muốn xóa toàn bộ đơn thuốc này? Hành động này không thể hoàn tác."
                            confirmLabel="XÓA TẤT CẢ"
                            cancelLabel="QUAY LẠI"
                            isDanger={true}
                            onConfirm={() => {
                                setTempPrescriptions([])
                                setShowResetConfirm(false)
                            }}
                            onCancel={() => setShowResetConfirm(false)}
                        />
                        {/* Images & Documents - Moved here from sidebar */}
                        <div className="bg-white rounded-2xl p-6 shadow-sm">
                            <h3 className="font-bold text-stone-700 mb-4">Hình ảnh & Tài liệu</h3>

                            <label className="block border-2 border-dashed border-stone-300 rounded-lg p-6 text-center cursor-pointer hover:border-amber-400 transition-colors mb-4">
                                <PhotoIcon className="w-8 h-8 mx-auto text-stone-400 mb-2" />
                                <p className="text-sm text-stone-500">Kéo thả hoặc nhấp để tải lên hình ảnh, X-quang...</p>
                                <input type="file" accept="image/*" className="hidden" onChange={handleImageUpload} />
                            </label>

                            {images.length > 0 && (
                                <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                                    {images.map((img, i) => (
                                        <div key={i} className="border border-stone-200 rounded-lg p-2">
                                            <div className="relative mb-2">
                                                <img
                                                    src={img.url}
                                                    alt=""
                                                    className="h-32 w-full object-cover rounded-lg cursor-pointer hover:opacity-75 transition-opacity"
                                                    onClick={() => setPreviewImage(img)}
                                                />
                                                <button
                                                    type="button"
                                                    onClick={() => setImages(images.filter((_, idx) => idx !== i))}
                                                    className="absolute top-1 right-1 bg-red-500 text-white rounded-full w-6 h-6 flex items-center justify-center text-xs hover:bg-red-600"
                                                >
                                                    ×
                                                </button>
                                            </div>
                                            <input
                                                type="text"
                                                value={img.description || ''}
                                                onChange={(e) => {
                                                    const newImages = [...images]
                                                    newImages[i] = { ...newImages[i], description: e.target.value }
                                                    setImages(newImages)
                                                }}
                                                placeholder="Mô tả hình ảnh..."
                                                className="w-full text-xs border border-stone-300 rounded px-2 py-1.5 focus:outline-none focus:border-amber-500"
                                            />
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div >

                    </div >

                    {/* ========== RIGHT SIDEBAR ========== */}
                    < div className="col-span-4 space-y-4" >
                        {/* O - Objective */}
                        <div className="bg-white rounded-2xl p-6 shadow-sm">
                            <div className="flex items-center gap-3 mb-2">
                                <span className="w-1 h-6 bg-orange-600 rounded-full"></span>
                                <h2 className="text-lg font-bold text-orange-800 tracking-tight uppercase">O - KHÁCH QUAN (Objective)</h2>
                            </div>
                            <p className="text-xs text-stone-400 mb-4">Kết quả khám lâm sàng, chỉ số sinh tồn</p>

                            <div className="grid grid-cols-2 gap-3 mb-4">
                                <div>
                                    <label className="text-sm text-stone-500">Nhiệt độ (°C):</label>
                                    <input
                                        type="number"
                                        step="0.1"
                                        value={temperature}
                                        onChange={(e) => {
                                            setTemperature(e.target.value)
                                            if (errors.temperature) setErrors(prev => ({ ...prev, temperature: undefined }))
                                        }}
                                        placeholder="VD: 38.5"
                                        className={`w-full border rounded-lg p-2 text-sm mt-1 ${errors.temperature ? 'border-red-400' : 'border-stone-300'}`}
                                    />
                                    {errors.temperature && <p className="text-red-500 text-xs mt-1">{errors.temperature}</p>}
                                </div>
                                <div>
                                    <label className="text-sm text-stone-500">Nhịp tim (lần/phút):</label>
                                    <input
                                        type="number"
                                        value={heartRate}
                                        onChange={(e) => setHeartRate(e.target.value)}
                                        placeholder="120"
                                        className="w-full border border-stone-300 rounded-lg p-2 text-sm mt-1"
                                    />
                                </div>
                            </div>

                            {/* BCS Score */}
                            <div className="mb-4">
                                <label className="text-sm text-stone-500 mb-2 block">BCS (Điểm thể trạng 1-9):</label>
                                <div className="flex gap-1">
                                    {[1, 2, 3, 4, 5, 6, 7, 8, 9].map(score => (
                                        <button
                                            key={score}
                                            type="button"
                                            onClick={() => setBcs(score)}
                                            className={`w-8 h-8 rounded-full text-xs font-bold transition-all ${bcs === score
                                                ? 'bg-stone-900 text-white shadow-xl shadow-stone-200 scale-110'
                                                : 'bg-stone-50 text-stone-500 hover:bg-stone-100'
                                                }`}
                                        >
                                            {score}
                                        </button>
                                    ))}
                                </div>
                                <p className="text-xs text-stone-400 mt-1">1-3: Gầy | 4-5: Bình thường | 6-9: Thừa cân</p>
                            </div>

                            <textarea
                                value={objective}
                                onChange={(e) => setObjective(e.target.value)}
                                placeholder="Kết quả khám lâm sàng..."
                                rows={3}
                                className="w-full border border-stone-300 rounded-lg p-3 text-sm"
                            />
                        </div >

                        {/* P - Plan */}
                        <div className="bg-white rounded-2xl p-6 shadow-sm">
                            <div className="flex items-center gap-3 mb-4">
                                <span className="w-1 h-6 bg-orange-600 rounded-full"></span>
                                <h2 className="text-lg font-bold text-orange-800 tracking-tight uppercase">P - KẾ HOẠCH (Plan) <span className="text-red-500">*</span></h2>
                            </div>
                            <textarea
                                value={plan}
                                onChange={(e) => {
                                    setPlan(e.target.value)
                                    if (errors.plan) setErrors(prev => ({ ...prev, plan: undefined }))
                                }}
                                placeholder="Kế hoạch điều trị, xét nghiệm đề xuất, hướng dẫn chăm sóc..."
                                rows={4}
                                className={`w-full border rounded-lg p-3 text-sm ${errors.plan ? 'border-red-400 focus:border-red-500' : 'border-stone-300 focus:border-amber-500'
                                    } focus:outline-none`}
                            />
                            {
                                errors.plan && (
                                    <p className="text-red-500 text-sm mt-1">{errors.plan}</p>
                                )
                            }
                        </div >

                        {/* Notes */}
                        < div className="bg-white rounded-2xl p-6 shadow-sm" >
                            <h3 className="font-bold text-stone-700 mb-2">Ghi chú (Tùy chọn)</h3>
                            <textarea
                                value={notes}
                                onChange={(e) => setNotes(e.target.value)}
                                placeholder="Ghi chú thêm về ca khám..."
                                rows={3}
                                className="w-full border border-stone-300 rounded-lg p-3 text-sm focus:border-amber-500 focus:outline-none"
                            />
                        </div >

                        {/* Re-examination Date */}
                        < div className="bg-white rounded-2xl p-6 shadow-sm" >
                            <div className="flex items-center justify-between mb-4">
                                <h3 className="font-bold text-stone-700 flex items-center gap-2">
                                    <CalendarDaysIcon className="w-5 h-5 text-amber-500" />
                                    Hẹn tái khám
                                </h3>
                                <button
                                    onClick={() => setHasReExam(!hasReExam)}
                                    className={`relative w-11 h-6 rounded-full transition-colors ${hasReExam ? 'bg-amber-500' : 'bg-stone-200'
                                        }`}
                                >
                                    <span
                                        className={`absolute top-1 left-1 bg-white w-4 h-4 rounded-full transition-transform ${hasReExam ? 'translate-x-[22px]' : 'translate-x-0'
                                            }`}
                                    />
                                </button>
                            </div>

                            {
                                hasReExam && (
                                    <div className="space-y-4">
                                        {/* Date Picker - FIRST */}
                                        <div className="bg-stone-50 rounded-xl p-4 border border-stone-100">
                                            <label className="text-xs font-bold text-stone-500 uppercase mb-3 block">Ngày cụ thể</label>
                                            <div className="relative group">
                                                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none z-20">
                                                    <CalendarIcon className="h-5 w-5 text-amber-400 group-focus-within:text-amber-600 transition-colors" />
                                                </div>
                                                <DatePicker
                                                    selected={reExaminationDate ? new Date(reExaminationDate) : null}
                                                    onChange={(date: Date | null) => setReExaminationDate(date ? date.toLocaleDateString('en-CA') : '')}
                                                    dateFormat="dd/MM/yyyy"
                                                    minDate={new Date()}
                                                    locale="vi"
                                                    placeholderText="Chọn ngày tái khám"
                                                    className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-stone-200 bg-white text-sm text-amber-700 font-medium focus:outline-none focus:ring-2 focus:ring-amber-500 focus:border-transparent transition-all shadow-sm hover:border-amber-200 cursor-pointer"
                                                    wrapperClassName="w-full block"
                                                    popperClassName="z-[9999]"
                                                />
                                            </div>
                                        </div>

                                        {/* Duration Input - with react-select for proper z-index */}
                                        <div className="bg-stone-50 rounded-xl p-4 border border-stone-100">
                                            <label className="text-xs font-bold text-stone-500 uppercase mb-3 block">Hoặc sau khoảng</label>
                                            <div className="flex gap-2 items-center">
                                                <input
                                                    type="number"
                                                    min="1"
                                                    value={reExamAmount}
                                                    onChange={(e) => setReExamAmount(parseInt(e.target.value) || 0)}
                                                    className="w-20 py-2.5 px-3 text-center font-bold text-sm text-amber-700 focus:outline-none border border-stone-200 bg-white rounded-xl focus:ring-2 focus:ring-amber-500"
                                                />
                                                <div className="flex-1">
                                                    <Select
                                                        value={{ value: reExamUnit, label: reExamUnit }}
                                                        onChange={(option) => setReExamUnit(option?.value || 'Tuần')}
                                                        options={[
                                                            { value: 'Ngày', label: 'Ngày' },
                                                            { value: 'Tuần', label: 'Tuần' },
                                                            { value: 'Tháng', label: 'Tháng' },
                                                            { value: 'Năm', label: 'Năm' },
                                                        ]}
                                                        menuPortalTarget={document.body}
                                                        menuPosition="fixed"
                                                        styles={{
                                                            control: (base) => ({
                                                                ...base,
                                                                borderRadius: '0.75rem',
                                                                borderColor: '#e7e5e4',
                                                                minHeight: '42px',
                                                                boxShadow: 'none',
                                                                '&:hover': { borderColor: '#f59e0b' },
                                                            }),
                                                            option: (base, state) => ({
                                                                ...base,
                                                                backgroundColor: state.isSelected ? '#f59e0b' : state.isFocused ? '#fef3c7' : 'white',
                                                                color: state.isSelected ? 'white' : '#78716c',
                                                                fontWeight: 500,
                                                            }),
                                                            singleValue: (base) => ({
                                                                ...base,
                                                                color: '#b45309',
                                                                fontWeight: 500,
                                                            }),
                                                            menuPortal: (base) => ({ ...base, zIndex: 9999 }),
                                                        }}
                                                        isSearchable={false}
                                                    />
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                )
                            }
                        </div >


                    </div >
                </div >

                {/* Submit Button */}
                < div className="flex justify-end mt-6" >
                    <button
                        onClick={handleSubmit}
                        disabled={isLoading}
                        className="px-8 py-3 bg-amber-500 text-white font-bold rounded-xl hover:bg-amber-600 transition-colors disabled:opacity-50 text-lg shadow-lg"
                    >
                        {isLoading ? 'ĐANG LƯU...' : 'LƯU VÀ TIẾP TỤC'}
                    </button>
                </div >
            </div >

            {/* Image Preview Modal */}
            {
                previewImage && (
                    <div
                        className="fixed inset-0 bg-black/80 z-50 flex items-center justify-center p-4"
                        onClick={() => setPreviewImage(null)}
                    >
                        <div className="relative max-w-4xl max-h-[90vh] flex flex-col items-center">
                            <img
                                src={previewImage.url}
                                alt="Preview"
                                className="max-w-full max-h-[85vh] object-contain rounded-lg"
                            />
                            {previewImage.description && (
                                <div className="mt-4 bg-black/50 text-white px-4 py-2 rounded-lg backdrop-blur-sm text-center">
                                    <p className="text-sm font-medium">{previewImage.description}</p>
                                </div>
                            )}
                            <button
                                onClick={() => setPreviewImage(null)}
                                className="absolute top-2 right-2 bg-white/90 hover:bg-white text-stone-800 rounded-full w-10 h-10 flex items-center justify-center text-xl font-bold shadow-lg"
                            >
                                ×
                            </button>
                        </div>
                    </div>
                )
            }
        </div >
    )
}

export default CreateEmrPage
