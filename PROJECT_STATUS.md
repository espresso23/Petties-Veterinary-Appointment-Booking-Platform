# 🐾 PETTIES Project Status

> **Last Updated:** 2026-04-06
> **Current Sprint:** Post Sprint 13 - Production Hardening & AI Enhancement
> **Overall Progress:** ~95% (code-based scan)

---

## 📊 Quick Overview

| Module | Status | Web | Mobile | Backend |
|--------|--------|-----|--------|---------|
| Authentication | ✅ Done | ✅ | ✅ | ✅ |
| Pet Management | ✅ Done | ✅ | ✅ | ✅ |
| Clinic System | ✅ Done | ✅ | ✅ | ✅ |
| Staff Scheduling | ✅ Done | ✅ | ✅ | ✅ |
| Booking Flow | ✅ Done | ✅ | ✅ | ✅ |
| SOS Emergency | ✅ Done | - | ✅ | ✅ |
| EMR (Medical Records) | ✅ Done | ✅ | ✅ | ✅ |
| Vaccination System | ✅ Done | ✅ | ✅ | ✅ |
| Payment System (QR + Cash) | ✅ Done | ✅ | ✅ | ✅ |
| Notification System | ✅ Done | ✅ | ✅ | ✅ |
| System Notifications (Admin) | ✅ Done | ✅ | - | ✅ |
| Report System | ✅ Done | ✅ | ✅ | ✅ |
| Review & Rating | ✅ Done | - | ✅ | ✅ |
| Voucher System | ✅ Done | ✅ | ✅ | ✅ |
| Subscription/Membership | ✅ Done | ✅ | - | ✅ |
| Refund Applications | ✅ Done | ✅ | - | ✅ |
| Strike System | ✅ Done | - | - | ✅ |
| Chat (Clinic↔Staff) | ✅ Done | ✅ | ✅ | ✅ |
| AI Assistant (Chat + Booking) | ✅ Done | ✅ | ✅ | ✅ |
| AI Clinic Copilot (Staff/Manager) | ✅ Done | ✅ | ✅ | - |
| Staff Diagnosis AI | ✅ Done | ✅ | ✅ | - |
| RAG / Knowledge Base | ✅ Done | ✅ | - | - |
| Vision (Image Diagnosis) | ✅ Done | ✅ | - | - |

---

## 📋 Use Case Count (Code-based Scan - 04/04/2026)

| Status | Count | % |
|--------|-------|---|
| ✅ Done | 113 | ~92% |
| 🔄 In Progress | 5 | ~4% |
| ❌ Not Started | 5 | ~4% |
| **Total** | **123** | **100%** |

---

## ✅ Completed Features (Full Code-based Inventory)

### Backend (Spring Boot) — 36 Controllers

| Controller | Domain |
|------------|--------|
| `AuthController` | Auth (Login, Register, OTP, Social, Reset PW) |
| `UserController` | User Profile, CRUD |
| `PetController` | Pet CRUD + Cloudinary Images |
| `ClinicController` | Clinic Registration, Approval, Geocoding |
| `ClinicServiceController` | Clinic Services (custom) |
| `MasterServiceController` | Master Services template |
| `ClinicPriceController` | Weight-based pricing |
| `ClinicStaffController` | Staff management per clinic |
| `StaffShiftController` | StaffShift, Slot Generation, Overnight |
| `BookingController` | Booking full lifecycle + Reports API |
| `SosController` | SOS Emergency Booking |
| `TrackingController` | Realtime SOS tracking |
| `EmrController` | EMR CRUD (MongoDB) |
| `VaccinationController` | Vaccination records |
| `VaccineTemplateController` | Vaccine schedule templates |
| `PaymentController` | Payment intent + QR |
| `SePayWebhookController` | SePay payment webhook |
| `ReviewController` | Review & Rating after visit |
| `ReportController` | User report system |
| `NotificationController` | FCM + SSE notifications |
| `FcmController` | FCM token management |
| `SseController` | SSE event stream |
| `ChatController` | Clinic↔Staff messaging |
| `ChatWebSocketController` | Real-time WebSocket chat |
| `ChatAutoReplyController` | Auto-reply config |
| `VoucherController` | Voucher CRUD + apply |
| `SubscriptionController` | Membership plans |
| `UserSubscriptionController` | Clinic subscription management |
| `RefundApplicationController` | Refund request + approval |
| `WithdrawalController` | Clinic withdrawal requests |
| `AiToolBookingController` | AI Booking tool endpoints |
| `ClinicStrikeConfigController` | Clinic strike management |
| `UserStrikeConfigController` | Pet Owner strike management |
| `FileController` | File/Image upload |
| `admin/AdminNotificationController` | Admin system notifications |
| `admin/AdminUserController` | Admin user management |

### Web (React 19 + Vite) — 68 Pages/Routes

**Admin (6 core + sub-pages):**
- Dashboard, Clinic Approval, Clinic Registry
- Reports Page (Admin moderation)
- Voucher Management
- Subscription List + History
- Refund Applications
- Notifications + **System Notification Management** ✅
- AI: Tools, Playground, Knowledge, AI Insights

**Clinic Owner (10):**
- Dashboard, Revenue, Notifications, Profile
- Clinics (List, Create, Detail, Edit)
- Services, Master Services
- Staff Management
- **My Subscription + Payment Modal** ✅
- AI Chat Page ✅

**Clinic Manager (12):**
- Dashboard, Revenue, Notifications, Profile
- Booking Dashboard (full Cancel/Checkout/Report/Voucher flow)
- Staff Management, StaffShift Calendar
- Services View, Clinic Info/Edit
- Chat (Clinic↔Staff)
- Refunds Page
- Voucher Management

**Architecture/Technical (Web):**
- Chat type boundary hardening ✅: separated traditional chat types and AI Copilot schema types to avoid cross-flow coupling (`petties-web/src/types/chat.ts`, `petties-web/src/types/chat-copilot.ts`) while preserving legacy chat flow.

**Staff Web (9):**
- Dashboard, Schedule, Bookings, Patients
- EMR Create/Edit/Detail
- Vaccination Page + Roadmap
- **AI Chat (Staff Copilot)** ✅
- Notifications

**Shared:** Profile, Home, Pet Health Record, Onboarding, Auth (4)

### Mobile (Flutter) — 75 Screens/Widgets

**Auth:** Login, Register, Forgot PW, Reset PW  
**Pet Owner:**
- Home, Onboarding, Pet List/Detail/Add/Edit
- Pet Health Record
- Clinic Search (Map + List), Clinic Detail, All Services
- Booking: Select Pet → Services → DateTime → Confirm → Success → Detail
- SOS: Request, Radar Map, Tracking, Status Panel
- Voucher Picker (bottom sheet)
- **Write Review Screen** ✅
- **Report Booking Dialog** ✅
- My Bookings Tab
- AI Chat (+ Booking Cards, Tracker, Confirmation, Quick Actions, Web Search Card)
- Chat (clinic staff): List, Detail, Camera, Message Bubble/Input
- Notification List
- Profile (Edit, Change PW, Change Email, Avatar Picker, Location Picker)

**Staff Mobile:**
- Staff Home, Schedule, Booking List, Booking Detail
- Add Service to Booking
- Patient Management (vaccination form + roadmap)
- EMR Create/Edit/Detail
- **AI Chat (Staff Copilot)** ✅ (`staff_ai_chat_screen.dart`)
- **AI Diagnosis Panel + Sheet** ✅
- Notifications

**Reports Mobile:**
- Report List Screen, Report Detail Screen

### AI Service (FastAPI) — 10 Tool Modules + 10 Alembic Migrations

**MCP Tools (10 modules):**

| Module | Chức năng |
|--------|-----------|
| `booking_tools.py` | Booking + Patient cho Pet Owner AI Chat  |
| `booking_session_tools.py` | BookingSession state management |
| `medical_tools.py` | Pet knowledge search, symptom lookup |
| `clinic_tools.py` | Clinic info, services, staff (Clinic role) |
| `clinic_staff_tools.py` | Staff booking operations |
| `analytics_tools.py` | Revenue/booking analytics |
| `staff_tools.py` | Staff shift + schedule |
| `common_tools.py` | Web search, pet info |
| `utility_tools.py` | Date/time utils |
| `medical_tools.py` | Pet medical Q&A + RAG |

**AI Core Modules:**
- Single Agent (ReAct + LangGraph) - `single_agent.py`
- Prompt Builder với Clinic Staff persona - `prompt_builder.py`
- Tool Routing + Context Policy
- RAG: Hybrid Engine (Knowledge Graph + Case Memory + Qdrant)
- Vision: Gemini Vision Adapter (image diagnosis)
- Staff Diagnosis: Protocol Service + LLM Synthesis
- Pet Health Summary LLM Service
- Disease Mapping Service
- EMR Case Memory Sync Service
- WebSocket Chat (streaming ReAct)
- `fastmcp_app.py` single source of truth cho MCP server

---

## 🔄 In Progress

1. **AI Booking E2E Validation**
   - [x] Session, WebSocket streaming, tools, mobile card
   - [ ] E2E test: khám phòng khám, tiêm chủng, khám nhà
   - [ ] Mobile confirmation bỏ phụ thuộc heuristic parsing
4. **AI Chatbot Production Hardening**
   - [ ] Persistent checkpointer thay MemorySaver
   - [ ] Business error-code parity toàn bộ flow phụ
   - [ ] Chốt source of truth lưu user message (REST vs WebSocket)
5. **Staff Diagnosis Plan Draft** — Unit test ✅, Verify endpoint thật ❌

---

## ❌ Not Started / Thực sự còn thiếu

- AI Booking E2E test acceptance checklist (test tự động)
- Advanced Admin Analytics (ngoài AI Insights sẵn có)
- Persistent checkpointer (LangGraph)

---

## 🐛 Known Issues

- Payment webhook chưa verify kỹ trước production
- AI Booking mobile confirmation vẫn có heuristic parsing
- AI Chatbot chưa chốt source of truth user message (REST vs WebSocket)
- Persistent checkpointer deferred (đang dùng MemorySaver)

---

## ✅ Acceptance Checklist — Booking via AI

- [x] `BUSINESS_CHAT` session + WebSocket reconnect ổn định
- [x] Agent chỉ gọi booking tool khi đủ context + xác nhận user
- [x] Tạo booking thật qua `create_booking_for_user`
- [ ] E2E: khám tại phòng khám → booking created
- [ ] E2E: tiêm chủng → booking created
- [ ] E2E: khám tại nhà (address + geo + distanceFee)
- [ ] Test lỗi: hết token, hết slot, validation fail
- [ ] Mobile confirmation không còn phụ thuộc heuristic chính
- [ ] Demo checklist xác nhận sau E2E thực tế

---

## 📁 Key Documentation

| Document | Path |
|----------|------|
| SRS | `docs-references/documentation/SRS/PETTIES_SRS.md` |
| SDD | `docs-references/documentation/SDD/REPORT_4_SDD_SYSTEM_DESIGN.md` |
| AI Agent SRS | `docs-references/documentation/SRS/AI_AGENT_SERVICE_SRS.md` |
| AI Agent SDD | `docs-references/documentation/SDD/AI_AGENT_SERVICE_SDD.md` |
| WBS | `docs-references/documentation/WBS_PETTIES_14_SPRINTS.md` |
| Features | `docs-references/documentation/PETTIES_Features.md` |
| ERD | `docs-references/documentation/PETTIES_ERD_DIAGRAM.md` |
| BPMN | `docs-references/documentation/BUSINESS_WORKFLOW_BPMN.md` |
| Payment API | `docs-references/documentation/SEPAY_QR_PAYMENT_API.md` |
| AI Copilot | `docs-references/ai-agent/AI_COPILOT_CLINIC_USER_MANUAL.md` |

---

## 🔧 Tech Stack

| Layer | Technology |
|-------|------------|
| Backend | Spring Boot 3.4, Java 21, PostgreSQL, MongoDB, Redis |
| Web Frontend | React 19, Vite, TypeScript, TailwindCSS v4 (Soft Neobrutalism) |
| Mobile | Flutter 3.5, Provider, GoRouter |
| AI Service | Python 3.12, FastAPI, LangGraph, LlamaIndex, Qdrant, FastMCP |
| Cloud | AWS EC2, Cloudinary, Firebase, OpenRouter (LLM), Cohere (Embed) |

---

*This file is auto-updated based on code-based scan. Last scan: 2026-04-04.*
