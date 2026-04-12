# Data Models

> Last Updated: 2026-04-08
> Scope: Qdrant Case Memory, Disease Catalog, EMR schemas, Case Memory document schema

---

## 1. Case Memory (Qdrant)

**Collection:** `petties_case_memory_v2`

### 1.1 Named Vectors

| Vector | Dimensions | Provider |
|--------|------------|----------|
| `text` | 1024 | Cohere embed-multilingual-v3.0 |
| `image` | 1024 | Jina CLIP v2 (optional) |

### 1.2 Point Payload Schema

```json
{
  "case_id": "emr:{emr_id}",
  "text_content": "Concatenated retrieval text used by AI query source",
  "species": "dog",
  "chief_complaint": "Ghèn vàng mắt trái 3 ngày",
  "clinical_notes": "Red eye with yellow discharge",
  "clinical_image_urls": ["https://..."],
  "image_urls": ["https://..."],
  "final_diagnosis_text": "Viêm kết mạc",
  "canonical_code": "ocular_infection",
  "mapping_status": "mapped",
  "exam_at": "2026-03-20T10:00:00Z",
  "protocol_pattern": {
    "soap_template": {"assessment": "Viêm kết mạc"},
    "common_prescriptions": [
      {"medicine": "Tobramycin 0.3%", "dosage": "1-2 giọt", "frequency": "3 lần/ngày"}
    ],
    "common_tests": [],
    "common_recommendations": ["Tái khám 3-5 ngày"]
  }
}
```

**Runtime rule:** the stored point payload is now runtime-focused. Fields that are not directly used by `ai-diagnose` retrieval, ranking, or grounded synthesis should not remain in the Case Memory point payload.

**Image reference rule:**
- Only URL-based image references are stored in payload (`clinical_image_urls` and `image_urls` alias).
- Raw/base64 image payloads must not be stored in Qdrant payload.

---

## 2. Disease Catalog (PostgreSQL)

### 2.1 Tables

| Table | Purpose |
|-------|---------|
| `disease_catalog` | Canonical disease codes and display names |
| `disease_aliases` | Raw label → canonical code mappings |

### 2.2 Mapping Table Design

```json
{
  "canonical_code": "bacterial_dermatosis",
  "display_name_vi": "Viêm da do vi khuẩn",
  "species_scope": ["dog", "cat"],
  "kb_entry_id": "kb:123",
  "kb_title": "Viêm da do vi khuẩn",
  "emr_aliases": [
    "Viêm da nhiễm khuẩn",
    "Bacterial dermatitis"
  ],
  "vision_aliases": [
    "bacterial dermatitis",
    "skin bacterial infection"
  ],
  "is_active": true
}
```

### 2.3 Mapping Process

1. Take `final_diagnosis_text` from EMR.
2. Match exact alias first.
3. If no exact alias exists, retrieve nearest canonical candidates.
4. Use internal LLM canonicalization to decide `map_existing`, `create_new`, or `keep_provisional`.
5. Auto-write the resolved alias or canonical disease back into the same active tables.
6. Only after mapping, add to Case Memory and training pool.
7. Vision output must also map through this table before ranking.

### 2.4 Autonomous mode (active design)

The active storage keeps the same tables without adding new ones:

| Table | Active role |
|---|---|
| `disease_catalog` | Canonical disease registry |
| `disease_aliases` | Auto-learned alias registry |

Runtime behavior:

1. Exact alias match from `disease_aliases`.
2. If unmatched, retrieve nearest canonical candidates.
3. LLM decides `map_existing`, `create_new`, or `keep_provisional`.
4. System auto-writes back into `disease_aliases` or `disease_catalog`.
5. No daily admin alias maintenance is required in the normal workflow.

---

## 3. Raw EMR Extract Schema

Schema for extracting confirmed EMR records into Case Memory:

```json
{
  "emr_id": "string",
  "clinic_id": "string",
  "booking_id": "string|null",
  "pet_id": "string",
  "doctor_id": "string",
  "exam_at": "ISO-8601 datetime",
  "updated_at": "ISO-8601 datetime|null",
  "re_examination_date": "ISO-8601 datetime|null",
  "species": "dog|cat|other",
  "breed": "string|null",
  "chief_complaint": "string",
  "symptoms": ["string"],
  "physical_exam": ["string"],
  "clinical_notes": "string",
  "final_diagnosis_text": "string",
  "soap": {
    "subjective": "string|null",
    "objective": "string|null",
    "assessment": "string|null",
    "plan": "string|null",
    "notes": "string|null"
  },
  "vitals": {
    "weight_kg": 4.2,
    "temperature_c": 38.5,
    "heart_rate": 120,
    "bcs": 5
  },
  "prescriptions": [
    {
      "medicine_name": "string",
      "times_of_day": ["sang", "trua", "chieu", "toi"],
      "before_after_meal": "BEFORE_MEAL | AFTER_MEAL | WITH_MEAL | NONE",
      "duration_days": 7,
      "route": "PO | SC | IV | IM | topical | other",
      "frequency_note": "string|null",
      "instructions": "string (ưu tiên mô tả rõ cách dùng: trước/sau ăn, chia lần uống, lưu ý tác dụng phụ, ...)"
    }
  ],
  "ai_diagnosis_context": {
    "request_id": "string",
    "selected_diagnosis_code": "string|null",
    "selected_diagnosis_label": "string|null",
    "suggested_prescriptions": []
  },
  "attachments": {
    "image_urls": ["https://..."]
  },
  "verified": true
}
```

---

## 4. Case Memory Runtime Projection

Projection returned by Case Memory admin APIs:

```json
{
  "case_id": "emr:{emr_id}",
  "species": "dog",
  "chief_complaint": "string",
  "clinical_notes": "string|null",
  "clinical_image_urls": ["https://..."],
  "display_name_vi": "string|null",
  "final_diagnosis_text": "string",
  "canonical_code": "string|null",
  "mapping_status": "mapped|provisional",
  "exam_at": "ISO-8601 datetime|null",
  "text_content": "string",
  "protocol_pattern": {
    "soap_template": {
      "assessment": "string|null"
    },
    "common_prescriptions": [],
    "common_tests": [],
    "common_recommendations": []
  }
}
```

### 4.1 Search Text Construction

Field `text_content` is built from:

- species + breed
- chief complaint
- symptoms
- physical exam
- clinical notes summary
- final diagnosis mapped to canonical label

Purpose:

- retrieve similar cases
- provide grounded context to the diagnosis agent
- keep the Case Memory schema aligned with real runtime usage

---

## 5. ai_diagnosis_context Schema

Canonical persisted AI context saved inside EMR (snake_case):

```json
{
  "request_id": "req-123",
  "selected_diagnosis_code": "bacterial_dermatosis",
  "selected_diagnosis_label": "Bacterial dermatitis",
  "suggested_prescriptions": [
    {
      "medicine_name": "Cephalexin",
      "times_of_day": ["sang", "toi"],
      "before_after_meal": "AFTER_MEAL",
      "duration_days": 14,
      "route": "PO",
      "frequency_note": "2 lần/ngày, cách nhau khoảng 12 giờ",
      "instructions": "Cho uống sau ăn với nước sạch; không uống chung với sữa; theo dõi nôn, tiêu chảy và liên hệ lại nếu có dấu hiệu bất thường.",
      "source": "llm_fallback",
      "source_detail": "selected_only fallback"
    }
  ],
  "generated_at": "2026-04-01T10:00:00Z"
}
```

**Rules:**

- snake_case is the canonical contract
- camelCase may still be read by AI service for backward compatibility
- new documentation, payload builders, and tests must use snake_case only

---

## 6. Extraction Rules for Confirmed EMR

Only extract EMR records that meet these conditions:

- Has final diagnosis or clear examination conclusion.
- Status is completed or confirmed by doctor.
- Not marked as cancelled, incorrect entry, or missing minimum data.
- If images exist, they must be accessible and directly related to the examination.
