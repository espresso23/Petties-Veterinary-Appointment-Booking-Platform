import { useState } from 'react'
import { DocumentTextIcon, CheckIcon, XMarkIcon } from '@heroicons/react/24/outline'

interface SystemPromptEditorProps {
  prompt: string
  onSave: (prompt: string, versionNote?: string) => Promise<void>
  agentName: string
  readonly?: boolean
}

/**
 * System Prompt Editor with version control
 * Supports editing, saving with version notes
 */
export const SystemPromptEditor = ({
  prompt,
  onSave,
  agentName,
  readonly = false
}: SystemPromptEditorProps) => {
  const [editedPrompt, setEditedPrompt] = useState(prompt)
  const [isEditing, setIsEditing] = useState(false)
  const [isSaving, setIsSaving] = useState(false)
  const [versionNote, setVersionNote] = useState('')

  const handleSave = async () => {
    setIsSaving(true)
    try {
      await onSave(editedPrompt, versionNote || `Updated ${agentName} prompt`)
      setIsEditing(false)
      setVersionNote('')
    } catch (error) {
      console.error('Failed to save prompt:', error)
    } finally {
      setIsSaving(false)
    }
  }

  const handleCancel = () => {
    setEditedPrompt(prompt)
    setIsEditing(false)
    setVersionNote('')
  }

  return (
    <div className="bg-white rounded-xl border border-stone-200 shadow-soft">
      <div className="px-6 py-4 border-b border-stone-200 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <DocumentTextIcon className="w-5 h-5 text-stone-600" />
          <div>
            <h3 className="text-lg font-semibold text-stone-900">System Prompt</h3>
            <p className="text-sm text-stone-500 mt-0.5">
              Configure the agent&apos;s instructions and behavior
            </p>
          </div>
        </div>
        {!readonly && !isEditing && (
          <button
            onClick={() => setIsEditing(true)}
            className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium text-amber-700 bg-amber-50 border border-amber-200 rounded-lg hover:bg-amber-100 transition-colors cursor-pointer"
          >
            <DocumentTextIcon className="w-4 h-4" />
            Edit Prompt
          </button>
        )}
      </div>

      <div className="p-6">
        <textarea
          value={editedPrompt}
          onChange={(e) => setEditedPrompt(e.target.value)}
          readOnly={!isEditing || readonly}
          rows={12}
          className={`
            w-full px-4 py-3 border rounded-lg font-mono text-sm
            ${isEditing && !readonly
              ? 'border-amber-300 focus:ring-2 focus:ring-amber-500 focus:border-amber-500 bg-white'
              : 'border-stone-200 bg-stone-50 text-stone-700'
            }
            resize-y outline-none transition-colors
          `}
          placeholder="Enter system prompt instructions..."
        />

        {isEditing && !readonly && (
          <div className="mt-4 space-y-3">
            <div>
              <label className="block text-sm font-medium text-stone-700 mb-1.5">
                Version Note (Optional)
              </label>
              <input
                type="text"
                value={versionNote}
                onChange={(e) => setVersionNote(e.target.value)}
                placeholder="e.g., Added multilingual support"
                className="w-full px-3 py-2 border border-stone-300 rounded-lg focus:ring-2 focus:ring-amber-500 focus:border-amber-500 outline-none text-sm"
              />
            </div>
            <div className="flex items-center gap-3">
              <button
                onClick={handleSave}
                disabled={isSaving}
                className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-amber-600 rounded-lg hover:bg-amber-700 disabled:bg-stone-300 disabled:cursor-not-allowed transition-colors cursor-pointer"
              >
                <CheckIcon className="w-4 h-4" />
                {isSaving ? 'Saving...' : 'Save Changes'}
              </button>
              <button
                onClick={handleCancel}
                disabled={isSaving}
                className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium text-stone-700 bg-white border border-stone-300 rounded-lg hover:bg-stone-50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors cursor-pointer"
              >
                <XMarkIcon className="w-4 h-4" />
                Cancel
              </button>
            </div>
          </div>
        )}

        {!isEditing && (
          <div className="mt-4 flex items-center gap-2 text-xs text-stone-500">
            <span>Characters: {editedPrompt.length}</span>
            <span>•</span>
            <span>Lines: {editedPrompt.split('\n').length}</span>
          </div>
        )}
      </div>
    </div>
  )
}
