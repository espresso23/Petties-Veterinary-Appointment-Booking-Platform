import { useState, useEffect, useRef } from 'react'
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
    onPendingImageDescriptionsChange?: (descriptions: Record<string, string>) => void
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
    onPendingImageDescriptionsChange,
}: AIDiagnosisPanelProps) => {
    const [clinicalNarrative, setClinicalNarrative] = useState('')
    const [loading, setLoading] = useState(false)
    const [error, setError] = useState<string | null>(null)
    const [result, setResult] = useState<StaffDiagnosisResponse | null>(null)
    const [showResultDetails, setShowResultDetails] = useState(false)
    const [imageDescriptions, setImageDescriptions] = useState<Record<string, string>>({})
    const analyzedImagesRef = useRef<Set<string>>(new Set())
    const imagesLoadingRef = useRef<Set<string>>(new Set())
    const imageDescriptionsRef = useRef<Record<string, string>>({})
    const isMountedRef = useRef(true)

    const normalizedImageUrls = imageUrls.filter(Boolean)
    const allImageUrls = [...normalizedImageUrls, ...pendingImageUrls.filter(Boolean)]
    const normalizedWeightKg = typeof weightKg === 'number' && Number.isFinite(weightKg) ? weightKg : undefined
    const canAnalyze = clinicalNarrative.trim().length >= 5 || allImageUrls.length > 0

    const sanitizeDiagnosisResponse = (
        response: StaffDiagnosisResponse,
        displayImageUrls: string[]
    ): StaffDiagnosisResponse => ({
        ...response,
        image_analysis: (response.image_analysis || []).map((item, index) => ({
            ...item,
            url: displayImageUrls[index] || item.url,
        })),
    })

    useEffect(() => {
        isMountedRef.current = true
        return () => {
            isMountedRef.current = false
        }
    }, [])

    useEffect(() => {
        const analyzePendingImages = async () => {
            for (const imageUrl of pendingImageUrls) {
                if (analyzedImagesRef.current.has(imageUrl) || imagesLoadingRef.current.has(imageUrl)) {
                    continue
                }
                if (!isMountedRef.current) return
                analyzedImagesRef.current.add(imageUrl)
                imagesLoadingRef.current.add(imageUrl)

                const description = await analyzeSingleImage(imageUrl)

                if (!isMountedRef.current) return
                imagesLoadingRef.current.delete(imageUrl)

                if (description) {
                    imageDescriptionsRef.current[imageUrl] = description
                    setImageDescriptions({ ...imageDescriptionsRef.current })
                }
            }
        }

        if (pendingImageUrls.length > 0) {
            void analyzePendingImages()
        }
    }, [pendingImageUrls])

    useEffect(() => {
        onPendingImageDescriptionsChange?.(imageDescriptions)
    }, [imageDescriptions, onPendingImageDescriptionsChange])

    const convertBlobToBase64 = async (url: string): Promise<string> => {
        if (!url.startsWith('blob:')) return url
        try {
            const response = await fetch(url)
            const blob = await response.blob()
            return new Promise((resolve, reject) => {
                const reader = new FileReader()
                reader.onloadend = () => resolve(reader.result as string)
                reader.onerror = reject
                reader.readAsDataURL(blob)
            })
        } catch {
            return url
        }
    }

    const analyzeSingleImage = async (imageUrl: string): Promise<string | null> => {
        try {
            const processedUrl = await convertBlobToBase64(imageUrl)
            const payload: StaffDiagnosisRequest = {
                species: mapSpecies(species),
                pet_id: petId,
                booking_id: bookingId,
                breed,
                age_months: ageMonths,
                weight_kg: normalizedWeightKg,
                sex: 'unknown',
                allergies: allergies?.filter(Boolean) || [],
                doctor_description: clinicalNarrative.trim().length >= 5
                    ? clinicalNarrative.trim()
                    : 'Mô tả ảnh lâm sàng này',
                image_urls: [processedUrl],
                image_analysis_mode: 'describe_only',
            }
            const response = await diagnosisApi.analyzeCase(payload)
            if (response.image_descriptions && response.image_descriptions.length > 0) {
                return response.image_descriptions[0]
            }
            if (response.vision_findings && response.vision_findings.length > 0) {
                return response.vision_findings.join('; ')
            }
            return null
        } catch (err) {
            console.error('Failed to analyze image:', err)
            return null
        }
    }

    const handleAnalyze = async () => {
        if (!canAnalyze) return

        setLoading(true)
        setError(null)

        try {
            const processedImageUrls = await Promise.all(allImageUrls.map(url => convertBlobToBase64(url)))

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
                image_urls: processedImageUrls,
                image_analysis_mode: 'full',
                soap_draft: {
                    subjective,
                    objective,
                    assessment,
                    plan,
                },
            }
            const response = await diagnosisApi.analyzeCase(payload)
            const sanitizedResponse = sanitizeDiagnosisResponse(response, allImageUrls)
            setResult(sanitizedResponse)
            setShowResultDetails(false)
            onDiagnosisResult?.(sanitizedResponse)
            onApplyDraft?.(sanitizedResponse.soap_suggestions)
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
                    <div className="rounded-2xl border border-amber-200 bg-amber-50/80 p-3">
                        <div className="flex flex-wrap items-start justify-between gap-3">
                            <div>
                                <h4 className="text-xs font-bold uppercase tracking-wide text-amber-800">Kết quả AI đã sẵn sàng</h4>
                                <p className="mt-1 text-xs text-stone-700">
                                    {result.top_differentials.length} chẩn đoán phân biệt, {result.prescription_suggestions.length} gợi ý đơn thuốc,
                                    {result.suggested_questions.length} câu hỏi cần khai thác thêm.
                                </p>
                            </div>
                            <button
                                type="button"
                                onClick={() => setShowResultDetails((prev) => !prev)}
                                className="rounded-xl border border-orange-200 bg-orange-50 px-3 py-2 text-[11px] font-bold uppercase tracking-wide text-orange-700 transition-all hover:bg-orange-100 active:scale-95"
                            >
                                {showResultDetails ? 'Ẩn chi tiết AI' : 'Xem chi tiết AI'}
                            </button>
                        </div>
                    </div>

                    {showResultDetails && (
                        <>
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
                                    <div className="space-y-2">
                                        {result.image_analysis.map((img, idx) => (
                                            <div key={`img-${idx}`} className="rounded-xl border border-stone-200 bg-white p-3">
                                                <p className="text-[11px] font-semibold text-stone-600">
                                                    Ảnh {img.order}: {img.description || 'Chưa có mô tả'}
                                                </p>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            )}

                            {result.prescription_suggestions.length > 0 ? (
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
                            ) : (
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
                        </>
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
