import type { VaccinationRecord } from '../../../../services/vaccinationService'
import { CheckCircleIcon, ClockIcon } from '@heroicons/react/24/solid'

interface VaccinationRoadmapProps {
    records: VaccinationRecord[]
    upcomingRecords: VaccinationRecord[]
}

export const VaccinationRoadmap = ({ records, upcomingRecords }: VaccinationRoadmapProps) => {
    // 1. Group records by Vaccine Name
    const roadmapData: Record<string, { [key: number]: VaccinationRecord & { roadmapStatus: 'COMPLETED' | 'UPCOMING' } }> = {}

    // Helper to normalize vaccine name to group variations (optional, currently strict grouping)
    const getGroupKey = (name: string) => name.trim()

    // Process Completed Records
    records.forEach(rec => {
        const key = getGroupKey(rec.vaccineName)
        if (!roadmapData[key]) roadmapData[key] = {}

        // Use doseNumber or default to 1
        const dose = rec.doseNumber || 1
        roadmapData[key][dose] = { ...rec, roadmapStatus: 'COMPLETED' }
    })

    // Process Upcoming Records
    upcomingRecords.forEach(rec => {
        const key = getGroupKey(rec.vaccineName)
        // Only add upcoming doses if vaccine already exists in roadmap (i.e., has at least one completed dose)
        if (roadmapData[key]) {
            const dose = rec.doseNumber || 1
            // Only add if not already completed (priority to completed)
            if (!roadmapData[key][dose]) {
                roadmapData[key][dose] = { ...rec, roadmapStatus: 'UPCOMING' }
            }
        }
    })

    // Filter to show ONLY vaccines that have at least one COMPLETED dose
    // "cái nào chưa tiêm bao giờ thì kh hiện"
    const vaccineNames = Object.keys(roadmapData).filter(name => {
        return Object.values(roadmapData[name]).some(r => r.roadmapStatus === 'COMPLETED')
    }).sort()

    if (vaccineNames.length === 0) {
        return (
            <div className="text-center text-stone-500 py-12 bg-stone-50 rounded-2xl border border-stone-200 border-dashed">
                <p>Chưa có dữ liệu lộ trình tiêm chủng</p>
            </div>
        )
    }

    return (
        <div className="bg-white rounded-2xl shadow-sm border border-stone-200 overflow-hidden">
            <div className="px-6 py-4 border-b border-stone-200 bg-stone-50/50">
                <h3 className="text-sm font-bold text-stone-700 uppercase tracking-widest">LỘ TRÌNH TIÊM CHỦNG (ROADMAP)</h3>
            </div>

            <div className="overflow-x-auto">
                <table className="w-full min-w-[800px]">
                    <thead>
                        <tr className="border-b border-stone-100">
                            <th className="px-6 py-4 text-left text-[10px] font-bold text-stone-400 uppercase tracking-widest w-1/4">Loại Vaccine</th>
                            <th className="px-4 py-4 text-center text-[10px] font-bold text-stone-400 uppercase tracking-widest w-[16%]">Mũi 1</th>
                            <th className="px-4 py-4 text-center text-[10px] font-bold text-stone-400 uppercase tracking-widest w-[16%]">Mũi 2</th>
                            <th className="px-4 py-4 text-center text-[10px] font-bold text-stone-400 uppercase tracking-widest w-[16%]">Mũi 3</th>
                            <th className="px-4 py-4 text-center text-[10px] font-bold text-stone-400 uppercase tracking-widest w-[20%]">Mũi 4+ / Nhắc lại</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-stone-50">
                        {vaccineNames.map((name) => (
                            <tr key={name} className="hover:bg-stone-50 transition-colors">
                                <td className="px-6 py-8">
                                    <div className="font-bold text-stone-800 text-sm">{name}</div>
                                    <div className="text-[10px] text-stone-400 mt-1 uppercase tracking-wider">
                                        {(() => {
                                            const samples = Object.values(roadmapData[name]);
                                            const total = samples[0]?.totalDoses || samples.length;
                                            return `${total} mũi tổng cộng`;
                                        })()}
                                    </div>
                                </td>

                                {[1, 2, 3, 4].map((doseCol) => {
                                    // For column 4, we might want to show any dose >= 4
                                    // But realistically sticking to logic: 4 is annual/booster usually
                                    const record = doseCol === 4
                                        ? (roadmapData[name][4] || Object.values(roadmapData[name]).find(r => (r.doseNumber || 0) > 4))
                                        : roadmapData[name][doseCol]

                                    return (
                                        <td key={doseCol} className="px-4 py-6 text-center align-middle">
                                            {record ? (
                                                <div className={`
                                                    inline-flex flex-col items-center justify-center px-4 py-2 rounded-xl border text-xs transition-all relative group cursor-default
                                                    ${record.roadmapStatus === 'COMPLETED'
                                                        ? 'bg-green-50 border-green-200 text-green-700 shadow-sm'
                                                        : 'bg-orange-50 border-orange-200 border-dashed text-orange-700'
                                                    }
                                                `}>
                                                    {record.roadmapStatus === 'UPCOMING' && (
                                                        <span className="absolute -top-2.5 right-2 px-1.5 py-0.5 bg-white border border-stone-200 text-[9px] font-bold text-stone-500 rounded shadow-sm">
                                                            Dự kiến
                                                        </span>
                                                    )}

                                                    <div className="flex items-center gap-1.5 font-bold mb-0.5">
                                                        {record.roadmapStatus === 'COMPLETED' ? (
                                                            <CheckCircleIcon className="w-4 h-4" />
                                                        ) : (
                                                            <ClockIcon className="w-4 h-4" />
                                                        )}
                                                        <span>{record.roadmapStatus === 'COMPLETED' ? 'ĐÃ TIÊM' : 'SẮP TIÊM'}</span>
                                                    </div>
                                                    <div className="font-medium opacity-90">
                                                        {record.roadmapStatus === 'COMPLETED' ? record.vaccinationDate : record.nextDueDate}
                                                    </div>

                                                    {/* Tooltip for details */}
                                                    <div className="absolute opacity-0 group-hover:opacity-100 bottom-full mb-2 bg-stone-800 text-white text-[10px] px-2 py-1 rounded whitespace-nowrap pointer-events-none transition-opacity z-10">
                                                        {record.notes || (record.roadmapStatus === 'COMPLETED' ? 'Đã hoàn thành' : 'Theo lịch gợi ý')}
                                                    </div>
                                                </div>
                                            ) : (
                                                <div className="h-1 w-8 bg-stone-100 rounded-full mx-auto" />
                                            )}
                                        </td>
                                    )
                                })}
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
        </div>
    )
}
