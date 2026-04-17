import { useEffect, useMemo, useState } from 'react'
import { resolveSandboxFocusSelector, useSandboxStore } from '../../store/sandboxStore'

interface FocusRect {
  top: number
  left: number
  width: number
  height: number
}

export function SandboxFocusOverlay() {
  const { isSandboxMode, currentFeature, currentGuideStep, stepProgress, reportBlockedOutsideFocus } = useSandboxStore()
  const [focusRect, setFocusRect] = useState<FocusRect | null>(null)

  const focusSelector = useMemo(() => resolveSandboxFocusSelector(currentFeature, currentGuideStep, stepProgress), [currentFeature, currentGuideStep, stepProgress])

  useEffect(() => {
    if (!isSandboxMode || !focusSelector) {
      setFocusRect(null)
      return
    }

    const updateRect = () => {
      const target = document.querySelector(focusSelector)
      if (!target) {
        setFocusRect(null)
        return
      }

      const rect = target.getBoundingClientRect()
      setFocusRect({
        top: rect.top,
        left: rect.left,
        width: rect.width,
        height: rect.height,
      })
    }

    updateRect()
    window.addEventListener('resize', updateRect)
    window.addEventListener('scroll', updateRect, true)

    const intervalId = window.setInterval(updateRect, 400)

    return () => {
      window.removeEventListener('resize', updateRect)
      window.removeEventListener('scroll', updateRect, true)
      window.clearInterval(intervalId)
    }
  }, [isSandboxMode, focusSelector])

  useEffect(() => {
    if (!isSandboxMode || !focusSelector) {
      return
    }

    const isAllowedTarget = (target: EventTarget | null): boolean => {
      const targetElement =
        target instanceof Element
          ? target
          : target instanceof Node
            ? target.parentElement
            : null

      if (!targetElement) {
        return false
      }

      if (targetElement.closest(focusSelector)) {
        return true
      }

      if (targetElement.closest('[data-sandbox-guide-panel="true"]')) {
        return true
      }

      if (targetElement.closest('[data-sandbox-header="true"]')) {
        return true
      }

      if (targetElement.closest('[data-sandbox-modal="true"]')) {
        return true
      }

      if (targetElement.closest('[data-sandbox-exit="true"]')) {
        return true
      }

      return false
    }

    const blockPointerOutsideFocus = (event: Event) => {
      if (isAllowedTarget(event.target)) {
        return
      }

      reportBlockedOutsideFocus()
      event.preventDefault()
      event.stopPropagation()
    }

    document.addEventListener('pointerdown', blockPointerOutsideFocus, true)
    document.addEventListener('click', blockPointerOutsideFocus, true)

    return () => {
      document.removeEventListener('pointerdown', blockPointerOutsideFocus, true)
      document.removeEventListener('click', blockPointerOutsideFocus, true)
    }
  }, [focusSelector, isSandboxMode, reportBlockedOutsideFocus])

  if (!isSandboxMode) {
    return null
  }

  return (
    <div className="pointer-events-none fixed inset-0 z-30 hidden lg:block">
      {!focusRect && <div className="absolute inset-0 bg-black/60" />}

      {focusRect && (
        <div
          className="absolute rounded-xl border-2 border-amber-500"
          style={{
            top: `${Math.max(focusRect.top - 8, 0)}px`,
            left: `${Math.max(focusRect.left - 8, 0)}px`,
            width: `${focusRect.width + 16}px`,
            height: `${focusRect.height + 16}px`,
            boxShadow: '0 0 0 9999px rgba(0, 0, 0, 0.62)',
          }}
        />
      )}
    </div>
  )
}
