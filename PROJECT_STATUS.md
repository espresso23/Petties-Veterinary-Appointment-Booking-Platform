# 🐾 PETTIES Project Status

> **Last Updated:** 2026-04-20
> **Current Sprint:** Post Sprint 13 - Production Hardening & AI Enhancement
> **Overall Progress:** ~95% (code-based scan)

---

### Metrics-based Monitoring Stack (Code-based Evidence - 2026-04-20)

**Scope:** Upgrade observability from log-derived monitoring to metrics-based monitoring using Prometheus + Grafana.

**Implemented changes:**
- Backend Spring Boot metrics:
  - Added Prometheus registry dependency in `backend-spring/petties/pom.xml`.
  - Enabled `/api/actuator/prometheus` in `application.properties` and `application-prod.properties`.
  - Added HTTP histogram/SLO metric settings for latency analysis.
- AI Service metrics:
  - Added Prometheus instrumentation module:
    - `petties-agent-serivce/app/monitoring/metrics.py`
  - Added in-flight, request count, error count, duration metrics via middleware:
    - `petties-agent-serivce/app/middleware/logging_middleware.py`
  - Exposed `/metrics` endpoint in:
    - `petties-agent-serivce/app/main.py`
- Monitoring infrastructure:
  - Added Prometheus + Grafana services in `docker-compose.dev.yml`.
  - Added optional `monitoring` profile for `docker-compose.prod.yml`.
  - Added monitoring configs and Grafana provisioning:
    - `monitoring/prometheus/prometheus.dev.yml`
    - `monitoring/prometheus/prometheus.prod.yml`
    - `monitoring/grafana/provisioning/datasources/prometheus.yml`
    - `monitoring/grafana/provisioning/dashboards/dashboards.yml`
    - `monitoring/grafana/provisioning/dashboards/json/petties-observability.json`
- Operations documentation:
  - Added setup/runbook:
    - `docs-references/operations/PROMETHEUS_GRAFANA_MONITORING_SETUP.md`

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

### AGENTS.md continual learning sync (2026-04-11)

- Cập nhật mục **Learned User Preferences** và **Learned Workspace Facts** trong `AGENTS.md`; làm mới `.cursor/hooks/state/continual-learning-index.json` theo transcript agent.

### WIREFRAME_CHECKLIST — AI Assistant đồng bộ code (2026-04-11)

- `docs-references/documentation/SRS/WIREFRAME_CHECKLIST.md`: **§19.1** bổ sung **§19.1.4** (bảng màn hình AI + map prompt Stitch P1–P8); *Preserved* **Module 3.13** đã khớp `ai_chat_screen`, mascot dock, bỏ path `components/ai/*` và màn mobile tách không còn file; khối **Admin Features** (mục AI) và **Staff/Manager/Owner Web AI** chỉnh về `playground/`, `tools/`, `knowledge/`, `insights/AIInsightsPage`, Mascot.

---

### AI Diagnose Taxonomy & AI Insights Integration (Code-based Evidence - 2026-04-16)

**Scope:** Stabilize autonomous disease learning rollout, fix runtime blockers in Staff Diagnosis, expose admin monitoring APIs, and integrate Disease Catalog monitoring directly inside `AIInsightsPage` (no separate admin page).

**Implemented changes:**
- AI service core:
  - Added taxonomy dataset and taxonomy service for disease classification:
    - `petties-agent-serivce/app/core/services/disease_taxonomy.json`
    - `petties-agent-serivce/app/core/services/disease_taxonomy_service.py`
  - Updated disease mapping thresholds and taxonomy-aware parameters:
    - `CREATE_NEW_CONFIDENCE`: `0.94 -> 0.85`
    - Added `taxonomy_hint` support in mapping/resolve + LLM prompt payload
- Staff diagnosis stability/hardening:
  - Converted `_build_top_differentials` to async and wired `await` call in `analyze_case`
  - Removed nested event-loop misuse (`run_until_complete`) in diagnosis pipeline
  - Restored and cleaned case-memory candidate merge flow after prior broken merge
  - Added taxonomy pre-classification + score boost path in differential ranking
- Admin monitoring APIs:
  - Added endpoints:
    - `GET /api/v1/knowledge/disease-catalog/stats`
    - `GET /api/v1/knowledge/disease-catalog`
    - `GET /api/v1/knowledge/learning-metrics`
  - Enforced admin guard on catalog stats and learning metrics
  - Fixed case-memory metrics key mapping (`points_count`, `collection`)
- Web admin integration (gộp vào AI Insights):
  - Added `DiseaseCatalogSection` under AI Insights page:
    - `petties-web/src/pages/admin/insights/DiseaseCatalogSection.tsx`
    - `petties-web/src/pages/admin/insights/AIInsightsPage.tsx`
  - Removed separate page route approach (`DiseaseCatalogPage.tsx` deleted)
  - Migrated API calls to centralized `agentService` + auth headers, removed direct token/localStorage usage
  - Fixed `agentService` export ordering and added `diseaseCatalogApi`

### AI Insights Self-learning Metrics Only (2026-04-16)

**Scope:** Hide static taxonomy baseline in UI and surface only runtime self-learning disease growth sourced from DB (`disease_catalog`, `disease_aliases`) after EMR save/sync.

**Implemented changes:**
- Backend API (`/knowledge/disease-catalog`) now returns runtime self-learning catalog from `DiseaseMappingService` snapshot (`mapper._catalog`, `mapper._alias_entries`) instead of static taxonomy list.
- Kept taxonomy only as optional metadata source to enrich `system/subsystem` labels when canonical code exists in taxonomy index.
- Frontend Disease Catalog cards now show:
  - `Tổng bệnh tự học` from `catalog.total_diseases`
  - `Tổng aliases tự học` from `catalog.total_aliases`
- Removed baseline taxonomy counts from `DiseaseCatalogSection` state typing and rendering.

**Changed files (evidence):**
- `petties-agent-serivce/app/api/routes/knowledge.py`
- `petties-web/src/pages/admin/insights/DiseaseCatalogSection.tsx`
- `petties-web/src/services/agentService.ts`

**Validation evidence:**
- `cd petties-agent-serivce && python -m py_compile app/api/routes/knowledge.py` -> pass
- `cd petties-agent-serivce && python -m pytest tests/test_disease_taxonomy_service.py -q` -> **11 passed**
- `cd petties-web && npx eslint src/pages/admin/insights/DiseaseCatalogSection.tsx src/services/agentService.ts` -> pass

**Changed files (evidence):**
- `petties-agent-serivce/app/core/services/disease_taxonomy.json`
- `petties-agent-serivce/app/core/services/disease_taxonomy_service.py`
- `petties-agent-serivce/app/core/services/disease_mapping_service.py`
- `petties-agent-serivce/app/ai_diagnose/staff_diagnosis_service.py`
- `petties-agent-serivce/app/ai_diagnose/schemas.py`
- `petties-agent-serivce/app/api/routes/knowledge.py`
- `petties-agent-serivce/tests/test_disease_taxonomy_service.py`
- `petties-web/src/services/agentService.ts`
- `petties-web/src/pages/admin/insights/DiseaseCatalogSection.tsx`
- `petties-web/src/pages/admin/insights/AIInsightsPage.tsx`
- `docs-references/ai_diagnose_service/09_DISEASE_TAXONOMY_SYSTEM.md`
- `docs-references/ai_diagnose_service/07_COUNCIL_PRESENTATION_GUIDE.md`

Note: `07_COUNCIL_PRESENTATION_GUIDE.md` has been fully rewritten in Vietnamese with diacritics and verified in UTF-8 encoding for council presentation use.

**Validation evidence (current run):**
- `cd petties-agent-serivce && python -m py_compile app/ai_diagnose/staff_diagnosis_service.py app/core/services/disease_taxonomy_service.py app/api/routes/knowledge.py app/core/services/disease_mapping_service.py app/ai_diagnose/schemas.py`
  - Result: pass
- `cd petties-agent-serivce && python -m pytest tests/test_disease_taxonomy_service.py -q`
  - Result: **11 passed**
- `cd petties-agent-serivce && python -m pytest tests/test_staff_diagnosis_service.py -q`
  - Result: **32 passed**
- `cd petties-agent-serivce && python -m pytest tests/test_staff_diagnosis_route.py -q`
  - Result: **2 passed**
- `cd petties-agent-serivce && python -c "import json; from app.core.services.disease_taxonomy_service import get_disease_taxonomy_service; s=get_disease_taxonomy_service(); print(json.dumps(s.get_taxonomy_stats(), ensure_ascii=True))"`
  - Result: taxonomy loaded successfully (**55 diseases, 12 systems**) in current dataset.
- `cd petties-web && npm run build`
  - Result: pass
- `cd petties-web && npm run lint`
  - Result: failed due to **pre-existing unrelated lint errors** in other modules; no new blocking error introduced by AI Insights taxonomy integration files.

---

## 📋 Use Case Count (Code-based Scan - 04/04/2026)

| Status | Count | % |
|--------|-------|---|
| ✅ Done | 113 | ~92% |
| 🔄 In Progress | 5 | ~4% |
| ❌ Not Started | 5 | ~4% |
| **Total** | **123** | **100%** |

---

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

### Mascot Stability & Interactive Flow Hardening (Code-based Evidence - 2026-04-08)

**Scope:** Complete mascot-only web direction, remove spotlight/orphan risks, align EMR AI type contract, and add regression tests for interactive confirm actions.

**Implemented changes:**
- Replaced legacy spotlight provider wiring with mascot compatibility wrappers to prevent missing-module build failures.
- Removed leftover dedicated AI web routes in `App.tsx` to enforce mascot-only entrypoint for internal web roles.
- Updated EMR-AI bridge URL strategy to open staff workspace path with mascot context (`/staff?...`) instead of legacy dedicated AI page routes.
- Aligned AI diagnosis prescription type contract with both snake_case/camelCase fields and EMR context mapping constraints.
- Added mascot interactive flow tests:
  - Web: confirm modal action dispatch for `confirm_service_create`, `confirm_service_update`, `confirm_service_batch_create`.
  - AI service: websocket parser coverage for service create/batch create action payloads.

**Changed files (evidence):**
- `petties-web/src/components/spotlight/SpotlightProvider.tsx`
- `petties-web/src/components/spotlight/index.ts`
- `petties-web/src/App.tsx`
- `petties-web/src/utils/emrAiDraftBridge.ts`
- `petties-web/src/services/agentService.ts`
- `petties-web/src/utils/emrAiDiagnosisContext.ts`
- `petties-web/src/pages/staff/emr/CreateEmrPage.tsx`
- `petties-web/src/components/mascot/__tests__/MascotDockPanel.test.tsx`
- `petties-agent-serivce/tests/test_websocket_chat.py`

**Validation evidence:**
- `cd petties-web && npm run type-check` -> pass
- `cd petties-web && npm run build` -> pass
- `cd petties-web && npx vitest run src/components/mascot/__tests__/MascotDockPanel.test.tsx --reporter=verbose` -> pass
- `cd petties-agent-serivce && python -m pytest tests/test_websocket_chat.py -q` -> pass (25 passed)

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

### Booking with AI (Pet Owner Mobile-Only) Hardening (Code-based Evidence - 2026-04-08)

**Scope:** Enforce Pet Owner-only booking flow, reduce repeated clarification turns with context-first hydration, strengthen UI schema streaming tests, and validate editable one-step confirm on mobile booking card.

**Implemented changes:**
- Enforced booking-tool scope at routing layer:
  - Non `PET_OWNER`/`ADMIN` roles are blocked from consumer booking tool flow with clear guidance message.
- Added context-first hydration in booking routing:
  - Auto-fill missing `clinic_id`, `service_ids`, `booking_date`, `start_time` from runtime booking draft before asking user again.
- Fixed mobile user-facing text in home-visit booking summary card to Vietnamese with diacritics.
- Added AI service websocket regression for `ui_schema` emission when observation tool results are present.
- Added mobile widget regression for editable booking summary card and single-step confirm action.

**Changed files (evidence):**
- `petties-agent-serivce/app/core/agents/tool_routing.py`
- `petties-agent-serivce/tests/test_websocket_chat.py`
- `petties_mobile/lib/ui/chat/ai_chat/utils/ai_booking_cards.dart`
- `petties_mobile/test/ui/chat/ai_booking_cards_test.dart`

**Validation evidence:**
- `cd petties_mobile && flutter test test/ui/chat/ai_booking_cards_test.dart` -> pass
- `cd petties-agent-serivce && pytest tests/test_websocket_chat.py -q` -> executed in current environment (no failing output)

---

### Deadcode Audit (AI Service + Mobile, Safe-only) (Code-based Evidence - 2026-04-08)

**Scope:** `petties-agent-serivce/` và `petties_mobile/` cho booking/chat AI, giữ nguyên staff copilot theo quyết định phạm vi.

**Audit method:**
- Cross-reference symbol usage bằng static search (import/route/runtime call chain).
- Verify runtime access với route/screen và booking tools registration.
- Chỉ xóa khi thỏa điều kiện chắc chắn 100% không dùng.

**Findings:**
- **Group A (xóa ngay):** không có candidate đạt ngưỡng an toàn 100%.
- **Group B (giữ):**
  - Staff copilot mobile (`StaffAiChatScreen`, route staff) vẫn được route/runtime sử dụng.
  - Booking UI cards (`AiServiceOptionCard`, `AiSlotGridCard`, `AiStructuredBookingSummaryCard`, `AiBookingCreatedCard`, `AiMultiPetBookingCreatedCard`) đều còn reference từ `AiChatScreen`.
  - AI service booking routing/session tools còn nằm trong execution flow (prompt builder/tool routing/websocket flow).
- **Group C (hoãn):** không có candidate đủ bằng chứng để đề xuất xóa.

**Cleanup result:**
- Không xóa file/symbol nào để tránh false-positive.

**Validation evidence:**
- `cd petties_mobile && flutter analyze lib/ui/chat/ai_chat lib/data/services/ai_chat_service.dart lib/routing/router_config.dart` -> `No issues found`.
- `cd petties-agent-serivce && pytest tests/test_websocket_chat.py -q` -> pass trong môi trường hiện tại.

---

### Mobile AI Chat UI/UX Hybrid Redesign (Code-based Evidence - 2026-04-08)

**Scope:** Redesign giao diện chat AI mobile cho cả Pet Owner và Staff theo hướng hybrid (mềm, hiện đại, vẫn giữ dấu ấn Neobrutalism), tối ưu thao tác một tay và trải nghiệm nhập liệu.

**Implemented changes:**
- Refactor header theo nhận diện thương hiệu:
  - Hiển thị cụm thương hiệu `Petties AI` với biểu tượng ở trung tâm.
  - Điều chỉnh action bar: lịch sử phiên chat, tạo phiên mới, đóng nhanh.
- Bổ sung focus mode nhẹ khi nhập liệu:
  - Áp dụng blur/dim mỏng ở vùng trên khi bàn phím mở để giảm nhiễu thị giác.
- Nâng cấp composer thành floating bar:
  - Dạng nổi, bo góc lớn, shadow mềm, border mảnh.
  - Tích hợp action phụ trong input (`+`/settings dạng compact).
  - Nút gửi đổi icon và trạng thái mượt theo send/reconnect.
- Cập nhật placeholder thông minh theo role:
  - Pet Owner: hướng dẫn hỏi về thú cưng.
  - Staff: hướng dẫn copilot cho ca khám.
- Restyle booking cards trong chat:
  - Tăng phân cấp thị giác, spacing thoáng hơn.
  - Chuyển từ shadow cứng sang shadow mềm, giữ nguyên logic nghiệp vụ.

**Changed files (evidence):**
- `petties_mobile/lib/ui/chat/ai_chat/ai_chat_screen.dart`
- `petties_mobile/lib/ui/chat/ai_chat/utils/ai_chat_panels.dart`
- `petties_mobile/lib/ui/chat/ai_chat/utils/ai_booking_cards.dart`
- `petties_mobile/test/ui/chat/ai_chat_panels_test.dart`

**Validation evidence:**
- `cd petties_mobile && flutter analyze lib/ui/chat/ai_chat/ai_chat_screen.dart lib/ui/chat/ai_chat/utils/ai_chat_panels.dart lib/ui/chat/ai_chat/utils/ai_booking_cards.dart test/ui/chat/ai_chat_panels_test.dart` -> `No issues found`.
- `cd petties_mobile && flutter test test/ui/chat/ai_chat_panels_test.dart test/ui/chat/ai_booking_cards_test.dart` -> `All tests passed`.

---

### Mobile AI Chat UI/UX Hybrid Redesign — Round 2 Polish (Code-based Evidence - 2026-04-08)

**Scope:** Tinh chỉnh vòng 2 cho motion/composer/focus UX nhằm tăng cảm giác mượt và nhất quán tương tác trên mobile cho cả Pet Owner và Staff.

**Implemented changes:**
- Tăng độ mượt transition ở vùng composer:
  - Kết hợp `AnimatedPadding` + `AnimatedSlide` + `AnimatedOpacity` để giảm cảm giác nhảy layout khi bàn phím mở/đóng.
- Nâng cấp focus mode overlay:
  - Dùng lớp blur + gradient nhẹ phía trên giúp giảm nhiễu thị giác mà không che nội dung quá mạnh.
- Tinh chỉnh action/send behavior trong floating composer:
  - Nút gửi chỉ active khi có nội dung hoặc có ảnh đính kèm.
  - Cập nhật màu trạng thái idle/disabled rõ hơn.
  - Dùng `AnimatedSwitcher` cho icon gửi (`idle/sending/reconnecting`) để chuyển trạng thái mượt.
- Nâng chất lượng tương tác nút phụ:
  - Chuyển action button từ `GestureDetector` sang `InkWell` để có phản hồi chạm tự nhiên hơn.

**Changed files (evidence):**
- `petties_mobile/lib/ui/chat/ai_chat/ai_chat_screen.dart`
- `petties_mobile/lib/ui/chat/ai_chat/utils/ai_chat_panels.dart`
- `petties_mobile/test/ui/chat/ai_chat_panels_test.dart`

**Validation evidence:**
- `cd petties_mobile && flutter test test/ui/chat/ai_chat_panels_test.dart test/ui/chat/ai_booking_cards_test.dart` -> `All tests passed`.
- `cd petties_mobile && flutter analyze lib/ui/chat/ai_chat/ai_chat_screen.dart lib/ui/chat/ai_chat/utils/ai_chat_panels.dart lib/ui/chat/ai_chat/utils/ai_booking_cards.dart test/ui/chat/ai_chat_panels_test.dart` -> `No issues found`.

---

### Mobile AI Chat UI/UX Hybrid Redesign — Round 3 Responsive Tuning (Code-based Evidence - 2026-04-08)

**Scope:** Tối ưu responsive cho small-screen (<=360dp), giảm nguy cơ chật layout và giữ trải nghiệm nhập liệu mượt trên thiết bị nhỏ.

**Implemented changes:**
- `AiChatScreen`:
  - Thêm nhánh compact theo chiều rộng màn hình để co nhẹ typography ở brand header/subtitle.
  - Điều chỉnh padding ngang phù hợp hơn cho màn hình hẹp.
- `AiChatComposer`:
  - Áp dụng compact mode cho màn hình nhỏ: giảm kích thước action buttons, send button, font input/hint, padding input.
  - Giới hạn chiều cao composer hợp lý hơn khi keyboard mở trên màn hình nhỏ.
- `_ComposerActionButton`:
  - Tối ưu kích thước và bo góc theo compact mode để đảm bảo touch target vẫn ổn định nhưng không gây chật hàng.
- Bổ sung test small-screen:
  - Thêm widget test cho layout 320dp, xác nhận không overflow và các control chính vẫn hiển thị đúng.

**Changed files (evidence):**
- `petties_mobile/lib/ui/chat/ai_chat/ai_chat_screen.dart`
- `petties_mobile/lib/ui/chat/ai_chat/utils/ai_chat_panels.dart`
- `petties_mobile/test/ui/chat/ai_chat_panels_test.dart`

**Validation evidence:**
- `cd petties_mobile && flutter test test/ui/chat/ai_chat_panels_test.dart test/ui/chat/ai_booking_cards_test.dart` -> `All tests passed`.
- `cd petties_mobile && flutter analyze lib/ui/chat/ai_chat/ai_chat_screen.dart lib/ui/chat/ai_chat/utils/ai_chat_panels.dart test/ui/chat/ai_chat_panels_test.dart` -> `No issues found`.

---

### Mobile AI Chat UI/UX Hybrid Redesign — Round 4 Visual Consistency Pass (Code-based Evidence - 2026-04-08)

**Scope:** Chuẩn hóa typography/spacing tokens giữa header, message bubble và composer để đồng nhất nhịp điệu thị giác và giảm magic numbers trong AI chat mobile.

**Implemented changes:**
- `AiChatScreen`:
  - Chuẩn hóa compact spacing cho horizontal padding theo token.
  - Chuẩn hóa cấu hình bubble (radius/border/padding/shadow offset) bằng constants dùng chung trong file.
  - Giữ nguyên behavior nghiệp vụ/chat stream, chỉ tối ưu consistency presentation.
- `AiChatComposer`:
  - Chuẩn hóa token kích thước composer/send/action buttons (`radius`, `border width`, `action size`, `send size`) để dùng nhất quán giữa normal/compact mode.
  - Giảm hard-coded values lặp lại, dễ maintain cho các vòng tune tiếp theo.

**Changed files (evidence):**
- `petties_mobile/lib/ui/chat/ai_chat/ai_chat_screen.dart`
- `petties_mobile/lib/ui/chat/ai_chat/utils/ai_chat_panels.dart`

**Validation evidence:**
- `cd petties_mobile && flutter test test/ui/chat/ai_chat_panels_test.dart test/ui/chat/ai_booking_cards_test.dart` -> `All tests passed`.
- `cd petties_mobile && flutter analyze lib/ui/chat/ai_chat/ai_chat_screen.dart lib/ui/chat/ai_chat/utils/ai_chat_panels.dart test/ui/chat/ai_chat_panels_test.dart` -> `No issues found`.

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
- `docs-references/documentation/SDD/PETTIES_SDD.md` (section `3.2.7` + API mapping sync)

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
- AI Assistant (Mascot panel) ✅

**Clinic Manager (12):**
- Dashboard, Revenue, Notifications, Profile
- Booking Dashboard (full Cancel/Checkout/Report/Voucher flow)
- Staff Management, StaffShift Calendar
- Services View, Clinic Info/Edit
- Chat (Clinic↔Staff)
- Refunds Page
- Voucher Management

**Architecture/Technical (Web):**
- Chat type boundary hardening ✅: separated traditional chat types and AI assistant schema types to avoid cross-flow coupling (`petties-web/src/types/chat.ts`, `petties-web/src/types/chat-copilot.ts`) while preserving legacy chat flow.

**Staff Web (9):**
- Dashboard, Schedule, Bookings, Patients
- EMR Create/Edit/Detail
- Vaccination Page + Roadmap
- **AI Assistant (Staff internal)** ✅
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
- **AI Assistant (Staff internal)** ✅ (`staff_ai_chat_screen.dart`)
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

### Recent AI Assistant Hardening (Code-based Evidence - 2026-04-07)

**Scope:** Clinic AI assistant service-management quality, chat action stability, thinking stream safety.

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

### Recent AI Assistant Permission & Suggestion Quality Update (Code-based Evidence - 2026-04-07)

**Scope:** Role-permission parity for Clinic AI assistant, secure response rendering, and flexible structured service suggestions.

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

## ✅ Resource vs Tool Mapping (Phase 0-2 Bootstrap) (Code-based Evidence - 2026-04-08)

**Completed today:**
- Added MCP Resource registry for read-only business data with URI templates, role guardrails, TTL, migration phase tag, and deprecated-tool linkage.
- Introduced `read_resource` compatibility tool to keep current runtime stable while enabling resource-first reads.
- Added resource resolver path in MCP layer (`call_mcp_resource`) with runtime TTL cache + telemetry (`cache_hit`, `resource_name`, `deprecated_tool`).
- Updated scanner output to include resource metadata (`total_resources`, `resource_list`, `resource_metadata`) while preserving existing tool sync behavior.
- Extended context policy with `allowed_resources` and prompt guardrail text to prefer Resource for read-only queries before fallback to legacy read-only tool.
- Added booking routing bridge: read-only booking tool calls (`get_user_pets`, `get_clinic_services`, `check_available_slots`) can be redirected to `read_resource` when available.
- Added admin resource listing endpoint and WebSocket agent-info payload support for `allowed_resources`.

**Changed files (evidence):**
- `petties-agent-serivce/app/core/tools/mcp_resources/resource_registry.py`
- `petties-agent-serivce/app/core/tools/mcp_resources/__init__.py`
- `petties-agent-serivce/app/core/tools/mcp_server.py`
- `petties-agent-serivce/app/core/tools/scanner.py`
- `petties-agent-serivce/app/core/tools/mcp_tools/utility_tools.py`
- `petties-agent-serivce/app/core/context_policy.py`
- `petties-agent-serivce/app/core/agents/factory.py`
- `petties-agent-serivce/app/core/agents/tool_routing.py`
- `petties-agent-serivce/app/api/routes/tools.py`
- `petties-agent-serivce/app/api/schemas/tool_schemas.py`
- `petties-agent-serivce/app/api/schemas/websocket_schemas.py`
- `petties-agent-serivce/tests/test_context_policy.py`
- `petties-agent-serivce/tests/test_mcp_resources.py`

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

### Staff Diagnosis AI — Chuẩn hóa plan điều trị chuyên nghiệp (Code-based Evidence - 2026-04-10)

**Scope:** Nâng chất lượng `soap_suggestions.plan_draft` để AI không trả về câu chung chung; plan phải rõ mục tiêu, hành động, theo dõi, tái khám/cảnh báo và dùng được ngay trong EMR.

**Implemented changes:**
- Tăng ràng buộc prompt trong `StaffDiagnosisService._build_llm_synthesis_prompt`: bắt buộc plan theo 4 dòng có nhãn `Mục tiêu`, `Hướng xử trí trước mắt`, `Theo dõi`, `Tái khám/Cảnh báo`.
- Tăng ràng buộc prompt cho `top_differentials.display_name_vi`: chỉ cho phép một tên bệnh chuẩn, không dùng cụm ghép nhiều bệnh (`hoặc`, `và`, `A/B`).
- Thêm hậu xử lý `StaffDiagnosisService._normalize_selected_plan_format(...)` để chuẩn hóa plan về khung chuyên nghiệp ngay cả khi LLM trả về dạng đoạn văn.
- Cập nhật `StaffDiagnosisService._coerce_plan_for_selected_diagnosis(...)` để luôn đi qua bước chuẩn hóa, giữ ngữ cảnh chẩn đoán đã chọn và hạn chế plan mơ hồ.
- Điều chỉnh theo yêu cầu: bỏ mapping timeline hardcode theo tên bệnh; chuyển sang yêu cầu để AI tự suy luận mốc tái khám từ dữ liệu ca bệnh hiện tại trong `plan_draft`.
- Điều chỉnh theo yêu cầu: bỏ cưỡng ép parser cắt nhãn bệnh; giữ hướng để LLM tự chọn nhãn chẩn đoán, backend chỉ parse/validate.
- Điều chỉnh theo yêu cầu: không còn chèn dòng mở đầu kiểu «Định hướng điều trị/xử trí theo chẩn đoán đã chọn» trong `plan_draft` (prompt cấm; `_build_plan_draft` / `_coerce_plan_for_selected_diagnosis` bỏ tiền tố đó).
- Củng cố ngữ cảnh bệnh nhân (chỉ qua prompt + retrieval, không thêm cảnh báo UI): thêm `sex`, `linked_pet_or_booking` vào payload LLM; quy tắc prompt cân nhắc loài/tuổi/cân/giới/dị ứng; đưa tuổi/giới vào query RAG + case memory prefetch — không gộp cảnh báo ngữ cảnh vào `payload_warnings` để tránh hiển thị riêng; kết quả phản ánh qua SOAP/safety/prescription do LLM tổng hợp.
- Bổ sung unit test xác nhận cấu trúc plan chuyên nghiệp có đủ 4 dòng nhãn và gắn chẩn đoán đã chọn.
- Cập nhật unit test để kiểm tra dòng `Tái khám/Cảnh báo` theo hướng không hardcode timeline.
- Cập nhật unit test xác nhận parser giữ nguyên nhãn do LLM chọn trong response.

**Changed files (evidence):**
- `petties-agent-serivce/app/ai_diagnose/staff_diagnosis_service.py`
- `petties-agent-serivce/tests/test_staff_diagnosis_service.py`

**Validation evidence:**
- `cd petties-agent-serivce && python -m pytest tests/test_staff_diagnosis_service.py -q -k "professional_structure or build_plan_draft_does_not_append_allergy_or_weight_tail"` -> pass (2 passed)
- `cd petties-agent-serivce && python -m pytest tests/test_staff_diagnosis_service.py -q -k "parse_llm_synthesis_response_normalizes_mismatched_label_and_code or parse_llm_synthesis_response_keeps_llm_selected_label or professional_structure"` -> pass (3 passed)

---

### Case Memory — Chi tiết ưu tiên ngữ cảnh bệnh nhân (Code-based Evidence - 2026-04-10)

**Scope:** Admin xem ca trong Case Memory cần thấy rõ loài, giống, tuổi, giới, sinh hiệu lúc khám, dị ứng, triệu chứng tách, mã EMR/pet/booking — không chỉ nằm trong `text_content`.

**Implemented changes:**
- Spring `InternalConfirmedEmrItemDto` + `EmrService.mapToInternalConfirmedItem`: thêm `ageMonths` (từ `dateOfBirth`), `sex`, `allergies` từ hồ sơ thú.
- AI `EmrCaseMemorySyncService`: payload Qdrant bổ sung `emr_id`, `pet_id`, `booking_id`, `clinic_id`, `breed`, `age_months`, `sex`, `allergies`, `symptoms`, `physical_exam`, `vitals` (cấu trúc).
- `CaseMemoryService.get_case` trả các trường trên cho API chi tiết.
- Web Admin `AIInsightsPage` / `CaseDetailModal`: khối **Ngữ cảnh bệnh nhân** (teal card) đặt đầu nội dung chi tiết; type `CaseMemoryDetailItem` + `CaseMemoryVitals` trong `agentService.ts`.

**Changed files (evidence):**
- `backend-spring/petties/src/main/java/com/petties/petties/dto/emr/InternalConfirmedEmrItemDto.java`
- `backend-spring/petties/src/main/java/com/petties/petties/service/EmrService.java`
- `petties-agent-serivce/app/api/schemas/internal_case_memory_schemas.py`
- `petties-agent-serivce/app/core/services/emr_case_memory_sync_service.py`
- `petties-agent-serivce/app/core/rag/case_memory.py`
- `petties-agent-serivce/tests/test_emr_case_memory_sync_service.py`
- `petties-web/src/services/agentService.ts`
- `petties-web/src/pages/admin/insights/AIInsightsPage.tsx`

**Validation evidence:**
- `cd petties-agent-serivce && python -m pytest tests/test_emr_case_memory_sync_service.py -q` -> pass
- `mvn test-compile -DskipTests` (module `backend-spring/petties`) -> success

**Note:** Ca đã lưu trước khi deploy không có payload mới; đồng bộ lại EMR hoặc resync để có đủ trường.

---

### Mobile AI Booking Form In-place Sync (Code-based Evidence - 2026-04-08)

**Scope:** Remove extra chat bubbles when user edits booking form fields, keep backend sync silent, and merge returned schema/state into the existing form card.

**Implemented changes:**
- Added `silentFormSync` mode for structured booking actions so field updates (`clinic`, `booking_type`, `service`, `date`, `time`, `refresh_slot`) are sent without appending user bubbles.
- Added in-place merge path for `ui_schema` updates to patch the current booking form message instead of creating a new assistant message.
- Added in-place merge path for `booking_state_update` draft payload into the active form message during silent sync.
- Preserved final confirmation flow (`XÁC NHẬN ĐẶT LỊCH`) as interactive (non-silent), so booking result feedback still appears normally.
- FE UX hardening (form-first): when user confirms with missing fields, show precise Vietnamese SnackBar per field (`dịch vụ`, `phòng khám`, `ngày`, `giờ`, `hình thức`, `địa chỉ/vị trí khám tại nhà`) instead of failing silently.
- FE UX hardening: prevent duplicate confirm taps on the same booking summary while request is in-flight and show `Yêu cầu đặt lịch đang được gửi...` feedback.
- FE UX copy: confirm button now shows `ĐANG GỬI XÁC NHẬN...` during busy state to reduce user confusion.

**Changed files (evidence):**
- `petties_mobile/lib/ui/chat/ai_chat/ai_chat_screen.dart`
- `petties_mobile/lib/ui/chat/ai_chat/utils/ai_booking_cards.dart`

**Validation evidence:**
- `cd petties_mobile && flutter analyze lib/ui/chat/ai_chat/ai_chat_screen.dart lib/ui/chat/ai_chat/utils/ai_booking_cards.dart` -> pass
- `cd petties_mobile && flutter test test/ui/chat/ai_booking_cards_test.dart test/ui/chat/ai_chat_panels_test.dart` -> pass

---

### Mobile AI Booking Form — Date/Slot/Service Sync Audit (Code-based Evidence - 2026-04-09)

**Scope:** Fix Pet Owner booking summary form where date list stayed empty (`Chưa có danh sách ngày khám`), slot/times did not refresh after silent actions, service list looked truncated, and silent `ui_schema` could merge into the wrong path after pending counter drift.

**Root causes (client):**
- `select_date` / slot refresh requires a real `booking_date` from server slot/booking payloads or user draft; client must not invent dates or probe with arbitrary “today” when data never arrived.
- Silent UI merge gated only on `_silentPendingCompletions`; late `ui_schema` after counter hit zero skipped in-place merge.
- Service list filtered strictly by `clinicId`; tools sometimes return services without `clinic_id`, so valid rows were dropped.
- Time filter `_isValidTimeValue` rejected single-digit hours (`9:00`), clearing dropdown items.

**Implemented changes:**
- Date options: **only** server/tracker/summary-derived values — **no** client-generated multi-day ISO seed lists.
- `requestSlotRefresh`: if `booking_date` is still empty after draft + tracker, **do not** send `select_date`; show **SnackBar** (Tiếng Việt, `AppColors.error`) explaining missing server date data.
- Silent merge: `_silentFormMergeUntil` window + `_canMergeSilentBookingUiIntoMessage`; reset silent pointers on new user bubble / session replace.
- `ResolveServiceOptions`: when scoping by clinic, **keep unscoped** (`clinicId` empty) services merged with clinic-matched rows.
- Dropdown: stable `ValueKey` from full option values + `initialValue` coerced when selection not in list; relaxed time validation regex.

**Changed files (evidence):**
- `petties_mobile/lib/ui/chat/ai_chat/ai_chat_screen.dart`
- `petties_mobile/lib/ui/chat/ai_chat/utils/ai_booking_cards.dart`

**Validation evidence:**
- `cd petties_mobile && flutter analyze lib/ui/chat/ai_chat/ai_chat_screen.dart lib/ui/chat/ai_chat/utils/ai_booking_cards.dart` -> pass (re-run after policy change)
- `cd petties_mobile && flutter test test/ui/chat/ai_booking_cards_test.dart` -> pass (re-run after policy change)

---

### Mobile AI Chat — Sao chép & sửa tin nhắn (Code-based Evidence - 2026-04-09)

**Scope:** Cho phép sao chép nội dung bubble và (với tin nhắn người dùng) đổ vào ô soạn để sửa rồi gửi lại — hover chuột hiện nút; thiết bị cảm ứng dùng nhấn giữ để mở bottom sheet.

**Implemented changes:**
- `MouseRegion` + thanh nút (Neobrutalism: viền đậm, offset shadow): **Sao chép**, **Sửa và gửi lại** (chỉ user, khi có nội dung chữ).
- `GestureDetector.onLongPress`: bottom sheet cùng hai hành động; sao chép gom `content` + `webSearchAnswer` (khi khác nhau).
- `AiChatComposer`: thêm `focusNode` tùy chọn; màn AI Chat gắn `FocusNode` để sau khi “Sửa và gửi lại” focus vào ô nhập và cuộn xuống composer.
- Phản hồi sao chép: SnackBar `floating` + `clearSnackBars`, ~2.2s, nút đóng, `margin` động — khi có bàn phím đẩy lên gần AppBar để không dính keyboard / form đặt lịch.

**Changed files (evidence):**
- `petties_mobile/lib/ui/chat/ai_chat/ai_chat_screen.dart`
- `petties_mobile/lib/ui/chat/ai_chat/utils/ai_chat_panels.dart`

**Validation evidence:**
- `flutter analyze` (2 files above) -> pass
- `flutter test test/ui/chat/ai_chat_panels_test.dart` -> pass

---

### Mobile AI Chat — Composer overflow khi bàn phím + prompt dài (Code-based Evidence - 2026-04-09)

**Scope:** Tránh `RenderFlex` bottom overflow (~45px) khi ô nhập nhiều dòng lúc bàn phím mở (màn empty state + quick chips).

**Implemented changes:**
- `body` `Column`: bọc `AiChatComposer` trong `Flexible(flex: 0, fit: loose)` + `SingleChildScrollView` + `LayoutBuilder` để composer không vượt quá không gian còn lại sau `Expanded` (chat list).
- `AiChatComposer`: khi có bàn phím, giảm `maxLines` ô nhập và `maxHeight` khung TextField (compact 4 dòng / 160px; lớn hơn 5 dòng / 180px) so với không bàn phím.
- `_buildContent` empty-state: thay `Column + Spacer` bằng `LayoutBuilder + SingleChildScrollView + ConstrainedBox(minHeight)` để quick prompts không gây overflow khi chiều cao viewport bị bàn phím thu hẹp.

**Validation evidence:**
- `flutter analyze` `ai_chat_screen.dart`, `ai_chat_panels.dart` -> pass
- `flutter test test/ui/chat/ai_chat_panels_test.dart` -> pass

---

### Mobile AI Chat — Dịch vụ booking: gộp prompt vs database (Code-based Evidence - 2026-04-10)

**Scope:** Tránh hai dòng “tắm chó” / “Tắm chó” trong modal chọn dịch vụ khi LLM/tracker gửi id hoặc tên trùng ngữ nghĩa với bản ghi phòng khám; luôn ưu tiên hàng có id thật (UUID) và tên hiển thị từ máy chủ.

**Implemented changes:**
- `ai_booking_service_merge.dart`: `bookingServiceOptionCanonicalScore`, `dedupeBookingServiceOptionsPreferCanonical` (gộp theo clinic + tên chuẩn hóa), `canonicalizeSelectedBookingServiceIds` (map id giống chữ prompt → id canonical).
- `ai_chat_screen.dart`: `_resolveServiceOptionsForMessage` bọc kết quả bằng dedupe theo `effectiveClinicId`.
- `AiStructuredBookingSummaryCard`: đồng bộ form + bottom sheet + payload xác nhận dùng danh sách đã dedupe và id đã canonical hóa.

**Changed files (evidence):**
- `petties_mobile/lib/ui/chat/ai_chat/utils/ai_booking_service_merge.dart`
- `petties_mobile/lib/ui/chat/ai_chat/ai_chat_screen.dart`
- `petties_mobile/lib/ui/chat/ai_chat/utils/ai_booking_cards.dart`
- `petties_mobile/test/ui/chat/ai_booking_service_merge_test.dart`
- `petties_mobile/test/ui/chat/ai_booking_cards_test.dart`

**Validation evidence:**
- `cd petties_mobile && flutter analyze lib/ui/chat/ai_chat/utils/ai_booking_service_merge.dart lib/ui/chat/ai_chat/utils/ai_booking_cards.dart lib/ui/chat/ai_chat/ai_chat_screen.dart` -> pass
- `cd petties_mobile && flutter test test/ui/chat/ai_booking_service_merge_test.dart test/ui/chat/ai_booking_cards_test.dart` -> pass

---

### AI Agent Service — MCP `read_resource` bridge booking tools + role hardening (Code-based Evidence - 2026-04-09)

**Scope:** Align `get_resource_by_backing_tool` with booking tool names used in `tool_routing` redirect; fail-closed when runtime `role` is empty in `resolve_resource_request`; allow `PET_OWNER` read-only on `clinic_services` / `slot_availability` URIs so Pet Owner `read_resource` path matches booking visibility.

**Implemented changes:**
- `_BOOKING_TOOL_ALIASES`: `get_clinic_services` → `list_clinic_services`, `check_available_slots` → `get_slot_availability`; `get_resource_by_backing_tool` resolves via alias before `_RESOURCE_BY_BACKING_TOOL` lookup.
- `_build_result` in `resolve_resource_request`: `PermissionError` (Tiếng Việt) if role rỗng; then existing allowed_roles check.
- `allowed_roles` for resources `clinic_services` and `slot_availability`: thêm `PET_OWNER` (cùng read-only với luồng booking).

**Changed files (evidence):**
- `petties-agent-serivce/app/core/tools/mcp_resources/resource_registry.py`
- `petties-agent-serivce/tests/test_mcp_resources.py`
- `petties-agent-serivce/tests/test_booking_context_prompt.py` (redirect + assert prompt `sync_booking_draft`)

**Validation evidence:**
- `cd petties-agent-serivce && python -m pytest tests/test_mcp_resources.py tests/test_booking_context_prompt.py -q` -> 16 passed

---

### AI Agent Service — Explicit clinic lookup + hide raw `read_resource` in UI (Code-based Evidence - 2026-04-09)

**Scope:** Fix Pet Owner booking flow where explicit clinic name still behaved like nearby-radius search, and prevent presentation layer from rendering literal `Read Resource` text when booking tools are bridged through resource compatibility.

**Implemented changes:**
- `search_clinics_nearby`: when `clinic_hint` is present, exact clinic resolution no longer sends `latitude` / `longitude` / `address` / `radiusKm` into clinic-options payload, so explicit-name lookup is not constrained by nearby-distance filters.
- `_resolve_backend_booking_context`: when `clinic_hint` is present, context-resolution payload also omits `latitude` / `longitude` / `address` to avoid location-biased clinic inference before exact-name database matching.
- Presentation builder: unwrap successful `read_resource` payloads via `resource_name`-first business mapping (fallback to `deprecated_tool`) and render them with the original booking intent (`get_clinic_services`, `check_available_slots`, etc.) instead of raw compatibility tool name.

**Changed files (evidence):**
- `petties-agent-serivce/app/core/tools/mcp_tools/booking_tools.py`
- `petties-agent-serivce/app/core/presentation/builder.py`
- `petties-agent-serivce/tests/test_booking_tools.py`
- `petties-agent-serivce/tests/test_presentation_builder.py`

**Validation evidence:**
- `cd petties-agent-serivce && python -m pytest tests/test_booking_tools.py tests/test_presentation_builder.py tests/test_booking_context_prompt.py -q` -> 57 passed

---

### Mobile AI Chat — Header & Clinic Card Layout (Code-based Evidence - 2026-04-09)

**Scope:** Remove duplicate “Lịch sử” control in `AppBar`; prevent `RenderFlex` overflow on clinic suggestion cards when `operatingHours` is a long single-line string.

**Implemented changes:**
- `AppBar`: keep a single history `IconButton` on `leading`; removed duplicate history entry from `actions`.
- `AiClinicSuggestionCard`: moved operating hours to its own row with `Expanded` + `maxLines` / `ellipsis`; rating text wrapped in `Flexible` to avoid horizontal overflow on narrow screens.

**Changed files (evidence):**
- `petties_mobile/lib/ui/chat/ai_chat/ai_chat_screen.dart`
- `petties_mobile/lib/ui/chat/ai_chat/utils/ai_chat_widgets.dart`

**Validation evidence:**
- `cd petties_mobile && flutter analyze lib/ui/chat/ai_chat/ai_chat_screen.dart lib/ui/chat/ai_chat/utils/ai_chat_widgets.dart` -> pass

---

### AI Agent Service — Simplify booking backend (FE-first) (Code-based Evidence - 2026-04-10)

**Scope:** Reduce backend complexity for Pet Owner mobile chatbot booking. Keep backend focused on basic validation + create request + clear error response; move anti-duplicate UX handling to frontend form flow.

**Implemented changes:**
- `booking_tools.py`: removed idempotency guard path (`request_key` replay / in-flight blocking) and reverted `create_booking_for_user` to straightforward confirmation + backend create flow.
- `booking_session.py`: removed temporary in-flight/last-created state fields (`create_inflight`, `inflight_request_key`, `last_created_booking_payload`) and related state transition helpers.
- Mobile FE remains responsible for anti double-submit UX and field-completion validation before confirmation.

**Changed files (evidence):**
- `petties-agent-serivce/app/core/tools/mcp_tools/booking_tools.py`
- `petties-agent-serivce/app/core/agents/booking_session.py`
- `petties_mobile/lib/ui/chat/ai_chat/ai_chat_screen.dart` (already hardened earlier in this task stream)
- `petties_mobile/lib/ui/chat/ai_chat/utils/ai_booking_cards.dart` (already hardened earlier in this task stream)

**Validation evidence:**
- `ReadLints` on edited Python files -> no linter errors.

---

### AI Agent Service — Remove booking session state tools (Code-based Evidence - 2026-04-10)

**Scope:** Simplify AI booking to stateless flow (lookup + confirm + create). Remove draft/session management tools and all prompt/policy wiring that forced stateful booking orchestration.

**Implemented changes:**
- Removed booking session tools from MCP registration path (`sync_booking_draft`, `get_booking_session_info`, `close_booking_session`).
- Removed session-tool references from:
  - role whitelist (`context_policy`)
  - tool default policy (`tool_policy`)
  - tool scanner system-managed set (`scanner`)
  - booking guidance/prompt (`booking_flow`, `prompt_builder`)
  - UI intent mapping (`presentation/builder`)
- Removed post-create booking state finalization hook in `single_agent` to keep booking flow stateless.
- Removed remaining legacy booking-state branches from `tool_routing`, `presentation/builder`, and `contracts` (old aliases: `start_booking_session`, `update_booking_draft`, `resume_booking_session`, ...).
- Deleted obsolete booking session modules/tests (`booking_session_tools.py`, `booking_session.py`, legacy state-heavy test module).

**Changed files (evidence):**
- `petties-agent-serivce/app/core/tools/mcp_tools/__init__.py`
- `petties-agent-serivce/app/core/tools/scanner.py`
- `petties-agent-serivce/app/core/context_policy.py`
- `petties-agent-serivce/app/core/tools/tool_policy.py`
- `petties-agent-serivce/app/core/agents/booking_flow.py`
- `petties-agent-serivce/app/core/agents/prompt_builder.py`
- `petties-agent-serivce/app/core/presentation/builder.py`
- `petties-agent-serivce/app/core/agents/single_agent.py`
- `petties-agent-serivce/tests/test_context_policy.py`
- `petties-agent-serivce/tests/test_booking_context_prompt.py`
- `petties-agent-serivce/tests/test_websocket_chat.py`
- `petties-agent-serivce/app/core/tools/mcp_tools/booking_session_tools.py` (deleted)
- `petties-agent-serivce/app/core/agents/booking_session.py` (deleted)
- `petties-agent-serivce/tests/test_booking_session.py` (deleted)

**Validation evidence:**
- `cd petties-agent-serivce && python -m pytest tests/test_context_policy.py tests/test_booking_context_prompt.py -q` -> 25 passed
- `cd petties-agent-serivce && python -m pytest tests/test_booking_tools.py tests/test_booking_context_prompt.py tests/test_context_policy.py -q` -> 47 passed
- Deadcode sweep follow-up (booking scope):
  - Removed legacy references in tests (`test_booking_context_prompt.py`, `test_presentation_builder.py`, `test_websocket_chat.py`) so no runtime import/call path points to deleted booking-session tools.
  - Re-run verification: `cd petties-agent-serivce && python -m pytest tests/test_booking_tools.py tests/test_presentation_builder.py tests/test_booking_context_prompt.py tests/test_context_policy.py tests/test_websocket_chat.py -q` -> 97 passed, 1 skipped

---

## 📁 Key Documentation

| Document | Path |
|----------|------|
| SRS | `docs-references/documentation/SRS/PETTIES_SRS.md` |
| SDD | `docs-references/documentation/SDD/PETTIES_SDD.md` |
| AI Agent SRS | `docs-references/documentation/SRS/AI_AGENT_SERVICE_SRS.md` |
| AI Agent SDD | `docs-references/documentation/SDD/AI_AGENT_SERVICE_SDD.md` |
| WBS | `docs-references/documentation/WBS_PETTIES_14_SPRINTS.md` |
| Features | `docs-references/documentation/PETTIES_Features.md` |
| ERD | `docs-references/documentation/PETTIES_ERD_DIAGRAM.md` |
| BPMN | `docs-references/documentation/BUSINESS_WORKFLOW_BPMN.md` |
| Payment API | `docs-references/documentation/SEPAY_QR_PAYMENT_API.md` |
| AI Assistant | `docs-references/ai-agent/AI_COPILOT_CLINIC_USER_MANUAL.md` |

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
