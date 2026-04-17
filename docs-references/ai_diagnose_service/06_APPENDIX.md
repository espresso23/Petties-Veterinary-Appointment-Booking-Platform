# Appendix: Configuration, Troubleshooting, Limitations, Changelog

> Last Updated: 2026-04-02
> Scope: Environment setup, common issues, known limitations, change history

---

## 1. Configuration

### 1.1 Environment Variables (AI Service)

| Variable | Description |
|----------|-------------|
| `QDRANT_URL` | Qdrant Cloud URL |
| `QDRANT_API_KEY` | Qdrant Cloud API key |
| `COHERE_API_KEY` | Cohere API key (can also be in DB) |
| `COHERE_EMBEDDING_MODEL` | Embedding model (default: embed-multilingual-v3.0) |
| `AI_INTERNAL_SYNC_KEY` | Legacy variable, not required for current push sync flow |
| `OPENROUTER_API_KEY` | Fallback OpenRouter key (DB preferred) |
| `JINA_API_KEY` | For KB image embeddings (stored in DB) |

### 1.2 Database Settings (system_settings table)

| Key | Description |
|-----|-------------|
| `COHERE_API_KEY` | Overrides env var |
| `OPENROUTER_API_KEY` | Gemini/OpenRouter key for vision |
| `COHERE_EMBEDDING_MODEL` | Embedding model name |
| `QDRANT_URL` | Qdrant collection URL |
| `QDRANT_API_KEY` | Qdrant API key |
| `JINA_API_KEY` | Image embedding API key |
| `JINA_IMAGE_EMBED_MODEL` | Image embed model (default: jina-clip-v2) |

---

## 2. Troubleshooting

### 2.1 "Chưa có mô tả từ AI" for images

**Cause:** `gemini_vision_adapter.py` was reading OpenRouter key from env var instead of DB.

**Fix:** Use `get_llm_client_from_db(db)` which reads from `system_settings` table.

### 2.2 CMYK image embeddings fail

**Cause:** Jina CLIP v2 does not support CMYK JPEG format from PDF extraction.

**Impact:** Low — KB images are stored but NOT used in diagnosis flow (decision 2026-03-20).

### 2.3 Case Memory shows 0 cases

**Check:**
1. Spring Boot is pushing confirmed EMR directly to `POST /api/v1/internal/case-memory/emr-sync`.
2. Database migrations have run: `alembic upgrade head`.
3. `AiCaseMemorySyncService` is called when EMR is saved with a final diagnosis.
4. If old cases were created before the runtime-only schema update, trigger Spring admin backfill: `POST /emr/admin/case-memory/resync?limit=...`.

### 2.4 Duplicate cases in Case Memory

**Cause:** Deduplication threshold too high or not working.

**Fix:** `upsert_case()` checks for similarity >= 0.95 before creating new case. If still duplicating, check that text embedding is consistent.

### 2.5 Prescription suggestions missing

**Cause:** No internal evidence (KB + Case Memory returned empty).

**Expected behavior:** Protocol service strips prescriptions and adds warning message.

---

## 3. Known Limitations

| # | Limitation | Impact |
|---|------------|--------|
| 1 | **Disease catalog coverage**: Only eye, ear, skin diseases are seeded. More body systems needed. | Medium - limits diagnosis scope |
| 2 | **Image limit**: Maximum 10 images per request (enforced by schema). | Low - sufficient for most cases |
| 3 | **Case Memory export limit**: Maximum 1000 cases per export (Qdrant scroll limitation). | Low - admin use only |
| 4 | **Protocol learning cold start**: Requires confirmed EMR cases to learn patterns. If autonomous canonicalization confidence is low, some cases still stay `provisional`. | Medium - improves over time |

> Autonomous canonicalization is now the intended active direction to reduce long-lived `provisional` cases without adding new PostgreSQL tables.

---

## 4. Changelog

| Date | Change |
|------|--------|
| 2026-03-17 | Architecture redesign: internal KB first, no web search for doctors |
| 2026-03-18 | Auto-sync confirmed EMR → Case Memory (Spring push) |
| 2026-03-19 | Dynamic Protocol v3: learning from EMR instead of hardcode |
| 2026-03-19 | Push sync: Spring directly pushes to AI service |
| 2026-03-20 | SOAP suggestions ready-to-apply (no meta text) |
| 2026-03-20 | Vision adapter reads OpenRouter key from DB |
| 2026-03-20 | Image crop feature (react-image-crop + base64) |
| 2026-03-20 | KB image search removed from diagnosis flow |
| 2026-03-20 | Case Memory UI Management (full CRUD + export) |
| 2026-03-22 | Feedback flow locked to analytics/monitoring only; delete feedback disabled for all roles |
| 2026-03-20 | Case Memory UI cleanup: remove score columns, rename feedback_count → "Lan xac nhan" |
| 2026-03-23 | Mobile AI Diagnosis complete: models, service, panel, sheet, EMR integration, tests |
| 2026-04-01 | **Documentation consolidation**: Merged 6 files into `ai_diagnose_service/` folder |
| 2026-04-01 | **Hardcode removal**: Removed all disease-specific if-else rules from DiagnosisProtocolService; now uses generic safety gating (weight, allergy) only |
| 2026-04-02 | **Runtime-only Case Memory schema**: removed non-runtime payload fields from active Case Memory contract and AIInsights projection |
| 2026-04-02 | **Backfill support**: added Spring admin endpoint to re-sync confirmed EMR records into the new Case Memory schema |
| 2026-04-02 | **Autonomous canonicalization**: active runtime now resolves unmatched disease labels using existing `disease_catalog` and `disease_aliases` only |
