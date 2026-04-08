import { useState, useEffect, useRef, useCallback } from 'react'
import { useToast } from '../../../components/Toast'
import { useNavigate, useParams, useSearchParams } from 'react-router-dom'
import {
    PlusIcon,
    TrashIcon,
    PhotoIcon,
    CalendarDaysIcon,
    XMarkIcon,
    SparklesIcon,
} from '@heroicons/react/24/outline'
import { ConfirmModal } from '../../../components/ConfirmModal'
import { Modal } from '../../../components/Modal'
import { AIDiagnosisPanel } from '../../../components/emr/AIDiagnosisPanel'
import { AISuggestionInlineCard } from '../../../components/emr/AISuggestionInlineCard'
import { emrService } from '../../../services/emrService'
import { petService, type PetHealthSummary } from '../../../services/api/petService'
import { useAIChatStore } from '../../../store/aiChatStore'
import { useMembershipStore } from '../../../store/membershipStore'
import DatePicker, { registerLocale } from "react-datepicker";
import "react-datepicker/dist/react-datepicker.css";
import { vi } from 'date-fns/locale';
import Select from 'react-select';
import type { StaffDiagnosisResponse } from '../../../services/agentService'
import { buildEmrAiDiagnosisContext } from '../../../utils/emrAiDiagnosisContext'

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
    general?: string
    subjective?: string
    objective?: string
    assessment?: string
    plan?: string
    temperature?: string
    prescriptions?: string
    images?: string
}

interface UploadingImageItem {
    name: string
    status: 'waiting' | 'uploading' | 'done' | 'error'
    error?: string
}

interface PendingImageItem {
    file: File
    previewUrl: string
    description: string
}

const formatSummaryDate = (date?: string) => {
    if (!date) return 'Không rõ'
    return new Date(date).toLocaleDateString('vi-VN')
}

// ============= COMPONENT =============
export const CreateEmrPage = () => {
    const navigate = useNavigate()
    const { petId } = useParams<{ petId: string }>()
    const [searchParams] = useSearchParams()
    const bookingId = searchParams.get('bookingId')
    const bookingCode = searchParams.get('bookingCode')
    const { showToast } = useToast()
    const setAiChatDraft = useAIChatStore((state) => state.setEmrDraft)
    const isVipClinic = useMembershipStore((state) => state.isVIP())

    // State for pet info (loaded from API)
    const [petInfo, setPetInfo] = useState<PetInfo | null>(null)
    const [isLoadingPet, setIsLoadingPet] = useState(true)
    const [medicalHistory, setMedicalHistory] = useState<EmrRecord[]>([])
    const [healthSummary, setHealthSummary] = useState<PetHealthSummary | null>(null)
    const [isSummarizingHistory, setIsSummarizingHistory] = useState(false)
    const [showHistorySummaryPopover, setShowHistorySummaryPopover] = useState(false)

    // Load pet info from API
    useEffect(() => {
        let isMounted = true

        if (petId) {
            setIsLoadingPet(true)
            Promise.all([
                petService.getPetById(petId),
                emrService.getEmrsByPetId(petId).catch(() => []),
            ]).then(([pet, emrs]) => {
                if (!isMounted) return  // Prevent state update on unmounted component

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
                setMedicalHistory((emrs as EmrRecord[]).slice(0, 3))
            }).catch(err => {
                console.error('Error loading pet:', err)
            }).finally(() => {
                if (isMounted) setIsLoadingPet(false)
            })
        }

        return () => {
            isMounted = false
        }
    }, [petId])

    const handleGenerateHealthSummary = async () => {
        if (!isVipClinic) return
        if (!petId) return

        setIsSummarizingHistory(true)
        try {
            const summary = await petService.getHealthSummary(petId)
            setHealthSummary(summary)
            showToast('success', 'Đã tổng hợp tất cả bệnh án gần đây.')
        } catch (err) {
            console.error('Failed to generate health summary:', err)
            showToast('error', 'Không thể tổng hợp bệnh án gần đây. Vui lòng thử lại.')
        } finally {
            setIsSummarizingHistory(false)
        }
    }

    const handleToggleHistorySummary = async () => {
        if (!isVipClinic) return
        if (showHistorySummaryPopover) {
            setShowHistorySummaryPopover(false)
            return
        }

        if (!healthSummary && !isSummarizingHistory) {
            await handleGenerateHealthSummary()
        }

        setShowHistorySummaryPopover(true)
    }

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
    const [aiDiagnosisResult, setAiDiagnosisResult] = useState<StaffDiagnosisResponse | null>(null)
    const [selectedAiDiagnosis, setSelectedAiDiagnosis] = useState<{ displayName: string; canonicalCode?: string | null } | null>(null)
    const [isAiModalOpen, setIsAiModalOpen] = useState(false)
    const [aiAnalyzeSignal, setAiAnalyzeSignal] = useState(0)
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
    const [pendingImages, setPendingImages] = useState<PendingImageItem[]>([])
    const [uploadingImages, setUploadingImages] = useState<UploadingImageItem[]>([])
    const pendingImagesRef = useRef<PendingImageItem[]>([])
    const [isLoading, setIsLoading] = useState(false)
    const [errors, setErrors] = useState<FieldErrors>({})
    const [previewImage, setPreviewImage] = useState<EmrImage | null>(null)
    const [currentStep, setCurrentStep] = useState<1 | 2>(1)
    const mealLabel = (value?: string) => (value === 'BEFORE_MEAL' ? 'Trước ăn' : 'Sau ăn')
    const timeLabel = (value: string) => ({ sang: 'Sáng', trua: 'Trưa', chieu: 'Chiều' }[value] || value)
    const [isAiAnalyzing, setIsAiAnalyzing] = useState(false)

    // Prescription modal
    const [showPrescriptionModal, setShowPrescriptionModal] = useState(false)
    const [showResetConfirm, setShowResetConfirm] = useState(false)
    const [tempPrescriptions, setTempPrescriptions] = useState<Prescription[]>([])
    const isUploadingImages = uploadingImages.some((item) => item.status === 'waiting' || item.status === 'uploading')
    const hasImageUploadErrors = uploadingImages.some((item) => item.status === 'error')
    const uploadedImagesCount = uploadingImages.filter((item) => item.status === 'done').length
    const shouldShowImageUploadStatus = isUploadingImages || hasImageUploadErrors

    useEffect(() => {
        const bodyClass = 'emr-prescription-modal-open'
        if (showPrescriptionModal) {
            document.body.classList.add(bodyClass)
        } else {
            document.body.classList.remove(bodyClass)
        }

        return () => {
            document.body.classList.remove(bodyClass)
        }
    }, [showPrescriptionModal])

    // Initialize fields when petInfo loads
    useEffect(() => {
        if (petInfo) {
            if (petInfo.allergies) setAllergies(petInfo.allergies.join(', '))
        }
    }, [petInfo])

    // Prescription Modal Handlers (Internal to Modal)
    const handleOpenPrescriptionModal = () => {
        setTempPrescriptions(
            prescriptions.length > 0
                ? [...prescriptions]
                : [
                    {
                        medicineName: '',
                        timesOfDay: [],
                        beforeAfterMeal: 'AFTER_MEAL',
                        durationDays: 0,
                        instructions: '',
                    },
                ]
        )
        setShowPrescriptionModal(true)
    }

    const handleAddPrescriptionRow = () => {
        setTempPrescriptions([
            ...tempPrescriptions,
            {
                medicineName: '',
                timesOfDay: [],
                beforeAfterMeal: 'AFTER_MEAL',
                durationDays: 0,
                instructions: '',
            },
        ])
    }

    const handleUpdatePrescription = (index: number, field: keyof Prescription, value: unknown) => {
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
        const files = Array.from(e.target.files || [])
        if (files.length === 0) return

        setErrors(prev => ({ ...prev, general: undefined, images: undefined }))

        const newPendingImages = files.map((file) => ({
            file,
            previewUrl: URL.createObjectURL(file),
            description: '',
        }))

        setPendingImages(prev => [...prev, ...newPendingImages])

        showToast('info', `Đã chọn ${files.length} ảnh. Ảnh sẽ được tải lên khi lưu bệnh án.`)
        e.target.value = ''
    }

    // Upload pending images to Cloudinary
    const uploadPendingImages = async (): Promise<EmrImage[]> => {
        const uploadedImages: EmrImage[] = []

        for (const pendingImage of pendingImages) {
            try {
                const result = await emrService.uploadEmrImage(pendingImage.file)
                uploadedImages.push({
                    url: result.url,
                    description: pendingImage.description.trim() || undefined,
                })
            } catch (err) {
                console.error('Upload error:', err)
                throw err
            }
        }

        return uploadedImages
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

            // Upload pending images first (if any)
            let allImages = [...images]
            if (pendingImages.length > 0) {
                setUploadingImages(pendingImages.map((item) => ({
                    name: item.file.name,
                    status: 'uploading' as const,
                })))

                try {
                    const uploadedImages = await uploadPendingImages()
                    allImages = [...allImages, ...uploadedImages]
                    setUploadingImages(pendingImages.map((item) => ({
                        name: item.file.name,
                        status: 'done' as const,
                    })))
                } catch (uploadErr) {
                    setErrors(prev => ({
                        ...prev,
                        general: `Có lỗi khi tải ảnh: ${uploadErr instanceof Error ? uploadErr.message : 'Không thể tải ảnh lên'}`,
                    }))
                    setIsLoading(false)
                    return
                }
            }

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
                images: allImages,


                reExaminationDate: hasReExam ? (reExaminationDate ? `${reExaminationDate}T00:00:00` : undefined) : undefined,
                examinationDate,
                aiDiagnosisContext: isVipClinic
                    ? buildEmrAiDiagnosisContext(aiDiagnosisResult, selectedAiDiagnosis)
                    : undefined,
            }

            await emrService.createEmr(request)
            pendingImages.forEach((item) => URL.revokeObjectURL(item.previewUrl))
            setPendingImages([])

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
        } catch (err) {
            // Parse backend error to show at correct field
            const errorMsg = (err as { response?: { data?: { message?: string } } })?.response?.data?.message || ''
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

    const handleApplyAiDraft = (field: 'subjective' | 'objective' | 'assessment' | 'plan', value: string) => {
        if (!value?.trim()) return
        switch (field) {
            case 'subjective':
                setSubjective(value)
                break
            case 'objective':
                setObjective(value)
                break
            case 'assessment':
                setAssessment(value)
                if (errors.assessment) setErrors(prev => ({ ...prev, assessment: undefined }))
                break
            case 'plan':
                setPlan(value)
                if (errors.plan) setErrors(prev => ({ ...prev, plan: undefined }))
                break
            default:
                break
        }
        showToast('success', `Đã chèn gợi ý vào ${field.toUpperCase()}`)
    }

    const handleApplyAiPrescriptions = () => {
        if (!aiDiagnosisResult?.prescription_suggestions?.length) return

        const nextPrescriptions: Prescription[] = aiDiagnosisResult.prescription_suggestions.map((item) => ({
            medicineName: item.medicine_name,
            timesOfDay: (item.times_of_day || item.timesOfDay || []) as Prescription['timesOfDay'],
            beforeAfterMeal: (item.before_after_meal || item.beforeAfterMeal || 'AFTER_MEAL') as Prescription['beforeAfterMeal'],
            durationDays: item.duration_days || item.durationDays || 0,
            instructions: item.instructions || item.caution || '',
        }))

        setPrescriptions(nextPrescriptions)
        showToast('success', 'Đã áp dụng đơn thuốc nháp từ AI.')
    }

    const handleSelectAiDiagnosis = (diagnosis: { displayName: string; canonicalCode?: string | null }) => {
        if (!diagnosis.displayName.trim()) return
        setSelectedAiDiagnosis(diagnosis)
        setAssessment(diagnosis.displayName)
        if (errors.assessment) setErrors(prev => ({ ...prev, assessment: undefined }))
        setIsAiModalOpen(false)
        showToast('success', 'Đã chọn chẩn đoán từ AI.')
    }

    const handleOpenAiModal = () => {
        if (!isVipClinic) return
        if (aiDiagnosisResult) {
            setIsAiModalOpen(true)
        } else {
            setIsAiModalOpen(true)
            setAiAnalyzeSignal((prev) => prev + 1)
        }
    }

    const handleCloseAiModal = () => {
        if (isAiAnalyzing) {
            showToast('info', 'AI đang xử lý dữ liệu. Vui lòng chờ hoàn tất trước khi đóng.')
            return
        }
        setIsAiModalOpen(false)
    }

    const stepItems = [
        { id: 1 as const, title: 'Bước 1', label: 'Khám lâm sàng' },
        { id: 2 as const, title: 'Bước 2', label: 'Kết luận & Điều trị' },
    ]

    const goToNextStep = () => setCurrentStep((prev) => (prev < 2 ? ((prev + 1) as 1 | 2) : prev))
    const goToPreviousStep = () => setCurrentStep((prev) => (prev > 1 ? ((prev - 1) as 1 | 2) : prev))

    const handleAddSingleAiPrescription = (index: number) => {
        const suggestion = aiDiagnosisResult?.prescription_suggestions?.[index]
        if (!suggestion) return

        setPrescriptions((prev) => [
            ...prev,
            {
                medicineName: suggestion.medicine_name,
                timesOfDay: (suggestion.times_of_day || suggestion.timesOfDay || []) as Prescription['timesOfDay'],
                beforeAfterMeal: (suggestion.before_after_meal || suggestion.beforeAfterMeal || 'AFTER_MEAL') as Prescription['beforeAfterMeal'],
                durationDays: suggestion.duration_days || suggestion.durationDays || 0,
                instructions: suggestion.instructions || suggestion.caution || '',
            },
        ])
        showToast('success', `Đã thêm ${suggestion.medicine_name} vào đơn thuốc.`)
    }

    const renderPrescriptionCard = () => (
        <div className="relative min-w-0 overflow-hidden rounded-2xl bg-white p-4 shadow-sm sm:p-5">
            <div className="mb-4 flex flex-wrap items-start justify-between gap-2">
                <div className="min-w-0 flex items-center gap-2">
                    <span className="h-6 w-1 rounded-full bg-orange-600"></span>
                    <div className="min-w-0">
                        <h2 className="break-words text-base font-bold uppercase tracking-tight text-orange-800">ĐƠN THUỐC ĐIỀU TRỊ</h2>
                        <p className="mt-0.5 text-[10px] font-medium uppercase tracking-widest text-stone-400">Danh mục thuốc được chỉ định</p>
                    </div>
                </div>
                <button
                    onClick={handleOpenPrescriptionModal}
                    className="w-full rounded-lg border border-orange-200 bg-orange-50 px-3 py-1.5 text-[11px] font-bold text-orange-700 transition-all hover:bg-orange-100 active:scale-95 sm:w-auto"
                >
                    {prescriptions.length > 0 ? 'CHỈNH SỬA ĐƠN' : 'KÊ ĐƠN NGAY'}
                </button>
            </div>

            {isVipClinic && selectedAiDiagnosis && aiDiagnosisResult?.prescription_suggestions?.length ? (
                <div className="mb-4 rounded-2xl border border-amber-200 bg-amber-50/80 p-3 shadow-sm">
                    <div className="flex flex-wrap items-center justify-between gap-3">
                        <div>
                            <p className="text-xs font-bold uppercase tracking-wide text-amber-800">Đơn thuốc nháp từ AI</p>
                            <p className="mt-1 text-[11px] text-stone-600">Bác sĩ có thể nhận nhanh toàn bộ hoặc thêm từng thuốc vào EMR.</p>
                        </div>
                        <button
                            type="button"
                            onClick={handleApplyAiPrescriptions}
                            className="rounded-lg border border-orange-200 bg-orange-50 px-3 py-1 text-[10px] font-bold uppercase tracking-wide text-orange-700 transition-all hover:bg-orange-100 active:scale-95"
                        >
                            Nhận toàn bộ đơn
                        </button>
                    </div>

                    <div className="mt-2 space-y-2">
                        {aiDiagnosisResult.prescription_suggestions.map((item, index) => (
                            <div key={`${item.medicine_name}-${index}`} className="rounded-xl border border-stone-300 bg-white p-2.5">
                                <div className="flex flex-wrap items-start justify-between gap-3">
                                    <div className="min-w-0">
                                        <p className="break-words text-sm font-bold text-stone-900">{item.medicine_name}</p>
                                        <p className="mt-1 break-words text-[11px] text-stone-600">
                                            {(item.times_of_day || item.timesOfDay || []).length ? (item.times_of_day || item.timesOfDay).map(timeLabel).join(', ') : 'Theo chỉ định'}
                                            {' | '}
                                            {mealLabel(item.before_after_meal || item.beforeAfterMeal)}
                                            {' | '}
                                            {item.duration_days ?? item.durationDays ?? '-'} ngày
                                        </p>
                                        {item.instructions && <p className="mt-1 break-words text-[11px] text-stone-600 line-clamp-3">{item.instructions}</p>}
                                        {item.caution && <p className="mt-1 break-words text-[11px] font-semibold text-red-600 line-clamp-3">{item.caution}</p>}
                                    </div>
                                    <button
                                        type="button"
                                        onClick={() => handleAddSingleAiPrescription(index)}
                                        className="rounded-lg border border-stone-200 bg-stone-50 px-2.5 py-1 text-[10px] font-bold uppercase tracking-wide text-stone-700 transition-all hover:bg-stone-100 active:scale-95"
                                    >
                                        Thêm thuốc này
                                    </button>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            ) : null}

            {prescriptions.length > 0 ? (
                <div className="space-y-2.5">
                    {prescriptions.map((p, i) => (
                        <div key={i} className="relative overflow-hidden rounded-2xl border border-stone-100 bg-white p-3">
                            <div className="absolute bottom-0 left-0 top-0 w-1 bg-orange-500/30"></div>
                            <div className="min-w-0 pl-2.5">
                                <div className="break-words text-sm font-bold text-stone-800">{p.medicineName}</div>
                                <div className="mt-1 text-[10px] font-medium uppercase tracking-wide text-stone-500 break-words">
                                    {(p.timesOfDay && p.timesOfDay.length > 0) ? p.timesOfDay.map(timeLabel).join(', ') : 'Theo chỉ định'}
                                    {' | '}
                                    {mealLabel(p.beforeAfterMeal)}
                                    {' | '}
                                    {p.durationDays ?? '-'} ngày
                                </div>
                                {p.instructions && <p className="mt-1 break-words text-[11px] text-stone-600 line-clamp-3">{p.instructions}</p>}
                            </div>
                        </div>
                    ))}
                </div>
            ) : (
                <div
                    onClick={handleOpenPrescriptionModal}
                    className="group cursor-pointer rounded-2xl border-2 border-dashed border-stone-200 bg-stone-50 py-10 text-center transition-all hover:border-amber-200 hover:bg-amber-50/40"
                >
                    <p className="text-xs font-semibold uppercase tracking-widest text-stone-500">Bấm để bắt đầu kê đơn</p>
                </div>
            )}
        </div>
    )

    const renderObjectiveSection = () => (
        <div className="rounded-2xl bg-white p-6 shadow-sm">
            <div className="flex items-center gap-3 mb-2">
                <span className="w-1 h-6 bg-orange-600 rounded-full"></span>
                <h2 className="text-lg font-bold text-orange-800 tracking-tight uppercase">Khách quan / Chỉ số sức khỏe</h2>
            </div>
            <p className="text-xs text-stone-400 mb-4">Kết quả khám lâm sàng, chỉ số sức khỏe</p>

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
            {isVipClinic ? (
                aiDiagnosisResult?.soap_suggestions.objective_draft?.trim() ? (
                    <AISuggestionInlineCard
                        title="Gợi ý AI cho Khách quan"
                        value={aiDiagnosisResult?.soap_suggestions.objective_draft}
                        onAccept={() => handleApplyAiDraft('objective', aiDiagnosisResult?.soap_suggestions.objective_draft || '')}
                    />
                ) : aiDiagnosisResult ? (
                    <p className="mt-3 text-xs font-semibold text-blue-700">
                        AI chưa đủ dữ liệu để gợi ý Objective rõ ràng. Hãy bổ sung ảnh lâm sàng hoặc mô tả khám chi tiết hơn.
                    </p>
                ) : (
                    <p className="mt-3 text-xs font-semibold text-stone-500">
                        Bấm AI chẩn đoán để nhận gợi ý cho phần khách quan.
                    </p>
                )
            ) : (
                <p className="mt-3 text-xs font-semibold text-stone-500">
                    Nhập kết quả khám lâm sàng và chỉ số sức khỏe của ca bệnh.
                </p>
            )}
        </div>
    )

    const estimateAgeMonths = (): number | undefined => {
        const years = Number.parseInt(petInfo?.age ?? '', 10)
        return Number.isFinite(years) ? years * 12 : undefined
    }

    const getNormalizedWeightKg = (): number | undefined => {
        const parsed = weight ? parseFloat(weight.replace(',', '.')) : petInfo?.weight
        return typeof parsed === 'number' && Number.isFinite(parsed) ? parsed : undefined
    }

    const handlePendingImageDescriptionsChange = useCallback((descriptions: Record<string, string>) => {
        setPendingImages((prev) => prev.map((item) => {
            const aiDescription = descriptions[item.previewUrl]?.trim()
            if (!aiDescription || item.description.trim()) {
                return item
            }
            return {
                ...item,
                description: aiDescription,
            }
        }))
    }, [])

    const currentAgeMonths = estimateAgeMonths()
    const currentWeightKg = getNormalizedWeightKg()

    useEffect(() => {
        if (!petInfo) return

        setAiChatDraft({
            version: 1,
            updated_at: new Date().toISOString(),
            pet_id: petInfo.id,
            booking_id: bookingId || undefined,
            species: petInfo.species,
            breed: petInfo.breed,
            age_months: currentAgeMonths,
            weight_kg: currentWeightKg,
            allergies: allergies.split(',').map((item) => item.trim()).filter(Boolean),
            subjective,
            objective,
            assessment,
            plan,
            image_urls: [
                ...images.map((img) => img.url).filter(Boolean),
                ...pendingImages.map((item) => item.previewUrl).filter(Boolean),
            ],
        })
    }, [
        allergies,
        assessment,
        bookingId,
        currentAgeMonths,
        currentWeightKg,
        images,
        objective,
        pendingImages,
        petInfo,
        plan,
        setAiChatDraft,
        subjective,
    ])

    useEffect(() => {
        pendingImagesRef.current = pendingImages
    }, [pendingImages])

    useEffect(() => {
        return () => {
            pendingImagesRef.current.forEach((item) => URL.revokeObjectURL(item.previewUrl))
        }
    }, [])

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
        <div className="min-h-screen overflow-x-hidden bg-stone-100 px-4 py-6 pr-14 sm:px-6 sm:pr-16 lg:pr-20">
            <div className="mx-auto w-full max-w-[1600px] overflow-visible">
                {/* Main Grid */}
                <div className="grid items-start gap-6 overflow-visible xl:grid-cols-[280px_minmax(0,1.2fr)_minmax(360px,0.95fr)] 2xl:grid-cols-[300px_minmax(0,1.25fr)_minmax(400px,0.95fr)]">

                    {/* ========== LEFT SIDEBAR ========== */}
                    <div className="self-start space-y-4 xl:sticky xl:top-6">
                        {/* Pet Info Card */}
                        <div className="rounded-2xl bg-white p-6 shadow-sm">
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

                    </div>

                    {/* ========== CENTER - SOAP FORM ========== */}
                    <div className="min-w-0 space-y-4 self-start">
                        <div className={`sticky top-6 z-20 rounded-2xl border border-stone-200 bg-white p-4 shadow-sm ${showPrescriptionModal ? 'invisible pointer-events-none' : ''}`}>
                            <div className="mb-4 flex items-center justify-between gap-4">
                                <div>
                                    <p className="text-[9px] font-bold uppercase tracking-[0.2em] text-stone-400">Create EMR</p>
                                    <h2 className="mt-0.5 text-lg font-black text-stone-800">Biểu mẫu bệnh án</h2>
                                </div>
                                <div className="flex items-center gap-2">
                                    <button
                                        type="button"
                                        onClick={goToPreviousStep}
                                        disabled={currentStep === 1}
                                        className="rounded-lg border border-stone-200 bg-stone-50 px-2.5 py-1 text-[11px] font-bold text-stone-600 transition-all hover:bg-stone-100 disabled:cursor-not-allowed disabled:opacity-50"
                                    >
                                        Quay lại
                                    </button>
                                    {currentStep < 2 && (
                                        <button
                                            type="button"
                                            onClick={goToNextStep}
                                            className="rounded-lg border border-orange-200 bg-orange-50 px-2.5 py-1 text-[11px] font-bold text-orange-700 transition-all hover:bg-orange-100"
                                        >
                                            Tiếp theo
                                        </button>
                                    )}
                                    <button
                                        onClick={handleSubmit}
                                        disabled={isLoading || isUploadingImages}
                                        className="whitespace-nowrap rounded-lg bg-orange-500 px-3.5 py-1.5 text-xs font-extrabold text-white shadow-md transition-all hover:bg-orange-600 active:scale-95 disabled:cursor-not-allowed disabled:bg-stone-300"
                                    >
                                        {isLoading ? 'Đang lưu...' : 'Lưu và tiếp tục'}
                                    </button>
                                </div>
                            </div>

                            <div className="grid grid-cols-2 gap-3">
                                {stepItems.map((step) => {
                                    const isActive = currentStep === step.id
                                    const isDone = currentStep > step.id
                                    return (
                                        <button
                                            key={step.id}
                                            type="button"
                                            onClick={() => setCurrentStep(step.id)}
                                            className={`relative flex items-center gap-2 rounded-xl border px-3 py-2.5 text-left transition-all ${isActive
                                                ? 'border-amber-300 bg-amber-50 shadow-sm'
                                                : isDone
                                                    ? 'border-green-200 bg-green-50'
                                                    : 'border-stone-200 bg-stone-50 hover:border-stone-300'
                                                }`}
                                        >
                                            {step.id < 2 && (
                                                <span className={`absolute -right-2 top-1/2 hidden h-[1px] w-4 -translate-y-1/2 xl:block ${currentStep > step.id ? 'bg-green-500' : 'bg-stone-200'}`}></span>
                                            )}
                                            <span className={`flex h-6 w-6 items-center justify-center rounded-full text-[10px] font-black ${isActive
                                                ? 'bg-amber-500 text-white'
                                                : isDone
                                                    ? 'bg-green-600 text-white'
                                                    : 'bg-white text-stone-500 border border-stone-200'
                                                }`}>
                                                {isDone ? '✓' : step.id}
                                            </span>
                                            <div>
                                                <p className="text-[9px] font-bold uppercase tracking-widest text-stone-400">{step.title}</p>
                                                <p className="text-xs font-semibold text-stone-700">{step.label}</p>
                                            </div>
                                        </button>
                                    )
                                })}
                            </div>
                        </div>

                        <div className="rounded-2xl bg-white p-6 shadow-sm">
                            <div className="flex justify-between items-center mb-6">
                                <h2 className="text-xl font-black text-stone-800">{stepItems.find((item) => item.id === currentStep)?.label}</h2>
                                {bookingCode && (
                                    <div className="px-3 py-1 bg-blue-50 text-blue-700 text-sm font-bold rounded-lg border border-blue-200">
                                        Booking #{bookingCode}
                                    </div>
                                )}
                            </div>

                            {currentStep === 1 && (
                            <div className="mb-0">
                                <div className="flex items-center gap-3 mb-2">
                                    <span className="w-1 h-6 bg-orange-600 rounded-full"></span>
                                    <h2 className="text-lg font-bold text-orange-800 tracking-tight uppercase">Triệu chứng (Chủ quan)</h2>
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
                                <div className="mt-4 flex items-center gap-3">
                                    {isVipClinic && (
                                        <button
                                            type="button"
                                            onClick={handleOpenAiModal}
                                            disabled={isAiAnalyzing}
                                            className="flex items-center gap-2 rounded-lg bg-orange-600 px-4 py-2 text-xs font-extrabold text-white shadow-md shadow-orange-100 transition-all hover:bg-orange-700 active:scale-95 disabled:cursor-not-allowed disabled:opacity-50"
                                        >
                                            <SparklesIcon className="h-4 w-4" />
                                            {isAiAnalyzing ? 'Đang phân tích...' : 'Mở AI chẩn đoán'}
                                        </button>
                                    )}
                                </div>
                                {isVipClinic && selectedAiDiagnosis ? (
                                    <AISuggestionInlineCard
                                        title="Gợi ý AI cho Triệu chứng"
                                        value={aiDiagnosisResult?.soap_suggestions.subjective_draft}
                                        onAccept={() => handleApplyAiDraft('subjective', aiDiagnosisResult?.soap_suggestions.subjective_draft || '')}
                                    />
                                ) : null}
                            </div>
                            )}

                            {currentStep === 2 && (
                            <div className="mb-0">
                                <div className="flex items-center gap-3 mb-2">
                                    <span className="w-1 h-6 bg-orange-600 rounded-full"></span>
                                    <h2 className="text-lg font-bold text-orange-800 tracking-tight uppercase">Chẩn đoán <span className="text-red-500">*</span></h2>
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
                                {isVipClinic ? (
                                    selectedAiDiagnosis ? (
                                        <p className="mt-3 text-xs font-semibold text-green-700">
                                            Đã chốt chẩn đoán theo lựa chọn của bác sĩ. AI sẽ chỉ gợi ý cho phần kế hoạch điều trị bên dưới.
                                        </p>
                                    ) : (
                                        <p className="mt-3 text-xs font-semibold text-blue-700">Chọn một chẩn đoán từ Top 3 ở bước trước để tiếp tục các gợi ý AI.</p>
                                    )
                                ) : (
                                    <p className="mt-3 text-xs font-semibold text-stone-500">
                                        Bác sĩ nhập chẩn đoán dựa trên thăm khám lâm sàng và dữ liệu bệnh án hiện có.
                                    </p>
                                )}
                            </div>
                            )}
                        </div>

                        {currentStep === 2 && renderPrescriptionCard()}

                    </div>

                    {/* ========== RIGHT SIDEBAR ========== */}
                    <div className={`min-w-0 space-y-4 self-start ${currentStep === 1 ? 'xl:sticky xl:top-6' : ''}`}>
                        {currentStep === 1 && (
                        <div className="max-h-[calc(100vh-3rem)] overflow-y-auto rounded-2xl bg-white p-6 shadow-sm">
                            <div className="mb-4 flex items-start justify-between gap-3">
                                <div>
                                    <h3 className="font-bold text-stone-700">Hình ảnh lâm sàng</h3>
                                    <p className="mt-1 text-xs text-stone-500">
                                        {isVipClinic
                                            ? 'Hệ thống sẽ đọc trực tiếp các ảnh đã tải lên trong mục này và ảnh preview mới chọn.'
                                            : 'Quản lý ảnh lâm sàng đã tải lên và ảnh preview mới chọn.'}
                                    </p>
                                </div>
                                {isVipClinic && (
                                    <div className={`rounded-full border px-3 py-1 text-[10px] font-bold uppercase tracking-widest ${isAiAnalyzing ? 'border-amber-300 bg-amber-50 text-amber-700' : 'border-stone-200 bg-stone-50 text-stone-500'}`}>
                                        {isAiAnalyzing ? 'AI đang đọc ảnh' : 'Ảnh sẵn sàng cho AI'}
                                    </div>
                                )}
                            </div>

                            {isVipClinic && (
                                <div className="mb-4 rounded-xl border border-stone-200 bg-stone-50 p-3 text-xs text-stone-600">
                                    <p>Tổng {images.length + pendingImages.length} ảnh sẵn sàng cho AI.</p>
                                    {pendingImages.length > 0 && (
                                        <p className="mt-1 font-semibold text-amber-700">Có {pendingImages.length} ảnh preview mới chờ tải lên.</p>
                                    )}
                                </div>
                            )}

                            {shouldShowImageUploadStatus && (
                                <div className="mb-4 rounded-2xl border border-amber-200 bg-amber-50/70 p-4 shadow-sm">
                                    <div className="flex items-center justify-between gap-3">
                                        <div>
                                            <p className="text-xs font-bold uppercase tracking-wide text-amber-800">
                                                {isUploadingImages ? 'Đang tải ảnh lên' : 'Có ảnh tải lên bị lỗi'}
                                            </p>
                                            <p className="mt-1 text-xs text-stone-600">
                                                {uploadedImagesCount}/{uploadingImages.length} ảnh đã tải thành công.
                                            </p>
                                        </div>
                                        {isUploadingImages && (
                                            <div className="min-w-28 rounded-full border border-stone-200 bg-white p-1">
                                                <div
                                                    className="h-2 rounded-full bg-amber-500 transition-all"
                                                    style={{ width: `${(uploadedImagesCount / uploadingImages.length) * 100}%` }}
                                                />
                                            </div>
                                        )}
                                    </div>

                                    <div className="mt-3 space-y-2">
                                        {uploadingImages.map((item, index) => (
                                            <div key={`${item.name}-${index}`} className="flex items-center justify-between gap-3 rounded-xl border border-stone-200 bg-white px-3 py-2 text-xs">
                                                <span className="truncate text-stone-700">{item.name}</span>
                                                <span
                                                    className={`shrink-0 font-bold uppercase ${item.status === 'done'
                                                        ? 'text-green-700'
                                                        : item.status === 'error'
                                                            ? 'text-red-600'
                                                            : 'text-amber-700'
                                                        }`}
                                                >
                                                    {item.status === 'waiting' && 'Chờ tải'}
                                                    {item.status === 'uploading' && 'Đang tải'}
                                                    {item.status === 'done' && 'Hoàn tất'}
                                                    {item.status === 'error' && 'Lỗi'}
                                                </span>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            )}

                            <label className={`mb-4 block rounded-lg border-2 border-dashed p-6 text-center transition-colors ${isUploadingImages ? 'cursor-not-allowed border-stone-200 bg-stone-50 opacity-70' : 'cursor-pointer border-stone-300 hover:border-amber-400'}`}>
                                <PhotoIcon className="mx-auto mb-2 h-8 w-8 text-stone-400" />
                                <p className="text-sm text-stone-500">
                                    {isUploadingImages
                                        ? 'Đang tải ảnh lên, vui lòng chờ hoàn tất đợt hiện tại...'
                                        : 'Kéo thả hoặc nhấp để tải lên một hoặc nhiều ảnh lâm sàng, da liễu, tai, mắt, X-quang...'}
                                </p>
                                <input
                                    type="file"
                                    accept="image/*"
                                    multiple
                                    disabled={isUploadingImages}
                                    className="hidden"
                                    onChange={handleImageUpload}
                                />
                            </label>

                            {images.length > 0 && (
                                <div className="grid grid-cols-2 gap-4">
                                    {images.map((img, i) => (
                                        <div key={i} className="rounded-2xl border border-stone-200 bg-stone-50/70 p-3 shadow-sm transition-all hover:shadow-md">
                                            <div className="relative mb-3">
                                                <img
                                                    src={img.url}
                                                    alt=""
                                                    className="h-36 w-full cursor-pointer rounded-xl object-cover transition-opacity hover:opacity-80"
                                                    onClick={() => setPreviewImage(img)}
                                                />
                                                <button
                                                    type="button"
                                                    onClick={() => setImages(images.filter((_, idx) => idx !== i))}
                                                    className="absolute right-2 top-2 flex h-7 w-7 items-center justify-center rounded-full bg-red-500 text-xs text-white shadow-sm transition-colors hover:bg-red-600"
                                                >
                                                    ×
                                                </button>
                                            </div>
                                            <div className="group relative">
                                                <input
                                                    type="text"
                                                    value={img.description || ''}
                                                    onChange={(e) => {
                                                        const newImages = [...images]
                                                        newImages[i] = { ...newImages[i], description: e.target.value }
                                                        setImages(newImages)
                                                    }}
                                                    placeholder="Mô tả hình ảnh..."
                                                    className="w-full rounded-xl border border-stone-200 bg-white px-3 py-2 text-xs text-stone-700 focus:border-amber-500 focus:outline-none"
                                                />
                                                {img.description?.trim() && (
                                                    <div className="pointer-events-none absolute bottom-full left-0 right-0 z-10 mb-2 hidden rounded-xl border border-stone-200 bg-white p-3 text-xs text-stone-700 shadow-lg group-hover:block group-focus-within:block">
                                                        {img.description}
                                                    </div>
                                                )}
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            )}

                            {pendingImages.length > 0 && (
                                <div className="mt-4">
                                    <p className="mb-2 text-xs font-bold text-amber-600">Ảnh mới chọn (chờ tải lên):</p>
                                    <div className="grid grid-cols-2 gap-4">
                                        {pendingImages.map((pendingImage, i) => (
                                            <div key={`pending-${i}`} className="relative rounded-2xl border border-amber-300 bg-amber-50/70 p-3 shadow-sm transition-all hover:shadow-md">
                                                <div className="relative mb-3">
                                                    <img
                                                        src={pendingImage.previewUrl}
                                                        alt={`Preview ${i + 1}`}
                                                        className="h-36 w-full cursor-pointer rounded-xl object-cover transition-opacity hover:opacity-80"
                                                        onClick={() => setPreviewImage({ url: pendingImage.previewUrl, description: pendingImage.description })}
                                                    />
                                                    <button
                                                        type="button"
                                                        onClick={() => {
                                                            URL.revokeObjectURL(pendingImage.previewUrl)
                                                            setPendingImages(prev => prev.filter((_, idx) => idx !== i))
                                                        }}
                                                        className="absolute right-2 top-2 flex h-7 w-7 items-center justify-center rounded-full bg-red-500 text-xs text-white shadow-sm transition-colors hover:bg-red-600"
                                                    >
                                                        ×
                                                    </button>
                                                </div>
                                                <div className="group relative mb-2">
                                                    <input
                                                        type="text"
                                                        value={pendingImage.description}
                                                        onChange={(e) => {
                                                            const nextValue = e.target.value
                                                            setPendingImages((prev) =>
                                                                prev.map((item, idx) =>
                                                                    idx === i ? { ...item, description: nextValue } : item,
                                                                ),
                                                            )
                                                        }}
                                                        placeholder="Mô tả ảnh lâm sàng..."
                                                        className="w-full rounded-xl border border-amber-200 bg-white px-3 py-2 text-xs text-stone-700 focus:border-amber-500 focus:outline-none"
                                                    />
                                                    {pendingImage.description.trim() && (
                                                        <div className="pointer-events-none absolute bottom-full left-0 right-0 z-10 mb-2 hidden rounded-xl border border-amber-200 bg-white p-3 text-xs text-stone-700 shadow-lg group-hover:block group-focus-within:block">
                                                            {pendingImage.description}
                                                        </div>
                                                    )}
                                                </div>
                                                <p className="text-center text-xs text-amber-700">Chờ tải lên</p>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            )}
                        </div>
                        )}

                        {currentStep === 2 && (
                            <>
                                <div className="grid grid-cols-1 gap-4">
                                    <div className="min-w-0 rounded-2xl bg-white p-6 shadow-sm">
                                        <div className="flex items-center gap-3 mb-4">
                                            <span className="w-1 h-6 bg-orange-600 rounded-full"></span>
                                            <h2 className="text-lg font-bold text-orange-800 tracking-tight uppercase">Kế hoạch điều trị <span className="text-red-500">*</span></h2>
                                        </div>
                                        <textarea
                                            value={plan}
                                            onChange={(e) => {
                                                setPlan(e.target.value)
                                                if (errors.plan) setErrors(prev => ({ ...prev, plan: undefined }))
                                            }}
                                            placeholder="Kế hoạch điều trị, hướng dẫn chăm sóc và lưu ý theo dõi..."
                                            rows={6}
                                            className={`w-full border rounded-lg p-3 text-sm ${errors.plan ? 'border-red-400 focus:border-red-500' : 'border-stone-300 focus:border-amber-500'} focus:outline-none`}
                                        />
                                        {errors.plan && (
                                            <p className="text-red-500 text-sm mt-1">{errors.plan}</p>
                                        )}
                                        {isVipClinic ? (
                                            selectedAiDiagnosis ? (
                                                <AISuggestionInlineCard
                                                    title="Gợi ý AI cho Plan"
                                                    value={aiDiagnosisResult?.soap_suggestions.plan_draft}
                                                    onAccept={() => handleApplyAiDraft('plan', aiDiagnosisResult?.soap_suggestions.plan_draft || '')}
                                                />
                                            ) : (
                                                <p className="mt-3 text-xs font-semibold text-blue-700">Chọn một chẩn đoán từ Top 3 ở bước trước để mở gợi ý AI cho kế hoạch điều trị.</p>
                                            )
                                        ) : (
                                            <p className="mt-3 text-xs font-semibold text-stone-500">
                                                Bác sĩ xây dựng kế hoạch điều trị theo chẩn đoán đã xác nhận.
                                            </p>
                                        )}
                                    </div>

                                    <div className="flex flex-col rounded-2xl bg-white p-6 shadow-sm">
                                        <div className="mb-2 flex items-center gap-3">
                                            <span className="h-6 w-1 rounded-full bg-stone-300"></span>
                                            <h2 className="text-lg font-bold uppercase tracking-tight text-stone-800">Ghi chú</h2>
                                        </div>
                                        <p className="mb-4 text-xs text-stone-400">Lưu ý nội bộ hoặc nhắc nhở thêm</p>
                                        <textarea
                                            value={notes}
                                            onChange={(e) => setNotes(e.target.value)}
                                            placeholder="Ghi chú thêm cho ca bệnh này..."
                                            rows={4}
                                            className="w-full flex-1 rounded-xl border border-stone-200 bg-stone-50/30 p-3 text-sm focus:border-amber-500 focus:outline-none"
                                        />
                                    </div>

                                </div>

                                {showPrescriptionModal && (
                                    <div className="fixed inset-0 z-[120] flex items-start justify-center overflow-y-auto bg-stone-900/75 p-4 backdrop-blur-md animate-in fade-in duration-300 sm:items-center sm:p-6">
                                        <div className="flex max-h-[92vh] w-full max-w-6xl flex-col overflow-hidden rounded-[2rem] border border-stone-200 bg-white shadow-2xl animate-in zoom-in-95 duration-300 xl:max-w-[1240px]">
                                            <div className="flex items-center justify-between border-b border-stone-100 bg-stone-50/50 px-5 py-4 sm:px-6 lg:px-8">
                                                <div>
                                                    <h2 className="text-xl font-bold tracking-tight text-stone-800">Lập đơn thuốc</h2>
                                                    <p className="mt-0.5 text-[10px] font-medium text-stone-400">Chi tiết liều lượng và phác đồ điều trị tiêu chuẩn</p>
                                                </div>
                                                <button
                                                    onClick={() => setShowPrescriptionModal(false)}
                                                    className="group rounded-xl border border-transparent p-2 text-stone-300 transition-all hover:border-stone-100 hover:bg-white hover:text-stone-500 hover:shadow-md"
                                                >
                                                    <XMarkIcon className="h-6 w-6" />
                                                </button>
                                            </div>

                                            <div className="flex-1 overflow-y-auto bg-white px-4 py-5 sm:px-6 lg:px-8">
                                                <div className="space-y-4">
                                                    <div className="hidden gap-3 rounded-xl border border-orange-100 bg-orange-50/50 px-4 py-2 text-center text-[11px] font-bold uppercase tracking-widest text-orange-800 lg:grid lg:grid-cols-[minmax(220px,2fr)_minmax(180px,1.2fr)_130px_90px_minmax(280px,3fr)_48px]">
                                                        <div>Tên thuốc</div>
                                                        <div>Thời điểm uống</div>
                                                        <div>Trước/Sau ăn</div>
                                                        <div>Ngày</div>
                                                        <div>Hướng dẫn sử dụng</div>
                                                        <div></div>
                                                    </div>

                                                    <div className="space-y-2">
                                                        {tempPrescriptions.map((p, i) => (
                                                            <div key={i} className="group grid gap-3 rounded-2xl border border-transparent p-3 transition-all hover:border-stone-100 hover:bg-stone-50 lg:grid-cols-[minmax(220px,2fr)_minmax(180px,1.2fr)_130px_90px_minmax(280px,3fr)_48px] lg:items-center">
                                                                <div>
                                                                    <p className="mb-1 text-[10px] font-bold uppercase tracking-widest text-stone-400 lg:hidden">Tên thuốc</p>
                                                                    <input
                                                                        type="text"
                                                                        list="medicine-list-modal"
                                                                        value={p.medicineName}
                                                                        onChange={(e) => handleUpdatePrescription(i, 'medicineName', e.target.value)}
                                                                        placeholder="Tên thuốc..."
                                                                        className="w-full rounded-xl border border-stone-200 bg-white px-3 py-1.5 text-sm font-semibold text-stone-700 outline-none transition-all placeholder:text-stone-300 focus:border-amber-600 focus:ring-4 focus:ring-amber-500/10"
                                                                    />
                                                                </div>
                                                                <div>
                                                                    <p className="mb-1 text-[10px] font-bold uppercase tracking-widest text-stone-400 lg:hidden">Thời điểm uống</p>
                                                                    <div className="grid grid-cols-3 gap-2">
                                                                        {(['sang', 'trua', 'chieu'] as const).map((slot) => {
                                                                            const active = (p.timesOfDay || []).includes(slot)
                                                                            return (
                                                                                <button
                                                                                    key={slot}
                                                                                    type="button"
                                                                                    onClick={() => {
                                                                                        const next = active
                                                                                            ? (p.timesOfDay || []).filter((x) => x !== slot)
                                                                                            : [...(p.timesOfDay || []), slot]
                                                                                        handleUpdatePrescription(i, 'timesOfDay', next)
                                                                                    }}
                                                                                    className={`w-full rounded-full border px-3 py-1 text-center text-[11px] font-bold uppercase tracking-wide transition-all active:scale-95 ${active
                                                                                        ? 'border-orange-400 bg-orange-50 text-orange-700'
                                                                                        : 'border-stone-200 bg-white text-stone-600 hover:bg-stone-50'
                                                                                        }`}
                                                                                >
                                                                                    {timeLabel(slot)}
                                                                                </button>
                                                                            )
                                                                        })}
                                                                    </div>
                                                                </div>
                                                                <div>
                                                                    <p className="mb-1 text-[10px] font-bold uppercase tracking-widest text-stone-400 lg:hidden">Trước/Sau ăn</p>
                                                                    <select
                                                                        value={p.beforeAfterMeal || 'AFTER_MEAL'}
                                                                        onChange={(e) => handleUpdatePrescription(i, 'beforeAfterMeal', e.target.value)}
                                                                        className="w-full rounded-xl border border-stone-200 bg-white px-3 py-1.5 text-sm font-medium outline-none transition-all focus:border-amber-600 focus:ring-4 focus:ring-amber-500/10"
                                                                    >
                                                                        <option value="BEFORE_MEAL">Trước ăn</option>
                                                                        <option value="AFTER_MEAL">Sau ăn</option>
                                                                    </select>
                                                                </div>
                                                                <div>
                                                                    <p className="mb-1 text-[10px] font-bold uppercase tracking-widest text-stone-400 lg:hidden">Số ngày</p>
                                                                    <input
                                                                        type="number"
                                                                        value={p.durationDays || ''}
                                                                        onChange={(e) => handleUpdatePrescription(i, 'durationDays', parseInt(e.target.value) || 0)}
                                                                        placeholder="7"
                                                                        className="w-full rounded-xl border border-stone-200 bg-white px-1 py-1.5 text-center text-sm font-bold text-orange-600 outline-none transition-all focus:border-orange-600 focus:ring-4 focus:ring-orange-500/10"
                                                                    />
                                                                </div>
                                                                <div>
                                                                    <p className="mb-1 text-[10px] font-bold uppercase tracking-widest text-stone-400 lg:hidden">Hướng dẫn sử dụng</p>
                                                                    <input
                                                                        type="text"
                                                                        value={p.instructions || ''}
                                                                        onChange={(e) => handleUpdatePrescription(i, 'instructions', e.target.value)}
                                                                        placeholder="VD: Cho uống sau ăn, với nước; theo dõi nôn/tiêu chảy..."
                                                                        className="w-full rounded-xl border border-stone-200 bg-white px-4 py-1.5 text-sm font-medium italic outline-none transition-all placeholder:text-stone-300 focus:border-amber-600 focus:ring-4 focus:ring-amber-500/10"
                                                                    />
                                                                </div>
                                                                <div className="flex justify-end lg:justify-center">
                                                                    <button
                                                                        onClick={() => handleRemovePrescription(i)}
                                                                        className="rounded-lg p-2 text-stone-300 transition-all hover:bg-red-50 hover:text-red-500 active:scale-90"
                                                                    >
                                                                        <TrashIcon className="h-4 w-4" />
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
                                                        className="group mt-4 flex w-full items-center justify-center gap-3 rounded-2xl border-2 border-dashed border-stone-100 py-3 font-semibold text-stone-400 transition-all hover:border-orange-500 hover:bg-orange-50/20 hover:text-orange-700"
                                                    >
                                                        <PlusIcon className="h-3.5 w-3.5" />
                                                        <span className="text-[8px] uppercase tracking-widest">Thêm loại thuốc mới</span>
                                                    </button>
                                                </div>
                                            </div>

                                            <div className="flex flex-col gap-3 border-t border-stone-100 bg-stone-50/30 px-5 py-4 sm:flex-row sm:items-center sm:justify-between sm:px-6 lg:px-8">
                                                <button
                                                    onClick={() => setShowResetConfirm(true)}
                                                    className="text-left text-[10px] font-bold uppercase tracking-widest text-stone-400 transition-colors hover:text-red-500"
                                                >
                                                    Xóa toàn bộ
                                                </button>
                                                <div className="flex w-full flex-col-reverse gap-3 sm:w-auto sm:flex-row sm:items-center sm:gap-4">
                                                    <button
                                                        onClick={() => setShowPrescriptionModal(false)}
                                                        className="rounded-xl px-6 py-2.5 text-sm font-semibold text-stone-500 transition-all hover:bg-white hover:shadow-sm"
                                                    >
                                                        QUAY LẠI
                                                    </button>
                                                    <button
                                                        onClick={handleSavePrescriptions}
                                                        className="rounded-xl bg-orange-600 px-8 py-2.5 text-sm font-bold text-white shadow-xl shadow-orange-100 transition-all hover:bg-orange-700 active:scale-95"
                                                    >
                                                        Xác nhận đơn
                                                    </button>
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                )}

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

                                <div className="grid grid-cols-1 gap-4">
                                    <div className="relative rounded-2xl bg-white p-6 shadow-sm">
                                        <div className="mb-4 flex items-center justify-between">
                                            <h3 className="flex items-center gap-2 font-bold text-stone-700">
                                                <CalendarDaysIcon className="h-5 w-5 text-amber-500" />
                                                Hẹn tái khám
                                            </h3>
                                            <button
                                                type="button"
                                                onClick={() => setHasReExam(!hasReExam)}
                                                className={`relative h-6 w-11 rounded-full transition-colors ${hasReExam ? 'bg-amber-500' : 'bg-stone-200'}`}
                                            >
                                                <span className={`absolute left-1 top-1 h-4 w-4 rounded-full bg-white transition-transform ${hasReExam ? 'translate-x-[22px]' : 'translate-x-0'}`} />
                                            </button>
                                        </div>

                                        <p className={`text-xs font-semibold ${hasReExam ? 'text-amber-700' : 'text-stone-500'}`}>
                                            {hasReExam
                                                ? `Đã bật hẹn tái khám: ${reExaminationDate ? new Date(reExaminationDate).toLocaleDateString('vi-VN') : 'chưa chọn ngày cụ thể'}`
                                                : 'Bật để đặt lịch tái khám cho ca bệnh này'}
                                        </p>

                                        {hasReExam && (
                                            <div className="absolute left-0 right-0 bottom-full z-40 mb-3 rounded-2xl border border-amber-200 bg-white p-4 shadow-[6px_6px_0_#1c1917]">
                                                <div className="absolute -bottom-2 right-6 h-4 w-4 rotate-45 border-r border-b border-amber-200 bg-white"></div>
                                                <div className="space-y-4">
                                                    <div className="rounded-xl border border-stone-100 bg-stone-50 p-4">
                                                        <label className="mb-3 block text-xs font-bold uppercase text-stone-500">Ngày cụ thể</label>
                                                        <DatePicker
                                                            selected={reExaminationDate ? new Date(reExaminationDate) : null}
                                                            onChange={(date: Date | null) => setReExaminationDate(date ? date.toLocaleDateString('en-CA') : '')}
                                                            dateFormat="dd/MM/yyyy"
                                                            minDate={new Date()}
                                                            locale="vi"
                                                            placeholderText="Chọn ngày tái khám"
                                                            className="w-full rounded-xl border border-stone-200 bg-white px-4 py-2.5 text-sm font-medium text-amber-700 focus:border-transparent focus:outline-none focus:ring-2 focus:ring-amber-500"
                                                            wrapperClassName="w-full block"
                                                            popperClassName="z-[9999]"
                                                        />
                                                    </div>

                                                    <div className="rounded-xl border border-stone-100 bg-stone-50 p-4">
                                                        <label className="mb-3 block text-xs font-bold uppercase text-stone-500">Hoặc sau khoảng</label>
                                                        <div className="flex items-center gap-2">
                                                            <input
                                                                type="number"
                                                                min="1"
                                                                value={reExamAmount}
                                                                onChange={(e) => setReExamAmount(parseInt(e.target.value) || 0)}
                                                                className="w-20 rounded-xl border border-stone-200 bg-white px-3 py-2.5 text-center text-sm font-bold text-amber-700 focus:outline-none focus:ring-2 focus:ring-amber-500"
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
                                                </div>
                                            </div>
                                        )}
                                    </div>
                                </div>
                            </>
                        )}


                    </div>

                    {currentStep === 1 && (
                        <div className="min-w-0 mt-2 xl:col-start-2 xl:col-span-2 xl:-mt-16">
                            {renderObjectiveSection()}
                        </div>
                    )}
                </div>

                <div className="mt-6 rounded-3xl border border-stone-200 bg-white p-5 shadow-sm">
                    <div className="mb-4 flex items-start justify-between gap-4">
                        <div>
                            <h3 className="font-bold text-stone-800">Tóm tắt bệnh sử</h3>
                            <p className="mt-1 text-sm text-stone-500">Timeline ngang các mốc bệnh án gần đây. Bấm vào từng mốc để xem chi tiết.</p>
                        </div>
                        <div className="flex items-center gap-2">
                            <span className="rounded-full border border-stone-200 bg-stone-50 px-3 py-2 text-[10px] font-bold uppercase tracking-widest text-stone-500">
                                {medicalHistory.length} mốc
                            </span>
                            {isVipClinic && (
                                <button
                                    type="button"
                                    onClick={() => void handleToggleHistorySummary()}
                                    disabled={isSummarizingHistory}
                                    className="group flex h-10 w-10 items-center justify-center rounded-full border border-amber-300 bg-amber-50 text-amber-700 shadow-sm transition-all hover:-translate-y-0.5 hover:bg-amber-100 disabled:cursor-not-allowed disabled:opacity-60"
                                    title="AI tóm tắt bệnh sử gần đây"
                                >
                                    <SparklesIcon className={`h-4 w-4 ${isSummarizingHistory ? 'animate-pulse' : ''}`} />
                                </button>
                            )}
                        </div>
                    </div>

                    <div className="overflow-x-auto pb-2">
                        <div className="relative flex min-w-max items-start gap-4 px-1 pt-8">
                            <div className="absolute left-0 right-0 top-[44px] h-[2px] bg-stone-200"></div>
                            {medicalHistory.length === 0 ? (
                                <div className="rounded-2xl border border-dashed border-stone-200 bg-stone-50 px-6 py-10 text-sm text-stone-400">
                                    Chưa có lịch sử khám
                                </div>
                            ) : (
                                medicalHistory.map((emr) => (
                                    <button
                                        key={emr.id}
                                        type="button"
                                        onClick={() => navigate(`/staff/emr/detail/${emr.id}`)}
                                        className="group relative z-10 w-[280px] shrink-0 rounded-2xl border border-stone-200 bg-stone-50 p-4 text-left shadow-sm transition-all hover:-translate-y-1 hover:border-amber-300 hover:bg-amber-50/60 hover:shadow-md"
                                    >
                                        <span className="absolute -top-8 left-6 h-4 w-4 rounded-full border-4 border-white bg-amber-500 shadow-sm"></span>
                                        <div className="flex items-start justify-between gap-3">
                                            <div>
                                                <p className="text-[10px] font-bold uppercase tracking-widest text-stone-400">Mốc bệnh sử</p>
                                                <p className="mt-1 font-semibold text-stone-700">{formatSummaryDate(emr.examinationDate)}</p>
                                            </div>
                                            <span className="text-[10px] font-bold uppercase tracking-wide text-blue-600">Xem chi tiết</span>
                                        </div>
                                        <p className="mt-3 text-sm font-semibold text-stone-700 line-clamp-2">{emr.assessment || 'Chưa có chẩn đoán'}</p>
                                        {emr.plan && <p className="mt-2 text-xs text-stone-500 line-clamp-3">Kế hoạch: {emr.plan}</p>}
                                        <div className="mt-3 flex items-center justify-between text-xs text-stone-500">
                                            <span>{emr.staffName || 'Không rõ nhân viên'}</span>
                                            <span className="rounded-full border border-stone-200 bg-white px-2 py-1 font-semibold text-stone-500">EMR</span>
                                        </div>
                                    </button>
                                ))
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

            {isVipClinic && (
                <Modal
                    isOpen={showHistorySummaryPopover}
                    onClose={() => setShowHistorySummaryPopover(false)}
                    title="Tóm tắt bệnh sử chi tiết"
                    size="lg"
                >
                    {isSummarizingHistory ? (
                        <p className="text-sm text-stone-600">AI đang tổng hợp bệnh sử gần đây...</p>
                    ) : healthSummary ? (
                        <div className="space-y-3 text-sm text-stone-700">
                            <div className="rounded-xl border border-stone-200 bg-stone-50 p-3">
                                <p className="text-[10px] font-bold uppercase tracking-widest text-stone-500">Diễn tiến chính</p>
                                <p className="mt-1 break-words leading-6">{healthSummary.aiInsights?.summary || 'Chưa có diễn tiến chính từ AI.'}</p>
                            </div>
                            <div className="rounded-xl border border-stone-200 bg-stone-50 p-3">
                                <p className="text-[10px] font-bold uppercase tracking-widest text-stone-500">Chẩn đoán gần đây</p>
                                <p className="mt-1 break-words leading-6">{healthSummary.latestEmr?.diagnosis || 'Chưa có chẩn đoán gần đây.'}</p>
                            </div>
                            <div className="rounded-xl border border-stone-200 bg-stone-50 p-3">
                                <p className="text-[10px] font-bold uppercase tracking-widest text-stone-500">Điều trị gần nhất</p>
                                <p className="mt-1 break-words leading-6">{healthSummary.latestEmr?.treatment || 'Chưa có dữ liệu điều trị gần nhất.'}</p>
                            </div>
                            {healthSummary.healthWarnings.length > 0 && (
                                <div className="rounded-xl border border-red-200 bg-red-50 p-3">
                                    <p className="text-[10px] font-bold uppercase tracking-widest text-red-700">Cảnh báo sức khỏe</p>
                                    <div className="mt-2 space-y-2">
                                        {healthSummary.healthWarnings.slice(0, 4).map((warning, index) => (
                                            <p key={`${warning.type}-${index}`} className="text-sm leading-6 text-red-800">
                                                {index + 1}. {warning.message}
                                            </p>
                                        ))}
                                    </div>
                                </div>
                            )}
                            {healthSummary.medicationReminders.length > 0 && (
                                <div className="rounded-xl border border-stone-200 bg-stone-50 p-3">
                                    <p className="text-[10px] font-bold uppercase tracking-widest text-stone-500">Thuốc đang theo dõi</p>
                                    <div className="mt-2 space-y-2">
                                        {healthSummary.medicationReminders.slice(0, 4).map((reminder, index) => (
                                            <p key={`${reminder.medication}-${index}`} className="text-sm leading-6 text-stone-700">
                                                {index + 1}. {reminder.medication}
                                                {reminder.dosage ? ` - ${reminder.dosage}` : ''}
                                                {reminder.frequency ? ` (${reminder.frequency})` : ''}
                                            </p>
                                        ))}
                                    </div>
                                </div>
                            )}
                            {healthSummary.suggestedActions.length > 0 && (
                                <div className="rounded-xl border border-blue-200 bg-blue-50 p-3">
                                    <p className="text-[10px] font-bold uppercase tracking-widest text-blue-700">Đề xuất ưu tiên</p>
                                    <div className="mt-2 space-y-2">
                                        {healthSummary.suggestedActions.slice(0, 4).map((action, index) => (
                                            <p key={`${action.label}-${index}`} className="text-sm leading-6 text-blue-900">
                                                {index + 1}. {action.label}: {action.reason}
                                            </p>
                                        ))}
                                    </div>
                                </div>
                            )}
                            {healthSummary.aiInsights?.intakeNotes?.length ? (
                                <div className="rounded-xl border border-stone-200 bg-stone-50 p-3">
                                    <p className="text-[10px] font-bold uppercase tracking-widest text-stone-500">Ghi chú tiếp nhận</p>
                                    <div className="mt-2 space-y-2">
                                        {healthSummary.aiInsights.intakeNotes.slice(0, 5).map((note, index) => (
                                            <p key={`${note}-${index}`} className="text-sm leading-6 text-stone-700">
                                                {index + 1}. {note}
                                            </p>
                                        ))}
                                    </div>
                                </div>
                            ) : null}
                            <div className="rounded-xl border border-amber-200 bg-amber-50 p-3">
                                <p className="text-[10px] font-bold uppercase tracking-widest text-amber-700">Lưu ý cho ca hiện tại</p>
                                <p className="mt-1 break-words leading-6">{healthSummary.aiInsights?.advice || healthSummary.aiInsights?.trends || 'Chưa có lưu ý nổi bật từ AI.'}</p>
                            </div>
                            {healthSummary.disclaimer && (
                                <p className="text-xs italic text-stone-500">{healthSummary.disclaimer}</p>
                            )}
                        </div>
                    ) : (
                        <p className="text-sm text-stone-600">Bấm biểu tượng để hệ thống tóm tắt nhanh bệnh sử gần đây theo mẫu lâm sàng.</p>
                    )}
                </Modal>
            )}

            {/* AI Diagnosis Modal */}
            {isVipClinic && (
                <Modal
                    isOpen={isAiModalOpen}
                    onClose={handleCloseAiModal}
                    title="Hỗ trợ AI chẩn đoán"
                    size="xl"
                >
                    <AIDiagnosisPanel
                        isModal
                        autoAnalyzeSignal={aiAnalyzeSignal}
                        initialResult={aiDiagnosisResult}
                        initialSelectedDiagnosis={selectedAiDiagnosis}
                        hideNarrativeInput
                        externalNarrative={subjective}
                        petId={petInfo.id}
                        bookingId={bookingId || undefined}
                        species={petInfo.species}
                        breed={petInfo.breed}
                        ageMonths={estimateAgeMonths()}
                        weightKg={getNormalizedWeightKg()}
                        allergies={allergies.split(',').map((item) => item.trim()).filter(Boolean)}
                        subjective={subjective}
                        objective={objective}
                        assessment={assessment}
                        plan={plan}
                        imageUrls={images.map((img) => img.url).filter(Boolean)}
                        pendingImageUrls={pendingImages.map((item) => item.previewUrl)}
                        onPendingImageDescriptionsChange={handlePendingImageDescriptionsChange}
                        onDiagnosisResult={(result) => {
                            setAiDiagnosisResult(result)
                            if (!result) setSelectedAiDiagnosis(null)
                        }}
                        onSelectDiagnosis={handleSelectAiDiagnosis}
                        onLoadingChange={setIsAiAnalyzing}
                    />
                </Modal>
            )}
        </div>
    )
}

export default CreateEmrPage
