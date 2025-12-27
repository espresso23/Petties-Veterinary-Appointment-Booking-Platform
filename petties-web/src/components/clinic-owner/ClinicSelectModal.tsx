import { useEffect, useState } from 'react';
import { getMyClinics } from '../../services/endpoints/clinic';
import type { ClinicResponse } from '../../services/endpoints/clinic';
import { XMarkIcon } from '@heroicons/react/24/solid';

export interface ClinicApplyItem {
  clinicId: string
  name?: string
  clinicPricePerKm?: number | null
  // saveAsDefault left for future use if backend supports persisting
  saveAsDefault?: boolean
}

interface ClinicSelectModalProps {
  isOpen: boolean;
  onClose: () => void;
  // return selected clinics with optional per-km overrides
  onApply: (clinics: ClinicApplyItem[]) => void;
}

export function ClinicSelectModal({ isOpen, onClose, onApply }: ClinicSelectModalProps) {
  const [clinics, setClinics] = useState<ClinicResponse[]>([]);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(false);
  // no inputs here; price will be auto-determined by backend or existing services

  useEffect(() => {
    if (isOpen) {
      setSelectedIds(new Set());
      (async () => {
        setLoading(true)
        try {
          const data = await getMyClinics()
          setClinics(data)
        } catch (err) {
          // log and show empty list
          // eslint-disable-next-line no-console
          console.error('Failed to load clinics in modal', err)
          setClinics([])
        } finally {
          setLoading(false)
        }
      })()
    }
  }, [isOpen]);

  const handleToggle = (id: string) => {
    setSelectedIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/30 backdrop-blur-sm">
      <div className="bg-white border-4 border-black shadow-[12px_12px_0_0_#1c1917] max-w-lg w-full p-8 relative">
        <button onClick={onClose} className="absolute top-4 right-4 w-10 h-10 flex items-center justify-center bg-black text-white border-2 border-black hover:bg-gray-800 transition-all">
          <XMarkIcon className="w-6 h-6" />
        </button>
        <h2 className="text-2xl font-black uppercase mb-6">Chọn phòng khám để áp dụng</h2>
        {loading ? (
          <div className="text-center py-8 font-bold">Đang tải...</div>
        ) : clinics.length === 0 ? (
          <div className="text-center py-8 font-bold text-gray-500">Không có phòng khám nào</div>
        ) : (
          <div className="space-y-3 max-h-72 overflow-y-auto mb-6">
            {clinics.map(clinic => (
              <div key={clinic.clinicId} className="p-3 border-2 border-black bg-gray-50">
                <label className="flex items-center gap-3 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={selectedIds.has(clinic.clinicId)}
                    onChange={() => handleToggle(clinic.clinicId)}
                    className="w-5 h-5 border-2 border-black accent-green-600"
                  />
                  <div className="flex-1">
                    <div className="font-bold text-black">{clinic.name}</div>
                    <div className="text-xs text-gray-500">{clinic.address}</div>
                  </div>
                </label>
              </div>
            ))}
          </div>
        )}
        <button
          onClick={() => {
            const result: ClinicApplyItem[] = clinics
              .filter(c => selectedIds.has(c.clinicId))
              .map(c => ({
                clinicId: c.clinicId,
                name: c.name,
              }))
            onApply(result)
          }}
          disabled={selectedIds.size === 0}
          className="w-full py-3 mt-2 bg-green-600 text-white font-black uppercase border-4 border-black shadow-[4px_4px_0_0_#1c1917] hover:shadow-none hover:translate-x-1 hover:translate-y-1 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
        >
          Áp dụng cho {selectedIds.size} phòng khám
        </button>
      </div>
    </div>
  );
}
