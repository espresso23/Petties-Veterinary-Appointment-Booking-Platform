# AI Diagnosis Feature - Progress Checklist

> Chi tiết backlog triển khai: `AI_DIAGNOSIS_IMPLEMENTATION_BACKLOG.md`

> Last Updated: 2026-03-20 (bugfix)
> Status: Rebaselined sau khi đổi hướng kiến trúc

---

## Summary

| Workstream | Progress | Status |
|------------|----------|--------|
| Disable custom vision runtime cũ | 100% | DONE |
| Chặn `web_search` trong doctor flow | 100% | DONE |
| Giữ `web_search` cho pet owner flow | 100% | DONE |
| Thiết kế schema EMR -> case memory | 100% | DONE |
| Thiết kế contract Gemini Vision | 100% | DONE |
| Thiết kế mapping disease labels | 100% | DONE |
| Feedback loop cũ dựa trên thumbs up/down | 0% | DEPRECATED |
| Implement ingest từ EMR confirmed | 100% | DONE |
| Implement Gemini Vision | 75% | IN_PROGRESS |
| Implement synthesis KB + EMR + vision | 100% | DONE |
| Runtime retrieval thật trong `staff_diagnosis_service` | 100% | DONE |
| Disease mapping DB-backed + review queue | 100% | DONE |
| Protocol engine v2 cho SOAP + đơn thuốc | 100% | DONE |
| Dynamic Protocol v3 (học từ EMR) | 100% | DONE |
| Luồng EMR ↔ Chat sidepanel cho STAFF | 100% | DONE |

---

## 1. Điều gì đã thay đổi

Hướng của project đã chuyển từ custom `vision_model` sang kiến trúc chẩn đoán ưu tiên dữ liệu nội bộ:

- `STAFF` không còn dùng `web_search` cho luồng chẩn đoán.
- `PET_OWNER` vẫn giữ `web_search` như fallback.
- EMR confirmed trở thành nguồn chính cho case memory và vòng học dữ liệu.
- Chẩn đoán qua ảnh được thiết kế lại theo hướng Gemini Vision + mô tả bác sĩ + grounding nội bộ.

---

## 2. Trạng thái code

### 2.1 Đã hoàn tất trong code

- Runtime AI Diagnose cũ đã được disable trên custom vision stack trước đó.
- `context_policy.py` đã bỏ `web_search` khỏi whitelist của `STAFF`.
- `context_policy.py` đã thêm guardrail cho doctor flow:
  - chỉ dùng KB nội bộ / EMR confirmed / nguồn nội bộ đáng tin cậy
  - nếu không có dữ liệu nội bộ thì phải trả lời là hệ thống chưa có thông tin về bệnh đó
- `docker-compose.dev.yml` đã bỏ các thành phần Label Studio và mount dataset phục vụ hướng AI Diagnose cũ.
- `staff_diagnosis_service.py` đã gọi thật:
  - `HybridRAGEngine` cho knowledge base + knowledge graph nội bộ
  - `CaseMemoryService` cho ca EMR xác nhận tương tự
  - `GeminiVisionAdapter` cho ảnh lâm sàng nếu có ảnh
- Kết quả diagnosis hiện được tổng hợp từ dữ liệu retrieval thật thay vì placeholder wording:
  - `supporting_evidence_from_kb`
  - `similar_confirmed_cases`
  - `top_differentials`
  - `soap_suggestions`
- `DiseaseMappingService` đã chuyển sang kiến trúc DB-backed:
  - load `disease_catalog` và `disease_aliases` từ PostgreSQL
  - giữ snapshot fallback trong memory cho local/dev và test
  - ghi `unmapped diagnosis` vào `disease_mapping_review_items`
- `DiagnosisProtocolService` đã được nâng lên v2:
  - SOAP và đơn thuốc nháp dùng cùng một chẩn đoán ưu tiên
  - Có gate an toàn: không có evidence nội bộ thì không trả đơn thuốc AI
  - Có gate dữ liệu: thiếu cân nặng thì không tính liều toàn thân cho protocol cần `mg/kg`
  - Có guard theo nghiệp vụ: mắt cần fluorescein khi nghi loét, tai cần soi tai, da cần cytology/cạo da
- **Dynamic Protocol v3 (2026-03-19):** Protocol hoàn toàn không hardcode - học từ EMR confirmed:
  - `emr_case_memory_sync_service.py`: Trích xuất `protocol_pattern` từ EMR (SOAP, prescriptions, tests, recommendations)
  - `staff_diagnosis_service.py`: `_extract_protocol_patterns_from_cases()` - lấy patterns từ similar cases
  - `diagnosis_protocol_service.py`: `apply_emr_patterns()` - áp dụng patterns vào protocol decision
  - Điều chỉnh liều thuốc theo cân nặng bệnh nhân (`_adjust_dosage_for_weight()`)
  - Không cần thêm bệnh mới bằng code - tự học từ EMR
- Payload từ EMR/web sang AI diagnosis đã bổ sung:
  - `weight_kg`
  - `allergies`
  - dữ liệu này được đồng bộ cả ở Create EMR page và chat sidebar draft
- `knowledge.py` đã có endpoint admin để sync batch EMR confirmed vào Case Memory:
  - `POST /api/v1/knowledge/case-memory/sync-emr-confirmed`
- `emr_case_memory_sync_service.py` đã:
  - refresh disease mapping từ DB trước khi sync
  - đẩy nhãn chưa map được vào review queue thay vì bỏ qua âm thầm

### 2.2 Đã tạm dừng có chủ đích

- `petties-agent-serivce/app/core/vision_model/*`
- `petties-agent-serivce/app/api/routes/vision.py`
- `petties-agent-serivce/app/api/routes/vision_diseases.py`
- Web admin AI Diagnose cũ
- Feedback loop cũ xoay quanh thumbs up/down
- Label Studio trong môi trường dev

### 2.3 Chưa hoàn tất

- Job hoặc scheduler chạy batch sync EMR confirmed sang case memory theo chu kỳ
- Bộ disease mapping đầy đủ hơn ngoài nhóm bệnh mắt, tai, da
- Admin UI/API để duyệt `disease_mapping_review_items`
- E2E automation test cho luồng diagnosis trong EMR/sidebar

---

## 3. Trạng thái chiến lược dữ liệu

### 3.1 Chiến lược cũ

- Source of truth: feedback của user/staff với gợi ý AI
- Training target: custom `vision_model`
- Trạng thái hiện tại: deprecated

### 3.2 Chiến lược mới

- Source of truth: EMR confirmed do bác sĩ nhập
- Các thành phần tái sử dụng từ EMR:
  - final diagnosis
  - symptoms
  - clinical notes
  - lab results
  - prescriptions / treatment plan
  - ảnh đính kèm nếu có
- Trạng thái hiện tại: đã có schema thiết kế, chưa implement pipeline

---

## 4. Deliverables thiết kế đã hoàn tất

### 4.1 Schema EMR -> Case Memory

Đã thiết kế trong `AI_DIAGNOSIS_FEATURE_PLAN.md`, gồm:

- raw EMR extract schema
- standardized case memory document schema
- quy tắc tạo search text
- điều kiện chỉ ingest EMR confirmed

### 4.2 Contract Gemini Vision

Đã thiết kế trong `AI_DIAGNOSIS_FEATURE_PLAN.md`, gồm:

- request fields: ảnh, mô tả bác sĩ, species, body part, clinical context
- response fields: visual findings, top conditions, canonical code, confidence, missing information, safety notes

### 4.3 Mapping disease labels

Đã thiết kế trong `AI_DIAGNOSIS_FEATURE_PLAN.md`, gồm:

- canonical disease code
- KB references
- EMR aliases
- vision aliases
- species scope

---

## 5. Trạng thái dữ liệu đã label

Dữ liệu ảnh đã label vẫn còn giá trị như một tài sản tham chiếu, nhưng không còn là trung tâm duy nhất của kiến trúc mới.

Diễn giải hiện tại:

- Label Studio và dữ liệu label cũ vẫn có thể tái sử dụng cho evaluation hoặc curated dataset.
- Chỉ label ảnh thôi thì chưa đủ để hoàn tất kiến trúc chẩn đoán mới.
- EMR confirmed mới là nguồn chính để làm giàu dữ liệu đáng tin cậy và cải thiện model về sau.

---

## 6. Rủi ro và khoảng trống

1. `feedback_service.py` vẫn phản ánh tư duy thumbs-feedback cũ và chưa được thiết kế lại.
2. Disease catalog mới chỉ seed nhóm mắt, tai, da; chưa phủ đủ toàn bộ bệnh thú y.
3. Chưa có admin UI hoặc workflow duyệt `disease_mapping_review_items`.
4. Chưa có benchmark chính thức cho Gemini Vision + retrieval + protocol trên tập EMR xác nhận.
5. Custom vision code cũ đã bị disable, nên hướng mới cần tiếp tục mở rộng trước khi coi là complete production.

---

## 7. Next steps

1. Mở rộng disease catalog và alias cho nhiều nhóm bệnh hơn.
2. Tạo admin UI hoặc API review cho `disease_mapping_review_items`.
3. Thêm scheduler hoặc event-driven sync cho EMR confirmed -> case memory.
4. Benchmark Gemini Vision + retrieval + protocol trên tập EMR xác nhận.
5. Thiết kế lại `feedback_service.py` theo hướng học từ EMR thay vì thumbs feedback.

---

## 8. Baseline mới

Từ ngày 2026-03-17, team nên xem hướng `vision_model` custom cũ là paused, và baseline mới là:

- internal knowledge first
- không dùng web search cho doctor diagnosis
- case memory dựa trên EMR confirmed
- Gemini Vision cho image understanding
- học tiếp từ EMR confirmed thay vì thumbs feedback

---

## 9. Code skeleton delivered (2026-03-17)

---

## 10. Update 2026-03-18 - Auto-sync confirmed EMR

- Mọi EMR đã được xác nhận giờ có thể được ingest vào Case Memory ngay cả khi `final_diagnosis_text` chưa map được vào catalog.
- Nếu map được:
  - lưu `canonical_code`
  - `mapping_status = mapped`
- Nếu chưa map được:
  - vẫn upsert vào Case Memory
  - lưu `mapping_status = provisional`
  - lưu `provisional_label = final_diagnosis_text`
  - đồng thời ghi review item để mở rộng catalog về sau
- `CaseMemoryService.upsert_case()` đã hỗ trợ overwrite theo `case_id = emr:{emr_id}`.
- Điều này cho phép sync lại khi EMR confirmed bị cập nhật mà không tạo case mới trùng lặp.
- `main.py` đã khởi động background worker tự polling EMR confirmed thay đổi:
  - bật/tắt bằng `EMR_CASE_MEMORY_AUTO_SYNC_ENABLED`
  - chu kỳ bằng `EMR_CASE_MEMORY_AUTO_SYNC_INTERVAL_SECONDS`
  - worker dùng `updated_from` / `updated_to` để chỉ lấy phần EMR mới thay đổi

Da tao skeleton code cho huong moi:

- `petties-agent-serivce/app/api/schemas/diagnosis_contracts.py`
- `petties-agent-serivce/app/core/services/disease_mapping_service.py`
- `petties-agent-serivce/app/core/services/emr_case_memory_sync_service.py`
- `petties-agent-serivce/app/core/vision/gemini_vision_adapter.py`

Cap nhat export:

- `petties-agent-serivce/app/api/schemas/__init__.py`
- `petties-agent-serivce/app/core/services/__init__.py`

Unit test moi:

- `petties-agent-serivce/tests/test_diagnosis_contracts.py`
- `petties-agent-serivce/tests/test_disease_mapping_service.py`
- `petties-agent-serivce/tests/test_emr_case_memory_sync_service.py`

---

## 10. Kiểm tra độ khớp giữa EMR hiện tại và schema AI mới (2026-03-17)

Kết quả audit:

- Khớp về nghiệp vụ: EMR hiện tại đã có SOAP notes, prescriptions, images, ngày khám và tái khám.
- Chưa khớp 1:1 về payload: AI service đang kỳ vọng schema đã chuẩn hóa hơn so với `CreateEmrRequest` và `EmrResponse`.
- Payload ảnh trong chat/agent đã khớp tương đối tốt với hướng Gemini Vision mới.
- Cần thêm lớp `internal AI export DTO` ở backend Spring Boot trước khi nối thật luồng ingest.

Tài liệu chi tiết mapping đã được bổ sung tại:

- `docs-references/documentation/AI_DIAGNOSIS_IMPLEMENTATION_BACKLOG.md` - mục `12. Mapping giữa EMR hiện tại và schema AI mới`

---

## 11. Documentation draft cho UX/UI và code design (2026-03-17)

Đã bổ sung documentation-first draft để chốt hướng triển khai trước khi code:

- SRS: thêm `3.11.11 Hỗ trợ AI chẩn đoán trong không gian làm việc EMR (UC-STAFF-11)`
- SDD: thêm `4.21 Staff AI Diagnosis in EMR Workspace`

Nội dung đã chốt trong draft:

- Điểm vào UX chính là màn hình tạo EMR của `STAFF`, không phải một trang admin AI riêng.
- AI panel nằm cạnh SOAP notes, chỉ cần 1 ô mô tả lâm sàng, đọc ảnh lâm sàng ngay trong EMR và trả gợi ý inline cho `S/O/A/P`.
- Luồng chẩn đoán cho `STAFF` không dùng `web_search`.
- Sequence từ nhập mô tả + ảnh lâm sàng -> Gemini Vision + KB + case memory -> trả kết quả có nguồn bằng chứng.
- Sequence đồng bộ `EMR confirmed` -> case memory để làm giàu dữ liệu nội bộ.

---

## 12. Cập nhật triển khai thực tế (2026-03-18)

Đã hoàn tất phần code chạy thực tế cho luồng làm việc của bác sĩ/staff:

- Backend:
  - Route `POST /api/v1/staff-diagnosis/analyze` cho `STAFF`/`ADMIN`.
  - Service tổng hợp chẩn đoán staff từ mô tả lâm sàng + vision findings + gợi ý SOAP.
  - Response đã mở rộng thêm `prescription_suggestions` để frontend nhận đơn thuốc nháp từ AI.
  - Contract request/response cho staff diagnosis đã được áp dụng trong API.

- Frontend:
  - `AIDiagnosisPanel` hoạt động trong trang tạo EMR với 1 ô mô tả lâm sàng duy nhất.
  - Panel hiển thị rõ nguồn ảnh: chỉ đọc ảnh lâm sàng đã tải ở EMR, không dùng ảnh tài liệu/PDF.
  - Sau khi phân tích, AI tự điền mô tả riêng cho từng ảnh lâm sàng còn trống theo đúng thứ tự upload.
  - Gợi ý SOAP được nhận inline ngay dưới từng ô `Subjective`, `Objective`, `Assessment`, `Plan`.
  - Đơn thuốc AI có thể nhận toàn bộ hoặc thêm từng thuốc vào danh sách kê đơn hiện tại.
  - Thêm cơ chế bridge bản nháp EMR qua `localStorage` (`petties:emr-ai-draft:v1`) và global sidebar store.
  - Từ trang EMR có thể mở trực tiếp `ChatSidebar` global.
  - Chat sidebar hiển thị bản nháp EMR được merge ngay trong luồng hội thoại của cùng sidebar chính, không mở thêm cột/sidebar phụ, và có thể đổ ngược dữ liệu về form EMR ngay trên cùng màn hình.

- Tài liệu:
  - Đã bổ sung hướng dẫn kiểm thử end-to-end tại:
    - `docs-references/documentation/AI_DIAGNOSIS_E2E_GUIDE.md`

---

## 13. Sửa lỗi auto-sync và migration fallback (2026-03-18)

Đã vá hai lỗi triển khai thường gặp ở môi trường dev/test:

- `EMR Case Memory auto-sync`:
  - Worker không còn gọi endpoint nội bộ mà thiếu auth.
  - Đã thêm cơ chế:
    - dùng trực tiếp `EMR_CASE_MEMORY_AUTO_SYNC_TOKEN`, hoặc
    - tự đăng nhập qua `/api/auth/login` bằng `EMR_CASE_MEMORY_AUTO_SYNC_USERNAME` + `EMR_CASE_MEMORY_AUTO_SYNC_PASSWORD`
  - Nếu gặp `401`, worker sẽ tự login lại và retry một lần cho batch hiện tại.
  - Nếu chưa cấu hình auth, worker sẽ log cảnh báo rõ ràng và bỏ qua vòng sync thay vì spam lỗi HTTP mỗi chu kỳ.

- `Disease mapping refresh`:
  - Khi thiếu migration `disease_catalog`, service sẽ log cảnh báo rõ ràng rằng cần chạy `alembic upgrade head`.
  - Đã thêm throttle cho lần thử refresh từ DB để tránh spam warning liên tục khi schema chưa được migrate.
  - Fallback snapshot trong memory vẫn tiếp tục hoạt động cho diagnosis runtime.

---

## 14. Chốt internal auto-sync feed giữa Spring và AI service (2026-03-19)

Đã hoàn thiện nhánh backend cho auto-sync ổn định hơn:

- Spring Boot:
  - Thêm internal feed `GET /api/internal/ai/emrs/confirmed`.
  - Feed trả batch EMR đã được bác sĩ lưu, dùng cho AI service polling theo `updated_from`, `updated_to`, `limit`, `cursor`.
  - Thêm `updatedAt` cho `EmrRecord` để hỗ trợ delta sync khi EMR bị chỉnh sửa.
  - Thêm `InternalAiAuthenticationFilter` với header `X-Internal-AI-Key`.
  - Endpoint nội bộ nhận auth theo `ROLE_INTERNAL_AI` hoặc `ADMIN`.

- AI service:
  - Auto-sync worker ưu tiên `EMR_CASE_MEMORY_AUTO_SYNC_INTERNAL_KEY`.
  - Nếu chưa có internal key, vẫn fallback sang `Bearer token` hoặc login service account như thiết kế trước đó.
  - Contract `fetch_confirmed_emrs()` đã gửi `X-Internal-AI-Key` khi được cấu hình.

- Kết quả test đã chạy:
  - Spring Boot targeted tests pass:
    - `EmrServiceUnitTest`
    - `InternalAiEmrControllerUnitTest`
    - `InternalAiAuthenticationFilterUnitTest`

- Giới hạn môi trường test:
  - Chưa chạy được `pytest` thật cho AI service trong sandbox hiện tại vì runtime Python cục bộ không khả dụng và `venv` đang trỏ tới interpreter ngoài sandbox.

---

## 18. Fix: SOAP suggestions ready-to-apply + Vision import fix (2026-03-20)

**Fix 1:** Assessment giờ chỉ hiện diagnosis text, không hiện mã nội bộ:
- Trước: `Viêm kết mạc hoặc nhiễm trùng mắt (Mã: ocular_infection).`
- Sau: `Viêm kết mạc hoặc nhiễm trùng mắt.`

**Fix 2:** Vision adapter import sai:
- Trước: `from app.db.postgres.database import AsyncSessionLocal` → `No module named 'app.db.postgres.database'`
- Sau: `from app.db.postgres.session import AsyncSessionLocal`

**Files changed:**
- `petties-agent-serivce/app/core/services/staff_diagnosis_service.py`
- `petties-agent-serivce/app/core/vision/gemini_vision_adapter.py`
- 5/5 tests pass

**Trước:** AI trả protocol guidance chung chung - không ready to apply:
- `O`: "Dấu hiệu từ ảnh: ghèn vàng..." (meta)
- `A`: "Chẩn đoán phân biệt ưu tiên cho thú cưng: Viêm kết mạc. Cơ sở hiện có: Có thêm tín hiệu từ ảnh lâm sàng."
- `P`: "Protocol mắt ưu tiên vệ sinh mắt, đánh giá đau mắt, nhuộm fluorescein..."

**Sau:** Text ready-to-apply cho từng ô SOAP:
- `S`: Chỉ copy nguyên triệu chứng user nhập
- `O`: Clinical observations rõ ràng từ vision findings
- `A`: Diagnosis text thẳng, không preamble: "Viêm kết mạc mắt trái, nghi nhiễm trùng thứ phát. (Mã: ocular_infection)."
- `P`: Concrete steps theo dòng:
  ```
  1. Vệ sinh mắt NaCl 0.9% - Liều: theo chỉ định - Tần suất: 2 lần/ngày - Thời gian: 5 ngày
  2. Tobramycin 0.3% nhỏ mắt - Liều: 1-2 giọt - Tần suất: 3 lần/ngày - Thời gian: 5 ngày
  3. Tái khám 3-5 ngày.
  Lưu ý: Kiểm tra phản ứng dị ứng trong 30 phút đầu.
  Chống chỉ định với dị ứng đã ghi nhận: penicillin.
  Cân nặng: 12.5 kg.
  ```

**Thay đổi code:**
- `_build_soap_suggestions()`: Split thành 3 methods riêng
- `_build_objective_draft()`: Clinical observations từ vision findings
- `_build_assessment_draft()`: Diagnosis text thẳng, không meta
- `_build_plan_draft()`: Concrete numbered steps từ prescriptions + cautions + allergies
- Xóa `_build_assessment_basis()` và `_build_plan_text()` cũ

**Files changed:**
- `petties-agent-serivce/app/core/services/staff_diagnosis_service.py`
- `petties-agent-serivce/tests/test_staff_diagnosis_service.py` (5 tests pass)

---

## 17. Bugfix: Vision đọc OpenRouter key từ DB (2026-03-20)

**Bug:** Staff upload ảnh → AI trả "Chưa có mô tả từ AI" → logs: `Gemini vision adapter failed: OpenRouter API key is required`

**Root cause:** `gemini_vision_adapter.py` dùng `get_llm_client()` - singleton đọc từ `settings.OPENROUTER_API_KEY` (env var). Trong khi API key được lưu trong DB `system_settings`, không có env var.

**Fix:**
- Thêm `get_llm_client_from_db(db)` - cached async getter đọc từ DB `system_settings`
- Update `gemini_vision_adapter.analyze()` dùng `get_llm_client_from_db(db)` thay vì `get_llm_client()`
- Cached theo cache_key = `{api_key}:{model}:{fallback}` để tự refresh khi settings thay đổi

Files changed:
- `petties-agent-serivce/app/services/llm_client.py`: thêm `get_llm_client_from_db()`
- `petties-agent-serivce/app/core/vision/gemini_vision_adapter.py`: dùng `get_llm_client_from_db()`

---

## 16. Image Analysis E2E Test (2026-03-20)

Đã xác nhận flow `image_analysis` end-to-end hoạt động đúng qua unit tests:

- `test_analyze_case_with_images_returns_image_analysis`: Xác nhận khi có ảnh → AI gọi Vision → trả về `image_analysis` array đúng thứ tự upload với `url`, `description`, `order`
- `test_analyze_case_without_images_returns_empty_image_analysis`: Xác nhận khi không có ảnh → `image_analysis = []`

Chain đầy đủ:
1. **Frontend** (`CreateEmrPage.tsx`): Gửi `pendingImageUrls` (blob preview) + `imageUrls` (đã upload) sang `AIDiagnosisPanel`
2. **AIDiagnosisPanel**: Merge thành `allImageUrls`, gửi lên `POST /api/v1/staff-diagnosis/analyze`
3. **Backend** (`staff_diagnosis_service.py`):
   - `_analyze_vision()` → gọi Gemini Vision với `image_urls`
   - Vision trả `image_descriptions` per image
   - `_build_image_analysis()` → map URL → description theo index
4. **Response** `DoctorDiagnosisSynthesisResponse.image_analysis`: `[{url, description, order}, ...]`
5. **Frontend AIDiagnosisPanel**: Hiển thị từng ảnh với mô tả AI bên dưới

Tất cả 4 unit tests pass: `pytest tests/test_staff_diagnosis_service.py -v` → 4 passed.

---

## 15. Chuyển sang push sync trực tiếp (2026-03-19)

- Đã bỏ:
  - `InternalAiEmrController`
  - `InternalAiAuthenticationFilter`
  - `EmrCaseMemoryAutoSyncService`
  - flow polling batch/cursor
- Đã thêm:
  - Spring `AiCaseMemorySyncService`
  - AI route `POST /api/v1/internal/case-memory/emr-sync`
  - xác thực route nội bộ bằng `AI_INTERNAL_SYNC_KEY`
- Quy tắc mới:
  - chỉ sync khi EMR có `assessment`
  - nếu AI lỗi thì không làm fail thao tác lưu EMR
  - cùng `emr_id` sẽ overwrite cùng `case_id`
