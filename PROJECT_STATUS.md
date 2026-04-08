# 🐾 PETTIES Project Status

> **Last Updated:** 2026-04-08
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

### Recent Mascot Copilot Rollout (Code-based Evidence - 2026-04-08)

### Knowledge Base FastEmbed Hotfix (Code-based Evidence - 2026-04-08)

**Scope:** Fix runtime failure on `POST /knowledge/query` when Qdrant hybrid retrieval requires FastEmbed.

**Implemented changes:**
- Added missing dependency `fastembed` into AI service dependency manifest so Docker/local install includes required runtime package.
- Hardened RAG initialization in `LlamaIndexRAGEngine.initialize()` with graceful fallback:
  - Try `enable_hybrid=True` first.
  - If FastEmbed (or hybrid init) fails, auto fallback to `enable_hybrid=False` and continue serving dense retrieval.
- Added explicit logging for hybrid enabled/fallback scenarios to speed up production diagnostics.

**Changed files (evidence):**
- `petties-agent-serivce/requirements.txt`
- `petties-agent-serivce/app/core/rag/rag_engine.py`

**Validation plan:**
- Rebuild/reinstall AI service dependencies.
- Verify endpoints:
  - `POST /knowledge/query`
  - `GET /knowledge/status`
  - `GET /knowledge/debug/qdrant`

---

### Recent Mascot Copilot Rollout (Code-based Evidence - 2026-04-08)

**Scope:** Start migration from route-based AI pages to global mascot copilot for internal clinic roles.

**Implemented changes:**
- Mounted global mascot panel + floating launcher in internal layouts: `STAFF`, `CLINIC_MANAGER`, `CLINIC_OWNER`.
- Removed AI sidebar entries for owner/manager to avoid page-centric navigation.
- Replaced dedicated AI routes with redirects back to role dashboards (`/staff`, `/clinic-owner`, `/clinic-manager`).
- Updated Staff dashboard quick action to open mascot panel directly (event-based trigger), not navigate to a chat page.
- Added context injection baseline in global panel requests: role, active route, clinic_id, user_id.

**Changed files (evidence):**
- `petties-web/src/components/mascot/MascotLauncher.tsx`
- `petties-web/src/components/mascot/MascotDockPanel.tsx`
- `petties-web/src/components/mascot/MascotProvider.tsx`
- `petties-web/src/hooks/useMascotPanel.ts`
- `petties-web/src/layouts/StaffLayout.tsx`
- `petties-web/src/layouts/ClinicManagerLayout.tsx`
- `petties-web/src/layouts/ClinicOwnerLayout.tsx`
- `petties-web/src/pages/staff/DashboardPage.tsx`
- `petties-web/src/App.tsx`

**Validation evidence:**
- Command: `cd petties-web && npm run build`
- Result: `tsc -b && vite build` completed successfully.

---

### Recent Clinic Copilot Governance Sync (Code-based Evidence - 2026-04-08)

**Scope:** Align clinic-operation copilot tool governance with real MCP implementation and close test coverage gaps.

**Implemented changes:**
- Removed non-implemented tool names from clinic role whitelist to prevent runtime drift:
   - `get_clinic_staff`
   - `get_clinic_shifts`
   - `check_booking_availability`
- Synchronized default tool policy registry with implemented tools only.
- Synchronized startup tool scanner managed set with implemented tools only.
- Added regression policy test to prevent re-introducing removed tool names into clinic roles.
- Added new clinic operation test suite covering:
   - booking list/confirm/cancel
   - staff reassignment (available staff + reassign action)
   - staff schedule and slot availability tools

**Changed files (evidence):**
- `petties-agent-serivce/app/core/context_policy.py`
- `petties-agent-serivce/app/core/tools/tool_policy.py`
- `petties-agent-serivce/app/core/tools/scanner.py`
- `petties-agent-serivce/tests/test_context_policy.py`
- `petties-agent-serivce/tests/test_clinic_operation_tools.py`

**Validation evidence:**
- Command: `cd petties-agent-serivce && python -m pytest tests/test_context_policy.py tests/test_clinic_operation_tools.py tests/test_clinic_tools.py -q`
- Result: `30 passed`.

---

### AI Assistant Function Catalog Sync (Docs Evidence - 2026-04-08)

**Scope:** Đồng bộ naming chuẩn AI Assistant theo 14 function trên Features, SRS, SDD.

**Updated docs:**
- `docs-references/documentation/PETTIES_Features.md` (AI Assistant Function Catalog - standardized)
- `docs-references/documentation/SRS/PETTIES_SRS.md` (section `3.11.0` + implementation status synchronization)
- `docs-references/documentation/SDD/REPORT_4_SDD_SYSTEM_DESIGN.md` (section `3.2.7` + API mapping sync)

**Function coverage baseline (14):**
- Interact with ChatBot
- Config Agent Parameter
- Test Agent Playground
- Turn On/Off Agent Tools
- Upload Document To Knowledge Base
- Delete Document from Knowledge Base
- View Case Memory
- Delete Case Memory
- Use AI-Assisted Clinic Setup, Operation
- Use Summarize patient info & EMR
- Use Summarize pet's EMR
- View aggregate feedback stats
- Provide AI's Response Feedback
- Use AI Diagnostic Support

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
- RAG: Hybrid Engine (RAG + Case Memory + Qdrant)
- Vision: Gemini Vision Adapter (image diagnosis)
- Staff Diagnosis: Protocol Service + LLM Synthesis
- Pet Health Summary LLM Service
- Disease Mapping Service
- EMR Case Memory Sync Service
- WebSocket Chat (streaming ReAct)
- `fastmcp_app.py` single source of truth cho MCP server

### Recent AI Copilot Hardening (Code-based Evidence - 2026-04-07)

**Scope:** Clinic Copilot service-management quality, chat action stability, thinking stream safety.

**Implemented changes:**
- **Smart service recommendation mode**: compare clinic existing services with master templates and recommend **update-only** when service exists (no master write).
- **Rich service update payload support**: expanded clinic service update/create flows to include reminder settings, weight pricing, vaccine dose pricing.
- **UI action contract hardening**: extended WebSocket `confirm_service_create` and `confirm_service_update` validation/normalization for richer fields.
- **Presentation mapping upgrades**: map update recommendations to `confirm_service_update`; preserve create flow only for create suggestions.
- **Chat UX safety fix**: improved clinic item-id normalization and observation/thinking JSON leak suppression.

**Changed files (evidence):**
- `petties-agent-serivce/app/core/tools/mcp_tools/clinic_tools.py`
- `petties-agent-serivce/app/services/backend_client.py`
- `petties-agent-serivce/app/core/presentation/builder.py`
- `petties-agent-serivce/app/api/websocket/chat.py`
- `petties-agent-serivce/app/core/agents/thinking_formatter.py`
- `petties-agent-serivce/tests/test_clinic_tools.py`
- `petties-agent-serivce/tests/test_presentation_builder.py`
- `petties-agent-serivce/tests/test_websocket_chat.py`

**Validation evidence:**
- Command: `python -m pytest tests/test_clinic_tools.py tests/test_presentation_builder.py tests/test_websocket_chat.py tests/test_context_policy.py -k "not test_handle_chat_message_end_to_end_booking_journey" -q`
- Result: `59 passed, 1 deselected`.

### Recent AI Copilot Permission & Suggestion Quality Update (Code-based Evidence - 2026-04-07)

**Scope:** Role-permission parity for Clinic Copilot, secure response rendering, and flexible structured service suggestions.

**Implemented changes:**
- **Role permission sync (Manager/Owner)**: aligned Booking endpoint authorization so Clinic Manager/Owner can access clinic booking operations consistent with dashboard behavior.
- **Service-layer authorization hardening**: `getClinicTodayBookings` now validates by role+clinic ownership/membership (ADMIN, STAFF, CLINIC_MANAGER, CLINIC_OWNER) and blocks out-of-scope access.
- **Tool identity safety**: Clinic/medical/booking tools now default to runtime `context.user_id` (ignore mismatched user_id from LLM input).
- **Error-code parity improvement**: standardized 403/permission-denied backend errors to tool-level `FORBIDDEN` instead of generic `INTERNAL_ERROR`.
- **JSON payload leak prevention (Web)**: assistant text bubble now suppresses raw JSON payload dump when UI schema cards are present.
- **Service suggestion flexibility**: `generate_clinic_services` supports mixed create+update strategy and LLM-structured suggestion expansion when catalog is sparse.
- **Master data safety**: suggestion flow remains clinic-service only (create/update clinic services), no master service mutation.

**Changed files (evidence):**
- `backend-spring/petties/src/main/java/com/petties/petties/controller/BookingController.java`
- `backend-spring/petties/src/main/java/com/petties/petties/service/BookingService.java`
- `backend-spring/petties/src/test/java/com/petties/petties/controller/BookingControllerUnitTest.java`
- `petties-agent-serivce/app/core/tools/mcp_tools/booking_tools.py`
- `petties-agent-serivce/app/core/tools/mcp_tools/medical_tools.py`
- `petties-agent-serivce/app/core/tools/mcp_tools/analytics_tools.py`
- `petties-agent-serivce/app/core/tools/mcp_tools/staff_tools.py`
- `petties-agent-serivce/app/core/tools/mcp_tools/clinic_tools.py`
- `petties-agent-serivce/app/core/tools/tool_policy.py`
- `petties-agent-serivce/app/core/tools/contracts.py`
- `petties-agent-serivce/tests/test_booking_tools.py`
- `petties-agent-serivce/tests/test_medical_tools.py`
- `petties-agent-serivce/tests/test_tool_contracts.py`
- `petties-agent-serivce/tests/test_clinic_tools.py`
- `petties-web/src/pages/clinic-manager/AIChatPage.tsx`
- `petties-web/src/pages/clinic-owner/AIChatPage.tsx`
- `petties-web/src/pages/staff/StaffAIChatPage.tsx`

**Validation evidence:**
- Command: `mvn -Dtest=BookingControllerUnitTest test`
- Result: pass.
- Command: `mvn -Dtest=BookingServiceUnitTest test`
- Result: pass.
- Command: `python -m pytest tests/test_booking_tools.py -k "ignores_input_user_id" -q`
- Result: `3 passed`.
- Command: `python -m pytest tests/test_medical_tools.py -k "get_pet_health_summary" -q`
- Result: `2 passed`.
- Command: `python -m pytest tests/test_tool_contracts.py -q`
- Result: `10 passed`.
- Command: `python -m pytest tests/test_clinic_tools.py -q`
- Result: `10 passed`.
- Command: `npm run test -- UISchemaRenderer`
- Result: `2 passed`.

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
