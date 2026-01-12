import { useState, useRef, useEffect } from 'react'
import { PaperAirplaneIcon } from '@heroicons/react/24/solid'

interface MessageInputProps {
  onSend: (content: string) => void
  onTyping?: (typing: boolean) => void
  disabled?: boolean
  placeholder?: string
}

/**
 * Message input component with auto-resize textarea
 */
export function MessageInput({
  onSend,
  onTyping,
  disabled = false,
  placeholder = 'Nhap tin nhan...',
}: MessageInputProps) {
  const [text, setText] = useState('')
  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const typingTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  // Auto-resize textarea
  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto'
      textareaRef.current.style.height = `${Math.min(textareaRef.current.scrollHeight, 120)}px`
    }
  }, [text])

  const handleChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setText(e.target.value)

    // Typing indicator
    if (onTyping) {
      onTyping(true)

      // Clear previous timeout
      if (typingTimeoutRef.current) {
        clearTimeout(typingTimeoutRef.current)
      }

      // Set timeout to stop typing
      typingTimeoutRef.current = setTimeout(() => {
        onTyping(false)
      }, 1000)
    }
  }

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (text.trim() && !disabled) {
      onSend(text.trim())
      setText('')
      if (onTyping) {
        onTyping(false)
      }
    }
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSubmit(e)
    }
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="bg-white border-t-2 border-stone-900 p-4 flex items-end gap-3"
    >
      <div className="flex-1 relative">
        <textarea
          ref={textareaRef}
          value={text}
          onChange={handleChange}
          onKeyDown={handleKeyDown}
          placeholder={placeholder}
          disabled={disabled}
          rows={1}
          className="w-full min-h-[48px] max-h-[120px] py-3 px-4 bg-stone-50 border-2 border-stone-900 rounded-xl focus:outline-none focus:ring-2 focus:ring-amber-600/20 focus:border-amber-600 resize-none disabled:opacity-50 disabled:cursor-not-allowed transition-all"
        />
      </div>

      <button
        type="submit"
        disabled={!text.trim() || disabled}
        className="flex-shrink-0 w-12 h-12 bg-amber-600 text-white rounded-full border-2 border-stone-900 shadow-[3px_3px_0_#1c1917] hover:shadow-[5px_5px_0_#1c1917] hover:-translate-x-0.5 hover:-translate-y-0.5 active:translate-y-0.5 active:shadow-[1px_1px_0_#1c1917] disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:shadow-[3px_3px_0_#1c1917] disabled:hover:translate-x-0 disabled:hover:translate-y-0 transition-all flex items-center justify-center"
      >
        <PaperAirplaneIcon className="w-5 h-5" />
      </button>
    </form>
  )
}

export default MessageInput
