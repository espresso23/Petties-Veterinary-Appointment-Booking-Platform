# AI Evaluation Metrics Framework - Petties Chatbot

**Version:** 1.0  
**Last Updated:** 2026-03-26  
**Owner:** AI Service, Web, Mobile, QA  
**Scope:** `petties-agent-serivce`, `petties-web`, `petties_mobile`, AI chat/diagnosis/booking assistant flows

---

## 1. Purpose

This document defines the evaluation framework for Petties AI assistants, with focus on:

- booking assistant for Pet Owner
- internal AI chat for Staff
- staff diagnosis assistant
- presentation and renderer reliability across Web and Mobile

The goal is to measure AI quality across three independent dimensions:

1. reasoning quality before action
2. tool-calling correctness during execution
3. end-to-end task success and user experience

This document complements, but does not replace:

- `AI_SERVICE_AUDIT_CHECKLIST.md`
- `AI_SERVICE_QA_CHECKLIST.md`
- `AI_SERVICE_TECHNICAL_SPECIFICATION.md`
- `testing/AI_ASSISTANT_FULL_TEST_GUIDE.md`

---

## 2. Evaluation Model

### 2.1 Three Metric Groups

| Group | Measures | Primary Usage |
|---|---|---|
| Reasoning Metrics | Whether the LLM plans correctly | Offline eval, pre-deploy, CI |
| Action Metrics | Whether tool selection and arguments are correct | Offline eval, CI, sampled production traces |
| End-to-End Metrics | Whether users actually achieve their goals | Production monitoring, UAT, release readiness |

### 2.2 Four Architecture Layers

For Petties, metrics should also be read through the system architecture:

| Layer | Main Runtime Surface | Example Responsibilities |
|---|---|---|
| Layer 1 - Agent | LangGraph agent, state machine, prompt assembly | planning, context retention, stage transition |
| Layer 2 - Tool | FastMCP tools, backend integrations, contracts | tool choice, argument quality, error handling |
| Layer 3 - Presentation | intent resolution, `ui_schema`, fallback building | structured output, empty/error states |
| Layer 4 - Render | Web/Mobile client renderers and `ui_action` handling | visible UX, action execution, fallback cascade |

One metric may support more than one layer. For example, `Fallback Rate` is mainly a Layer 3 and 4 metric, while `Task Completion Rate` is a business-level outcome influenced by all layers.

---

## 3. Petties Evaluation Scope

### 3.1 Runtime Surfaces

| Surface | Role | Platform | Status in Evaluation |
|---|---|---|---|
| Booking assistant | `PET_OWNER` | Mobile | Primary |
| Staff AI chat | `STAFF` | Web + Mobile | Primary |
| Staff diagnosis assistant | `STAFF`, `ADMIN` | Web + Mobile | Primary |
| Admin or debug chat surfaces | Internal roles | Web | Regression only |

### 3.2 Primary Success Journeys

Metrics should cover these minimum journeys:

1. General pet-care Q&A
2. Personalized pet profile retrieval
3. Clinic discovery
4. Service retrieval
5. Slot retrieval
6. Booking preview
7. Booking confirmation
8. Booking error recovery
9. Staff diagnosis image preview
10. Staff diagnosis full analyze
11. Structured UI rendering with `ui_schema`
12. Action handling with `ui_action`

---

## 4. Metric Catalog

## 4.1 Reasoning Metrics

### 4.1.1 Plan Quality

**Definition:** Measures whether the LLM chooses the correct tool sequence and sufficient steps for a given task.

**Question answered:** Did the model plan the right flow?

**Examples for Petties:**

- Booking flow should prefer `get_user_pets -> search_clinics_nearby -> get_clinic_services -> check_available_slots -> create_booking_for_user`
- Diagnosis preview should use `describe_only`, not full diagnosis flow

**Scoring rule:**

```text
Plan Quality = correct plans / total evaluated scenarios
```

**Suggested target:** `>= 85%`

**Primary layer:** Layer 1  
**Recommended runtime:** offline eval, CI  
**Primary data source:** golden conversation set, trace replay, prompt/tool-call inspection

### 4.1.2 Plan Adherence

**Definition:** Measures whether execution follows the plan that was effectively required by the task.

**Question answered:** Even if the agent understood the task, did it actually execute consistently?

**Scoring rule:**

```text
Plan Adherence = conversations where execution follows valid intended plan / total evaluated conversations
```

**Suggested target:** `>= 90%`

**Primary layer:** Layer 1 + 2  
**Recommended runtime:** offline eval, CI, sampled production traces  
**Primary data source:** ordered tool-call traces

### 4.1.3 Knowledge Retention

**Definition:** Measures whether the assistant remembers previously collected facts without re-asking unnecessarily.

**Question answered:** Does the assistant keep conversation memory correctly?

**Petties examples:**

- remember selected `pet_id`
- remember chosen clinic after service listing
- preserve diagnosis draft context across panel actions

**Scoring rule:**

```text
Knowledge Retention = sessions where previously known facts are reused correctly / total evaluated sessions
```

**Suggested target:** `>= 90%`

**Primary layer:** Layer 1  
**Recommended runtime:** offline eval, nightly regression  
**Primary data source:** multi-turn transcripts, state snapshots, session traces

### 4.1.4 Role Adherence

**Definition:** Measures whether the assistant stays inside its allowed role and capability boundary.

**Question answered:** Does the assistant behave like the correct Petties assistant for the active surface?

**Examples:**

- Pet Owner flow should not invent staff-only diagnosis output
- Staff diagnosis should not use public web search for clinical advice
- Booking assistant should not fabricate structured UI from model text

**Suggested target:** `>= 95%`

**Primary layer:** Layer 1  
**Recommended runtime:** offline eval, nightly regression  
**Primary data source:** policy test set, refusal/regression cases

---

## 4.2 Action Metrics

### 4.2.1 Tool Selection Accuracy

**Definition:** Measures whether the agent chooses the correct tool for each scenario.

**Scoring rule:**

```text
Tool Selection Accuracy = correct tool selections / total tool-selection opportunities
```

**Suggested target:** `>= 90%`

**Primary layer:** Layer 2  
**Recommended runtime:** offline eval, CI, sampled production traces  
**Primary data source:** tool traces from `chat.py`, booking tools, diagnosis route/service logs

### 4.2.2 Argument Correctness

**Definition:** Measures whether the arguments passed to a tool are semantically correct and sufficiently normalized.

**Examples:**

- `clinic_id`, `service_id`, `pet_id`, `date` are complete and valid
- `image_analysis_mode` is `describe_only` for image preview and `full` for full analysis

**Scoring rule:**

```text
Argument Correctness = tool calls with valid arguments / total evaluated tool calls
```

**Suggested target:** `>= 88%`

**Primary layer:** Layer 2  
**Recommended runtime:** offline eval, CI, sampled production traces  
**Primary data source:** tool-call arguments, validation errors, request payload logs

### 4.2.3 Tool Correctness

**Definition:** Combined score where both tool choice and arguments must be correct.

**Scoring rule:**

```text
Tool Correctness = tool calls with correct tool AND correct arguments / total evaluated tool calls
```

**Suggested target:** `>= 85%`

**Primary layer:** Layer 2  
**Recommended runtime:** CI, nightly regression, production dashboard  
**Primary data source:** merged traces from tool selection + argument validation

### 4.2.4 Path Validity

**Definition:** Measures whether the tool path is valid, non-redundant, and free from avoidable loops.

**Invalid examples in Petties:**

- calling `search_clinics_nearby` twice with the same arguments in one turn
- calling `get_user_pets` after `pet_id` is already confirmed
- calling full diagnosis during image preview

**Scoring rule:**

```text
Invalid Path Rate = invalid paths / total evaluated sessions
```

**Suggested target:** `< 5% invalid paths`

**Primary layer:** Layer 1 + 2  
**Recommended runtime:** offline eval, sampled production traces  
**Primary data source:** ordered tool-call sequences per session

### 4.2.5 Tool Error Rate

**Definition:** Measures the rate of failed tool calls and must be broken down by `error_code`.

**Scoring rule:**

```text
Tool Error Rate(error_code=X) = failed tool calls with X / total tool calls
```

**Petties-specific interpretation:**

- `NO_SLOTS_AVAILABLE` may be normal business behavior
- `INVALID_DATE` often indicates argument normalization weakness
- `UNAUTHORIZED` may indicate auth forwarding or scope issues
- `INTERNAL_ERROR` must be alertable

**Suggested targets:**

- `INTERNAL_ERROR < 1%`
- all other thresholds depend on feature and environment baseline

**Primary layer:** Layer 2  
**Recommended runtime:** production continuous monitoring  
**Primary data source:** structured tool result/error contract, backend logs

---

## 4.3 Conversation and State Metrics

### 4.3.1 Conversation Relevancy

**Definition:** Measures whether each response is relevant to the current user context and active task.

**Scoring rule:**

```text
Conversation Relevancy = relevant turns / total evaluated turns
```

**Suggested target:** `>= 90%`

**Primary layer:** Layer 1 + 3  
**Recommended runtime:** offline eval, nightly regression  
**Primary data source:** judged transcripts

### 4.3.2 Conversation Completeness

**Definition:** Measures whether the assistant fulfills all user intents expressed in a conversation.

**Scoring rule:**

```text
Conversation Completeness = conversations with all major intents fulfilled / total evaluated conversations
```

**Suggested target:** `>= 80%`

**Primary layer:** Layer 1 + 3  
**Recommended runtime:** offline eval, UAT, nightly regression  
**Primary data source:** multi-intent test set, transcript review

### 4.3.3 State Transition Accuracy

**Definition:** Measures whether the booking assistant state machine transitions correctly between stages.

**Relevant stages:**

- `IDLE`
- `COLLECTING`
- `PRESENTING`
- `CONFIRMING`
- `BOOKED`

**Scoring rule:**

```text
State Transition Accuracy = correct transitions / total expected transitions
```

**Suggested target:** `>= 95%`

**Primary layer:** Layer 1  
**Recommended runtime:** CI, nightly regression, sampled production traces  
**Primary data source:** state logs, WebSocket events, session persistence traces

---

## 4.4 End-to-End and Business Metrics

### 4.4.1 Task Completion Rate

**Definition:** Measures the proportion of sessions that reach the intended terminal outcome.

**Booking formula:**

```text
Task Completion Rate = sessions reaching BOOKED / sessions with booking intent
```

**Diagnosis variant:**

```text
Diagnosis Completion Rate = sessions producing valid final diagnosis output / sessions with diagnosis intent
```

**Suggested target:** `>= 70%` after excluding user-initiated cancellations

**Primary layer:** All layers  
**Recommended runtime:** production daily dashboard, UAT  
**Primary data source:** stage transitions, final structured outputs, booking created events

### 4.4.2 Turns to Completion

**Definition:** Measures the average number of turns needed to complete a task.

**Suggested Petties benchmarks:**

| Scenario | Recommended Target |
|---|---|
| User provides enough parameters upfront | `<= 3 turns` |
| Standard guided booking flow | `<= 8 turns` |
| Flow with one retry or recoverable error | `<= 11 turns` |

**Primary layer:** All layers  
**Recommended runtime:** production continuous monitoring, UAT  
**Primary data source:** session transcripts, stage logs

### 4.4.3 Fallback Rate

**Definition:** Measures how often the system fails to deliver primary structured UI and falls back to older or less rich presentation modes.

**Fallback order for Petties:**

1. `ui_schema`
2. legacy `ui_card`
3. `message` plain text
4. formatted `data` text

**Scoring rule:**

```text
Fallback Rate = assistant responses not rendered from valid ui_schema / total structured assistant responses
```

**Suggested target:** `< 5%` after render migration is stable

**Primary layer:** Layer 3 + 4  
**Recommended runtime:** production dashboard, renderer regression testing  
**Primary data source:** presentation logs, client render telemetry

### 4.4.4 Self-Healing Success Rate

**Definition:** Measures whether the agent successfully recovers after receiving a validation or recoverable tool error.

**Scoring rule:**

```text
Self-Healing Success Rate = recoverable failures followed by successful correction / total recoverable failures
```

**Suggested target:** `>= 80%`

**Primary layer:** Layer 1 + 2  
**Recommended runtime:** nightly regression, sampled production traces  
**Primary data source:** consecutive tool-call traces, error recovery sessions

---

## 5. Petties-Specific Supplemental Metrics

These metrics are strongly recommended because they map directly to current Petties architecture and known risk areas.

### 5.1 Booking Flow Drop-Off by Stage

Measures where users abandon or fail in the booking funnel:

- `IDLE -> COLLECTING`
- `COLLECTING -> PRESENTING`
- `PRESENTING -> CONFIRMING`
- `CONFIRMING -> BOOKED`

This is the fastest way to detect whether loss comes from reasoning, tooling, or UI friction.

### 5.2 Recoverable Error Recovery Rate

Measures whether users and agent together can recover from recoverable failures such as:

- missing slot
- invalid date
- clinic mismatch
- user changes selection mid-flow

This is complementary to `Self-Healing Success Rate` because it includes user interaction after the error.

### 5.3 Diagnosis Context Verification Rate

Measures the rate at which diagnosis requests are rejected due to invalid or out-of-scope `booking_id` / `pet_id`.

This metric is important after diagnosis hardening because it validates trust-boundary enforcement rather than model quality.

### 5.4 UI Action Success Rate

Measures whether client-side actions from `ui_schema` are valid and successfully processed:

- `select_item`
- `confirm_booking`
- `cancel_flow`
- `load_more`
- `open_detail`
- `retry_with_change`
- `dismiss`

This helps isolate render-layer issues from LLM or tool issues.

---

## 6. Mapping Metrics to Petties Codebase

### 6.1 Agent Layer Sources

Use these files for reasoning, stage, and conversation-state metrics:

- `petties-agent-serivce/app/core/agents/single_agent.py`
- `petties-agent-serivce/app/core/agents/state.py`
- `petties-agent-serivce/app/api/websocket/chat.py`

### 6.2 Tool Layer Sources

Use these files for action metrics:

- `petties-agent-serivce/app/core/tools/mcp_tools/booking_tools.py`
- `petties-agent-serivce/app/core/tools/mcp_tools/medical_tools.py`
- `petties-agent-serivce/app/core/tools/contracts.py`
- `petties-agent-serivce/app/services/backend_client.py`
- `petties-agent-serivce/app/api/routes/staff_diagnosis.py`
- `petties-agent-serivce/app/core/services/staff_diagnosis_service.py`
- `petties-agent-serivce/app/core/services/staff_diagnosis_context_service.py`

### 6.3 Presentation Layer Sources

Use these files for `ui_schema`, fallback, and intent-resolution metrics:

- `petties-agent-serivce/app/core/presentation/`
- `petties-agent-serivce/app/api/websocket/chat.py`

### 6.4 Render Layer Sources

Use these files for fallback rate, action success, and user-visible rendering quality:

- `petties-web/src/components/mascot/MascotDockPanel.tsx`
- `petties-web/src/components/chat/`
- `petties-web/src/components/emr/AIDiagnosisPanel.tsx`
- `petties_mobile/lib/ui/chat/ai_chat/`
- `petties_mobile/lib/ui/staff/widgets/ai_diagnosis_panel.dart`

---

## 7. Measurement Implementation Plan

## 7.1 Offline and CI Evaluation

Use offline eval for deterministic quality gates before deployment.

**Recommended scope:**

- reasoning eval set for booking flows
- diagnosis preview vs full mode eval set
- ambiguous input set
- recoverable error correction set
- state transition regression set

**Recommended metrics in CI:**

- Plan Quality
- Tool Selection Accuracy
- Argument Correctness
- Tool Correctness
- State Transition Accuracy

## 7.2 Nightly Regression

Nightly evaluation should focus on broader conversation behavior:

- Knowledge Retention
- Conversation Relevancy
- Conversation Completeness
- Self-Healing Success Rate
- Fallback Rate regression

## 7.3 Production Monitoring

Production monitoring should focus on outcomes and stability:

- Task Completion Rate
- Turns to Completion
- Tool Correctness from sampled traces
- `INTERNAL_ERROR` rate
- Fallback Rate
- Booking Flow Drop-Off by Stage
- Diagnosis Context Verification Rate

---

## 8. Minimum Dashboard for Petties

These five numbers must be visible every day after deployment:

1. `Task Completion Rate`
2. `Tool Correctness`
3. `INTERNAL_ERROR rate`
4. `Turns to Completion`
5. `Fallback Rate`

Recommended secondary widgets:

- error rate by `error_code`
- drop-off by booking stage
- top failing tools
- diagnosis context rejection rate
- `ui_action` success rate

---

## 9. Instrumentation Requirements

To compute this framework reliably, Petties should log or trace the following fields:

| Event Type | Required Fields |
|---|---|
| session start | `session_id`, `user_id`, `role`, `surface`, `platform`, `intent_category`, `started_at` |
| model step | `session_id`, `turn_id`, `stage`, `prompt_version`, `model`, `iteration`, `reasoning_mode` |
| tool call | `session_id`, `turn_id`, `tool_name`, `input_args`, `normalized_args`, `started_at`, `duration_ms` |
| tool result | `session_id`, `turn_id`, `tool_name`, `success`, `error_code`, `recoverable`, `is_final`, `result_summary` |
| presentation build | `session_id`, `turn_id`, `intent`, `layout`, `ui_schema_version`, `fallback_mode` |
| client render | `session_id`, `turn_id`, `platform`, `render_mode`, `render_success`, `fallback_mode` |
| client action | `session_id`, `turn_id`, `action_type`, `payload_valid`, `action_success` |
| terminal outcome | `session_id`, `outcome_type`, `booking_id`, `completed`, `cancelled_by_user`, `ended_at` |

Minimum logging rules:

- Never log secrets or raw tokens
- Avoid storing sensitive clinical text unless required by approved observability policy
- Use structured logs, not only free-form strings

---

## 10. Suggested Targets for Current Project Stage

For Petties at capstone / production-hardening stage, these are reasonable targets:

| Metric | Suggested Target |
|---|---|
| Plan Quality | `>= 85%` |
| Plan Adherence | `>= 90%` |
| Knowledge Retention | `>= 90%` |
| Role Adherence | `>= 95%` |
| Tool Selection Accuracy | `>= 90%` |
| Argument Correctness | `>= 88%` |
| Tool Correctness | `>= 85%` |
| Invalid Path Rate | `< 5%` |
| Conversation Relevancy | `>= 90%` |
| Conversation Completeness | `>= 80%` |
| State Transition Accuracy | `>= 95%` |
| Task Completion Rate | `>= 70%` |
| Fallback Rate | `< 10%` initially, then `< 5%` |
| Self-Healing Success Rate | `>= 80%` |
| `INTERNAL_ERROR` rate | `< 1%` |

---

## 11. Tooling Recommendations

The framework is tool-agnostic, but these categories are recommended:

| Need | Recommended Type |
|---|---|
| offline agent eval | DeepEval-style tool correctness and task metrics |
| trace inspection | LangSmith or equivalent trace store |
| production sampling | Maxim-style sampled observability or internal trace sampling |
| business dashboard | custom dashboard from structured logs and stage events |

For Petties, the most important requirement is not the vendor choice but the presence of reliable structured traces across agent, tool, presentation, and render layers.

---

## 12. Acceptance Use

This framework should be used in three checkpoints:

### 12.1 Before Merge

Required:

- reasoning and action metrics on PR-relevant regression set
- no regression on state transition tests
- no rise in fallback regression for affected surfaces

### 12.2 Before UAT

Required:

- nightly regression thresholds hold for booking and diagnosis critical flows
- no unresolved spike in `INTERNAL_ERROR`
- renderer action success stable on Web and Mobile

### 12.3 Before Production Promotion

Required:

- production-like environment demonstrates stable `Task Completion Rate`
- `Fallback Rate` below release threshold
- diagnosis context verification behaves correctly
- no critical gap between Web and Mobile contract behavior

---

## 13. Relationship to Other Petties Documents

Use this document together with:

- `AI_SERVICE_AUDIT_CHECKLIST.md` for architecture readiness and contract compliance
- `AI_SERVICE_QA_CHECKLIST.md` for broader QA execution
- `testing/AI_ASSISTANT_FULL_TEST_GUIDE.md` for manual end-to-end execution
- `AI_SERVICE_TECHNICAL_SPECIFICATION.md` for implementation boundaries and diagnosis safety rules

This document defines **what to measure**.  
The audit checklist defines **what must exist**.  
The test guide defines **how to execute validation**.

