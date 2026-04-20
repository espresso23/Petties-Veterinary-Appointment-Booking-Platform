import { useCallback } from 'react'
import { resolveSandboxFocusSelector, SANDBOX_GUIDE_DEFINITIONS, useSandboxStore, type SandboxFeature } from '../store/sandboxStore'

export function useSandboxStepTracker(feature: SandboxFeature) {
  const { isSandboxMode, currentFeature, currentGuideStep, trackStepAction } = useSandboxStore()

  return useCallback(
    (actionKey: string, source?: EventTarget | null) => {
      if (!isSandboxMode || currentFeature !== feature) {
        return
      }

      const currentStep = SANDBOX_GUIDE_DEFINITIONS[feature][currentGuideStep - 1]
      if (!currentStep || currentStep.actionKey !== actionKey) {
        return
      }

      const expectedSelector = resolveSandboxFocusSelector(feature, currentGuideStep, useSandboxStore.getState().stepProgress)
      if (expectedSelector) {
        const targetElement = source instanceof Element ? source : (document.activeElement instanceof Element ? document.activeElement : null)
        if (!targetElement || !targetElement.closest(expectedSelector)) {
          return
        }
      }

      trackStepAction(actionKey)
    },
    [currentFeature, currentGuideStep, feature, isSandboxMode, trackStepAction],
  )
}
