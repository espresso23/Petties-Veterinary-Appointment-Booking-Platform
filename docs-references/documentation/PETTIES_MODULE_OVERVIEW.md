# PETTIES - Complete Module Overview

**Document Purpose:** Tổng hợp đầy đủ các module/feature của project Petties khi hoàn thành
**For:** Stakeholder review, scope verification, team alignment
**Last Updated:** 2026-03-11  

---

## 1. Backend Modules (Spring Boot)

| No | Module | Description | APIs | Status |
|----|--------|-------------|:----:|:------:|
| 01 | **Authentication** | Đăng ký, đăng nhập, OAuth, OTP, JWT refresh | 8 | ✅ Done |
| 02 | **User Management** | Profile, avatar, change password/email (STAFF role replaces STAFF) | 7 | ✅ Done |
| 03 | **Pet Management** | CRUD pets, upload photo | 6 | ✅ Done |
| 04 | **Clinic Management** | CRUD clinics, approval workflow, images, search | 12 | ✅ Done |
| 05 | **Service Management** | Master services (Admin), Clinic services (Owner) | 8 | ✅ Done |
| 06 | **Pricing** | Dynamic pricing rules, price calculation | 3 | ✅ Done |
| 07 | **Staff Management** | Quick add staff, deactivate, list | 4 | ✅ Done |
| 08 | **StaffShift & Slot** | Create shifts, auto-generate 30-min slots, block/unblock | 8 | ✅ Done |
| 09 | **Booking** | Create, assign, approve/reject, check-in/out, cancel, incurred services | 12 | ⏳ Pending |
| 10 | **Chat (1-1)** | Conversations, messages, WebSocket realtime | 7+WS | ⏳ Pending |
| 11 | **EMR** | Create/view medical records linked to booking | 4 | ❌ Phase 2 |
| 12 | **Vaccination** | Vaccination history, add records linked to booking | 3 | ❌ Phase 2 |
| 13 | **Prescription** | Prescriptions within EMR | 2 | ❌ Phase 2 |
| 14 | **Payment** | Stripe integration, payment intent, webhook | 4 | ❌ Phase 2 |
| 15 | **Rating & Review** | Review clinics and vets after booking | 3 | ❌ Phase 2 |
| 16 | **Notification** | In-app notifications, FCM push, SSE realtime | 8 | ✅ Done |
| 17 | **Search & Discovery** | Nearby clinics, keyword search, geocoding | 3 | ⏳ Pending |
| 18 | **Home Visit Tracking** | GPS realtime tracking for home visits | 3 | ❌ Phase 2 |
| 19 | **SOS Emergency** | Emergency booking, find nearest clinic, priority queue | 5 | ✅ In Scope |

**Total Backend Endpoints:** ~90+

---

## 2. AI Service Modules (FastAPI + LangGraph)

| No | Module | Description | Status |
|----|--------|-------------|:------:|
| 01 | **Single Agent (ReAct)** | LangGraph-based agent with Thought → Action → Observation loop | ✅ Done |
| 02 | **MCP Tools** | FastMCP tools: pet_knowledge_search, web_search, search_clinics_nearby, check_available_slots, create_booking_for_user | 🔄 Partial |
| 03 | **RAG Engine** | LlamaIndex + Cohere embeddings + Qdrant Cloud | ✅ Done |
| 04 | **Agent Config** | Admin UI for prompt, hyperparameters, model selection | ✅ Done |
| 05 | **Tool Management** | Enable/disable tools, view schemas | ✅ Done |
| 06 | **Knowledge Base** | Upload/delete documents, indexing status | ✅ Done |
| 07 | **Agent Playground** | Interactive chat testing with ReAct trace | ✅ Done |
| 08 | **WebSocket Chat** | Real-time streaming responses | ✅ Done |
| 09 | **AI Vision Analysis** | Image-based pet health analysis & alerts | ✅ In Scope |
| 10 | **Query Expander** | LLM-based short query expansion trước khi search RAG | ✅ Done |
| 12 | **Case Memory** | Confirmed case storage trong Qdrant với quality-gated re-ranking và disease support metrics | ✅ Done |
| 13 | **Feedback Service** | Thu thập feedback, auto-classify, auto-embed positive cases | ✅ Done |
| 14 | **Hybrid RAG Engine** | Tổng hợp RAG + Case Memory với parallel search | ✅ Done |

---

## 3. Web Frontend Modules (React)

| No | Module | Role(s) | Description | Status |
|----|--------|---------|-------------|:------:|
| 01 | **Auth Pages** | All | Login, Register, Forgot/Reset Password, OTP | ✅ Done |
| 02 | **Onboarding** | Public | Landing page, features, CTA | ✅ Done |
| 03 | **Admin Dashboard** | ADMIN | System stats, user/clinic overview | ✅ Done |
| 04 | **Clinic Approval** | ADMIN | Pending clinics, approve/reject workflow | ✅ Done |
| 05 | **AI Agent Config** | ADMIN | Prompt editor, hyperparameters, model selector | ✅ Done |
| 06 | **Tool Management** | ADMIN | Tools list, enable/disable toggle | ✅ Done |
| 07 | **Knowledge Base** | ADMIN | Document upload, indexing, RAG testing | ✅ Done |
| 08 | **Agent Playground** | ADMIN | Chat simulator, ReAct trace viewer | ✅ Done |
| 09 | **Owner Dashboard** | CLINIC_OWNER | Clinic stats, revenue, quick actions | ✅ Done |
| 10 | **Clinic CRUD** | CLINIC_OWNER | Create/edit/delete clinics, images, hours | ✅ Done |
| 11 | **Master Services** | CLINIC_OWNER | Create/manage service catalog | ✅ Done |
| 12 | **Clinic Services** | CLINIC_OWNER | Inherit/custom services, pricing | ✅ Done |
| 13 | **Staff Management** | CO, CM | Quick add, deactivate, list staff | ✅ Done |
| 14 | **Manager Dashboard** | CLINIC_MANAGER | Today's bookings, pending tasks | ✅ Done |
| 15 | **Calendar View** | CLINIC_MANAGER | Weekly/daily calendar, shift creation, block/unblock slots | ✅ Done |
| 16 | **Booking Management** | CLINIC_MANAGER | Booking list, assign vet, status tracking | ⏳ Pending |
| 17 | **Chat System** | CM, STAFF | Conversations list, chat room | ⏳ Pending |
| 18 | **Staff Dashboard** | STAFF | Schedule, assigned bookings, quick actions | ✅ Done |
| 19 | **Staff Booking Actions** | STAFF | View assigned, check-in/out | ⏳ Pending |
| 20 | **Patient Management** | CM, STAFF | Patient lookup, EMR history (read-only for CM) | ❌ Phase 2 |
| 21 | **Profile Page** | All | View/edit profile, avatar, password | ✅ Done |
| 22 | **Notifications** | All | Notification list, mark read | ✅ Done |

---

## 4. Mobile Frontend Modules (Flutter)

| No | Module | Role(s) | Description | Status |
|----|--------|---------|-------------|:------:|
| 01 | **Auth Screens** | All | Login, Register, Forgot/Reset Password, OTP | ✅ Done |
| 02 | **Onboarding** | All | App introduction slides | ✅ Done |
| 03 | **Pet Owner Home** | PET_OWNER | Quick actions, AI chat entry, bookings | ✅ Done |
| 04 | **Pet Management** | PET_OWNER | Pet list, add/edit/delete, photo | ✅ Done |
| 05 | **Clinic Discovery** | PET_OWNER | Map view, nearby clinics, search/filters | ⏳ Pending |
| 06 | **Clinic Detail** | PET_OWNER | Clinic info, services, reviews, book button | ⏳ Pending |
| 07 | **Booking Flow** | PET_OWNER | Service selection → Slot picker → Confirm → Success | ⏳ Pending |
| 08 | **My Bookings** | PET_OWNER | Bookings list, detail, cancel, additional services view | ⏳ Pending |
| 09 | **AI Chat** | PET_OWNER | Chat with AI assistant, tool calls, citations | ⏳ Pending |
| 10 | **Chat (1-1)** | PET_OWNER | Chat with Manager/Staff | ⏳ Pending |
| 11 | **EMR Viewer** | PET_OWNER | View pet medical records | ❌ Phase 2 |
| 12 | **Vaccination Viewer** | PET_OWNER | View vaccination history | ❌ Phase 2 |
| 13 | **Home Visit Tracking** | PET_OWNER | Realtime GPS tracking of vet | ❌ Phase 2 |
| 14 | **SOS Emergency** | PET_OWNER | Emergency booking, track rescue vet, ETA | ✅ Confirmed |
| 15 | **Staff Home** | STAFF | Today's appointments, quick stats | ✅ Done |
| 16 | **Staff Schedule** | STAFF | Calendar view, shift info, view-only slots | ✅ Done |
| 17 | **Staff Bookings** | STAFF | Assigned bookings, view details, check-in/out, add incurred services | ⏳ Pending |
| 18 | **EMR Creation** | STAFF | Create/edit medical records | ❌ Phase 2 |
| 19 | **Vaccination Entry** | STAFF | Add vaccination records | ❌ Phase 2 |
| 20 | **Staff Chat** | STAFF | Chat with Pet Owner | ⏳ Pending |
| 21 | **SOS Response** | STAFF | Start emergency travel, GPS broadcast, mark arrived | ✅ Confirmed |
| 22 | **Profile Screen** | All | View/edit profile, avatar, password | ✅ Done |
| 23 | **Notifications** | All | Push notifications, in-app list | ⏳ Pending |

---

## 5. Cross-Cutting Features

| No | Feature | Description | Platforms | Status |
|----|---------|-------------|-----------|:------:|
| 01 | **JWT Authentication** | Stateless auth with access/refresh tokens | All | ✅ Done |
| 02 | **Role-Based Access Control** | 5 roles: PET_OWNER, STAFF, CLINIC_MANAGER, CLINIC_OWNER, ADMIN | All | ✅ Done |
| 03 | **OTP Verification** | Email OTP for registration, password reset, email change | All | ✅ Done |
| 04 | **File Upload** | Cloudinary for images (avatars, pets, clinics) | All | ✅ Done |
| 05 | **Push Notifications** | Firebase FCM for booking updates, reminders | Mobile | ⏳ Pending |
| 06 | **In-App Notifications** | Notification center with read/unread | All | ✅ Done |
| 07 | **WebSocket Realtime** | Chat (1-1), AI chat streaming, GPS tracking | All | 🔄 Partial |
| 08 | **Dynamic Pricing** | Base price + weight tiers + distance fees | BE + Mobile | ✅ Done |
| 09 | **Shared EMR** | Medical records accessible across clinics | All | ❌ Phase 2 |
| 10 | **Shared Vaccination** | Vaccination history shared across clinics | All | ❌ Phase 2 |
| 11 | **Slot Management** | Auto-generate 30-min slots from shifts | BE + Web | ⏳ Pending |
| 12 | **Booking State Machine** | PENDING → CONFIRMED → IN_PROGRESS → COMPLETED | All | ⏳ Pending |
| 13 | **Error Handling** | Centralized with Vietnamese messages | All | ✅ Done |
| 14 | **Neobrutalism Design** | Consistent UI design system | Web + Mobile | ✅ Done |
| 15 | **Incurred Services** | Staff can add extra services during examination | BE + Mobile | ⏳ Pending |
| 16 | **SOS GPS Tracking** | Real-time GPS for emergency rescue only | All | ✅ Confirmed |

---

---

## 6. Deferred Features (Phase 2)

| No | Feature | Reason | Priority |
|----|---------|--------|:--------:|
| 03 | Video Consultation | WebRTC phức tạp | Low |
| 04 | Single Agent + ReAct enhancements | Continue hardening current architecture | Low |
| 05 | Email/SMS Notifications | Push đủ cho MVP | Medium |
| 06 | Multi-language | Defer sau MVP | Low |

---

## 7. Role-Platform Matrix

| Role | Web | Mobile | Primary Use Cases |
|------|:---:|:------:|-------------------|
| **PET_OWNER** | - | ✅ | Book appointments, manage pets, chat with AI, view EMR, SOS emergency |
| **STAFF** | ✅ | ✅ | Manage schedule, view assigned bookings, create EMR, add incurred services, chat, SOS response |
| **CLINIC_MANAGER** | ✅ | - | Assign staff, manage bookings, view calendar, chat |
| **CLINIC_OWNER** | ✅ | - | Manage clinics, services, pricing, staff, view revenue |
| **ADMIN** | ✅ | - | Approve clinics, configure AI agent, manage system |

---

## 8. Summary Statistics

| Category | Total | Done | In Progress | Pending | Phase 2 |
|----------|:-----:|:----:|:-----------:|:-------:|:-------:|
| Backend Modules | 19 | 12 | 1 | 0 | 6 |
| AI Service Modules | 14 | 12 | 2 | 0 | 0 |
| Web Frontend Modules | 22 | 19 | 1 | 1 | 1 |
| Mobile Frontend Modules | 23 | 11 | 2 | 3 | 7 |
| Cross-Cutting Features | 16 | 12 | 1 | 0 | 3 |
| **TOTAL** | **94** | **66** | **7** | **4** | **17** |

**Overall Progress:** ~85.1% Complete (Based on 96/113 Use Cases)

---

## 9. API Endpoints Summary

| Service | Endpoint Count | Base Path |
|---------|:--------------:|-----------|
| Spring Boot Backend | ~90 | `/api/*` |
| AI Agent Service | ~21 + WebSocket | `/ai/*` |
| **Total** | **~105** | - |

---

## 10. UI Pages/Screens Summary

| Platform | Page/Screen Count |
|----------|:-----------------:|
| Web (React) | 22 modules |
| Mobile (Flutter) | 23 modules |
| **Total** | **45 modules** |

---

**Document Version:** 1.7.0
**Last Updated:** 2026-03-11
**Change Note:** Added 4 AI Service modules (Query Expander, Case Memory, Feedback Service, Hybrid RAG Engine)
**Prepared by:** Petties Development Team
**References:**
- `PETTIES_Features.md` - Feature specifications
- `WBS_PETTIES_14_SPRINTS.md` - Sprint planning & timeline
- `REPORT_4_SDD_SYSTEM_DESIGN.md` - System architecture
- `SRS/PETTIES_SRS.md` - Software Requirements Specification
