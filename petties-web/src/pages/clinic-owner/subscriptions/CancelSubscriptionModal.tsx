import React from 'react'
import { Dialog, Transition } from '@headlessui/react'
import { Fragment } from 'react'
import {
    FaceFrownIcon,
    ExclamationTriangleIcon,
    SparklesIcon,
    ClockIcon,
    QuestionMarkCircleIcon,
    XMarkIcon
} from '@heroicons/react/24/outline'
import { HeartIcon as HeartSolid } from '@heroicons/react/24/solid'

interface CancelSubscriptionModalProps {
    isOpen: boolean
    onClose: () => void
    onConfirm: () => void
    isLoading: boolean
}

export const CancelSubscriptionModal: React.FC<CancelSubscriptionModalProps> = ({
    isOpen,
    onClose,
    onConfirm,
    isLoading
}) => {
    return (
        <Transition show={isOpen} as={Fragment}>
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
                    <div className="fixed inset-0 bg-gray-900/40 backdrop-blur-sm" />
                </Transition.Child>

                <div className="fixed inset-0 overflow-y-auto">
                    <div className="flex min-h-full items-center justify-center p-4">
                        <Transition.Child
                            as={Fragment}
                            enter="ease-out duration-300"
                            enterFrom="opacity-0 scale-95 translateY(20px)"
                            enterTo="opacity-100 scale-100 translateY(0)"
                            leave="ease-in duration-200"
                            leaveFrom="opacity-100 scale-100 translateY(0)"
                            leaveTo="opacity-0 scale-95 translateY(20px)"
                        >
                            <Dialog.Panel className="w-full max-w-md bg-white rounded-[32px] overflow-hidden shadow-2xl border border-gray-100">
                                <div className="absolute top-6 right-6 z-10">
                                    <button onClick={onClose} className="p-2 hover:bg-white rounded-2xl transition-all group shadow-sm bg-white/50 border border-white/50 backdrop-blur-sm active:scale-90">
                                        <XMarkIcon className="w-5 h-5 text-gray-400 group-hover:text-gray-900" />
                                    </button>
                                </div>

                                {/* Top Banner */}
                                <div className="h-44 bg-gradient-to-br from-orange-50 to-amber-100 relative flex justify-center items-center">
                                    <div className="w-20 h-20 bg-white rounded-[24px] shadow-xl shadow-orange-200/50 flex items-center justify-center rotate-3 hover:rotate-0 transition-transform duration-500">
                                        <FaceFrownIcon className="w-12 h-12 text-orange-500" />
                                    </div>
                                </div>

                                <div className="p-8 space-y-8">
                                    <div className="text-center space-y-3">
                                        <Dialog.Title className="text-2xl font-black text-gray-900 tracking-tight uppercase">
                                            Bạn có chắc chắn?
                                        </Dialog.Title>
                                        <p className="text-sm text-gray-500 leading-relaxed font-medium px-4">
                                            Mọi tính năng AI thông minh và đặc quyền quản lý sẽ bị vô hiệu hóa sau khi gói kết thúc.
                                        </p>
                                    </div>

                                    <div className="bg-orange-50/50 rounded-2xl p-6 border border-orange-100 space-y-5">
                                        <div className="flex items-center gap-2 text-orange-600 font-extrabold text-[11px] uppercase tracking-widest bg-white border border-orange-100 w-fit px-3 py-1 rounded-full shadow-sm mx-auto">
                                            <ExclamationTriangleIcon className="w-4 h-4" />
                                            Bạn sẽ mất quyền truy cập vào:
                                        </div>

                                        <div className="space-y-4">
                                            <div className="flex gap-4 items-center p-3 bg-white/50 rounded-xl">
                                                <div className="w-12 h-12 rounded-[14px] bg-orange-100 flex items-center justify-center shrink-0">
                                                    <SparklesIcon className="w-6 h-6 text-orange-600" />
                                                </div>
                                                <div>
                                                    <p className="font-extrabold text-gray-900 text-sm tracking-tight">Trợ Lý AI Toàn Diện</p>
                                                    <p className="text-[11px] text-gray-500 font-bold mt-0.5">AI Chat và Phân tích bệnh án thông minh</p>
                                                </div>
                                            </div>

                                            <div className="flex gap-4 items-center p-3 bg-white/50 rounded-xl">
                                                <div className="w-12 h-12 rounded-[14px] bg-orange-100 flex items-center justify-center shrink-0">
                                                    <ClockIcon className="w-6 h-6 text-orange-600" />
                                                </div>
                                                <div>
                                                    <p className="font-extrabold text-gray-900 text-sm tracking-tight">Hỗ Trợ Ưu Tiên 24/7</p>
                                                    <p className="text-[11px] text-gray-500 font-bold mt-0.5">Không còn được ưu tiên hỗ trợ đặc quyền</p>
                                                </div>
                                            </div>
                                        </div>
                                    </div>

                                    <div className="space-y-4">
                                        <button
                                            onClick={onClose}
                                            className="w-full h-14 bg-orange-500 hover:bg-orange-600 text-white font-black rounded-2xl transition-all flex justify-center items-center gap-2 shadow-xl shadow-orange-200 active:scale-[0.98]"
                                        >
                                            <HeartSolid className="w-5 h-5 animate-pulse" />
                                            GIỮ LẠI GÓI HỘI VIÊN
                                        </button>

                                        <button
                                            onClick={onConfirm}
                                            disabled={isLoading}
                                            className="w-full h-12 text-gray-400 hover:text-gray-900 font-bold transition-all uppercase text-[10px] tracking-widest flex justify-center items-center gap-2 active:scale-95"
                                        >
                                            {isLoading ? (
                                                <div className="w-4 h-4 border-2 border-gray-300 border-t-gray-600 rounded-full animate-spin" />
                                            ) : (
                                                'Bỏ qua quyền lợi và hủy gói'
                                            )}
                                        </button>
                                    </div>
                                </div>

                                <div className="bg-gray-50/80 py-4 flex items-center justify-center gap-2 border-t border-gray-100">
                                    <QuestionMarkCircleIcon className="w-4 h-4 text-gray-400" />
                                    <p className="text-[10px] text-gray-400 font-bold uppercase tracking-wider">
                                        Cần giúp đỡ? Liên hệ đội ngũ hỗ trợ Petties.
                                    </p>
                                </div>
                            </Dialog.Panel>
                        </Transition.Child>
                    </div>
                </div>
            </Dialog>
        </Transition>
    )
}
