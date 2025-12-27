import { useRef, useEffect, type KeyboardEvent, type ClipboardEvent } from 'react'

interface OtpInputProps {
    length?: number
    value: string
    onChange: (value: string) => void
    disabled?: boolean
    autoFocus?: boolean
}

/**
 * OtpInput - Component nhập mã OTP 6 số
 * 
 * Features:
 * - Auto-focus input tiếp theo khi nhập số
 * - Paste support (paste toàn bộ OTP)
 * - Backspace để xóa và quay lại ô trước
 * - Style Neobrutalism matching với app
 */
export function OtpInput({
    length = 6,
    value,
    onChange,
    disabled = false,
    autoFocus = true,
}: OtpInputProps) {
    const inputRefs = useRef<(HTMLInputElement | null)[]>([])

    // Split value into array of single characters
    const values = value.split('').slice(0, length)

    // Focus first input on mount
    useEffect(() => {
        if (autoFocus && inputRefs.current[0]) {
            inputRefs.current[0].focus()
        }
    }, [autoFocus])

    const handleChange = (index: number, newValue: string) => {
        // Only allow digits
        const digit = newValue.replace(/\D/g, '').slice(-1)

        if (digit) {
            // Build new value
            const newValues = [...values]
            while (newValues.length < length) newValues.push('')
            newValues[index] = digit

            onChange(newValues.join(''))

            // Move to next input
            if (index < length - 1) {
                inputRefs.current[index + 1]?.focus()
            }
        }
    }

    const handleKeyDown = (index: number, e: KeyboardEvent<HTMLInputElement>) => {
        if (e.key === 'Backspace') {
            e.preventDefault()

            const newValues = [...values]
            while (newValues.length < length) newValues.push('')

            if (values[index]) {
                // Clear current input
                newValues[index] = ''
                onChange(newValues.join(''))
            } else if (index > 0) {
                // Move to previous input and clear it
                newValues[index - 1] = ''
                onChange(newValues.join(''))
                inputRefs.current[index - 1]?.focus()
            }
        }

        // Arrow key navigation
        if (e.key === 'ArrowLeft' && index > 0) {
            e.preventDefault()
            inputRefs.current[index - 1]?.focus()
        }
        if (e.key === 'ArrowRight' && index < length - 1) {
            e.preventDefault()
            inputRefs.current[index + 1]?.focus()
        }
    }

    const handlePaste = (e: ClipboardEvent<HTMLInputElement>) => {
        e.preventDefault()
        const pastedData = e.clipboardData.getData('text').replace(/\D/g, '').slice(0, length)

        if (pastedData) {
            onChange(pastedData)

            // Focus last filled input or the next empty one
            const focusIndex = Math.min(pastedData.length, length - 1)
            inputRefs.current[focusIndex]?.focus()
        }
    }

    return (
        <div className="flex justify-center gap-2 sm:gap-3">
            {Array.from({ length }).map((_, index) => (
                <input
                    key={index}
                    ref={(el) => { inputRefs.current[index] = el }}
                    type="text"
                    inputMode="numeric"
                    pattern="\d*"
                    maxLength={1}
                    value={values[index] || ''}
                    onChange={(e) => handleChange(index, e.target.value)}
                    onKeyDown={(e) => handleKeyDown(index, e)}
                    onPaste={handlePaste}
                    disabled={disabled}
                    autoComplete="one-time-code"
                    className={`
            w-10 h-12 sm:w-12 sm:h-14
            text-center text-xl sm:text-2xl font-bold
            text-stone-900
            border-4 border-stone-900
            bg-white
            shadow-brutal-sm
            transition-all duration-150
            focus:outline-none focus:bg-amber-100 focus:translate-x-[-2px] focus:translate-y-[-2px] focus:shadow-brutal
            disabled:opacity-50 disabled:cursor-not-allowed
            ${values[index] ? 'bg-amber-50' : ''}
          `}
                />
            ))}
        </div>
    )
}
