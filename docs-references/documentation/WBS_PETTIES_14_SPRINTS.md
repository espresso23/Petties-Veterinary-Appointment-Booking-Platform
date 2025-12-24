# PROJECT WORK BREAKDOWN STRUCTURE (EXPANDED)
## PETTIES - Veterinary Appointment Booking Platform

**Project Duration:** 14 Sprints (1 Week/Sprint)
**Timeline:** 10/12/2025 - 18/03/2026
**Strategy:** Complete 80% Core Business Features by Sprint 6. 

---

## 🔄 Sprint Development Workflow (Per Feature)
Mỗi đầu mục bao gồm trọn gói: **Backend (API)**, **Frontend (UI)**, **Docs** và **Test**.

---

| Sprint | Product Backlog Item (Feature Details) | Platform | PIC | Level | Est (h) | Status |
| :--- | :--- | :---: | :---: | :---: | :---: | :--- |
| **Sprint 1** | **Setup & Infrastructure** | All | All | Complex | 80 | **Done** |
| | | | | | | |
| **Sprint 2** | **Pet & Clinic Management** | | | | | |
| | 1. **[BE]** Pet CRUD & Photo Upload (Cloudinary) | Backend | Triết | Medium | 8 | Pending |
| | 2. **[Mobile]** Màn hình Danh sách & Thêm/Sửa Thú cưng | Mobile | Uyên | Medium | 16 | Pending |
| | 3. **[BE]** Clinic Profile & Operating Hours APIs | Backend | Triết | Medium | 6 | Pending |
| | 4. **[Web]** Form cấu hình Profile & Giờ mở cửa (Owner) | Web | Huyền | Medium | 10 | Pending |
| | 5. **[BE]** Service CRUD & Complex Pricing Logic (KM/Weight) | Backend | Triết | Complex| 14 | **Done** |
| | 6. **[Web]** Quản lý Dịch vụ & Modal cấu hình giá tầng (Owner)| Web | Huyền | Complex| 16 | Pending |
| | | | | | | |
| **Sprint 3** | **Staff & Scheduling** | | | | | |
| | 1. **[BE]** Staff Management (Quick Add, Role API) | Backend | Tân | Medium | 6 | **Done** |
| | 2. **[Web]** Màn hình Quản lý & Quick Add nhân viên (Owner) | Web | Tân | Medium | 14 | Pending |
| | 3. **[BE]** VetShift CRUD & Logic tự động chia Slot 30p | Backend | Tuân | Complex| 16 | Pending |
| | 4. **[Web]** Calendar View: Quản lý Ca làm việc (Manager) | Web | Huyền | Complex| 16 | Pending |
| | 5. **[Mobile]** Màn hình Lịch làm việc cá nhân (Vet) | Mobile | Uyên | Medium | 12 | Pending |
| | 6. **[BE]** Logic kiểm tra Overlap ca làm (Security Check) | Backend | Tuân | Medium | 8 | Pending |
| | | | | | | |
| **Sprint 4** | **Booking System - The Core Flow** | | | | | |
| | 1. **[BE]** Search APIs (Filter theo vị trí, dịch vụ, bác sĩ) | Backend | Triết | Complex| 16 | Pending |
| | 2. **[Mobile]** Màn hình Khám phá: Search, Map & Lọc Clinic | Mobile | Uyên | Complex| 16 | Pending |
| | 3. **[BE]** Slot Availability & Flow tạo Booking (PENDING) | Backend | Triết | Complex| 16 | Pending |
| | 4. **[Mobile]** Màn hình Chi tiết Clinic & Chọn Slot đặt lịch | Mobile | Uyên | Complex| 20 | Pending |
| | 5. **[BE]** Booking State Machine (Status Transitions) | Backend | Triết | Medium | 16 | Pending |
| | | | | | | |
| **Sprint 5** | **EMR & Medical Operations** | | | | | |
| | 1. **[BE]** Hồ sơ bệnh án (EMR) & Đơn thuốc (Prescription) | Backend | Tuân | Complex| 16 | Pending |
| | 2. **[Mobile]** Màn hình Vet: Tiếp nhận khám & Nhập EMR/Đơn thuốc| Mobile | Uyên | Complex| 24 | Pending |
| | 3. **[Mobile]** Màn hình Owner: Theo dõi bệnh án & Sổ tiêm chủng | Mobile | Uyên | Medium | 16 | Pending |
| | 4. **[BE]** Notification Engine (Firebase Push Event Log) | Backend | Tuân | Medium | 24 | Pending |
| | 5. **[Web]** Dashboard: Quản lý Luồng khám (Check-in/Out UI) | Web | Huyền | Medium | 12 | Pending |
| | | | | | | |
| **Sprint 6** | **Payment & Feedback** | | | | | |
| | 1. **[BE]** Stripe Integration (Payment Intent & Webhook) | Integration| Tuân | Complex| 24 | Pending |
| | 2. **[Mobile]** Luồng Thanh toán Online & Lịch sử giao dịch | Mobile | Uyên | Medium | 16 | Pending |
| | 3. **[BE]** Review & Rating APIs (Post-completed) | Backend | Triết | Simple | 8 | Pending |
| | 4. **[Mobile]** Màn hình Đánh giá Bác sĩ/Phòng khám | Mobile | Uyên | Simple | 8 | Pending |
| | 5. **[Mobile]** Tính năng SOS: Tìm Clinic cấp cứu gần nhất | Mobile | Uyên | Medium | 20 | Pending |
| | | | | | | |
| **Sprint 7** | **AI Layer Foundation** | | | | | |
| | 1. **[BE]** LangGraph Multi-Agent Supervisor Setup | AI | Tân | Complex| 40 | Pending |
| | 2. **[BE]** AI Toolset: API tạo Booking qua Chat | Integration| Tân | Complex| 24 | Pending |
| | 3. **[Mobile]** Giao diện AI Chatbot: Message, Citation, Tool Call| Mobile | Uyên | Complex| 16 | Pending |
| | | | | | | |
| **Sprint 8** | **AI Advanced & RAG** | | | | | |
| | 1. **[BE]** RAG Pipeline (Qdrant, Doc Indexing, Vector Search) | AI | Tân | Complex| 32 | Pending |
| | 2. **[Web]** Admin: Dashboard quản lý Prompt & Kho kiến thức AI | Web | Huyền | Medium | 20 | Pending |
| | | | | | | |
| **Sprint 9** | **Analytics & Refinement** | | | | | |
| | 1. **[Web]** Dashboard Doanh thu: Chart, Báo cáo (Owner) | Web | Huyền | Medium | 24 | Pending |
| | 2. **[BE]** Excel Import (Batch Schedule - Phase 2) | Backend | Tuân | Complex| 16 | Pending |
| | 3. **[All]** UI/UX Polish: Animations & Final Tweak | All | Low | 20 | Pending |
| | | | | | | |
| **Sprint 10** | **Advanced Comm** | | | | | |
| | 1. **[All]** Video Consultation (WebRTC/Third-party) | Mobile/Web| Tuân/Uyên| Complex| 32 | Pending |
| | 2. **[BE]** Internal Messaging Service (Owner-Vet-Chat) | Backend | Tân | Medium | 16 | Pending |
| | | | | | | |
| **Sprint 11-14**| **QA & Final Delivery** | | | | | |
| | 1. **[Testing]** End-to-End Testing (Critical Flows) | Testing | All | Complex | 48 | Pending |
| | 2. **[BugFix]** Sprint 11-12 Regression & Fixes | All | All | Medium | 40 | Pending |
| | 3. **[Docs]** Hoàn thiện 7 bản Reports (RP1-RP7) | Docs | All | Medium | 24 | Pending |
| | 4. **[DevOps]** Production Deployment (Server, Domain) | DevOps | Tân | Medium | 16 | Pending |

---

## 📈 Milestone Summary
- **Sprint 2-3**: Pet & Staffing foundation.
- **Sprint 4**: Full Booking Engine.
- **Sprint 5-6**: Medical Hub & Financials (Core completed).
- **Sprint 7-8**: Intelligence (AI) Era.
- **Sprint 9-14**: Polish, QA & Launch.
