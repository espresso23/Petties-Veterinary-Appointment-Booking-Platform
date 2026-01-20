# 🐾 PETTIES Project Status

> **Last Updated:** 2026-01-18
> **Current Sprint:** Sprint 10 (06/01 - 12/01/2026)
> **Overall Progress:** 65%

---

## 📊 Quick Overview

| Module | Status | Completion |
|--------|--------|------------|
| Authentication | ✅ Done | 100% |
| Pet Management | ✅ Done | 100% |
| Clinic System | ✅ Done | 100% |
| Vet Scheduling | ✅ Done | 100% |
| Notifications | 🔄 Active | 60% |
| AI Assistant | 🔄 Active | 40% |
| Booking Flow | 🔄 Active | 70% |
| EMR (Medical Records) | ⏳ Pending | 20% |
| SOS Emergency | 💡 Planned | 0% |

---

## ✅ Completed Features

### Backend (Spring Boot)
- JWT Authentication & Refresh Token
- Google Social Auth (Firebase)
- OTP Email Verification (Redis)
- Password Reset Flow
- RBAC Permission System
- Pet CRUD with Cloudinary Images
- Clinic Registration & Approval
- Master/Custom Services
- Geocoding Integration (Goong)
- Nearby Clinic Search (Haversine)
- VetShift & Slot Generation
- Overnight Shift Support
- SSE Real-time Events
- FCM Push Notifications

### Web (Next.js)
- Admin Dashboard
- Clinic Owner Dashboard
- Clinic Manager Dashboard
- Vet Schedule Page
- Staff Management (CRUD)
- VetShift Management (Calendar, Picker, Conflict Detection)
- SSE Notification Integration
- AI Playground

### Mobile (Flutter)
- Google Sign-In
- Pet Management
- Clinic Search with Map
- Vet Schedule View
- FCM Push Notifications
- Deep Link Navigation

---

## 🔄 In Progress (Sprint 10)

### Current Focus
1. **VetShift Refinements**
   - [x] Calendar Picker Component
   - [x] Shift Conflict Detection

2. **Notification System**
   - [x] FCM Backend Integration
   - [x] Mobile Push Handling
   - [x] SSE Web Integration
   - [ ] Scheduled Reminders (Cron)

3. **Booking Module (Clinic Manager & Vet)**
   - [x] Backend API: 12 endpoints đầy đủ
   - [x] Booking Dashboard (Manager) với filter tabs
   - [x] Xem chi tiết booking với modal
   - [x] Check Vet Availability trước khi confirm
   - [x] **Inline Dropdown chọn vet thủ công** (thay thế auto-assign)
   - [x] Preview suggested vet với avatar, specialty, workload
   - [x] Confirm với manual/auto vet assignment
   - [x] Đổi vet (ReassignVetModal) cho dịch vụ đã gán
   - [x] Thêm dịch vụ phát sinh (khi IN_PROGRESS/ARRIVED)
   - [x] Hủy booking với lý do
   - [x] Vet Bookings List với filter, search, pagination
   - [x] Vet Schedule Calendar View
   - [x] Unit tests (BookingControllerUnitTest, VetAssignmentServiceUnitTest)
   - [ ] Check-in endpoint (bắt đầu khám)
   - [ ] Check-out endpoint (kết thúc khám)
   - [ ] Complete endpoint (hoàn thành sau thanh toán)
   - [ ] GPS tracking cho SOS (ON_THE_WAY → ARRIVED)
   - [ ] Payment flow integration

---

## ⏳ Upcoming (Sprint 11-12)

### EMR & Medical Records
- [ ] Cross-clinic EMR History API
- [ ] SOAP Note Entry (Vet)
- [ ] Vaccination Card
- [ ] Electronic Prescription (Rx)

### Booking Workflow
- [ ] Multi-step Booking Wizard
- [ ] Vet Check-in Button (click to start examination)
- [ ] Vet Checkout Button (complete appointment)
- [ ] State Machine (PENDING → CONFIRMED → IN_PROGRESS → COMPLETED)
- [ ] Cancellation & Refund Policy

---

## 💡 Planned (Sprint 13-14)

### SOS Emergency System
- [ ] Emergency Clinic Filter
- [ ] Live GPS Tracking (WebSocket)
- [ ] SOS Tracking Map UI

### AI Enhancements
- [ ] Booking via Chat (Function Calling)

---

## 🐛 Known Issues
- None currently tracked

---

## 📁 Key Documentation

| Document | Path |
|----------|------|
| **SRS (Software Requirements)** | `docs-references/documentation/SRS/PETTIES_SRS.md` |
| **SDD (System Design)** | `docs-references/documentation/SDD/REPORT_4_SDD_SYSTEM_DESIGN.md` |
| AI Agent SRS | `docs-references/documentation/SRS/AI_AGENT_SERVICE_SRS.md` |
| AI Agent SDD | `docs-references/documentation/SDD/AI_AGENT_SERVICE_SDD.md` |
| WBS Master Backlog | `docs-references/documentation/WBS_PETTIES_14_SPRINTS.md` |
| VetShift Strategy | `docs-references/documentation/VET_SCHEDULING_STRATEGY.md` |
| Features Overview | `docs-references/documentation/PETTIES_Features.md` |
| ERD Diagram | `docs-references/documentation/PETTIES_ERD_DIAGRAM.md` |
| MVP Happy Flows | `docs-references/documentation/PETTIES_MVP_HAPPY_FLOWS.md` |
| Module Overview | `docs-references/documentation/PETTIES_MODULE_OVERVIEW.md` |
| BPMN Workflows | `docs-references/documentation/BUSINESS_WORKFLOW_BPMN.md` |
| URD (User Requirements) | `docs-references/documentation/URD_USER_REQUIREMENTS.md` |

---

## 🔧 Tech Stack

| Layer | Technology |
|-------|------------|
| Backend | Spring Boot 3, PostgreSQL, Redis |
| Web Frontend | Next.js 15, TypeScript, TailwindCSS |
| Mobile | Flutter 3, Riverpod, GoRouter |
| AI Service | Python, LlamaIndex, Qdrant |
| Cloud | AWS EC2, Cloudinary, Firebase |

---

*This file helps AI agents understand project context quickly.*
