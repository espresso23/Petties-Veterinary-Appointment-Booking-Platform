import { useState, useEffect, useCallback, useRef } from 'react'
import { sosWebSocket, type SosAlertMessage } from '../../services/websocket/sosWebSocket'
import { confirmSosRequest, declineSosRequest } from '../../services/bookingService'
import * as bookingService from '../../services/bookingService'
import { useToast } from '../Toast'

interface SosAlertModalProps {
    clinicId: string
}

/**
 * SOS Alert Modal for Clinic Managers
 * Displays incoming SOS requests with accept/decline options
 */
export default function SosAlertModal({ clinicId }: SosAlertModalProps) {
    const [pendingAlerts, setPendingAlerts] = useState<SosAlertMessage[]>([])
    const [currentAlert, setCurrentAlert] = useState<SosAlertMessage | null>(null)
    const [isLoading, setIsLoading] = useState(false)
    const [countdown, setCountdown] = useState(60)
    const countdownRef = useRef<ReturnType<typeof setInterval> | null>(null)
    const audioRef = useRef<HTMLAudioElement | null>(null)
    const { showToast } = useToast()

    // Connect to WebSocket on mount
    useEffect(() => {
        if (!clinicId) return

        sosWebSocket.connect(clinicId).catch(console.error)

        const removeHandler = sosWebSocket.addAlertHandler((alert: SosAlertMessage) => {
            // Backend sends 'event: CLINIC_NOTIFIED' when notifying clinic
            if (alert.event === 'CLINIC_NOTIFIED' || alert.status === 'PENDING_CLINIC_CONFIRM') {
                console.log('[SOS Modal] Showing alert for booking:', alert.bookingId)
                setPendingAlerts(prev => [...prev, alert])
                playAlertSound()
            }
        })

        return () => {
            removeHandler()
            sosWebSocket.disconnect()
        }
    }, [clinicId])

    // Show next alert when current is resolved
    useEffect(() => {
        if (!currentAlert && pendingAlerts.length > 0) {
            setCurrentAlert(pendingAlerts[0])
            setPendingAlerts(prev => prev.slice(1))
            setCountdown(60)
        }
    }, [currentAlert, pendingAlerts])

    // Countdown timer
    useEffect(() => {
        if (!currentAlert) return

        countdownRef.current = setInterval(() => {
            setCountdown(prev => {
                if (prev <= 1) {
                    handleDecline('Hết thời gian phản hồi')
                    return 0
                }
                return prev - 1
            })
        }, 1000)

        return () => {
            if (countdownRef.current) {
                clearInterval(countdownRef.current)
            }
        }
    }, [currentAlert])

    const [availableStaff, setAvailableStaff] = useState<any[]>([])
    const [selectedStaffId, setSelectedStaffId] = useState<string>('')

    // Fetch staff list when alert appears
    useEffect(() => {
        if (currentAlert && clinicId) {
            bookingService.getAvailableStaffForConfirm(currentAlert.bookingId)
                .then(staff => {
                    setAvailableStaff(staff)
                    // Auto-select suggested staff if any
                    const suggested = staff.find(s => s.isSuggested)
                    if (suggested) {
                        setSelectedStaffId(suggested.staffId)
                    } else if (staff.length > 0) {
                        setSelectedStaffId(staff[0].staffId)
                    }
                })
                .catch(err => console.error('Error fetching staff for SOS:', err))
        }
    }, [currentAlert, clinicId])

    const playAlertSound = useCallback(() => {
        if (!audioRef.current) {
            audioRef.current = new Audio('/sounds/sos-alert.mp3')
        }
        audioRef.current.currentTime = 0
        audioRef.current.play().catch(() => {
            console.log('Audio autoplay blocked')
        })
    }, [])

    const handleAccept = async () => {
        if (!currentAlert) return
        if (!selectedStaffId) {
            showToast('error', 'Vui lòng chọn nhân viên xử lý cấp cứu')
            return
        }
        setIsLoading(true)

        try {
            await confirmSosRequest(currentAlert.bookingId, selectedStaffId)
            sosWebSocket.confirmSos(currentAlert.bookingId)

            showToast('success', 'Đã xác nhận yêu cầu SOS! Bạn sẽ được chuyển đến chi tiết booking.')
            setCurrentAlert(null)
            setCountdown(60)
            setSelectedStaffId('')
        } catch (error) {
            console.error('Error confirming SOS:', error)
            showToast('error', 'Có lỗi xảy ra khi xác nhận. Vui lòng thử lại.')
        } finally {
            setIsLoading(false)
        }
    }

    const handleDecline = async (reason?: string) => {
        if (!currentAlert) return
        setIsLoading(true)

        try {
            await declineSosRequest(currentAlert.bookingId, reason)
            sosWebSocket.declineSos(currentAlert.bookingId, reason)

            showToast('warning', 'Đã từ chối yêu cầu SOS')
            setCurrentAlert(null)
            setCountdown(60)
            setSelectedStaffId('')
        } catch (error) {
            console.error('Error declining SOS:', error)
            showToast('error', 'Có lỗi xảy ra. Vui lòng thử lại.')
        } finally {
            setIsLoading(false)
        }
    }

    if (!currentAlert) return null

    return (
        <>
            {/* Overlay */}
            <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[100]" />

            {/* Modal */}
            <div className="fixed inset-0 flex items-center justify-center z-[101] p-4">
                <div className="bg-white dark:bg-stone-800 rounded-2xl shadow-2xl max-w-lg w-full animate-bounce-in overflow-hidden">
                    {/* Header with countdown */}
                    <div className="bg-gradient-to-r from-red-500 to-red-600 text-white p-4">
                        <div className="flex items-center justify-between">
                            <div className="flex items-center gap-3">
                                <div className="p-2 bg-white/20 rounded-full animate-pulse">
                                    <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                                    </svg>
                                </div>
                                <div>
                                    <h2 className="text-xl font-bold">🚨 YÊU CẦU CẤP CỨU SOS</h2>
                                    <p className="text-sm opacity-90">Cần phản hồi trong {countdown}s</p>
                                </div>
                            </div>
                            <div className="flex items-center gap-2 text-2xl font-mono">
                                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                                </svg>
                                {countdown}s
                            </div>
                        </div>

                        {/* Progress bar */}
                        <div className="mt-3 h-1.5 bg-white/20 rounded-full overflow-hidden">
                            <div
                                className="h-full bg-white transition-all duration-1000 ease-linear"
                                style={{ width: `${(countdown / 60) * 100}%` }}
                            />
                        </div>
                    </div>

                    {/* Content */}
                    <div className="p-6">
                        {/* Pet & Owner Info */}
                        <div className="space-y-4">
                            <div className="flex items-center gap-4 p-4 bg-stone-50 dark:bg-stone-700 rounded-xl border border-stone-200 dark:border-stone-600">
                                <div className="p-3 bg-red-100 dark:bg-red-900 rounded-full">
                                    <span className="text-2xl">🐕</span>
                                </div>
                                <div className="flex-1">
                                    <h3 className="font-semibold text-lg text-stone-800 dark:text-stone-100">
                                        {currentAlert.petName || 'Thú cưng'}
                                    </h3>
                                    <p className="text-stone-600 dark:text-stone-300">
                                        Chủ: {currentAlert.petOwnerName || 'Khách hàng'}
                                    </p>
                                </div>
                            </div>

                            {/* Symptoms */}
                            {currentAlert.symptoms && (
                                <div className="p-4 bg-yellow-50 dark:bg-yellow-900/30 rounded-xl border border-yellow-200 dark:border-yellow-700">
                                    <p className="text-sm font-medium text-yellow-800 dark:text-yellow-200 mb-1">
                                        Triệu chứng:
                                    </p>
                                    <p className="text-stone-700 dark:text-stone-200">
                                        {currentAlert.symptoms}
                                    </p>
                                </div>
                            )}

                            {/* Staff Selection Dropdown */}
                            <div className="space-y-2">
                                <label className="text-sm font-bold text-stone-700 dark:text-stone-300 flex items-center gap-2">
                                    <svg className="w-4 h-4 text-primary" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                                    </svg>
                                    CHỌN NHÂN VIÊN XỬ LÝ:
                                </label>
                                <select
                                    value={selectedStaffId}
                                    onChange={(e) => setSelectedStaffId(e.target.value)}
                                    className="w-full p-3 bg-white dark:bg-stone-900 border-2 border-stone-900 rounded-xl shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] focus:ring-0 focus:translate-x-1 focus:translate-y-1 focus:shadow-none transition-all outline-none text-stone-900 dark:text-stone-100"
                                >
                                    <option value="" disabled>Chọn bác sĩ/nhân viên...</option>
                                    {availableStaff.map(staff => (
                                        <option key={staff.staffId} value={staff.staffId}>
                                            {staff.fullName} {staff.isSuggested ? '(Gợi ý)' : ''} — {staff.specialtyLabel}
                                        </option>
                                    ))}
                                    {availableStaff.length === 0 && (
                                        <option disabled>Không tìm thấy nhân viên sẵn sàng</option>
                                    )}
                                </select>
                            </div>

                            {/* Info Rows */}
                            <div className="grid grid-cols-2 gap-3 text-sm">
                                {currentAlert.distance && (
                                    <div className="flex items-center gap-2 p-2 bg-stone-50 dark:bg-stone-700 rounded-lg">
                                        <svg className="w-4 h-4 text-red-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                                        </svg>
                                        <span><b>{currentAlert.distance.toFixed(1)} km</b></span>
                                    </div>
                                )}
                                {currentAlert.petOwnerPhone && (
                                    <div className="flex items-center gap-2 p-2 bg-stone-50 dark:bg-stone-700 rounded-lg">
                                        <svg className="w-4 h-4 text-green-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" />
                                        </svg>
                                        <a href={`tel:${currentAlert.petOwnerPhone}`} className="hover:underline text-blue-600 truncate">
                                            {currentAlert.petOwnerPhone}
                                        </a>
                                    </div>
                                )}
                            </div>
                        </div>

                        {/* Actions */}
                        <div className="flex gap-4 mt-8">
                            <button
                                onClick={() => handleDecline('Phòng khám bận')}
                                disabled={isLoading}
                                className="flex-1 px-4 py-4 bg-stone-100 hover:bg-stone-200 border-2 border-stone-900 rounded-xl font-bold shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] hover:translate-x-0.5 hover:translate-y-0.5 hover:shadow-none transition-all disabled:opacity-50 text-stone-900"
                            >
                                TỪ CHỐI
                            </button>

                            <button
                                onClick={handleAccept}
                                disabled={isLoading || !selectedStaffId}
                                className="flex-2 px-8 py-4 bg-green-500 hover:bg-green-600 text-white border-2 border-stone-900 rounded-xl font-black shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] hover:translate-x-0.5 hover:translate-y-0.5 hover:shadow-none transition-all disabled:opacity-50 disabled:translate-none disabled:shadow-none flex items-center justify-center gap-2"
                            >
                                {isLoading ? (
                                    <div className="w-6 h-6 border-4 border-white border-t-transparent rounded-full animate-spin" />
                                ) : (
                                    'XÁC NHẬN CẤP CỨU'
                                )}
                            </button>
                        </div>
                    </div>

                    {/* Footer */}
                    <div className="px-6 py-3 bg-stone-50 dark:bg-stone-700/50 rounded-b-2xl text-center text-sm text-stone-500 dark:text-stone-400">
                        Nếu không phản hồi, yêu cầu sẽ tự động chuyển sang phòng khám khác
                    </div>
                </div>
            </div>

            {/* CSS Animation */}
            <style>{`
                @keyframes bounce-in {
                  0% { transform: scale(0.9); opacity: 0; }
                  60% { transform: scale(1.02); }
                  100% { transform: scale(1); opacity: 1; }
                }
                .animate-bounce-in {
                  animation: bounce-in 0.3s ease-out;
                }
            `}</style>
        </>
    )
}
