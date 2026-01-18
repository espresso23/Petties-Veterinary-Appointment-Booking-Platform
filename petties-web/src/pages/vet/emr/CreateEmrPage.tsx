import { useState, useEffect } from 'react'
import { useToast } from '../../../components/Toast'
import { useNavigate, useParams } from 'react-router-dom'
import { PlusIcon, TrashIcon, PhotoIcon, CalendarDaysIcon, CalendarIcon } from '@heroicons/react/24/outline'
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

    const [prescriptions, setPrescriptions] = useState<Prescription[]>([])
    const [reExaminationDate, setReExaminationDate] = useState('')
    const [reExamAmount, setReExamAmount] = useState(1)
    const [reExamUnit, setReExamUnit] = useState('Tuần')
    const [hasReExam, setHasReExam] = useState(false)
    const [editingPrescriptionIndex, setEditingPrescriptionIndex] = useState<number | null>(null)

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
    const [showAddPrescription, setShowAddPrescription] = useState(false)
    const [newPrescription, setNewPrescription] = useState<Partial<Prescription>>({})

    // ============= HANDLERS =============
    const handleSavePrescription = () => {
        if (!newPrescription.medicineName || !newPrescription.frequency) return

        if (editingPrescriptionIndex !== null) {
            const updated = [...prescriptions]
            updated[editingPrescriptionIndex] = newPrescription as Prescription as Prescription
            setPrescriptions(updated)
        } else {
            setPrescriptions([...prescriptions, newPrescription as Prescription])
        }

        setNewPrescription({ medicineName: '', frequency: '', durationDays: 0 as any, instructions: '' })
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

    const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0]
        if (!file) return
        try {
            setErrors(prev => ({ ...prev, general: undefined }))
            const result = await emrService.uploadEmrImage(file)
            setImages([...images, { url: result.url }])
        } catch (err: any) {
            console.error('Upload error:', err)
            setErrors(prev => ({ ...prev, general: `Lỗi upload: ${err.response?.data?.message || err.message}` }))
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

                            {petInfo.allergies && petInfo.allergies.length > 0 && (
                                <div className="mt-4 bg-amber-50 border-l-4 border-amber-500 p-3 rounded-r-lg">
                                    <p className="font-bold text-amber-700 text-sm flex items-center gap-1">
                                        Cảnh báo Dị ứng:
                                    </p>
                                    <p className="text-amber-800 text-sm">
                                        Dị ứng với {petInfo.allergies.join(', ')}
                                    </p>
                                </div>
                            )}
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
                            <h2 className="text-xl font-black text-stone-800 mb-6">Biểu mẫu SOAP</h2>

                            {/* S - Subjective */}
                            <div className="mb-6">
                                <h3 className="font-bold text-amber-700 mb-1">S - Chủ quan (Subjective)</h3>
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
                                <h3 className="font-bold text-amber-700 mb-2">
                                    A - Đánh giá (Assessment) <span className="text-red-500">*</span>
                                </h3>
                                <textarea
                                    value={assessment}
                                    onChange={(e) => {
                                        setAssessment(e.target.value)
                                        if (errors.assessment) setErrors(prev => ({ ...prev, assessment: undefined }))
                                    }}
                                    placeholder="Chẩn đoán sơ bộ và đánh giá tình trạng bệnh..."
                                    rows={3}
                                    className={`w-full border rounded-lg p-3 text-sm focus:outline-none ${errors.assessment ? 'border-red-400 focus:border-red-500' : 'border-stone-300 focus:border-amber-500'
                                        }`}
                                />
                                {errors.assessment && (
                                    <p className="text-red-500 text-sm mt-1">{errors.assessment}</p>
                                )}
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
                                                onClick={() => openEditPrescription(i)}
                                                className="grid grid-cols-12 gap-2 p-3 hover:bg-amber-50 cursor-pointer transition-colors items-center text-xs text-stone-600 group"
                                            >
                                                <div className="col-span-4 font-bold text-stone-700 truncate pl-1" title={p.medicineName}>{p.medicineName}</div>
                                                <div className="col-span-2 truncate" title={p.dosage}>{p.dosage || '-'}</div>
                                                <div className="col-span-2 truncate">{p.frequency}</div>
                                                <div className="col-span-2 text-center">{p.durationDays} ngày</div>
                                                <div className="col-span-2 text-right pr-2 italic text-stone-400 truncate relative">
                                                    <span className="group-hover:opacity-0 transition-opacity text-xs">{p.instructions || '-'}</span>
                                                    <div className="absolute right-0 top-1/2 -translate-y-1/2 opacity-0 group-hover:opacity-100 flex justify-end">
                                                        <button
                                                            onClick={(e) => { e.stopPropagation(); handleRemovePrescription(i); }}
                                                            className="p-1.5 hover:bg-red-100 text-red-500 rounded-md transition-colors"
                                                            title="Xoá thuốc"
                                                        >
                                                            <TrashIcon className="w-4 h-4" />
                                                        </button>
                                                    </div>
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

                            <button
                                onClick={() => {
                                    setNewPrescription({ medicineName: '', frequency: '', durationDays: 0 as any, instructions: '' })
                                    setEditingPrescriptionIndex(null)
                                    setShowAddPrescription(true)
                                }}
                                className="w-full py-3 border-2 border-dashed border-stone-300 rounded-xl text-stone-500 font-bold hover:border-amber-500 hover:text-amber-600 hover:bg-amber-50 transition-all flex items-center justify-center gap-2"
                            >
                                <PlusIcon className="w-5 h-5" />
                                Thêm thuốc vào đơn
                            </button>
                        </div>

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
                        </div>
                    </div>

                    {/* ========== RIGHT SIDEBAR ========== */}
                    <div className="col-span-4 space-y-4">
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
                                            className={`w-8 h-8 rounded-full text-sm font-bold transition-colors ${bcs === score
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
                                value={objective}
                                onChange={(e) => setObjective(e.target.value)}
                                placeholder="Kết quả khám lâm sàng..."
                                rows={3}
                                className="w-full border border-stone-300 rounded-lg p-3 text-sm"
                            />
                        </div>

                        {/* P - Plan */}
                        <div className="bg-white rounded-2xl p-6 shadow-sm">
                            <h3 className="font-bold text-amber-700 mb-4">
                                P - Kế hoạch (Plan) <span className="text-red-500">*</span>
                            </h3>
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
                            {errors.plan && (
                                <p className="text-red-500 text-sm mt-1">{errors.plan}</p>
                            )}
                        </div>

                        {/* Notes */}
                        <div className="bg-white rounded-2xl p-6 shadow-sm">
                            <h3 className="font-bold text-stone-700 mb-2">Ghi chú (Tùy chọn)</h3>
                            <textarea
                                value={notes}
                                onChange={(e) => setNotes(e.target.value)}
                                placeholder="Ghi chú thêm về ca khám..."
                                rows={3}
                                className="w-full border border-stone-300 rounded-lg p-3 text-sm focus:border-amber-500 focus:outline-none"
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
                                    className={`relative w-11 h-6 rounded-full transition-colors ${hasReExam ? 'bg-amber-500' : 'bg-stone-200'
                                        }`}
                                >
                                    <span
                                        className={`absolute top-1 left-1 bg-white w-4 h-4 rounded-full transition-transform ${hasReExam ? 'translate-x-[22px]' : 'translate-x-0'
                                            }`}
                                    />
                                </button>
                            </div>

                            {hasReExam && (
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
                            )}
                        </div>


                    </div>
                </div>

                {/* Submit Button */}
                <div className="flex justify-end mt-6">
                    <button
                        onClick={handleSubmit}
                        disabled={isLoading}
                        className="px-8 py-3 bg-amber-500 text-white font-bold rounded-xl hover:bg-amber-600 transition-colors disabled:opacity-50 text-lg shadow-lg"
                    >
                        {isLoading ? 'ĐANG LƯU...' : 'LƯU VÀ TIẾP TỤC'}
                    </button>
                </div>
            </div>

            {/* ========== ADD PRESCRIPTION MODAL ========== */}
            {showAddPrescription && (
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
                                placeholder="Ghi chú, lưu ý đặc biệt (VD: Uống sau bữa ăn 30 phút...)"
                                rows={3}
                                className="w-full border border-stone-300 rounded-lg p-3 mt-1"
                            />
                        </div>

                        <div className="flex gap-4">
                            <button
                                onClick={() => setShowAddPrescription(false)}
                                className="flex-1 px-4 py-3 border-2 border-stone-300 text-stone-700 font-bold rounded-lg hover:bg-stone-50"
                            >
                                Hủy
                            </button>
                            <button
                                onClick={handleSavePrescription}
                                className="flex-1 px-4 py-3 bg-amber-500 text-white font-bold rounded-lg hover:bg-amber-600"
                            >
                                Thêm thuốc
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Image Preview Modal */}
            {previewImage && (
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
            )}
        </div>
    )
}

export default CreateEmrPage
