# Frontend Web Refactor Summary: Vet → Staff Naming

**Date:** 2026-01-27
**Agent ID:** a1d547f (continued)
**Context:** Backend đã hoàn toàn refactor từ Vet → Staff naming. Frontend Web cần sync.

---

## ✅ COMPLETED (Session 1)

### 1. Types
- ✅ `types/vetshift.ts` → `types/staffshift.ts`
  - Renamed interfaces: `VetShiftResponse` → `StaffShiftResponse`
  - Renamed interfaces: `VetShiftRequest` → `StaffShiftRequest`
  - Renamed fields: `vetId` → `staffId`, `vetName` → `staffName`, `vetAvatar` → `staffAvatar`

### 2. Booking Types
- ✅ `types/booking.ts` - Updated interfaces:
  - `AvailableVetResponse` → `AvailableStaffResponse`
  - `ReassignVetRequest` → `ReassignStaffRequest`
  - `VetAvailabilityCheckResponse` → `StaffAvailabilityCheckResponse`
  - `ServiceAvailability`: `hasAvailableVet` → `hasAvailableStaff`, `suggestedVetId` → `suggestedStaffId`, etc.
  - `AlternativeTimeSlot`: `vetName` → `staffName`, `vetId` → `staffId`

### 3. Services
- ✅ `services/api/vetShiftService.ts` → `services/api/staffShiftService.ts`
  - Renamed export: `vetShiftService` → `staffShiftService`
  - Updated imports from `types/vetshift` → `types/staffshift`
  - Comments updated: "vet shifts" → "staff shifts", "vet" → "staff"

- ✅ `services/bookingService.ts` - Updated API endpoints và interfaces:
  - `getBookingsByVet()` → `getBookingsByStaff()`
  - `checkVetAvailability()` → `checkStaffAvailability()`
  - `getAvailableVetsForReassign()` → `getAvailableStaffForReassign()`
  - `reassignVetForService()` → `reassignStaffForService()`
  - `getAvailableVetsForConfirm()` → `getAvailableStaffForConfirm()`
  - Interface: `VetOption` → `StaffOption`
  - API paths updated:
    - `/bookings/vet/{id}` → `/bookings/staff/{id}`
    - `/bookings/{id}/check-vet-availability` → `/bookings/{id}/check-staff-availability`
    - `/bookings/{id}/services/{id}/available-vets` → `/bookings/{id}/services/{id}/available-staff`
    - `/bookings/{id}/services/{id}/reassign` → `/bookings/{id}/services/{id}/reassign-staff`
    - `/bookings/{id}/available-vets-for-confirm` → `/bookings/{id}/available-staff-for-confirm`

### 4. Components
- ✅ `components/booking/ReassignVetModal.tsx` → `components/booking/ReassignStaffModal.tsx`
  - Component renamed: `ReassignVetModal` → `ReassignStaffModal`
  - Props interface: `ReassignVetModalProps` → `ReassignStaffModalProps`
  - State variables: `availableVets` → `availableStaff`, `selectedVetId` → `selectedStaffId`
  - Functions: `fetchAvailableVets()` → `fetchAvailableStaff()`
  - UI text: "bác sĩ" → "nhân viên"
  - Imports updated to use `AvailableStaffResponse`, `getAvailableStaffForReassign()`, `reassignStaffForService()`

- ✅ `components/booking/VetAvailabilityWarningModal.tsx` → `components/booking/StaffAvailabilityWarningModal.tsx`
  - Component renamed: `VetAvailabilityWarningModal` → `StaffAvailabilityWarningModal`
  - Props interface: `VetAvailabilityWarningModalProps` → `StaffAvailabilityWarningModalProps`
  - Imports: `VetAvailabilityCheckResponse` → `StaffAvailabilityCheckResponse`
  - Variables: `hasAvailableVet` → `hasAvailableStaff`
  - UI text: "bác sĩ" → "nhân viên", "Đã gán BS" → "Đã gán NV"
  - Field usage: `suggestedVetName` → `suggestedStaffName`, `vetName` → `staffName`

---

## ⏳ REMAINING (To be completed)

### 5. Layouts
**❌ NOT RENAMED YET:**
- `layouts/VetLayout.tsx` → **NEEDS RENAME TO** `layouts/StaffLayout.tsx`
  - Component name: `VetLayout` → `StaffLayout`
  - Export: `export const VetLayout` → `export const StaffLayout`
  - Comment: `// For VETERINARIAN role` → `// For STAFF role`
  - roleName prop: `roleName="VETERINARIAN"` → `roleName="STAFF"`
  - Variable names: `assignedBookingCount` (keep as-is), `refreshAssignedBookingCount()` (keep as-is)

### 6. Pages - Staff (formerly Vet)
**❌ FOLDER NOT RENAMED YET:**
- `pages/vet/` → **NEEDS RENAME TO** `pages/staff/`

**Files in pages/vet/ that need to be moved to pages/staff/:**

#### 6.1. Main Pages
- `VetSchedulePage.tsx` → **RENAME TO** `StaffSchedulePage.tsx`
  - Import: `vetShiftService` → `staffShiftService`
  - Import types from: `types/vetshift` → `types/staffshift`
  - Component: `VetSchedulePage` → `StaffSchedulePage`
  - State variables: `shifts: VetShiftResponse[]` → `shifts: StaffShiftResponse[]`
  - State variables: `selectedShift: VetShiftResponse` → `selectedShift: StaffShiftResponse`
  - State variables: `shiftDetail: VetShiftResponse` → `shiftDetail: StaffShiftResponse`
  - State variables: `dayViewShifts: VetShiftResponse[]` → `dayViewShifts: StaffShiftResponse[]`
  - Variables: `vetId` → `staffId` (lines 106)
  - Function calls: `vetShiftService.getMyShifts()` → `staffShiftService.getMyShifts()`
  - Function calls: `vetShiftService.getShiftDetail()` → `staffShiftService.getShiftDetail()`
  - Comments: "Vets to view" → "Staff to view", "bác sĩ" trong comments → "nhân viên"
  - Navigate paths: `/vet/bookings` → `/staff/bookings` (line 414)
  - UI text fields: `vetAvatar`, `vetName` (keep as-is - backend DTO fields)
  - **Keep sidebar text "Bác sĩ phụ trách", "Bác sĩ chuyên khoa" as-is** (Petties business term)

- `VetBookingsPage.tsx` → **RENAME TO** `StaffBookingsPage.tsx`
  - Import: `getBookingsByVet` → `getBookingsByStaff`
  - Component: `VetBookingsPage` → `StaffBookingsPage`
  - Variables: `vetId` → `staffId`
  - Function calls: `getBookingsByVet(vetId)` → `getBookingsByStaff(staffId)`

- `patients/VetPatientsPage.tsx` → **RENAME TO** `patients/StaffPatientsPage.tsx`
  - Component: `VetPatientsPage` → `StaffPatientsPage`

#### 6.2. Other Pages (NO RENAME NEEDED, just folder move)
- `DashboardPage.tsx` - Component name: `VetDashboardPage` (keep as-is for now, not part of core refactor)
- `NotificationsPage.tsx` - Generic component (no rename needed)
- `emr/CreateEmrPage.tsx` - No vet-specific naming
- `emr/EditEmrPage.tsx` - No vet-specific naming
- `emr/EmrDetailPage.tsx` - No vet-specific naming
- `vaccine/VaccinationPage.tsx` - No vet-specific naming

#### 6.3. Index Exports
- `pages/staff/index.ts` - Update exports:
  ```ts
  export { VetDashboardPage } from './DashboardPage'
  export { StaffSchedulePage } from './StaffSchedulePage'  // was VetSchedulePage
  export { StaffBookingsPage } from './StaffBookingsPage'  // was VetBookingsPage
  export { CreateEmrPage } from './emr/CreateEmrPage'
  export { EmrDetailPage } from './emr/EmrDetailPage'
  export { StaffPatientsPage } from './patients/StaffPatientsPage'  // was VetPatientsPage
  export { EditEmrPage } from './emr/EditEmrPage'
  ```

- `pages/staff/patients/index.ts`:
  ```ts
  export { StaffPatientsPage } from './StaffPatientsPage'  // was VetPatientsPage
  ```

### 7. Pages - Clinic Manager
**❌ FOLDER NOT RENAMED YET:**
- `pages/clinic-manager/vets/` → **NEEDS RENAME TO** `pages/clinic-manager/staff/`

**Files that need renaming:**
- `vets/VetsManagementPage.tsx` → **RENAME TO** `staff/StaffManagementPage.tsx`
  - Component: `VetsManagementPage` → `StaffManagementPage`
  - State variables, function names: update "vet" → "staff"
  - Import clinicStaffService calls (if any)

- `shifts/VetShiftPage.tsx` → **RENAME TO** `shifts/StaffShiftPage.tsx`
  - Import: `vetShiftService` → `staffShiftService`
  - Import types: `VetShiftRequest`, `VetShiftResponse` → `StaffShiftRequest`, `StaffShiftResponse`
  - State variables: `shifts: VetShiftResponse[]` → `shifts: StaffShiftResponse[]`
  - Variables: `selectedVet` → `selectedStaff`, `vetId` → `staffId`
  - Function calls: `vetShiftService.*` → `staffShiftService.*`

### 8. Update Imports in Other Files
**Files that import renamed components/services:**

- ✅ `pages/clinic-manager/bookings/BookingDashboardPage.tsx`
  - ❌ Update import: `ReassignVetModal` → `ReassignStaffModal`
  - ❌ Update import: `VetAvailabilityWarningModal` → `StaffAvailabilityWarningModal`
  - ❌ Update function call: `checkVetAvailability()` → `checkStaffAvailability()`
  - ❌ Update state type: `VetAvailabilityCheckResponse` → `StaffAvailabilityCheckResponse`

- `pages/vet/__tests__/VetSchedulePage.test.tsx` → **NEEDS UPDATE**
  - Import: `vetShiftService` → `staffShiftService`
  - Import types: `VetShiftResponse` → `StaffShiftResponse`

- `pages/vet/__tests__/VetBookingsPage.test.tsx` → **NEEDS UPDATE**
  - Update test imports if they use renamed services

### 9. App.tsx - Routes
**❌ NOT UPDATED YET:**

Current:
```tsx
import { VetLayout } from './layouts/VetLayout'
import { VetDashboardPage, VetSchedulePage, VetBookingsPage, VetPatientsPage, ... } from './pages/vet'
import { VetsManagementPage } from './pages/clinic-manager/vets'
import { VetShiftPage } from './pages/clinic-manager/shifts/VetShiftPage'

<Route path="/staff" element={
  <ProtectedRoute allowedRoles={['STAFF']}>
    <VetLayout />  {/* ❌ Should be StaffLayout */}
  </ProtectedRoute>
}>
  <Route index element={<VetDashboardPage />} />
  <Route path="schedule" element={<VetSchedulePage />} />  {/* ❌ Should be StaffSchedulePage */}
  <Route path="bookings" element={<VetBookingsPage />} />  {/* ❌ Should be StaffBookingsPage */}
  <Route path="patients" element={<VetPatientsPage />} />  {/* ❌ Should be StaffPatientsPage */}
  ...
</Route>

<Route path="/clinic-manager" element={...}>
  <Route path="vets" element={<VetsManagementPage />} />  {/* ❌ Should be staff path */}
  <Route path="shifts" element={<VetShiftPage />} />  {/* ❌ Should be StaffShiftPage */}
</Route>
```

**Needs to be:**
```tsx
import { StaffLayout } from './layouts/StaffLayout'
import { VetDashboardPage, StaffSchedulePage, StaffBookingsPage, StaffPatientsPage, ... } from './pages/staff'
import { StaffManagementPage } from './pages/clinic-manager/staff'
import { StaffShiftPage } from './pages/clinic-manager/shifts/StaffShiftPage'

<Route path="/staff" element={
  <ProtectedRoute allowedRoles={['STAFF']}>
    <StaffLayout />
  </ProtectedRoute>
}>
  <Route index element={<VetDashboardPage />} />
  <Route path="schedule" element={<StaffSchedulePage />} />
  <Route path="bookings" element={<StaffBookingsPage />} />
  <Route path="patients" element={<StaffPatientsPage />} />
  ...
</Route>

<Route path="/clinic-manager" element={...}>
  <Route path="staff" element={<StaffManagementPage />} />
  <Route path="shifts" element={<StaffShiftPage />} />
</Route>
```

---

## 🔧 Manual Steps Required (Windows Permission Issues)

Due to Windows file permission restrictions, the following steps need to be done **manually in VS Code or File Explorer**:

### Step 1: Rename Folder
1. In VS Code, right-click `petties-web/src/pages/vet/` → Rename → `staff`
2. In VS Code, right-click `petties-web/src/pages/clinic-manager/vets/` → Rename → `staff`

### Step 2: Rename Files
**In `pages/staff/`:**
1. `VetSchedulePage.tsx` → `StaffSchedulePage.tsx`
2. `VetBookingsPage.tsx` → `StaffBookingsPage.tsx`
3. `patients/VetPatientsPage.tsx` → `patients/StaffPatientsPage.tsx`

**In `layouts/`:**
1. `VetLayout.tsx` → `StaffLayout.tsx`

**In `pages/clinic-manager/`:**
1. `staff/VetsManagementPage.tsx` → `staff/StaffManagementPage.tsx`
2. `shifts/VetShiftPage.tsx` → `shifts/StaffShiftPage.tsx`

### Step 3: Update File Contents
After renaming files, update their contents following the patterns in **Section 5-9** above.

### Step 4: Run Search & Replace in VS Code
**Search patterns:**
1. `import.*vetShiftService.*from.*vetShiftService` → Replace with `staffShiftService` import
2. `import.*VetShiftResponse.*from.*types/vetshift` → Replace with `StaffShiftResponse` from `types/staffshift`
3. `vetShiftService\.` → `staffShiftService.`
4. `: VetShiftResponse` → `: StaffShiftResponse`
5. `const.*vetId` → `const staffId` (be careful with context)

---

## ✅ Verification Checklist

After completing manual steps, verify:

- [ ] All imports from `types/vetshift` are now `types/staffshift`
- [ ] All `vetShiftService` calls are now `staffShiftService`
- [ ] All `VetLayout` imports are now `StaffLayout`
- [ ] All route paths `/vet` are now `/staff` (in navigate calls)
- [ ] `App.tsx` uses `StaffLayout`, `StaffSchedulePage`, `StaffBookingsPage`, `StaffPatientsPage`
- [ ] `BookingDashboardPage.tsx` uses `ReassignStaffModal` and `StaffAvailabilityWarningModal`
- [ ] TypeScript compilation succeeds: `npm run build`
- [ ] ESLint passes: `npm run lint`
- [ ] Dev server runs without errors: `npm run dev`

---

## 📝 Notes

- **Backend DTOs still use `vetId`, `vetName`, `vetAvatar` fields** - These are backend response fields and should NOT be renamed in frontend code (they map to backend DTOs).
- **UI text** like "Bác sĩ phụ trách" can remain as-is since "Bác sĩ" is the business term in Vietnamese for medical professionals (Petties context).
- **STAFF_SPECIALTY_LABELS** enum already uses generic labels (not "Vet" specific).
- **API endpoints** have all been updated in backend, frontend service layer matches.

---

**Next Session:** Continue from Step 1 (manual folder rename) and apply all changes in Sections 5-9.
