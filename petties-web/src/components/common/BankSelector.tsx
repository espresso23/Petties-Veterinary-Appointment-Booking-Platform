import { useState, useRef, useEffect } from 'react'
import { VIETQR_BANKS, type VietQRBank } from '../../utils/vietqr'
import { ChevronDownIcon } from '@heroicons/react/24/outline'

interface BankSelectorProps {
    value: string // Bank code (e.g., 'MB', 'VCB')
    onChange: (bankCode: string) => void
    disabled?: boolean
}

export function BankSelector({ value, onChange, disabled = false }: BankSelectorProps) {
    const [isOpen, setIsOpen] = useState(false)
    const [searchQuery, setSearchQuery] = useState('')
    const containerRef = useRef<HTMLDivElement>(null)
    const inputRef = useRef<HTMLInputElement>(null)

    const selectedBank = VIETQR_BANKS.find((bank) => bank.code === value)

    const filteredBanks = VIETQR_BANKS.filter(
        (bank) =>
            bank.shortName.toLowerCase().includes(searchQuery.toLowerCase()) ||
            bank.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
            bank.code.toLowerCase().includes(searchQuery.toLowerCase())
    )

    // Close dropdown when clicking outside
    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
                setIsOpen(false)
                setSearchQuery('')
            }
        }
        document.addEventListener('mousedown', handleClickOutside)
        return () => document.removeEventListener('mousedown', handleClickOutside)
    }, [])

    const handleSelectBank = (bank: VietQRBank) => {
        onChange(bank.code)
        setIsOpen(false)
        setSearchQuery('')
    }

    return (
        <div ref={containerRef} className="relative">
            {/* Selected Value or Search Input */}
            <button
                type="button"
                onClick={() => {
                    if (!disabled) {
                        setIsOpen(!isOpen)
                        if (!isOpen) {
                            setTimeout(() => inputRef.current?.focus(), 50)
                        }
                    }
                }}
                disabled={disabled}
                className="input-brutal w-full flex items-center justify-between gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
            >
                {selectedBank ? (
                    <div className="flex items-center gap-2">
                        <img src={selectedBank.logo} alt={selectedBank.shortName} className="w-6 h-6 object-contain" />
                        <span className="font-bold text-stone-900">{selectedBank.shortName}</span>
                    </div>
                ) : (
                    <span className="text-stone-500">Chon ngan hang...</span>
                )}
                <ChevronDownIcon className={`w-5 h-5 text-stone-600 transition-transform ${isOpen ? 'rotate-180' : ''}`} />
            </button>

            {/* Dropdown */}
            {isOpen && (
                <div className="absolute z-50 w-full mt-1 bg-white border-4 border-stone-900 shadow-brutal max-h-72 overflow-hidden">
                    {/* Search Input */}
                    <div className="p-2 border-b-2 border-stone-900">
                        <input
                            ref={inputRef}
                            type="text"
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            className="w-full px-3 py-2 border-2 border-stone-900 focus:outline-none focus:border-amber-600 font-bold text-sm"
                            placeholder="Tim kiem ngan hang..."
                        />
                    </div>

                    {/* Bank List */}
                    <div className="max-h-52 overflow-y-auto">
                        {filteredBanks.length === 0 ? (
                            <div className="p-4 text-center text-stone-500 font-bold text-sm">Khong tim thay ngan hang</div>
                        ) : (
                            filteredBanks.map((bank) => (
                                <button
                                    key={bank.id}
                                    type="button"
                                    onClick={() => handleSelectBank(bank)}
                                    className={`w-full flex items-center gap-3 p-3 hover:bg-stone-100 border-b border-stone-200 last:border-b-0 text-left transition-colors ${value === bank.code ? 'bg-amber-50' : ''
                                        }`}
                                >
                                    <img src={bank.logo} alt={bank.shortName} className="w-8 h-8 object-contain flex-shrink-0" />
                                    <div className="flex-1 min-w-0">
                                        <div className="font-bold text-sm text-stone-900 truncate">{bank.shortName}</div>
                                        <div className="text-xs text-stone-500 truncate">{bank.name}</div>
                                    </div>
                                </button>
                            ))
                        )}
                    </div>
                </div>
            )}
        </div>
    )
}
