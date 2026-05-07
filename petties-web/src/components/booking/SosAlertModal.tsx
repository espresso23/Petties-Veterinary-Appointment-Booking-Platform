import { useState, useEffect, useCallback, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { sosWebSocket, type SosAlertMessage } from '../../services/websocket/sosWebSocket'
import { confirmSosRequest, declineSosRequest } from '../../services/bookingService'
import * as bookingService from '../../services/bookingService'
import { useToast } from '../Toast'
import { ROUTES } from '../../config/routes'

interface AvailableStaff {
    staffId: string
    fullName: string
    isSuggested?: boolean
}

interface SosAlertModalProps {
    clinicId: string
}

const getAlertPriority = (alert: SosAlertMessage) => alert.remainingSeconds ?? Number.MAX_SAFE_INTEGER

const mergeAlertQueue = (
    existingAlerts: SosAlertMessage[],
    incomingAlerts: SosAlertMessage[],
    currentAlertBookingId?: string | null,
) => {
    const alertsByBookingId = new Map<string, SosAlertMessage>()

    existingAlerts.forEach(alert => {
        if (alert.bookingId !== currentAlertBookingId) {
            alertsByBookingId.set(alert.bookingId, alert)
        }
    })

    incomingAlerts.forEach(alert => {
        if (alert.bookingId === currentAlertBookingId) return

        const previous = alertsByBookingId.get(alert.bookingId)
        alertsByBookingId.set(alert.bookingId, {
            ...previous,
            ...alert,
        })
    })

    return Array.from(alertsByBookingId.values())
        .sort((left, right) => getAlertPriority(left) - getAlertPriority(right))
}

/**
 * SOS Alert Modal for Clinic Managers
 * Displays incoming SOS requests with accept/decline options
 */
export default function SosAlertModal({ clinicId }: SosAlertModalProps) {
    const navigate = useNavigate()
    const [pendingAlerts, setPendingAlerts] = useState<SosAlertMessage[]>([])
    const [currentAlert, setCurrentAlert] = useState<SosAlertMessage | null>(null)
    const [isLoading, setIsLoading] = useState(false)
    const [isLoadingStaff, setIsLoadingStaff] = useState(false)
    const [countdown, setCountdown] = useState(60)
    const initialCountdownRef = useRef(60)
    const countdownRef = useRef<ReturnType<typeof setInterval> | null>(null)
    const currentAlertRef = useRef<SosAlertMessage | null>(null)
    const audioRef = useRef<HTMLAudioElement | null>(null)
    const { showToast } = useToast()

    const [availableStaff, setAvailableStaff] = useState<AvailableStaff[]>([])
    const [selectedStaffId, setSelectedStaffId] = useState<string>('')

    const playAlertSound = useCallback(() => {
        if (!audioRef.current) {
            audioRef.current = new Audio('/sounds/sos-alert.mp3')
        }
        audioRef.current.currentTime = 0
        audioRef.current.play().catch(() => {
            console.log('Audio autoplay blocked')
        })
    }, [])

    const resetAlert = useCallback(() => {
        setCurrentAlert(null)
        currentAlertRef.current = null
        setCountdown(60)
        initialCountdownRef.current = 60
        setAvailableStaff([])
        setSelectedStaffId('')
    }, [])

    const handleDecline = useCallback(async (reason?: string) => {
        if (!currentAlert) return
        setIsLoading(true)

        try {
            await declineSosRequest(currentAlert.bookingId, reason)

            setPendingAlerts(prev => prev.filter(alert => alert.bookingId !== currentAlert.bookingId))
            showToast('warning', 'Đã từ chối yêu cầu SOS')
            resetAlert()
        } catch (err) {
            console.error('Error declining SOS:', err)
            showToast('error', 'Có lỗi xảy ra. Vui lòng thử lại.')
        } finally {
            setIsLoading(false)
        }
    }, [currentAlert, showToast, resetAlert])


    // Show next alert when current is resolved
    useEffect(() => {
        if (!currentAlert && pendingAlerts.length > 0) {
            const nextAlert = pendingAlerts[0]
            setCurrentAlert(nextAlert)
            currentAlertRef.current = nextAlert
            setPendingAlerts(prev => prev.slice(1))
            // Initialize countdown from server if available, otherwise default to 60
            const initial = nextAlert.remainingSeconds || 60
            initialCountdownRef.current = initial
            setCountdown(initial)
        }
    }, [currentAlert, pendingAlerts])

    // Countdown timer — decrement only, no side effects inside setState
    useEffect(() => {
        if (!currentAlert) return

        countdownRef.current = setInterval(() => {
            setCountdown(prev => (prev <= 0 ? 0 : prev - 1))
        }, 1000)

        return () => {
            if (countdownRef.current) {
                clearInterval(countdownRef.current)
            }
        }
    }, [currentAlert])

    // Auto-decline when countdown reaches 0 (#9: moved out of setState)
    useEffect(() => {
        if (countdown === 0 && currentAlert) {
            handleDecline('Hết thời gian phản hồi')
        }
    }, [countdown, currentAlert, handleDecline])

    // Fetch staff list when alert appears (#7: with loading state + retry to avoid race with booking creation)
    useEffect(() => {
        if (!currentAlert || !clinicId) {
            setAvailableStaff([])
            setSelectedStaffId('')
            return
        }

        let cancelled = false
        setIsLoadingStaff(true)
        setAvailableStaff([])
        setSelectedStaffId('')

        const fetchWithRetry = async (attemptsLeft: number): Promise<void> => {
            try {
                const staff = await bookingService.getAvailableStaffForConfirm(currentAlert.bookingId)
                if (cancelled) return
                setAvailableStaff(staff)
                const suggested = staff.find((s: AvailableStaff) => s.isSuggested)
                if (suggested) {
                    setSelectedStaffId(suggested.staffId)
                } else if (staff.length > 0) {
                    setSelectedStaffId(staff[0].staffId)
                }
            } catch (err: any) {
                if (cancelled) return
                const is404 = err?.response?.status === 404
                if (is404 && attemptsLeft > 0) {
                    console.warn(`[SOS] Booking chưa sẵn sàng, retry sau 1.5s (còn ${attemptsLeft} lần)`)
                    await new Promise(res => setTimeout(res, 1500))
                    if (!cancelled) {
                        return fetchWithRetry(attemptsLeft - 1)
                    }
                } else {
                    console.error('Error fetching staff for SOS:', err)
                }
            } finally {
                if (!cancelled) {
                    setIsLoadingStaff(false)
                }
            }
        }

        fetchWithRetry(4)

        return () => {
            cancelled = true
        }
    }, [currentAlert, clinicId])

    const handleAccept = async () => {
        if (!currentAlert) return
        if (!selectedStaffId) {
            showToast('error', 'Vui lòng chọn nhân viên xử lý cấp cứu')
            return
        }
        setIsLoading(true)

        try {
            await confirmSosRequest(currentAlert.bookingId, selectedStaffId)

            setPendingAlerts(prev => prev.filter(alert => alert.bookingId !== currentAlert.bookingId))
            showToast('success', 'Đã xác nhận yêu cầu SOS thành công')
            resetAlert()
            navigate(`${ROUTES.clinicManager.bookings}?bookingId=${currentAlert.bookingId}`)
        } catch (err) {
            console.error('Error confirming SOS:', err)
            showToast('error', 'Có lỗi xảy ra khi xác nhận. Vui lòng thử lại.')
        } finally {
            setIsLoading(false)
        }
    }

    // Handler for websocket messages
    const onAlertReceived = useCallback((alert: SosAlertMessage) => {
        if (alert.event === 'CLINIC_NOTIFIED' || alert.status === 'PENDING_CLINIC_CONFIRM') {
            console.log('[SOS Modal] Showing alert for booking:', alert.bookingId)

            if (currentAlertRef.current?.bookingId === alert.bookingId) {
                const mergedCurrentAlert = {
                    ...currentAlertRef.current,
                    ...alert,
                }

                currentAlertRef.current = mergedCurrentAlert
                setCurrentAlert(mergedCurrentAlert)

                if (typeof alert.remainingSeconds === 'number' && alert.remainingSeconds > 0) {
                    const remainingSeconds = alert.remainingSeconds
                    initialCountdownRef.current = remainingSeconds
                    setCountdown(prev => Math.min(prev, remainingSeconds))
                }

                return
            }

            setPendingAlerts(prev => mergeAlertQueue(prev, [alert], currentAlertRef.current?.bookingId))
            playAlertSound()
        } else if (alert.event === 'CONFIRMED' || alert.event === 'CANCELLED' || alert.event === 'WAITING_NEXT' || alert.event === 'NO_CLINIC') {
            // Check against ref to avoid stale closure
            if (currentAlertRef.current?.bookingId === alert.bookingId) {
                console.log('[SOS Modal] Closing current alert as it is no longer valid:', alert.bookingId)

                let message = 'Yêu cầu SOS đã kết thúc'
                if (alert.event === 'CONFIRMED') {
                    message = 'Yêu cầu đã được xác nhận tiếp nhận'
                } else if (alert.event === 'CANCELLED') {
                    message = 'Yêu cầu đã bị khách hàng hủy'
                } else if (alert.event === 'WAITING_NEXT') {
                    message = 'Đã hết thời gian phản hồi'
                } else if (alert.event === 'NO_CLINIC') {
                    message = 'Yêu cầu đã bị hủy'
                }

                showToast('info', message)
                resetAlert()
            }
            // Also remove from pending alerts
            setPendingAlerts(prev => prev.filter(p => p.bookingId !== alert.bookingId))
        }
    }, [playAlertSound, showToast, resetAlert])

    // Sync active alerts on mount + periodic retry (#8)
    useEffect(() => {
        if (!clinicId) return

        const syncAlerts = () => {
            bookingService.getActiveSosAlerts()
                .then(alerts => {
                    const currentBookingId = currentAlertRef.current?.bookingId
                    const syncedCurrentAlert = currentBookingId
                        ? alerts.find(alert => alert.bookingId === currentBookingId)
                        : undefined

                    if (syncedCurrentAlert && currentAlertRef.current) {
                        const mergedCurrentAlert = {
                            ...currentAlertRef.current,
                            ...syncedCurrentAlert,
                        }

                        currentAlertRef.current = mergedCurrentAlert
                        setCurrentAlert(mergedCurrentAlert)

                        if (typeof syncedCurrentAlert.remainingSeconds === 'number' && syncedCurrentAlert.remainingSeconds > 0) {
                            const remainingSeconds = syncedCurrentAlert.remainingSeconds
                            initialCountdownRef.current = remainingSeconds
                            setCountdown(prev => Math.min(prev, remainingSeconds))
                        }
                    }

                    if (alerts.length > 0) {
                        console.log('[SOS Modal] Synced active alerts:', alerts.length)
                        setPendingAlerts(prev => mergeAlertQueue(prev, alerts, currentBookingId))
                    }
                })
                .catch(err => console.error('Error syncing SOS alerts:', err))
        }

        syncAlerts()
        // Retry every 30s to catch missed alerts
        const retryInterval = setInterval(syncAlerts, 30000)
        return () => clearInterval(retryInterval)
    }, [clinicId])

    // Connect to WebSocket on mount
    useEffect(() => {
        if (!clinicId) return

        sosWebSocket.connect(clinicId).catch(console.error)

        const removeHandler = sosWebSocket.addAlertHandler(onAlertReceived)

        return () => {
            removeHandler()
            sosWebSocket.disconnect()
        }
    }, [clinicId, onAlertReceived])

    if (!currentAlert) return null

    return (
        <>
            {/* Overlay */}
            <div className="fixed inset-0 bg-white/80 backdrop-blur-sm z-[100]" />

            {/* Modal */}
            <div className="fixed inset-0 flex items-center justify-center z-[101] p-4">
                <div className="bg-white border-2 border-stone-900 rounded-xl shadow-[6px_6px_0_#1c1917] max-w-lg w-full animate-bounce-in overflow-hidden">
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
                                    <h2 className="text-xl font-bold">YÊU CẦU CẤP CỨU SOS</h2>
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

                        {/* Progress bar (#2: use dynamic initialCountdown) */}
                        <progress
                            className="sos-alert-progress mt-3"
                            value={countdown}
                            max={initialCountdownRef.current}
                            aria-label="Tiến độ thời gian phản hồi SOS"
                        />
                    </div>

                    {/* Content */}
                    <div className="p-6">
                        {/* Pet & Owner Info */}
                        <div className="space-y-4">
                            <div className="flex items-center gap-4 p-4 bg-stone-50 rounded-xl border-2 border-stone-900">
                                <div className="p-3 bg-red-100 rounded-full border-2 border-stone-900">
                                    {currentAlert.petAvatarUrl ? (
                                        <img
                                            src={currentAlert.petAvatarUrl}
                                            alt={currentAlert.petName || 'Thú cưng'}
                                            className="w-10 h-10 rounded-full border-2 border-stone-900 object-cover"
                                        />
                                    ) : (
                                        <svg
                                            className="w-6 h-6 text-red-700"
                                            viewBox="0 0 24 24"
                                            fill="none"
                                            stroke="currentColor"
                                            strokeWidth={2}
                                            strokeLinecap="round"
                                            strokeLinejoin="round"
                                        >
                                            <path d="M5 22v-2a4 4 0 0 1 4-4h2" />
                                            <path d="M19 22v-2a4 4 0 0 0-4-4h-1" />
                                            <circle cx="9" cy="7" r="3" />
                                            <circle cx="17" cy="7" r="3" />
                                        </svg>
                                    )}
                                </div>
                                <div className="flex-1">
                                    <h3 className="font-semibold text-lg text-stone-800">
                                        {currentAlert.petName || 'Thú cưng'}
                                    </h3>
                                    <p className="text-stone-600 text-sm">
                                        {[currentAlert.petSpecies === 'DOG' ? 'Chó' : currentAlert.petSpecies === 'CAT' ? 'Mèo' : currentAlert.petSpecies, currentAlert.petBreed, currentAlert.petWeight ? `${currentAlert.petWeight} kg` : null].filter(Boolean).join(' • ') || ''}
                                    </p>
                                    <p className="text-stone-500 text-sm">
                                        Chủ: {currentAlert.petOwnerName || 'Khách hàng'}
                                        {currentAlert.petOwnerPhone && (
                                            <> — <a
                                                href={`tel:${currentAlert.petOwnerPhone}`}
                                                className="text-blue-600 hover:underline inline-flex items-center gap-1"
                                            >
                                                <svg
                                                    className="w-4 h-4"
                                                    viewBox="0 0 24 24"
                                                    fill="none"
                                                    stroke="currentColor"
                                                    strokeWidth={2}
                                                    strokeLinecap="round"
                                                    strokeLinejoin="round"
                                                >
                                                    <path d="M22 16.92V21a1 1 0 0 1-1.09 1A19.79 19.79 0 0 1 3 5.09 1 1 0 0 1 4 4h4.09a1 1 0 0 1 1 .75l1 3.73a1 1 0 0 1-.27.95L8.91 11.91a16 16 0 0 0 5.18 5.18l2.48-1.89a1 1 0 0 1 .95-.27l3.73 1a1 1 0 0 1 .75 1Z" />
                                                </svg>
                                                <span>{currentAlert.petOwnerPhone}</span>
                                            </a></>
                                        )}
                                    </p>
                                    {/* #6: Use distance with distanceKm fallback */}
                                    {(currentAlert.distance ?? currentAlert.distanceKm) && (
                                        <p className="text-stone-500 text-sm flex items-center gap-1">
                                            <svg
                                                className="w-4 h-4"
                                                viewBox="0 0 24 24"
                                                fill="none"
                                                stroke="currentColor"
                                                strokeWidth={2}
                                                strokeLinecap="round"
                                                strokeLinejoin="round"
                                            >
                                                <path d="M12 21s-6-5.373-6-10a6 6 0 1 1 12 0c0 4.627-6 10-6 10z" />
                                                <circle cx="12" cy="11" r="2" />
                                            </svg>
                                            <span>Cách {(currentAlert.distance ?? currentAlert.distanceKm)!.toFixed(1)} km</span>
                                        </p>
                                    )}
                                </div>
                            </div>

                            {/* Symptoms */}
                            {currentAlert.symptoms && (
                                <div className="p-4 bg-yellow-50 rounded-xl border-2 border-stone-900">
                                    <p className="text-sm font-medium text-stone-900 mb-1 flex items-center gap-1">
                                        <svg
                                            className="w-4 h-4 text-yellow-700"
                                            viewBox="0 0 24 24"
                                            fill="none"
                                            stroke="currentColor"
                                            strokeWidth={2}
                                            strokeLinecap="round"
                                            strokeLinejoin="round"
                                        >
                                            <path d="M10.29 3.86 1.82 18a1 1 0 0 0 .86 1.5h18.64a1 1 0 0 0 .86-1.5L13.71 3.86a1 1 0 0 0-1.72 0z" />
                                            <line x1="12" y1="9" x2="12" y2="13" />
                                            <line x1="12" y1="17" x2="12.01" y2="17" />
                                        </svg>
                                        <span>Triệu chứng:</span>
                                    </p>
                                    <p className="text-stone-700">
                                        {currentAlert.symptoms}
                                    </p>
                                </div>
                            )}

                            {/* Address */}
                            {currentAlert.homeAddress && (
                                <div className="p-4 bg-blue-50 rounded-xl border-2 border-stone-900">
                                    <p className="text-sm font-medium text-stone-900 mb-1 flex items-center gap-1">
                                        <svg
                                            className="w-4 h-4 text-blue-700"
                                            viewBox="0 0 24 24"
                                            fill="none"
                                            stroke="currentColor"
                                            strokeWidth={2}
                                            strokeLinecap="round"
                                            strokeLinejoin="round"
                                        >
                                            <path d="M12 21s-6-5.373-6-10a6 6 0 1 1 12 0c0 4.627-6 10-6 10z" />
                                            <circle cx="12" cy="11" r="2" />
                                        </svg>
                                        <span>Địa chỉ:</span>
                                    </p>
                                    <p className="text-stone-700">
                                        {currentAlert.homeAddress}
                                    </p>
                                </div>
                            )}

                            {/* Staff Selection Dropdown (#4: better empty state, #7: loading) */}
                            <div className="space-y-2">
                                <label htmlFor="sos-staff-select" className="text-sm font-bold text-stone-700 flex items-center gap-2">
                                    <svg className="w-4 h-4 text-primary" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                                    </svg>
                                    CHỌN NHÂN VIÊN XỬ LÝ:
                                </label>
                                {isLoadingStaff ? (
                                    <div className="flex items-center gap-2 p-3 bg-stone-50 border-2 border-stone-300 rounded-xl text-stone-500">
                                        <div className="w-4 h-4 border-2 border-stone-400 border-t-transparent rounded-full animate-spin" />
                                        <span>Đang tải danh sách nhân viên...</span>
                                    </div>
                                ) : !isLoadingStaff && availableStaff.length === 0 ? (
                                    <div className="p-3 bg-red-50 border-2 border-red-300 rounded-xl text-red-700 text-sm font-medium flex items-center gap-2">
                                        <svg className="w-5 h-5 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                                        </svg>
                                        <span>Không có nhân viên rảnh! Vui lòng từ chối và liên hệ trực tiếp.</span>
                                    </div>
                                ) : (
                                    <select
                                        id="sos-staff-select"
                                        title="Chọn nhân viên xử lý cấp cứu"
                                        value={selectedStaffId}
                                        onChange={(e) => setSelectedStaffId(e.target.value)}
                                        className="w-full p-3 bg-white border-2 border-stone-900 rounded-xl shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] focus:ring-0 focus:translate-x-1 focus:translate-y-1 focus:shadow-none transition-all outline-none text-stone-900"
                                    >
                                        <option value="" disabled>Chọn bác sĩ/nhân viên...</option>
                                        {availableStaff.map(staff => (
                                            <option key={staff.staffId} value={staff.staffId}>
                                                {staff.fullName} {staff.isSuggested ? '(Gợi ý)' : ''}
                                            </option>
                                        ))}
                                    </select>
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
                    <div className="px-6 py-3 bg-stone-50 rounded-b-xl text-center text-sm text-stone-500 border-t-2 border-stone-900">
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
                                .sos-alert-progress {
                                    width: 100%;
                                    height: 0.375rem;
                                    appearance: none;
                                    border: 0;
                                    background: rgba(255, 255, 255, 0.2);
                                    border-radius: 9999px;
                                    overflow: hidden;
                                }
                                .sos-alert-progress::-webkit-progress-bar {
                                    background: rgba(255, 255, 255, 0.2);
                                    border-radius: 9999px;
                                }
                                .sos-alert-progress::-webkit-progress-value {
                                    background: #ffffff;
                                    border-radius: 9999px;
                                    transition: width 1000ms linear;
                                }
                                .sos-alert-progress::-moz-progress-bar {
                                    background: #ffffff;
                                    border-radius: 9999px;
                                }
            `}</style>
        </>
    )
}
