# E2E Test Scenarios

> Last Updated: 2026-04-01
> Scope: Manual end-to-end checks for Staff AI diagnosis flow
> Companion: `docs-references/documentation/testing/AI_ASSISTANT_FULL_TEST_GUIDE.md` (broader AI assistant tests)

---

## 1. Purpose

This guide defines manual end-to-end checks for the active Staff AI diagnosis flow in the Web EMR workspace and the EMR-aware AI side panel.

---

## 2. Preconditions

1. Sign in as `STAFF` or `ADMIN` on the web application.
2. Prepare at least one pet record and one appointment that can open the EMR workspace.
3. Start `petties-agent-serivce` with `/api/v1/staff-diagnosis/analyze` mounted.
4. Start Spring Boot with EMR save and confirmed sync enabled.
5. Prefer having internal KB data and at least one confirmed EMR case for richer evidence output.

---

## 3. Mandatory Hardening Checks

Verify the following before calling the flow production-ready:

| # | Check | Expected |
|---|-------|----------|
| 1 | `booking_id` validation | Validated against real booking record before synthesis |
| 2 | `pet_id` validation | Validated if no booking context exists |
| 3 | Role and clinic scope | Enforced for `STAFF` (403/404/422 semantics) |
| 4 | No `web_search` | Never used in staff diagnosis flow |
| 5 | No-image diagnosis | System can diagnose without clinical images |
| 6 | `selected_only` safety | Works only after prior `full` request; fails safely on cache miss |
| 7 | Direct EMR sync | Confirmed EMR sync uses direct push, not polling |

---

## 4. Scenario A: Full Diagnosis from EMR Workspace

### Steps

1. Open Create EMR for a real pet.
2. Enter a clinical narrative in the diagnosis panel.
3. Optionally upload one or more clinical images.
4. Run AI diagnosis.

### Expected Result

- The request reaches `POST /api/v1/staff-diagnosis/analyze`
- The response contains grounded differentials, evidence, and SOAP suggestions
- The workflow succeeds even if there are no images
- No `web_search` behavior appears in logs or UI

---

## 5. Scenario B: Selected Diagnosis Follow-up

### Steps

1. Complete Scenario A successfully.
2. Choose one diagnosis from the top differential list.
3. Observe the follow-up synthesis step.

### Expected Result

- Web sends `synthesis_mode = selected_only`
- Web includes `previous_request_id`, `selected_diagnosis_code`, and `selected_diagnosis_label`
- The response reuses prior grounded context when cache is present
- Treatment-facing output prioritizes learned `common_prescriptions` before AI fallback

### Negative Check

- If cached context is unavailable, the workflow fails safely without breaking EMR entry

---

## 6. Scenario C: EMR-Aware Side Panel in Staff AI Chat

### Steps

1. Open Staff AI Chat from an EMR-related context.
2. Open the EMR-aware diagnosis side panel.
3. Trigger AI diagnosis from the side panel.
4. Insert generated SOAP text back into the active EMR draft.

### Expected Result

- The side panel shares the active EMR draft
- AI diagnosis behaves the same as the embedded EMR panel
- Inserted SOAP text updates the EMR draft without losing existing form state

---

## 7. Scenario D: Provisional Mapping Case

### Steps

1. Save a confirmed EMR whose final diagnosis label does not map to the disease catalog.
2. Verify confirmed sync behavior.

### Expected Result

- The record is still ingested into Case Memory
- Payload includes `mapping_status = provisional`
- Payload includes `provisional_label = final_diagnosis_text`
- No runtime review queue write is required for this flow

---

## 8. Verify Direct Confirmed EMR Sync

### Steps

1. Start Spring Boot and the AI service.
2. Confirm that the internal direct sync route exists: `POST /api/v1/internal/case-memory/emr-sync`.
3. Create or update a confirmed EMR in Spring Boot.
4. Verify that Spring Boot triggers the direct sync request immediately after EMR persistence.

### Expected Result

- No polling worker is required
- No manual batch sync endpoint is required
- The corresponding `case_id = emr:{emr_id}` appears in Case Memory or is overwritten if it already existed

---

## 9. Pass Criteria

The deployed flow is considered aligned only if all of the following are true:

| # | Criterion |
|---|-----------|
| 1 | Runtime diagnosis works from both the EMR panel and the AI side panel |
| 2 | `selected_only` uses the correct follow-up contract |
| 3 | The final saved EMR persists canonical snake_case `ai_diagnosis_context` |
| 4 | Confirmed EMR records are pushed directly from Spring Boot into Case Memory |
| 5 | `protocol_pattern` is updated from real EMR data rather than deprecated feedback or polling logic |

---

## 10. Automated Test Commands

### Backend (AI Service)

```bash
cd petties-agent-serivce
pytest tests/test_staff_diagnosis_service.py -v
```

### Key Test Cases

| Test | Coverage |
|------|----------|
| `test_selected_only_reuses_cached_context_and_keeps_emr_pattern_prescriptions` | Cache reuse + EMR pattern priority |
| `test_selected_only_falls_back_to_llm_prescriptions_when_protocol_empty` | LLM fallback when no EMR patterns |
| `test_analyze_case_uses_internal_retrieval_and_protocol_prescriptions` | Full flow with internal evidence |
| `test_analyze_case_reports_missing_internal_information_when_retrieval_empty` | Empty evidence handling |
| `test_analyze_case_with_images_returns_image_analysis` | Image analysis flow |
| `test_analyze_case_handles_all_services_failure` | Graceful degradation |
| `test_fallback_no_keyword_heuristic_for_ear` | No hardcoded ear diagnosis |
| `test_fallback_no_keyword_heuristic_for_eye` | No hardcoded eye diagnosis |
| `test_build_plan_draft_does_not_append_allergy_or_weight_tail` | Clean plan formatting |
| `test_parse_llm_synthesis_response_normalizes_mismatched_label_and_code` | Label/code mismatch safety |
