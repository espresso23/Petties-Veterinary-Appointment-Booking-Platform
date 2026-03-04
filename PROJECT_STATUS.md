# 🐾 PETTIES Project Status

> **Last Updated:** 2026-03-04
> **Current Sprint:** Sprint 13 (04/03 - 11/03/2026) - Stabilization & Documentation Alignment
> **Overall Progress:** 85.2% (theo SRS mục 2.3)

---

## 📊 Quick Overview

| Module | Status | Completion |
|--------|--------|------------|
| Authentication | ✅ Done | 100% |
| Pet Management | ✅ Done | 100% |
| Clinic System | ✅ Done | 100% |
| Staff Scheduling | ✅ Done | 100% |
| Notifications | ✅ Done | 100% |
| AI Assistant | ✅ Done | 100% |
| Booking Flow | ✅ Done | 100% |
| EMR (Medical Records) | ✅ Done | 100% |
| Vaccination System | ✅ Done | 100% |
| Payment System | ✅ Done | 90% |
| SOS Emergency | 🔄 Active | 85% |

---

## 📋 Use Case Implementation Status (Code-based)

**Nguồn chuẩn:** `docs-references/documentation/SRS/PETTIES_SRS.md` mục **2.3 Use Case Implementation Status Reference**

| Status | Count | Percentage |
|--------|-------|------------|
| ✅ Done | 104 | 85.2% |
| 🔄 In Progress | 5 | 4.1% |
| ❌ Not Started | 13 | 10.7% |
| **Total** | **122** | **100%** |

**Ghi chú:** Booking lifecycle, SOS flow và SSE realtime đã được chuẩn hóa lại theo code hiện tại trong đợt cập nhật 2026-03-04.

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
- StaffShift & Slot Generation
- Overnight Shift Support
- SSE Real-time Events
- FCM Push Notifications
- Smart Availability API (Optimal Slot Finding)
- Standardized Controller Unit Tests (Auth, Booking, EMR)
- **Payment System (SePay QR Integration)** ✅ NEW
- **Vaccination System** ✅ NEW
- **EMR SOAP Notes (MongoDB)** ✅ NEW

### Web (React 19 + Vite)
- Admin Dashboard
- Clinic Owner Dashboard
- Clinic Manager Dashboard
- Staff Schedule Page
- Staff Management (CRUD)
- StaffShift Management (Calendar, Picker, Conflict Detection)
- SSE Notification Integration
- AI Playground
- **Booking Management Dashboard** ✅ NEW
- **Patient Management Dashboard** ✅ NEW
- **EMR Creation/Edit Forms** ✅ NEW
- **SSE Notification dedupe bằng silent page subscriptions** ✅ NEW (giảm duplicate toast)

### Mobile (Flutter)
- Google Sign-In
- Pet Management
- Clinic Search with Map
- Staff Schedule View
- FCM Push Notifications
- Deep Link Navigation
- **Booking Flow (Multi-step)** ✅ NEW
- **EMR Viewer** ✅ NEW
- **Vaccination Records** ✅ NEW
- **Staff Booking Action label chuẩn hóa “BẮT ĐẦU THỰC HIỆN DỊCH VỤ”** ✅ NEW

---

## ✅ Checklist Đồng Bộ Code-based (04/03/2026)

- [x] Chuẩn hóa booking status theo code: bỏ `ASSIGNED`/`CHECK_IN`/`CHECK_OUT`
- [x] Đồng bộ `Booking Workflow` theo flow `PENDING → CONFIRMED → IN_PROGRESS → COMPLETED`
- [x] Home Visit không tracking realtime (chỉ SOS tracking)
- [x] Đồng bộ nhãn action staff web/mobile: “BẮT ĐẦU THỰC HIỆN DỊCH VỤ”
- [x] Fix duplicate toast SSE trên web bằng `silent` mode ở page-level subscriptions
- [x] Cập nhật SRS theo endpoint/status hiện tại
- [x] Cập nhật SDD theo endpoint/status/schema hiện tại

---

## 🔄 In Progress (Sprint 13)

### Current Focus: Stabilization + Consistency
1. **Payment Flow Completion**
   - [x] SePay QR Backend API
   - [x] Payment Controller
   - [ ] Mobile Payment Screen
   - [ ] Webhook handling production verification

2. **Manager Refund/Cancel Ops**
   - [x] View request cancel booking
   - [ ] Approve/Reject request (end-to-end UI + API)
   - [ ] Process refund flow hoàn chỉnh

3. **SOS & Tracking Hardening**
   - [x] SOS booking + matching + tracking cơ bản
   - [ ] Track staff location stabilization (in-progress theo SRS)

---

## ⏳ Upcoming

### Next: Reviews & Rating System
- [ ] Rate Clinic after Visit
- [ ] Rate Staff after Service
- [ ] Review listing & moderation

---

## 💡 Planned (Sprint 11-12)

### AI Enhancements
- [ ] Booking via Chat (Function Calling) - đã có tool nhưng chưa test full

### Platform Admin
- [ ] User Report Moderation
- [ ] Advanced Analytics Dashboard

---

## 🐛 Known Issues
- Payment webhook cần verify kỹ trước khi production
- Cross-clinic EMR cần test với nhiều clinic data
- Một số tài liệu lịch sử còn thuật ngữ `vet`/flow cũ ngoài phạm vi Booking module (cần dọn đồng bộ toàn cục)

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
| **Payment API Spec** | `docs-references/documentation/SEPAY_QR_PAYMENT_API.md` |

---

## 🔧 Tech Stack

| Layer | Technology |
|-------|------------|
| Backend | Spring Boot 3.4, Java 21, PostgreSQL, MongoDB, Redis |
| Web Frontend | React 19, Vite, TypeScript, TailwindCSS (Neobrutalism) |
| Mobile | Flutter 3.5, Riverpod, GoRouter |
| AI Service | Python 3.12, FastAPI, LangGraph, LlamaIndex, Qdrant |
| Cloud | AWS EC2, Cloudinary, Firebase, OpenRouter |

---

*This file helps AI agents understand project context quickly.*
