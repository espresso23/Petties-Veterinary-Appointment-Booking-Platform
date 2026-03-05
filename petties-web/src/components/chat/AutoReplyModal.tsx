import { Fragment, useEffect, useState } from 'react'
import { Dialog, Transition } from '@headlessui/react'
import { XMarkIcon, MagnifyingGlassIcon, ArrowLeftIcon, BoltIcon, ChatBubbleBottomCenterTextIcon, ClockIcon, TrashIcon } from '@heroicons/react/24/outline'
import { chatService } from '../../services/api/chatService'
import type { AutoReplyCondition, ChatAutoReplySettings } from '../../types/chat'
import { useToast } from '../../hooks/useToast'

interface AutoReplyModalProps {
    isOpen: boolean
    onClose: () => void
}

type ViewType = 'initial' | 'list' | 'quick_reply' | 'away_message'

const AUTOMATIONS = [
    { id: 'quick_reply', name: 'Tin trả lời nhanh', objective: 'Chào mừng mọi người' },
    { id: 'away_message', name: 'Tin nhắn vắng mặt', objective: 'Trả lời khi ngoài giờ làm việc' },
] as const

type AutomationItem = (typeof AUTOMATIONS)[number]

type ActionButtonType = 'MENU' | 'OFFER' | 'BOOKING' | 'CUSTOM'
interface ActionButton {
    id: string
    label: string
    type: ActionButtonType
}

export function AutoReplyModal({ isOpen, onClose }: AutoReplyModalProps) {
    const [view, setView] = useState<ViewType>('initial')
    const [editingItem, setEditingItem] = useState<AutomationItem | null>(null)

    const { showToast } = useToast()

    const [settings, setSettings] = useState<ChatAutoReplySettings | null>(null)
    const [loading, setLoading] = useState(false)
    const [saving, setSaving] = useState(false)

    const [quickReplyText, setQuickReplyText] = useState('')
    const [awayMessageText, setAwayMessageText] = useState('')
    const [awayCondition, setAwayCondition] = useState<AutoReplyCondition>('OFF_HOURS')

    // Trạng thái các toggle
    const [activeStates, setActiveStates] = useState<Record<string, boolean>>({
        quick_reply: true,
        away_message: false,
    })

    const [createdAutomations, setCreatedAutomations] = useState<string[]>([])

    const [actionButtons, setActionButtons] = useState<ActionButton[]>(() => {
        try {
            const stored = localStorage.getItem('mock_action_buttons')
            if (stored) return JSON.parse(stored)
        } catch { /* ignore */ }
        return [
            { id: 'btn_menu', label: 'Khám phá Menu', type: 'MENU' },
            { id: 'btn_offer', label: 'Nhận ưu đãi', type: 'OFFER' },
            { id: 'btn_booking', label: 'Đặt lịch ngay', type: 'BOOKING' }
        ]
    })

    // Load settings when modal opens
    useEffect(() => {
        if (!isOpen) return

        const fetchSettings = async () => {
            try {
                setLoading(true)
                const data = await chatService.getAutoReplySettings()
                setSettings(data)

                const created = []
                if (data.quickReplyEnabled || data.quickReplyMessage?.trim()) created.push('quick_reply')
                if (data.awayMessageEnabled || data.awayMessage?.trim()) created.push('away_message')
                setCreatedAutomations(created)

                setActiveStates({
                    quick_reply: data.quickReplyEnabled,
                    away_message: data.awayMessageEnabled,
                })
                setQuickReplyText(
                    data.quickReplyMessage ||
                    'Xin chào! Cảm ơn bạn đã liên hệ với chúng tôi. Chúng tôi đã nhận được tin nhắn và sẽ phản hồi trong thời gian sớm nhất.'
                )
                setAwayMessageText(
                    data.awayMessage ||
                    'Hiện tại chúng tôi không có mặt tại phòng khám. Vui lòng để lại lời nhắn hoặc liên hệ hotline để được hỗ trợ khẩn cấp.'
                )
                setAwayCondition(data.awayCondition || 'OFF_HOURS')
                if (data.actionButtons && data.actionButtons.length > 0) {
                    setActionButtons(data.actionButtons)
                }
            } catch (error) {
                console.error('Failed to load chat auto-reply settings', error)
            } finally {
                setLoading(false)
            }
        }

        fetchSettings()
    }, [isOpen])

    const handleEdit = (item: AutomationItem) => {
        setEditingItem(item)
        if (item.id === 'quick_reply') setView('quick_reply')
        else if (item.id === 'away_message') setView('away_message')
        // fallback to quick reply design for others
        else setView('quick_reply')
    }

    const handleBack = () => {
        setView('initial')
        setEditingItem(null)
    }

    const handleCreateNew = () => {
        setView('list')
    }

    const toggleState = (id: string) => {
        setActiveStates(prev => {
            const next = { ...prev, [id]: !prev[id] }

            // In list view, persist immediately when toggling status
            if (view === 'list') {
                void saveSettings(next)
            }

            return next
        })
    }

    const buildPayload = (stateOverride?: Record<string, boolean>) => {
        const state = stateOverride ?? activeStates
        return {
            quickReplyEnabled: state.quick_reply,
            quickReplyMessage: quickReplyText.trim(),
            awayMessageEnabled: state.away_message,
            awayCondition,
            awayMessage: awayMessageText.trim(),
            actionButtons: actionButtons
        }
    }

    const saveSettings = async (stateOverride?: Record<string, boolean>) => {
        if (!settings) return

        setSaving(true)
        try {
            const payload = buildPayload(stateOverride)
            const updated = await chatService.updateAutoReplySettings(payload)
            setSettings(updated)
            if (editingItem && !createdAutomations.includes(editingItem.id)) {
                setCreatedAutomations(prev => [...prev, editingItem.id])
            }
            setActiveStates({
                quick_reply: updated.quickReplyEnabled,
                away_message: updated.awayMessageEnabled,
            })
            setQuickReplyText(updated.quickReplyMessage || quickReplyText)
            setAwayMessageText(updated.awayMessage || awayMessageText)
            setAwayCondition(updated.awayCondition || awayCondition)

            // Persist action buttons to localStorage
            try {
                localStorage.setItem('mock_action_buttons', JSON.stringify(actionButtons))
                localStorage.setItem('mock_quick_reply', updated.quickReplyMessage || quickReplyText)
                localStorage.setItem('mock_away_message', updated.awayMessage || awayMessageText)
            } catch { /* ignore */ }

            if (updated.actionButtons) {
                setActionButtons(updated.actionButtons)
            }
            showToast('success', 'Đã lưu cấu hình tin nhắn tự động')
            // Only navigate back to initial view when saving from editor
            if (view !== 'list') {
                handleBack()
            }
        } catch (error) {
            console.error('Failed to save chat auto-reply settings', error)
            showToast('error', 'Không thể lưu cấu hình tin nhắn tự động. Vui lòng thử lại.')
        } finally {
            setSaving(false)
        }
    }

    const handleSave = () => {
        void saveSettings()
    }

    const handleDeleteAutomation = async (item?: AutomationItem) => {
        const targetItem = item || editingItem
        if (!targetItem) return
        setSaving(true)
        try {
            const payload = buildPayload()
            if (targetItem.id === 'quick_reply') {
                payload.quickReplyEnabled = false
                payload.quickReplyMessage = ''
            } else if (targetItem.id === 'away_message') {
                payload.awayMessageEnabled = false
                payload.awayMessage = ''
            }
            // we could also clear actionButtons if you want, but they're not sent to backend yet
            const updated = await chatService.updateAutoReplySettings(payload)
            setSettings(updated)
            setActiveStates({
                quick_reply: updated.quickReplyEnabled,
                away_message: updated.awayMessageEnabled,
            })
            setQuickReplyText(updated.quickReplyMessage || '')
            setAwayMessageText(updated.awayMessage || '')
            setCreatedAutomations(prev => prev.filter(id => id !== targetItem.id))
            showToast('success', 'Đã xóa tin nhắn tự động này')
            if (view !== 'list') {
                handleBack()
            }
        } catch (error) {
            console.error('Failed to delete automation', error)
            showToast('error', 'Không thể xóa tin nhắn tự động. Vui lòng thử lại.')
        } finally {
            setSaving(false)
        }
    }

    const handleAddButton = () => {
        setActionButtons(prev => [...prev, { id: Date.now().toString(), label: '', type: 'CUSTOM' }])
    }

    const handleRemoveButton = (id: string) => {
        setActionButtons(prev => prev.filter(btn => btn.id !== id))
    }

    const handleUpdateButton = (id: string, field: keyof ActionButton, value: string) => {
        setActionButtons(prev => prev.map(btn => btn.id === id ? { ...btn, [field]: value } : btn))
    }

    return (
        <Transition.Root show={isOpen} as={Fragment}>
            <Dialog as="div" className="relative z-50" onClose={onClose}>
                <Transition.Child
                    as={Fragment}
                    enter="ease-out duration-300"
                    enterFrom="opacity-0"
                    enterTo="opacity-100"
                    leave="ease-in duration-200"
                    leaveFrom="opacity-100"
                    leaveTo="opacity-0"
                >
                    <div className="fixed inset-0 bg-stone-900/80 transition-opacity" />
                </Transition.Child>

                <div className="fixed inset-0 z-10 overflow-y-auto">
                    <div className="flex min-h-full items-center justify-center p-4 text-center sm:p-0">
                        <Transition.Child
                            as={Fragment}
                            enter="ease-out duration-300"
                            enterFrom="opacity-0 translate-y-4 sm:translate-y-0 sm:scale-95"
                            enterTo="opacity-100 translate-y-0 sm:scale-100"
                            leave="ease-in duration-200"
                            leaveFrom="opacity-100 translate-y-0 sm:scale-100"
                            leaveTo="opacity-0 translate-y-4 sm:translate-y-0 sm:scale-95"
                        >
                            <Dialog.Panel className="relative transform overflow-hidden rounded-2xl bg-white text-left shadow-xl transition-all sm:my-8 sm:w-full sm:max-w-5xl border-4 border-stone-900 flex flex-col max-h-[90vh]">

                                {view === 'initial' && (
                                    <>
                                        {/* Header */}
                                        <div className="flex items-center justify-between mb-8 pb-4 border-b-2 border-stone-200 p-8">
                                            <div>
                                                <Dialog.Title as="h3" className="text-2xl font-black text-stone-900 uppercase tracking-tight flex items-center gap-3">
                                                    Mẫu
                                                </Dialog.Title>
                                                <p className="text-sm font-medium text-stone-500 mt-1">
                                                    Thiết lập tin nhắn tự động cho cuộc trò chuyện với khách hàng.
                                                </p>
                                            </div>
                                            <button
                                                type="button"
                                                className="rounded-lg p-2 text-stone-400 hover:text-stone-500 hover:bg-stone-100 transition-colors focus:outline-none focus:ring-2 focus:ring-amber-500 focus:ring-offset-2"
                                                onClick={onClose}
                                            >
                                                <span className="sr-only">Close menu</span>
                                                <XMarkIcon className="h-6 w-6" aria-hidden="true" />
                                            </button>
                                        </div>

                                        <div className="flex flex-col gap-8 w-full p-8 pt-0">
                                            <div className="flex justify-between items-center mb-2">
                                                <h4 className="text-lg font-black text-stone-900">Chào mừng mọi người</h4>
                                                <div className="flex items-center gap-3">
                                                    <button
                                                        onClick={handleCreateNew}
                                                        className="text-amber-600 font-bold hover:underline"
                                                    >
                                                        Xem hệ thống tự động hóa
                                                    </button>
                                                    {loading && (
                                                        <span className="text-xs font-medium text-stone-400">
                                                            Đang tải cấu hình...
                                                        </span>
                                                    )}
                                                </div>
                                            </div>

                                            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
                                                {/* Quick Reply Card */}
                                                <button
                                                    onClick={() => handleEdit(AUTOMATIONS[0])}
                                                    className="group relative text-left bg-white rounded-xl border-4 border-stone-900 hover:-translate-y-1 hover:-translate-x-1 hover:shadow-[8px_8px_0_#1c1917] transition-all overflow-hidden flex flex-col aspect-[4/3] focus:outline-none focus:ring-4 focus:ring-amber-500/20"
                                                >
                                                    <div className="h-32 bg-amber-400 w-full relative overflow-hidden flex items-center justify-center p-6 border-b-4 border-stone-900">
                                                        <div className="absolute top-4 left-6 w-8 h-8 rounded-full border-4 border-stone-900 drop-shadow-[2px_2px_0_#fff]"></div>
                                                        <BoltIcon className="w-16 h-16 text-stone-900 absolute bottom-4 left-6 -rotate-12 transform group-hover:scale-110 transition-transform duration-300 drop-shadow-[2px_2px_0_#fff]" />
                                                        <ChatBubbleBottomCenterTextIcon className="w-20 h-20 text-stone-900 absolute top-4 right-6 group-hover:-translate-y-2 transition-transform duration-300 drop-shadow-[2px_2px_0_#fff]" />
                                                        <div className="absolute bottom-4 right-6 w-16 h-2 bg-stone-900 rounded-full drop-shadow-[2px_2px_0_#fff]"></div>
                                                    </div>
                                                    <div className="p-4 flex-1 flex flex-col justify-between bg-white">
                                                        <div>
                                                            <h5 className="font-black text-stone-900 mb-1 text-lg">Tin trả lời nhanh</h5>
                                                            <p className="text-sm text-stone-600 font-bold line-clamp-2 leading-tight">Trả lời bằng lời chào khi người nào đó nhắn tin cho bạn lần đầu.</p>
                                                        </div>
                                                    </div>
                                                </button>

                                                {/* Away Message Card */}
                                                <button
                                                    onClick={() => handleEdit(AUTOMATIONS[1])}
                                                    className="group relative text-left bg-white rounded-xl border-4 border-stone-900 hover:-translate-y-1 hover:-translate-x-1 hover:shadow-[8px_8px_0_#1c1917] transition-all overflow-hidden flex flex-col aspect-[4/3] focus:outline-none focus:ring-4 focus:ring-indigo-500/20"
                                                >
                                                    <div className="h-32 bg-[#a3e635] w-full relative overflow-hidden flex items-center justify-center p-6 border-b-4 border-stone-900">
                                                        <div className="absolute top-4 right-6 w-8 h-8 rounded-full border-4 border-stone-900 drop-shadow-[2px_2px_0_#fff]"></div>
                                                        <ClockIcon className="w-16 h-16 text-stone-900 absolute bottom-4 left-6 group-hover:-rotate-12 transition-transform duration-300 drop-shadow-[2px_2px_0_#fff]" />
                                                        <div className="w-16 h-16 rounded-full border-[4px] border-stone-900 absolute top-4 right-12 group-hover:scale-110 transition-transform duration-300 drop-shadow-[2px_2px_0_#fff] flex items-center justify-center">
                                                            <div className="w-8 h-8 rounded-full bg-stone-900"></div>
                                                        </div>
                                                        <div className="absolute bottom-4 right-6 w-24 h-2 bg-stone-900 rounded-full drop-shadow-[2px_2px_0_#fff]"></div>
                                                    </div>
                                                    <div className="p-4 flex-1 flex flex-col justify-between bg-white">
                                                        <div>
                                                            <h5 className="font-black text-stone-900 mb-1 text-lg">Tin nhắn vắng mặt</h5>
                                                            <p className="text-sm text-stone-600 font-bold line-clamp-2 leading-tight">Trả lời tin nhắn riêng tư, tự động khi bạn vắng mặt.</p>
                                                        </div>
                                                    </div>
                                                </button>
                                            </div>
                                        </div>
                                    </>
                                )}

                                {view === 'list' && (
                                    <>
                                        {/* List Header */}
                                        <div className="px-8 py-6 border-b-2 border-stone-200 flex items-center justify-between bg-stone-50">
                                            <div className="flex items-center gap-4">
                                                <button
                                                    onClick={() => setView('initial')}
                                                    className="p-2 -ml-2 text-stone-500 hover:text-stone-900 hover:bg-stone-200 rounded-lg transition-colors focus:outline-none"
                                                >
                                                    <ArrowLeftIcon className="w-5 h-5" />
                                                </button>
                                                <Dialog.Title as="h3" className="text-xl font-black text-stone-900">
                                                    Hệ thống tự động hóa của bạn
                                                </Dialog.Title>
                                            </div>
                                            <div className="flex gap-4 items-center">
                                                <button
                                                    onClick={() => setView('initial')}
                                                    className="px-4 py-2 border-2 border-stone-900 rounded-lg font-bold text-sm bg-amber-400 text-stone-900 shadow-[2px_2px_0_#1c1917] hover:shadow-[3px_3px_0_#1c1917] hover:-translate-y-0.5 hover:-translate-x-0.5 transition-all focus:outline-none"
                                                >
                                                    + Tạo tự động hóa
                                                </button>
                                                <button
                                                    type="button"
                                                    className="rounded-lg p-2 text-stone-400 hover:text-stone-900 hover:bg-stone-200 transition-colors"
                                                    onClick={onClose}
                                                >
                                                    <XMarkIcon className="h-6 w-6" />
                                                </button>
                                            </div>
                                        </div>

                                        {/* List Body */}
                                        <div className="p-8 overflow-y-auto">
                                            <div className="relative mb-6">
                                                <MagnifyingGlassIcon className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-stone-400" />
                                                <input
                                                    type="text"
                                                    placeholder="Tìm kiếm theo tên hoặc mục tiêu"
                                                    className="w-full pl-10 pr-4 py-2.5 bg-white border-2 border-stone-200 rounded-lg focus:outline-none focus:border-amber-500 transition-colors text-sm font-medium"
                                                />
                                            </div>

                                            <div className="border border-stone-200 rounded-xl overflow-hidden">
                                                <table className="w-full text-left text-sm">
                                                    <thead className="bg-stone-50 border-b border-stone-200">
                                                        <tr>
                                                            <th className="px-6 py-4 font-bold text-stone-900 w-24">Trạng thái</th>
                                                            <th className="px-6 py-4 font-bold text-stone-900">Tên</th>
                                                            <th className="px-6 py-4 font-bold text-stone-900">Mục tiêu</th>
                                                            <th className="px-6 py-4 font-bold text-stone-900 text-right">Thao tác</th>
                                                        </tr>
                                                    </thead>
                                                    <tbody className="divide-y divide-stone-200">
                                                        {AUTOMATIONS.filter(item => createdAutomations.includes(item.id)).map((item) => (
                                                            <tr key={item.id} className="hover:bg-stone-50 transition-colors bg-white">
                                                                <td className="px-6 py-4">
                                                                    {activeStates[item.id] ? (
                                                                        <button
                                                                            onClick={() => toggleState(item.id)}
                                                                            className="w-12 h-7 bg-amber-400 border-[2px] border-stone-900 rounded-full flex items-center px-1 transition-colors outline-none cursor-pointer shadow-[2px_2px_0_#1c1917] hover:shadow-[3px_3px_0_#1c1917] hover:-translate-y-[1px] hover:-translate-x-[1px]"
                                                                        >
                                                                            <div className="w-4 h-4 bg-stone-900 rounded-full translate-x-5 transition-transform"></div>
                                                                        </button>
                                                                    ) : (
                                                                        <button
                                                                            onClick={() => toggleState(item.id)}
                                                                            className="w-12 h-7 bg-stone-200 border-[2px] border-stone-900 rounded-full flex items-center px-1 transition-colors outline-none cursor-pointer shadow-[2px_2px_0_#1c1917] hover:shadow-[3px_3px_0_#1c1917] hover:-translate-y-[1px] hover:-translate-x-[1px]"
                                                                        >
                                                                            <div className="w-4 h-4 bg-stone-900 rounded-full translate-x-0 transition-transform"></div>
                                                                        </button>
                                                                    )}
                                                                </td>
                                                                <td className="px-6 py-4 font-bold text-stone-900">{item.name}</td>
                                                                <td className="px-6 py-4 font-medium text-stone-500">{item.objective}</td>
                                                                <td className="px-6 py-4 text-right flex items-center justify-end gap-3">
                                                                    <button
                                                                        onClick={() => handleEdit(item)}
                                                                        className="text-amber-600 hover:text-amber-700 font-bold hover:underline transition-colors focus:outline-none"
                                                                    >
                                                                        Chỉnh sửa
                                                                    </button>
                                                                    <button
                                                                        onClick={() => handleDeleteAutomation(item)}
                                                                        className="p-1.5 text-stone-400 hover:text-red-500 hover:bg-stone-100 rounded-lg transition-colors focus:outline-none"
                                                                        title="Xóa mẫu này"
                                                                    >
                                                                        <TrashIcon className="w-5 h-5 pointer-events-none" />
                                                                    </button>
                                                                </td>
                                                            </tr>
                                                        ))}
                                                        {createdAutomations.length === 0 && (
                                                            <tr>
                                                                <td colSpan={4} className="px-6 py-12 text-center text-stone-500 font-medium bg-white">
                                                                    Bạn chưa tạo tự động hóa nào. Vui lòng bấm vào "Tạo tự động hóa" để thêm.
                                                                </td>
                                                            </tr>
                                                        )}
                                                    </tbody>
                                                </table>
                                            </div>
                                        </div>
                                    </>
                                )}

                                {view !== 'list' && editingItem && (
                                    <>
                                        {/* Editor Header */}
                                        <div className="px-8 py-6 border-b-2 border-stone-200 flex items-center justify-between bg-stone-50">
                                            <div className="flex items-center gap-4">
                                                <button
                                                    onClick={handleBack}
                                                    className="p-2 -ml-2 text-stone-500 hover:text-stone-900 hover:bg-stone-200 rounded-lg transition-colors focus:outline-none"
                                                >
                                                    <ArrowLeftIcon className="w-5 h-5" />
                                                </button>
                                                <Dialog.Title as="h3" className="text-xl font-black text-stone-900">
                                                    Chỉnh sửa: {editingItem.name}
                                                </Dialog.Title>
                                            </div>
                                            <div className="flex items-center gap-3">
                                                <span className="text-sm font-bold text-stone-700">Trạng thái</span>
                                                {activeStates[editingItem.id] ? (
                                                    <button
                                                        onClick={() => toggleState(editingItem.id)}
                                                        className="w-12 h-7 bg-amber-400 border-[2px] border-stone-900 rounded-full flex items-center px-1 transition-colors outline-none cursor-pointer shadow-[2px_2px_0_#1c1917] hover:shadow-[3px_3px_0_#1c1917] hover:-translate-y-[1px] hover:-translate-x-[1px]"
                                                    >
                                                        <div className="w-4 h-4 bg-stone-900 rounded-full translate-x-5 transition-transform"></div>
                                                    </button>
                                                ) : (
                                                    <button
                                                        onClick={() => toggleState(editingItem.id)}
                                                        className="w-12 h-7 bg-stone-200 border-[2px] border-stone-900 rounded-full flex items-center px-1 transition-colors outline-none cursor-pointer shadow-[2px_2px_0_#1c1917] hover:shadow-[3px_3px_0_#1c1917] hover:-translate-y-[1px] hover:-translate-x-[1px]"
                                                    >
                                                        <div className="w-4 h-4 bg-stone-900 rounded-full translate-x-0 transition-transform"></div>
                                                    </button>
                                                )}
                                            </div>
                                        </div>

                                        {/* Editor Body */}
                                        <div className="p-8 overflow-y-auto flex-1 bg-white">
                                            <div className="max-w-2xl mx-auto flex flex-col gap-8">

                                                {/* Away Message Condition */}
                                                {view === 'away_message' && (
                                                    <div className="bg-stone-50 p-6 rounded-xl border-2 border-stone-200 relative">
                                                        <h4 className="text-md font-bold text-stone-900 mb-4">Điều kiện</h4>
                                                        <div className="flex flex-col gap-2">
                                                            <label className="text-sm font-bold text-stone-600">Khi nào tin nhắn này được gửi?</label>
                                                            <select
                                                                className="w-full p-3 border-2 border-stone-200 rounded-lg bg-white focus:outline-none focus:border-amber-500 font-bold text-stone-900 transition-colors"
                                                                value={awayCondition}
                                                                onChange={(e) => setAwayCondition(e.target.value as AutoReplyCondition)}
                                                            >
                                                                <option value="OFF_HOURS">Ngoài giờ làm việc</option>
                                                                <option value="ALWAYS">Luôn luôn (khi được kích hoạt)</option>
                                                            </select>
                                                        </div>
                                                    </div>
                                                )}

                                                {/* Message Component */}
                                                <div className="bg-stone-50 p-6 rounded-xl border-2 border-stone-200 relative">
                                                    <h4 className="text-md font-bold text-stone-900 mb-4">Nội dung tin nhắn</h4>
                                                    <textarea
                                                        rows={6}
                                                        className="w-full p-4 border-2 border-stone-200 rounded-lg bg-white focus:outline-none focus:border-amber-500 font-medium text-stone-900 resize-none transition-colors"
                                                        placeholder="Nhập nội dung tin nhắn tự động ở đây..."
                                                        value={view === 'quick_reply' ? quickReplyText : awayMessageText}
                                                        onChange={(e) =>
                                                            view === 'quick_reply'
                                                                ? setQuickReplyText(e.target.value)
                                                                : setAwayMessageText(e.target.value)
                                                        }
                                                    ></textarea>
                                                    <div className="mt-3 flex justify-between items-center text-sm">
                                                        <span className="text-stone-500 font-medium">Người nhận sẽ thấy tin nhắn này khi họ nhắn tin.</span>
                                                    </div>
                                                </div>

                                                {/* Action Buttons Component */}
                                                <div className="bg-stone-50 p-6 rounded-xl border-2 border-stone-200 relative">
                                                    <div className="flex justify-between items-center mb-4">
                                                        <h4 className="text-md font-bold text-stone-900">Các nút hành động</h4>
                                                    </div>
                                                    <p className="text-sm text-stone-600 font-medium mb-4">
                                                        Thêm các nút bên dưới nội dung tin nhắn để hướng dẫn người dùng thực hiện các hành động tiếp theo, ví dụ: "Khám phá Menu", "Đặt lịch ngay".
                                                    </p>

                                                    {/* Thu gọn các nút hành động thành list state */}
                                                    <div className="flex flex-col gap-3 mb-4">
                                                        {actionButtons.map(btn => (
                                                            <div key={btn.id} className="flex items-center gap-2">
                                                                <div className="flex-1 flex gap-0 rounded-lg shadow-[2px_2px_0_#1c1917] focus-within:ring-2 focus-within:ring-amber-500 transition-shadow">
                                                                    <input
                                                                        type="text"
                                                                        value={btn.label}
                                                                        onChange={(e) => handleUpdateButton(btn.id, 'label', e.target.value)}
                                                                        className="w-1/2 p-3 border-2 border-r-0 border-stone-900 rounded-l-lg bg-white focus:outline-none font-bold text-stone-900"
                                                                        placeholder="Tên nút (VD: Khám phá Menu)"
                                                                    />
                                                                    <select
                                                                        value={btn.type}
                                                                        onChange={(e) => handleUpdateButton(btn.id, 'type', e.target.value)}
                                                                        className="w-1/2 p-3 border-2 border-stone-900 rounded-r-lg bg-stone-50 focus:outline-none font-bold text-stone-700 cursor-pointer"
                                                                    >
                                                                        <option value="MENU">Hành động: Hiện dịch vụ (Menu)</option>
                                                                        <option value="OFFER">Hành động: Nhận ưu đãi</option>
                                                                        <option value="BOOKING">Hành động: Đặt lịch ngay</option>
                                                                        <option value="CUSTOM">Chỉ gửi tin nhắn</option>
                                                                    </select>
                                                                </div>
                                                                <button
                                                                    onClick={() => handleRemoveButton(btn.id)}
                                                                    className="p-3 text-stone-400 hover:text-red-500 hover:bg-red-50 rounded-lg border-2 border-transparent transition-colors focus:outline-none"
                                                                >
                                                                    <TrashIcon className="w-5 h-5 pointer-events-none" />
                                                                </button>
                                                            </div>
                                                        ))}
                                                    </div>

                                                    <button
                                                        onClick={handleAddButton}
                                                        className="w-full py-3 border-2 border-dashed border-stone-300 rounded-xl text-stone-600 font-bold hover:bg-stone-100 hover:border-stone-400 hover:text-stone-900 transition-all focus:outline-none flex items-center justify-center gap-2"
                                                    >
                                                        <span className="text-xl leading-none">+</span> Thêm nút bấm
                                                    </button>
                                                </div>

                                            </div>
                                        </div>

                                        {/* Editor Footer */}
                                        <div className="px-8 py-5 border-t-2 border-stone-200 bg-stone-50 flex justify-between gap-3 rounded-b-2xl items-center">
                                            <button
                                                onClick={() => handleDeleteAutomation()}
                                                className="px-5 py-2.5 rounded-xl border-2 border-stone-200 text-stone-600 font-bold hover:bg-red-50 hover:border-red-300 hover:text-red-600 transition-all focus:outline-none flex-shrink-0"
                                            >
                                                Xóa mẫu
                                            </button>
                                            <div className="flex gap-3">
                                                <button
                                                    onClick={handleBack}
                                                    className="px-5 py-2.5 rounded-xl border-2 border-stone-200 text-stone-600 font-bold hover:bg-stone-50 hover:border-stone-300 hover:text-stone-900 transition-all focus:outline-none"
                                                >
                                                    Hủy
                                                </button>
                                                <button
                                                    className="px-5 py-2.5 bg-amber-500 text-stone-900 font-bold rounded-xl border-2 border-stone-900 shadow-[2px_2px_0_#1c1917] hover:shadow-[4px_4px_0_#1c1917] hover:-translate-y-0.5 hover:-translate-x-0.5 transition-all focus:outline-none disabled:opacity-60 disabled:cursor-not-allowed"
                                                    onClick={handleSave}
                                                    disabled={saving || loading}
                                                >
                                                    {saving ? 'Đang lưu...' : 'Lưu thay đổi'}
                                                </button>
                                            </div>
                                        </div>
                                    </>
                                )}
                            </Dialog.Panel>
                        </Transition.Child>
                    </div>
                </div>
            </Dialog>
        </Transition.Root>
    )
}
