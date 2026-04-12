# Web role dashboards — overview

**Version:** 1.2  
**Last updated:** 2026-04-01

This document maps each web role dashboard page to the frontend modules and APIs used for KPIs, tables/lists, charts, and quick links. Technical reference in English.

## Summary

| Role | Page | Main APIs / modules |
|------|------|---------------------|
| Admin | `petties-web/src/pages/admin/DashboardPage.tsx` | See [Admin dashboard detail](#admin-dashboard-detail) |
| Clinic owner | `petties-web/src/pages/clinic-owner/DashboardPage.tsx` | `useClinicStore().getMyClinics`, `getClinicRevenueSummary` (DAY/WEEK/MONTH), `getBookingsByClinic`, `getClinicPayments` (PAID + PENDING), `subscriptionService.getClinicSubscriptionStatus`; `ClinicDashboardCharts` (ApexCharts); `formatVndEn`; partial-load banner |
| Clinic manager | `petties-web/src/pages/clinic-manager/DashboardPage.tsx` | `getClinicRevenueSummary` (DAY/WEEK/MONTH), `getBookingsByClinic`, `getClinicRefundApplications`, `getClinicPayments` (PENDING), `getActiveSosAlerts`; `ClinicDashboardCharts`; `bookingStatusLabelEn`; partial-load banner |
| Staff | `petties-web/src/pages/staff/DashboardPage.tsx` | `getStaffHomeSummary`, `notificationService.getUnreadCount`, `chatService.getUnreadCount`, `getBookingsByStaff` (optional table); `StaffWorkloadDonut`; partial-load banner |

### Admin dashboard detail

**Health (fetch):** `AGENT_API_BASE_URL/health`, `API_BASE_URL/actuator/health`.

**Stats (parallel):** `clinicService.getPendingClinicsCount`, `getAllReportsForAdmin` with `PENDING` / `APPROVED` / `REJECTED` (page size 1 for totals), `getPendingForAdmin`, `clinicService.getStruckClinics(0,1)`, `getStruckPetOwners(0,1)`, `clinicService.getAllClinics({ status: 'APPROVED', page: 0, size: 1 })`, `subscriptionService.getAllUserSubscriptions` (client count of `PENDING_PAYMENT`), `clinicService.getPendingClinics(0,5)`, `getAllReportsForAdmin('PENDING',0,5)` for tables.

**UI sections:** Service status; **Queues & risk** KPI grid; **Platform totals** KPI grid; **Charts** — `AdminDashboardCharts` (`react-apexcharts`: donut “Reports by status”, horizontal bar “Queue snapshot”); **Recent pending clinics** and **Recent pending reports** tables; partial-load warnings if any call fails.

**Component:** `petties-web/src/components/admin/AdminDashboardCharts.tsx`

### Clinic owner dashboard sections

- **Today:** Revenue today, appointments today, completed today, pending payments count (PENDING payment list).
- **Charts:** Week/month toggle; revenue bar from `getClinicRevenueSummary` (`WEEK` | `MONTH`); donut “Bookings by status” from aggregated `getBookingsByClinic` sample (client-side counts by `BookingStatus`, labels via `bookingStatusLabelEn`).
- **Clinic info:** Services, rating, monthly revenue, subscription line from `getClinicSubscriptionStatus`.
- **Monthly summary** block, **Recent payments** (PAID), **Quick links**.
- **Component:** `petties-web/src/components/clinic/ClinicDashboardCharts.tsx`

### Clinic manager dashboard sections

- **Today overview:** Revenue today, needs action/assign, in progress, completed.
- **Charts:** Same `ClinicDashboardCharts` pattern as owner (week/month revenue + booking status donut).
- **Attention:** Bookings to handle, pending payment (API count), pending refunds, active SOS count (`getActiveSosAlerts`).
- **Recent bookings** table, **Quick links**.

### Staff dashboard sections

- **Work overview:** Four KPIs from `getStaffHomeSummary`.
- **Workload mix:** `StaffWorkloadDonut` from the four KPI numbers (today, awaiting intake, in progress, upcoming list size).
- **Alerts:** Unread notifications count + link to `/staff/notifications`; chat unread (`/chat/unread-count`) + link to `/staff/bookings` (bookings context on web).
- **Upcoming** list (home); **Your bookings (paged)** from `getBookingsByStaff(userId, …)` when `userId` is present.
- **Component:** `petties-web/src/components/clinic/StaffWorkloadDonut.tsx`

## UI sections (shared pattern)

Each dashboard uses `DashboardCard`, `DashboardStatsGrid`, and `DashboardSection` from `petties-web/src/components/dashboard/DashboardCard.tsx`: header (title + greeting), KPI row(s), optional table or list, quick links (`Link`, not native dialogs).

## Testing

Vitest + Testing Library:

- `src/pages/admin/DashboardPage.test.tsx` (charts mocked)
- `src/pages/clinic-owner/DashboardPage.test.tsx` (`ClinicDashboardCharts` mocked)
- `src/pages/clinic-manager/DashboardPage.test.tsx` (`ClinicDashboardCharts` mocked)
- `src/pages/staff/DashboardPage.test.tsx` (`StaffWorkloadDonut` mocked)

Mocks cover stores and services; `MemoryRouter` wraps routed pages.

## Related backend

Staff home summary: `BookingController#getStaffHomeSummary` → `GET /bookings/staff/home-summary` (`backend-spring/petties/.../BookingController.java`).
