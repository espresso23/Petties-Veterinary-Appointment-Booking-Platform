# API Contracts

> Last Updated: 2026-04-01
> Scope: All API endpoints for AI diagnosis, Case Memory management, and EMR sync

---

## 1. Staff Diagnosis API

### 1.1 POST /api/v1/staff-diagnosis/analyze

**Auth:** Requires `STAFF` or `ADMIN` role (JWT Bearer token).

**Request:**

```json
{
  "request_id": "uuid (optional)",
  "pet_id": "uuid (optional)",
  "booking_id": "uuid (optional)",
  "species": "dog | cat | other",
  "breed": "string (optional)",
  "age_months": 24,
  "weight_kg": 12.5,
  "sex": "male | female | unknown",
  "allergies": ["penicillin"],
  "doctor_description": "Mô tả lâm sàng...",
  "body_part": "Mắt | Tai | Da (optional)",
  "symptoms": ["ghèn vàng", "chảy nước mắt"],
  "image_urls": [
    "https://example.com/lesion.jpg",
    "data:image/png;base64,iVBORw..."
  ],
  "soap_draft": {
    "subjective": "",
    "objective": "",
    "assessment": "",
    "plan": ""
  },
  "synthesis_mode": "full | selected_only | describe_only",
  "previous_request_id": "uuid (required for selected_only)",
  "selected_diagnosis_code": "string (required for selected_only)",
  "selected_diagnosis_label": "string (required for selected_only)"
}
```

**Response:**

```json
{
  "request_id": "uuid",
  "evidence_mode": "internal_grounded | llm_fallback",
  "score_label": "Độ tự tin (%)",
  "top_differentials": [
    {
      "canonical_code": "ocular_infection",
      "display_name_vi": "Viêm kết mạc hoặc nhiễm trùng mắt",
      "rank": 1,
      "score_percent": 62,
      "score_basis": "matching_internal",
      "confidence_note": "Độ tự tin: 62%",
      "supporting_reasons": [
        "AI nhìn ảnh ghi nhận dấu hiệu phù hợp với hướng bệnh này.",
        "Đã đối chiếu với kho tri thức nội bộ."
      ]
    }
  ],
  "supporting_evidence_from_kb": [
    "Kho tri thức nội bộ (độ liên quan 0.85): Triệu chứng viêm kết mạc ở chó thường biểu hiện..."
  ],
  "similar_confirmed_cases": [
    "Ca EMR tương tự #1 (dog, điểm 0.87): Viêm kết mạc. Biểu hiện chính: ghèn vàng hai mắt..."
  ],
  "vision_findings": [
    "Ghèn vàng quanh mắt trái",
    "Kết mạc hồng nhạt"
  ],
  "image_descriptions": [
    "Mắt trái có ghèn vàng dày, kết mạc hồng nhẹ."
  ],
  "image_analysis": [
    {
      "url": "https://example.com/lesion.jpg",
      "description": "Mắt trái có ghèn vàng dày...",
      "order": 1
    }
  ],
  "suggested_questions": [
    "Triệu chứng xuất hiện từ khi nào?",
    "Bé có sốt không?"
  ],
  "soap_suggestions": {
    "subjective_draft": "ghèn vàng, chảy nước mắt",
    "objective_draft": "Ghèn vàng quanh mắt trái. Kết mạc hồng nhạt.",
    "assessment_draft": "Viêm kết mạc hoặc nhiễm trùng mắt.",
    "plan_draft": "1. Vệ sinh mắt NaCl 0.9% - Liều: theo chỉ định - Tần suất: 2 lần/ngày - Thời gian: 5 ngày"
  },
  "prescription_suggestions": [
    {
      "medicine_name": "Tobramycin 0.3%",
      "dosage": "1-2 giọt",
      "frequency": "3 lần/ngày",
      "duration_days": 5,
      "instructions": "Nhỏ vào mắt sau khi vệ sinh",
      "caution": "Kiểm tra phản ứng dị ứng trong 30 phút đầu",
      "route": "Nhỏ mắt",
      "source": "emr_pattern",
      "source_detail": "Học từ emr:123 (n=3, quality=accepted:0.95, support=5, accepted=4)"
    }
  ],
  "disclaimer": "Đây là gợi ý hỗ trợ tham khảo từ dữ liệu nội bộ. Cần kết hợp thăm khám lâm sàng trước khi chốt chẩn đoán và đơn thuốc cho thú cưng."
}
```

---

## 2. Gemini Vision Contract

### 2.1 Request contract

```json
{
  "request_id": "string",
  "species": "dog|cat|other",
  "image_urls": ["https://..."],
  "doctor_description": "string",
  "body_part": "string|null",
  "clinical_context": {
    "symptoms": ["string"],
    "duration": "string|null",
    "age_months": 24,
    "sex": "male|female|unknown"
  }
}
```

### 2.2 Response contract

```json
{
  "request_id": "string",
  "visual_findings": [
    "Vùng da đỏ, có đóng vảy, mất lông cục bộ"
  ],
  "top_conditions": [
    {
      "raw_label": "bacterial dermatitis",
      "canonical_code": "bacterial_dermatosis",
      "display_name_vi": "Viêm da do vi khuẩn",
      "confidence_score": 0.78,
      "reason": "Tổn thương phù hợp với tổn thương da viêm, có ban đỏ và vết tiết dịch nhẹ"
    }
  ],
  "needs_more_data": true,
  "missing_information": [
    "Cần biết thời gian mắc bệnh",
    "Cần biết có ngứa hay không"
  ],
  "safety_notes": [
    "Không thay thế chẩn đoán lâm sàng trực tiếp"
  ]
}
```

### 2.3 Usage rules

- Vision only suggests top conditions, does not make final diagnosis.
- Agent must cross-reference `canonical_code` with KB and Case Memory before responding.
- If vision output cannot map to canonical code, agent marks as `unmapped_label` and avoids strong conclusions.
- Final output to doctor must include disclaimer that this is advisory support only.
- API key source: `get_llm_client_from_db(db)` reads from `system_settings` table, not env vars.
- Image format: Accepts `https://` URLs or base64 `data:image/...;base64,` URLs. Skips `blob:` URLs.
- Maximum 10 images per request.

---

## 3. Case Memory Management API

### 3.1 GET /api/v1/knowledge/case-memory

List cases with pagination and filters.

| Query Param | Type | Description |
|-------------|------|-------------|
| `query` | string | Search in case content |
| `species` | string | Filter by species (dog, cat) |
| `diagnosis` | string | Filter by diagnosis keyword |
| `page` | int | Page number (default: 1) |
| `page_size` | int | Items per page (default: 20, max: 100) |

### 3.2 GET /api/v1/knowledge/case-memory/{case_id}

Get single case detail with runtime-only payload including `text_content`, diagnosis identity, and `protocol_pattern`.

### 3.3 DELETE /api/v1/knowledge/case-memory/{case_id}

Delete a case from Case Memory.

---

## 4. Internal EMR Sync API

### 4.1 POST /api/v1/internal/case-memory/emr-sync

**Auth:** Internal sync key (Spring Boot → AI service).

**Purpose:** Spring Boot pushes confirmed EMR records to AI service for Case Memory learning.

**Request:** `InternalConfirmedEmrItemDto` containing:

- `emr_id`, `clinic_id`, `booking_id`, `pet_id`, `doctor_id`
- `species`, `breed`
- `chief_complaint`, `symptoms`, `physical_exam`, `clinical_notes`
- `final_diagnosis_text`
- `soap` (subjective, objective, assessment, plan, notes)
- `vitals`
- `prescriptions`
- `ai_diagnosis_context` (optional snake_case audit payload from Web EMR)
- `exam_at`, `updated_at`, `re_examination_date`
- `attachments` (for example `image_urls`)

**Response:** Sync result with `case_id` or error.

---

## 5. Prescription Source Policy

| Priority | Source | Condition |
|---|---|---|
| 1 | `emr_pattern` | Confirmed EMR patterns exist for same `canonical_code` |
| 2 | `llm_fallback` | No valid EMR patterns, but sufficient internal evidence |
| 3 | empty | Neither source yields safe result |

**Rules:**

- Do not merge `emr_pattern` and AI medications in the same response batch.
- Use AI only when `emr_pattern` returns zero usable medications.
- Each prescription carries `source` and `source_detail` for auditability.
- Hardcoded disease-to-prescription rules are not allowed.
