# Service Species Filter - Web Implementation

**Date**: 2026-03-02
**Feature**: Filter services theo pet species trong AddServiceModal
**Backend API**: `GET /services/by-clinic/{clinicId}/compatible?petSpecies={species}&isHomeVisit={boolean}`

---

## Changes Made

### 1. New Type Definitions (`src/types/pet.ts`)
```typescript
// PetSpecies enum matching backend
export type PetSpecies = 'DOG' | 'CAT' | 'BIRD' | 'RABBIT' | 'HAMSTER' | 'FISH' | 'OTHER';

// Vietnamese labels
export const PET_SPECIES_LABELS: Record<PetSpecies, string> = {
  DOG: 'Chó',
  CAT: 'Mèo',
  BIRD: 'Chim',
  RABBIT: 'Thỏ',
  HAMSTER: 'Chuột Hamster',
  FISH: 'Cá',
  OTHER: 'Khác',
};
```

### 2. New API Method (`src/services/endpoints/service.ts`)
```typescript
/**
 * Get compatible services filtered by pet species and booking type
 * GET /api/services/by-clinic/{clinicId}/compatible?petSpecies={species}&isHomeVisit={boolean}
 */
export async function getCompatibleServices(
  clinicId: string,
  petSpecies?: string,
  isHomeVisit?: boolean,
): Promise<ClinicServiceResponse[]>
```

**Parameters:**
- `clinicId`: ID phòng khám
- `petSpecies`: Loài thú cưng (DOG, CAT, BIRD, etc.)
- `isHomeVisit`: `true` nếu booking type là HOME_VISIT hoặc SOS

**Backward Compatibility:**
- Endpoint cũ `/bookings/{bookingId}/available-add-ons` vẫn hoạt động bình thường
- Code cũ không bị breaking

---

### 3. Updated AddServiceModal (`src/components/booking/AddServiceModal.tsx`)

**Before:**
```typescript
interface AddServiceModalProps {
    availableServices: ClinicServiceResponse[]; // Pass services từ parent
}
```

**After:**
```typescript
interface AddServiceModalProps {
    booking: Booking; // Pass full booking object
    // Modal tự fetch services based on species + type
}
```

**Key Changes:**
1. ✅ Modal tự động gọi API `getCompatibleServices()` khi mở
2. ✅ Extract `petSpecies` từ `booking.petSpecies`
3. ✅ Detect `isHomeVisit = booking.type === 'HOME_VISIT' || booking.type === 'SOS'`
4. ✅ Hiển thị loading state khi fetch
5. ✅ Hiển thị empty state với thông báo loài thú cưng nếu không có services

**User Experience:**
- **Loading**: "Đang tải dịch vụ phù hợp..."
- **Empty State**: "Không có dịch vụ phù hợp cho chó/mèo/..."

---

### 4. Updated Parent Components

#### `src/pages/staff/StaffBookingsPage.tsx`
**Before:**
```typescript
const [availableServices, setAvailableServices] = useState<ClinicServiceResponse[]>([]);

const handleOpenAddServiceModal = async () => {
    const services = await getAvailableServicesForAddOn(bookingId);
    setAvailableServices(services);
    setAddServiceModalOpen(true);
};

<AddServiceModal availableServices={availableServices} ... />
```

**After:**
```typescript
// Removed availableServices state

const handleOpenAddServiceModal = () => {
    setAddServiceModalOpen(true); // Chỉ mở modal, không fetch
};

{selectedBooking && (
    <AddServiceModal booking={selectedBooking} ... />
)}
```

#### `src/pages/clinic-manager/bookings/BookingDashboardPage.tsx`
- Same changes as StaffBookingsPage
- Added `type StaffOption` import to fix TypeScript error

**Removed Imports:**
- ❌ `getAvailableServicesForAddOn` (không dùng nữa)
- ❌ `ClinicServiceResponse` import (không cần trong parent)

---

## API Flow

### Old Flow (Backward Compatible)
```
User clicks "Thêm dịch vụ"
  → Parent gọi getAvailableServicesForAddOn(bookingId)
  → Backend filter services theo Staff specialty (HomeVisit)
  → Trả về services
  → Parent pass services vào modal
```

### New Flow (Species Filter)
```
User clicks "Thêm dịch vụ"
  → Parent mở modal, pass booking object
  → Modal extract: petSpecies, type (isHomeVisit)
  → Modal gọi getCompatibleServices(clinicId, petSpecies, isHomeVisit)
  → Backend filter services theo:
     - Species compatibility (ví dụ: Chó không dùng dịch vụ cá cảnh)
     - Home visit support
  → Trả về services phù hợp
  → Modal render services
```

---

## Multi-Pet Booking Support (Future)

**Hiện tại**: Modal sử dụng `booking.petSpecies` (primary pet)

**Tương lai** (nếu có multi-pet booking):
- Modal có thể thêm tabs/dropdown để chọn pet
- Mỗi khi chọn pet khác → gọi lại `getCompatibleServices()` với species mới
- Flow tương tự, chỉ thay đổi `petSpecies` parameter

**Example Pattern:**
```typescript
const [selectedPetId, setSelectedPetId] = useState<string>(booking.petId);

// Fetch lại khi chọn pet khác
useEffect(() => {
  const selectedPet = booking.pets.find(p => p.petId === selectedPetId);
  fetchServices(booking.clinicId, selectedPet.species, isHomeVisit);
}, [selectedPetId]);
```

---

## Testing Checklist

- [x] Build thành công (`npm run build`)
- [x] TypeScript compilation thành công
- [ ] Manual test: Mở AddServiceModal với booking chó → chỉ thấy services cho chó
- [ ] Manual test: Mở AddServiceModal với booking mèo → chỉ thấy services cho mèo
- [ ] Manual test: Booking HOME_VISIT → chỉ thấy services support home visit
- [ ] Manual test: Booking IN_CLINIC → thấy cả in-clinic services
- [ ] Manual test: Empty state hiển thị đúng khi không có services
- [ ] Backward compatibility: Các page khác vẫn dùng getAvailableServicesForAddOn vẫn hoạt động

---

## Files Changed

```
petties-web/
├── src/
│   ├── types/
│   │   └── pet.ts                                     [NEW]
│   ├── services/
│   │   └── endpoints/
│   │       └── service.ts                            [UPDATED] +getCompatibleServices()
│   ├── components/
│   │   └── booking/
│   │       └── AddServiceModal.tsx                   [UPDATED] Auto-fetch, species filter
│   └── pages/
│       ├── staff/
│       │   └── StaffBookingsPage.tsx                 [UPDATED] Removed manual fetch
│       └── clinic-manager/
│           └── bookings/
│               └── BookingDashboardPage.tsx          [UPDATED] Removed manual fetch, fix import
```

---

## Next Steps (Optional Enhancements)

1. **Better Empty State**: Hiển thị suggestions (ví dụ: "Liên hệ admin để thêm dịch vụ cho loài này")
2. **Loading Skeleton**: Thay vì spinner, dùng skeleton cards cho UX mượt hơn
3. **Species Icons**: Thêm icons cho từng loài thú cưng trong empty state
4. **Error Handling**: Retry button nếu API call fails
5. **Multi-Pet Support**: Tabs để chọn pet trong modal (nếu booking có nhiều pets)
6. **Analytics**: Track số lần không tìm thấy services phù hợp (để phòng khám biết cần thêm services)

---

## Notes

- **Neobrutalism Design**: Modal UI giữ nguyên design system (rounded corners, brutalist shadows, uppercase labels)
- **Vietnamese Text**: Tất cả user-facing text bằng tiếng Việt
- **Performance**: Modal chỉ fetch 1 lần khi mở, không refetch khi search/filter local
- **Type Safety**: Tất cả types được define đầy đủ, không dùng `any`
