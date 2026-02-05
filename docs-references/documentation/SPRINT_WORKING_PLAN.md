# 📅 PETTIES SPRINT WORKING PLAN (12 Sprints)

**Version:** 2.1 | **Updated:** 28/01/2026  
**Team Size:** 5 members | **Sprint Duration:** 1 week  
**Release:** Each sprint has a production release (Agile/Scrum CI/CD)

---

## ✅ SPRINT 1: Setup & Planning (02/12 - 08/12/2025)
**Sprint Goal:** Initialize project, set up development environment and CI/CD

**Deliverables:**
- Repositories (Backend, Frontend, Mobile) initialized
- CI/CD pipeline for Dev + Production environment
- Test framework setup (JUnit, Jest, Flutter Test)
- Report 1: Project Introduction

**Release:** CI/CD pipeline running ✓

---

## ✅ SPRINT 2: Authentication (09/12 - 15/12/2025)
**Sprint Goal:** Build complete authentication system

**Deliverables:**
- Database User/Role schema
- Register with OTP Email
- Login JWT (Access + Refresh Token)
- Google OAuth integration
- Forgot Password + Reset OTP
- Login UI (Web + Mobile)
- Unit tests AuthService ✓

**Release:** Auth module live ✓

---

## ✅ SPRINT 3: User & Pet Profile (16/12 - 22/12/2025)
**Sprint Goal:** Manage personal information and pet profiles

**Deliverables:**
- User Profile CRUD + Avatar upload
- Pet CRUD + Species/Breed management
- Profile pages (Web + Mobile)
- Unit tests User/Pet Service ✓

**Release:** Profile + Pet module live ✓

---

## ✅ SPRINT 4: Clinic Registration (23/12 - 29/12/2025)
**Sprint Goal:** Clinic registration and approval workflow

**Deliverables:**
- Clinic Registration + Admin Approval flow
- Master Services + Custom Pricing
- Admin Dashboard
- Report 3: ERD, Context Diagram
- Integration tests Approval flow ✓

**Release:** Clinic module live ✓

---

## ✅ SPRINT 5: Staff & Scheduling (30/12 - 12/01/2026)
**Sprint Goal:** Staff management and shift scheduling system

**Deliverables:**
- Quick Add Staff + Role assignment
- Staff management table (Web)
- Shift creation + Auto-generate 30min Slots
- Block/Unblock Slot
- Shift calendar view (Web)
- Staff schedule view (Mobile)
- Report 4: Package Diagram
- Unit tests ClinicStaffService, ShiftService ✓

**Release:** Staff + Schedule module live ✓

---

## ✅ SPRINT 6: Notifications & Chat (13/01 - 19/01/2026)
**Sprint Goal:** Notification system and real-time chat

**Deliverables:**
- Push Notification (FCM)
- SSE Real-time for Web
- Notification Center
- P2P Chat WebSocket
- FCM + WebSocket tests ✓

**Release:** Notification + Chat module live ✓

---

## ✅ SPRINT 7: Booking + Payment (Full Workflow) (20/01 - 02/02/2026)
**Sprint Goal:** Complete booking and payment workflow

**Deliverables:**
- Booking CRUD + Multi-service support
- Pricing logic (Weight/Distance)
- Status flow: PENDING → CONFIRMED → ASSIGNED → IN_PROGRESS → COMPLETED
- Check-in/Checkout APIs
- Reassign Staff API
- Payment (Cash/QR)
- Nearby clinic search (Haversine) + Clinic detail
- Booking dashboard (Manager Web)
- Booking wizard + Staff Check-in/Checkout (Mobile)
- E2E tests Booking + Payment flow ✓

**Release:** Booking + Payment module live ✓

---

## 🔄 SPRINT 8: EMR + Patient Management (03/02 - 09/02/2026)
**Sprint Goal:** Electronic Medical Records and patient (Pet) management

**Deliverables:**
- EMR SOAP Notes (MongoDB)
- Prescription management
- Vaccination Record tracking
- **Staff View:** Staff views Pet info + medical history before examination
- **Pet Owner View:** Pet Owner views Pet's medical history
- **Patient Timeline:** EMR aggregation per Pet (cross-clinic)
- EMR form Web + View Mobile
- Unit tests EmrService ✓

**Release:** EMR + Patient module live ✓

---

## 💡 SPRINT 9: Reviews & Rating (10/02 - 16/02/2026)
**Sprint Goal:** Clinic and Staff review system

**Deliverables:**
- Review Clinic/Staff system
- Rating aggregation
- Review UI (Web + Mobile)
- Integration tests Review flow ✓

**Release:** Review module live ✓

---

## 💡 SPRINT 10: SOS Booking (17/02 - 23/02/2026)
**Sprint Goal:** Emergency booking system

**Deliverables:**
- SOS Booking with high priority
- Find nearest emergency clinic
- GPS Tracking (Redis + WebSocket)
- SOS screens (Mobile)
- GPS + SOS flow tests ✓

**Release:** SOS module live ✓

---

## 💡 SPRINT 11: AI Integration (24/02 - 02/03/2026)
**Sprint Goal:** AI chatbot and RAG integration

**Deliverables:**
- LlamaIndex + Qdrant RAG setup
- AI Chat Q&A endpoint
- Symptom checker logic
- AI Chat screen (Mobile)
- RAG retrieval tests ✓

**Release:** AI module live ✓

---

## 💡 SPRINT 12: Final Report & Defense (03/03 - 09/03/2026)
**Sprint Goal:** Finalize documentation and prepare for defense

**Deliverables:**
- UI/UX polish + Performance optimization
- Report 6: User Manual
- Reports 1-7 finalized
- Full regression tests ✓
- Mobile builds (APK/IPA) for demo
- Presentation slides
- Defense rehearsal

---

## 📊 Sprint Summary

| Sprint | Status | Focus | Release |
|--------|--------|-------|---------|
| S1-S7 | ✅ Done | Auth, Pet, Clinic, Staff, Schedule, Notification, Chat, Booking, Payment | Live |
| S8 | 🔄 Current | EMR + Patient Management | In progress |
| S9-S12 | 💡 Planned | Reviews, SOS, AI, Defense | Planned |
