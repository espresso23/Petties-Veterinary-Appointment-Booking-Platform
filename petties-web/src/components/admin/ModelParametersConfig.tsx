import { useState } from 'react'
import { Cog6ToothIcon } from '@heroicons/react/24/outline'

interface ModelParametersConfigProps {
  temperature: number
  maxTokens: number
  topP?: number
  model: string
  onUpdate: (params: { temperature?: number; max_tokens?: number; top_p?: number }) => Promise<void>
  readonly?: boolean
}

/**
 * Model Hyperparameters Configuration Panel
 * Temperature, Max Tokens, Top-P sliders and inputs
 */
export const ModelParametersConfig = ({
  temperature,
  maxTokens,
  topP = 0.9,
  model,
  onUpdate,
  readonly = false
}: ModelParametersConfigProps) => {
  const [localTemp, setLocalTemp] = useState(temperature)
  const [localMaxTokens, setLocalMaxTokens] = useState(maxTokens)
  const [localTopP, setLocalTopP] = useState(topP)
  const [isSaving, setIsSaving] = useState(false)

  const handleSave = async () => {
    setIsSaving(true)
    try {
      await onUpdate({
        temperature: localTemp,
        max_tokens: localMaxTokens,
        top_p: localTopP
      })
    } catch (error) {
      console.error('Failed to update parameters:', error)
    } finally {
      setIsSaving(false)
    }
  }

  const hasChanges = 
    localTemp !== temperature || 
    localMaxTokens !== maxTokens || 
    localTopP !== topP

  return (
    <div className="bg-white rounded-xl border border-stone-200 shadow-soft">
      <div className="px-6 py-4 border-b border-stone-200">
        <div className="flex items-center gap-3">
          <Cog6ToothIcon className="w-5 h-5 text-stone-600" />
          <div>
            <h3 className="text-lg font-semibold text-stone-900">Model Parameters</h3>
            <p className="text-sm text-stone-500 mt-0.5">
              Adjust inference parameters for optimal performance
            </p>
          </div>
        </div>
      </div>

      <div className="p-6 space-y-6">
        {/* Model Info */}
        <div className="p-4 bg-stone-50 rounded-lg border border-stone-200">
          <div className="flex items-center justify-between">
            <span className="text-sm font-medium text-stone-700">Active Model</span>
            <span className="text-sm font-mono text-stone-900 bg-white px-3 py-1 rounded border border-stone-300">
              {model}
            </span>
          </div>
        </div>

        {/* Temperature */}
        <div>
          <div className="flex items-center justify-between mb-2">
            <label className="text-sm font-medium text-stone-900">
              Temperature
            </label>
            <span className="text-sm font-mono text-amber-600 bg-amber-50 px-2 py-0.5 rounded">
              {localTemp.toFixed(1)}
            </span>
          </div>
          <input
            type="range"
            min="0"
            max="1"
            step="0.1"
            value={localTemp}
            onChange={(e) => setLocalTemp(parseFloat(e.target.value))}
            disabled={readonly}
            aria-label="Temperature"
            className="w-full h-2 bg-stone-200 rounded-lg appearance-none cursor-pointer accent-amber-600 disabled:opacity-50"
          />
          <div className="flex items-center justify-between mt-1 text-xs text-stone-500">
            <span>Deterministic (0.0)</span>
            <span className="text-amber-600 font-medium">
              {localTemp < 0.3 ? 'Recommended for Main Agent' :
               localTemp < 0.7 ? 'Balanced' : 'Creative'}
            </span>
            <span>Creative (1.0)</span>
          </div>
        </div>

        {/* Max Tokens */}
        <div>
          <label className="block text-sm font-medium text-stone-900 mb-2">
            Max Tokens
          </label>
          <input
            type="number"
            min="100"
            max="4096"
            step="100"
            value={localMaxTokens}
            onChange={(e) => setLocalMaxTokens(parseInt(e.target.value) || 0)}
            disabled={readonly}
            aria-label="Max Tokens"
            className="w-full px-3 py-2 border border-stone-300 rounded-lg focus:ring-2 focus:ring-amber-500 focus:border-amber-500 outline-none disabled:bg-stone-100 disabled:cursor-not-allowed"
          />
          <p className="text-xs text-stone-500 mt-1.5">
            Maximum tokens in the response (100-4096)
          </p>
        </div>

        {/* Top-P */}
        <div>
          <div className="flex items-center justify-between mb-2">
            <label className="text-sm font-medium text-stone-900">
              Top-P (Nucleus Sampling)
            </label>
            <span className="text-sm font-mono text-amber-600 bg-amber-50 px-2 py-0.5 rounded">
              {localTopP.toFixed(2)}
            </span>
          </div>
          <input
            type="range"
            min="0"
            max="1"
            step="0.05"
            value={localTopP}
            onChange={(e) => setLocalTopP(parseFloat(e.target.value))}
            disabled={readonly}
            aria-label="Top-P"
            className="w-full h-2 bg-stone-200 rounded-lg appearance-none cursor-pointer accent-amber-600 disabled:opacity-50"
          />
          <div className="flex items-center justify-between mt-1 text-xs text-stone-500">
            <span>Focused (0.1)</span>
            <span>Diverse (1.0)</span>
          </div>
        </div>

        {hasChanges && !readonly && (
          <div className="pt-4 border-t border-stone-200 flex items-center gap-3">
            <button
              onClick={handleSave}
              disabled={isSaving}
              className="flex-1 px-4 py-2 text-sm font-medium text-white bg-amber-600 rounded-lg hover:bg-amber-700 disabled:bg-stone-300 disabled:cursor-not-allowed transition-colors cursor-pointer"
            >
              {isSaving ? 'Saving...' : 'Save Parameters'}
            </button>
            <button
              onClick={() => {
                setLocalTemp(temperature)
                setLocalMaxTokens(maxTokens)
                setLocalTopP(topP)
              }}
              disabled={isSaving}
              className="px-4 py-2 text-sm font-medium text-stone-700 bg-white border border-stone-300 rounded-lg hover:bg-stone-50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors cursor-pointer"
            >
              Reset
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
