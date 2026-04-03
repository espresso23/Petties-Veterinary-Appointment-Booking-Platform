# AI Chatbot Checklist - Petties

## 1. Backend (AI Service)

### 1.1 Agent Architecture
- [x] Single Agent với ReAct pattern hoạt động
- [x] LangGraph StateGraph được khởi tạo đúng
- [x] AgentFactory load config từ DB
- [x] Tool whitelist theo role/context hoạt động

### 1.2 Tools
- [x] Tất cả tools đăng ký trong scanner.py
- [x] Tool policy đầy đủ cho 21 tools
- [x] quick_booking_search tool hoạt động
- [x] Không có dead tools (get_current_datetime, extract_booking_entities, validate_booking_readiness đã xóa)

### 1.3 UISchema
- [x] INTENT_MAP đầy đủ (bao gồm quick_booking_search)
- [x] build_ui_schema() build đúng components
- [x] _build_quick_booking_components() hoạt động
- [x] Component types: clinic_card, service_chip, slot_button, text, badge, error_card, empty_state

### 1.4 WebSocket
- [x] handle_chat_message() xử lý message
- [x] WebSocket connection persistent
- [x] UI action validation (_UI_ACTION_SPECS)
- [x] select_item action spec tồn tại
- [x] Token-based auth hoạt động

### 1.5 Error Handling
- [x] Global exception handler
- [x] Tool error mapping (recoverable, suggestion)
- [x] Fallback response khi agent fail

---

## 2. Frontend Web

### 2.1 Chat UI
- [x] StaffAIChatPage render đúng
- [x] Message bubble hiển thị text + images + citations
- [x] Thinking process display (ReAct trace)
- [x] Tool calls expandable view

### 2.2 UISchema Rendering
- [x] UISchemaRenderer xử lý tất cả component types
- [x] renderClinicCard() hoạt động
- [x] renderPetCard() hoạt động
- [x] renderChoiceChip() cho service_chip + slot_button
- [x] renderBookingSummary() hoạt động
- [x] renderBadge() mới thêm hoạt động
- [x] renderEmptyState() + renderErrorCard() hoạt động

### 2.3 UI Actions
- [x] sendUiAction() gửi lên WebSocket đúng format
- [x] ActionButtons component hoạt động
- [x] onAction callback hoạt động

### 2.4 Session Management
- [x] Load session history
- [x] Create new session
- [x] Delete session
- [x] Feedback mechanism (good/bad)

### 2.5 Retry Mechanism
- [x] Auto-reconnect với MAX_RECONNECT_ATTEMPTS = 3
- [x] Reconnect timeout 2000ms giữa các lần thử
- [x] Hiển thị số lần reconnect đang thực hiện
- [x] Clear timeout khi disconnect

---

## 3. Frontend Mobile (Flutter)

### 3.1 Chat Screen
- [x] AiChatScreen render đúng
- [x] WebSocket connection (IOWebSocketChannel)
- [x] Message list với bubbles
- [x] Quick prompts hiển thị
- [x] Image upload (max 3, 5MB)
- [x] Location services integration

### 3.2 UISchema Parsing
- [x] _extractClinicSuggestionsFromUiSchema() hoạt động
- [x] _extractServiceOptionsFromUiSchema() hoạt động
- [x] _buildSlotGridFromUiSchema() hoạt động
- [x] _extractBookingSummaryFromUiSchema() hoạt động

### 3.3 Booking Flow
- [x] AiBookingTracker integration
- [x] Service selection UI
- [x] Slot picker UI
- [x] Booking confirmation flow

### 3.4 Session Management
- [x] Load session list
- [x] Create/delete sessions
- [x] Sync state với backend

---

## 4. Booking Flow

### 4.1 Traditional Flow (Multi-step)
- [x] get_user_pets → parse → show pet list
- [x] search_clinics_nearby → parse → show clinic list
- [x] get_clinic_services → parse → show services
- [x] check_available_slots → parse → show slots
- [x] create_booking_for_user → parse → show summary

### 4.2 Quick Booking Flow (New)
- [x] quick_booking_search → parse → show ALL in one message
- [x] UISchema với multiple components trong 1 message
- [x] select_item action support

### 4.3 UI Action Flow
- [x] Frontend gửi ui_action type
- [x] Backend validate theo _UI_ACTION_SPECS
- [x] Backend xử lý action và respond

---

## 5. Documentation

### 5.1 Architecture Docs
- [x] AI_CHATBOT_ARCHITECTURE.md cập nhật
- [x] AI_SERVICE_TECHNICAL_SPECIFICATION.md cập nhật
- [x] UISchema contract documented

### 5.2 Flow Docs
- [x] Booking flow documented
- [x] Quick booking flow documented
- [x] AI role clarification (NOT primary flow)

---

## 6. Dead Code Check

### 6.1 Backend
- [x] Unused imports
- [x] Unused functions
- [x] Unused tools in scanner.py

### 6.2 Frontend
- [x] Unused components
- [x] Unused imports

---

## 7. Integration Points

### 7.1 Backend → Frontend
- [x] Tool result → UISchema → JSON → WebSocket
- [x] Message format đúng (role, content, ui_schema, citations, react_trace)

### 7.2 Frontend → Backend
- [x] User message → WebSocket → handle_chat_message()
- [x] UI action → WebSocket → validate → process

### 7.3 External Services
- [x] OpenRouter LLM integration
- [x] Qdrant vector search (RAG)
- [x] Backend API calls (clinics, pets, bookings)