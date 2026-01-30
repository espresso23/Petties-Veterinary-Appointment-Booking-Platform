import { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import {
    ArrowLeftIcon,
    TrashIcon,
    PlusIcon,
    CalendarDaysIcon,
    CalendarIcon,
    PhotoIcon
} from '@heroicons/react/24/outline'
import { useToast } from '../../../components/Toast'
import { emrService } from '../../../services/emrService'
import { petService } from '../../../services/api/petService'
import { tokenStorage } from '../../../services/authService'
import DatePicker, { registerLocale } from "react-datepicker";
import "react-datepicker/dist/react-datepicker.css";
import { vi } from 'date-fns/locale';
import Select from 'react-select';
import type { CreateEmrRequest, EmrImage } from '../../../services/emrService'

registerLocale('vi', vi);

// ============= INTERFACES =============
interface PetInfo {
    id: string
    name: string
    species: string
    breed: string
    age: string
    sex: string
    weight: string
    color?: string
    ownerName: string
    ownerPhone?: string
    notes?: string
    imageUrl?: string
    allergies?: string[]
}

interface FieldErrors {
    [key: string]: string
}

// ============= COMPONENT =============
export const EditEmrPage = () => {
    const { emrId } = useParams()
    const navigate = useNavigate()
    const { showToast } = useToast()

    // State
    const [isLoading, setIsLoading] = useState(true)
    const [isSaving, setIsSaving] = useState(false)
    const [petInfo, setPetInfo] = useState<PetInfo | null>(null)
    const [errors, setErrors] = useState<FieldErrors>({})
    const [isExpired, setIsExpired] = useState(false) // 24-hour edit window expired
    const [previewImage, setPreviewImage] = useState<EmrImage | null>(null) // For image preview modal

    // Form State (SOAP)
    const [subjective, setSubjective] = useState('')
    const [objective, setObjective] = useState({
        temperature: '',
        heartRate: '',
        respRate: '',
        weight: '',
        bcs: null as number | null, // Body Condition Score (1-9)
        notes: '',
    })
    const [assessment, setAssessment] = useState('')
    const [plan, setPlan] = useState('')
    const [prescriptions, setPrescriptions] = useState<any[]>([]) // Using same structure as Create
    const [images, setImages] = useState<EmrImage[]>([])
    const [notes, setNotes] = useState('')
    const [allergies, setAllergies] = useState('')


    const [reExaminationDate, setReExaminationDate] = useState<string>('')
    const [reExamAmount, setReExamAmount] = useState(1)
    const [reExamUnit, setReExamUnit] = useState('Tuần')
    const [hasReExam, setHasReExam] = useState(false)
    const [medicalHistory, setMedicalHistory] = useState<{ date: string; diagnosis: string }[]>([])

    // Prescription Modal State
    const [showAddPrescription, setShowAddPrescription] = useState(false)
    const [newPrescription, setNewPrescription] = useState<any>({})
    const [editingPrescriptionIndex, setEditingPrescriptionIndex] = useState<number | null>(null)


    // Update date from dynamic input
    useEffect(() => {
        if (!reExamAmount || reExamAmount <= 0) return

        const date = new Date()
        if (reExamUnit === 'Ngày') date.setDate(date.getDate() + reExamAmount)
        if (reExamUnit === 'Tuần') date.setDate(date.getDate() + (reExamAmount * 7))
        if (reExamUnit === 'Tháng') date.setMonth(date.getMonth() + reExamAmount)
        if (reExamUnit === 'Năm') date.setFullYear(date.getFullYear() + reExamAmount)

        setReExaminationDate(date.toISOString().split('T')[0])
    }, [reExamAmount, reExamUnit])

    // Load EMR Data
    useEffect(() => {
        const loadEmrData = async () => {
            if (!emrId) return
            setIsLoading(true)
            try {
                // 1. Get EMR details
                const emr = await emrService.getEmrById(emrId)

                // Security check on client side (also checked on backend)
                const currentUser = tokenStorage.getUser()
                if (emr.isLocked) {
                    showToast('warning', 'Bệnh án này đã bị khoá và không thể chỉnh sửa.')
                    navigate(-1)
                    return
                }
                if (currentUser?.userId && String(currentUser.userId) !== emr.vetId) {
                    showToast('error', 'Bạn không có quyền chỉnh sửa bệnh án này.')
                    navigate(-1)
                    return
                }

                // 2. Map EMR data to Form
                setSubjective(emr.subjective || '')
                setObjective({
                    temperature: emr.temperatureC?.toString() || '',
                    heartRate: emr.heartRate?.toString() || '',
                    respRate: '',
                    weight: emr.weightKg?.toString() || '',
                    bcs: emr.bcs ?? null,
                    notes: emr.objective || '',
                })
                setAssessment(emr.assessment || '')
                setPlan(emr.plan || '')
                setNotes(emr.notes || '')
                setPrescriptions(emr.prescriptions || [])
                setImages(emr.images || [])
                if (emr.reExaminationDate) {
                    setReExaminationDate(emr.reExaminationDate.split('T')[0])
                    setHasReExam(true)
                }

                // Check if >24 hours since creation
                if (emr.createdAt) {
                    const createdDate = new Date(emr.createdAt + 'Z') // Basic parsing, might need adjustment
                    const now = new Date()
                    // If createdAt is remarkably old or backend says locked, display warning
                    const hoursDiff = (now.getTime() - createdDate.getTime()) / (1000 * 60 * 60)
                    if (hoursDiff > 24) {
                        setIsExpired(true)
                    }
                }

                // 3. Get Pet Details for Sidebar
                const pet = await petService.getPetById(emr.petId)
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
                    age: ageStr,
                    sex: pet.gender === 'MALE' ? 'Đực' : pet.gender === 'FEMALE' ? 'Cái' : pet.gender || 'N/A',
                    weight: emr.weightKg ? `${emr.weightKg} kg` : (pet.weight ? `${pet.weight} kg` : 'N/A'),
                    color: pet.color || undefined,
                    ownerName: pet.ownerName || 'N/A',
                    ownerPhone: pet.ownerPhone,
                    notes: undefined,
                    imageUrl: pet.imageUrl || undefined,
                    allergies: pet.allergies ? pet.allergies.split(',').map(a => a.trim()) : []
                })

                // Initialize allergies field
                if (pet.allergies) {
                    setAllergies(pet.allergies)
                }

                // 4. Fetch Medical History
                emrService.getEmrsByPetId(pet.id)
                    .then(emrs => {
                        const history = emrs
                            .filter(e => e.id !== emrId) // Exclude current EMR
                            .sort((a, b) => new Date(b.examinationDate).getTime() - new Date(a.examinationDate).getTime())
                            .slice(0, 5) // Last 5 visits
                            .map(e => ({
                                date: new Date(e.examinationDate).toLocaleDateString('vi-VN'),
                                diagnosis: e.assessment || 'N/A'
                            }))
                        setMedicalHistory(history)
                    })
                    .catch(err => console.error('Failed to load history', err))

            } catch (error) {
                console.error('Failed to load EMR:', error)
                showToast('error', 'Không thể tải thông tin bệnh án')
                navigate(-1)
            } finally {
                setIsLoading(false)
            }
        }
        loadEmrData()
    }, [emrId, navigate])

    // --- Form Handlers ---

    const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
        if (!e.target.files?.length) return
        const file = e.target.files[0]
        try {
            const result = await emrService.uploadEmrImage(file)
            setImages([...images, { url: result.url, description: '' }])
        } catch (error) {
            showToast('error', 'Upload ảnh thất bại')
        }
    }

    const removeImage = (index: number) => {
        setImages(images.filter((_, i) => i !== index))
    }

    // Prescription Handlers
    const handleSavePrescription = () => {
        if (!newPrescription.medicineName || !newPrescription.frequency) return

        if (editingPrescriptionIndex !== null) {
            const updated = [...prescriptions]
            updated[editingPrescriptionIndex] = newPrescription
            setPrescriptions(updated)
        } else {
            setPrescriptions([...prescriptions, newPrescription])
        }

        setNewPrescription({ medicineName: '', frequency: '', durationDays: 0, instructions: '' })
        setShowAddPrescription(false)
        setEditingPrescriptionIndex(null)
    }

    const openEditPrescription = (index: number) => {
        setNewPrescription(prescriptions[index])
        setEditingPrescriptionIndex(index)
        setShowAddPrescription(true)
    }

    const handleRemovePrescription = (index: number) => {
        setPrescriptions(prescriptions.filter((_, i) => i !== index))
    }


    const validateForm = () => {
        const newErrors: FieldErrors = {}
        if (!assessment.trim()) newErrors.assessment = 'Vui lòng nhập chẩn đoán (A)'
        if (!plan.trim()) newErrors.plan = 'Vui lòng nhập kế hoạch điều trị (P)'
        setErrors(newErrors)
        return Object.keys(newErrors).length === 0
    }

    const handleSubmit = async () => {
        if (!validateForm() || !emrId || !petInfo) return

        setIsSaving(true)
        try {
            const request: CreateEmrRequest = {
                petId: petInfo.id,
                subjective,
                objective: objective.notes,
                assessment,
                plan,
                notes: notes || undefined,
                weightKg: objective.weight ? parseFloat(objective.weight.replace(',', '.')) : undefined,
                temperatureC: objective.temperature ? parseFloat(objective.temperature.replace(',', '.')) : undefined,
                heartRate: objective.heartRate ? parseInt(objective.heartRate) : undefined,
                bcs: objective.bcs || undefined,
                images,
                prescriptions: prescriptions.length > 0 ? prescriptions : undefined,
                reExaminationDate: hasReExam && reExaminationDate ? `${reExaminationDate}T00:00:00` : undefined
            }

            await emrService.updateEmr(emrId, request)

            // Update pet weight in profile if changed
            if (objective.weight && petInfo) {
                const newWeight = parseFloat(objective.weight.replace(',', '.'))
                try {
                    await petService.updateWeight(petInfo.id, newWeight)
                } catch (weightErr) {
                    console.error('Failed to update pet weight:', weightErr)
                }
            }

            // Update pet allergies
            if (petInfo && allergies !== (petInfo.allergies?.join(', ') || '')) {
                try {
                    await petService.updateAllergies(petInfo.id, allergies);
                } catch (allergyErr) {
                    console.error('Failed to update allergies:', allergyErr);
                }
            }





            showToast('success', 'Cập nhật Bệnh án thành công!')
            navigate(-1)
        } catch (err: any) {
            console.error(err)
            showToast('error', err.response?.data?.message || err.message || 'Có lỗi xảy ra khi lưu')
        } finally {
            setIsSaving(false)
        }
    }

    if (isLoading || !petInfo) {
        return <div className="p-8 text-center text-stone-500">Đang tải bệnh án...</div>
    }

    return (
        <div className="min-h-screen bg-stone-100 p-6">
            <div className="max-w-7xl mx-auto">
                {/* Header */}
                <div className="flex items-center justify-between mb-6">
                    <div className="flex items-center gap-4">
                        <button onClick={() => navigate(-1)} className="p-2 hover:bg-stone-200 rounded-full">
                            <ArrowLeftIcon className="w-6 h-6 text-stone-600" />
                        </button>
                        <h1 className="text-2xl font-black text-stone-800">CHỈNH SỬA BỆNH ÁN (SOAP)</h1>
                    </div>
                </div>

                {/* 24-hour Edit Warning */}
                {isExpired && (
                    <div className="flex items-center gap-3 bg-red-50 border border-red-200 rounded-xl p-4 mb-4">
                        <p className="text-red-800 text-sm font-medium">
                            Đã quá 24h kể từ khi tạo bệnh án. Bạn chỉ có thể xem, không thể chỉnh sửa.
                        </p>
                    </div>
                )}
                {!isExpired && (
                    <div className="flex items-center gap-3 bg-amber-50 border border-amber-200 rounded-xl p-4 mb-4">
                        <p className="text-amber-800 text-sm font-medium">
                            Bạn chỉ có thể chỉnh sửa bệnh án này trong vòng 24h kể từ khi tạo.
                        </p>
                    </div>
                )}


                {/* Main Grid - Matching CreateEmrPage Layout */}
                <div className="grid grid-cols-12 gap-6">

                    {/* ========== LEFT SIDEBAR (Pet Info) [Col-3] ========== */}
                    <div className="col-span-12 lg:col-span-3 space-y-4">
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
                                    <span className="font-semibold text-stone-800">{petInfo.color || 'Không rõ'}</span>
                                </div>
                                <div className="flex justify-between">
                                    <span className="text-stone-500">Giới tính:</span>
                                    <span className="font-semibold text-stone-800">{petInfo.sex}</span>
                                </div>
                                <div className="flex justify-between">
                                    <span className="text-stone-500">Tuổi:</span>
                                    <span className="font-semibold text-stone-800">{petInfo.age}</span>
                                </div>
                                <div className="flex justify-between items-center">
                                    <span className="text-stone-500">Cân nặng (kg):</span>
                                    <input
                                        type="number"
                                        step="0.01"
                                        value={objective.weight}
                                        onChange={(e) => setObjective({ ...objective, weight: e.target.value })}
                                        disabled={isExpired}
                                        className="w-20 text-right font-semibold text-stone-800 border border-stone-300 rounded px-2 py-1 focus:border-amber-500 focus:outline-none disabled:bg-stone-50"
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

                            {/* Allergies - Inside Pet Profile */}
                            <div className="mt-4 pt-4 border-t border-stone-200">
                                <label className="text-stone-500 text-sm font-semibold mb-2 block">
                                    Dị ứng / Lưu ý:
                                </label>
                                <textarea
                                    value={allergies}
                                    onChange={(e) => setAllergies(e.target.value)}
                                    disabled={isExpired}
                                    placeholder="Không có ghi nhận dị ứng."
                                    rows={2}
                                    className="w-full text-sm border border-stone-300 rounded-lg p-2 focus:outline-none focus:border-amber-500 resize-none bg-stone-50 focus:bg-white transition-colors disabled:bg-stone-100"
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

                    {/* ========== CENTER: SOAP Form (S, A, Rx, Images) [Col-5] ========== */}
                    <div className="col-span-12 lg:col-span-5 space-y-4">
                        <div className="bg-white rounded-2xl p-6 shadow-sm">
                            <h2 className="text-xl font-black text-stone-800 mb-6">Biểu mẫu SOAP</h2>

                            {/* S - Subjective */}
                            <div className="mb-6">
                                <h3 className="font-bold text-amber-700 mb-1">S - Chủ quan (Subjective)</h3>
                                <p className="text-xs text-stone-400 mb-2">Ghi triệu chứng theo lời kể của chủ nuôi</p>
                                <textarea
                                    value={subjective}
                                    onChange={e => setSubjective(e.target.value)}
                                    disabled={isExpired}
                                    className="w-full border border-stone-300 rounded-lg p-3 text-sm focus:outline-none focus:border-amber-500 disabled:bg-stone-50 disabled:text-stone-400"
                                    placeholder="Lý do đến khám, biểu hiện lâm sàng..."
                                    rows={3}
                                />
                            </div>

                            {/* A - Assessment */}
                            <div className="mb-6">
                                <h3 className="font-bold text-amber-700 mb-2">
                                    A - Đánh giá (Assessment) <span className="text-red-500">*</span>
                                </h3>
                                <textarea
                                    value={assessment}
                                    onChange={e => setAssessment(e.target.value)}
                                    disabled={isExpired}
                                    className={`w-full border rounded-lg p-3 text-sm focus:outline-none focus:border-amber-500 disabled:bg-stone-50 disabled:text-stone-400 ${errors.assessment ? 'border-red-500' : 'border-stone-300'}`}
                                    placeholder="Kết luận chẩn đoán..."
                                    rows={3}
                                />
                                {errors.assessment && <p className="text-red-500 text-xs mt-1">{errors.assessment}</p>}
                            </div>
                        </div>

                        {/* Prescription Table */}
                        <div className="bg-white rounded-2xl p-6 shadow-sm">
                            <h3 className="font-bold text-stone-700 mb-4">Kê đơn Thuốc</h3>

                            {prescriptions.length > 0 ? (
                                <div className="border border-stone-200 rounded-xl overflow-hidden mb-4">
                                    {/* Table Header */}
                                    <div className="grid grid-cols-12 gap-2 p-3 bg-stone-50 border-b border-stone-100 text-xs font-bold text-stone-500 uppercase tracking-wide">
                                        <div className="col-span-4 pl-1">Tên thuốc</div>
                                        <div className="col-span-2">Liều lượng</div>
                                        <div className="col-span-2">Tần suất</div>
                                        <div className="col-span-2 text-center">Thời gian</div>
                                        <div className="col-span-2 text-right pr-2">Chỉ định</div>
                                    </div>
                                    {/* Table Body */}
                                    <div className="divide-y divide-stone-100 bg-white">
                                        {prescriptions.map((p, i) => (
                                            <div
                                                key={i}
                                                onClick={() => !isExpired && openEditPrescription(i)}
                                                className={`grid grid-cols-12 gap-2 p-3 items-center text-xs text-stone-600 group ${isExpired ? '' : 'hover:bg-amber-50 cursor-pointer'}`}
                                            >
                                                <div className="col-span-4 font-bold text-stone-700 truncate pl-1" title={p.medicineName}>{p.medicineName}</div>
                                                <div className="col-span-2 truncate" title={p.dosage}>{p.dosage || '-'}</div>
                                                <div className="col-span-2 truncate" title={p.frequency}>{p.frequency}</div>
                                                <div className="col-span-2 text-center whitespace-nowrap">{p.durationDays} ngày</div>
                                                <div className="col-span-2 text-right pr-2 flex justify-end">
                                                    {!isExpired && (
                                                        <button
                                                            onClick={(e) => { e.stopPropagation(); handleRemovePrescription(i); }}
                                                            className="p-1 hover:bg-red-100 text-red-500 rounded transition-colors"
                                                            title="Xoá thuốc"
                                                        >
                                                            <TrashIcon className="w-4 h-4" />
                                                        </button>
                                                    )}
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            ) : (
                                <div className="text-center py-8 bg-stone-50 rounded-xl border-dashed border-2 border-stone-200 mb-4">
                                    <p className="text-stone-400 text-sm italic mb-2">Chưa có thuốc nào được kê.</p>
                                </div>
                            )}

                            {!isExpired && (
                                <button
                                    onClick={() => {
                                        setNewPrescription({ medicineName: '', frequency: '', durationDays: 0, instructions: '' })
                                        setEditingPrescriptionIndex(null)
                                        setShowAddPrescription(true)
                                    }}
                                    className="w-full py-3 border-2 border-dashed border-stone-300 rounded-xl text-stone-500 font-bold hover:border-amber-500 hover:text-amber-600 hover:bg-amber-50 transition-all flex items-center justify-center gap-2"
                                >
                                    <PlusIcon className="w-5 h-5" />
                                    Thêm thuốc vào đơn
                                </button>
                            )}
                        </div>

                        {/* Images & Documents */}
                        <div className="bg-white rounded-2xl p-6 shadow-sm">
                            <h3 className="font-bold text-stone-700 mb-4">Hình ảnh & Tài liệu</h3>

                            {!isExpired && (
                                <label className="block border-2 border-dashed border-stone-300 rounded-lg p-6 text-center cursor-pointer hover:border-amber-400 transition-colors mb-4">
                                    <PhotoIcon className="w-8 h-8 mx-auto text-stone-400 mb-2" />
                                    <p className="text-sm text-stone-500">Kéo thả hoặc nhấp để tải lên (X-quang, siêu âm...)</p>
                                    <input type="file" accept="image/*" className="hidden" onChange={handleImageUpload} />
                                </label>
                            )}

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
                                            {!isExpired && (
                                                <button
                                                    type="button"
                                                    onClick={() => removeImage(i)}
                                                    className="absolute top-1 right-1 bg-red-500 text-white rounded-full w-6 h-6 flex items-center justify-center text-xs hover:bg-red-600"
                                                >
                                                    ×
                                                </button>
                                            )}
                                        </div>
                                        <input
                                            type="text"
                                            value={img.description || ''}
                                            onChange={(e) => {
                                                const newImages = [...images]
                                                newImages[i] = { ...newImages[i], description: e.target.value }
                                                setImages(newImages)
                                            }}
                                            disabled={isExpired}
                                            placeholder="Mô tả..."
                                            className="w-full text-xs border border-stone-300 rounded px-2 py-1.5 focus:outline-none focus:border-amber-500 disabled:bg-stone-50"
                                        />
                                    </div>
                                ))}
                            </div>
                        </div>

                    </div>

                    {/* ========== RIGHT SIDEBAR (O, P, Notes, ReExam) [Col-4] ========== */}
                    <div className="col-span-12 lg:col-span-4 space-y-4">
                        {/* O - Objective */}
                        <div className="bg-white rounded-2xl p-6 shadow-sm">
                            <h3 className="font-bold text-amber-700 mb-1">O - Khách quan (Objective)</h3>
                            <p className="text-xs text-stone-400 mb-4">Kết quả khám lâm sàng, chỉ số sinh tồn</p>

                            <div className="grid grid-cols-2 gap-3 mb-4">
                                <div>
                                    <label className="text-sm text-stone-500">Nhiệt độ (°C):</label>
                                    <input
                                        type="number"
                                        step="0.1"
                                        value={objective.temperature}
                                        onChange={(e) => setObjective({ ...objective, temperature: e.target.value })}
                                        disabled={isExpired}
                                        className="w-full border border-stone-300 rounded-lg p-2 text-sm mt-1 disabled:bg-stone-50"
                                    />
                                </div>
                                <div>
                                    <label className="text-sm text-stone-500">Nhịp tim (lần/phút):</label>
                                    <input
                                        type="number"
                                        value={objective.heartRate}
                                        onChange={(e) => setObjective({ ...objective, heartRate: e.target.value })}
                                        disabled={isExpired}
                                        className="w-full border border-stone-300 rounded-lg p-2 text-sm mt-1 disabled:bg-stone-50"
                                    />
                                </div>
                            </div>

                            <div className="mb-4">
                                <label className="text-sm text-stone-500 mb-2 block">BCS (Điểm thể trạng 1-9):</label>
                                <div className="flex gap-1 flex-wrap">
                                    {[1, 2, 3, 4, 5, 6, 7, 8, 9].map(score => (
                                        <button
                                            key={score}
                                            type="button"
                                            onClick={() => setObjective({ ...objective, bcs: score })}
                                            disabled={isExpired}
                                            className={`w-8 h-8 rounded-full text-sm font-bold transition-colors disabled:opacity-50 ${objective.bcs === score
                                                ? 'bg-amber-500 text-white'
                                                : 'bg-stone-100 text-stone-600 hover:bg-stone-200'
                                                }`}
                                        >
                                            {score}
                                        </button>
                                    ))}
                                </div>
                                <p className="text-xs text-stone-400 mt-1">1-3: Gầy | 4-5: Bình thường | 6-9: Thừa cân</p>
                            </div>

                            <textarea
                                value={objective.notes}
                                onChange={(e) => setObjective({ ...objective, notes: e.target.value })}
                                disabled={isExpired}
                                placeholder="Kết quả khám lâm sàng chi tiết..."
                                rows={3}
                                className="w-full border border-stone-300 rounded-lg p-3 text-sm focus:outline-none focus:border-amber-500 disabled:bg-stone-50"
                            />
                        </div>

                        {/* P - Plan */}
                        <div className="bg-white rounded-2xl p-6 shadow-sm">
                            <h3 className="font-bold text-amber-700 mb-4">
                                P - Kế hoạch (Plan) <span className="text-red-500">*</span>
                            </h3>
                            <textarea
                                value={plan}
                                onChange={e => setPlan(e.target.value)}
                                disabled={isExpired}
                                placeholder="Kế hoạch điều trị..."
                                rows={4}
                                className={`w-full border rounded-lg p-3 text-sm focus:outline-none focus:border-amber-500 disabled:bg-stone-50 ${errors.plan ? 'border-red-500' : 'border-stone-300'}`}
                            />
                            {errors.plan && <p className="text-red-500 text-xs mt-1">{errors.plan}</p>}
                        </div>

                        {/* Notes */}
                        <div className="bg-white rounded-2xl p-6 shadow-sm">
                            <h3 className="font-bold text-stone-700 mb-2">Ghi chú</h3>
                            <textarea
                                value={notes}
                                onChange={e => setNotes(e.target.value)}
                                disabled={isExpired}
                                placeholder="Ghi chú thêm..."
                                rows={3}
                                className="w-full border border-stone-300 rounded-lg p-3 text-sm focus:outline-none focus:border-amber-500 disabled:bg-stone-50"
                            />
                        </div>

                        {/* Re-examination Date */}
                        <div className="bg-white rounded-2xl p-6 shadow-sm">
                            <div className="flex items-center justify-between mb-4">
                                <h3 className="font-bold text-stone-700 flex items-center gap-2">
                                    <CalendarDaysIcon className="w-5 h-5 text-amber-500" />
                                    Hẹn tái khám
                                </h3>
                                <button
                                    onClick={() => setHasReExam(!hasReExam)}
                                    disabled={isExpired}
                                    className={`relative w-11 h-6 rounded-full transition-colors disabled:opacity-50 ${hasReExam ? 'bg-amber-500' : 'bg-stone-200'}`}
                                >
                                    <span className={`absolute top-1 left-1 bg-white w-4 h-4 rounded-full transition-transform ${hasReExam ? 'translate-x-[22px]' : 'translate-x-0'}`} />
                                </button>
                            </div>

                            {hasReExam && (
                                <div className="space-y-4">
                                    <div className="bg-stone-50 rounded-xl p-4 border border-stone-100">
                                        <label className="text-xs font-bold text-stone-500 uppercase mb-3 block">Ngày cụ thể</label>
                                        <div className="relative group">
                                            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none z-20">
                                                <CalendarIcon className="h-5 w-5 text-amber-400" />
                                            </div>
                                            <DatePicker
                                                selected={reExaminationDate ? new Date(reExaminationDate) : null}
                                                onChange={(date: Date | null) => setReExaminationDate(date ? date.toLocaleDateString('en-CA') : '')}
                                                dateFormat="dd/MM/yyyy"
                                                minDate={new Date()}
                                                locale="vi"
                                                placeholderText="Chọn ngày tái khám"
                                                disabled={isExpired}
                                                className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-stone-200 bg-white text-sm text-amber-700 font-medium focus:outline-none focus:ring-2 focus:ring-amber-500 disabled:bg-stone-50 disabled:text-stone-400"
                                                wrapperClassName="w-full block"
                                                popperClassName="z-[9999]"
                                            />
                                        </div>
                                    </div>
                                    {!isExpired && (
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
                                                            menuPortal: (base) => ({ ...base, zIndex: 9999 }),
                                                        }}
                                                        isSearchable={false}
                                                    />
                                                </div>
                                            </div>
                                        </div>
                                    )}
                                </div>
                            )}
                        </div>
                    </div>
                </div>

                {/* Actions */}
                <div className="flex justify-end gap-4 mt-8 pb-12">
                    <button
                        onClick={() => navigate(-1)}
                        className="px-6 py-3 font-bold text-stone-500 hover:bg-stone-200 rounded-xl transition-colors"
                    >
                        {isExpired ? 'Quay lại' : 'Huỷ bỏ'}
                    </button>
                    {!isExpired && (
                        <button
                            onClick={handleSubmit}
                            disabled={isSaving}
                            className="px-8 py-3 bg-amber-500 text-white font-bold rounded-xl shadow-lg hover:bg-amber-600 transition-all disabled:opacity-50"
                        >
                            {isSaving ? 'ĐANG LƯU...' : 'CẬP NHẬT BỆNH ÁN'}
                        </button>
                    )}
                </div>

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

                {/* Add Prescription Modal */}
                {
                    showAddPrescription && (
                        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
                            <div className="bg-white rounded-2xl p-6 w-full max-w-lg shadow-2xl">
                                <div className="flex items-center justify-between mb-6">
                                    <h3 className="text-xl font-black text-stone-800">THÊM ĐƠN THUỐC</h3>
                                    <button onClick={() => setShowAddPrescription(false)} className="text-stone-400 hover:text-stone-600">✕</button>
                                </div>

                                <div className="grid grid-cols-2 gap-4 mb-4">
                                    <div>
                                        <label className="text-sm font-semibold text-stone-700">Tên thuốc*</label>
                                        <input
                                            type="text"
                                            list="medicine-list"
                                            value={newPrescription.medicineName || ''}
                                            onChange={(e) => setNewPrescription({ ...newPrescription, medicineName: e.target.value })}
                                            placeholder="Amoxicillin 250mg"
                                            className="w-full border border-stone-300 rounded-lg p-3 mt-1"
                                        />
                                        <datalist id="medicine-list">
                                            <option value="Amoxicillin 500mg" />
                                            <option value="Metronidazole 250mg" />
                                            <option value="Doxycycline 100mg" />
                                            <option value="Prednisone 5mg" />
                                        </datalist>
                                    </div>
                                    <div>
                                        <label className="text-sm font-semibold text-stone-700">Liều lượng</label>
                                        <input
                                            type="text"
                                            value={newPrescription.dosage || ''}
                                            onChange={(e) => setNewPrescription({ ...newPrescription, dosage: e.target.value })}
                                            placeholder="VD: 1 viên"
                                            className="w-full border border-stone-300 rounded-lg p-3 mt-1"
                                        />
                                    </div>
                                    <div>
                                        <label className="text-sm font-semibold text-stone-700">Số lần/ngày*</label>
                                        <input
                                            type="text"
                                            value={newPrescription.frequency || ''}
                                            onChange={(e) => setNewPrescription({ ...newPrescription, frequency: e.target.value })}
                                            placeholder="VD: 2 lần/ngày"
                                            className="w-full border border-stone-300 rounded-lg p-3 mt-1"
                                        />
                                    </div>
                                    <div>
                                        <label className="text-sm font-semibold text-stone-700">Số ngày</label>
                                        <input
                                            type="number"
                                            value={newPrescription.durationDays || ''}
                                            onChange={(e) => setNewPrescription({ ...newPrescription, durationDays: parseInt(e.target.value) || undefined })}
                                            placeholder="VD: 7"
                                            className="w-full border border-stone-300 rounded-lg p-3 mt-1"
                                        />
                                    </div>
                                </div>

                                <div className="mb-6">
                                    <label className="text-sm font-semibold text-stone-700">Hướng dẫn sử dụng</label>
                                    <textarea
                                        value={newPrescription.instructions || ''}
                                        onChange={(e) => setNewPrescription({ ...newPrescription, instructions: e.target.value })}
                                        placeholder="Ghi chú, lưu ý đặc biệt..."
                                        rows={3}
                                        className="w-full border border-stone-300 rounded-lg p-3 mt-1"
                                    />
                                </div>

                                <div className="flex justify-end gap-3">
                                    <button
                                        onClick={() => setShowAddPrescription(false)}
                                        className="px-4 py-2 text-stone-500 font-bold hover:bg-stone-100 rounded-lg"
                                    >
                                        Huỷ
                                    </button>
                                    <button
                                        onClick={handleSavePrescription}
                                        className="px-6 py-2 bg-amber-500 text-white font-bold rounded-lg hover:bg-amber-600 shadow-md"
                                    >
                                        {editingPrescriptionIndex !== null ? 'Cập nhật' : 'Thêm'}
                                    </button>
                                </div>
                            </div>
                        </div>
                    )
                }
            </div>
        </div>
    )
}
