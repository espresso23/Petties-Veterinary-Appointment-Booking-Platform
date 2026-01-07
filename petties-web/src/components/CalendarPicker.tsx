import { useState, useRef, useEffect } from 'react'
import { ChevronLeftIcon, ChevronRightIcon, CalendarIcon } from '@heroicons/react/24/outline'

interface CalendarPickerProps {
    value: Date
    onChange: (date: Date) => void
    mode?: 'date' | 'month'
    displayFormat?: (date: Date) => string
}

const DAYS_VN = ['T2', 'T3', 'T4', 'T5', 'T6', 'T7', 'CN']
const MONTHS_VN = ['Th1', 'Th2', 'Th3', 'Th4', 'Th5', 'Th6', 'Th7', 'Th8', 'Th9', 'Th10', 'Th11', 'Th12']

export const CalendarPicker = ({ value, onChange, mode = 'date', displayFormat }: CalendarPickerProps) => {
    const [isOpen, setIsOpen] = useState(false)
    const [viewDate, setViewDate] = useState(new Date(value))
    const containerRef = useRef<HTMLDivElement>(null)

    useEffect(() => {
        const handleClickOutside = (e: MouseEvent) => {
            if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
                setIsOpen(false)
            }
        }
        document.addEventListener('mousedown', handleClickOutside)
        return () => document.removeEventListener('mousedown', handleClickOutside)
    }, [])

    useEffect(() => {
        setViewDate(new Date(value))
    }, [value])

    const handlePrevMonth = () => {
        setViewDate(new Date(viewDate.getFullYear(), viewDate.getMonth() - 1, 1))
    }

    const handleNextMonth = () => {
        setViewDate(new Date(viewDate.getFullYear(), viewDate.getMonth() + 1, 1))
    }

    const handlePrevYear = () => {
        setViewDate(new Date(viewDate.getFullYear() - 1, viewDate.getMonth(), 1))
    }

    const handleNextYear = () => {
        setViewDate(new Date(viewDate.getFullYear() + 1, viewDate.getMonth(), 1))
    }

    const handleSelectDate = (day: number) => {
        const newDate = new Date(viewDate.getFullYear(), viewDate.getMonth(), day, 12, 0, 0)
        console.log('CalendarPicker: Selected date:', newDate)
        onChange(newDate)
        setIsOpen(false)
    }

    const handleSelectMonth = (month: number) => {
        const newDate = new Date(viewDate.getFullYear(), month, 1, 12, 0, 0)
        onChange(newDate)
        setIsOpen(false)
    }

    const handleToday = () => {
        const today = new Date()
        today.setHours(12, 0, 0, 0)
        onChange(today)
        setViewDate(today)
        setIsOpen(false)
    }

    const generateCalendarDays = () => {
        const firstDay = new Date(viewDate.getFullYear(), viewDate.getMonth(), 1)
        const lastDay = new Date(viewDate.getFullYear(), viewDate.getMonth() + 1, 0)
        const startOffset = firstDay.getDay() === 0 ? 6 : firstDay.getDay() - 1
        const days = []
        for (let i = 0; i < startOffset; i++) {
            days.push({ day: 0, isCurrentMonth: false })
        }
        for (let d = 1; d <= lastDay.getDate(); d++) {
            days.push({ day: d, isCurrentMonth: true })
        }
        return days
    }

    const isToday = (day: number) => {
        const today = new Date()
        return day === today.getDate() &&
            viewDate.getMonth() === today.getMonth() &&
            viewDate.getFullYear() === today.getFullYear()
    }

    const isSelected = (day: number) => {
        return day === value.getDate() &&
            viewDate.getMonth() === value.getMonth() &&
            viewDate.getFullYear() === value.getFullYear()
    }

    const defaultDisplayFormat = (date: Date) => {
        if (mode === 'month') {
            return `${date.getMonth() + 1}/${date.getFullYear()}`
        }
        return `${date.getDate()}/${date.getMonth() + 1}/${date.getFullYear()}`
    }

    const formatDisplay = displayFormat || defaultDisplayFormat

    return (
        <div ref={containerRef} className="relative">
            {/* Trigger */}
            <button
                type="button"
                onClick={() => setIsOpen(!isOpen)}
                className="font-bold text-sm px-3 py-1.5 border-2 border-stone-900 rounded-lg bg-stone-50 text-stone-900 shadow-[2px_2px_0px_0px_rgba(28,25,23,1)] hover:bg-amber-100 transition-all cursor-pointer flex items-center gap-1.5"
            >
                <CalendarIcon className="w-3.5 h-3.5 text-amber-600" />
                <span>{formatDisplay(value)}</span>
            </button>

            {/* Dropdown - Centered */}
            {isOpen && (
                <div className="absolute top-full left-1/2 -translate-x-1/2 mt-1 z-50 bg-white border-2 border-stone-900 rounded-lg shadow-[2px_2px_0px_0px_rgba(28,25,23,1)] p-2 w-[220px]">
                    {mode === 'date' ? (
                        <>
                            {/* Header */}
                            <div className="flex items-center justify-between mb-2">
                                <button onClick={handlePrevMonth} className="w-6 h-6 flex items-center justify-center rounded border border-stone-300 hover:bg-amber-100 text-xs">
                                    <ChevronLeftIcon className="w-3 h-3" />
                                </button>
                                <span className="font-bold text-xs text-stone-900">
                                    {MONTHS_VN[viewDate.getMonth()]} {viewDate.getFullYear()}
                                </span>
                                <button onClick={handleNextMonth} className="w-6 h-6 flex items-center justify-center rounded border border-stone-300 hover:bg-amber-100 text-xs">
                                    <ChevronRightIcon className="w-3 h-3" />
                                </button>
                            </div>

                            {/* Day Headers */}
                            <div className="grid grid-cols-7 gap-0.5 mb-1">
                                {DAYS_VN.map(day => (
                                    <div key={day} className="text-center text-[10px] font-bold text-stone-400">{day}</div>
                                ))}
                            </div>

                            {/* Days */}
                            <div className="grid grid-cols-7 gap-0.5">
                                {generateCalendarDays().map((item, idx) => (
                                    <button
                                        key={idx}
                                        disabled={!item.isCurrentMonth}
                                        onClick={() => item.day > 0 && handleSelectDate(item.day)}
                                        className={`
                                            w-6 h-6 rounded text-[10px] font-bold transition-all
                                            ${!item.isCurrentMonth ? 'invisible' : ''}
                                            ${isSelected(item.day) ? 'bg-amber-500 text-white' : ''}
                                            ${isToday(item.day) && !isSelected(item.day) ? 'bg-amber-100 text-amber-700' : ''}
                                            ${!isSelected(item.day) && !isToday(item.day) && item.isCurrentMonth ? 'hover:bg-stone-100 text-stone-700' : ''}
                                        `}
                                    >
                                        {item.day > 0 && item.day}
                                    </button>
                                ))}
                            </div>

                            {/* Footer */}
                            <div className="mt-2 pt-2 border-t border-stone-200 flex justify-center">
                                <button onClick={handleToday} className="text-[10px] font-bold text-amber-600 hover:text-amber-700 px-2 py-1 rounded hover:bg-amber-50">
                                    Hôm nay
                                </button>
                            </div>
                        </>
                    ) : (
                        <>
                            {/* Month Mode */}
                            <div className="flex items-center justify-between mb-2">
                                <button onClick={handlePrevYear} className="w-6 h-6 flex items-center justify-center rounded border border-stone-300 hover:bg-amber-100">
                                    <ChevronLeftIcon className="w-3 h-3" />
                                </button>
                                <span className="font-bold text-sm text-amber-600">{viewDate.getFullYear()}</span>
                                <button onClick={handleNextYear} className="w-6 h-6 flex items-center justify-center rounded border border-stone-300 hover:bg-amber-100">
                                    <ChevronRightIcon className="w-3 h-3" />
                                </button>
                            </div>
                            <div className="grid grid-cols-4 gap-1">
                                {MONTHS_VN.map((month, idx) => {
                                    const isCurrentMonth = idx === new Date().getMonth() && viewDate.getFullYear() === new Date().getFullYear()
                                    const isSelectedMonth = idx === value.getMonth() && viewDate.getFullYear() === value.getFullYear()
                                    return (
                                        <button
                                            key={month}
                                            onClick={() => handleSelectMonth(idx)}
                                            className={`
                                                px-1 py-1.5 rounded text-[10px] font-bold transition-all
                                                ${isSelectedMonth ? 'bg-amber-500 text-white' : ''}
                                                ${isCurrentMonth && !isSelectedMonth ? 'bg-amber-100 text-amber-700' : ''}
                                                ${!isSelectedMonth && !isCurrentMonth ? 'hover:bg-stone-100 text-stone-700' : ''}
                                            `}
                                        >
                                            {month}
                                        </button>
                                    )
                                })}
                            </div>
                        </>
                    )}
                </div>
            )}
        </div>
    )
}
