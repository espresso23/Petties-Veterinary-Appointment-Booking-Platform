import { useState, useEffect, useRef, useCallback } from 'react'
import { SparklesIcon } from '@heroicons/react/24/outline'
import { ImageLightbox } from '../../components/ImageLightbox'
import {
    diagnosisApi,
    type StaffDiagnosisRequest,
    type StaffDiagnosisSuggestion,
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
    pendingImageUrls?: string[]
    onDiagnosisResult?: (result: StaffDiagnosisResponse | null) => void
    onApplyDraft?: (draft: StaffDiagnosisResponse['soap_suggestions']) => void
    onPendingImageDescriptionsChange?: (descriptions: Record<string, string>) => void
    inline?: boolean
    isModal?: boolean
    autoAnalyzeSignal?: number
    initialResult?: StaffDiagnosisResponse | null
    initialSelectedDiagnosis?: { displayName: string; canonicalCode?: string | null } | null
    hideNarrativeInput?: boolean
    externalNarrative?: string
    onSelectDiagnosis?: (diagnosis: { displayName: string; canonicalCode?: string | null }) => void
    onLoadingChange?: (loading: boolean) => void
}

const handledAutoAnalyzeSignals = new Set<number>()

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
    inline = false,
    isModal = false,
    autoAnalyzeSignal,
    initialResult,
    initialSelectedDiagnosis,
    hideNarrativeInput = false,
    externalNarrative,
    onSelectDiagnosis,
    onLoadingChange,
}: AIDiagnosisPanelProps) => {
    const [clinicalNarrative, setClinicalNarrative] = useState('')
    const [loading, setLoading] = useState(false)
    const [error, setError] = useState<string | null>(null)
    const [result, setResult] = useState<StaffDiagnosisResponse | null>(null)
    const [showResultDetails, setShowResultDetails] = useState(false)
    const [selectedDiagnosisCode, setSelectedDiagnosisCode] = useState<string>('')
    const [selectedDiagnosisLabel, setSelectedDiagnosisLabel] = useState<string>('')
    const [baseRequestId, setBaseRequestId] = useState<string>('')
    const [imageDescriptions, setImageDescriptions] = useState<Record<string, string>>({})
    const [lightboxOpen, setLightboxOpen] = useState(false)
    const [lightboxIndex, setLightboxIndex] = useState(0)
    const analyzedImagesRef = useRef<Set<string>>(new Set())
    const imagesLoadingRef = useRef<Set<string>>(new Set())
    const imageDescriptionsRef = useRef<Record<string, string>>({})
    const isMountedRef = useRef(true)
    const lastCalledDescriptionsRef = useRef<string>('')

    const normalizedImageUrls = imageUrls.filter(Boolean)
    const allImageUrls = [...normalizedImageUrls, ...pendingImageUrls.filter(Boolean)]
    const normalizedWeightKg = typeof weightKg === 'number' && Number.isFinite(weightKg) ? weightKg : undefined
    const effectiveNarrative = hideNarrativeInput ? (externalNarrative || '') : clinicalNarrative
    const canAnalyze = effectiveNarrative.trim().length >= 5 || allImageUrls.length > 0

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
        if (isModal && initialResult && !result) {
            setResult(initialResult)
            setShowResultDetails(true)
            if (initialSelectedDiagnosis?.displayName?.trim()) {
                setSelectedDiagnosisCode(initialSelectedDiagnosis.canonicalCode || '')
                setSelectedDiagnosisLabel(initialSelectedDiagnosis.displayName)
            } else if (initialResult.top_differentials?.[0]) {
                setSelectedDiagnosisCode(initialResult.top_differentials[0].canonical_code || '')
                setSelectedDiagnosisLabel(initialResult.top_differentials[0].display_name_vi)
            }
        }
    }, [initialResult, initialSelectedDiagnosis, isModal, result])

    useEffect(() => {
        const descriptionsString = JSON.stringify(imageDescriptions)
        if (descriptionsString !== lastCalledDescriptionsRef.current && onPendingImageDescriptionsChange) {
            lastCalledDescriptionsRef.current = descriptionsString
            onPendingImageDescriptionsChange(imageDescriptions)
        }
    }, [imageDescriptions, onPendingImageDescriptionsChange])

    const convertBlobToBase64 = useCallback(async (url: string): Promise<string> => {
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
    }, [])

    const analyzeSingleImage = useCallback(async (imageUrl: string): Promise<string | null> => {
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
                doctor_description: effectiveNarrative.trim().length >= 5
                    ? effectiveNarrative.trim()
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
    }, [ageMonths, allergies, bookingId, breed, convertBlobToBase64, effectiveNarrative, normalizedWeightKg, petId, species])

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
    }, [analyzeSingleImage, pendingImageUrls])

    const runAnalyze = useCallback(async (overrides?: {
        selectedDiagnosisCode?: string
        selectedDiagnosisLabel?: string
        previousRequestId?: string
        synthesisMode?: 'full' | 'selected_only'
    }): Promise<StaffDiagnosisResponse | null> => {
        if (!canAnalyze) return null

        setLoading(true)
        onLoadingChange?.(true)
        setError(null)

        try {
            const synthesisMode = overrides?.synthesisMode ?? 'full'
            const displayImageUrls = [...imageUrls.filter(Boolean), ...pendingImageUrls.filter(Boolean)]
            const processedImageUrls = await Promise.all(displayImageUrls.map(url => convertBlobToBase64(url)))

            const payload: StaffDiagnosisRequest = {
                pet_id: petId,
                booking_id: bookingId,
                previous_request_id: overrides?.previousRequestId,
                species: mapSpecies(species),
                breed,
                age_months: ageMonths,
                weight_kg: normalizedWeightKg,
                sex: 'unknown',
                allergies: allergies?.filter(Boolean) || [],
                doctor_description: effectiveNarrative.trim(),
                image_urls: processedImageUrls,
                image_analysis_mode: 'full',
                synthesis_mode: synthesisMode,
                selected_diagnosis_code: overrides?.selectedDiagnosisCode ?? (selectedDiagnosisCode || undefined),
                selected_diagnosis_label: overrides?.selectedDiagnosisLabel ?? (selectedDiagnosisLabel || undefined),
                soap_draft: {
                    subjective,
                    objective,
                    assessment,
                    plan,
                },
            }
            const response = await diagnosisApi.analyzeCase(payload)
            const sanitizedResponse = sanitizeDiagnosisResponse(response, displayImageUrls)
            setResult(sanitizedResponse)
            if (synthesisMode === 'full') {
                setBaseRequestId(sanitizedResponse.request_id)
            }
            setShowResultDetails(false)
            onDiagnosisResult?.(sanitizedResponse)
            if (payload.selected_diagnosis_code || payload.selected_diagnosis_label) {
                onApplyDraft?.(sanitizedResponse.soap_suggestions)
            }
            return sanitizedResponse
        } catch (err) {
            if ((overrides?.synthesisMode ?? 'full') === 'full') {
                setResult(null)
                onDiagnosisResult?.(null)
            }
            setError(err instanceof Error ? err.message : 'Không thể phân tích tình trạng của thú cưng.')
            return null
        } finally {
            setLoading(false)
            onLoadingChange?.(false)
        }
    }, [ageMonths, allergies, assessment, bookingId, breed, canAnalyze, convertBlobToBase64, effectiveNarrative, imageUrls, objective, onApplyDraft, onDiagnosisResult, onLoadingChange, pendingImageUrls, petId, plan, selectedDiagnosisCode, selectedDiagnosisLabel, species, subjective, normalizedWeightKg])

    const handleAnalyze = useCallback(async () => {
        setSelectedDiagnosisCode('')
        setSelectedDiagnosisLabel('')
        await runAnalyze()
    }, [runAnalyze])

    useEffect(() => {
        if (!isModal || !autoAnalyzeSignal || handledAutoAnalyzeSignals.has(autoAnalyzeSignal)) {
            return
        }

        handledAutoAnalyzeSignals.add(autoAnalyzeSignal)

        if (canAnalyze) {
            void handleAnalyze()
        }
    }, [autoAnalyzeSignal, canAnalyze, handleAnalyze, isModal])

    const handleSelectDiagnosisClick = (item: StaffDiagnosisSuggestion) => {
        setSelectedDiagnosisCode(item.canonical_code || '')
        setSelectedDiagnosisLabel(item.display_name_vi)
        onSelectDiagnosis?.({
            displayName: item.display_name_vi,
            canonicalCode: item.canonical_code,
        })

        void runAnalyze({
            previousRequestId: baseRequestId || result?.request_id,
            synthesisMode: 'selected_only',
            selectedDiagnosisCode: item.canonical_code || undefined,
            selectedDiagnosisLabel: item.display_name_vi,
        })
    }

    const detailsVisible = inline || isModal ? true : showResultDetails
    const hasSelectedDiagnosis = Boolean(selectedDiagnosisCode || selectedDiagnosisLabel)
    const provisionalDifferentialsCount = result?.top_differentials.filter(item => !item.canonical_code).length || 0
    const imageCards = allImageUrls.map((url, index) => {
        const analysisItem = result?.image_analysis?.[index]
        const fallbackDescription = imageDescriptions[url]

        return {
            url,
            order: analysisItem?.order ?? index + 1,
            description: analysisItem?.description || fallbackDescription || 'AI đang chờ mô tả cho ảnh này.',
        }
    })

    const handleImageClick = (index: number) => {
        setLightboxIndex(index)
        setLightboxOpen(true)
    }

    const imageGalleryContent = isModal ? (
        <>
        <div className="space-y-4 rounded-[24px] border-2 border-stone-900 bg-stone-50 p-4 shadow-[5px_5px_0_0_#1c1917]">
            <div>
                <p className="text-xs font-black uppercase tracking-[0.18em] text-stone-700">Ảnh lâm sàng</p>
                <p className="mt-1 text-sm text-stone-600">Xem nhanh ảnh đã gửi lên và mô tả AI tương ứng trong cùng một cửa sổ.</p>
            </div>

            {imageCards.length === 0 ? (
                <div className="rounded-2xl border-2 border-dashed border-stone-300 bg-white px-4 py-8 text-center text-sm font-semibold text-stone-500">
                    Chưa có ảnh lâm sàng cho ca này.
                </div>
            ) : (
                <div className="space-y-3">
                    {imageCards.map((item, idx) => (
                        <div 
                            key={`${item.url}-${item.order}`} 
                            className="cursor-pointer overflow-hidden rounded-[20px] border-2 border-stone-900 bg-white shadow-[4px_4px_0_0_#1c1917] transition-all hover:shadow-[6px_6px_0_0_#1c1917] active:scale-[0.98]" 
                            onClick={() => handleImageClick(idx)}
                        >
                            <div className="aspect-[4/3] bg-stone-100">
                                <img src={item.url} alt={`Ảnh lâm sàng ${item.order}`} className="h-full w-full object-cover" />
                            </div>
                            <div className="border-t-2 border-stone-900 p-3">
                                <p className="text-[11px] font-black uppercase tracking-[0.18em] text-amber-700">Ảnh {item.order}</p>
                                <p className="mt-2 text-sm leading-6 text-stone-700">{item.description}</p>
                            </div>
                        </div>
                    ))}
                </div>
            )}
        </div>
        <ImageLightbox
            images={imageCards}
            initialIndex={lightboxIndex}
            isOpen={lightboxOpen}
            onClose={() => setLightboxOpen(false)}
        />
        </>
    ) : null

    const waterfallLoadingContent = isModal && loading ? (
        <div className="space-y-5 rounded-[24px] border-2 border-amber-200 bg-gradient-to-br from-amber-50 via-white to-orange-50 p-5 shadow-[4px_4px_0_0_#1c1917]">
            <div className="flex items-center justify-between gap-4">
                <div>
                    <p className="text-xs font-black uppercase tracking-[0.2em] text-amber-700">AI hỗ trợ chẩn đoán</p>
                    <p className="mt-1 text-sm font-semibold text-stone-700">Đang tổng hợp triệu chứng, ảnh lâm sàng và gợi ý chẩn đoán.</p>
                </div>
                <div className="rounded-full border-2 border-stone-900 bg-white px-3 py-1 text-xs font-black uppercase text-stone-700 shadow-[3px_3px_0_0_#1c1917]">
                    Đang xử lý
                </div>
            </div>

            <div className="grid grid-cols-5 gap-2 rounded-2xl border border-amber-100 bg-white/80 p-4">
                {[0, 1, 2, 3, 4].map((index) => (
                    <div key={index} className="flex h-24 items-end justify-center overflow-hidden rounded-xl bg-amber-50">
                        <div
                            className="ai-waterfall-bar w-full rounded-t-xl bg-gradient-to-t from-orange-600 via-amber-400 to-yellow-200"
                            style={{ animationDelay: `${index * 120}ms` }}
                        />
                    </div>
                ))}
            </div>

            <div className="grid gap-3 md:grid-cols-3">
                {[0, 1, 2].map((index) => (
                    <div
                        key={index}
                        className="ai-waterfall-card rounded-2xl border-2 border-stone-200 bg-white p-4 shadow-[4px_4px_0_0_#1c1917]"
                        style={{ animationDelay: `${index * 140}ms` }}
                    >
                        <div className="mb-3 h-3 w-20 rounded-full bg-amber-200" />
                        <div className="space-y-2">
                            <div className="h-4 w-full rounded-full bg-stone-200" />
                            <div className="h-4 w-4/5 rounded-full bg-stone-100" />
                            <div className="h-10 w-full rounded-2xl bg-amber-50" />
                        </div>
                    </div>
                ))}
            </div>
        </div>
    ) : null

    const panelContent = (
        <div className="space-y-3">
            {!hideNarrativeInput && (
                <textarea
                    value={clinicalNarrative}
                    onChange={(e) => setClinicalNarrative(e.target.value)}
                    rows={4}
                    placeholder="Mô tả ngắn tình trạng của bé tại đây. Có thể ghi chung triệu chứng, vùng nghi ngờ, diễn tiến và nhận định ban đầu trong cùng một ô."
                    className="w-full rounded-lg border border-stone-300 p-3 text-sm focus:border-amber-500 focus:outline-none"
                />
            )}

            <button
                type="button"
                onClick={() => void handleAnalyze()}
                disabled={loading || !canAnalyze}
                className={`rounded-lg bg-orange-600 px-4 py-2 text-xs font-extrabold text-white shadow-md shadow-orange-100 transition-all hover:bg-orange-700 active:scale-95 disabled:cursor-not-allowed disabled:opacity-50 ${inline || isModal ? 'w-auto' : 'w-full'}`}
            >
                {loading ? (
                    <>
                        <span className="sr-only">AI đang xử lý dữ liệu</span>
                        <span className="inline-flex items-center gap-1" aria-hidden>
                            <span className="h-1.5 w-1.5 rounded-full bg-white/90 animate-pulse" />
                            <span className="h-1.5 w-1.5 rounded-full bg-white/80 animate-pulse [animation-delay:120ms]" />
                            <span className="h-1.5 w-1.5 rounded-full bg-white/70 animate-pulse [animation-delay:240ms]" />
                        </span>
                    </>
                ) : (isModal ? 'Phân tích lại' : 'AI chẩn đoán')}
            </button>

            {!canAnalyze && (
                <p className="text-xs text-stone-500">
                    Cần nhập mô tả tình trạng của thú cưng hoặc tải lên ít nhất một ảnh lâm sàng để AI phân tích.
                </p>
            )}
            {error && <p className="text-xs text-red-600 font-semibold">{error}</p>}
        </div>
    )

    const resultsContent = result && (
        <div className="mt-5 space-y-4 border-t border-stone-200 pt-4">
            <div className="rounded-2xl border border-amber-200 bg-amber-50/80 p-3">
                <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                        <h4 className="text-xs font-bold uppercase tracking-wide text-amber-800">Kết quả AI đã sẵn sàng</h4>
                        <p className="mt-1 text-xs text-stone-700">
                            {result.top_differentials.length} chẩn đoán phân biệt, {result.prescription_suggestions.length} gợi ý đơn thuốc,
                            {result.suggested_questions.length} câu hỏi cần khai thác thêm.
                        </p>
                        <p className="mt-1 text-xs font-semibold text-stone-700">{result.evidence_banner}</p>
                        {provisionalDifferentialsCount > 0 && (
                            <p className="mt-1 text-xs font-semibold text-amber-800">
                                Có {provisionalDifferentialsCount} nhãn tạm chưa chuẩn hóa. Ưu tiên bác sĩ đối chiếu lâm sàng trước khi dùng để tái sử dụng phác đồ.
                            </p>
                        )}
                    </div>
                    {!isModal && (
                        <button
                            type="button"
                            onClick={() => setShowResultDetails((prev) => !prev)}
                            className="rounded-xl border border-orange-200 bg-orange-50 px-3 py-2 text-[11px] font-bold uppercase tracking-wide text-orange-700 transition-all hover:bg-orange-100 active:scale-95"
                        >
                            {showResultDetails ? 'Ẩn chi tiết AI' : 'Xem chi tiết AI'}
                        </button>
                    )}
                </div>
            </div>

            {detailsVisible && (
                <>
                    <div>
                        <h4 className="mb-2 text-xs font-bold uppercase tracking-wide text-stone-700">Chẩn đoán phân biệt</h4>
                        <p className="mb-2 text-[11px] font-semibold text-stone-600">{result.score_label}</p>
                        <div className="space-y-2">
                            {result.top_differentials.slice(0, 3).map((item, idx) => {
                                const isCurrentSelection = (item.canonical_code && item.canonical_code === selectedDiagnosisCode)
                                    || item.display_name_vi === selectedDiagnosisLabel
                                const isProvisional = !item.canonical_code

                                return (
                                <div
                                    key={`${item.display_name_vi}-${idx}`}
                                    className={`rounded-2xl border p-3 ${isCurrentSelection
                                        ? 'border-orange-300 bg-orange-50/80'
                                        : isProvisional
                                            ? 'border-amber-300 bg-amber-50/70'
                                            : 'border-stone-200 bg-stone-50/70'
                                        }`}
                                >
                                    <div className="flex flex-wrap items-start justify-between gap-3">
                                        <div className="min-w-0 flex-1">
                                            <div className="flex flex-wrap items-center gap-2">
                                                <p className="text-sm font-bold text-stone-900">#{item.rank || idx + 1} - {item.display_name_vi}</p>
                                                <span className={`rounded-full border px-2 py-1 text-[10px] font-black uppercase tracking-[0.12em] ${isProvisional
                                                    ? 'border-amber-300 bg-amber-100 text-amber-800'
                                                    : 'border-emerald-300 bg-emerald-100 text-emerald-800'
                                                    }`}>
                                                    {isProvisional ? 'Tạm gán nhãn' : 'Đã chuẩn hóa'}
                                                </span>
                                            </div>
                                            <p className="text-xs text-stone-600">{item.confidence_note}</p>
                                        </div>
                                        <span className="rounded-xl border border-amber-300 bg-amber-50 px-3 py-2 text-sm font-black text-amber-700">
                                            {item.score_percent}%
                                        </span>
                                        {onSelectDiagnosis && (
                                            <button
                                                type="button"
                                                onClick={() => void handleSelectDiagnosisClick(item)}
                                                disabled={loading}
                                                className="rounded-xl border border-orange-200 bg-orange-50 px-3 py-2 text-[11px] font-bold uppercase tracking-wide text-orange-700 transition-all hover:bg-orange-100 active:scale-95"
                                            >
                                                {isCurrentSelection ? 'Đã chọn' : 'Chọn chẩn đoán này'}
                                            </button>
                                        )}
                                    </div>
                                    {item.supporting_reasons.length > 0 && (
                                        <ul className="mt-2 space-y-1">
                                            {item.supporting_reasons.slice(0, 2).map((reason, reasonIndex) => (
                                                <li key={`${reason}-${reasonIndex}`} className="text-xs text-stone-600">
                                                    - {reason}
                                                </li>
                                            ))}
                                        </ul>
                                    )}
                                    {isProvisional && (
                                        <p className="mt-2 text-[11px] font-semibold text-amber-800">
                                            Nhãn này chưa được chuẩn hóa về bệnh chuẩn. Cần bác sĩ xác nhận thêm trước khi tái sử dụng SOAP hoặc phác đồ.
                                        </p>
                                    )}
                                </div>
                                )
                            })}
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

                    {!isModal && result.image_analysis && result.image_analysis.length > 0 && (
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

                    {hasSelectedDiagnosis && result.prescription_suggestions.length > 0 ? (
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
                    ) : hasSelectedDiagnosis ? (
                        <div className="rounded-2xl border border-amber-200 bg-amber-50/80 p-3">
                            <h4 className="mb-1 text-xs font-bold uppercase tracking-wide text-amber-800">Đơn thuốc AI chưa sẵn sàng</h4>
                            <p className="text-xs text-amber-800">
                                AI chưa đề xuất đơn thuốc nháp cho ca này. Nguyên nhân thường gặp là chưa có đủ evidence nội bộ
                                hoặc còn thiếu dữ liệu như cân nặng để tính liều an toàn.
                            </p>
                        </div>
                    ) : (
                        <div className="rounded-2xl border border-blue-200 bg-blue-50/80 p-3">
                            <p className="text-xs font-semibold text-blue-800">
                                Chọn một chẩn đoán trong Top 3 để mở gợi ý SOAP và điều trị ở bước sau.
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
    )

    if (isModal) {
        const isWaterfallLoading = loading

        return (
            <div className="grid gap-5 lg:grid-cols-[340px_minmax(0,1fr)]">
                <div className="min-w-0">
                    {imageGalleryContent}
                </div>
                <div className="min-w-0 space-y-4">
                    {waterfallLoadingContent}
                    {!isWaterfallLoading && (
                        <div className="rounded-[24px] border-2 border-stone-900 bg-white p-4 shadow-[5px_5px_0_0_#1c1917]">
                            {panelContent}
                            {resultsContent}
                        </div>
                    )}
                </div>
            </div>
        )
    }

    return (
        <div className={inline ? 'space-y-3' : 'rounded-2xl border border-stone-200 bg-white p-6 shadow-sm'}>
            {!inline && (
                <div className="mb-4 flex items-center gap-2">
                    <SparklesIcon className="h-5 w-5 text-amber-600" />
                    <h3 className="text-sm font-bold uppercase tracking-wide text-stone-800">Hỗ trợ AI chẩn đoán</h3>
                </div>
            )}
            {panelContent}
            {resultsContent}
        </div>
    )
}

export default AIDiagnosisPanel
