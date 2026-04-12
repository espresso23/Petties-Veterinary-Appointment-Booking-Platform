# AI Assistant Full Test Guide

**Version:** 1.0  
**Last Updated:** 2026-03-26  
**Document Type:** Manual test guide + QA checklist  
**Primary Audience:** QA, UAT, developers, tech lead  
**Owner:** AI Service + Web + Mobile teams

---

## 1. Purpose

This document is the single entry point for validating Petties AI Assistant end-to-end.

It consolidates:
- readiness checks before testing
- master QA checklist
- full manual test flows for active AI assistant use cases
- expected outputs and evidence collection
- pass/fail criteria for release decisions

This guide replaces fragmented execution across older documents while still cross-referencing them where needed.

---

## 2. Source References

Use this guide as the execution document. Use the documents below only as design references when investigating failures:

- [AI Chat Dynamic Components Plan](../../development/ai-chat-rendering-architecture/PLAN.md)
- [Booking With AI E2E Test Guide](./BOOKING_WITH_AI_E2E_TEST_GUIDE.md)
- [AI Service QA Checklist](../AI_SERVICE_QA_CHECKLIST.md)
- [AI Diagnosis E2E Scenarios](../ai_diagnose_service/05_E2E_TEST_SCENARIOS.md)
- [AI Chat WebSocket Contract](../technical/AI_CHAT_WEBSOCKET_CONTRACT.md)
- [AI Assistant Role Requirements](../AI_ASSISTANT_ROLE_REQUIREMENTS.md)
- [PETTIES SRS](../SRS/PETTIES_SRS.md)

## 3. Terminology and Current Contract

Current validation must follow the latest AI chat architecture:

- Chat rendering contract uses `ui_schema`, not legacy `ui_card`.
- One assistant turn should produce one coherent assistant message and one valid `ui_schema` when structured UI is needed.
- `ui_action` is the client-to-server structured interaction payload.
- `stage` is part of the booking/chat state machine and must not become stuck.
- Business chat and admin playground must remain isolated by `context_type`.
- Current mobile booking flow uses `select_services` for grouped service selection and `open_native_confirm` to hand off final confirmation to the native booking confirmation screen.

Legacy `ui_card` payloads are regression concerns only. They are not the target structured contract for current mobile validation.

---

## 4. Environment Matrix

| Environment | Frontend | Backend | AI Service | Purpose |
|---|---|---|---|---|
| Dev | `localhost:5173` / Flutter local | `localhost:8080` | `localhost:8000` | Local debugging |
| Test | `test.petties.world` | `api-test.petties.world` | test AI service endpoint | QA/UAT |
| Prod | `www.petties.world` | `api.petties.world` | production AI service endpoint | Release verification only |

Record the exact environment in every bug report and test run.

---

## 5. Coverage Map

### 5.1 Active Runtime Surfaces

| Surface ID | Role | Platform | Entry Point | Status | Main Purpose |
|---|---|---|---|---|---|
| AI-PO-MOB | PET_OWNER | Mobile | AI chat bubble / pet AI chat screen | Active | Pet care Q&A and booking assistant |
| AI-ST-MOB | STAFF | Mobile | Staff AI chat screen | Active | Staff business chat and patient-context support |
| AI-ST-WEB | STAFF | Web | `MascotDockPanel` on `/staff` workspace | Active | Staff business chat, structured renderer, diagnosis entry |
| AI-EMR-WEB | STAFF | Web | Create EMR page + chat sidebar + diagnosis panel | Active | Diagnosis support and EMR draft sync |
| AI-DIAG-API | STAFF / ADMIN | Web or Mobile caller | `/api/v1/staff-diagnosis/analyze` | Active | Diagnosis analysis pipeline |

### 5.2 Regression-Only Surfaces

| Surface ID | Role | Platform | Entry Point | Status | Why Test |
|---|---|---|---|---|---|
| AI-ADMIN-PG | ADMIN | Web | Admin Playground | Regression only | Context isolation, trace integrity, playground separation |

### 5.3 Planned / Not Runtime-Ready

The following are requirement-level or roadmap-level items and are not mandatory for this guide unless the target build explicitly enables them:

- Clinic Manager proactive AI assistant
- Clinic Owner setup assistant
- Pet-owner image diagnosis inside general AI chat

If any of these are enabled in the target build, add an appendix test pack before sign-off.

---

## 6. Required Test Accounts and Data

### 6.1 Accounts

| Role | Minimum | Notes |
|---|---|---|
| PET_OWNER | 1 account | Must own at least 2 pets |
| STAFF | 1 account | Must belong to a clinic with bookings/patients |
| ADMIN | 1 account | Required only for playground/isolation regression |

### 6.2 Mandatory Seed Data

| Data | Minimum Requirement |
|---|---|
| Pets | 2 pets under the same PET_OWNER account |
| Clinics | 2 active clinics near the test location |
| Clinic services | At least 1 consultation service and 1 vaccination or other service |
| Booking slots | Valid available slots in the next 7 days |
| Existing bookings | At least 1 active or historical booking for staff context tests |
| EMR data | At least 1 pet with EMR history and 1 case suitable for diagnosis testing |
| Location | Stable real GPS or mock GPS with known coordinates |

### 6.3 Service Dependencies

The following must be reachable before manual testing starts:

- Spring Boot APIs
- AI service
- MongoDB
- PostgreSQL
- Redis
- Qdrant Cloud
- OpenRouter
- Cohere, if required by the active build

---

## 7. Readiness Checklist Before Testing

Mark every item before starting the use-case matrix.

### 7.1 Infrastructure Readiness

| Item | Expected | Status |
|---|---|---|
| Spring Boot health | APIs reachable and authenticated requests succeed | [ ] |
| AI service health | AI service reachable and chat routes mounted | [ ] |
| MongoDB | Chat sessions/history persist correctly | [ ] |
| PostgreSQL | Booking and clinic data available | [ ] |
| Redis | Auth/cache flows stable | [ ] |
| Qdrant | Retrieval endpoints work for AI flows that depend on KB/case memory | [ ] |
| OpenRouter | Configured model exists and has available credits | [ ] |

### 7.2 Runtime Readiness

| Item | Expected | Status |
|---|---|---|
| WebSocket business chat | Connects with valid token | [ ] |
| Session creation | REST create/list/get works for chat sessions | [ ] |
| Session restore | Reopen existing session and receive history | [ ] |
| `context_type` enforcement | `BUSINESS_CHAT` and `PLAYGROUND_TEST` remain isolated | [ ] |
| Structured renderer | Web and Mobile can render `ui_schema` | [ ] |
| Structured actions | Clients can send `ui_action` payloads without fallback to synthetic text | [ ] |
| Logging | ReAct trace and backend logs are accessible for debugging | [ ] |

### 7.3 Client Readiness

| Item | Expected | Status |
|---|---|---|
| Mobile app build | Opens AI chat and can reconnect | [ ] |
| Web staff build | Opens staff AI chat page and EMR sidebar | [ ] |
| Admin web build | Playground reachable for admin only | [ ] |
| GPS/location | Available or mocked consistently | [ ] |
| Vietnamese-only UI | No new user-facing English mixed into AI surfaces | [ ] |

---

## 8. Master Checklist

Run this checklist across the full test cycle. It is not a substitute for the detailed scenarios below.

### 8.1 Transport and Auth

| Check | Expected | Status |
|---|---|---|
| WebSocket handshake | `connected` event received for valid session/token | [ ] |
| Missing token | Rejected safely | [ ] |
| Expired token | Unauthorized error shown safely | [ ] |
| Wrong session owner | Forbidden or not found, never leaks history | [ ] |
| Session switching | Correct history loaded per session | [ ] |

### 8.2 Rendering and State

| Check | Expected | Status |
|---|---|---|
| `thinking` state | Shows progress, does not freeze forever | [ ] |
| `stream` rendering | Partial text does not corrupt final message | [ ] |
| `ui_schema` rendering | Valid component list renders in order | [ ] |
| One turn, one response | No duplicate assistant bubbles for one tool turn | [ ] |
| `stage` transitions | Not stuck in loading/presenting/confirming | [ ] |
| Fallback behavior | Invalid schema falls back safely to text/error | [ ] |

### 8.3 Tool and Context Behavior

| Check | Expected | Status |
|---|---|---|
| Pet personalization | AI can access the current user's pets only | [ ] |
| Clinic lookup | Explicit clinic names are respected | [ ] |
| Service lookup | Services match selected clinic | [ ] |
| Slot lookup | Slots match selected service/date | [ ] |
| Booking preview | Summary is coherent before confirmation | [ ] |
| Booking create | Booking happens only after explicit confirmation on the native booking confirmation screen | [ ] |
| Staff context | Staff chat respects clinic/patient context | [ ] |
| Diagnosis context hydration | `booking_id` / `pet_id` is verified server-side before diagnosis synthesis | [ ] |
| Diagnosis image mode parity | Preview uses `describe_only`, full analyze uses `full` | [ ] |

### 8.4 Error and Recovery

| Check | Expected | Status |
|---|---|---|
| Recoverable tool error | Shows actionable retry/change path | [ ] |
| Non-recoverable error | Shows safe stop/dismiss path | [ ] |
| Diagnosis insufficient evidence | No heuristic treatment plan is fabricated from keywords alone | [ ] |
| No pets | Clear prompt to add/select pet | [ ] |
| No clinic results | Clear empty state with next step | [ ] |
| No slots | Suggest changing date or clinic | [ ] |
| Network interruption | Reconnect or fail safely | [ ] |

### 8.5 Security and Isolation

| Check | Expected | Status |
|---|---|---|
| Session isolation | Two sessions from same user do not mix messages | [ ] |
| Cross-role isolation | Staff cannot access pet-owner or admin playground data | [ ] |
| Playground isolation | Admin playground cannot read business chat history | [ ] |
| PII safety | No unrelated pet/booking data leaks | [ ] |
| Logging safety | Tokens and sensitive fields are not exposed in logs/screenshots | [ ] |

---

## 9. Test Evidence Rules

For every failed case, capture:

- environment
- date/time
- role and account
- session ID
- prompt or action taken
- expected result
- actual result
- screenshot or screen recording
- WebSocket payload excerpt
- relevant backend/AI service log lines
- model/tool configuration if the failure may depend on runtime configuration

Recommended screenshot points for happy-path evidence:

- session created / AI chat opened
- first `thinking` state
- main `ui_schema` rendered
- final success state
- restored session after reconnect

---

## 10. Detailed Use-Case Matrix

Use the same format for every scenario:

- **Goal**
- **Role / Platform**
- **Dependencies**
- **Expected UI output type**
- **Preconditions**
- **Test Steps**
- **Expected Result**
- **Evidence to Capture**
- **Fail Conditions**

---

## UC-AI-01 Pet Knowledge Q&A

- **Goal:** Verify general pet-care knowledge retrieval without starting a booking flow.
- **Role / Platform:** PET_OWNER on Mobile
- **Dependencies:** AI service, KB retrieval, WebSocket
- **Expected UI output type:** `text only` or `text + citations`, no booking renderer required
- **Preconditions:** Logged in as PET_OWNER with active chat session
- **Test Steps:**
  1. Open AI chat from the mobile bubble.
  2. Send prompt: `Mèo con bị tiêu chảy nhẹ thì nên theo dõi gì tại nhà?`
  3. Observe streaming behavior and final answer.
  4. Ask a follow-up: `Nếu bé bỏ ăn thêm 1 ngày thì có nguy hiểm không?`
- **Expected Result:**
  1. AI responds in Vietnamese.
  2. The answer stays in advice/support mode and does not create a booking flow unless the user asks.
  3. Context from the follow-up is preserved.
- **Evidence to Capture:** First response, follow-up response, any citations/source metadata if visible
- **Fail Conditions:**
  - Response is unrelated or in the wrong language
  - Booking UI appears without user intent
  - Context resets between turns

## UC-AI-02 Personalized Pet Lookup

- **Goal:** Verify personalized context retrieval for the current user's pets.
- **Role / Platform:** PET_OWNER on Mobile
- **Dependencies:** `get_user_pets`, auth, WebSocket
- **Expected UI output type:** `ui_schema` pet list or coherent text if only one valid pet exists
- **Preconditions:** Current account owns at least 2 pets
- **Test Steps:**
  1. Send prompt: `Thú cưng của tôi hiện có những bé nào?`
  2. If a list is shown, choose one pet using the UI action.
  3. Ask: `Bé này đã từng khám gần đây chưa?`
- **Expected Result:**
  1. Only the current user's pets are shown.
  2. Selecting a pet uses structured action, not raw ID text in the bubble.
  3. Follow-up resolves to the selected pet.
- **Evidence to Capture:** Pet list renderer, selection action, follow-up response
- **Fail Conditions:**
  - Missing pet list despite valid data
  - Wrong user's pet appears
  - Internal IDs exposed to the user

## UC-AI-03 Nearby Clinic Search

- **Goal:** Verify location-aware clinic search.
- **Role / Platform:** PET_OWNER on Mobile
- **Dependencies:** `search_clinics_nearby`, GPS/location
- **Expected UI output type:** `ui_schema` clinic list
- **Preconditions:** GPS permission granted or stable mock location configured
- **Test Steps:**
  1. Send prompt: `Tìm phòng khám thú y gần tôi ở Ngũ Hành Sơn.`
  2. Observe whether AI asks for missing location only if needed.
  3. Select one clinic from the rendered list.
- **Expected Result:**
  1. Clinics are relevant to the active location.
  2. Selection is done through `ui_action`.
  3. The selected clinic becomes the active context for the next turn.
- **Evidence to Capture:** Clinic list, selected clinic state, next-step response
- **Fail Conditions:**
  - AI re-asks for GPS when location is already available
  - Clinic list is empty without explanation
  - The selected clinic is not preserved

## UC-AI-04 Clinic Service Discovery

- **Goal:** Verify service retrieval for a chosen clinic.
- **Role / Platform:** PET_OWNER on Mobile
- **Dependencies:** `get_clinic_services`
- **Expected UI output type:** `ui_schema` service list/chips
- **Preconditions:** Clinic selected from previous step or explicit clinic name provided
- **Test Steps:**
  1. Ask: `Phòng khám này có các dịch vụ gì phù hợp cho khám tổng quát?`
  2. Select multiple services if available.
  3. Tap the grouped continue action.
- **Expected Result:**
  1. Returned services belong to the selected clinic only.
  2. Selection is structured and preserved by group, not reconstructed from plain text.
  3. The continue action stays disabled until at least one service is selected.
  4. No unrelated clinic switch occurs.
- **Evidence to Capture:** Service renderer, grouped selection state, and continue action payload
- **Fail Conditions:**
  - Wrong clinic services shown
  - AI loses the selected clinic
  - Service selection forces the user to restate previous context
  - Multiple services cannot be selected in the same group

## UC-AI-05 Slot Lookup

- **Goal:** Verify available slot search from selected clinic/service/date.
- **Role / Platform:** PET_OWNER on Mobile
- **Dependencies:** `check_available_slots`
- **Expected UI output type:** `ui_schema` slot selector
- **Preconditions:** Pet, clinic, and service already selected
- **Test Steps:**
  1. Ask: `Kiểm tra slot trống sáng thứ bảy tuần này.`
  2. Choose one returned slot.
- **Expected Result:**
  1. Relative date is resolved correctly for the current environment date.
  2. Slots match the selected clinic/service/date.
  3. The chosen slot is carried into the next step.
- **Evidence to Capture:** Slot renderer, selected slot, relative-date interpretation if visible
- **Fail Conditions:**
  - Date resolution is wrong
  - Slots are unrelated to the chosen service
  - Slot selection does not persist

## UC-AI-06 Booking Preview

- **Goal:** Verify booking summary generation before confirmation.
- **Role / Platform:** PET_OWNER on Mobile
- **Dependencies:** booking presentation layer, `ui_schema`, state machine
- **Expected UI output type:** `ui_schema` booking summary
- **Preconditions:** Pet, clinic, service, and slot already selected
- **Test Steps:**
  1. Continue from the slot selection flow.
  2. Wait for the assistant to produce a booking preview.
  3. Review pet, clinic, service, date, and time.
- **Expected Result:**
  1. Summary contains coherent and complete information.
  2. Booking is not created yet.
  3. Summary exposes a native-confirm handoff action instead of final in-chat confirmation.
  4. `stage` moves to confirming or equivalent confirmation-ready state.
- **Evidence to Capture:** Booking summary card, handoff action, and any visible stage/loading indicator
- **Fail Conditions:**
  - Summary misses required fields
  - Booking is created before explicit confirmation
  - Summary is rendered as an error state incorrectly

## UC-AI-07 Native Confirmation Handoff and Booking Success

- **Goal:** Verify booking creation only after explicit user confirmation on the native booking confirmation screen.
- **Role / Platform:** PET_OWNER on Mobile
- **Dependencies:** `open_native_confirm`, native booking flow, `create_booking_for_user`, booking APIs
- **Expected UI output type:** native booking confirmation screen followed by normal booking success behavior
- **Preconditions:** Valid booking preview is visible
- **Test Steps:**
  1. Tap the handoff action from booking summary.
  2. Verify the native booking confirmation screen opens with prefilled data.
  3. Confirm the booking from the native flow.
  4. Refresh booking list or related booking screen.
- **Expected Result:**
  1. Native confirmation screen is hydrated with clinic, pet, services, date, and time from AI chat.
  2. Booking is created once only after native confirmation.
  3. Final state communicates that clinic/staff confirmation may still be pending.
  4. The created booking appears in user-visible booking history.
- **Evidence to Capture:** Handoff action, native confirmation screen, final success state, booking list result
- **Fail Conditions:**
  - Native confirmation screen does not open
  - Prefilled booking data is incomplete or wrong
  - Duplicate booking created
  - No booking created despite success message
  - Confirmation is attempted inside chat instead of the native booking confirm flow

## UC-AI-08 Correction Flow After Preview

- **Goal:** Verify partial corrections without resetting the full booking flow.
- **Role / Platform:** PET_OWNER on Mobile
- **Dependencies:** state machine, `ui_action`, presentation layer
- **Expected UI output type:** updated `ui_schema`
- **Preconditions:** Booking preview already shown
- **Test Steps:**
  1. Choose action to change time.
  2. Select a different slot.
  3. Choose action to change service.
  4. Select a different service.
- **Expected Result:**
  1. Valid previous selections remain preserved where appropriate.
  2. The system asks only for missing or invalidated fields.
  3. The updated preview reflects only the requested correction.
- **Evidence to Capture:** Before/after preview for each correction
- **Fail Conditions:**
  - Full flow restarts from scratch
  - Previously valid context is dropped without reason
  - Wrong clinic/pet changes unexpectedly

## UC-AI-09 No Pet Available

- **Goal:** Verify graceful behavior when the user has no pet data.
- **Role / Platform:** PET_OWNER on Mobile
- **Dependencies:** auth, `get_user_pets`, error/empty rendering
- **Expected UI output type:** empty state or recoverable error state
- **Preconditions:** Use a PET_OWNER account with no pets
- **Test Steps:**
  1. Ask to start booking: `Tôi muốn đặt lịch khám cho thú cưng của tôi.`
- **Expected Result:**
  1. AI explains that no pet profile is available.
  2. The next step is actionable and safe.
  3. No broken booking state is created.
- **Evidence to Capture:** Empty/error state and suggested next step
- **Fail Conditions:**
  - App crashes
  - AI fabricates pet data
  - User is pushed into later booking stages without a pet

## UC-AI-10 No Clinic Found

- **Goal:** Verify empty-result handling for clinic search.
- **Role / Platform:** PET_OWNER on Mobile
- **Dependencies:** `search_clinics_nearby`, empty rendering
- **Expected UI output type:** empty state or recoverable error state
- **Preconditions:** Use a location with no matching clinic data or apply restrictive filters
- **Test Steps:**
  1. Ask: `Tìm phòng khám gần tôi cho khu vực giả lập không có dữ liệu.`
- **Expected Result:**
  1. The assistant explains that no suitable clinics were found.
  2. The assistant offers safe next steps such as changing area or service.
- **Evidence to Capture:** Empty result UI and retry suggestion
- **Fail Conditions:**
  - Empty message with no explanation
  - Random unrelated clinic is suggested as fallback

## UC-AI-11 No Service Match

- **Goal:** Verify handling when the selected clinic does not offer the requested service.
- **Role / Platform:** PET_OWNER on Mobile
- **Dependencies:** `get_clinic_services`, error/empty rendering
- **Expected UI output type:** recoverable error or empty state
- **Preconditions:** Choose a clinic that lacks the requested service
- **Test Steps:**
  1. Ask for a service that the clinic does not provide.
- **Expected Result:**
  1. AI explains the mismatch clearly.
  2. The flow remains recoverable by changing service or clinic.
- **Evidence to Capture:** Error/empty state and available recovery path
- **Fail Conditions:**
  - Wrong services are invented
  - Flow becomes unrecoverable without reason

## UC-AI-12 No Slot Available

- **Goal:** Verify slot-unavailable handling.
- **Role / Platform:** PET_OWNER on Mobile
- **Dependencies:** `check_available_slots`, structured error handling
- **Expected UI output type:** recoverable error card or empty slot state
- **Preconditions:** Choose a clinic/service/date combination with no availability
- **Test Steps:**
  1. Ask for an unavailable date/time combination.
- **Expected Result:**
  1. Clear explanation that no slots are available.
  2. Suggested recovery path such as changing date or clinic.
  3. Stage does not remain stuck in loading.
- **Evidence to Capture:** Error state, suggestion, any follow-up action
- **Fail Conditions:**
  - Silent failure
  - Endless thinking/loading
  - Slot list contradicts backend availability

## UC-AI-13 Recoverable Tool Error

- **Goal:** Verify that recoverable tool failures surface actionable recovery.
- **Role / Platform:** PET_OWNER or STAFF on Web/Mobile
- **Dependencies:** structured error contract
- **Expected UI output type:** error card with retry/change action
- **Preconditions:** Simulate a known recoverable tool failure or use a controlled invalid input
- **Test Steps:**
  1. Trigger a recoverable error.
  2. Use the retry/change action if shown.
- **Expected Result:**
  1. Error state is understandable.
  2. The suggested next action keeps the session usable.
- **Evidence to Capture:** Error card, recovery action, post-retry outcome
- **Fail Conditions:**
  - Raw exception leaks to UI
  - Retry action is missing for recoverable error
  - Session is corrupted after retry

## UC-AI-14 Auth or Session Invalid

- **Goal:** Verify unauthorized/forbidden/session-not-found behavior.
- **Role / Platform:** PET_OWNER or STAFF on Web/Mobile
- **Dependencies:** auth/session APIs, WebSocket
- **Expected UI output type:** safe error state
- **Preconditions:** Use expired token, revoked session, or wrong session owner
- **Test Steps:**
  1. Open or resume a chat with invalid auth/session state.
  2. Attempt to send a message.
- **Expected Result:**
  1. User receives a safe Vietnamese error.
  2. No previous history from another owner is exposed.
  3. Client offers a safe recovery such as re-login or creating a fresh session.
- **Evidence to Capture:** Error message and session behavior
- **Fail Conditions:**
  - Unauthorized access succeeds
  - Other users' messages appear
  - The client hangs without feedback

## UC-AI-15 Disconnect and History Restore

- **Goal:** Verify reconnect behavior and history restoration.
- **Role / Platform:** PET_OWNER or STAFF on Web/Mobile
- **Dependencies:** session persistence, WebSocket, MongoDB
- **Expected UI output type:** restored history and last stable interactive state
- **Preconditions:** Active conversation with at least one structured AI turn
- **Test Steps:**
  1. Start a conversation and reach a meaningful intermediate state.
  2. Disconnect the network or close/reopen the client.
  3. Reopen the same session.
- **Expected Result:**
  1. History is restored in the correct order.
  2. The last safe interactive state is shown again, including grouped service selection or booking tracker when applicable.
  3. No duplicate pending assistant message is created on restore.
- **Evidence to Capture:** Before/after reconnect state, session ID, and restored interactive booking state
- **Fail Conditions:**
  - Lost history
  - Mixed history from another session
  - Replayed duplicate assistant output
  - Grouped service or booking tracker state is lost after reconnect

## UC-AI-16 Multi-Session Isolation

- **Goal:** Verify that parallel sessions stay isolated.
- **Role / Platform:** PET_OWNER or STAFF on Web/Mobile
- **Dependencies:** session APIs, MongoDB persistence
- **Expected UI output type:** session-specific history only
- **Preconditions:** Ability to create or switch between multiple sessions
- **Test Steps:**
  1. Create Session A and ask about pet care.
  2. Create Session B and start a booking flow.
  3. Switch back and forth between sessions.
- **Expected Result:**
  1. Session A and Session B histories stay separate.
  2. The current active state belongs to the selected session only.
- **Evidence to Capture:** Session list and message history for both sessions
- **Fail Conditions:**
  - Messages bleed between sessions
  - Booking context from one session appears in another

## UC-AI-17 Staff Business Chat on Web

- **Goal:** Verify staff chat surface on the web with structured rendering.
- **Role / Platform:** STAFF on Web
- **Dependencies:** `MascotDockPanel`, `MascotProvider`, `ui_schema`, session APIs, tool routing
- **Expected UI output type:** `text`, `ui_schema`, and safe error states
- **Preconditions:** Logged in as STAFF with valid clinic context
- **Test Steps:**
  1. Open web staff AI chat.
  2. Ask for patient-related or clinic-related help.
  3. Trigger at least one structured UI response.
  4. Continue with one follow-up question.
- **Expected Result:**
  1. Staff page receives and renders structured assistant output.
  2. No duplicate assistant bubbles appear for one turn.
  3. Context remains within the staff's clinic scope.
- **Evidence to Capture:** Web structured renderer, session continuity, any tool-driven UI
- **Fail Conditions:**
  - Staff page ignores `ui_schema`
  - Structured response only works on another surface
  - Clinic scope is violated

## UC-AI-18 Staff EMR Diagnosis and Sidebar Draft Sync

- **Goal:** Verify AI diagnosis workflow and draft synchronization inside the EMR workspace.
- **Role / Platform:** STAFF on Web
- **Dependencies:** `AIDiagnosisPanel`, EMR create page, chat sidebar, diagnosis API
- **Expected UI output type:** diagnosis panel result, draft sync state, sidebar chat context
- **Preconditions:** Logged in as STAFF with a valid pet and booking/EMR context
- **Test Steps:**
  1. Open the create EMR page for a pet.
  2. Enter SOAP data and optional image context.
  3. Run diagnosis analysis.
  4. Apply one or more AI suggestions into the form.
  5. Open AI chat sidebar from EMR.
  6. Verify the draft is visible in the same conversation context.
  7. Sync the updated draft back to the EMR form.
- **Expected Result:**
  1. Diagnosis result is returned for authorized roles.
  2. Draft content stays coherent between panel and sidebar.
  3. Sync back to the EMR form applies the latest draft.
  4. If the diagnosis request includes `booking_id` or `pet_id`, the backend verifies and hydrates trusted context before synthesis.
  5. Preview-image analysis path stays lightweight and does not trigger full diagnosis unexpectedly.
- **Evidence to Capture:** Diagnosis result, sidebar state, synchronized EMR fields
- **Fail Conditions:**
  - Sidebar opens without EMR context
  - Draft sync is one-way only or inconsistent
  - Diagnosis panel and chat sidebar diverge

## UC-AI-19 Staff Diagnosis Authorization

- **Goal:** Verify role protection for diagnosis analysis.
- **Role / Platform:** Unauthorized user, Web or API caller
- **Dependencies:** `/api/v1/staff-diagnosis/analyze`
- **Expected UI output type:** safe 403/forbidden handling
- **Preconditions:** Use a non-STAFF, non-ADMIN account
- **Test Steps:**
  1. Attempt to call diagnosis analysis through the UI or API path.
- **Expected Result:**
  1. Access is denied safely.
  2. No diagnosis result is returned.
  3. Error message remains user-safe.
- **Evidence to Capture:** API/UI error and role used
- **Fail Conditions:**
  - Non-authorized role receives diagnosis output
  - The route is callable without proper permission

## UC-AI-19A Staff Diagnosis Context Safety

- **Goal:** Verify diagnosis context verification, mismatch handling, and safe evidence fallback.
- **Role / Platform:** STAFF or ADMIN on Web/API
- **Dependencies:** `/api/v1/staff-diagnosis/analyze`, Spring backend booking/pet APIs
- **Expected UI output type:** diagnosis result or safe 4xx error
- **Preconditions:** Have one valid booking in the current clinic, one booking outside the clinic, and one nonexistent record ID
- **Test Steps:**
  1. Call diagnosis with a valid in-scope `booking_id`.
  2. Call diagnosis with an out-of-scope `booking_id` as `STAFF`.
  3. Call diagnosis with a valid `booking_id` but mismatched `pet_id`.
  4. Call diagnosis with nonexistent `booking_id` or `pet_id`.
  5. Run one diagnosis case with no useful KB/Case Memory evidence.
- **Expected Result:**
  1. In-scope diagnosis succeeds and authoritative pet fields override client-supplied fake context.
  2. Out-of-scope booking returns `403`.
  3. Booking/pet mismatch returns `422`.
  4. Missing record returns `404`.
  5. Low-evidence case does not fabricate disease-specific treatment steps.
- **Evidence to Capture:** request payload, response code, diagnosis output, backend logs
- **Fail Conditions:**
  - Diagnosis trusts fake client species/breed/weight over backend context
  - Scope violation is not blocked
  - Heuristic plan text appears despite empty internal evidence

## UC-AI-20 Admin Playground Isolation Regression

- **Goal:** Verify that admin playground remains isolated from business chat.
- **Role / Platform:** ADMIN on Web
- **Dependencies:** `PLAYGROUND_TEST`, playground page, session APIs
- **Expected UI output type:** playground trace/messages only
- **Preconditions:** Admin account with access to playground
- **Test Steps:**
  1. Open admin playground and create a playground session.
  2. Send one or more playground prompts.
  3. Confirm trace output and session list behavior.
  4. Verify that business chat sessions are not visible in playground history.
- **Expected Result:**
  1. Playground works only for admin.
  2. Playground messages remain separated from business chat history.
  3. Trace/debug data is visible only in the playground scope.
- **Evidence to Capture:** Playground session metadata and session list
- **Fail Conditions:**
  - Business sessions appear in playground
  - Non-admin can access playground
  - Playground writes into business chat history

---

## 11. Rendering-Specific Regression Pack

Run these after any renderer, transport, or presentation-layer change.

| ID | Check | Expected | Status |
|---|---|---|---|
| R-01 | One tool turn creates one assistant response | No duplicate or fragmented assistant bubbles | [ ] |
| R-02 | Composite `ui_schema` with multiple components | Components render in order | [ ] |
| R-03 | `ui_action` selection | Selecting pet/clinic/service/slot sends structured payload | [ ] |
| R-04 | Loading lifecycle | `thinking` appears and clears correctly | [ ] |
| R-05 | Invalid schema fallback | UI fails safely to text/error | [ ] |
| R-06 | Legacy event tolerance during migration | Client does not crash if old event type appears | [ ] |
| R-07 | Vietnamese-only user text | No new English labels/buttons/errors in user-visible UI | [ ] |
| R-08 | Diagnosis image-mode parity | Web and Mobile preview paths use `describe_only` only | [ ] |
| R-09 | Diagnosis safe fallback | No keyword-based treatment fallback when evidence is empty | [ ] |

---

## 12. Cross-Session and Security Regression Pack

| ID | Check | Expected | Status |
|---|---|---|---|
| S-01 | Same user, two sessions | Histories and states remain separate | [ ] |
| S-02 | Different users, same environment | No history leakage | [ ] |
| S-03 | Wrong role opening staff/admin surface | Forbidden safely | [ ] |
| S-04 | Reconnect after disconnect | Restores own session only | [ ] |
| S-05 | Token expiry mid-session | Safe error, no data leak | [ ] |
| S-06 | Admin playground vs business chat | Strict isolation | [ ] |

---

## 13. Bug Report Template

Use the template below for every failed case:

```text
Title:
Environment:
Date/Time:
Role:
Platform:
Surface ID:
Session ID:
Use Case ID:
Prompt / Action:
Expected:
Actual:
Frequency:
Evidence:
WebSocket payload:
Backend / AI logs:
Model / Tool config:
Severity:
Notes:
```

---

## 14. Exit Criteria

### 14.1 Ready for Test

Mark the build as `ready for test` only if:

- readiness checklist in Section 7 is fully completed
- no infrastructure blocker prevents business chat or diagnosis execution
- the target environment is stable enough for repeatable manual runs

### 14.2 Ready for UAT

Mark the build as `ready for UAT` only if:

- all P0/P1 active-runtime use cases pass
- no critical auth/session isolation bug remains open
- no blocker exists in booking confirmation, session restore, or diagnosis authorization
- user-visible text is acceptable and consistent

### 14.3 Production-Ready

Mark the build as `production-ready` only if:

- all active-runtime use cases pass in the target release environment
- rendering regression pack passes on both Web and Mobile where applicable
- security and cross-session regression pack passes
- recoverable and non-recoverable error paths are verified
- evidence exists for at least one full happy path per active surface

---

## 15. Execution Notes

- Use absolute dates in test evidence when validating relative expressions such as `hôm nay`, `ngày mai`, or `thứ bảy này`.
- If a result depends on model configuration, include the active model name in the evidence.
- If the build still emits legacy payloads, document the exact event type and whether the client handled it safely.
- If the target release enables additional AI surfaces beyond Section 5, extend this guide before sign-off instead of treating them as untracked scope.
