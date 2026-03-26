# AI Service Audit Checklist — Petties Chatbot

**Version:** 1.0  
**Last Updated:** 2026-03-26  
**Owner:** AI Service / Web / Mobile teams  
**Scope:** `petties-agent-serivce`, AI chat presentation contract, Web/Mobile renderers, migration compatibility

---

## 1. Purpose

This document is the audit checklist for Petties AI Service based on the agreed 4-layer chat architecture:

- Layer 1: Agent Layer
- Layer 2: Tool Layer
- Layer 3: Presentation Layer
- Layer 4: Render Layer

It is written in a format usable by:

- an agent doing code / config / test audit automatically
- a developer or QA doing manual verification

This checklist is intended for audit and ship-readiness review, not only for feature QA.

---

## 2. How To Use

### 2.1 Status Legend

- `[ ]` = not checked yet
- `[x]` = passed
- `[!]` = issue found, must fix or explicitly accept risk
- `[n/a]` = not applicable for current phase/build

### 2.2 Audit Modes

| Mode | Use When | Expected Output |
|---|---|---|
| Auto Audit | Agent inspects code, config, logs, tests, contracts | Findings with file references and pass/fail per item |
| Manual Audit | Dev/QA validates runtime behavior, WebSocket, UI, reconnect, error states | Evidence, screenshots, logs, observed behavior |

### 2.3 Recommended File Targets

Use these files/modules as the primary audit surface:

- `petties-agent-serivce/app/core/agents/`
- `petties-agent-serivce/app/api/websocket/chat.py`
- `petties-agent-serivce/app/api/routes/`
- `petties-agent-serivce/app/core/tools/`
- `petties-agent-serivce/app/core/presentation/`
- `petties-web/src/components/chat/`
- `petties-web/src/pages/staff/StaffAIChatPage.tsx`
- `petties_mobile/lib/ui/chat/ai_chat/`
- `docs-references/development/ai-chat-rendering-architecture/PLAN.md`

### 2.4 Recommended Auto-Audit Commands

Use these commands as a baseline when running an automated audit:

```powershell
rg -n "IDLE|COLLECTING|PRESENTING|CONFIRMING|BOOKED" petties-agent-serivce/app
rg -n "max_iterations|iteration" petties-agent-serivce/app
rg -n "INTENT_MAP|show_error|show_empty|show_text" petties-agent-serivce/app
rg -n "ui_schema|ui_card|extract_ui_card" petties-agent-serivce/app petties-web petties_mobile
rg -n "recoverable|error_code|suggestion|success" petties-agent-serivce/app/core/tools
rg -n "select_item|select_services|confirm_booking|open_native_confirm|cancel_flow|load_more|open_detail|retry_with_change|dismiss" petties-web petties_mobile
rg -n "skeleton|loading|tool_call|tool_result|stage" petties-web petties_mobile
```

For runtime verification, use targeted tests or endpoint checks appropriate to the environment.

---

## 3. Phase Gating

| Migration Phase | Minimum Sections That Must Pass |
|---|---|
| Phase 1 | Layer 1 + Layer 2 |
| Phase 2 | Layer 1 + Layer 2 + Layer 3 |
| Phase 3 | All 4 layers |
| Phase 4 | All 4 layers + Migration Compliance |

---

## 4. Layer 1 — Agent Layer

### 4.1 Conversation State Machine

| ID | Check Item | Auto Audit | Manual Audit | Evidence | Status |
|---|---|---|---|---|---|
| AG-STATE-01 | State machine has exactly 5 stages: `IDLE`, `COLLECTING`, `PRESENTING`, `CONFIRMING`, `BOOKED` | Inspect `state.py`, agent state model, stage enum/constants | Run one booking flow and observe stage transitions | Code refs + logs | [ ] |
| AG-STATE-02 | Every transition is valid and no state is orphaned | Trace stage transition logic in agent + transport layer | Run forward, back, cancel, confirm flows | Transition table or logs | [ ] |
| AG-STATE-03 | State is persisted through LangGraph checkpointer, not only in memory | Verify checkpointer config and storage path | Restart/reconnect and confirm state remains | Checkpointer config + resumed session | [ ] |
| AG-STATE-04 | WebSocket reconnect resumes the correct stage via `session_id` | Inspect reconnect/session restore path | Disconnect/reconnect same session and verify stage restore | Session log + UI state | [ ] |
| AG-STATE-05 | Stage auto-expires back to `IDLE` after 30 minutes inactive | Verify TTL/expiration logic exists in code/config | Leave session idle and retest after TTL window | TTL config + observed reset | [ ] |
| AG-STATE-06 | `max_iterations` is set and bounded (recommended 5-7) | Inspect agent config and loop guard | Trigger difficult input and verify loop stops safely | Config + loop logs | [ ] |

### 4.2 System Prompt

| ID | Check Item | Auto Audit | Manual Audit | Evidence | Status |
|---|---|---|---|---|---|
| AG-PROMPT-01 | Prompt clearly declares when each tool should and should not be used | Inspect prompt builder / prompt config source | Ask flow-inappropriate questions and verify no wrong tool call | Prompt source + runtime trace | [ ] |
| AG-PROMPT-02 | Prompt injects correct `current_stage` and `collected_params` of current session | Inspect prompt assembly path | Run multi-turn booking and inspect debug trace | Prompt template + session trace | [ ] |
| AG-PROMPT-03 | Prompt defines hard boundaries: refusal / redirect behavior | Inspect system prompt and guardrails | Ask out-of-scope or unsafe request | Prompt source + response | [ ] |
| AG-PROMPT-04 | Prompt does not ask LLM to generate `ui_schema` or emit intent string | Search for `ui_schema` / intent instructions inside prompt text | Trigger structured UI flow and verify schema comes from backend code path | Prompt source + response trace | [ ] |

### 4.3 Agent Behavior

| ID | Check Item | Auto Audit | Manual Audit | Evidence | Status |
|---|---|---|---|---|---|
| AG-BEH-01 | LLM does not emit intent; intent is derived via `INTENT_MAP` | Inspect presentation layer and agent outputs | Trigger tools and verify deterministic intent mapping | Code refs + trace | [ ] |
| AG-BEH-02 | Agent calls tools in parallel when enough params are available | Inspect orchestration path for parallel execution or batching | Trigger a turn with multiple ready tool calls | Trace timing/logs | [ ] |
| AG-BEH-03 | Agent only asks for missing params and never re-asks known params | Inspect parameter collection logic | Complete a partial booking flow | Chat transcript | [ ] |
| AG-BEH-04 | Agent handles out-of-flow questions gracefully without crash or unwanted reset | Inspect fallback/out-of-flow handling | Ask unrelated question mid-booking | Chat transcript + stage log | [ ] |
| AG-BEH-05 | Agent does not guess ambiguous input (for example, duplicated clinic names) | Inspect ambiguity checks in tool/presentation flow | Create ambiguous clinic query and verify clarification | Chat transcript | [ ] |

---

## 5. Layer 2 — Tool Layer

### 5.1 Structured Error Contract

| ID | Check Item | Auto Audit | Manual Audit | Evidence | Status |
|---|---|---|---|---|---|
| TOOL-ERR-01 | Every tool catches internal exceptions and does not leak raw exceptions into the agent loop | Search tool modules for try/catch wrappers and shared contracts | Trigger backend/tool failure | Tool code + logs | [ ] |
| TOOL-ERR-02 | Every error response contains `success`, `error_code`, `message`, `recoverable` | Inspect tool contract helpers and representative tool returns | Force several known failures | Response payloads | [ ] |
| TOOL-ERR-03 | Error response has `suggestion` for user recovery guidance | Inspect tool error builders | Trigger recoverable errors | Response payloads | [ ] |
| TOOL-ERR-04 | `recoverable: true` keeps stage and allows retry | Inspect transport/stage handling | Trigger recoverable error then retry | Stage log + UI behavior | [ ] |
| TOOL-ERR-05 | `recoverable: false` resets flow to `IDLE` | Inspect error handling branch | Trigger unrecoverable error | Stage log + UI behavior | [ ] |
| TOOL-ERR-06 | All `error_code` values belong to a defined enum, not free-form strings | Search all tool returns and contract definitions | Review representative runtime responses | Enum definition + payloads | [ ] |

### 5.2 Error Code Coverage

| ID | Check Item | Auto Audit | Manual Audit | Evidence | Status |
|---|---|---|---|---|---|
| TOOL-CODE-01 | `NO_SLOTS_AVAILABLE` is defined and handled | Search contracts, builders, renderers | Trigger no-slot case | Code refs + UI | [ ] |
| TOOL-CODE-02 | `CLINIC_NOT_FOUND` is defined and handled | Search contracts, builders, renderers | Trigger invalid clinic | Code refs + UI | [ ] |
| TOOL-CODE-03 | `SERVICE_NOT_FOUND` is defined and handled | Search contracts, builders, renderers | Trigger invalid service | Code refs + UI | [ ] |
| TOOL-CODE-04 | `INVALID_DATE` is defined and handled | Search contracts, builders, renderers | Use invalid/past date | Code refs + UI | [ ] |
| TOOL-CODE-05 | `BOOKING_CONFLICT` is defined and handled | Search contracts, builders, renderers | Trigger booking conflict | Code refs + UI | [ ] |
| TOOL-CODE-06 | `PET_NOT_FOUND` is defined and handled | Search contracts, builders, renderers | Use invalid pet | Code refs + UI | [ ] |
| TOOL-CODE-07 | `UNAUTHORIZED` is defined and handled | Search contracts, builders, renderers | Use invalid role/token | Code refs + UI | [ ] |
| TOOL-CODE-08 | `RATE_LIMITED` is defined and includes retry hint | Search contracts, builders, renderers | Simulate rate limit | Code refs + UI | [ ] |
| TOOL-CODE-09 | `INTERNAL_ERROR` is handled with `recoverable: false` | Search contracts and generic error mapping | Trigger internal error path | Payload + stage reset | [ ] |

### 5.3 Retry and Circuit Breaker

| ID | Check Item | Auto Audit | Manual Audit | Evidence | Status |
|---|---|---|---|---|---|
| TOOL-RES-01 | Transient errors use exponential backoff retry up to 3 times | Inspect HTTP/backend clients and retry utilities | Simulate timeout or connection issue | Retry code + logs | [ ] |
| TOOL-RES-02 | Business logic errors are not retried automatically | Inspect retry guards | Trigger business validation failure | Logs | [ ] |
| TOOL-RES-03 | Circuit breaker opens after N consecutive failures and cools down for ~30s | Inspect circuit breaker implementation/config | Trigger repeated transient failures | Breaker logs + cooldown behavior | [ ] |
| TOOL-RES-04 | Tool descriptions clearly state prerequisites before invocation | Inspect tool descriptions / metadata | Review agent trace for misuse prevention | Tool metadata | [ ] |

### 5.4 Success Contract

| ID | Check Item | Auto Audit | Manual Audit | Evidence | Status |
|---|---|---|---|---|---|
| TOOL-OK-01 | Success response contains `success: true`, `data`, and `metadata` | Inspect tool success returns | Trigger normal tool flow | Payload | [ ] |
| TOOL-OK-02 | Empty result returns `success: true`, `data: []`, not error | Inspect empty-state returns | Trigger no-result case | Payload | [ ] |
| TOOL-OK-03 | Pagination response has `metadata.pagination.next_cursor` when `has_more: true` | Inspect pagination builder | Trigger list with `has_more` | Payload | [ ] |
| TOOL-OK-04 | Terminal results set `is_final: true` to stop unnecessary loop continuation | Inspect terminal tool returns and loop guards | Trigger final booking success | Payload + loop trace | [ ] |

---

## 6. Layer 3 — Presentation Layer

### 6.1 Intent Resolution

| ID | Check Item | Auto Audit | Manual Audit | Evidence | Status |
|---|---|---|---|---|---|
| PRE-INT-01 | `INTENT_MAP` covers all v1 tools plus fallback `show_text` | Inspect presentation module mapping | Trigger each tool once | Code refs + trace | [ ] |
| PRE-INT-02 | Tool not in map falls back to `show_text` without crash | Inspect fallback path | Simulate unknown tool output | Payload + UI | [ ] |
| PRE-INT-03 | Empty data resolves to `show_empty`, not `show_text` | Inspect empty detection logic | Trigger empty result | Payload + UI | [ ] |
| PRE-INT-04 | Error response resolves to `show_error` for every tool | Inspect error routing | Trigger errors from multiple tools | Payload + UI | [ ] |

### 6.2 Context-Aware Layout

| ID | Check Item | Auto Audit | Manual Audit | Evidence | Status |
|---|---|---|---|---|---|
| PRE-LAYOUT-01 | `show_clinic_list` with 1 result uses `card` layout | Inspect layout resolver | Trigger single clinic result | Schema payload | [ ] |
| PRE-LAYOUT-02 | `show_clinic_list` with 5+ results uses `grid` layout | Inspect layout resolver | Trigger many clinic results | Schema payload | [ ] |
| PRE-LAYOUT-03 | Multi-tool one-turn output becomes composite `list` layout with `text` headers | Inspect schema merge logic | Trigger one turn with multiple tool results | Schema payload | [ ] |
| PRE-LAYOUT-04 | Single tool uses its native layout | Inspect schema builder | Trigger single-tool responses | Schema payload | [ ] |

### 6.3 Empty and Error States

| ID | Check Item | Auto Audit | Manual Audit | Evidence | Status |
|---|---|---|---|---|---|
| PRE-STATE-01 | Every intent has an empty-state handler | Inspect schema builders | Trigger empty response for each major tool | Code refs + UI | [ ] |
| PRE-STATE-02 | Every `error_code` has a corresponding `error_card` builder | Inspect error builder coverage | Trigger representative error cases | Code refs + UI | [ ] |
| PRE-STATE-03 | Recoverable `error_card` has `retry_with_change` and `cancel_flow` | Inspect action builder | Trigger recoverable error | Schema payload | [ ] |
| PRE-STATE-04 | Non-recoverable `error_card` only has `dismiss` | Inspect action builder | Trigger unrecoverable error | Schema payload | [ ] |
| PRE-STATE-05 | `empty_state` contains `suggestion_action` | Inspect empty-state schema | Trigger empty result | Schema payload | [ ] |

### 6.4 Schema Integrity

| ID | Check Item | Auto Audit | Manual Audit | Evidence | Status |
|---|---|---|---|---|---|
| PRE-SCHEMA-01 | Every component with `actions` has non-empty `id` | Inspect schema builders and snapshots | Review runtime schemas | Schema payload | [ ] |
| PRE-SCHEMA-02 | `version: "1.0"` is present in every `ui_schema` | Search schema builders | Review runtime schemas | Schema payload | [ ] |
| PRE-SCHEMA-03 | Schema contains no fields outside spec | Compare builders against spec | Validate representative runtime payloads | Schema diff | [ ] |
| PRE-SCHEMA-04 | LLM cannot write `ui_schema` directly | Inspect prompt + transport + builder ownership | Trigger multiple flows and inspect output origin | Code refs + trace | [ ] |

---

## 7. Layer 4 — Render Layer

### 7.1 Action Whitelist

| ID | Check Item | Auto Audit | Manual Audit | Evidence | Status |
|---|---|---|---|---|---|
| RENDER-ACT-01 | Only the approved action types are accepted: `select_item`, `select_services`, `confirm_booking`, `open_native_confirm`, `cancel_flow`, `load_more`, `open_detail`, `retry_with_change`, `dismiss` | Search render/action handlers on Web and Mobile | Trigger each allowed action and one invalid action | Handler code + runtime behavior | [ ] |
| RENDER-ACT-02 | Client rejects unknown action types and does not silently ignore them | Inspect dispatcher guard path | Inject invalid action | UI/log behavior | [ ] |
| RENDER-ACT-03 | Web and Mobile implement the approved action types consistently, except where the current mobile cutover intentionally routes booking confirmation to native confirm flow | Compare both clients | Trigger same schema on both platforms | Side-by-side behavior | [ ] |

### 7.2 Action Payload Compliance

| ID | Check Item | Auto Audit | Manual Audit | Evidence | Status |
|---|---|---|---|---|---|
| RENDER-PAYLOAD-01 | `select_item` payload contains `item_id` and `item_type` | Inspect client emitters and schema | Trigger selection flow | Sent payload | [ ] |
| RENDER-PAYLOAD-02 | `select_services` payload contains `group_id`, `clinic_id`, and selected `service_ids` | Inspect client emitters and schema | Complete grouped service selection | Sent payload | [ ] |
| RENDER-PAYLOAD-03 | `open_native_confirm` payload contains the fields needed to hydrate the normal booking confirmation screen | Inspect action emitters and schema | Trigger booking summary handoff | Sent payload | [ ] |
| RENDER-PAYLOAD-04 | `confirm_booking` is not emitted by new mobile AI booking summary flows; final confirmation is handled on the native booking confirm screen | Inspect mobile renderer and schema | Trigger booking summary on mobile | Schema payload + UI behavior | [ ] |
| RENDER-PAYLOAD-05 | `load_more` uses `cursor`, not `offset` or `page` | Inspect pagination handling | Trigger load-more flow | Sent payload | [ ] |
| RENDER-PAYLOAD-06 | `open_detail` payload contains `route` and `id` | Inspect action emitters | Trigger detail action | Sent payload | [ ] |
| RENDER-PAYLOAD-07 | `cancel_flow` and `dismiss` send no payload | Inspect action emitters | Trigger both actions | Sent payload | [ ] |

### 7.3 Fallback Cascade

| ID | Check Item | Auto Audit | Manual Audit | Evidence | Status |
|---|---|---|---|---|---|
| RENDER-FALLBACK-01 | Client attempts `ui_schema` first | Inspect renderer resolution order | Trigger valid schema | Renderer behavior | [ ] |
| RENDER-FALLBACK-02 | On current mobile AI chat, invalid or missing `ui_schema` falls back to persisted session state if available, then to plain `message` | Inspect mobile renderer resolution order | Trigger reconnect and invalid schema cases | Renderer behavior | [ ] |
| RENDER-FALLBACK-03 | On current web/staff surfaces, missing `ui_schema` falls back safely according to the active renderer contract | Inspect renderer resolution order | Trigger plain text case | Renderer behavior | [ ] |
| RENDER-FALLBACK-04 | If all structured payloads are missing, `data` is formatted as text or omitted safely without blank UI | Inspect last-resort fallback | Trigger raw-data only case | Renderer behavior | [ ] |
| RENDER-FALLBACK-05 | User never sees a blank bubble | Inspect all fallback exits | Trigger schema failure path | Screenshot/video | [ ] |
| RENDER-FALLBACK-06 | Mobile reconnect restores the last stable interactive booking state for the same `session_id` | Inspect persisted state + history restore path | Disconnect/reconnect mid-booking | Screenshot/video + session state | [ ] |

### 7.4 Streaming

| ID | Check Item | Auto Audit | Manual Audit | Evidence | Status |
|---|---|---|---|---|---|
| RENDER-STREAM-01 | Skeleton placeholder appears when tool call starts | Inspect streaming/loading hooks | Trigger slow tool | UI capture | [ ] |
| RENDER-STREAM-02 | Skeleton swaps to actual component when `ui_schema` arrives | Inspect render update flow | Trigger slow tool then success | UI capture | [ ] |
| RENDER-STREAM-03 | If schema build fails, fallback cascade activates and skeleton does not remain forever | Inspect failure branch | Trigger schema failure | UI capture + logs | [ ] |
| RENDER-STREAM-04 | Skeleton includes tool hint such as `Đang tìm phòng khám...` | Inspect loading text mapping | Trigger several tool calls | UI capture | [ ] |

---

## 8. Cross-Cutting Concerns

### 8.1 Observability

| ID | Check Item | Auto Audit | Manual Audit | Evidence | Status |
|---|---|---|---|---|---|
| OBS-01 | Every tool call logs `tool_name`, `input_args`, `result`, `duration_ms` | Inspect logging points | Trigger tools and inspect logs | Log lines | [ ] |
| OBS-02 | Every error logs `error_code`, `session_id`, `stage` | Inspect error logging path | Trigger representative failures | Log lines | [ ] |
| OBS-03 | Intent resolution logs `tool_name -> intent -> layout` | Inspect presentation logging | Trigger structured response | Log lines | [ ] |
| OBS-04 | Agent loop iteration count is logged and warns near `max_iterations` | Inspect loop logging | Trigger long reasoning path | Log lines | [ ] |

### 8.2 Security

| ID | Check Item | Auto Audit | Manual Audit | Evidence | Status |
|---|---|---|---|---|---|
| SEC-01 | Tool error messages do not expose internal stack traces | Inspect error sanitization | Trigger internal failure | UI payload + logs | [ ] |
| SEC-02 | `UNAUTHORIZED` does not leak whether the resource exists | Inspect authorization error mapping | Trigger unauthorized access to existing/nonexisting resource | Response comparison | [ ] |
| SEC-03 | `session_id` is not predictable | Inspect session generation | Create multiple sessions and compare format | Code refs + IDs | [ ] |
| SEC-04 | Client action payloads are validated before agent handling | Inspect action ingestion path | Send malformed action payload | Validation error | [ ] |

### 8.3 Adversarial Input

| ID | Check Item | Auto Audit | Manual Audit | Evidence | Status |
|---|---|---|---|---|---|
| ADV-01 | Agent survives out-of-flow question mid-booking | Inspect fallback logic | Ask unrelated question mid-flow | Transcript | [ ] |
| ADV-02 | Agent handles dates in the past safely | Inspect validation path | Send past date | Transcript + error state | [ ] |
| ADV-03 | Agent handles empty input or emoji-only input safely | Inspect empty-input handling | Send empty/emoji message | Transcript | [ ] |
| ADV-04 | Agent handles repeated cancel / restart without corrupting state | Inspect reset logic | Cancel then start again repeatedly | Stage logs | [ ] |
| ADV-05 | Agent handles repeated rate-limit errors safely | Inspect retry/breaker behavior | Simulate repeated rate limit | Logs + UI | [ ] |

### 8.4 Migration Compliance

| ID | Check Item | Auto Audit | Manual Audit | Evidence | Status |
|---|---|---|---|---|---|
| MIG-01 | Backend emits `ui_schema` as the primary structured contract for AI chat | Inspect transport payload builder | Trigger structured tool response | Payload snapshot | [ ] |
| MIG-02 | Mobile AI chat no longer depends on legacy `ui_card` payloads | Search mobile renderer and models | Review current branch phase | Code refs | [ ] |
| MIG-03 | Booking summary on mobile uses `open_native_confirm` handoff instead of direct in-chat `confirm_booking` | Inspect payload emitters and mobile dispatcher | Trigger booking summary flow | Payload snapshot + UI behavior | [ ] |
| MIG-04 | Reconnect-safe local state persistence exists for current mobile AI booking flow | Inspect storage/persistence path | Disconnect/reconnect mid-flow | Code refs + UI behavior | [ ] |

---

## 9. Audit Run Output Template

Use this output format for either agent audit or manual review:

```text
Audit Date:
Environment:
Branch / Commit:
Scope:

Section:
Check ID:
Result: [x] / [!] / [ ] / [n/a]
Evidence:
Files:
Notes:
Action Required:
```

---

## 10. Manual Sign-Off

| Role | Name | Date | Result | Notes |
|---|---|---|---|---|
| AI Service Dev | | | | |
| Web Dev | | | | |
| Mobile Dev | | | | |
| QA | | | | |
| Tech Lead | | | | |

---

## 11. Related Documents

- [AI Service QA Checklist](./AI_SERVICE_QA_CHECKLIST.md)
- [AI Chat Architecture Stabilization Checklist](./AI_CHAT_ARCHITECTURE_STABILIZATION_CHECKLIST.md)
- [AI Chat Dynamic Components Plan](../development/ai-chat-rendering-architecture/PLAN.md)
- [AI Assistant Full Test Guide](./testing/AI_ASSISTANT_FULL_TEST_GUIDE.md)
- [AI Diagnosis E2E Guide](./AI_DIAGNOSIS_E2E_GUIDE.md)
