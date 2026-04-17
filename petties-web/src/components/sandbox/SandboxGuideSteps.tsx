import { useEffect, useMemo, useRef, useState } from 'react'
import { CheckCircleIcon, ChevronRightIcon } from '@heroicons/react/24/solid'
import { resolveSandboxFocusSelector, useSandboxStore, SANDBOX_GUIDE_DEFINITIONS, type SandboxFeature } from '../../store/sandboxStore'

interface SandboxGuideStepsProps {
  feature: SandboxFeature
  onFinish?: () => void
  onRequestBranchChoice?: () => void
  draggable?: boolean
}

/**
 * SandboxGuideSteps Component
 * Multi-step wizard showing progressive onboarding for sandbox features
 *
 * Each feature defines its own guided script with step-specific actions and checklists.
 */
export function SandboxGuideSteps({
  feature,
  onFinish,
  onRequestBranchChoice,
  draggable = false,
}: SandboxGuideStepsProps) {
  const {
    currentGuideStep,
    stepProgress,
    currentStepStartedAt,
    lastProgressAt,
    blockedOutsideFocusCount,
    toggleChecklistItem,
    isCurrentStepReady,
    goToNextStep,
    setGuideStep,
  } = useSandboxStore()
  const [now, setNow] = useState(Date.now())
  const panelWidth = 360
  const panelMargin = 12
  const [panelPosition, setPanelPosition] = useState({ x: 0, y: 128 })
  const [isDragging, setIsDragging] = useState(false)
  const panelRef = useRef<HTMLDivElement | null>(null)
  const dragOffsetRef = useRef({ x: 0, y: 0 })

  const steps = SANDBOX_GUIDE_DEFINITIONS[feature] || []
  const currentStep = currentGuideStep
  const step = steps[currentStep - 1]
  const totalSteps = steps.length
  const isLastStep = currentStep === totalSteps
  const currentProgress = stepProgress[currentStep]
  const stepReady = isCurrentStepReady()
  const actionIsRequired = Boolean(step?.actionKey)
  const elapsedSeconds = Math.floor((now - currentStepStartedAt) / 1000)
  const idleSeconds = Math.floor((now - lastProgressAt) / 1000)

  useEffect(() => {
    const timerId = window.setInterval(() => {
      setNow(Date.now())
    }, 1000)

    return () => {
      window.clearInterval(timerId)
    }
  }, [])

  const firstUncheckedItem = useMemo(
    () => step?.checklist.find((item) => !currentProgress?.checklistCompleted[item.id]),
    [currentProgress?.checklistCompleted, step],
  )

  const dynamicHint = useMemo(() => {
    if (stepReady) {
      return ''
    }

    if (blockedOutsideFocusCount >= 2) {
      return 'Bạn đang thao tác ngoài vùng được sáng. Hãy thao tác trong khu vực đang được highlight để hệ thống ghi nhận.'
    }

    if (actionIsRequired && !currentProgress?.actionCompleted && step?.actionLabel) {
      return `Gợi ý thao tác: ${step.actionLabel}`
    }

    if (firstUncheckedItem) {
      return `Gợi ý checklist: ${firstUncheckedItem.label}`
    }

    return 'Hoàn tất checklist hiện tại để mở khóa bước tiếp theo.'
  }, [
    actionIsRequired,
    blockedOutsideFocusCount,
    currentProgress?.actionCompleted,
    firstUncheckedItem,
    step?.actionLabel,
    stepReady,
  ])

  const timeoutHint = !stepReady && idleSeconds >= 45

  useEffect(() => {
    if (!draggable) {
      return
    }

    const x = Math.max(window.innerWidth - panelWidth - 24, panelMargin)
    const y = Math.max(96, panelMargin)
    setPanelPosition({ x, y })
  }, [draggable])

  useEffect(() => {
    if (!draggable || !isDragging) {
      return
    }

    const handlePointerMove = (event: PointerEvent) => {
      const nextX = event.clientX - dragOffsetRef.current.x
      const nextY = event.clientY - dragOffsetRef.current.y
      const maxX = Math.max(window.innerWidth - panelWidth - panelMargin, panelMargin)
      const maxY = Math.max(window.innerHeight - 120, panelMargin)

      setPanelPosition({
        x: Math.min(Math.max(nextX, panelMargin), maxX),
        y: Math.min(Math.max(nextY, panelMargin), maxY),
      })
    }

    const handlePointerUp = () => {
      setIsDragging(false)
      document.body.style.userSelect = ''
    }

    window.addEventListener('pointermove', handlePointerMove)
    window.addEventListener('pointerup', handlePointerUp)

    return () => {
      window.removeEventListener('pointermove', handlePointerMove)
      window.removeEventListener('pointerup', handlePointerUp)
      document.body.style.userSelect = ''
    }
  }, [draggable, isDragging])

  const handleDragStart = (event: React.PointerEvent<HTMLDivElement>) => {
    if (!draggable) {
      return
    }

    const target = event.target as HTMLElement | null
    if (target?.closest('button, input, label, select, textarea, a')) {
      return
    }

    const currentTarget = panelRef.current
    if (!currentTarget) {
      return
    }

    const rect = currentTarget.getBoundingClientRect()
    dragOffsetRef.current = {
      x: event.clientX - rect.left,
      y: event.clientY - rect.top,
    }

    setIsDragging(true)
    document.body.style.userSelect = 'none'
  }

  const handleLocateFocus = () => {
    const focusSelector = resolveSandboxFocusSelector(feature, currentStep, stepProgress)
    if (!focusSelector) {
      return
    }

    const target = document.querySelector(focusSelector)
    if (!(target instanceof HTMLElement)) {
      return
    }

    target.scrollIntoView({ behavior: 'smooth', block: 'center', inline: 'nearest' })
    target.classList.add('ring-4', 'ring-amber-500')
    window.setTimeout(() => {
      target.classList.remove('ring-4', 'ring-amber-500')
    }, 1200)
  }

  const panelClassName = draggable
    ? 'pointer-events-auto absolute max-h-[calc(100vh-24px)] overflow-y-auto bg-white border-2 border-stone-900 rounded-xl p-6 shadow-[4px_4px_0_#1c1917]'
    : 'bg-white border-2 border-stone-900 rounded-xl p-6 shadow-[4px_4px_0_#1c1917] mb-6 sticky top-28 max-h-[calc(100vh-140px)] overflow-y-auto'

  const panelStyle = draggable
    ? {
        width: `${panelWidth}px`,
        left: `${panelPosition.x}px`,
        top: `${panelPosition.y}px`,
      }
    : undefined

  return (
    <div
      ref={panelRef}
      className={panelClassName}
      style={panelStyle}
      data-sandbox-guide-panel="true"
      onPointerDown={handleDragStart}
    >
      {draggable && (
        <div className="mb-4 rounded-lg border-2 border-stone-900 bg-amber-100 px-3 py-2 text-xs font-bold uppercase text-stone-900">
          Kéo bất kỳ vùng trống nào trong bảng hướng dẫn để di chuyển
        </div>
      )}

      {/* Progress Header */}
      <div className="flex items-center justify-between mb-4">
        <div>
          <h3 className="font-bold text-lg">{step?.title}</h3>
          <p className="text-sm text-stone-600 mt-1">{step?.description}</p>
        </div>
        <div className="text-right">
          <div className="text-xs font-bold text-stone-500 mb-2">
            Bước {currentStep} / {totalSteps}
          </div>
          <div className="text-[11px] font-bold text-stone-500 mb-2">Thời gian bước: {elapsedSeconds}s</div>
          <div className="flex gap-1">
            {steps.map((_, idx) => (
              <div
                key={idx}
                className={`h-2 w-8 border border-stone-900 rounded ${
                  idx < currentStep ? 'bg-amber-600' : 'bg-white'
                }`}
              />
            ))}
          </div>
        </div>
      </div>

      {/* Main Action */}
      {actionIsRequired && (
        <div className="mb-4 p-3 border-2 border-stone-900 rounded-lg bg-amber-50">
          <p className="text-xs font-bold text-stone-600 uppercase mb-2">Hành động bắt buộc</p>
          <div className={`w-full px-3 py-2 border-2 border-stone-900 rounded-lg font-bold text-sm ${
            currentProgress?.actionCompleted ? 'bg-green-100 text-green-800' : 'bg-white text-stone-900'
          }`}>
            {currentProgress?.actionCompleted ? 'Hệ thống đã ghi nhận thao tác' : step?.actionLabel}
          </div>
        </div>
      )}

      {/* Checklist */}
      <div className="mb-4 p-3 border-2 border-stone-900 rounded-lg bg-stone-50">
        <p className="text-xs font-bold text-stone-600 uppercase mb-2">Checklist bắt buộc</p>
        <div className="space-y-2">
          {step?.checklist.map((item) => {
            const checked = currentProgress?.checklistCompleted[item.id] || false
            return (
              <label key={item.id} className="flex items-start gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={checked}
                  onChange={() => toggleChecklistItem(item.id)}
                  className="mt-1 h-4 w-4 border-2 border-stone-900"
                />
                <span className="text-sm text-stone-800 font-medium">{item.label}</span>
              </label>
            )
          })}
        </div>
      </div>

      {/* Action vs Completion */}
      {isLastStep ? (
        // Completion State
        <div className="bg-green-50 border-2 border-green-300 rounded-lg p-4 mb-4">
          <div className="flex items-center gap-2">
            <CheckCircleIcon className="h-6 w-6 text-green-600" />
            <div>
              <div className="font-bold text-green-900">Bạn đã hoàn thành hướng dẫn.</div>
              <div className="text-sm text-green-800">
                Bây giờ bạn đã sẵn sàng sử dụng tính năng này với dữ liệu thực.
              </div>
            </div>
          </div>
        </div>
      ) : null}

      {/* Button Group */}
      <div className="flex gap-2">
        {!isLastStep && (
          <button
            onClick={() => {
              if (feature === 'clinic_info' && currentStep === 4) {
                if (onRequestBranchChoice) {
                  onRequestBranchChoice()
                } else {
                  setGuideStep(5)
                }
                return
              }

              goToNextStep()
            }}
            disabled={!stepReady}
            className="flex-1 bg-amber-600 text-white font-bold uppercase px-4 py-3 border-2 border-stone-900 rounded-lg shadow-[3px_3px_0_#1c1917] hover:shadow-[5px_5px_0_#1c1917] hover:-translate-y-0.5 transition-all flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:translate-y-0 disabled:hover:shadow-[3px_3px_0_#1c1917]"
          >
              {feature === 'clinic_info' && currentStep === 4 ? 'Tiếp tục' : 'Bước tiếp theo'}
            <ChevronRightIcon className="h-5 w-5" />
          </button>
        )}

        {isLastStep && (
          <button
            onClick={() => (onFinish ? onFinish() : undefined)}
            disabled={!stepReady}
            className="flex-1 bg-green-600 text-white font-bold uppercase px-4 py-3 border-2 border-stone-900 rounded-lg shadow-[3px_3px_0_#1c1917] hover:shadow-[5px_5px_0_#1c1917] hover:-translate-y-0.5 transition-all"
          >
            Hoàn tất hướng dẫn
          </button>
        )}
      </div>

      {!stepReady && (
        <p className="text-xs font-bold text-red-700 mt-3">
          Bạn cần hoàn thành thao tác bắt buộc (tự ghi nhận) và toàn bộ checklist để mở khóa bước tiếp theo.
        </p>
      )}

      {!stepReady && dynamicHint && (
        <div className={`mt-3 border-2 rounded-lg px-3 py-2 text-xs font-bold ${
          timeoutHint ? 'border-amber-700 bg-amber-100 text-amber-900' : 'border-blue-700 bg-blue-50 text-blue-900'
        }`}>
          {timeoutHint ? 'Bạn đang dừng hơi lâu. ' : ''}
          {step?.hint ? `${step.hint} ` : ''}
          {dynamicHint}
        </div>
      )}

      {!stepReady && step?.focusSelector && (
        <button
          type="button"
          onClick={handleLocateFocus}
          className="mt-3 w-full bg-white text-stone-900 font-bold uppercase px-3 py-2 border-2 border-stone-900 rounded-lg shadow-[2px_2px_0_#1c1917] hover:shadow-[3px_3px_0_#1c1917] hover:-translate-y-0.5 transition-all"
        >
          Chỉ vị trí cần thao tác
        </button>
      )}
    </div>
  )
}
