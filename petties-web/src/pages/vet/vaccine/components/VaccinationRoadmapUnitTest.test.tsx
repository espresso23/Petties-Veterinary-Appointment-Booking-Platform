import { render, screen } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { VaccinationRoadmap } from './VaccinationRoadmap';
import type { VaccinationRecord } from '../../../../services/vaccinationService';

// Mock vaccinationService
vi.mock('../../../../services/vaccinationService', () => ({
    vaccinationService: {
        formatDate: (date: string | null) => date ? new Date(date).toLocaleDateString('vi-VN') : '-',
        calculateStatus: (date: string | null) => {
            if (!date) return 'Upcoming';
            return new Date(date) < new Date() ? 'Overdue' : 'Upcoming';
        }
    }
}));

const mockRecords: VaccinationRecord[] = [
    {
        id: '1',
        vaccineName: 'Rabies',
        doseNumber: 1,
        workflowStatus: 'COMPLETED',
        vaccinationDate: '2023-01-01',
        petId: 'pet1',
        clinicId: 'clinic1',
        vetId: 'vet1',
        clinicName: 'Clinic One',
        vetName: 'Vet One',
        createdAt: '2023-01-01',
        status: 'Valid'
    }
];

const mockUpcoming: VaccinationRecord[] = [
    {
        id: 'temp-1',
        vaccineName: 'Rabies',
        doseNumber: 2,
        nextDueDate: '2024-01-01',
        workflowStatus: 'PENDING',
        petId: 'pet1',
        clinicId: '',
        vetId: '',
        clinicName: '',
        vetName: '',
        createdAt: '2023-12-01',
        status: 'N/A'
    },
    {
        id: 'temp-2',
        vaccineName: 'DHPPi',
        doseNumber: 1,
        nextDueDate: '2024-02-01',
        workflowStatus: 'PENDING',
        petId: 'pet1',
        clinicId: '',
        vetId: '',
        clinicName: '',
        vetName: '',
        createdAt: '2023-12-01',
        status: 'N/A'
    }
];

describe('VaccinationRoadmapUnitTest', () => {
    it('renders roadmap table with correct headers', () => {
        render(<VaccinationRoadmap records={[]} upcomingRecords={[]} />);
        expect(screen.getByText('Lộ trình tiêm chủng (Roadmap)')).toBeInTheDocument();
        expect(screen.getByText('Loại Vaccine')).toBeInTheDocument();
        expect(screen.getByText('Mũi 1')).toBeInTheDocument();
        expect(screen.getByText('Mũi 2')).toBeInTheDocument();
    });

    it('renders completed vaccination history', () => {
        render(<VaccinationRoadmap records={mockRecords} upcomingRecords={[]} />);
        expect(screen.getByText('Rabies')).toBeInTheDocument();
        expect(screen.getByText('Đã tiêm')).toBeInTheDocument();
    });

    it('merges prediction data correctly (matches existing vaccine name)', () => {
        // Should show Rabies row with Dose 1 (Done) and Dose 2 (Predicted)
        render(<VaccinationRoadmap records={mockRecords} upcomingRecords={mockUpcoming} />);

        // Check for Rabies row
        const rabiesRow = screen.getByText('Rabies').closest('tr');
        expect(rabiesRow).toBeInTheDocument();

        // Within this row, we should find "Đã tiêm" (Dose 1) and "Dự kiến" badge (Dose 2)
        expect(screen.getByText('Đã tiêm')).toBeInTheDocument();
        expect(screen.getByText('Dự kiến')).toBeInTheDocument();
    });

    it('does NOT render vaccine group for pure prediction (DHPPi)', () => {
        render(<VaccinationRoadmap records={mockRecords} upcomingRecords={mockUpcoming} />);

        // Should NOT see DHPPi as it has no history (pure prediction)
        // The component filters out groups where all records are 'predicted-'
        expect(screen.queryByText('DHPPi')).not.toBeInTheDocument();
    });
});
