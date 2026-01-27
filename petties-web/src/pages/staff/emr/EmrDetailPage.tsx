import { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { ArrowLeftIcon, PencilIcon } from '@heroicons/react/24/outline'
import { emrService } from '../../../services/emrService'
import type { EmrRecord, EmrImage } from '../../../services/emrService'
import { tokenStorage } from '../../../services/authService'

/**
 * VET - EMR Detail Page (Read-only SOAP view)
 */
export const EmrDetailPage = () => {
    const { emrId } = useParams<{ emrId: string }>()
    const navigate = useNavigate()

    const [emr, setEmr] = useState<EmrRecord | null>(null)
    const [isLoading, setIsLoading] = useState(true)
    const [error, setError] = useState<string | null>(null)
    const [previewImage, setPreviewImage] = useState<EmrImage | null>(null)

    useEffect(() => {
        const fetchEmr = async () => {
            if (!emrId) return

            try {
                const data = await emrService.getEmrById(emrId)
                setEmr(data)
            } catch (err: any) {
                setError(err.response?.data?.message || 'Không thể tải bệnh án')
            } finally {
                setIsLoading(false)
            }
        }

        fetchEmr()
    }, [emrId])

    const formatDate = (dateStr: string) => {
        // Backend stores LocalDateTime (local time without timezone info)
        // Parse it directly without adding 'Z' to avoid timezone conversion
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
            <div className="flex items-center justify-center h-96">
                <div className="text-stone-500">Đang tải...</div>
            </div>
        )
    }

    if (error || !emr) {
        return (
            <div className="p-8">
                <div className="bg-red-50 border-2 border-red-400 p-6 text-red-700">
                    {error || 'Không tìm thấy bệnh án'}
                </div>
            </div>
        )
    }

    return (
        <div className="p-8 max-w-4xl mx-auto">
            {/* Header */}
            <div className="flex items-center justify-between mb-8">
                <div>
                    <h1 className="heading-brutal text-stone-900">
                        CHI TIẾT BỆNH ÁN
                    </h1>
                    <p className="text-stone-600">{formatDate(emr.examinationDate)}</p>
                </div>
                <div className="flex gap-3">
                    {!emr.isLocked &&
                        String(tokenStorage.getUser()?.userId) === emr.staffId &&
                        (new Date().getTime() - new Date(emr.createdAt).getTime()) / (1000 * 60 * 60) < 24 && (
                            <button
                                onClick={() => navigate(`/staff/emr/edit/${emr.id}`)}
                                className="btn-brutal-sm bg-amber-500 text-white flex items-center gap-2 hover:bg-amber-600"
                            >
                                <PencilIcon className="w-4 h-4" />
                                Chỉnh sửa
                            </button>
                        )}

                    <button
                        onClick={() => navigate(-1)}
                        className="btn-brutal-sm bg-stone-200 text-stone-700 flex items-center gap-2"
                    >
                        <ArrowLeftIcon className="w-4 h-4" />
                        Quay lại
                    </button>
                </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                {/* Left Side - Pet & Info */}
                <div className="lg:col-span-1 space-y-6">
                    {/* Pet Card */}
                    <div className="border-brutal bg-white p-6 shadow-brutal">
                        <div className="flex items-center gap-4 mb-4">
                            <div className="w-16 h-16 bg-amber-100 border-2 border-stone-900 flex items-center justify-center text-2xl font-bold text-amber-600">
                                {emr.petName?.charAt(0) || 'P'}
                            </div>
                            <div>
                                <h2 className="text-xl font-black text-stone-900">{emr.petName}</h2>
                                <p className="text-stone-600">{emr.petSpecies} • {emr.petBreed}</p>
                            </div>
                        </div>

                        <div className="space-y-2 text-sm">
                            <div className="flex items-center gap-2 text-stone-600">
                                <span className="font-bold">Phòng khám:</span>
                                <span>{emr.clinicName}</span>
                            </div>
                            <div className="flex items-center gap-2 text-stone-600">
                                <span className="font-bold">Bác sĩ:</span>
                                <span>BS. {emr.vetName}</span>
                            </div>
                            {emr.ownerName && (
                                <div className="flex items-center gap-2 text-stone-600">
                                    <span className="font-bold">Chủ nuôi:</span>
                                    <span>{emr.ownerName}</span>
                                </div>
                            )}
                        </div>
                    </div>

                    {/* Vitals */}
                    {(emr.weightKg || emr.temperatureC || emr.heartRate || emr.bcs) && (
                        <div className="border-brutal bg-white p-6 shadow-brutal">
                            <h3 className="text-lg font-bold text-stone-900 mb-4">CHỈ SỐ SINH TỒN</h3>
                            <div className="grid grid-cols-2 gap-3">
                                {emr.temperatureC && (
                                    <div className="bg-stone-50 p-3 border border-stone-200">
                                        <p className="text-xs text-stone-500">Nhiệt độ</p>
                                        <p className="text-lg font-bold text-stone-900">{emr.temperatureC}°C</p>
                                    </div>
                                )}
                                {emr.weightKg && (
                                    <div className="bg-stone-50 p-3 border border-stone-200">
                                        <p className="text-xs text-stone-500">Cân nặng</p>
                                        <p className="text-lg font-bold text-stone-900">{emr.weightKg} kg</p>
                                    </div>
                                )}
                                {emr.heartRate && (
                                    <div className="bg-stone-50 p-3 border border-stone-200">
                                        <p className="text-xs text-stone-500">Nhịp tim</p>
                                        <p className="text-lg font-bold text-stone-900">{emr.heartRate} bpm</p>
                                    </div>
                                )}
                                {emr.bcs && (
                                    <div className="bg-stone-50 p-3 border border-stone-200">
                                        <p className="text-xs text-stone-500">BCS</p>
                                        <p className="text-lg font-bold text-amber-600">{emr.bcs}</p>
                                    </div>
                                )}
                            </div>
                        </div>
                    )}

                    {/* Prescriptions */}
                    {emr.prescriptions.length > 0 && (
                        <div className="border-brutal bg-white p-6 shadow-brutal">
                            <h3 className="text-lg font-bold text-stone-900 mb-4">ĐƠN THUỐC</h3>
                            <div className="space-y-3">
                                {emr.prescriptions.map((p, i) => (
                                    <div key={i} className="p-3 bg-stone-50 border border-stone-200">
                                        <p className="font-bold text-stone-900">{p.medicineName} {p.dosage}</p>
                                        <p className="text-sm text-stone-600">{p.frequency} x {p.durationDays} ngày</p>
                                        {p.instructions && (
                                            <p className="text-xs text-stone-500 italic mt-1">{p.instructions}</p>
                                        )}
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}

                    {/* Images */}
                    {emr.images.length > 0 && (
                        <div className="border-brutal bg-white p-6 shadow-brutal">
                            <h3 className="text-lg font-bold text-stone-900 mb-4">ẢNH LÂM SÀNG</h3>
                            <div className="grid grid-cols-2 gap-4">
                                {emr.images.map((img, i) => (
                                    <div key={i} className="border border-stone-200 rounded-lg overflow-hidden">
                                        <img
                                            src={img.url}
                                            alt={img.description || ''}
                                            className="w-full h-32 object-contain bg-stone-100 cursor-pointer hover:opacity-75 transition-opacity"
                                            onClick={() => setPreviewImage(img)}
                                        />
                                        {img.description && (
                                            <p className="text-xs text-stone-600 p-2 bg-stone-50">{img.description}</p>
                                        )}
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}
                </div>

                {/* Right Side - SOAP Notes */}
                <div className="lg:col-span-2 space-y-6">
                    {/* S - Subjective */}
                    {emr.subjective && (
                        <div className="border-brutal bg-white shadow-brutal">
                            <div className="flex items-center gap-3 p-4 bg-stone-100 border-b-2 border-stone-900">
                                <span className="bg-amber-500 text-white font-bold px-3 py-1 border-2 border-stone-900">S</span>
                                <h3 className="text-lg font-bold text-stone-900">TRIỆU CHỨNG (Subjective)</h3>
                            </div>
                            <div className="p-6">
                                <p className="text-stone-800 whitespace-pre-wrap">{emr.subjective}</p>
                            </div>
                        </div>
                    )}

                    {/* O - Objective */}
                    {emr.objective && (
                        <div className="border-brutal bg-white shadow-brutal">
                            <div className="flex items-center gap-3 p-4 bg-stone-100 border-b-2 border-stone-900">
                                <span className="bg-amber-500 text-white font-bold px-3 py-1 border-2 border-stone-900">O</span>
                                <h3 className="text-lg font-bold text-stone-900">QUAN SÁT LÂM SÀNG (Objective)</h3>
                            </div>
                            <div className="p-6">
                                <p className="text-stone-800 whitespace-pre-wrap">{emr.objective}</p>
                            </div>
                        </div>
                    )}

                    {/* A - Assessment */}
                    <div className="border-brutal bg-white shadow-brutal">
                        <div className="flex items-center gap-3 p-4 bg-stone-100 border-b-2 border-stone-900">
                            <span className="bg-amber-500 text-white font-bold px-3 py-1 border-2 border-stone-900">A</span>
                            <h3 className="text-lg font-bold text-stone-900">CHẨN ĐOÁN (Assessment)</h3>
                        </div>
                        <div className="p-6">
                            <p className="text-stone-800 whitespace-pre-wrap font-medium">{emr.assessment}</p>
                        </div>
                    </div>

                    {/* P - Plan */}
                    <div className="border-brutal bg-white shadow-brutal">
                        <div className="flex items-center gap-3 p-4 bg-stone-100 border-b-2 border-stone-900">
                            <span className="bg-amber-500 text-white font-bold px-3 py-1 border-2 border-stone-900">P</span>
                            <h3 className="text-lg font-bold text-stone-900">PHÁC ĐỒ ĐIỀU TRỊ (Plan)</h3>
                        </div>
                        <div className="p-6">
                            <p className="text-stone-800 whitespace-pre-wrap">{emr.plan}</p>
                        </div>
                    </div>

                    {/* Notes */}
                    {emr.notes && (
                        <div className="border-brutal bg-white shadow-brutal">
                            <div className="flex items-center gap-3 p-4 bg-stone-100 border-b-2 border-stone-900">
                                <h3 className="text-lg font-bold text-stone-900">GHI CHÚ</h3>
                            </div>
                            <div className="p-6">
                                <p className="text-stone-800 whitespace-pre-wrap">{emr.notes}</p>
                            </div>
                        </div>
                    )}

                    {/* Re-examination Date */}
                    {emr.reExaminationDate && (
                        <div className="border-brutal bg-amber-50 shadow-brutal">
                            <div className="flex items-center gap-3 p-4 bg-amber-100 border-b-2 border-stone-900">
                                <h3 className="text-lg font-bold text-stone-900">HẸN TÁI KHÁM</h3>
                            </div>
                            <div className="p-6">
                                <p className="text-amber-700 font-bold text-xl">{formatDateOnly(emr.reExaminationDate)}</p>
                            </div>
                        </div>
                    )}
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
