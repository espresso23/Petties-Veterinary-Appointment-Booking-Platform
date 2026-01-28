import { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import {
    ArrowLeftIcon,
    CameraIcon,
    TrashIcon,
    PlusIcon,
    CalendarDaysIcon,
    CalendarIcon,
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
    const [reExaminationDate, setReExaminationDate] = useState<string>('')
    const [reExamAmount, setReExamAmount] = useState(1)
    const [reExamUnit, setReExamUnit] = useState('Tuần')
    const [hasReExam, setHasReExam] = useState(false)

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
                if (currentUser?.userId && String(currentUser.userId) !== emr.staffId) {
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
                    const createdDate = new Date(emr.createdAt + 'Z')
                    const now = new Date()
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
                    imageUrl: pet.imageUrl || undefined
                })

                // 4. Get History (Optional)
                // For now, skip re-fetching history to keep it simple, or fetch if needed
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

    // --- Form Handlers (Similar to CreateEmrPage) ---

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

    const addPrescription = () => {
        setPrescriptions([...prescriptions, { medicineName: '', dosage: '', frequency: '2 lần/ngày', durationDays: 3, instructions: 'Uống sau ăn' }])
    }

    const removePrescription = (index: number) => {
        setPrescriptions(prescriptions.filter((_, i) => i !== index))
    }

    const updatePrescription = (index: number, field: string, value: any) => {
        const newPrescriptions = [...prescriptions]
        newPrescriptions[index] = { ...newPrescriptions[index], [field]: value }
        setPrescriptions(newPrescriptions)
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
            // Construct full objective string from fields


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
                    // Don't block EMR save if weight update fails
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
                <div className="flex items-center gap-3 bg-amber-50 border border-amber-200 rounded-xl p-4 mb-4">
                    <p className="text-amber-800 text-sm font-medium">
                        {isExpired
                            ? 'Đã quá 24h kể từ khi tạo bệnh án. Bạn chỉ có thể xem, không thể chỉnh sửa.'
                            : 'Bạn chỉ có thể chỉnh sửa bệnh án này trong vòng 24h kể từ khi tạo.'
                        }
                    </p>
                </div>

                <div className="grid grid-cols-12 gap-6">
                    {/* LEFT SIDEBAR: Pet Info */}
                    <div className="col-span-3 space-y-4">
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
                                {petInfo.color && (
                                    <div className="flex justify-between">
                                        <span className="text-stone-500">Màu lông:</span>
                                        <span className="font-semibold text-stone-800">{petInfo.color}</span>
                                    </div>
                                )}
                                <div className="flex justify-between">
                                    <span className="text-stone-500">Tuổi / Giới tính:</span>
                                    <span className="font-semibold text-stone-800">{petInfo.age} / {petInfo.sex}</span>
                                </div>
                                <div className="flex justify-between">
                                    <span className="text-stone-500">Chủ nuôi:</span>
                                    <span className="font-semibold text-stone-800">{petInfo.ownerName}</span>
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* MAIN FORM */}
                    <div className="col-span-9 space-y-6">
                        {/* SOAP Form */}
                        <div className="bg-white rounded-2xl p-8 shadow-sm space-y-8">
                            {/* S - Subjective */}
                            <div>
                                <h3 className="text-lg font-bold text-amber-700 mb-4 flex items-center gap-2">
                                    <span>S - Subjective (Chủ quan)</span>
                                </h3>
                                <textarea
                                    value={subjective}
                                    onChange={e => setSubjective(e.target.value)}
                                    disabled={isExpired}
                                    className="w-full p-4 border border-stone-200 rounded-xl focus:ring-2 focus:ring-amber-500 focus:border-amber-500 min-h-[100px] disabled:bg-stone-50 disabled:text-stone-500"
                                    placeholder="Lý do đến khám, biểu hiện lâm sàng..."
                                />
                            </div>

                            {/* O - Objective */}
                            <div>
                                <h3 className="text-lg font-bold text-amber-700 mb-4">O - Objective (Khách quan)</h3>
                                <div className="grid grid-cols-4 gap-4 mb-4">
                                    <div>
                                        <label className="text-xs font-bold text-stone-500 uppercase">Cân nặng (kg)</label>
                                        <input
                                            type="text"
                                            value={objective.weight}
                                            onChange={e => setObjective({ ...objective, weight: e.target.value })}
                                            disabled={isExpired}
                                            className="w-full p-2 border border-stone-200 rounded-lg disabled:bg-stone-50 disabled:text-stone-500"
                                        />
                                    </div>
                                    <div>
                                        <label className="text-xs font-bold text-stone-500 uppercase">Nhiệt độ (°C)</label>
                                        <input
                                            type="text"
                                            value={objective.temperature}
                                            onChange={e => setObjective({ ...objective, temperature: e.target.value })}
                                            disabled={isExpired}
                                            className="w-full p-2 border border-stone-200 rounded-lg disabled:bg-stone-50 disabled:text-stone-500"
                                        />
                                    </div>
                                    <div>
                                        <label className="text-xs font-bold text-stone-500 uppercase">Nhịp tim (lần/phút)</label>
                                        <input
                                            type="text"
                                            value={objective.heartRate}
                                            onChange={e => setObjective({ ...objective, heartRate: e.target.value })}
                                            disabled={isExpired}
                                            className="w-full p-2 border border-stone-200 rounded-lg disabled:bg-stone-50 disabled:text-stone-500"
                                        />
                                    </div>
                                </div>
                                {/* BCS as circular buttons */}
                                <div className="mb-4">
                                    <label className="text-xs font-bold text-stone-500 uppercase block mb-2">BCS (Điểm thể trạng 1-9)</label>
                                    <div className="flex gap-2 items-center">
                                        {[1, 2, 3, 4, 5, 6, 7, 8, 9].map(n => (
                                            <button
                                                key={n}
                                                type="button"
                                                disabled={isExpired}
                                                onClick={() => setObjective({ ...objective, bcs: n })}
                                                className={`w-9 h-9 rounded-full font-bold text-sm transition-all ${objective.bcs === n
                                                    ? 'bg-amber-500 text-white shadow-md'
                                                    : 'bg-stone-100 text-stone-600 hover:bg-stone-200'
                                                    } disabled:opacity-50 disabled:cursor-not-allowed`}
                                            >
                                                {n}
                                            </button>
                                        ))}
                                    </div>
                                    <p className="text-xs text-stone-400 mt-1">1-3: Gầy | 4-5: Bình thường | 6-9: Thừa cân</p>
                                </div>
                                <textarea
                                    value={objective.notes}
                                    onChange={e => setObjective({ ...objective, notes: e.target.value })}
                                    disabled={isExpired}
                                    className="w-full p-4 border border-stone-200 rounded-xl focus:ring-2 focus:ring-amber-500 focus:border-amber-500 min-h-[100px] disabled:bg-stone-50 disabled:text-stone-500"
                                    placeholder="Chi tiết kết quả khám thực thể..."
                                />
                            </div>

                            {/* A - Assessment */}
                            <div>
                                <h3 className="text-lg font-bold text-amber-700 mb-4">A - Assessment (Chẩn đoán) <span className="text-red-500">*</span></h3>
                                <textarea
                                    value={assessment}
                                    onChange={e => setAssessment(e.target.value)}
                                    disabled={isExpired}
                                    className={`w-full p-4 border rounded-xl focus:ring-2 focus:ring-amber-500 min-h-[100px] ${errors.assessment ? 'border-red-500 bg-red-50' : 'border-stone-200'} disabled:bg-stone-50 disabled:text-stone-500`}
                                    placeholder="Kết luận chẩn đoán..."
                                />
                                {errors.assessment && <p className="text-red-500 text-sm mt-1">{errors.assessment}</p>}
                            </div>

                            {/* P - Plan */}
                            <div>
                                <h3 className="text-lg font-bold text-amber-700 mb-4">P - Plan (Điều trị) <span className="text-red-500">*</span></h3>
                                <textarea
                                    value={plan}
                                    onChange={e => setPlan(e.target.value)}
                                    disabled={isExpired}
                                    className={`w-full p-4 border rounded-xl focus:ring-2 focus:ring-amber-500 min-h-[100px] ${errors.plan ? 'border-red-500 bg-red-50' : 'border-stone-200'} disabled:bg-stone-50 disabled:text-stone-500`}
                                    placeholder="Phác đồ điều trị, dặn dò..."
                                />
                                {errors.plan && <p className="text-red-500 text-sm mt-1">{errors.plan}</p>}
                            </div>

                            {/* Notes */}
                            <div>
                                <h3 className="text-lg font-bold text-stone-700 mb-4">Ghi chú</h3>
                                <textarea
                                    value={notes}
                                    onChange={e => setNotes(e.target.value)}
                                    disabled={isExpired}
                                    className="w-full p-4 border border-stone-200 rounded-xl focus:ring-2 focus:ring-amber-500 min-h-[100px] disabled:bg-stone-50 disabled:text-stone-500"
                                    placeholder="Ghi chú thêm về ca khám..."
                                />
                            </div>

                            {/* Re-examination Date */}
                            <div className="bg-white rounded-2xl p-6 shadow-sm border border-stone-100 mb-6">
                                <div className="flex items-center justify-between mb-4">
                                    <div className="flex items-center gap-2">
                                        <CalendarDaysIcon className="w-5 h-5 text-amber-500" />
                                        <h3 className="font-bold text-stone-700">Hẹn tái khám</h3>
                                    </div>
                                    {/* Toggle Switch */}
                                    <button
                                        type="button"
                                        onClick={() => setHasReExam(!hasReExam)}
                                        disabled={isExpired}
                                        className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-amber-500 focus:ring-offset-2 disabled:opacity-50 ${hasReExam ? 'bg-amber-500' : 'bg-stone-300'
                                            }`}
                                    >
                                        <span
                                            className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${hasReExam ? 'translate-x-6' : 'translate-x-1'
                                                }`}
                                        />
                                    </button>
                                </div>

                                {hasReExam && (
                                    <div className="space-y-4">
                                        {/* Date Picker */}
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
                                                    disabled={isExpired}
                                                    className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-stone-200 bg-white text-sm text-amber-700 font-medium focus:outline-none focus:ring-2 focus:ring-amber-500 focus:border-transparent transition-all shadow-sm hover:border-amber-200 cursor-pointer disabled:bg-stone-100 disabled:text-stone-400"
                                                    wrapperClassName="w-full block"
                                                    popperClassName="z-[9999]"
                                                />
                                            </div>
                                        </div>

                                        {/* Duration Input */}
                                        <div className="bg-stone-50 rounded-xl p-4 border border-stone-100">
                                            <label className="text-xs font-bold text-stone-500 uppercase mb-3 block">Hoặc sau khoảng</label>
                                            <div className="flex gap-2 items-center">
                                                <input
                                                    type="number"
                                                    min="1"
                                                    value={reExamAmount}
                                                    onChange={(e) => setReExamAmount(parseInt(e.target.value) || 0)}
                                                    disabled={isExpired}
                                                    className="w-20 py-2.5 px-3 text-center font-bold text-sm text-amber-700 focus:outline-none border border-stone-200 bg-white rounded-xl focus:ring-2 focus:ring-amber-500 disabled:bg-stone-100 disabled:text-stone-400"
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
                                                        isDisabled={isExpired}
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
                                )}
                            </div>

                            {/* Prescriptions */}
                            <div>
                                <h3 className="text-lg font-bold text-stone-700 mb-4 flex justify-between items-center">
                                    <span>Đơn thuốc</span>
                                    {!isExpired && (
                                        <button onClick={addPrescription} type="button" className="text-sm text-blue-600 flex items-center gap-1 font-bold">
                                            <PlusIcon className="w-4 h-4" /> Thêm thuốc
                                        </button>
                                    )}
                                </h3>
                                {prescriptions.length > 0 ? (
                                    <div className="space-y-3">
                                        <div className="grid grid-cols-12 gap-2 text-xs font-bold text-stone-500 mb-2 px-3">
                                            <div className="col-span-3">Tên thuốc</div>
                                            <div className="col-span-2">Liều lượng</div>
                                            <div className="col-span-2">Số lần/ngày</div>
                                            <div className="col-span-1">Số ngày</div>
                                            <div className="col-span-3">Hướng dẫn sử dụng</div>
                                            <div className="col-span-1"></div>
                                        </div>
                                        {prescriptions.map((p, idx) => (
                                            <div key={idx} className="grid grid-cols-12 gap-2 items-start bg-stone-50 p-3 rounded-lg border border-stone-200">
                                                <div className="col-span-3">
                                                    <input
                                                        placeholder="Amoxicillin..."
                                                        disabled={isExpired}
                                                        className="w-full p-2 border rounded disabled:bg-stone-50 disabled:text-stone-500"
                                                        value={p.medicineName}
                                                        onChange={e => updatePrescription(idx, 'medicineName', e.target.value)}
                                                    />
                                                </div>
                                                <div className="col-span-2">
                                                    <input
                                                        placeholder="VD: 1 viên"
                                                        disabled={isExpired}
                                                        className="w-full p-2 border rounded disabled:bg-stone-50 disabled:text-stone-500"
                                                        value={p.dosage || ''}
                                                        onChange={e => updatePrescription(idx, 'dosage', e.target.value)}
                                                    />
                                                </div>
                                                <div className="col-span-2">
                                                    <input
                                                        placeholder="VD: 2 lần/ngày"
                                                        disabled={isExpired}
                                                        className="w-full p-2 border rounded disabled:bg-stone-50 disabled:text-stone-500"
                                                        value={p.frequency}
                                                        onChange={e => updatePrescription(idx, 'frequency', e.target.value)}
                                                    />
                                                </div>
                                                <div className="col-span-1">
                                                    <input
                                                        type="number"
                                                        placeholder="7"
                                                        disabled={isExpired}
                                                        className="w-full p-2 border rounded disabled:bg-stone-50 disabled:text-stone-500"
                                                        value={p.durationDays || ''}
                                                        onChange={e => updatePrescription(idx, 'durationDays', parseInt(e.target.value) || 0)}
                                                    />
                                                </div>
                                                <div className="col-span-3">
                                                    <input
                                                        placeholder="Ghi chú..."
                                                        disabled={isExpired}
                                                        className="w-full p-2 border rounded disabled:bg-stone-50 disabled:text-stone-500"
                                                        value={p.instructions}
                                                        onChange={e => updatePrescription(idx, 'instructions', e.target.value)}
                                                    />
                                                </div>
                                                <div className="col-span-1 flex justify-center">
                                                    {!isExpired && (
                                                        <button onClick={() => removePrescription(idx)} className="p-2 text-red-500 hover:bg-stone-200 rounded">
                                                            <TrashIcon className="w-5 h-5" />
                                                        </button>
                                                    )}
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                ) : (
                                    <p className="text-stone-400 text-sm italic">Chưa có đơn thuốc</p>
                                )}
                            </div>

                            {/* Images */}
                            <div>
                                <h3 className="text-lg font-bold text-stone-700 mb-4">Hình ảnh lâm sàng</h3>
                                <div className="flex flex-wrap gap-4">
                                    {images.map((img, idx) => (
                                        <div key={idx} className="border border-stone-200 rounded-lg p-2 w-fit">
                                            <div className="relative mb-2">
                                                <img
                                                    src={img.url}
                                                    alt="EMR"
                                                    className="h-32 w-auto mx-auto rounded-lg cursor-pointer hover:opacity-75 transition-opacity"
                                                    onClick={() => setPreviewImage(img)}
                                                />
                                                {!isExpired && (
                                                    <button
                                                        type="button"
                                                        onClick={() => removeImage(idx)}
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
                                                    newImages[idx] = { ...newImages[idx], description: e.target.value }
                                                    setImages(newImages)
                                                }}
                                                placeholder="Mô tả hình ảnh..."
                                                disabled={isExpired}
                                                className="w-full text-xs border border-stone-300 rounded px-2 py-1.5 focus:outline-none focus:border-blue-500 disabled:bg-stone-50 disabled:text-stone-500"
                                            />
                                        </div>
                                    ))}
                                    {!isExpired && (
                                        <label className="flex flex-col items-center justify-center border-2 border-dashed border-stone-300 rounded-lg cursor-pointer hover:border-blue-500 hover:bg-blue-50 transition-colors h-32">
                                            <CameraIcon className="w-8 h-8 text-stone-400" />
                                            <span className="text-xs text-stone-500 mt-1">Thêm ảnh</span>
                                            <input type="file" hidden accept="image/*" onChange={handleImageUpload} />
                                        </label>
                                    )}
                                </div>
                            </div>
                        </div>

                        {/* Actions */}
                        <div className="flex justify-end gap-4 pb-12">
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
                                    className="px-8 py-3 bg-gradient-to-r from-blue-600 to-indigo-600 text-white font-bold rounded-xl shadow-lg hover:shadow-xl hover:scale-105 transition-all disabled:opacity-50 disabled:scale-100"
                                >
                                    {isSaving ? 'Đang lưu...' : 'Cập nhật Bệnh án'}
                                </button>
                            )}
                        </div>
                    </div>
                </div>
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
        </div >
    )
}


