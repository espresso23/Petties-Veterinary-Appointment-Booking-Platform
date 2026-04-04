# PETTIES Database Schema Analysis

**Version:** 2.2
**Last Updated:** 2026-04-03
**Status:** Canonical analysis synced with current codebase (migration 010 cleanup)

## 1. Architecture Summary

Petties uses a polyglot persistence model:

- **PostgreSQL** for transactional business data and AI governance/configuration
- **MongoDB** for flexible medical and chat documents
- **Qdrant** for vector retrieval and multimodal case memory

This document is the narrative companion to:

- [PETTIES_DBML.dbml](D:/SEP490/petties/docs-references/database/PETTIES_DBML.dbml)
- [PETTIES_ERD_DIAGRAM.md](D:/SEP490/petties/docs-references/documentation/PETTIES_ERD_DIAGRAM.md)

## 2. PostgreSQL Schema

### 2.1 Spring Boot backend

The Spring Boot service currently owns these PostgreSQL domains:

| Domain | Tables | Notes |
|---|---|---|
| Identity | `users`, `refresh_tokens`, `blacklisted_tokens` | Core account and auth state |
| Pet and clinic | `pets`, `clinics`, `clinic_images`, `clinic_price_per_km` | Clinic registration, geo, banking, strike restriction fields |
| Services | `master_services`, `clinic_services`, `service_weight_prices`, `vaccine_templates`, `vaccine_dose_prices` | Shared service catalog plus clinic-specific pricing |
| Scheduling | `staff_shifts`, `slots` | Shift-based slot generation |
| Booking | `bookings`, `booking_services`, `booking_slots`, `payments` | Appointment lifecycle and settlement linkage |
| Finance | `refund_applications`, `clinic_balances`, `withdrawals` | Revenue withdrawal flow |
| Governance | `reports`, `clinic_strike_config`, `user_strike_config` | Report moderation and restriction thresholds |
| Commercial | `subscription_plans`, `user_subscriptions`, `vouchers`, `clinic_vouchers` | Membership and discount programs |
| Operations | `notifications`, `chat_auto_reply_settings` | Operational notifications and clinic chat automation |

### 2.2 Key relational rules

- `users.working_clinic_id -> clinics.clinic_id` links staff and managers to their active clinic.
- `clinic_price_per_km` is effectively a 1:1 extension table for `clinics`.
- `booking_services` and `booking_slots` model the many-to-many parts of a booking.
- `payments` can be attached to either a booking or a subscription.
- `clinic_balances` is unique per clinic and represents the withdrawable balance snapshot.
- `reports` bridge bookings, reporters, and the reported clinic or user.
- `clinic_vouchers` is the clinic-scoped activation table for global vouchers.

### 2.3 AI service relational schema

The AI service PostgreSQL schema is now focused on runtime governance, not chat storage:

| Table | Role |
|---|---|
| `agents` | Single-agent runtime configuration |
| `tools` | Tool registry metadata and enablement |
| `knowledge_documents` | Knowledge base document metadata |
| `system_settings` | Runtime API keys and provider settings |
| `disease_catalog` | Canonical disease codes |
| `disease_aliases` | Approved aliases mapped to canonical disease codes |

### 2.4 Important AI schema decisions

- `prompt_versions` has been removed from the active schema (migration 005).
- The current single-agent design keeps the system prompt in code, while runtime tuning remains in `agents` and `system_settings`.
- `tools` are not assigned to agents by relational foreign keys (migration 006 removed `assigned_agents`).
- `disease_aliases.canonical_code -> disease_catalog.canonical_code` is the primary active AI foreign-key relationship in the migration-backed schema.
- Legacy `disease_mapping_review_items` has been removed from the active AI-diagnose schema and current DBML baseline (migration 008).
- `vision_disease_classes` was dropped as deadcode - no SQLAlchemy model or application code ever referenced it (migration 009).
- `knowledge_documents.image_count` was removed - PDF image extraction and hybrid query were never used in production (migration 010).

### 2.5 AI Service Migration History (Alembic)

| Version | Description | Status |
|---------|-------------|--------|
| 001 | Initial AI schema (agents, tools, prompt_versions, chat_sessions, chat_messages, knowledge_documents, system_settings) | Applied |
| 002 | vision_disease_classes table | **Dropped in 009** (unused) |
| 003 | Add image_count to knowledge_documents | Applied |
| 004 | Disease mapping catalog (disease_catalog, disease_aliases, disease_mapping_review_items) | Partial |
| 005 | Remove system_prompt column and prompt_versions table | Applied |
| 006 | Remove assigned_agents from tools table | Applied |
| 007 | Add WEB_SEARCH to settingcategory enum | Applied |
| 008 | Drop disease_mapping_review_items, remove body_system/protocol_key from disease_catalog, remove review_status from disease_aliases | Applied |
| 009 | Drop vision_disease_classes table (deadcode) | Applied |
| 010 | Drop image_count from knowledge_documents (unused PDF image indexing) | Applied |

## 3. MongoDB Schema

### 3.1 Spring Boot MongoDB

| Collection | Why MongoDB is used |
|---|---|
| `emr_records` | SOAP records contain nested prescriptions, images, and evolving clinical payloads |
| `vaccination_records` | Vaccination schedules and reminder-oriented payloads fit a document model |
| `chat_conversations` | Conversation headers are denormalized for chat UX |
| `chat_messages` | Messages can carry flexible content and action button payloads |

### 3.2 AI service MongoDB

| Collection | Why MongoDB is used |
|---|---|
| `ai_chat_sessions` | Session isolation metadata changes frequently and is read/write heavy |
| `ai_chat_messages` | ReAct traces, thought metadata, tool calls, and streamed content are document-shaped |
| `ai_proactive_notifications` | Log-style notification payloads are flexible and append-heavy |
| `chat_feedback` | Feedback payloads vary by moderation and analytics context |
| `knowledge_graph_triplets` | Triplet storage is graph-like and benefits from document-level indexing patterns |

### 3.3 MongoDB indexing expectations

The active AI MongoDB code creates indexes for:

- `ai_chat_sessions`: `session_id`, `user_id`, `context_type`, `updated_at`
- `ai_chat_messages`: `message_id`, `session_id`, `timestamp`, `user_id`, `tool_calls.tool_name`
- `ai_proactive_notifications`: `user_id`, `timestamp`, `read_status`
- `chat_feedback`: `message_id`, `user_id`, `timestamp`
- `knowledge_graph_triplets`: unique triplet index and traversal indexes

## 4. Qdrant Schema

### 4.1 Collections

| Collection | Purpose | Vector strategy |
|---|---|---|
| `petties_knowledge_base` | Text RAG for uploaded knowledge documents | single text vector (Cohere embed-multilingual-v3.0) |
| `petties_case_memory_v2` | Retrieval over confirmed EMR cases | named vectors: `text` (Cohere), `image` (Jina CLIP v2, 1024-dim) |

**Note:** `petties_kb_images` was previously used for extracting images from PDF knowledge documents but has been removed as an unused feature. Jina CLIP v2 image embeddings remain active for Case Memory only.

### 4.2 Why Qdrant is separate from PostgreSQL

- Similarity search is the core access pattern, not transactional joins.
- Metadata still references PostgreSQL or MongoDB records logically.
- Knowledge base and case memory retrieval can evolve independently of business schema migrations.

## 5. Current Documentation Contract

After this sync, the intended source-of-truth flow is:

1. migrations/models define the real schema
2. `PETTIES_DBML.dbml` defines the canonical PostgreSQL physical diagram
3. `PETTIES_ERD_DIAGRAM.md` defines the hybrid cross-store logical model
4. SRS and SDD summarize and reference those canonical artifacts

## 6. Known Boundary

`langgraph_checkpoints` may be created dynamically by the AI service checkpointer, but it is not currently part of the migration-backed canonical schema package. It should be documented as an operational runtime table only when that persistence mode is formally adopted.
