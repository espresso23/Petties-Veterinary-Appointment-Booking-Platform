# AI Assistant System Test Report

**Version:** 1.0  
**Last Updated:** 2026-04-11  
**Document Type:** System Test Report - End-to-End Testing  
**Based On:** SYSTEM_TEST_GUIDE.md  

---

## Test Planning Summary

| No | Function Name | Sheet Name | Description | Pre-Condition |
|---|---|---|---|---|
| 1 | Interact with ChatBot | AI-01 | Pet Owner/Staff chat with AI assistant via WebSocket | User logged in, WebSocket connected |
| 2 | Config Agent Parameter | AI-02 | Admin configures AI agent parameters (temperature, tokens, model) | Admin logged in, AI Config accessible |
| 3 | Test Agent Playground | AI-03 | Admin tests AI agent with ReAct trace inspection | Admin logged in, Agent enabled |
| 4 | Turn On/Off Agent Tools | AI-04 | Admin enables/disables individual AI tools | Admin logged in, Tools list loaded |
| 5 | Upload Document To Knowledge Base | AI-05 | Admin uploads documents for RAG retrieval | Admin logged in, Qdrant available |
| 6 | Delete Document from Knowledge Base | AI-06 | Admin removes documents from knowledge base | Documents indexed in KB |
| 7 | View Case Memory | AI-07 | Admin views confirmed medical cases in Qdrant | Admin logged in, Cases exist |
| 8 | Delete Case Memory | AI-08 | Admin removes confirmed cases from memory | Cases exist in Qdrant |
| 9 | Use AI-Assisted Clinic Setup, Operation | AI-09 | Clinic Owner/Manager uses AI for service generation | Clinic role, Setup mode active |
| 10 | Use Summarize patient info & EMR | AI-10 | Staff views patient EMR summary before exam | Staff logged in, Patient has EMR |
| 11 | Use Summarize pet's EMR | AI-11 | Pet Owner views their pet's medical history | Pet Owner logged in, Pet has EMR |
| 12 | View aggregate feedback stats | AI-12 | Admin views AI feedback analytics dashboard | Admin logged in, Feedback data exists |
| 13 | Provide AI's Response Feedback | AI-13 | Users rate AI responses (good/bad) | User logged in, AI response received |
| 14 | Use AI Diagnostic Support | AI-14 | Staff requests AI diagnosis support for cases | Staff logged in, Booking/pet context valid |

---

## 1. Interact with ChatBot

**Role:** PET_OWNER, STAFF, CLINIC_MANAGER, CLINIC_OWNER  
**Platform:** Mobile (Pet Owner), Web (Staff/Manager/Owner)  
**Entry Point:** AI chat bubble (Mobile), MascotDockPanel (Web)  

### TC-01: Happy Path - Successful Chat Interaction

| Field | Value |
|---|---|
| **Test Case ID** | TC_SYS_AI_01_01 |
| **Test Case Description** | Verify successful chat interaction with AI assistant (Pet Owner mobile) |
| **Test Case Procedure** | 1. Open mobile app -> Login as PET_OWNER<br>2. Tap AI Chat bubble -> Open AI Chat screen<br>3. Send message: "How to care for a kitten?"<br>4. Wait for AI response (5-10 seconds)<br>5. Send follow-up: "What if it stops eating?"<br>6. Verify context preservation |
| **Expected Results** | 1. AI Chat screen opens successfully<br>2. AI responds in **Vietnamese** within 5-10 seconds<br>3. Answer is relevant to pet care topic<br>4. Context preserved in follow-up question<br>5. No booking UI appears unless user explicitly requests it<br>6. WebSocket connection remains stable |
| **Pre-conditions** | - PET_OWNER account logged in<br>- At least 1 pet owned<br>- Stable WebSocket connection<br>- AI service reachable |
| **Round 1 Status** | [ ] Pass / [ ] Fail / [ ] Pending |
| **Round 2 Status** | [ ] Pass / [ ] Fail / [ ] Pending |
| **Round 3 Status** | [ ] Pass / [ ] Fail / [ ] Pending |
| **Test date** | |
| **Tester** | |
| **Note** | |

---

### TC-02: Empty Message Validation

| Field | Value |
|---|---|
| **Test Case ID** | TC_SYS_AI_01_02 |
| **Test Case Description** | Verify system prevents sending empty messages |
| **Test Case Procedure** | 1. Open AI Chat on mobile<br>2. Leave input field empty<br>3. Observe Send button state<br>4. Try to tap Send button multiple times |
| **Expected Results** | 1. Send button is **disabled** when input is empty<br>2. Empty message cannot be sent<br>3. No app crash or error toast<br>4. No WebSocket message sent with empty content |
| **Pre-conditions** | - PET_OWNER logged in<br>- AI Chat screen is open |
| **Round 1 Status** | [ ] Pass / [ ] Fail / [ ] Pending |
| **Round 2 Status** | [ ] Pass / [ ] Fail / [ ] Pending |
| **Round 3 Status** | [ ] Pass / [ ] Fail / [ ] Pending |
| **Test date** | |
| **Tester** | |
| **Note** | |

---

### TC-03: Session Restore After App Restart

| Field | Value |
|---|---|
| **Test Case ID** | TC_SYS_AI_01_03 |
| **Test Case Description** | Verify chat history restoration after closing/reopening app |
| **Test Case Procedure** | 1. Open AI Chat -> Send 2-3 messages with AI responses<br>2. Close app completely (kill process)<br>3. Reopen app -> Login -> Navigate to AI Chat<br>4. Verify chat history is restored<br>5. Send new message to verify session continuity |
| **Expected Results** | 1. Chat history restored in **correct chronological order**<br>2. No duplicate assistant messages appear<br>3. Conversation context preserved for follow-up<br>4. New message integrates with restored history<br>5. Session ID remains consistent |
| **Pre-conditions** | - PET_OWNER has previous chat session<br>- MongoDB storing history correctly<br>- Session not expired |
| **Round 1 Status** | [ ] Pass / [ ] Fail / [ ] Pending |
| **Round 2 Status** | [ ] Pass / [ ] Fail / [ ] Pending |
| **Round 3 Status** | [ ] Pass / [ ] Fail / [ ] Pending |
| **Test date** | |
| **Tester** | |
| **Note** | |

---

### TC-04: Network Disconnection and Recovery

| Field | Value |
|---|---|
| **Test Case ID** | TC_SYS_AI_01_04 |
| **Test Case Description** | Verify graceful handling of network loss and auto-reconnection |
| **Test Case Procedure** | 1. Open AI Chat -> Send message<br>2. Disable network while AI is processing (thinking state)<br>3. Wait 30 seconds<br>4. Observe error handling<br>5. Re-enable network<br>6. Verify auto-reconnection |
| **Expected Results** | 1. Display **Vietnamese error message** for network loss (e.g., "Mất kết nối mạng")<br>2. No app freeze or crash<br>3. Auto-reconnect when network restored<br>4. Chat screen returns to usable state<br>5. Reconnect attempts shown to user (if applicable) |
| **Pre-conditions** | - PET_OWNER in active chat session<br>- Ability to toggle network on/off<br>- WebSocket connection active |
| **Round 1 Status** | [ ] Pass / [ ] Fail / [ ] Pending |
| **Round 2 Status** | [ ] Pass / [ ] Fail / [ ] Pending |
| **Round 3 Status** | [ ] Pass / [ ] Fail / [ ] Pending |
| **Test date** | |
| **Tester** | |
| **Note** | |

---

### TC-05: Unauthorized Access Prevention

| Field | Value |
|---|---|
| **Test Case ID** | TC_SYS_AI_01_05 |
| **Test Case Description** | Verify AI Chat cannot be accessed without authentication |
| **Test Case Procedure** | 1. Logout from app<br>2. Try to open AI Chat via deep link or direct route<br>3. Observe redirect behavior<br>4. Login with expired token -> Try accessing AI Chat<br>5. Verify re-login modal |
| **Expected Results** | 1. **Redirect to Login screen** when not authenticated<br>2. Cannot access AI Chat without valid token<br>3. Expired token -> Display **ConfirmationModal** requesting re-login (no browser alert)<br>4. No WebSocket connection established without auth<br>5. No error logs expose sensitive token data |
| **Pre-conditions** | - Not logged in or token expired<br>- Deep link or route to AI Chat known |
| **Round 1 Status** | [ ] Pass / [ ] Fail / [ ] Pending |
| **Round 2 Status** | [ ] Pass / [ ] Fail / [ ] Pending |
| **Round 3 Status** | [ ] Pass / [ ] Fail / [ ] Pending |
| **Test date** | |
| **Tester** | |
| **Note** | |

---

## 2. Config Agent Parameter

**Role:** ADMIN  
**Platform:** Web  
**Entry Point:** `/admin/ai/agent-config`  

### TC-06: Edit Temperature Parameter

| Field | Value |
|---|---|
| **Test Case ID** | TC_SYS_AI_02_01 |
| **Test Case Description** | Verify Admin can successfully adjust AI Temperature parameter |
| **Test Case Procedure** | 1. Login as ADMIN<br>2. Navigate to `/admin/ai/agent-config`<br>3. Adjust Temperature slider from 0.7 -> 1.0<br>4. Observe real-time value display<br>5. Click Save button<br>6. Reload page -> Verify value persists<br>7. Test AI chat with new temperature |
| **Expected Results** | 1. Slider operates smoothly with **real-time value display**<br>2. Toast message "Đã lưu thành công" (Saved successfully) in Vietnamese<br>3. Value persists after page reload<br>4. AI responses reflect new temperature (more creative at 1.0)<br>5. No console errors |
| **Pre-conditions** | - ADMIN account logged in<br>- AI Agent Config page accessible<br>- Agent is enabled |
| **Round 1 Status** | [ ] Pass / [ ] Fail / [ ] Pending |
| **Round 2 Status** | [ ] Pass / [ ] Fail / [ ] Pending |
| **Round 3 Status** | [ ] Pass / [ ] Fail / [ ] Pending |
| **Test date** | |
| **Tester** | |
| **Note** | |

---

### TC-07: Invalid Parameter Values Validation

| Field | Value |
|---|---|
| **Test Case ID** | TC_SYS_AI_02_02 |
| **Test Case Description** | Verify system rejects invalid parameter values |
| **Test Case Procedure** | 1. Navigate to Admin AI Config page<br>2. Enter Temperature = 1.5 (> 1.0)<br>3. Enter Temperature = -0.5 (< 0.0)<br>4. Enter Max Tokens = 0<br>5. Enter Max Tokens = -100<br>6. Enter Top-P = 2.0<br>7. Click Save after each invalid entry |
| **Expected Results** | 1. Display **Vietnamese validation errors** for each invalid value<br>2. Cannot save invalid values (Save button disabled or rejected)<br>3. Input fields **highlighted in red** with error message<br>4. Error messages specific to each field (e.g., "Nhiệt độ phải từ 0.0 đến 1.0")<br>5. Valid values can still be saved |
| **Pre-conditions** | - ADMIN logged in<br>- Config form is open<br>- Browser dev tools open to inspect network requests |
| **Round 1 Status** | [ ] Pass / [ ] Fail / [ ] Pending |
| **Round 2 Status** | [ ] Pass / [ ] Fail / [ ] Pending |
| **Round 3 Status** | [ ] Pass / [ ] Fail / [ ] Pending |
| **Test date** | |
| **Tester** | |
| **Note** | |

---

### TC-08: Select LLM Model

| Field | Value |
|---|---|
| **Test Case ID** | TC_SYS_AI_02_03 |
| **Test Case Description** | Verify Admin can change AI LLM Model |
| **Test Case Procedure** | 1. Navigate to `/admin/ai/agent-config`<br>2. Open LLM Model dropdown<br>3. Verify list of available models displayed<br>4. Select different model (e.g., gemini-2.0-flash -> llama-3.3-70b)<br>5. Click Save<br>6. Test AI chat with new model<br>7. Verify model change in AI service logs |
| **Expected Results** | 1. Dropdown shows **list of available models** from OpenRouter<br>2. Save successful -> Vietnamese toast message<br>3. New model applied to AI service<br>4. AI chat uses new model for responses<br>5. Model name visible in backend logs for debugging |
| **Pre-conditions** | - ADMIN logged in<br>- OpenRouter has credits for multiple models<br>- AI service reachable |
| **Round 1 Status** | [ ] Pass / [ ] Fail / [ ] Pending |
| **Round 2 Status** | [ ] Pass / [ ] Fail / [ ] Pending |
| **Round 3 Status** | [ ] Pass / [ ] Fail / [ ] Pending |
| **Test date** | |
| **Tester** | |
| **Note** | |

---

### TC-09: Reset to Default Parameters

| Field | Value |
|---|---|
| **Test Case ID** | TC_SYS_AI_02_04 |
| **Test Case Description** | Verify Admin can reset all parameters to default values |
| **Test Case Procedure** | 1. Modify multiple parameters (Temperature, Max Tokens, Top-P)<br>2. Record current values<br>3. Click "Reset to Default" button<br>4. **ConfirmModal** appears -> Click Confirm<br>5. Verify all values return to defaults<br>6. Reload page -> Verify persistence |
| **Expected Results** | 1. All parameters return to **default values** (e.g., Temperature=0.7, Max Tokens=512)<br>2. **ConfirmationModal** shown before reset (no browser confirm())<br>3. Toast message "Đã reset thành công" in Vietnamese<br>4. Changes persist after reload<br>5. AI chat behavior returns to baseline |
| **Pre-conditions** | - ADMIN has previously modified parameters<br>- Default values are known/document |
| **Round 1 Status** | [ ] Pass / [ ] Fail / [ ] Pending |
| **Round 2 Status** | [ ] Pass / [ ] Fail / [ ] Pending |
| **Round 3 Status** | [ ] Pass / [ ] Fail / [ ] Pending |
| **Test date** | |
| **Tester** | |
| **Note** | |

---

### TC-10: Configuration Authorization Check

| Field | Value |
|---|---|
| **Test Case ID** | TC_SYS_AI_02_05 |
| **Test Case Description** | Verify non-Admin users cannot access AI configuration |
| **Test Case Procedure** | 1. Login as PET_OWNER<br>2. Try navigating to `/admin/ai/agent-config`<br>3. Observe redirect/error<br>4. Login as STAFF -> Try same route<br>5. Try calling config API directly with non-Admin token |
| **Expected Results** | 1. **Redirect to appropriate dashboard** (not admin page)<br>2. Cannot access AI Config page<br>3. API returns **403 Forbidden** for non-Admin roles<br>4. Vietnamese error message if attempted<br>5. No config data exposed in network responses |
| **Pre-conditions** | - PET_OWNER and STAFF accounts available<br>- Admin route known |
| **Round 1 Status** | [ ] Pass / [ ] Fail / [ ] Pending |
| **Round 2 Status** | [ ] Pass / [ ] Fail / [ ] Pending |
| **Round 3 Status** | [ ] Pass / [ ] Fail / [ ] Pending |
| **Test date** | |
| **Tester** | |
| **Note** | |

---

*End of sample format. Would you like me to continue with the remaining 12 functions (TC-11 through TC-63) in this same hierarchical format?*
