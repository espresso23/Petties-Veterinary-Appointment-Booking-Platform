import { useState, useRef, useEffect } from 'react';
import { ChevronDownIcon } from '@heroicons/react/24/outline';

interface Option {
    id: string | number;
    label: string;
}

interface BrutalSelectProps {
    options: Option[];
    value: string | number | 'none';
    onChange: (value: string | number | 'none') => void;
    placeholder: string;
    disabled?: boolean;
    label?: string;
}

export function BrutalSelect({
    options,
    value,
    onChange,
    placeholder,
    disabled = false,
    label
}: BrutalSelectProps) {
    const [isOpen, setIsOpen] = useState(false);
    const containerRef = useRef<HTMLDivElement>(null);

    const selectedOption = options.find(opt => opt.id === value);

    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
                setIsOpen(false);
            }
        };

        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    return (
        <div className="w-full" ref={containerRef}>
            {label && (
                <label className="block text-xs font-black uppercase text-stone-500 mb-1 ml-1">
                    {label}
                </label>
            )}
            <div className="relative">
                <button
                    type="button"
                    disabled={disabled}
                    onClick={() => setIsOpen(!isOpen)}
                    className={`
            input-brutal w-full flex items-center justify-between bg-white text-left
            ${disabled ? 'opacity-50 cursor-not-allowed bg-stone-100' : 'cursor-pointer'}
            ${isOpen ? 'bg-amber-50' : ''}
          `}
                >
                    <span className={`truncate ${value === 'none' ? 'text-stone-400' : 'text-stone-900 font-bold'}`}>
                        {selectedOption ? selectedOption.label : placeholder}
                    </span>
                    <ChevronDownIcon
                        className={`w-5 h-5 text-stone-900 transition-transform duration-200 ${isOpen ? 'rotate-180' : ''}`}
                    />
                </button>

                {isOpen && !disabled && (
                    <div className="absolute z-[2000] w-full mt-2 bg-white border-4 border-stone-900 shadow-brutal max-h-60 overflow-y-auto">
                        <div
                            className="p-3 hover:bg-stone-100 cursor-pointer border-b-2 border-stone-900 font-bold text-sm text-stone-500 italic"
                            onClick={() => {
                                onChange('none');
                                setIsOpen(false);
                            }}
                        >
                            {placeholder}
                        </div>
                        {options.map((option) => (
                            <div
                                key={option.id}
                                className={`
                  p-3 hover:bg-stone-100 cursor-pointer border-b-2 border-stone-900 last:border-b-0 
                  font-bold text-sm text-stone-900 transition-colors
                  ${value === option.id ? 'bg-amber-100' : ''}
                `}
                                onClick={() => {
                                    onChange(option.id);
                                    setIsOpen(false);
                                }}
                            >
                                {option.label}
                            </div>
                        ))}
                    </div>
                )}
            </div>
        </div>
    );
}
