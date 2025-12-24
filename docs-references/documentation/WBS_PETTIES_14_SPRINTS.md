# PROJECT WORK BREAKDOWN STRUCTURE (EXPANDED)
## PETTIES - Veterinary Appointment Booking Platform

**Project Duration:** 14 Sprints (1 Week/Sprint)
**Timeline:** 10/12/2025 - 18/03/2026
**Strategy:** Complete 80% Core Business Features by Sprint 6.
**Last Updated:** December 25, 2025

---

## 🔄 Sprint Development Workflow (Per Feature)
Mỗi đầu mục bao gồm trọn gói: **Backend (API)**, **Frontend (UI)**, **Docs** và **Test**.

### Status Legend:
| Status | Meaning |
|--------|---------|
| ✅ Done | Hoàn thành cả BE + FE + Test |
| 🔶 BE Done | Chỉ có Backend, thiếu Frontend |
| 🔷 FE Done | Chỉ có Frontend, thiếu Backend |
| 🔄 In Progress | Đang làm |
| ⏳ Pending | Chưa bắt đầu |
| ❌ Deferred | Hoãn sang Phase 2 |

---

| Sprint | Product Backlog Item (Feature Details) | Platform | PIC | Level | Est (h) | Status | Missing |
| :--- | :--- | :---: | :---: | :---: | :---: | :--- | :--- |
| **Sprint 1** | **Setup & Infrastructure** | All | All | Complex | 80 | **✅ Done** | - |
| | 1. Login/Register (Email + Google) | All | Tân | Medium | 16 | ✅ Done | - |
| | 2. JWT Auth + Spring Security | Backend | Tân | Complex | 16 | ✅ Done | - |
| | 3. OTP Verification (Email) | Backend | Tân | Medium | 8 | ✅ Done | - |
| | 4. User Profile CRUD + Avatar Upload | All | Tân | Medium | 12 | ✅ Done | - |
| | 5. Frontend Auth Flow (Web + Mobile) | Frontend | Huyền/Uyên | Medium | 16 | ✅ Done | - |
| | 6. Docker + CI/CD Setup | DevOps | Tân | Medium | 12 | ✅ Done | - |
| | | | | | | | |
| **Sprint 2** | **Pet & Clinic Management** | | | | | | |
| | 1. **[BE]** Pet CRUD & Photo Upload (Cloudinary) | Backend | Triết | Medium | 8 | ⏳ Pending | BE + FE + Test |
| | 2. **[Mobile]** Màn hình Danh sách & Thêm/Sửa Thú cưng | Mobile | Uyên | Medium | 16 | ⏳ Pending | FE + Test |
| | 3. **[BE]** Clinic Profile & Operating Hours APIs | Backend | Triết | Medium | 6 | 🔶 BE Done | FE (Hours UI) |
| | 4. **[Web]** Form cấu hình Profile & Giờ mở cửa (Owner) | Web | Huyền | Medium | 10 | 🔷 Partial | Hours editor UI |
| | 5. **[BE]** Service CRUD & Complex Pricing Logic (KM/Weight) | Backend | Triết | Complex| 14 | **✅ Done** | - |
| | 6. **[Web]** Quản lý Dịch vụ & Modal cấu hình giá tầng (Owner)| Web | Huyền | Complex| 16 | **✅ Done** | - |
| | | | | | | | |
| **Sprint 3** | **Staff & Scheduling** | | | | | | |
| | 1. **[BE]** Staff Management (Quick Add, Role API) | Backend | Tân | Medium | 6 | **✅ Done** | - |
| | 2. **[Web]** Màn hình Quản lý & Quick Add nhân viên (Owner) | Web | Tân | Medium | 14 | 🔄 In Progress | List UI thiếu |
| | 3. **[BE]** VetShift CRUD & Logic tự động chia Slot 30p | Backend | Tuân | Complex| 16 | ⏳ Pending | BE + FE + Test |
| | 4. **[Web]** Calendar View: Quản lý Ca làm việc (Manager) | Web | Huyền | Complex| 16 | ⏳ Pending | FE thiếu |
| | 5. **[Mobile]** Màn hình Lịch làm việc cá nhân (Vet) | Mobile | Uyên | Medium | 12 | ⏳ Pending | Mobile FE |
| | 6. **[BE]** Logic kiểm tra Overlap ca làm (Security Check) | Backend | Tuân | Medium | 8 | ⏳ Pending | BE logic |
| | | | | | | | |
| **Sprint 4** | **Booking System - The Core Flow** | | | | | | |
| | 1. **[BE]** Search APIs (Filter theo vị trí, dịch vụ, bác sĩ) | Backend | Triết | Complex| 16 | ⏳ Pending | BE + FE |
| | 2. **[Mobile]** Màn hình Khám phá: Search, Map & Lọc Clinic | Mobile | Uyên | Complex| 16 | ⏳ Pending | Mobile FE |
| | 3. **[BE]** Slot Availability & Flow tạo Booking (PENDING) | Backend | Triết | Complex| 16 | ⏳ Pending | BE Core |
| | 4. **[Mobile]** Màn hình Chi tiết Clinic & Chọn Slot đặt lịch | Mobile | Uyên | Complex| 20 | ⏳ Pending | Mobile FE |
| | 5. **[BE]** Booking State Machine (Status Transitions) | Backend | Triết | Medium | 16 | ⏳ Pending | BE Core |
| | | | | | | | |
| **Sprint 5** | **EMR & Medical Operations** | | | | | | |
| | 1. **[BE]** Hồ sơ bệnh án (EMR) & Đơn thuốc (Prescription) | Backend | Tuân | Complex| 16 | ⏳ Pending | BE + FE |
| | 2. **[Mobile]** Màn hình Vet: Tiếp nhận khám & Nhập EMR/Đơn thuốc| Mobile | Uyên | Complex| 24 | ⏳ Pending | Mobile FE |
| | 3. **[Mobile]** Màn hình Owner: Theo dõi bệnh án & Sổ tiêm chủng | Mobile | Uyên | Medium | 16 | ⏳ Pending | Mobile FE |
| | 4. **[BE]** Notification Engine (Firebase Push Event Log) | Backend | Tuân | Medium | 24 | ⏳ Pending | BE + Test |
| | 5. **[Web]** Dashboard: Quản lý Luồng khám (Check-in/Out UI) | Web | Huyền | Medium | 12 | ⏳ Pending | Web FE |
| | | | | | | | |
| **Sprint 6** | **Payment & Feedback** | | | | | | |
| | 1. **[BE]** Stripe Integration (Payment Intent & Webhook) | Integration| Tuân | Complex| 24 | ⏳ Pending | BE + Test |
| | 2. **[Mobile]** Luồng Thanh toán Online & Lịch sử giao dịch | Mobile | Uyên | Medium | 16 | ⏳ Pending | Mobile FE |
| | 3. **[BE]** Review & Rating APIs (Post-completed) | Backend | Triết | Simple | 8 | ⏳ Pending | BE + FE |
| | 4. **[Mobile]** Màn hình Đánh giá Bác sĩ/Phòng khám | Mobile | Uyên | Simple | 8 | ⏳ Pending | Mobile FE |
| | 5. **[Mobile]** Tính năng SOS: Tìm Clinic cấp cứu gần nhất | Mobile | Uyên | Medium | 20 | **❌ Deferred** | Phase 2 |
| | | | | | | | |
| **Sprint 7** | **AI Layer Foundation** | | | | | | |
| | 1. **[BE]** LangGraph Single Agent + ReAct Setup | AI | Tân | Complex| 40 | ⏳ Pending | AI Core |
| | 2. **[BE]** AI Toolset: API tạo Booking qua Chat | Integration| Tân | Complex| 24 | ⏳ Pending | AI Tools |
| | 3. **[Mobile]** Giao diện AI Chatbot: Message, Citation, Tool Call| Mobile | Uyên | Complex| 16 | ⏳ Pending | Mobile FE |
| | | | | | | | |
| **Sprint 8** | **AI Advanced & RAG** | | | | | | |
| | 1. **[BE]** RAG Pipeline (Qdrant, Doc Indexing, Vector Search) | AI | Tân | Complex| 32 | ⏳ Pending | AI RAG |
| | 2. **[Web]** Admin: Dashboard quản lý Prompt & Kho kiến thức AI | Web | Huyền | Medium | 20 | ⏳ Pending | Web FE |
| | | | | | | | |
| **Sprint 9** | **Analytics & Refinement** | | | | | | |
| | 1. **[Web]** Dashboard Doanh thu: Chart, Báo cáo (Owner) | Web | Huyền | Medium | 24 | **❌ Deferred** | Phase 2 |
| | 2. **[BE]** Excel Import (Batch Schedule - Phase 2) | Backend | Tuân | Complex| 16 | **❌ Deferred** | Phase 2 |
| | 3. **[All]** UI/UX Polish: Animations & Final Tweak | All | All | Low | 20 | ⏳ Pending | Polish |
| | | | | | | | |
| **Sprint 10** | **Advanced Comm** | | | | | | |
| | 1. **[All]** Video Consultation (WebRTC/Third-party) | Mobile/Web| Tuân/Uyên| Complex| 32 | **❌ Deferred** | Phase 2 |
| | 2. **[BE]** Internal Messaging Service (Owner-Vet-Chat) | Backend | Tân | Medium | 16 | ⏳ Pending | BE + FE |
| | | | | | | | |
| **Sprint 11-14**| **QA & Final Delivery** | | | | | | |
| | 1. **[Testing]** End-to-End Testing (Critical Flows) | Testing | All | Complex | 48 | ⏳ Pending | - |
| | 2. **[BugFix]** Sprint 11-12 Regression & Fixes | All | All | Medium | 40 | ⏳ Pending | - |
| | 3. **[Docs]** Hoàn thiện 7 bản Reports (RP1-RP7) | Docs | All | Medium | 24 | 🔄 In Progress | RP3-RP7 |
| | 4. **[DevOps]** Production Deployment (Server, Domain) | DevOps | Tân | Medium | 16 | **✅ Done** | - |

---

## 📊 PROGRESS SUMMARY

| Status | Count | Percentage |
|--------|:-----:|:----------:|
| ✅ Done | 10 | 20% |
| 🔶 BE Done | 1 | 2% |
| 🔄 In Progress | 2 | 4% |
| ⏳ Pending | 33 | 66% |
| ❌ Deferred | 4 | 8% |
| **Total** | 50 | 100% |

---

## 🚨 CRITICAL MISSING ITEMS (Cần ưu tiên)

### Sprint 2 - Chưa hoàn thành:
| Item | Missing | Priority |
|------|---------|:--------:|
| Pet CRUD | BE + FE + Test | 🔴 High |
| Clinic Operating Hours UI | FE form | 🟡 Medium |

### Sprint 3 - Chưa hoàn thành:
| Item | Missing | Priority |
|------|---------|:--------:|
| Staff List UI (Web) | FE component | 🟡 Medium |
| VetShift CRUD + Slot 30p | BE + FE | 🔴 High |
| Calendar View (Manager) | Web FE | 🔴 High |
| Vet Schedule (Mobile) | Mobile FE | 🔴 High |
| Overlap Check Logic | BE logic | 🟡 Medium |

### Sprint 4 - Chưa bắt đầu:
| Item | Missing | Priority |
|------|---------|:--------:|
| Search APIs | BE + FE | 🔴 High (Core) |
| Clinic Discovery UI | Mobile FE | 🔴 High (Core) |
| Slot Availability API | BE Core | 🔴 High (Core) |
| Booking State Machine | BE Core | 🔴 High (Core) |

---

## 📅 RECOMMENDED NEXT STEPS

1. **Ngay lập tức:** Hoàn thành Sprint 2-3 (Pet, VetShift, Calendar)
2. **Tiếp theo:** Sprint 4 - Booking Core Flow (QUAN TRỌNG NHẤT)
3. **Song song:** Sprint 7 - AI Setup (có thể làm độc lập)

---

## 📈 Milestone Summary
- **Sprint 1**: ✅ Setup & Auth complete.
- **Sprint 2-3**: 🔄 Pet & Staffing foundation (60% done).
- **Sprint 4**: ⏳ Full Booking Engine (NOT STARTED).
- **Sprint 5-6**: ⏳ Medical Hub & Financials.
- **Sprint 7-8**: ⏳ Intelligence (AI) Era.
- **Sprint 9-14**: ⏳ Polish, QA & Launch.

