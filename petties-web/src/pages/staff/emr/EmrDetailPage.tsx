import { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { ArrowLeftIcon, PencilIcon, CalendarDaysIcon } from '@heroicons/react/24/outline'
import { emrService } from '../../../services/emrService'
import type { EmrRecord, EmrImage } from '../../../services/emrService'
import { petService } from '../../../services/api/petService'
import { tokenStorage } from '../../../services/authService'

/**
 * VET - EMR Detail Page (Read-only SOAP view)
 * Updated to match Create/Edit Layout (3 columns)
 */
export const EmrDetailPage = () => {
    const { emrId } = useParams<{ emrId: string }>()
    const navigate = useNavigate()

    const [emr, setEmr] = useState<EmrRecord | null>(null)
    const [isLoading, setIsLoading] = useState(true)
    const [error, setError] = useState<string | null>(null)
    const [previewImage, setPreviewImage] = useState<EmrImage | null>(null)
    const [allergies, setAllergies] = useState('')

    const [petInfo, setPetInfo] = useState<any>(null)

    useEffect(() => {
        const fetchEmr = async () => {
            if (!emrId) return

            try {
                const data = await emrService.getEmrById(emrId)
                setEmr(data)

                // Fetch Pet Details
                try {
                    const pet = await petService.getPetById(data.petId)

                    let ageStr = 'N/A'
                    if (pet.dateOfBirth) {
                        const birthDate = new Date(pet.dateOfBirth)
                        const today = new Date()
                        const ageYears = today.getFullYear() - birthDate.getFullYear()
                        ageStr = `${ageYears} tuổi`
                    }

                    setPetInfo({
                        name: pet.name,
                        breed: pet.breed || 'N/A',
                        color: pet.color || 'Không rõ',
                        sex: pet.gender === 'MALE' ? 'Đực' : pet.gender === 'FEMALE' ? 'Cái' : pet.gender || 'N/A',
                        age: ageStr,
                        ownerName: pet.ownerName || 'N/A',
                        ownerPhone: pet.ownerPhone || 'N/A',
                        imageUrl: pet.imageUrl
                    })

                    if (pet.allergies) setAllergies(pet.allergies)
                } catch (petErr) {
                    console.error('Failed to load pet details', petErr)
                }

            } catch (err: any) {
                setError(err.response?.data?.message || 'Không thể tải bệnh án')
            } finally {
                setIsLoading(false)
            }
        }

        fetchEmr()
    }, [emrId])

    const formatDate = (dateStr: string) => {
        const date = new Date(dateStr)
        return date.toLocaleDateString('vi-VN', {
            day: '2-digit',
            month: '2-digit',
            year: 'numeric',
            hour: '2-digit',
            minute: '2-digit',
        })
    }

    const formatDateOnly = (dateStr: string) => {
        const date = new Date(dateStr)
        return date.toLocaleDateString('vi-VN', {
            day: '2-digit',
            month: '2-digit',
            year: 'numeric',
        })
    }

    if (isLoading) {
        return (
            <div className="flex items-center justify-center h-screen bg-stone-100">
                <div className="text-stone-500">Đang tải...</div>
            </div>
        )
    }

    if (error || !emr) {
        return (
            <div className="min-h-screen bg-stone-100 p-8 flex justify-center items-center">
                <div className="bg-white p-6 rounded-xl shadow-lg text-center max-w-md">
                    <p className="text-red-500 mb-4">{error || 'Không tìm thấy bệnh án'}</p>
                    <button onClick={() => navigate(-1)} className="px-4 py-2 bg-stone-200 rounded-lg text-stone-700">Quay lại</button>
                </div>
            </div>
        )
    }

    // Check edit permission
    // Logic: Backend 'isLocked' is the source of truth for time window.
    // Use loose equality for IDs to handle string/number mismatch.
    const currentUserId = tokenStorage.getUser()?.userId;
    // DEBUG: Inspect permission values
    console.log('[EmrDetail] Permissions Check:', {
        isLocked: emr.isLocked,
        currentUserId,
        emrStaffId: emr.staffId,
        idsMatch: String(currentUserId) === String(emr.staffId),
        createdAt: emr.createdAt,
        serverNow: new Date().toISOString() // Client time, not server time, but helpful
    });

    const isWithin24h = (new Date().getTime() - new Date(emr.createdAt).getTime()) < 24 * 60 * 60 * 1000;
    const canEdit = !emr.isLocked && String(currentUserId) === String(emr.staffId) && isWithin24h;

    return (
        <div className="min-h-screen bg-stone-100 p-6">
            <div className="max-w-7xl mx-auto">
                {/* Header */}
                <div className="flex items-center justify-between mb-6">
                    <div className="flex items-center gap-4">
                        <button onClick={() => navigate(-1)} className="p-2 hover:bg-stone-200 rounded-full">
                            <ArrowLeftIcon className="w-6 h-6 text-stone-600" />
                        </button>
                        <div>
                            <h1 className="text-2xl font-black text-stone-800">CHI TIẾT BỆNH ÁN</h1>
                            <div className="flex gap-4 text-xs text-stone-500 mt-1">
                                <span>Ngày khám: {formatDate(emr.examinationDate)}</span>
                                {emr.bookingCode && <span className="font-bold text-amber-600">Mã đặt lịch: #{emr.bookingCode}</span>}
                                {emr.updatedAt && <span>Cập nhật gần nhất: {formatDate(emr.updatedAt)}</span>}
                            </div>
                            <div className="text-xs text-stone-400 mt-0.5">
                                Tạo bởi: <span className="font-medium text-stone-600">{emr.staffName}</span> tại <span className="font-medium text-stone-600">{emr.clinicName}</span>
                            </div>
                        </div>
                    </div>
                    {canEdit && (
                        <button
                            onClick={() => navigate(`/staff/emr/edit/${emr.id}`)}
                            className="px-4 py-2 bg-amber-500 text-white font-bold rounded-lg flex items-center gap-2 hover:bg-amber-600 shadow-sm"
                        >
                            <PencilIcon className="w-4 h-4" />
                            Chỉnh sửa
                        </button>
                    )}
                </div>

                <div className="grid grid-cols-12 gap-6">

                    {/* ========== LEFT SIDEBAR (Pet Info) [Col-3] ========== */}
                    <div className="col-span-12 lg:col-span-3 space-y-4">
                        <div className="bg-white rounded-2xl p-6 shadow-sm">
                            <div className="flex flex-col items-center mb-4">
                                <div className="w-24 h-24 bg-stone-200 rounded-full flex items-center justify-center text-5xl mb-3 border-4 border-stone-300 overflow-hidden">
                                    <span className="font-bold text-amber-600">{emr.petName?.charAt(0) || 'P'}</span>
                                </div>
                                <h2 className="text-2xl font-black text-stone-800 text-center">{emr.petName}</h2>
                            </div>
                            <div className="space-y-2 text-sm">
                                <div className="flex justify-between">
                                    <span className="text-stone-500">Giống:</span>
                                    <span className="font-semibold text-stone-800">{petInfo?.breed || emr.petBreed}</span>
                                </div>
                                <div className="flex justify-between">
                                    <span className="text-stone-500">Màu lông:</span>
                                    <span className="font-semibold text-stone-800">{petInfo?.color || 'Không rõ'}</span>
                                </div>
                                <div className="flex justify-between">
                                    <span className="text-stone-500">Giới tính:</span>
                                    <span className="font-semibold text-stone-800">{petInfo?.sex || 'N/A'}</span>
                                </div>
                                <div className="flex justify-between">
                                    <span className="text-stone-500">Tuổi:</span>
                                    <span className="font-semibold text-stone-800">{petInfo?.age || 'N/A'}</span>
                                </div>
                                <div className="flex justify-between">
                                    <span className="text-stone-500">Cân nặng:</span>
                                    <span className="font-semibold text-stone-800">{emr.weightKg ?? 'N/A'} kg</span>
                                </div>
                                <div className="border-t border-stone-200 mt-2 pt-2 space-y-2">
                                    <div className="flex justify-between">
                                        <span className="text-stone-500">Chủ sở hữu:</span>
                                        <span className="font-semibold text-stone-800">{petInfo?.ownerName || emr.ownerName}</span>
                                    </div>
                                    <div className="flex justify-between">
                                        <span className="text-stone-500">Liên hệ:</span>
                                        <span className="font-semibold text-stone-800">{petInfo?.ownerPhone || 'N/A'}</span>
                                    </div>
                                </div>
                            </div>

                            <div className="mt-4 border-t border-stone-200 pt-4">
                                <label className="text-stone-500 text-sm font-semibold flex items-center justify-between mb-1">
                                    Dị ứng / Lưu ý:
                                </label>
                                <textarea
                                    value={allergies}
                                    readOnly
                                    placeholder="Không có ghi nhận dị ứng."
                                    rows={2}
                                    className="w-full text-sm border border-stone-300 rounded-lg p-2 focus:outline-none bg-stone-50 text-stone-500"
                                />
                            </div>
                        </div>
                    </div>

                    {/* ========== CENTER: SOAP (S, A, Rx, Images) [Col-5] ========== */}
                    <div className="col-span-12 lg:col-span-5 space-y-4">

                        <div className="bg-white rounded-2xl p-6 shadow-sm">
                            <h2 className="text-xl font-black text-stone-800 mb-6">Biểu mẫu SOAP (Chi tiết)</h2>

                            {/* S */}
                            <div className="mb-6">
                                <div className="flex items-center gap-2 mb-2">
                                    <span className="bg-amber-100 text-amber-700 font-bold px-2 py-0.5 rounded text-xs">S</span>
                                    <h3 className="font-bold text-stone-700">Chủ quan (Subjective)</h3>
                                </div>
                                <div className="bg-stone-50 p-4 rounded-xl border border-stone-100 text-stone-800 whitespace-pre-wrap text-sm">
                                    {emr.subjective || 'Không có thông tin'}
                                </div>
                            </div>

                            {/* A */}
                            <div className="mb-2">
                                <div className="flex items-center gap-2 mb-2">
                                    <span className="bg-amber-100 text-amber-700 font-bold px-2 py-0.5 rounded text-xs">A</span>
                                    <h3 className="font-bold text-stone-700">Đánh giá (Assessment)</h3>
                                </div>
                                <div className="bg-stone-50 p-4 rounded-xl border border-stone-100 text-stone-800 whitespace-pre-wrap font-medium text-sm">
                                    {emr.assessment || 'Chưa có chẩn đoán'}
                                </div>
                            </div>
                        </div>

                        {/* Rx */}
                        <div className="bg-white rounded-2xl p-6 shadow-sm">
                            <h3 className="font-bold text-stone-700 mb-4">Đơn thuốc</h3>
                            {emr.prescriptions && emr.prescriptions.length > 0 ? (
                                <div className="border border-stone-200 rounded-xl overflow-hidden">
                                    <div className="grid grid-cols-12 gap-2 p-3 bg-stone-50 border-b border-stone-100 text-xs font-bold text-stone-500 uppercase tracking-wide">
                                        <div className="col-span-4 pl-1">Tên thuốc</div>
                                        <div className="col-span-2">Liều lượng</div>
                                        <div className="col-span-2">Tần suất</div>
                                        <div className="col-span-2 text-center">Thời gian</div>
                                        <div className="col-span-2 text-right"></div>
                                    </div>
                                    <div className="divide-y divide-stone-100 bg-white">
                                        {emr.prescriptions.map((p, i) => (
                                            <div key={i} className="grid grid-cols-12 gap-2 p-3 items-center text-xs text-stone-600">
                                                <div className="col-span-4 font-bold text-stone-700 truncate pl-1" title={p.medicineName}>{p.medicineName}</div>
                                                <div className="col-span-2 truncate">{p.dosage}</div>
                                                <div className="col-span-2 truncate">{p.frequency}</div>
                                                <div className="col-span-2 text-center">{p.durationDays} ngày</div>
                                                {p.instructions && (
                                                    <div className="col-span-12 text-stone-400 italic mt-1 pl-1">
                                                        HDSD: {p.instructions}
                                                    </div>
                                                )}
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            ) : (
                                <p className="text-stone-400 text-sm italic">Không có đơn thuốc</p>
                            )}
                        </div>

                        {/* Images */}
                        {emr.images && emr.images.length > 0 && (
                            <div className="bg-white rounded-2xl p-6 shadow-sm">
                                <h3 className="font-bold text-stone-700 mb-4">Hình ảnh lâm sàng</h3>
                                <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                                    {emr.images.map((img, i) => (
                                        <div key={i} className="border border-stone-200 rounded-lg p-2">
                                            <img
                                                src={img.url}
                                                alt=""
                                                className="h-24 w-full object-cover rounded-lg cursor-pointer hover:opacity-75"
                                                onClick={() => setPreviewImage(img)}
                                            />
                                            {img.description && (
                                                <p className="text-xs text-stone-500 mt-2 truncate">{img.description}</p>
                                            )}
                                        </div>
                                    ))}
                                </div>
                            </div>
                        )}
                    </div>

                    {/* ========== RIGHT SIDEBAR (O, P, Notes, ReExam) [Col-4] ========== */}
                    <div className="col-span-12 lg:col-span-4 space-y-4">

                        {/* O */}
                        <div className="bg-white rounded-2xl p-6 shadow-sm">
                            <div className="flex items-center gap-2 mb-4">
                                <span className="bg-amber-100 text-amber-700 font-bold px-2 py-0.5 rounded text-xs">O</span>
                                <h3 className="font-bold text-stone-700">Khách quan (Objective)</h3>
                            </div>

                            <div className="grid grid-cols-2 gap-3 mb-4">
                                <div className="bg-stone-50 p-3 rounded-xl border border-stone-100">
                                    <p className="text-xs text-stone-500 uppercase font-bold">Nhiệt độ</p>
                                    <p className="text-lg font-bold text-stone-800">{emr.temperatureC ? `${emr.temperatureC}°C` : '-'}</p>
                                </div>
                                <div className="bg-stone-50 p-3 rounded-xl border border-stone-100">
                                    <p className="text-xs text-stone-500 uppercase font-bold">Nhịp tim</p>
                                    <p className="text-lg font-bold text-stone-800">{emr.heartRate ? `${emr.heartRate} bpm` : '-'}</p>
                                </div>
                                <div className="col-span-2">
                                    <p className="text-xs text-stone-500 uppercase font-bold mb-2">BCS (Điểm thể trạng)</p>
                                    <div className="flex gap-1 flex-wrap">
                                        {[1, 2, 3, 4, 5, 6, 7, 8, 9].map(score => (
                                            <div
                                                key={score}
                                                className={`w-8 h-8 rounded-full text-sm font-bold flex items-center justify-center ${emr.bcs === score
                                                    ? 'bg-amber-500 text-white'
                                                    : 'bg-stone-100 text-stone-400'
                                                    }`}
                                            >
                                                {score}
                                            </div>
                                        ))}
                                    </div>
                                    <p className="text-xs text-stone-400 mt-1">1-3: Gầy | 4-5: Bình thường | 6-9: Thừa cân</p>
                                </div>
                            </div>

                            <div className="bg-stone-50 p-4 rounded-xl border border-stone-100 text-stone-800 whitespace-pre-wrap text-sm">
                                {emr.objective || 'Không có ghi chú thêm.'}
                            </div>
                        </div>

                        {/* P */}
                        <div className="bg-white rounded-2xl p-6 shadow-sm">
                            <div className="flex items-center gap-2 mb-4">
                                <span className="bg-amber-100 text-amber-700 font-bold px-2 py-0.5 rounded text-xs">P</span>
                                <h3 className="font-bold text-stone-700">Kế hoạch (Plan)</h3>
                            </div>
                            <div className="bg-stone-50 p-4 rounded-xl border border-stone-100 text-stone-800 whitespace-pre-wrap text-sm">
                                {emr.plan || 'Chưa có kế hoạch'}
                            </div>
                        </div>

                        {/* Notes */}
                        {emr.notes && (
                            <div className="bg-white rounded-2xl p-6 shadow-sm">
                                <h3 className="font-bold text-stone-700 mb-2">Ghi chú</h3>
                                <div className="text-stone-600 text-sm whitespace-pre-wrap">
                                    {emr.notes}
                                </div>
                            </div>
                        )}

                        {/* Re-examination */}
                        {emr.reExaminationDate && (
                            <div className="bg-white rounded-2xl p-6 shadow-sm border-2 border-amber-100">
                                <h3 className="font-bold text-stone-700 flex items-center gap-2 mb-2">
                                    <CalendarDaysIcon className="w-5 h-5 text-amber-500" />
                                    Hẹn tái khám
                                </h3>
                                <p className="text-xl font-black text-amber-600">
                                    {formatDateOnly(emr.reExaminationDate)}
                                </p>
                            </div>
                        )}

                    </div>

                </div>

            </div>

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

export default EmrDetailPage
