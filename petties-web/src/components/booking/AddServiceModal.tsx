import { useState, useMemo } from 'react';
import type { ClinicServiceResponse } from '../../types/service';
import { SERVICE_CATEGORY_LABELS } from '../../types/booking';
import { MagnifyingGlassIcon, FunnelIcon, XMarkIcon } from '@heroicons/react/24/outline';

interface AddServiceModalProps {
    isOpen: boolean;
    onClose: () => void;
    availableServices: ClinicServiceResponse[];
    onAddService: (serviceId: string) => Promise<void>;
    isAdding: boolean;
}

export const AddServiceModal = ({
    isOpen,
    onClose,
    availableServices,
    onAddService,
    isAdding
}: AddServiceModalProps) => {
    const [searchTerm, setSearchTerm] = useState('');
    const [categoryFilter, setCategoryFilter] = useState<string>('ALL');
    const [selectedServiceId, setSelectedServiceId] = useState<string>('');

    // Extract unique categories from available services
    const categories = useMemo(() => {
        const cats = new Set<string>();
        availableServices.forEach(s => {
            if (s.serviceCategory) cats.add(s.serviceCategory);
        });
        return Array.from(cats);
    }, [availableServices]);

    // Filter services based on search and category
    const filteredServices = useMemo(() => {
        return availableServices.filter(service => {
            const matchesSearch = service.name.toLowerCase().includes(searchTerm.toLowerCase());
            const matchesCategory = categoryFilter === 'ALL' || service.serviceCategory === categoryFilter;
            return matchesSearch && matchesCategory;
        });
    }, [availableServices, searchTerm, categoryFilter]);

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-stone-900/60 backdrop-blur-sm">
            <div className="bg-white border-2 border-stone-900 rounded-2xl shadow-[8px_8px_0_#1c1917] w-full max-w-lg overflow-hidden flex flex-col max-h-[90vh] animate-in fade-in zoom-in duration-200">
                {/* Header */}
                <div className="p-5 border-b-2 border-stone-900 bg-white flex justify-between items-center shrink-0">
                    <h2 className="text-xl font-black uppercase tracking-tight text-stone-900">Thêm dịch vụ phát sinh</h2>
                    <button
                        onClick={onClose}
                        className="p-1 hover:bg-stone-100 rounded-lg transition-colors text-stone-900"
                    >
                        <XMarkIcon className="w-6 h-6 stroke-2" />
                    </button>
                </div>

                {/* Search & Filter Bar */}
                <div className="px-5 py-4 bg-stone-50/50 border-b-2 border-stone-100 grid grid-cols-1 sm:grid-cols-2 gap-4 shrink-0">
                    <div className="relative group">
                        <MagnifyingGlassIcon className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-stone-400 group-focus-within:text-amber-600 transition-colors" />
                        <input
                            type="text"
                            placeholder="Tìm tên dịch vụ..."
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            className="w-full pl-10 pr-4 py-2 bg-white border-2 border-stone-900 rounded-lg shadow-[2px_2px_0_#1c1917] focus:shadow-[4px_4px_0_#1c1917] focus:-translate-y-0.5 outline-none font-bold placeholder:font-medium placeholder:text-stone-400 transition-all"
                        />
                    </div>
                    <div className="relative group">
                        <FunnelIcon className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-stone-400 group-focus-within:text-amber-600 transition-colors" />
                        <select
                            value={categoryFilter}
                            onChange={(e) => setCategoryFilter(e.target.value)}
                            className="w-full pl-10 pr-4 py-2 bg-white border-2 border-stone-900 rounded-lg shadow-[2px_2px_0_#1c1917] focus:shadow-[4px_4px_0_#1c1917] focus:-translate-y-0.5 outline-none font-bold uppercase text-xs appearance-none cursor-pointer transition-all"
                        >
                            <option value="ALL">Tất cả danh mục</option>
                            {categories.map(cat => (
                                <option key={cat} value={cat}>
                                    {SERVICE_CATEGORY_LABELS[cat] || cat}
                                </option>
                            ))}
                        </select>
                    </div>
                </div>

                {/* Content */}
                <div className="p-6 overflow-y-auto custom-scrollbar flex-1 bg-white">
                    <p className="text-sm text-stone-500 mb-6 font-medium leading-relaxed italic">
                        Chọn dịch vụ bổ sung cho đơn hàng. Giá sẽ được tính dựa trên cân nặng của thú cưng hiện tại.
                    </p>

                    <div className="space-y-4">
                        {filteredServices.length === 0 ? (
                            <div className="py-12 flex flex-col items-center justify-center text-stone-400 bg-stone-50 border-2 border-dashed border-stone-200 rounded-xl">
                                <MagnifyingGlassIcon className="w-12 h-12 mb-2 opacity-20" />
                                <p className="font-bold text-sm">
                                    {availableServices.length === 0
                                        ? 'Không còn dịch vụ khả dụng'
                                        : 'Không tìm thấy dịch vụ'}
                                </p>
                            </div>
                        ) : (
                            filteredServices.map((service) => (
                                <div
                                    key={service.serviceId}
                                    onClick={() => setSelectedServiceId(service.serviceId)}
                                    className={`p-5 bg-white border-2 rounded-xl transition-all cursor-pointer group relative ${selectedServiceId === service.serviceId
                                        ? 'border-amber-600 ring-2 ring-amber-600 shadow-[4px_4px_0_#d97706] -translate-y-1 bg-amber-50/30'
                                        : 'border-stone-900 shadow-[4px_4px_0_#1c1917] hover:shadow-[6px_6px_0_#1c1917] hover:-translate-y-1'
                                        }`}
                                >
                                    <div className="flex justify-between items-start gap-4">
                                        <div className="flex-1 min-w-0">
                                            <h3 className="font-black text-stone-900 text-lg uppercase leading-tight mb-3 truncate">
                                                {service.name}
                                            </h3>
                                            <div className="flex flex-wrap gap-2 items-center">
                                                {(() => {
                                                    // Map category to pastel colors (no dark backgrounds)
                                                    const getCategoryStyle = (cat: string | undefined) => {
                                                        switch (cat) {
                                                            case 'CHECK_UP':
                                                                return 'bg-amber-100 text-amber-700 border-amber-300';
                                                            case 'VACCINATION':
                                                                return 'bg-emerald-100 text-emerald-700 border-emerald-300';
                                                            case 'SURGERY':
                                                                return 'bg-rose-100 text-rose-600 border-rose-300';
                                                            case 'DENTAL':
                                                                return 'bg-sky-100 text-sky-700 border-sky-300';
                                                            case 'DERMATOLOGY':
                                                                return 'bg-violet-100 text-violet-700 border-violet-300';
                                                            case 'INTERNAL_MEDICINE':
                                                                return 'bg-indigo-100 text-indigo-700 border-indigo-300';
                                                            case 'EMERGENCY':
                                                                return 'bg-red-100 text-red-600 border-red-300';
                                                            case 'GROOMING_SPA':
                                                                return 'bg-pink-100 text-pink-600 border-pink-300';
                                                            case 'BOARDING':
                                                                return 'bg-teal-100 text-teal-700 border-teal-300';
                                                            case 'OTHER':
                                                            default:
                                                                return 'bg-stone-100 text-stone-600 border-stone-300';
                                                        }
                                                    };
                                                    const baseStyle = getCategoryStyle(service.serviceCategory);
                                                    return (
                                                        <span className={`text-[10px] font-black uppercase px-2.5 py-1 border-2 rounded-lg transition-all ${selectedServiceId === service.serviceId
                                                            ? 'bg-amber-500 text-white border-amber-600 shadow-[2px_2px_0_#d97706]'
                                                            : baseStyle
                                                            }`}>
                                                            {service.serviceCategory ? (SERVICE_CATEGORY_LABELS[service.serviceCategory] || service.serviceCategory) : 'Khác'}
                                                        </span>
                                                    );
                                                })()}
                                                <span className="text-[11px] font-bold text-stone-500 flex items-center gap-1">
                                                    <span className="w-1 h-1 rounded-full bg-stone-300" />
                                                    {service.durationTime} phút
                                                </span>
                                            </div>
                                        </div>
                                        <div className="text-right shrink-0">
                                            <div className={`font-black text-xl tracking-tight ${selectedServiceId === service.serviceId ? 'text-amber-700' : 'text-stone-900'}`}>
                                                {service.basePrice.toLocaleString()}đ
                                            </div>
                                            <div className="text-[10px] uppercase font-black text-stone-400 mt-0.5">Giá cơ bản</div>
                                        </div>
                                    </div>

                                    {/* Selected Indicator Checkmark could go here if needed */}
                                </div>
                            ))
                        )}
                    </div>
                </div>

                {/* Footer */}
                <div className="p-5 border-t-2 border-stone-100 bg-white flex flex-col sm:flex-row justify-end gap-3 shrink-0">
                    <button
                        onClick={onClose}
                        className="px-8 py-3 font-black uppercase text-sm border-2 border-stone-900 rounded-xl shadow-[3px_3px_0_#1c1917] hover:bg-stone-50 hover:-translate-y-0.5 hover:shadow-[4px_4px_0_#1c1917] active:translate-y-0.5 active:shadow-none transition-all"
                    >
                        Hủy
                    </button>
                    <button
                        onClick={() => onAddService(selectedServiceId)}
                        disabled={!selectedServiceId || isAdding}
                        className="px-8 py-3 font-black uppercase text-sm bg-amber-600 text-white border-2 border-stone-900 rounded-xl shadow-[3px_3px_0_#1c1917] hover:bg-amber-700 hover:-translate-y-0.5 hover:shadow-[4px_4px_0_#1c1917] active:translate-y-0.5 active:shadow-none transition-all disabled:opacity-40 disabled:pointer-events-none"
                    >
                        {isAdding ? 'Đang thêm...' : 'Xác nhận thêm'}
                    </button>
                </div>
            </div>
        </div>
    );
};
