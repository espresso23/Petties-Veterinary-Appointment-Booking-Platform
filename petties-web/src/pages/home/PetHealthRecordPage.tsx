import { useEffect, useState } from 'react'
import { useParams, Link, useSearchParams } from 'react-router-dom'
import { vaccinationService, type VaccinationRecord } from '../../services/vaccinationService'
import { emrService, type EmrRecord } from '../../services/emrService'
import { petService, type Pet } from '../../services/api/petService'
import { ArrowLeftIcon, CheckCircleIcon, ExclamationCircleIcon, ClockIcon, ClipboardDocumentListIcon, ChevronDownIcon, ChevronUpIcon } from '@heroicons/react/24/outline'

export function PetHealthRecordPage() {
    const { petId } = useParams<{ petId: string }>()
    const [searchParams, setSearchParams] = useSearchParams()
    const activeTab = searchParams.get('tab') || 'vaccine'

    const [pet, setPet] = useState<Pet | null>(null)
    const [vaccinations, setVaccinations] = useState<VaccinationRecord[]>([])
    const [upcomingVaccinations, setUpcomingVaccinations] = useState<VaccinationRecord[]>([])
    const [emrs, setEmrs] = useState<EmrRecord[]>([])
    const [expandedEmr, setExpandedEmr] = useState<string | null>(null)
    const [isLoading, setIsLoading] = useState(true)

    useEffect(() => {
        if (!petId) return

        const loadData = async () => {
            try {
                const [petData, vaccineData, upcomingData, emrData] = await Promise.all([
                    petService.getPetById(petId),
                    vaccinationService.getVaccinationsByPet(petId),
                    vaccinationService.getUpcomingVaccinations(petId),
                    emrService.getEmrsByPetId(petId)
                ])
                setPet(petData)
                setVaccinations(vaccineData)
                setUpcomingVaccinations(upcomingData)
                setEmrs(emrData)
            } catch (error) {
                console.error("Failed to load health record", error)
            } finally {
                setIsLoading(false)
            }
        }

        loadData()
    }, [petId])

    if (isLoading) return <div className="p-8 text-center text-stone-500">Đang tải hồ sơ...</div>
    if (!pet) return <div className="p-8 text-center text-red-500">Không tìm thấy thú cưng</div>

    const today = new Date().toISOString().split('T')[0]

    return (
        <section className="page max-w-3xl mx-auto py-8 px-4">
            {/* Header */}
            <div className="mb-6 flex items-center gap-4">
                <Link to="/home" className="p-2 hover:bg-stone-100 rounded-full transition-colors text-stone-500">
                    <ArrowLeftIcon className="w-6 h-6" />
                </Link>
                <div>
                    <h1 className="text-2xl font-bold text-stone-800">Sổ Sức Khỏe</h1>
                    <p className="text-stone-500 text-sm">Của bé {pet.name}</p>
                </div>
            </div>

            {/* Pet Summary Card */}
            <div className="bg-white border border-stone-200 rounded-xl p-6 mb-8 flex gap-6 items-center shadow-sm">
                <div className="w-16 h-16 bg-blue-50 rounded-full flex items-center justify-center text-3xl overflow-hidden border border-stone-100">
                    {pet.imageUrl ? (
                        <img src={pet.imageUrl} alt={pet.name} className="w-full h-full object-cover" />
                    ) : (
                        pet.species === 'CAT' ? '🐱' : '🐶'
                    )}
                </div>
                <div>
                    <div className="font-bold text-lg">{pet.name}</div>
                    <div className="text-stone-500 text-sm">
                        {pet.breed} • {pet.gender === 'MALE' ? 'Đực' : 'Cái'} • {pet.weight || '?'} kg
                    </div>
                </div>
            </div>

            {/* Tabs */}
            <div className="flex border-b border-stone-200 mb-6 font-bold">
                <button
                    onClick={() => setSearchParams({ tab: 'vaccine' })}
                    className={`px-6 py-3 border-b-4 transition-all ${activeTab === 'vaccine' ? 'border-blue-600 text-blue-600' : 'border-transparent text-stone-400 hover:text-stone-600'}`}
                >
                    💉 Tiêm chủng
                </button>
                <button
                    onClick={() => setSearchParams({ tab: 'emr' })}
                    className={`px-6 py-3 border-b-4 transition-all ${activeTab === 'emr' ? 'border-purple-600 text-purple-600' : 'border-transparent text-stone-400 hover:text-stone-600'}`}
                >
                    📋 Bệnh án
                </button>
            </div>

            {/* Content Rendering */}
            {activeTab === 'vaccine' ? (
                <VaccinationList history={vaccinations} upcoming={upcomingVaccinations} today={today} />
            ) : (
                <EmrList history={emrs} expandedId={expandedEmr} onToggle={(id) => setExpandedEmr(expandedEmr === id ? null : id)} />
            )}
        </section>
    )
}

function VaccinationList({ history, upcoming, today }: { history: VaccinationRecord[], upcoming: VaccinationRecord[], today: string }) {
    if (history.length === 0 && upcoming.length === 0) {
        return (
            <div className="text-center py-12 bg-stone-50 rounded-xl border border-dashed text-stone-500">
                Chưa có ghi nhận tiêm phòng nào.
            </div>
        )
    }

    return (
        <div className="space-y-8">
            {/* Upcoming Suggestions Section */}
            {upcoming.length > 0 && (
                <div className="space-y-3">
                    <h3 className="text-xs font-black text-orange-600 uppercase tracking-[0.2em] px-1 flex items-center gap-2">
                        <ClockIcon className="w-4 h-4" />
                        Mũi tiêm nên có tiếp theo
                    </h3>
                    <div className="grid gap-3">
                        {upcoming.map((rec, idx) => (
                            <div key={`up-${idx}`} className="bg-orange-50/50 border border-orange-100 rounded-xl p-4 flex justify-between items-center group">
                                <div>
                                    <div className="font-bold text-stone-800 text-sm">{rec.vaccineName}</div>
                                    <div className="text-[11px] font-bold text-orange-600 mt-0.5">
                                        {rec.doseNumber === 4 ? 'Nhắc lại hàng năm' : `Mũi ${rec.doseNumber}`} • {vaccinationService.formatDate(rec.nextDueDate)}
                                    </div>
                                </div>
                                <div className="text-[10px] bg-white text-orange-700 px-2 py-1 rounded-lg border border-orange-200 font-black uppercase tracking-tighter">
                                    Gợi ý
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            )}

            {/* History Section */}
            <div className="space-y-3">
                {history.length > 0 && (
                    <h3 className="text-xs font-black text-stone-400 uppercase tracking-[0.2em] px-1">
                        Lịch sử tiêm chủng
                    </h3>
                )}
                <div className="space-y-4">
                    {history.map(record => {
                        const isUpcoming = record.nextDueDate && record.nextDueDate >= today
                        const isOverdue = record.nextDueDate && record.nextDueDate < today

                        return (
                            <div key={record.id} className="bg-white border border-stone-200 rounded-xl p-5 shadow-sm">
                                <div className="flex justify-between items-start mb-2">
                                    <h3 className="font-bold text-stone-900 text-lg">{record.vaccineName}</h3>
                                    <span className="text-xs font-mono text-stone-400 bg-stone-50 px-2 py-1 rounded">
                                        {vaccinationService.formatDate(record.vaccinationDate)}
                                    </span>
                                </div>

                                <div className="grid grid-cols-2 gap-2 text-sm text-stone-600 mb-4">
                                    <div className="flex items-center gap-1.5 line-clamp-1">
                                        <div className="w-1.5 h-1.5 rounded-full bg-blue-300"></div>
                                        <span className="font-medium">BS: {record.staffName}</span>
                                    </div>
                                    <div className="flex items-center gap-1.5 line-clamp-1">
                                        <div className="w-1.5 h-1.5 rounded-full bg-stone-300"></div>
                                        {record.clinicName}
                                    </div>
                                </div>

                                {record.nextDueDate && (
                                    <div className={`mt-3 pt-3 border-t border-stone-100 flex items-center justify-between text-sm ${isUpcoming ? 'text-blue-700' : isOverdue ? 'text-red-600' : 'text-stone-500'
                                        }`}>
                                        <span className="font-medium flex items-center gap-1.5">
                                            {isUpcoming ? <ClockIcon className="w-4 h-4" /> :
                                                isOverdue ? <ExclamationCircleIcon className="w-4 h-4" /> :
                                                    <CheckCircleIcon className="w-4 h-4" />}
                                            Tái chủng: {vaccinationService.formatDate(record.nextDueDate)}
                                        </span>
                                        {isUpcoming && <span className="bg-blue-100 px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider">Sắp tới</span>}
                                        {isOverdue && <span className="bg-red-100 px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider">Quá hạn</span>}
                                    </div>
                                )}
                            </div>
                        )
                    })}
                </div>
            </div>
        </div>
    )
}

function EmrList({ history, expandedId, onToggle }: { history: EmrRecord[], expandedId: string | null, onToggle: (id: string) => void }) {
    if (history.length === 0) {
        return (
            <div className="text-center py-12 bg-stone-50 rounded-xl border border-dashed text-stone-500">
                Chưa có hồ sơ bệnh án nào.
            </div>
        )
    }

    return (
        <div className="space-y-4">
            {history.map(record => (
                <div key={record.id} className={`bg-white border rounded-xl shadow-sm transition-all overflow-hidden ${expandedId === record.id ? 'border-purple-300 ring-1 ring-purple-100' : 'border-stone-200'}`}>
                    {/* Summary Row */}
                    <div
                        className="p-5 cursor-pointer hover:bg-stone-50 flex justify-between items-center"
                        onClick={() => onToggle(record.id)}
                    >
                        <div className="flex-1">
                            <div className="flex items-center gap-3 mb-1">
                                <span className="bg-purple-100 text-purple-700 px-2.5 py-1 rounded-lg text-xs font-black uppercase">
                                    {record.examinationDate}
                                </span>
                                <span className="text-stone-400 text-xs font-medium">#{record.bookingCode || 'N/A'}</span>
                            </div>
                            <h3 className="font-bold text-stone-900 line-clamp-1">{record.assessment || 'Khám tổng quát'}</h3>
                            <div className="text-sm text-stone-500 mt-1">Bác sĩ: <span className="font-bold">{record.staffName}</span></div>
                        </div>
                        <div className="text-stone-400">
                            {expandedId === record.id ? <ChevronUpIcon className="w-5 h-5" /> : <ChevronDownIcon className="w-5 h-5" />}
                        </div>
                    </div>

                    {/* Detail Area */}
                    {expandedId === record.id && (
                        <div className="p-5 pt-0 bg-stone-50/50 border-t border-stone-100">
                            <div className="grid grid-cols-2 gap-4 py-4 mb-4 border-b border-stone-100">
                                <div className="text-sm">
                                    <div className="text-stone-400 font-bold uppercase text-[10px] mb-1">Cân nặng</div>
                                    <div className="font-bold text-stone-800">{record.weightKg || '--'} kg</div>
                                </div>
                                <div className="text-sm">
                                    <div className="text-stone-400 font-bold uppercase text-[10px] mb-1">Thân nhiệt</div>
                                    <div className="font-bold text-stone-800">{record.temperatureC || '--'} °C</div>
                                </div>
                            </div>

                            <div className="space-y-4">
                                <div>
                                    <h4 className="text-xs font-black text-stone-400 uppercase mb-2">Chẩn đoán & Kết luận</h4>
                                    <p className="text-sm text-stone-700 whitespace-pre-wrap">{record.assessment}</p>
                                </div>

                                {record.plan && (
                                    <div>
                                        <h4 className="text-xs font-black text-stone-400 uppercase mb-2">Hướng điều trị</h4>
                                        <p className="text-sm text-stone-700 whitespace-pre-wrap">{record.plan}</p>
                                    </div>
                                )}

                                {record.prescriptions && record.prescriptions.length > 0 && (
                                    <div className="bg-white border border-stone-200 rounded-xl p-4">
                                        <h4 className="text-xs font-black text-purple-600 uppercase mb-3 flex items-center gap-2">
                                            <ClipboardDocumentListIcon className="w-4 h-4" />
                                            Đơn thuốc
                                        </h4>
                                        <ul className="space-y-3">
                                            {record.prescriptions.map((p, idx) => (
                                                <li key={idx} className="text-sm pb-2 border-b border-stone-50 last:border-0">
                                                    <div className="font-bold text-stone-900">{p.medicineName} <span className="text-stone-400 font-normal">({p.dosage})</span></div>
                                                    <div className="text-stone-500 text-xs mt-0.5">{p.frequency} • {p.durationDays} ngày</div>
                                                    {p.instructions && <div className="text-stone-400 text-[11px] italic mt-1">{p.instructions}</div>}
                                                </li>
                                            ))}
                                        </ul>
                                    </div>
                                )}

                                {record.notes && (
                                    <div className="bg-amber-50 rounded-lg p-3 text-sm text-amber-800 border border-amber-100">
                                        <span className="font-bold">Ghi chú:</span> {record.notes}
                                    </div>
                                )}
                            </div>
                        </div>
                    )}
                </div>
            ))}
        </div>
    )
}

export default PetHealthRecordPage
