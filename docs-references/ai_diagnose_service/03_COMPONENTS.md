# Components

> Last Updated: 2026-04-02
> Scope: All backend, web, and mobile components involved in AI diagnosis

---

## 1. Backend (AI Service)

### 1.1 StaffDiagnosisService

**File:** `petties-agent-serivce/app/ai_diagnose/staff_diagnosis_service.py`

Orchestrates the full diagnosis pipeline:

```
analyze_case(request)
  1. Resolve trusted booking/pet context
  2. Analyze images via Gemini Vision (if image_urls provided)
  3. Build retrieval query from request + vision findings
  4. Query Hybrid RAG (KB + KG)
  5. Query Case Memory (confirmed EMR cases)
  6. Build top differentials (merge from vision, RAG, case memory)
  7. Resolve selected diagnosis (if provided)
  8. Build protocol decision (safety gating: weight, allergy)
  9. Apply EMR patterns (learned prescriptions from similar cases)
  10. Build section-level SOAP grounding bundle (request facts + KB + Case Memory + protocol)
  11. LLM synthesis (grounded differentials, SOAP, prescriptions)
  12. Merge safety suggestions (protocol + LLM)
  13. Build SOAP suggestions / grounded fallback
  14. Return synthesis response
```

Key methods:

| Method | Purpose |
|--------|---------|
| `analyze_case()` | Main orchestrator |
| `_analyze_vision()` | Call Gemini Vision for image analysis |
| `_retrieve_internal_context()` | Query KB, KG, Case Memory |
| `_build_top_differentials()` | Merge candidates from all sources |
| `_resolve_selected_diagnosis()` | Safely resolve doctor-selected diagnosis |
| `_build_soap_grounding_bundle()` | Build section-level evidence bundle for S/O/A/P |
| `_synthesize_with_llm()` | LLM synthesis with grounded context |
| `_merge_safety_suggestions()` | Combine protocol + LLM safety |
| `_build_soap_suggestions()` | Generate ready-to-apply SOAP drafts |
| `_extract_protocol_patterns_from_cases()` | Learn patterns from EMR cases |

### 1.2 DiagnosisProtocolService

**File:** `petties-agent-serivce/app/ai_diagnose/diagnosis_protocol_service.py`

Builds safety decisions aligned with the primary diagnosis:

- **Safety gating (generic)**: Checks weight (required for mg/kg drugs), allergies
- **No hardcoded rules**: Removed all disease-specific if-else logic (2026-04-01)
- **EMR pattern learning**: `apply_emr_patterns()` merges prescriptions learned from confirmed EMR cases
- **Plan grounding**: propagates learned tests and recurring recommendations from confirmed EMR into treatment planning
- **Weight-based dosage adjustment**: `_adjust_dosage_for_weight()` scales `mg/kg` drugs
- **Prescription deduplication**: Removes duplicate medications by name

Key methods:

| Method | Purpose |
|--------|---------|
| `build_decision()` | Entry point: builds ProtocolDecision for a diagnosis |
| `_build_safety_decision()` | Generic safety checks (weight, allergy) |
| `_build_allergy_cautions()` | Extracts allergy warnings from request |
| `apply_emr_patterns()` | Merges EMR-learned prescriptions into decision |
| `_adjust_dosage_for_weight()` | Scales mg/kg dosage for patient weight |
| `_deduplicate_prescriptions()` | Removes duplicate medications |

### 1.3 GeminiVisionAdapter

**File:** `petties-agent-serivce/app/core/vision/gemini_vision_adapter.py`

Analyzes clinical images using Gemini via OpenRouter:

- **API key source:** `get_llm_client_from_db(db)` reads from `system_settings` table
- **Image format:** Accepts `https://` URLs or base64 `data:image/...;base64,` URLs. Skips `blob:` URLs.
- **Max images:** 10 per request
- **Output:** visual_findings, image_descriptions, top_conditions (mapped to canonical codes)

### 1.4 HybridRAGEngine

**File:** `petties-agent-serivce/app/core/rag/hybrid_engine.py`

Hybrid search combining:

- **Text RAG**: Cohere embed + Qdrant vector search from KB documents
- **Deduplication**: RAG query deduplication at the retrieval level

```python
await hybrid_engine.query(
    query="...",
    top_k=5,
    min_score=0.45,
    pet_type="dog",
    enable_rag=True,
    enable_case_memory=False  # case memory is queried separately
)
```

### 1.5 CaseMemoryService

**File:** `petties-agent-serivce/app/core/rag/case_memory.py`

Manages Qdrant collection `petties_case_memory_v2`:

| Method | Purpose |
|--------|---------|
| `initialize()` | Init Qdrant client + Cohere embed model from DB settings |
| `upsert_case()` | Embed and store EMR confirmed case with deduplication |
| `search_similar()` | Hybrid search (text + image), re-rank by feedback score |
| `delete_case()` | Remove case from Qdrant |
| `list_cases()` | List cases with pagination and filters |
| `get_case()` | Get case detail by case_id |
| `get_stats()` | Collection statistics |

**Scoring formula:**
```
final_score = cosine_similarity
```

### 1.6 DiseaseMappingService

**File:** `petties-agent-serivce/app/core/services/disease_mapping_service.py`

Maps raw disease labels to canonical codes from `disease_catalog` (PostgreSQL):

- Loads catalog + aliases from DB on startup
- TTL-based cache refresh (5 minutes)
- Keeps a bootstrap in-memory fallback snapshot for local/dev safety
- Supports autonomous canonicalization using only `disease_catalog` + `disease_aliases`
- Automatically persists learned aliases and can create new canonical diseases when confidence is high enough

### 1.7 ContextService

**File:** `petties-agent-serivce/app/ai_diagnose/context_service.py`

Hydrates trusted booking/pet context from Spring Boot backend before diagnosis synthesis.

---

## 2. Frontend (petties-web)

### 2.1 AIDiagnosisPanel

**File:** `petties-web/src/components/emr/AIDiagnosisPanel.tsx`

Located in `CreateEmrPage`, adjacent to SOAP form:

**Input fields:**
- Clinical description (`doctor_description`)
- Body part selection (`body_part`)
- Image upload with crop capability
- Allergy indicators

**Actions:**
- `Phân tích` button → calls `POST /api/v1/staff-diagnosis/analyze`
- Apply individual SOAP suggestions to form fields
- Add individual prescriptions to the EMR prescription list
- Image crop via `ImageCropModal`

**Display:**
- Differential diagnoses with evidence sources
- Similar confirmed cases from Case Memory
- Vision image analysis (per-image descriptions)
- SOAP suggestions ready-to-apply
- Prescription suggestions with dosage, frequency, duration
- Follow-up questions
- Disclaimer

**Image flow:**
1. Staff uploads images → `pendingImagePreviews` (blob URLs)
2. Optional: crop images via `ImageCropModal` → base64 data URLs added to list
3. All URLs (blob + base64) sent to backend
4. Backend skips `blob:` URLs; expects `https://` or `data:image/...;base64,`
5. Response includes `image_analysis` array mapping URL → description

### 2.2 ImageCropModal

**File:** `petties-web/src/components/emr/ImageCropModal.tsx`

Uses `react-image-crop` library:

- Staff selects crop region on image
- Canvas extracts cropped region as base64 PNG
- Cropped image added to `croppedImageUrls` array
- Merged with original `pendingImageUrls` before sending to AI

### 2.3 AIInsightsPage

**File:** `petties-web/src/pages/admin/insights/AIInsightsPage.tsx`

Case Memory management UI:

- List runtime-facing cases with pagination and filters
- View only the fields actually used by AI diagnose runtime
- Inspect runtime protocol pattern (`assessment`, common prescriptions, common tests, recommendations)
- Delete cases with confirm modal

---

## 3. Mobile (petties_mobile)

### 3.1 Diagnosis Models

**File:** `petties_mobile/lib/data/models/diagnosis.dart`

| Model | Description |
|-------|-------------|
| `DiagnosisSpecies` | Enum: `dog`, `cat`, `other` |
| `DiagnosisSex` | Enum: `male`, `female`, `unknown` |
| `StaffDiagnosisRequest` | Request payload with pet info, clinical narrative, images |
| `StaffDiagnosisResponse` | AI response with differentials, vision findings, prescriptions |
| `SoapSuggestions` | SOAP draft suggestions from AI |
| `StaffDiagnosisPrescriptionSuggestion` | Prescription draft with medicine, dosage, frequency |

### 3.2 Diagnosis Service

**File:** `petties_mobile/lib/data/services/diagnosis_service.dart`

| Method | Description |
|--------|-------------|
| `analyzeCase()` | Calls `POST /api/v1/staff-diagnosis/analyze` |

### 3.3 AI Diagnosis Panel

**File:** `petties_mobile/lib/ui/staff/widgets/ai_diagnosis_panel.dart`

| Feature | Description |
|---------|-------------|
| Clinical narrative input | Multi-line TextField for doctor description |
| Image picker | Add clinical images (max 1024px, base64) |
| Analyze button | Triggers AI analysis |
| Results display | Shows differentials, vision findings, prescriptions |
| Apply to EMR | Button to apply SOAP suggestions to EMR form |

### 3.4 AI Diagnosis Sheet

**File:** `petties_mobile/lib/ui/staff/widgets/ai_diagnosis_sheet.dart`

Bottom sheet wrapper for `AiDiagnosisPanel` - used for mobile UX.

### 3.5 Integration Points

| Screen | Integration |
|--------|-------------|
| `CreateEmrScreen` | AppBar icon → opens `AiDiagnosisSheet` |
| `EditEmrScreen` | AppBar icon → opens `AiDiagnosisSheet` |
| `StaffAiChatScreen` | Chat with AI, can trigger diagnosis |

---

## 4. Backend (Spring Boot)

### 4.1 EmrService

**File:** `backend-spring/petties/src/main/java/com/petties/petties/service/EmrService.java`

- Saves EMR records
- Triggers `syncConfirmedCase()` when EMR is saved with final diagnosis

### 4.2 AiCaseMemorySyncService

**File:** `backend-spring/petties/src/main/java/com/petties/petties/service/AiCaseMemorySyncService.java`

- Pushes confirmed EMR to AI service via `POST /api/v1/internal/case-memory/emr-sync`
- Builds `InternalConfirmedEmrItemDto` with full EMR context

---

## 5. File Index

### Backend (AI Service)

```
petties-agent-serivce/app/
├── api/routes/
│   ├── staff_diagnosis.py           # POST /staff-diagnosis/analyze
│   ├── knowledge.py                  # Case Memory management endpoints
│   └── internal_case_memory.py       # Spring → AI sync endpoint
├── ai_diagnose/
│   ├── routes.py                     # API route handlers
│   ├── schemas.py                    # Request/Response schemas
│   ├── context_service.py            # Booking/pet context hydration
│   ├── staff_diagnosis_service.py    # Main orchestration
│   └── diagnosis_protocol_service.py # Safety gating + EMR pattern learning
├── core/
│   ├── services/
│   │   ├── disease_mapping_service.py    # Label → canonical code
│   │   └── emr_case_memory_sync_service.py # Extract protocol from EMR
│   ├── vision/
│   │   └── gemini_vision_adapter.py      # Gemini Vision image analysis
│   └── rag/
│       ├── hybrid_engine.py              # KB + KG hybrid search
│       └── case_memory.py                # Qdrant Case Memory management
└── services/
    └── llm_client.py                     # OpenRouter client + DB-based config
```

### Frontend (petties-web)

```
petties-web/src/
├── pages/admin/insights/
│   └── AIInsightsPage.tsx               # Case Memory Management UI
├── components/emr/
│   ├── AIDiagnosisPanel.tsx             # Main diagnosis panel in EMR
│   └── ImageCropModal.tsx               # Image crop modal
├── utils/
│   └── emrAiDiagnosisContext.ts         # AI context payload builder
└── services/
    └── agentService.ts                  # API client (caseMemoryApi, diagnosisApi)
```

### Backend (Spring Boot)

```
backend-spring/petties/src/main/java/com/petties/petties/
└── service/
    ├── AiCaseMemorySyncService.java     # Push EMR confirmed → AI service
    └── EmrService.java                  # Triggers sync on EMR save
```

### Mobile (petties_mobile)

```
petties_mobile/lib/
├── data/
│   ├── models/
│   │   └── diagnosis.dart               # Diagnosis models
│   └── services/
│       └── diagnosis_service.dart       # POST /v1/staff-diagnosis/analyze
└── ui/staff/
    ├── widgets/
    │   ├── ai_diagnosis_panel.dart       # Main diagnosis panel widget
    │   └── ai_diagnosis_sheet.dart       # Bottom sheet wrapper
    └── emr/
        ├── create_emr_screen.dart        # Integration: AppBar AI button
        └── edit_emr_screen.dart          # Integration: AppBar AI button
```

### Mobile Tests

```
petties_mobile/test/
├── data/
│   ├── models/
│   │   └── diagnosis_model_test.dart    # 16 unit tests
│   └── services/
│       └── diagnosis_service_test.dart  # 11 unit tests
└── ui/staff/
    └── ai_diagnosis_panel_test.dart     # 10 widget tests
```
