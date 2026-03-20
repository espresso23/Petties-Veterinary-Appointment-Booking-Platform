import { useState } from 'react'
import { PhotoIcon, SparklesIcon } from '@heroicons/react/24/outline'
import {
    diagnosisApi,
    type StaffDiagnosisRequest,
    type StaffDiagnosisResponse,
} from '../../services/agentService'

interface AIDiagnosisPanelProps {
    petId?: string
    bookingId?: string
    species?: string
    breed?: string
    ageMonths?: number
    weightKg?: number
    allergies?: string[]
    subjective: string
    objective: string
    assessment: string
    plan: string
    imageUrls: string[]
    pendingImageUrls?: string[]  // Preview URLs for images not yet uploaded
    onDiagnosisResult?: (result: StaffDiagnosisResponse | null) => void
    onApplyDraft?: (draft: StaffDiagnosisResponse['soap_suggestions']) => void
}

const mapSpecies = (species?: string): 'dog' | 'cat' | 'other' => {
    const normalized = (species || '').toLowerCase()
    if (normalized.includes('dog') || normalized.includes('cho')) return 'dog'
    if (normalized.includes('cat') || normalized.includes('mèo') || normalized.includes('meo')) return 'cat'
    return 'other'
}

export const AIDiagnosisPanel = ({
    petId,
    bookingId,
    species,
    breed,
    ageMonths,
    weightKg,
    allergies,
    subjective,
    objective,
    assessment,
    plan,
    imageUrls,
    pendingImageUrls = [],
    onDiagnosisResult,
    onApplyDraft,
}: AIDiagnosisPanelProps) => {
    const [clinicalNarrative, setClinicalNarrative] = useState('')
    const [loading, setLoading] = useState(false)
    const [error, setError] = useState<string | null>(null)
    const [result, setResult] = useState<StaffDiagnosisResponse | null>(null)

    const normalizedImageUrls = imageUrls.filter(Boolean)
    const allImageUrls = [...normalizedImageUrls, ...pendingImageUrls.filter(Boolean)]
    const normalizedWeightKg = typeof weightKg === 'number' && Number.isFinite(weightKg) ? weightKg : undefined
    const canAnalyze = clinicalNarrative.trim().length >= 5 || allImageUrls.length > 0

    const handleAnalyze = async () => {
        if (!canAnalyze) return

        setLoading(true)
        setError(null)

        try {
            const payload: StaffDiagnosisRequest = {
                pet_id: petId,
                booking_id: bookingId,
                species: mapSpecies(species),
                breed,
                age_months: ageMonths,
                weight_kg: normalizedWeightKg,
                sex: 'unknown',
                allergies: allergies?.filter(Boolean) || [],
                doctor_description: clinicalNarrative.trim(),
                image_urls: allImageUrls,
                soap_draft: {
                    subjective,
                    objective,
                    assessment,
                    plan,
                },
            }
            const response = await diagnosisApi.analyzeCase(payload)
            setResult(response)
            onDiagnosisResult?.(response)
            onApplyDraft?.(response.soap_suggestions)
        } catch (err) {
            setResult(null)
            onDiagnosisResult?.(null)
            setError(err instanceof Error ? err.message : 'Không thể phân tích tình trạng của thú cưng.')
        } finally {
            setLoading(false)
        }
    }

    return (
        <div className="rounded-2xl border border-stone-200 bg-white p-6 shadow-sm">
            <div className="flex items-center gap-2 mb-4">
                <SparklesIcon className="w-5 h-5 text-amber-600" />
                <h3 className="text-sm font-bold uppercase tracking-wide text-stone-800">Hỗ trợ AI chẩn đoán</h3>
            </div>

            <div className="space-y-3">
                <textarea
                    value={clinicalNarrative}
                    onChange={(e) => setClinicalNarrative(e.target.value)}
                    rows={4}
                    placeholder="Mô tả ngắn tình trạng của bé tại đây. Có thể ghi chung triệu chứng, vùng nghi ngờ, diễn tiến và nhận định ban đầu trong cùng một ô."
                    className="w-full border border-stone-300 rounded-lg p-3 text-sm focus:outline-none focus:border-amber-500"
                />

                <div className="rounded-xl border border-stone-200 bg-stone-50 p-3 text-xs text-stone-600">
                    <div className="flex items-center gap-2 font-bold text-stone-800">
                        <PhotoIcon className="h-4 w-4 text-amber-600" />
                        Ảnh AI đang đọc
                    </div>
                    <p className="mt-1">
                        AI đọc ảnh lâm sình từ EMR và ảnh mới chọn (preview) trước khi tải lên.
                    </p>
                    {pendingImageUrls.length > 0 && (
                        <p className="mt-1 text-amber-700 font-semibold">
                            Có {pendingImageUrls.length} ảnh mới chờ tải lên.
                        </p>
                    )}
                    <p className="mt-1 font-semibold text-stone-700">
                        Tổng {allImageUrls.length} ảnh sẵn sàng cho AI.
                    </p>
                </div>

                <button
                    type="button"
                    onClick={() => void handleAnalyze()}
                    disabled={loading || !canAnalyze}
                    className="w-full rounded-xl bg-orange-600 px-6 py-2.5 text-sm font-bold uppercase tracking-wide text-white shadow-lg shadow-orange-100 transition-all hover:bg-orange-700 active:scale-95 disabled:cursor-not-allowed disabled:opacity-50"
                >
                    {loading ? 'Đang phân tích...' : 'Phân tích tình trạng của bé'}
                </button>

                {!canAnalyze && (
                    <p className="text-xs text-stone-500">
                        Cần nhập mô tả tình trạng của thú cưng hoặc tải lên ít nhất một ảnh lâm sàng để AI phân tích.
                    </p>
                )}
                {error && <p className="text-xs text-red-600 font-semibold">{error}</p>}
            </div>

            {result && (
                <div className="mt-5 space-y-4 border-t border-stone-200 pt-4">
                    <div>
                        <h4 className="mb-2 text-xs font-bold uppercase tracking-wide text-stone-700">Chẩn đoán phân biệt</h4>
                        <div className="space-y-2">
                            {result.top_differentials.slice(0, 3).map((item, idx) => (
                                <div key={`${item.display_name_vi}-${idx}`} className="rounded-2xl border border-stone-200 bg-stone-50/70 p-3">
                                    <p className="text-sm font-bold text-stone-900">{item.display_name_vi}</p>
                                    <p className="text-xs text-stone-600">{item.confidence_note}</p>
                                    {item.supporting_reasons.length > 0 && (
                                        <ul className="mt-2 space-y-1">
                                            {item.supporting_reasons.slice(0, 2).map((reason, reasonIndex) => (
                                                <li key={`${reason}-${reasonIndex}`} className="text-xs text-stone-600">
                                                    - {reason}
                                                </li>
                                            ))}
                                        </ul>
                                    )}
                                </div>
                            ))}
                        </div>
                    </div>

                    <div>
                        <h4 className="mb-2 text-xs font-bold uppercase tracking-wide text-stone-700">Dấu hiệu từ ảnh</h4>
                        <ul className="space-y-1">
                            {result.vision_findings.length === 0 && (
                                <li className="text-xs text-stone-500">Chưa có dấu hiệu từ ảnh hoặc chưa có ảnh lâm sàng.</li>
                            )}
                            {result.vision_findings.map((finding, idx) => (
                                <li key={`${finding}-${idx}`} className="text-xs text-stone-700">
                                    - {finding}
                                </li>
                            ))}
                        </ul>
                    </div>

                    {result.image_analysis && result.image_analysis.length > 0 && (
                        <div>
                            <h4 className="mb-2 text-xs font-bold uppercase tracking-wide text-stone-700">AI đọc ảnh</h4>
                            <div className="space-y-3">
                                {result.image_analysis.map((img, idx) => (
                                    <div key={`img-${idx}`} className="rounded-xl border border-stone-200 bg-white overflow-hidden">
                                        <img
                                            src={img.url}
                                            alt={`Ảnh ${img.order}`}
                                            className="w-full h-32 object-cover"
                                        />
                                        <div className="p-2">
                                            <p className="text-[11px] font-semibold text-stone-600 mb-1">
                                                Ảnh {img.order}: {img.description || 'Chưa có mô tả'}
                                            </p>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}

                    {result.prescription_suggestions.length > 0 && (
                        <div>
                            <h4 className="mb-2 text-xs font-bold uppercase tracking-wide text-stone-700">Gợi ý đơn thuốc nháp</h4>
                            <div className="space-y-2">
                                {result.prescription_suggestions.map((item, idx) => (
                                    <div key={`${item.medicine_name}-${idx}`} className="rounded-2xl border border-stone-200 bg-stone-50/70 p-3">
                                        <p className="text-sm font-bold text-stone-900">{item.medicine_name}</p>
                                        <p className="text-xs text-stone-600">
                                            {item.dosage || 'Theo toa'} | {item.frequency || 'Theo chỉ định'} | {item.duration_days ?? '-'} ngày
                                        </p>
                                        {item.caution && (
                                            <p className="mt-1 text-[11px] font-semibold text-red-600">{item.caution}</p>
                                        )}
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}

                    {result.prescription_suggestions.length === 0 && (
                        <div className="rounded-2xl border border-amber-200 bg-amber-50/80 p-3">
                            <h4 className="mb-1 text-xs font-bold uppercase tracking-wide text-amber-800">Đơn thuốc AI chưa sẵn sàng</h4>
                            <p className="text-xs text-amber-800">
                                AI chưa đề xuất đơn thuốc nháp cho ca này. Nguyên nhân thường gặp là chưa có đủ evidence nội bộ
                                hoặc còn thiếu dữ liệu như cân nặng để tính liều an toàn.
                            </p>
                        </div>
                    )}

                    {result.suggested_questions.length > 0 && (
                        <div>
                            <h4 className="mb-2 text-xs font-bold uppercase tracking-wide text-stone-700">Cần hỏi thêm</h4>
                            <ul className="space-y-1">
                                {result.suggested_questions.map((question, idx) => (
                                    <li key={`${question}-${idx}`} className="text-xs text-stone-700">
                                        - {question}
                                    </li>
                                ))}
                            </ul>
                        </div>
                    )}

                    <div className="rounded-2xl border border-amber-200 bg-amber-50/80 p-3">
                        <p className="text-xs text-amber-800">{result.disclaimer}</p>
                    </div>
                </div>
            )}
        </div>
    )
}

export default AIDiagnosisPanel
