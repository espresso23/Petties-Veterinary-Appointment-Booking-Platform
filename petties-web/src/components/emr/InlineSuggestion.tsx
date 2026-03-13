import { useState, useEffect, useRef } from 'react'

interface InlineSuggestionProps {
    value: string
    onChange: (value: string) => void
    fieldName: string
    suggestions: string[]
    placeholder?: string
    disabled?: boolean
    className?: string
}

export const InlineSuggestion = ({
    value,
    onChange,
    fieldName,
    suggestions,
    placeholder,
    disabled = false,
    className = ''
}: InlineSuggestionProps) => {
    const [showSuggestions, setShowSuggestions] = useState(false)
    const [cursorPosition, setCursorPosition] = useState(0)
    const inputRef = useRef<HTMLTextAreaElement>(null)
    const containerRef = useRef<HTMLDivElement>(null)

    // Filter suggestions based on current input
    const filteredSuggestions = suggestions.filter(s => 
        s.toLowerCase().includes(value.toLowerCase()) && 
        s.toLowerCase() !== value.toLowerCase()
    )

    // Close suggestions when clicking outside
    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
                setShowSuggestions(false)
            }
        }

        document.addEventListener('mousedown', handleClickOutside)
        return () => document.removeEventListener('mousedown', handleClickOutside)
    }, [])

    const handleChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
        const newValue = e.target.value
        onChange(newValue)
        
        // Track cursor position
        const textarea = e.target
        setCursorPosition(textarea.selectionStart)
        
        // Show suggestions if there's input and matches
        if (newValue.trim().length > 0 && filteredSuggestions.length > 0) {
            setShowSuggestions(true)
        } else {
            setShowSuggestions(false)
        }
    }

    const handleSuggestionClick = (suggestion: string) => {
        // Insert suggestion at cursor position
        const before = value.substring(0, cursorPosition)
        const after = value.substring(cursorPosition)
        
        // Add space before suggestion if needed
        const prefix = before.length > 0 && !before.endsWith(' ') ? ' ' : ''
        const suffix = after.length > 0 && !after.startsWith(' ') ? ' ' : ''
        
        onChange(before + prefix + suggestion + suffix)
        setShowSuggestions(false)
        
        // Focus back on input
        inputRef.current?.focus()
    }

    const handleKeyDown = (e: React.KeyboardEvent) => {
        if (e.key === 'Tab' && showSuggestions && filteredSuggestions.length > 0) {
            e.preventDefault()
            handleSuggestionClick(filteredSuggestions[0])
        }
        if (e.key === 'Escape') {
            setShowSuggestions(false)
        }
    }

    return (
        <div ref={containerRef} className={`relative ${className}`}>
            <textarea
                ref={inputRef}
                value={value}
                onChange={handleChange}
                onKeyDown={handleKeyDown}
                onFocus={() => {
                    if (value.trim().length > 0 && filteredSuggestions.length > 0) {
                        setShowSuggestions(true)
                    }
                }}
                placeholder={placeholder}
                disabled={disabled}
                className="w-full px-4 py-3 border-2 border-stone-900 rounded-lg shadow-[2px_2px_0_#1c1917] focus:outline-none focus:shadow-[3px_3px_0_#1c1917] focus:-translate-y-0.5 transition-all text-sm disabled:bg-stone-100 disabled:cursor-not-allowed resize-none"
                rows={3}
            />
            
            {/* Suggestion dropdown */}
            {showSuggestions && filteredSuggestions.length > 0 && (
                <div className="absolute z-20 w-full mt-1 bg-white border-2 border-stone-900 rounded-lg shadow-[3px_3px_0_#1c1917] max-h-40 overflow-y-auto">
                    <div className="px-3 py-1 bg-amber-100 border-b border-stone-200">
                        <span className="text-xs font-bold text-stone-600 uppercase">
                            Gợi ý AI cho {fieldName}
                        </span>
                        <span className="text-xs text-stone-400 ml-2">(Tab để chọn)</span>
                    </div>
                    {filteredSuggestions.slice(0, 5).map((suggestion, index) => (
                        <button
                            key={index}
                            onClick={() => handleSuggestionClick(suggestion)}
                            className="w-full px-3 py-2 text-left text-sm text-stone-700 hover:bg-amber-50 border-b border-stone-100 last:border-b-0 transition-colors"
                        >
                            {suggestion}
                        </button>
                    ))}
                </div>
            )}
            
            {/* Show indicator when AI suggestions are available */}
            {suggestions.length > 0 && !showSuggestions && (
                <div className="absolute right-2 top-2">
                    <span className="flex h-2 w-2">
                        <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-amber-400 opacity-75"></span>
                        <span className="relative inline-flex rounded-full h-2 w-2 bg-amber-500"></span>
                    </span>
                </div>
            )}
        </div>
    )
}

export default InlineSuggestion
