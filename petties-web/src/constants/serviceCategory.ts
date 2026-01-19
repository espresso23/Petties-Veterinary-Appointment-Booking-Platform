/**
 * Service Category - Must match backend enum ServiceCategory.java
 * Each category maps to a StaffSpecialty for auto-vet assignment
 */

import { BeakerIcon, HeartIcon, ScissorsIcon, HomeIcon, SparklesIcon, SunIcon } from '@heroicons/react/24/solid'
import type { ComponentType, SVGProps } from 'react'

// Const values matching backend enum
export const ServiceCategory = {
    GROOMING_SPA: 'GROOMING_SPA',
    VACCINATION: 'VACCINATION',
    CHECK_UP: 'CHECK_UP',
    SURGERY: 'SURGERY',
    DENTAL: 'DENTAL',
    DERMATOLOGY: 'DERMATOLOGY',
    OTHER: 'OTHER',
} as const

export type ServiceCategoryType = typeof ServiceCategory[keyof typeof ServiceCategory]

// Display info for each category
export interface CategoryInfo {
    id: ServiceCategoryType
    label: string         // Vietnamese display name
    labelEn: string       // English for debugging
    icon: ComponentType<SVGProps<SVGSVGElement>>
    color: string         // Background color
    textColor: string     // High-contrast text color
    specialty: string     // Required StaffSpecialty (reference only)
}

// Category configurations
export const SERVICE_CATEGORIES: CategoryInfo[] = [
    {
        id: ServiceCategory.GROOMING_SPA,
        label: 'Làm Đẹp & Spa',
        labelEn: 'Grooming & Spa',
        icon: SparklesIcon,
        color: '#f5f3ff', // Violet 50
        textColor: '#7c3aed', // Violet 600
        specialty: 'GROOMER',
    },
    {
        id: ServiceCategory.VACCINATION,
        label: 'Tiêm Phòng',
        labelEn: 'Vaccination',
        icon: BeakerIcon,
        color: '#ecfdf5', // Emerald 50
        textColor: '#059669', // Emerald 600
        specialty: 'VET_GENERAL',
    },
    {
        id: ServiceCategory.CHECK_UP,
        label: 'Khám Tổng Quát',
        labelEn: 'Check-up',
        icon: HeartIcon,
        color: '#e0f2fe', // Sky 50
        textColor: '#0284c7', // Sky 600
        specialty: 'VET_GENERAL',
    },
    {
        id: ServiceCategory.SURGERY,
        label: 'Phẫu Thuật',
        labelEn: 'Surgery',
        icon: SunIcon, // Use Sun icon for major surgery (bright/powerful)
        color: '#fef2f2', // Red 50
        textColor: '#dc2626', // Red 600
        specialty: 'VET_SURGERY',
    },
    {
        id: ServiceCategory.DENTAL,
        label: 'Nha Khoa',
        labelEn: 'Dental',
        icon: SparklesIcon,
        color: '#fff7ed', // Orange 50
        textColor: '#ea580c', // Orange 600
        specialty: 'VET_DENTAL',
    },
    {
        id: ServiceCategory.DERMATOLOGY,
        label: 'Da Liễu',
        labelEn: 'Dermatology',
        icon: ScissorsIcon, // Scissors icon for grooming/skin/hair treatments
        color: '#fdf4ff', // Fuchsia 50
        textColor: '#c026d3', // Fuchsia 600
        specialty: 'VET_DERMATOLOGY',
    },
    {
        id: ServiceCategory.OTHER,
        label: 'Khác',
        labelEn: 'Other',
        icon: HomeIcon,
        color: '#f9fafb', // Slate 50
        textColor: '#475569', // Slate 600
        specialty: 'VET_GENERAL',
    },
]

// Helper function to get category info by id
export const getCategoryById = (id: string | undefined): CategoryInfo | undefined => {
    return SERVICE_CATEGORIES.find(c => c.id === id)
}

// Helper function to get category label
export const getCategoryLabel = (id: string | undefined): string => {
    return getCategoryById(id)?.label || 'Chưa phân loại'
}

// Default category for new services
export const DEFAULT_CATEGORY = ServiceCategory.OTHER
