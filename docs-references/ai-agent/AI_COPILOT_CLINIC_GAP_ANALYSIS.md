# AI Assistant Clinic - Gap Analysis & Refined Plan

## Executive Summary

**Current State:**
- Plan document (2720 lines) có nhiều nội dung không khớp với code thật
- Scope bị trộn lẫn: clinic setup + analytics + workspace redesign
- API paths sai, UI dùng emoji vi phạm design guide

**Recommended Actions:**
1. Tách 3 scope riêng biệt
2. Verify API paths với backend code
3. Viết lại traceability table
4. Refine Phase 0 chỉ tập trung generate_clinic_services

---

## 1. Scope Separation

### Package A: Clinic Setup AI (PRIORITY - Theo SRS 3.13.1)
- Chỉ dành cho CLINIC_OWNER
- Flow: Setup form → AI generate → Review/Save → Save to DB
- Scope: generate_clinic_services + review/save flow

### Package B: Manager Analytics Assistant
- Cho CLINIC_MANAGER/CLINIC_OWNER
- Dùng Business Chat + UISchema (chưa cần workspace)
- Scope: Xem metrics, revenue, shifts (read-only hoặc HITL write)

### Package C: Workspace Redesign (FUTURE)
- Full Notion-style workspace
- Cần architecture decision riêng
- Chưa implement trong giai đoạn này

---

## 2. API Verification (Real Code vs Plan)

### ✅ Verified APIs

| Tool | Plan Path | Real Path | Status |
|------|-----------|-----------|--------|
| list_clinic_services | `/services` | `/services` (GET) | ✅ MATCH |
| update_service_info | `/services/{id}` | `/services/{id}` (PUT) | ✅ MATCH |
| create_service | `/services` | `/services` (POST) | ✅ MATCH |
| get_master_services | `/master-services` | `/master-services` (GET) | ✅ MATCH |
| inherit_from_master | `/services/inherit/{id}` | `/services/inherit/{masterServiceId}` | ✅ MATCH |

### ❌ Incorrect APIs (Need Fix)

| Tool | Plan Path | Real Path | Fix Required |
|------|-----------|-----------|--------------|
| get_staff_schedule | `/staff-shifts/clinic/{id}` | `/clinics/{clinicId}/shifts` (GET) | Fix path |
| create_staff_shifts | `/staff-shifts` (POST) | `/clinics/{clinicId}/shifts` (POST) | Fix path |
| get_shift_summary | `/staff-shifts/staff/{id}` | `/clinics/{clinicId}/shifts` | Fix path |
| get_clinic_metrics | `/reports/clinic/{id}` | `/reports/clinics/{clinicId}` (complaints) | Remove/Remap |
| analyze_review_sentiment | `/reviews/clinic/{id}/analytics` | Chỉ có `/reviews/clinic/{clinicId}` (GET list) | Remove for now |
| get_appointment_insights | `/bookings/clinic/{id}/analytics` | `/bookings/clinic/{clinicId}` (GET) | Need aggregation |

### Missing APIs (Need to Create)

| Tool | Required | Note |
|------|----------|------|
| get_clinic_revenue | `GET /payments/history/clinic/{clinicId}/revenue` | Check if exists |
| get_booking_stats | `GET /bookings/clinic/{clinicId}/stats` | Check if exists |

---

## 3. Runtime State

### Current Runtime (Verified from code)

```python
# petties-agent-serivce/app/core/chat_context.py
BUSINESS_CHAT = "BUSINESS_CHAT"
PLAYGROUND_TEST = "PLAYGROUND_TEST"
VALID_CONTEXT_TYPES = {BUSINESS_CHAT, PLAYGROUND_TEST}
```

**Issue:** Chưa có `CLINIC_COPILOT` context type

**Recommendation:** 
- Phase 0: Dùng `BUSINESS_CHAT` với custom system prompt
- Chưa cần tạo `CLINIC_COPILOT` mới

---

## 4. UI Schema State

### Current (Verified from code)

```typescript
// petties-web/src/types/chat.ts - UISchemaV1
interface UISchemaV1 {
  layout?: 'stack' | 'grid' | 'slot_grid'
  components: UIComponent[]
}
```

**Issue:** Chưa có `page_schema` hoặc `workspace_page` type

**Recommendation:**
- Phase 0: Tiếp tục dùng `UISchema` với new component types
- Phase 1: Mở rộng UISchema cho workspace nếu cần

---

## 5. Frontend Routes

### Current (Verified from code)

```typescript
// petties-web/src/App.tsx
- /staff → Staff dashboard + mascot dock (existing)
- /clinic-manager/chat → ChatPage (existing - customer chat)
```

**Issue:** Chưa đồng bộ hoàn toàn role context cho mascot dock giữa Owner/Manager

**Recommendation:**
- Dùng mascot dock trên các workspace route hiện có, không tạo route AI standalone mới
- Chuẩn hóa role context mapping trong `MascotProvider`
- Reuse `MascotDockPanel` với config theo vai trò

---

## 6. Context Policy (Verified from code)

```python
# petties-agent-serivce/app/core/context_policy.py
# Line ~94, ~113: Analytics tools đang DISABLED với comment
```

**Current disabled tools:**
- analyze_revenue_trends
- get_clinic_metrics
- get_staff_schedule
- suggest_staff_assignments
- get_appointment_insights
- get_customer_insights

**Recommendation:**
- Phase 0: Chỉ enable generate_clinic_services
- Phase 1: Enable read-only tools dần

---

## 7. Traceability Table (New Format)

### Phase 0: Clinic Setup AI (SRS 3.13.1)

| UC | Role | Tool | Verified API | UI Contract | HITL | Status |
|----|------|------|--------------|-------------|------|--------|
| UC-01 | CLINIC_OWNER | generate_clinic_services | GET /master-services | service_generation_card | Yes - Review/Save | TODO |
| UC-01 | CLINIC_OWNER | (save to DB) | POST /services | confirmation_modal | Yes | TODO |

### Phase 1: Manager Analytics (Read-only)

| UC | Role | Tool | Verified API | UI Contract | HITL | Status |
|----|------|------|--------------|-------------|------|--------|
| UC-02 | CLINIC_OWNER/MANAGER | list_clinic_services | GET /services | service_list_card | No | TODO |
| UC-03 | CLINIC_OWNER/MANAGER | get_clinic_overview | GET /clinics/{id} | metric_cards | No | TODO |
| UC-04 | CLINIC_OWNER/MANAGER | get_staff_schedule | GET /clinics/{id}/shifts | shift_calendar | No | TODO |

### Phase 2: Manager Analytics (Write - HITL)

| UC | Role | Tool | Verified API | UI Contract | HITL | Status |
|----|------|------|--------------|-------------|------|--------|
| UC-05 | CLINIC_OWNER/MANAGER | update_service_info | PUT /services/{id} | confirm_modal | Yes | TODO |
| UC-06 | CLINIC_OWNER/MANAGER | create_staff_shifts | POST /clinics/{id}/shifts | confirm_modal | Yes | TODO |

---

## 8. UI Design Fixes

### Emoji → Heroicons

| Plan (Emoji) | Design Guide (Heroicons) |
|--------------|--------------------------|
| 📋 | MoonClipboardIcon |
| 📅 | CalendarIcon |
| 📊 | ChartBarIcon |
| 💰 | CurrencyDollarIcon |
| 👥 | UsersIcon |
| 📈 | ArrowTrendingUpIcon |
| 📉 | ArrowTrendingDownIcon |
| ✅ | CheckCircleIcon |
| ❌ | XCircleIcon |

### No Box-drawing Characters

Replace ASCII art diagrams với:
- Mermaid diagrams
- Hoặc text-based descriptions

---

## 9. Recommended Implementation Order

### Step 1: Backend - Generate Services Flow (DONE)
- Tạo tool `generate_clinic_services` trong AI
- Map với `/master-services` và `/services` endpoints
- Test với CLINIC_OWNER role

### Step 2: Backend - Expand to List/Update Services (DONE)
- Thêm `list_clinic_services` tool
- Thêm `update_service_info` tool
- Thêm `create_service` tool

### Step 3: Backend - Manager Analytics (DONE)
- Thêm read-only tools: `get_staff_schedule`, `get_clinic_metrics`, `get_appointment_insights`
- Thêm write tools: `create_staff_shifts`, `suggest_staff_assignments`
- Map đúng với các endpoints thật của hệ thống

### Step 4: Frontend - Build React UI Cards (NEXT PHASE)
- Mở rộng `UISchemaRenderer.tsx` để hỗ trợ các card mới
- Implement các type: `staff_schedule_card`, `slot_grid_card`, `booking_list_card`, `booking_detail_card`, `staff_list_card`, `clinic_service_list_card`, `service_detail_card`, `clinic_today_summary`.
- Tạo `ServiceGenerationPage` hoặc tái sử dụng workspace chat.
- Add HITL confirm modals cho các thao tác write.

---

## 10. Open Questions

1. **Workspace redesign** - Có cần làm trong giai đoạn này không?
2. **Analytics scope** - CLINIC_OWNER có cần analytics không hay chỉ setup?
3. **Context type** - Dùng BUSINESS_CHAT hay tạo mới?

---

## 11. Next Steps

- [x] Confirm: Phase 0 chỉ tập trung generate_clinic_services? -> Yes, Backend is DONE.
- [x] Confirm: Dùng BUSINESS_CHAT runtime (không tạo mới)? -> Yes, Backend is DONE.
- [x] Fix: API paths trong plan document -> DONE in Backend implementation.
- [x] Fix: Remove emoji, use Heroicons in mockups -> Applied to plan.
- [x] Create: Technical spec chi tiết cho Phase 0 -> Completed AI Assistant integration.
- [ ] Next Phase: Xây dựng React Frontend UI Cards (`staff_schedule_card`, `slot_grid_card`, `booking_list_card`, `clinic_service_list_card`, etc.) trong `UISchemaRenderer.tsx`.

---

**Document Status:** IN PROGRESS - Backend phase is done, moving to React Frontend implementation.

**Last Updated:** 2026-04-03