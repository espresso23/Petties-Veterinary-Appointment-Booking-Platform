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

const timeLabel = (value: string): string => {
    if (value === 'sang') return 'Sáng'
    if (value === 'trua') return 'Trưa'
    if (value === 'chieu') return 'Chiều'
    return value
}

const mealLabel = (value?: string): string => {
    if (!value) return ''
    if (value === 'BEFORE_MEAL') return 'Trước ăn'
    if (value === 'AFTER_MEAL') return 'Sau ăn'
    if (value === 'WITH_MEAL') return 'Cùng bữa'
    if (value === 'NONE') return 'Không phụ thuộc bữa ăn'
    return value
}

const buildPrescriptionSchedule = (item: StaffDiagnosisResponse['prescription_suggestions'][number]): string => {
    const times = (item.times_of_day || item.timesOfDay || []).map(timeLabel)
    const meal = mealLabel(item.before_after_meal || item.beforeAfterMeal)
    const frequencyNote = item.frequency_note || item.frequencyNote || ''

    if (times.length > 0) {
        const parts = [times.join(', ')]
        if (meal) parts.push(meal)
        if (frequencyNote) parts.push(frequencyNote)
        return parts.join(' | ')
    }

    const legacyFrequency = (item.frequency || '').trim()
    if (legacyFrequency) {
        return legacyFrequency
    }

    const parts: string[] = []
    if (meal) parts.push(meal)
    if (frequencyNote) parts.push(frequencyNote)
    return parts.join(' | ') || 'Theo chỉ định'
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
    const [followUpAnswers, setFollowUpAnswers] = useState<Record<string, string>>({})
    const [isRefiningWithAnswers, setIsRefiningWithAnswers] = useState(false)
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
        const questions = result?.suggested_questions ?? []

        setFollowUpAnswers((previousAnswers) => {
            if (questions.length === 0) {
                return Object.keys(previousAnswers).length === 0 ? previousAnswers : {}
            }

            const nextAnswers: Record<string, string> = {}
            for (const question of questions) {
                if (Object.prototype.hasOwnProperty.call(previousAnswers, question)) {
                    nextAnswers[question] = previousAnswers[question]
                }
            }

            const previousKeys = Object.keys(previousAnswers)
            const nextKeys = Object.keys(nextAnswers)
            if (
                previousKeys.length === nextKeys.length
                && previousKeys.every((key) => nextAnswers[key] === previousAnswers[key])
            ) {
                return previousAnswers
            }

            return nextAnswers
        })
    }, [result?.suggested_questions])

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
        doctorNarrative?: string
        followUpAnswers?: Array<{ question: string; answer: string }>
    }): Promise<StaffDiagnosisResponse | null> => {
        const hasFollowUpOverrides = (overrides?.followUpAnswers || [])
            .some((item) => (item.answer || '').trim().length > 0)
        if (!canAnalyze && !hasFollowUpOverrides) return null

        setLoading(true)
        onLoadingChange?.(true)
        setError(null)

        try {
            const synthesisMode = overrides?.synthesisMode ?? 'full'
            const doctorNarrative = (overrides?.doctorNarrative ?? effectiveNarrative).trim()
            const followUpAnswerPayload = (overrides?.followUpAnswers || [])
                .map((item) => ({
                    question: (item.question || '').trim(),
                    answer: (item.answer || '').trim(),
                }))
                .filter((item) => item.question.length > 0 && item.answer.length > 0)
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
                doctor_description: doctorNarrative,
                image_urls: processedImageUrls,
                image_analysis_mode: 'full',
                synthesis_mode: synthesisMode,
                selected_diagnosis_code: overrides?.selectedDiagnosisCode ?? (selectedDiagnosisCode || undefined),
                selected_diagnosis_label: overrides?.selectedDiagnosisLabel ?? (selectedDiagnosisLabel || undefined),
                follow_up_answers: followUpAnswerPayload.length > 0 ? followUpAnswerPayload : undefined,
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

    const hasAnyFollowUpAnswer = Object.values(followUpAnswers).some((answer) => answer.trim().length > 0)

    const handleRefineWithFollowUp = useCallback(async () => {
        const questions = result?.suggested_questions ?? []
        if (questions.length === 0) {
            return
        }

        const hasAnsweredQuestion = questions.some((question) => (followUpAnswers[question] || '').trim().length > 0)
        if (!hasAnsweredQuestion) {
            setError('Vui lòng nhập ít nhất một câu trả lời trước khi cập nhật kết quả AI.')
            return
        }

        const useSelectedOnly = Boolean(selectedDiagnosisCode || selectedDiagnosisLabel)
        const answeredPairs = questions
            .map((question) => ({
                question,
                answer: (followUpAnswers[question] || '').trim(),
            }))
            .filter((item) => item.answer.length > 0)

        setError(null)
        setIsRefiningWithAnswers(true)
        try {
            await runAnalyze({
                synthesisMode: useSelectedOnly ? 'selected_only' : 'full',
                previousRequestId: useSelectedOnly ? (baseRequestId || result?.request_id) : undefined,
                selectedDiagnosisCode: useSelectedOnly ? (selectedDiagnosisCode || undefined) : undefined,
                selectedDiagnosisLabel: useSelectedOnly ? (selectedDiagnosisLabel || undefined) : undefined,
                followUpAnswers: answeredPairs,
            })
        } finally {
            if (isMountedRef.current) {
                setIsRefiningWithAnswers(false)
            }
        }
    }, [
        baseRequestId,
        followUpAnswers,
        result,
        runAnalyze,
        selectedDiagnosisCode,
        selectedDiagnosisLabel,
    ])

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
    const imageCards = allImageUrls.map((url, index) => {
        const analysisItem = result?.image_analysis?.[index]
        const fallbackDescription = imageDescriptions[url]

        return {
            url,
            order: analysisItem?.order ?? index + 1,
            description: analysisItem?.description || fallbackDescription || 'Đang chờ AI mô tả ảnh này.',
        }
    })

    const handleImageClick = (index: number) => {
        setLightboxIndex(index)
        setLightboxOpen(true)
    }

    const formatConfidenceText = (scorePercent?: number) => {
        if (typeof scorePercent === 'number' && Number.isFinite(scorePercent)) {
            return `Độ tự tin: ${scorePercent}%`
        }
        return 'Độ tự tin: --'
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
                        {hasSelectedDiagnosis ? (
                            <p className="mt-1 text-xs text-stone-700">
                                {result.top_differentials.length} chẩn đoán phân biệt, {result.prescription_suggestions.length} gợi ý đơn thuốc,
                                {result.suggested_questions.length} câu hỏi cần khai thác thêm.
                            </p>
                        ) : (
                            <p className="mt-1 text-xs text-stone-700">
                                {result.top_differentials.length} chẩn đoán phân biệt, {result.suggested_questions.length} câu hỏi cần khai thác thêm.
                                Gợi ý đơn thuốc sẽ mở sau khi bác sĩ chọn 1 chẩn đoán trong Top 3.
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
                        <div className="space-y-2">
                            {result.top_differentials.slice(0, 3).map((item, idx) => {
                                const isCurrentSelection = (item.canonical_code && item.canonical_code === selectedDiagnosisCode)
                                    || item.display_name_vi === selectedDiagnosisLabel

                                return (
                                <div
                                    key={`${item.display_name_vi}-${idx}`}
                                    className={`rounded-2xl border p-3 ${isCurrentSelection
                                        ? 'border-orange-300 bg-orange-50/80'
                                        : 'border-stone-200 bg-stone-50/70'
                                    }`}
                                >
                                    <div className="flex flex-wrap items-start justify-between gap-3">
                                        <div className="min-w-0 flex-1">
                                            <div className="flex flex-wrap items-center gap-2">
                                                <p className="text-sm font-bold text-stone-900">#{item.rank || idx + 1} - {item.display_name_vi}</p>
                                            </div>
                                            <p className="text-xs text-stone-600">{formatConfidenceText(item.score_percent)}</p>
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
                                </div>
                                )
                            })}
                        </div>
                    </div>

                    <div>
                        <h4 className="mb-2 text-xs font-bold uppercase tracking-wide text-stone-700">Dấu hiệu từ ảnh</h4>
                        <ul className="space-y-1">
                            {result.vision_findings.length === 0 && (
                                <li className="text-xs text-stone-500">
                                    {allImageUrls.length > 0
                                        ? 'AI chưa ghi nhận dấu hiệu nổi bật từ ảnh hiện tại. Bác sĩ vui lòng đối chiếu mô tả ảnh và khám lâm sàng.'
                                        : 'Chưa có ảnh lâm sàng cho ca này.'}
                                </li>
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
                                            {buildPrescriptionSchedule(item)} | {item.duration_days ?? '-'} ngày
                                        </p>
                                        {item.instructions && (
                                            <p className="mt-1 text-[11px] text-stone-500">{item.instructions}</p>
                                        )}
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
                                AI chưa đề xuất đơn thuốc nháp cho ca này. Vui lòng bổ sung thêm dữ liệu lâm sàng và thử phân tích lại.
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
                            <div className="space-y-2">
                                {result.suggested_questions.map((question, idx) => (
                                    <div key={`${question}-${idx}`} className="rounded-2xl border border-stone-200 bg-stone-50/70 p-3">
                                        <p className="text-xs font-semibold text-stone-700">- {question}</p>
                                        <textarea
                                            value={followUpAnswers[question] || ''}
                                            onChange={(event) => {
                                                setFollowUpAnswers((previousAnswers) => ({
                                                    ...previousAnswers,
                                                    [question]: event.target.value,
                                                }))
                                                if (error) {
                                                    setError(null)
                                                }
                                            }}
                                            rows={2}
                                            placeholder="Nhập trả lời của bác sĩ..."
                                            className="mt-2 w-full rounded-lg border border-stone-300 bg-white p-2 text-xs text-stone-800 focus:border-amber-500 focus:outline-none"
                                        />
                                    </div>
                                ))}
                            </div>
                            <div className="mt-3 flex flex-wrap items-center gap-2">
                                <button
                                    type="button"
                                    onClick={() => void handleRefineWithFollowUp()}
                                    disabled={loading || isRefiningWithAnswers || !hasAnyFollowUpAnswer}
                                    className="rounded-xl border border-blue-200 bg-blue-50 px-3 py-2 text-[11px] font-bold uppercase tracking-wide text-blue-700 transition-all hover:bg-blue-100 active:scale-95 disabled:cursor-not-allowed disabled:opacity-50"
                                >
                                    {isRefiningWithAnswers
                                        ? 'Đang cập nhật kết quả...'
                                        : 'Cập nhật kết quả theo thông tin bổ sung'}
                                </button>
                                <p className="text-[11px] text-stone-500">
                                    Ảnh đã tải sẽ được giữ nguyên, AI sẽ truy vấn và suy luận lại để cập nhật SOAP và gợi ý điều trị theo thông tin mới.
                                </p>
                            </div>
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
                    <h3 className="text-sm font-bold uppercase tracking-wide text-stone-800">AI HỖ TRỢ CHẨN ĐOÁN BỆNH</h3>
                </div>
            )}
            {panelContent}
            {resultsContent}
        </div>
    )
}

export default AIDiagnosisPanel
