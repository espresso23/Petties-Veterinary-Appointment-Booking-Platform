# PETTIES - Complete Module Overview

**Document Purpose:** Tổng hợp đầy đủ các module/feature của project Petties khi hoàn thành
**For:** Stakeholder review, scope verification, team alignment
**Last Updated:** 2025-12-31

---

## 1. Backend Modules (Spring Boot)

| No | Module | Description | APIs | Status |
|----|--------|-------------|:----:|:------:|
| 01 | **Authentication** | Đăng ký, đăng nhập, OAuth, OTP, JWT refresh | 8 | ✅ Done |
| 02 | **User Management** | Profile, avatar, change password/email | 7 | ✅ Done |
| 03 | **Pet Management** | CRUD pets, upload photo | 6 | ✅ Done |
| 04 | **Clinic Management** | CRUD clinics, approval workflow, images, search | 12 | ✅ Done |
| 05 | **Service Management** | Master services (Admin), Clinic services (Owner) | 8 | ✅ Done |
| 06 | **Pricing** | Dynamic pricing rules, price calculation | 3 | ✅ Done |
| 07 | **Staff Management** | Quick add staff, deactivate, list | 4 | ✅ Done |
| 08 | **VetShift & Slot** | Create shifts, auto-generate 30-min slots, block/unblock | 7 | ⏳ Pending |
| 09 | **Booking** | Create, assign, approve/reject, check-in/out, cancel | 10 | ⏳ Pending |
| 10 | **Chat (1-1)** | Conversations, messages, WebSocket realtime | 7+WS | ⏳ Pending |
| 11 | **EMR** | Create/view medical records linked to booking | 4 | ❌ Phase 2 |
| 12 | **Vaccination** | Vaccination history, add records linked to booking | 3 | ❌ Phase 2 |
| 13 | **Prescription** | Prescriptions within EMR | 2 | ❌ Phase 2 |
| 14 | **Payment** | Stripe integration, payment intent, webhook | 4 | ❌ Phase 2 |
| 15 | **Rating & Review** | Review clinics and vets after booking | 3 | ❌ Phase 2 |
| 16 | **Notification** | In-app notifications, FCM push, preferences | 6 | ⏳ Pending |
| 17 | **Search & Discovery** | Nearby clinics, keyword search, geocoding | 3 | ⏳ Pending |
| 18 | **Home Visit Tracking** | GPS realtime tracking for home visits | 3 | ❌ Phase 2 |

**Total Backend Endpoints:** ~90+

---

## 2. AI Service Modules (FastAPI + LangGraph)

| No | Module | Description | Status |
|----|--------|-------------|:------:|
| 01 | **Single Agent (ReAct)** | LangGraph-based agent with Thought → Action → Observation loop | ✅ Done |
| 02 | **MCP Tools** | FastMCP tools: pet_care_qa, symptom_search, search_clinics, check_slots, create_booking | 🔄 Partial |
| 03 | **RAG Engine** | LlamaIndex + Cohere embeddings + Qdrant Cloud | ✅ Done |
| 04 | **Agent Config** | Admin UI for prompt, hyperparameters, model selection | ✅ Done |
| 05 | **Tool Management** | Enable/disable tools, view schemas | ✅ Done |
| 06 | **Knowledge Base** | Upload/delete documents, indexing status | ✅ Done |
| 07 | **Agent Playground** | Interactive chat testing with ReAct trace | ✅ Done |
| 08 | **WebSocket Chat** | Real-time streaming responses | ✅ Done |

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
| 15 | **Calendar View** | CLINIC_MANAGER | Weekly/daily calendar, shift creation | ⏳ Pending |
| 16 | **Booking Management** | CLINIC_MANAGER | Booking list, assign vet, status tracking | ⏳ Pending |
| 17 | **Chat System** | CM, VET | Conversations list, chat room | ⏳ Pending |
| 18 | **Vet Dashboard** | VET | Schedule, assigned bookings, quick actions | ✅ Done |
| 19 | **Vet Booking Actions** | VET | Approve/reject, check-in/out | ⏳ Pending |
| 20 | **Patient Management** | CM, VET | Patient lookup, EMR history (read-only for CM) | ❌ Phase 2 |
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
| 08 | **My Bookings** | PET_OWNER | Bookings list, detail, cancel | ⏳ Pending |
| 09 | **AI Chat** | PET_OWNER | Chat with AI assistant, tool calls, citations | ⏳ Pending |
| 10 | **Chat (1-1)** | PET_OWNER | Chat with Manager/Vet | ⏳ Pending |
| 11 | **EMR Viewer** | PET_OWNER | View pet medical records | ❌ Phase 2 |
| 12 | **Vaccination Viewer** | PET_OWNER | View vaccination history | ❌ Phase 2 |
| 13 | **Home Visit Tracking** | PET_OWNER | Realtime GPS tracking of vet | ❌ Phase 2 |
| 14 | **Vet Home** | VET | Today's appointments, quick stats | ✅ Done |
| 15 | **Vet Schedule** | VET | Calendar view, shift info | ⏳ Pending |
| 16 | **Vet Bookings** | VET | Assigned bookings, approve/reject, check-in/out | ⏳ Pending |
| 17 | **EMR Creation** | VET | Create/edit medical records | ❌ Phase 2 |
| 18 | **Vaccination Entry** | VET | Add vaccination records | ❌ Phase 2 |
| 19 | **Vet Chat** | VET | Chat with Pet Owner | ⏳ Pending |
| 20 | **Profile Screen** | All | View/edit profile, avatar, password | ✅ Done |
| 21 | **Notifications** | All | Push notifications, in-app list | ⏳ Pending |

---

## 5. Cross-Cutting Features

| No | Feature | Description | Platforms | Status |
|----|---------|-------------|-----------|:------:|
| 01 | **JWT Authentication** | Stateless auth with access/refresh tokens | All | ✅ Done |
| 02 | **Role-Based Access Control** | 5 roles: PET_OWNER, VET, CLINIC_MANAGER, CLINIC_OWNER, ADMIN | All | ✅ Done |
| 03 | **OTP Verification** | Email OTP for registration, password reset, email change | All | ✅ Done |
| 04 | **File Upload** | Cloudinary for images (avatars, pets, clinics) | All | ✅ Done |
| 05 | **Push Notifications** | Firebase FCM for booking updates, reminders | Mobile | ⏳ Pending |
| 06 | **In-App Notifications** | Notification center with read/unread | All | ✅ Done |
| 07 | **WebSocket Realtime** | Chat (1-1), AI chat streaming, GPS tracking | All | 🔄 Partial |
| 08 | **Dynamic Pricing** | Base price + weight tiers + distance fees | BE + Mobile | ✅ Done |
| 09 | **Shared EMR** | Medical records accessible across clinics | All | ❌ Phase 2 |
| 10 | **Shared Vaccination** | Vaccination history shared across clinics | All | ❌ Phase 2 |
| 11 | **Slot Management** | Auto-generate 30-min slots from shifts | BE + Web | ⏳ Pending |
| 12 | **Booking State Machine** | PENDING → ASSIGNED → CONFIRMED → IN_PROGRESS → COMPLETED | All | ⏳ Pending |
| 13 | **Error Handling** | Centralized with Vietnamese messages | All | ✅ Done |
| 14 | **Neobrutalism Design** | Consistent UI design system | Web + Mobile | ✅ Done |

---

## 6. Deferred Features (Phase 2)

| No | Feature | Reason | Priority |
|----|---------|--------|:--------:|
| 01 | SOS Emergency | Logic phức tạp, cần thêm thời gian | Medium |
| 02 | Video Consultation | WebRTC phức tạp | Low |
| 03 | Excel Import | Manual đủ cho MVP | Low |
| 04 | Multi-Agent Architecture | Simplified to Single Agent | Low |
| 05 | Email/SMS Notifications | Push đủ cho MVP | Medium |
| 06 | Multi-language | Defer sau MVP | Low |

---

## 7. Role-Platform Matrix

| Role | Web | Mobile | Primary Use Cases |
|------|:---:|:------:|-------------------|
| **PET_OWNER** | - | ✅ | Book appointments, manage pets, chat with AI, view EMR |
| **VET** | ✅ | ✅ | Manage schedule, approve bookings, create EMR, chat |
| **CLINIC_MANAGER** | ✅ | - | Assign vets, manage bookings, view calendar, chat |
| **CLINIC_OWNER** | ✅ | - | Manage clinics, services, pricing, staff, view revenue |
| **ADMIN** | ✅ | - | Approve clinics, configure AI agent, manage system |

---

## 8. Summary Statistics

| Category | Total | Done | In Progress | Pending | Phase 2 |
|----------|:-----:|:----:|:-----------:|:-------:|:-------:|
| Backend Modules | 18 | 7 | 0 | 5 | 6 |
| AI Service Modules | 8 | 7 | 1 | 0 | 0 |
| Web Frontend Modules | 22 | 16 | 0 | 5 | 1 |
| Mobile Frontend Modules | 21 | 7 | 0 | 9 | 5 |
| Cross-Cutting Features | 14 | 9 | 1 | 2 | 2 |
| **TOTAL** | **83** | **46** | **2** | **21** | **14** |

**Overall Progress:** ~55% Complete (MVP Sprint 1-6 focus)

---

## 9. API Endpoints Summary

| Service | Endpoint Count | Base Path |
|---------|:--------------:|-----------|
| Spring Boot Backend | ~90 | `/api/*` |
| AI Agent Service | ~15 + WebSocket | `/ai/*` |
| **Total** | **~105** | - |

---

## 10. UI Pages/Screens Summary

| Platform | Page/Screen Count |
|----------|:-----------------:|
| Web (React) | 22 modules |
| Mobile (Flutter) | 21 modules |
| **Total** | **43 modules** |

---

**Document Version:** 1.0
**Prepared by:** Petties Development Team
**References:**
- `PETTIES_Features.md` - Feature specifications
- `WBS_PETTIES_14_SPRINTS.md` - Sprint planning & timeline
- `REPORT_4_SDD_SYSTEM_DESIGN.md` - System architecture
