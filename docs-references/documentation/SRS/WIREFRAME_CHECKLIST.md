# Wireframe Generation Checklist

This document tracks the generation of black & white wireframes for the Petties SRS documentation, aligned with implemented features.
**Style Constraint:** Strictly monochrome (Black/White/Gray).
**Status Legend:**
- [x] : Wireframe Generated (Stitch ID recorded)
- [ ] : Implemented in Code, Waiting for Wireframe
- [-] : Not Implemented yet (Out of scope for now)

## 📱 Petties Mobile (Project ID: `875246162632064109`)

### Authentication (Module 3.2)
- [x] **Login Screen** (UC-AUTH-02)
  - Code: `login_screen.dart`
  - Stitch ID: `316370f46ea94ee78d2138a66165cef3`
- [ ] **Register Screen** (UC-AUTH-01)
  - Code: `register_screen.dart`
- [ ] **Forgot Password Screen** (UC-AUTH-01b)
  - Code: `forgot_password_screen.dart`
- [ ] **Reset Password Screen** (UC-AUTH-01b)
  - Code: `reset_password_screen.dart`

### Pet Owner Features (Module 3.4, 3.5, 3.8)
- [x] **Home Screen** (Dashboard)
  - Code: `pet_owner_home_screen.dart`
  - Stitch ID: `97f0d0ca8d734addb0f10acae7530bad`
- [ ] **My Pets List** (UC-PET-01)
  - Code: `pet_list_screen.dart`
- [x] **Pet Detail Screen** (UC-PET-01)
  - Code: `pet_detail_screen.dart`
  - Stitch ID: `dbb245dbb84849d2aef20fe66c2c42e7`
- [ ] **Add/Edit Pet Screen** (UC-PET-01)
  - Code: `add_edit_pet_screen.dart`
- [ ] **Clinic Search Screen** (UC-CLINIC-01)
  - Code: `clinic_search_view.dart`
  - *Prompt Prepared in `wireframe_prompts.md`*
- [ ] **Clinic Detail Screen** (UC-CLINIC-02)
  - Code: `clinic_detail_view.dart`
- [ ] **Clinic Map View**
  - Code: `clinic_map_view.dart`
- [ ] **Clinic Services Screen**
  - Code: `clinic_all_services_screen.dart`

---

## 💻 Petties Web (Project ID: `5753470864620675867`)

### Staff Features (Module 3.7, 3.8, 3.9)
- [ ] **Staff Dashboard** (UC-BOOK-10)
  - Code: `staff/DashboardPage.tsx`
- [ ] **Staff Schedule** (UC-SCHED-01)
  - Code: `staff/StaffSchedulePage.tsx`
  - *Prompt Prepared in `wireframe_prompts.md`*
- [x] **Assigned Bookings List** (UC-BOOK-06)
  - Code: `staff/StaffBookingsPage.tsx`
  - Stitch ID: `0595f1cdc9714ab990fcab59851583b5`
- [ ] **Patient List** (UC-EMR-04)
  - Code: `staff/patients/StaffPatientsPage.tsx`
- [ ] **EMR Detail** (UC-EMR-01)
  - Code: `staff/emr/EmrDetailPage.tsx`
- [ ] **Create EMR** (UC-EMR-01)
  - Code: `staff/emr/CreateEmrPage.tsx`
- [ ] **Notifications**
  - Code: `staff/NotificationsPage.tsx`

### Clinic Owner Features (Module 3.6, 3.7)
- [x] **Owner Dashboard** (UC-OPS-05)
  - Code: `clinic-owner/DashboardPage.tsx`
  - Stitch ID: `c03c1300bee7481fbb6615e13bb50551`
- [ ] **My Clinics List** (UC-OPS-01)
  - Code: `clinic-owner/clinics/ClinicsListPage.tsx`
- [ ] **Clinic Detail** (UC-OPS-01)
  - Code: `clinic-owner/clinics/ClinicDetailPage.tsx`
- [ ] **Master Services** (UC-OPS-04)
  - Code: `clinic-owner/MasterServicesPage.tsx`
- [ ] **Clinic Services** (UC-OPS-02)
  - Code: `clinic-owner/ServicesPage.tsx`
- [ ] **Staff Management** (UC-SCHED-06)
  - Code: `clinic-owner/staff/StaffManagementPage.tsx`

### Admin Features (Module 3.12)
*(Pending Verification of implemented Admin pages)*
- [ ] **Admin Dashboard** (UC-GOV-03)
  - Code: `admin/DashboardPage.tsx`
- [ ] **Pending Clinics** (UC-GOV-01)
  - Code: `admin/clinics/PendingClinicsPage.tsx` (Inferred)
- [ ] **Clinic List** (Approved)
  - Code: `admin/clinics/ClinicsPage.tsx` (Inferred)
