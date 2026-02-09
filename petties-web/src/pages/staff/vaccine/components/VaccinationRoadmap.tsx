import type { VaccinationRecord } from '../../../../services/vaccinationService'

interface VaccinationRoadmapProps {
    records: VaccinationRecord[]
    upcomingRecords: VaccinationRecord[]
}

export const VaccinationRoadmap = ({ records, upcomingRecords }: VaccinationRoadmapProps) => {
    if (records.length === 0 && upcomingRecords.length === 0) {
        return (
            <div className="text-center text-stone-500 py-8">
                Chưa có lịch sử tiêm phòng
            </div>
        )
    }

    return (
        <div className="space-y-4">
            {/* Completed Vaccinations */}
            {records.length > 0 && (
                <div>
                    <h4 className="font-bold text-stone-700 mb-2">Đã tiêm</h4>
                    <div className="space-y-2">
                        {records.map((record, index) => (
                            <div key={record.id || index} className="flex justify-between items-center p-3 bg-green-50 rounded-lg border border-green-200">
                                <div>
                                    <span className="font-semibold text-stone-800">{record.vaccineName}</span>
                                    <span className="text-xs text-stone-500 ml-2">{record.vaccinationDate}</span>
                                </div>
                                {record.staffName && (
                                    <span className="text-xs text-stone-600">Dr. {record.staffName.split(' ').pop()}</span>
                                )}
                            </div>
                        ))}
                    </div>
                </div>
            )}

            {/* Upcoming Vaccinations */}
            {upcomingRecords.length > 0 && (
                <div>
                    <h4 className="font-bold text-stone-700 mb-2">Sắp đến hạn</h4>
                    <div className="space-y-2">
                        {upcomingRecords.map((record, index) => (
                            <div key={record.id || index} className="flex justify-between items-center p-3 bg-amber-50 rounded-lg border border-amber-200">
                                <div>
                                    <span className="font-semibold text-stone-800">{record.vaccineName}</span>
                                    <span className="text-xs text-amber-600 ml-2">{record.nextDueDate}</span>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            )}
        </div>
    )
}
