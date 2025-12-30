import { useState, useEffect, useRef } from 'react';
import { locationService } from '../../services/locationService';
import type { Province, District, Ward } from '../../services/locationService';
import { BrutalSelect } from './BrutalSelect';
import { PencilSquareIcon, ListBulletIcon } from '@heroicons/react/24/outline';

interface LocationSelectorProps {
    provinceValue?: string;
    districtValue?: string;
    wardValue?: string;
    onLocationChange: (location: { province?: string; district?: string; ward?: string }) => void;
    className?: string;
}

export function LocationSelector({
    provinceValue,
    districtValue,
    wardValue,
    onLocationChange,
    className = ""
}: LocationSelectorProps) {
    const [provinces, setProvinces] = useState<Province[]>([]);
    const [districts, setDistricts] = useState<District[]>([]);
    const [wards, setWards] = useState<Ward[]>([]);

    const [selectedProvinceCode, setSelectedProvinceCode] = useState<number | 'none'>('none');
    const [selectedDistrictCode, setSelectedDistrictCode] = useState<number | 'none'>('none');
    const [selectedWardCode, setSelectedWardCode] = useState<number | 'none'>('none');

    const [isManualProvince, setIsManualProvince] = useState(false);
    const [isManualDistrict, setIsManualDistrict] = useState(false);
    const [isManualWard, setIsManualWard] = useState(false);

    // Track original values from Map/API to distinguish from user typing
    const lastExternalProvince = useRef('');
    const lastExternalDistrict = useRef('');
    const lastExternalWard = useRef('');

    // Helper to normalize and compare Vietnamese area names
    const normalize = (s: string) => {
        if (!s) return '';
        return s.toLowerCase()
            .replace(/^(phường|xã|quận|huyện|tỉnh|thành phố|thành phố trực thuộc trung ương|thị xã|tp\.|q\.|h\.|p\.|x\.)\s+/i, '')
            .trim()
            .normalize("NFC");
    };

    const isMatch = (apiName: string, value: string) => {
        if (!apiName || !value) return false;
        const nApi = normalize(apiName);
        const nValue = normalize(value);
        return nApi === nValue; // Use strict exact match for auto-syncing
    };

    // Initial fetch of provinces
    useEffect(() => {
        locationService.getProvinces().then(setProvinces).catch(console.error);
    }, []);

    // Sync Province
    useEffect(() => {
        if (provinces.length > 0 && provinceValue && provinceValue !== lastExternalProvince.current) {
            lastExternalProvince.current = provinceValue;
            const found = provinces.find(p => isMatch(p.name, provinceValue));
            if (found) {
                setSelectedProvinceCode(found.code);
                setIsManualProvince(false);
                locationService.getDistricts(found.code).then(setDistricts).catch(console.error);
            } else {
                setIsManualProvince(true);
            }
        }
    }, [provinceValue, provinces]);

    // Sync District
    useEffect(() => {
        if (districts.length > 0 && districtValue && districtValue !== lastExternalDistrict.current) {
            lastExternalDistrict.current = districtValue;
            const found = districts.find(d => isMatch(d.name, districtValue));
            if (found) {
                setSelectedDistrictCode(found.code);
                setIsManualDistrict(false);
                locationService.getWards(found.code).then(setWards).catch(console.error);
            } else {
                setIsManualDistrict(true);
            }
        }
    }, [districtValue, districts]);

    // Sync Ward
    useEffect(() => {
        if (wards.length > 0 && wardValue && wardValue !== lastExternalWard.current) {
            lastExternalWard.current = wardValue;
            const found = wards.find(w => isMatch(w.name, wardValue));
            if (found) {
                setSelectedWardCode(found.code);
                setIsManualWard(false);
            } else {
                setIsManualWard(true);
            }
        }
    }, [wardValue, wards]);

    // Handlers
    const handleProvinceChange = async (code: number | 'none') => {
        setSelectedProvinceCode(code);
        setSelectedDistrictCode('none');
        setSelectedWardCode('none');
        if (code !== 'none') {
            const p = provinces.find(item => item.code === code);
            lastExternalProvince.current = p?.name || '';
            onLocationChange({ province: p?.name, district: undefined, ward: undefined });
            const data = await locationService.getDistricts(code);
            setDistricts(data);
        }
    };

    const handleDistrictChange = async (code: number | 'none') => {
        setSelectedDistrictCode(code);
        setSelectedWardCode('none');
        if (code !== 'none') {
            const p = provinces.find(item => item.code === selectedProvinceCode as number);
            const d = districts.find(item => item.code === code);
            lastExternalDistrict.current = d?.name || '';
            onLocationChange({ province: p?.name, district: d?.name, ward: undefined });
            const data = await locationService.getWards(code);
            setWards(data);
        }
    };

    const handleWardChange = (code: number | 'none') => {
        setSelectedWardCode(code);
        if (code !== 'none') {
            const w = wards.find(item => item.code === code);
            lastExternalWard.current = w?.name || '';
            onLocationChange({ ...getCurrentLocation(), ward: w?.name });
        }
    };

    const getCurrentLocation = () => {
        const p = isManualProvince ? provinceValue : provinces.find(x => x.code === selectedProvinceCode)?.name;
        const d = isManualDistrict ? districtValue : districts.find(x => x.code === selectedDistrictCode)?.name;
        const w = isManualWard ? wardValue : wards.find(x => x.code === selectedWardCode)?.name;
        return { province: p, district: d, ward: w };
    };

    return (
        <div className={`grid grid-cols-1 md:grid-cols-3 gap-4 ${className}`}>
            {/* PROVINCE */}
            <div className="relative">
                <div className="flex justify-between items-center mb-1 px-1">
                    <label className="text-xs font-black uppercase text-stone-500">Tỉnh / Thành phố</label>
                    <button
                        type="button"
                        onClick={() => setIsManualProvince(!isManualProvince)}
                        className="text-[10px] font-bold text-amber-700 hover:underline flex items-center gap-1"
                    >
                        {isManualProvince ? <ListBulletIcon className="w-3 h-3" /> : <PencilSquareIcon className="w-3 h-3" />}
                        {isManualProvince ? "Chọn danh sách" : "Nhập tay"}
                    </button>
                </div>
                {isManualProvince ? (
                    <input
                        type="text"
                        value={provinceValue || ''}
                        onChange={(e) => onLocationChange({ ...getCurrentLocation(), province: e.target.value })}
                        className="input-brutal w-full bg-white font-bold"
                        placeholder="Nhập tỉnh/thành"
                    />
                ) : (
                    <BrutalSelect
                        placeholder="-- Chọn Tỉnh/Thành --"
                        value={selectedProvinceCode}
                        options={provinces.map(p => ({ id: p.code, label: p.name }))}
                        onChange={(val) => handleProvinceChange(val === 'none' ? 'none' : Number(val))}
                    />
                )}
            </div>

            {/* DISTRICT */}
            <div className="relative">
                <div className="flex justify-between items-center mb-1 px-1">
                    <label className="text-xs font-black uppercase text-stone-500">Quận / Huyện</label>
                    <button
                        type="button"
                        onClick={() => setIsManualDistrict(!isManualDistrict)}
                        className="text-[10px] font-bold text-amber-700 hover:underline flex items-center gap-1"
                    >
                        {isManualDistrict ? <ListBulletIcon className="w-3 h-3" /> : <PencilSquareIcon className="w-3 h-3" />}
                        {isManualDistrict ? "Chọn danh sách" : "Nhập tay"}
                    </button>
                </div>
                {isManualDistrict ? (
                    <input
                        type="text"
                        value={districtValue || ''}
                        onChange={(e) => onLocationChange({ ...getCurrentLocation(), district: e.target.value })}
                        className="input-brutal w-full bg-white font-bold"
                        placeholder="Nhập quận/huyện"
                    />
                ) : (
                    <BrutalSelect
                        placeholder="-- Chọn Quận/Huyện --"
                        value={selectedDistrictCode}
                        disabled={selectedProvinceCode === 'none'}
                        options={districts.map(d => ({ id: d.code, label: d.name }))}
                        onChange={(val) => handleDistrictChange(val === 'none' ? 'none' : Number(val))}
                    />
                )}
            </div>

            {/* WARD */}
            <div className="relative">
                <div className="flex justify-between items-center mb-1 px-1">
                    <label className="text-xs font-black uppercase text-stone-500">Phường / Xã</label>
                    <button
                        type="button"
                        onClick={() => setIsManualWard(!isManualWard)}
                        className="text-[10px] font-bold text-amber-700 hover:underline flex items-center gap-1"
                    >
                        {isManualWard ? <ListBulletIcon className="w-3 h-3" /> : <PencilSquareIcon className="w-3 h-3" />}
                        {isManualWard ? "Chọn danh sách" : "Nhập tay"}
                    </button>
                </div>
                {isManualWard ? (
                    <input
                        type="text"
                        value={wardValue || ''}
                        onChange={(e) => {
                            // When user is typing, we ONLY update the parent, NOT our internal pointers
                            onLocationChange({ ...getCurrentLocation(), ward: e.target.value });
                        }}
                        className="input-brutal w-full bg-white font-bold"
                        placeholder="Nhập phường/xã"
                    />
                ) : (
                    <BrutalSelect
                        placeholder="-- Chọn Phường/Xã --"
                        value={selectedWardCode}
                        disabled={selectedDistrictCode === 'none'}
                        options={wards.map(w => ({ id: w.code, label: w.name }))}
                        onChange={(val) => handleWardChange(val === 'none' ? 'none' : Number(val))}
                    />
                )}
            </div>
        </div>
    );
}
