import React from 'react';
import { type VaccinationRecord, vaccinationService } from '../../../../services/vaccinationService';
import { CheckCircleIcon, ClockIcon, ExclamationCircleIcon } from '@heroicons/react/24/solid';

interface RoadmapProps {
    records: VaccinationRecord[];
    upcomingRecords?: VaccinationRecord[];
}

export const VaccinationRoadmap: React.FC<RoadmapProps> = ({ records, upcomingRecords = [] }) => {
    // Merge records with upcoming predictions
    const allRecords = [...records];

    // Add upcoming predictions that don't already exist in records
    upcomingRecords.forEach(upcoming => {
        const normalizedUpcoming = upcoming.vaccineName
            .toLowerCase()
            .replace(/\(booster\)/gi, '')
            .replace(/\(hàng năm\)/gi, '')
            .replace(/[^a-z0-9]/g, '');

        const exists = records.some(r => {
            const normalizedRecord = r.vaccineName
                .toLowerCase()
                .replace(/\(booster\)/gi, '')
                .replace(/\(hàng năm\)/gi, '')
                .replace(/[^a-z0-9]/g, '');
            return normalizedRecord === normalizedUpcoming && r.doseNumber === upcoming.doseNumber;
        });

        if (!exists) {
            allRecords.push({
                ...upcoming,
                id: `predicted-${upcoming.vaccineName}-${upcoming.doseNumber}`,
                workflowStatus: 'PENDING',
            });
        }
    });

    // Group records by Normalized Name to ensure predictions merge with history
    const groups = allRecords.reduce((acc, record) => {
        const normalizedName = record.vaccineName
            .toLowerCase()
            .replace(/\(booster\)/gi, '')
            .replace(/\(hàng năm\)/gi, '')
            .replace(/[^a-z0-9]/g, '');

        // Use normalized name as the grouping key
        const key = normalizedName;

        if (!acc[key]) acc[key] = [];
        acc[key].push(record);
        return acc;
    }, {} as Record<string, VaccinationRecord[]>);

    // Sort each group by dose number or date
    Object.values(groups).forEach(group => {
        group.sort((a, b) => {
            if (a.doseNumber && b.doseNumber) return a.doseNumber - b.doseNumber;
            const dateA = new Date(a.vaccinationDate || a.nextDueDate || 0).getTime();
            const dateB = new Date(b.vaccinationDate || b.nextDueDate || 0).getTime();
            return dateA - dateB;
        });
    });

    return (
        <div className="bg-white rounded-2xl border border-stone-200 overflow-hidden shadow-sm animate-in fade-in slide-in-from-bottom-4 duration-500">
            <div className="bg-stone-50 px-6 py-4 border-b border-stone-100">
                <h3 className="text-sm font-bold text-stone-500 uppercase tracking-widest">Lộ trình tiêm chủng (Roadmap)</h3>
            </div>

            <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse">
                    <thead>
                        <tr className="bg-white text-[10px] uppercase font-bold text-stone-400 tracking-wider">
                            <th className="px-6 py-4 border-b border-stone-100 min-w-[200px]">Loại Vaccine</th>
                            <th className="px-6 py-4 border-b border-stone-100">Mũi 1</th>
                            <th className="px-6 py-4 border-b border-stone-100">Mũi 2</th>
                            <th className="px-6 py-4 border-b border-stone-100">Mũi 3</th>
                            <th className="px-6 py-4 border-b border-stone-100">Mũi 4+ / Nhắc lại</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-stone-50">
                        {Object.entries(groups)
                            .filter(([_, doses]) => doses.some(d => !d.id?.toString().startsWith('predicted-')))
                            .map(([key, doses]) => {
                                const vaccineName = doses[0].vaccineName
                                    .replace(/\(booster\)/gi, '')
                                    .replace(/\(hàng năm\)/gi, '')
                                    .trim();

                                const totalDoses = doses[0].totalDoses || 3;

                                // Map doses to columns 1, 2, 3, and 4+ (booster)
                                const findDose = (num: number) => {
                                    const groupDoses = doses.filter(d => d.doseNumber === num);
                                    if (groupDoses.length === 0) return undefined;
                                    return groupDoses.find(d => d.workflowStatus === 'COMPLETED') || groupDoses[0];
                                };

                                const col1 = findDose(1);
                                const col2 = findDose(2);
                                const col3 = findDose(3);
                                const boosters = doses.filter(d => (d.doseNumber || 0) > 3);

                                const renderCellContent = (record?: VaccinationRecord) => {
                                    if (!record) return <span className="text-stone-200 text-xs">—</span>;

                                    const isCompleted = record.workflowStatus === 'COMPLETED';
                                    const isPredicted = record.id?.startsWith('predicted-');
                                    const status = vaccinationService.calculateStatus(record.nextDueDate);

                                    return (
                                        <div className={`relative p-3 rounded-xl border-2 transition-all ${isCompleted
                                            ? 'bg-green-50 border-green-200 shadow-sm'
                                            : status === 'Overdue'
                                                ? 'bg-red-50 border-red-200 animate-pulse'
                                                : 'bg-orange-50 border-orange-200 border-dashed'
                                            }`}>
                                            <div className="flex items-center gap-1.5 mb-1">
                                                {isCompleted ? (
                                                    <CheckCircleIcon className="w-4 h-4 text-green-600" />
                                                ) : status === 'Overdue' ? (
                                                    <ExclamationCircleIcon className="w-4 h-4 text-red-600" />
                                                ) : (
                                                    <ClockIcon className="w-4 h-4 text-orange-600" />
                                                )}
                                                <span className={`text-[10px] font-black uppercase tracking-tighter ${isCompleted ? 'text-green-700' : status === 'Overdue' ? 'text-red-700' : 'text-orange-700'
                                                    }`}>
                                                    {isCompleted ? 'Đã tiêm' : status === 'Overdue' ? 'Quá hạn' : 'Sắp tiêm'}
                                                </span>
                                            </div>
                                            <div className="font-bold text-stone-800 text-xs">
                                                {isCompleted
                                                    ? vaccinationService.formatDate(record.vaccinationDate)
                                                    : vaccinationService.formatDate(record.nextDueDate)}
                                            </div>

                                            {/* Badge for predicted */}
                                            {(isPredicted || !isCompleted) && record.nextDueDate && (
                                                <div className="absolute -top-2 -right-2 bg-white px-2 py-0.5 rounded-full border border-stone-200 text-[8px] font-bold text-stone-500 shadow-sm">
                                                    Dự kiến
                                                </div>
                                            )}
                                        </div>
                                    );
                                };

                                const renderCell = (record?: VaccinationRecord) => {
                                    return <td className="px-6 py-8">{renderCellContent(record)}</td>;
                                };

                                return (
                                    <tr key={key} className="hover:bg-stone-50/50 transition-colors">
                                        <td className="px-6 py-8">
                                            <div className="font-black text-stone-800 text-base leading-tight">
                                                {vaccineName}
                                            </div>
                                            <div className="text-[10px] font-bold text-stone-400 mt-1 uppercase tracking-widest">
                                                {totalDoses} mũi tổng cộng
                                            </div>
                                        </td>
                                        {renderCell(col1)}
                                        {renderCell(col2)}
                                        {renderCell(col3)}
                                        <td className="px-6 py-8">
                                            {boosters.length > 0 ? (
                                                <div className="space-y-4">
                                                    {boosters.map(b => (
                                                        <div key={b.id}>
                                                            {renderCellContent(b)}
                                                        </div>
                                                    ))}
                                                </div>
                                            ) : (
                                                <span className="text-stone-200 text-xs">—</span>
                                            )}
                                        </td>
                                    </tr>
                                );
                            })}
                    </tbody>
                </table>
            </div>
        </div>
    );
};
