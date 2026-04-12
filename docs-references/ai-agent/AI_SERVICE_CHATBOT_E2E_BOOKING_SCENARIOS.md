# AI Service Chatbot E2E Booking Scenarios

Last updated: 2026-03-30

## Scope

This document defines end-to-end booking-chat scenarios and reference payloads for Petties AI Service WebSocket chat flow.

Service path:

- `petties-agent-serivce/app/api/websocket/chat.py`
- `petties-agent-serivce/app/core/tools/mcp_tools/booking_session_tools.py`
- `petties-agent-serivce/app/core/tools/mcp_tools/booking_tools.py`

Test environments:

- `dev`: localhost (`feature/*` branch)
- `test`: `test.petties.world` + `api-test.petties.world` (`develop` branch)
- `prod`: `www.petties.world` + `api.petties.world` (`main` branch)

## Scenario A - Normal Chat -> Start Booking -> Cancel -> Start Booking Again

### Preconditions

- User authenticated via JWT token in WebSocket query.
- Existing chat session belongs to current user.
- Context type is `BUSINESS_CHAT`.

### Step 1: Normal chat (no booking)

Client payload:

```json
{
  "message": "Cho mình hỏi giờ làm việc của phòng khám"
}
```

Expected server behavior:

- Returns normal answer stream (`stream`, `complete`).
- Does not emit `booking_state_update`.

### Step 2: User switches to booking

Client payload:

```json
{
  "message": "Mình muốn đặt lịch khám cho bé Mimi"
}
```

Expected server behavior:

- Booking session starts.
- Emits `booking_state_update` with active state.

Example event:

```json
{
  "type": "booking_state_update",
  "stage": "COLLECTING",
  "booking_state": {
    "active": true,
    "status": "COLLECTING",
    "stage": "COLLECTING",
    "draft": {
      "pet_id": "pet-1",
      "clinic_id": "clinic-1",
      "booking_type": "IN_CLINIC"
    }
  },
  "timestamp": "2026-03-30T...Z"
}
```

### Step 3: User cancels booking mid-flow

Client payload:

```json
{
  "message": "Thôi mình không đặt nữa"
}
```

Expected server behavior:

- Booking session is ended with `CANCELLED`.
- Emits `booking_state_update` with inactive state.

Example event:

```json
{
  "type": "booking_state_update",
  "stage": "IDLE",
  "booking_state": {
    "active": false,
    "status": "CANCELLED",
    "stage": "IDLE",
    "draft": {
      "pet_id": "pet-1",
      "clinic_id": "clinic-1",
      "booking_type": "IN_CLINIC"
    }
  },
  "timestamp": "2026-03-30T...Z"
}
```

### Step 4: User starts booking again

Client payload:

```json
{
  "message": "Ok đặt lại giúp mình vào cuối tuần"
}
```

Expected server behavior:

- New booking session is created.
- Emits `booking_state_update` back to active collecting state.

Example event:

```json
{
  "type": "booking_state_update",
  "stage": "COLLECTING",
  "booking_state": {
    "active": true,
    "status": "COLLECTING",
    "stage": "COLLECTING",
    "draft": {
      "pet_id": "pet-1",
      "clinic_id": "clinic-1",
      "booking_type": "IN_CLINIC"
    }
  },
  "timestamp": "2026-03-30T...Z"
}
```

## UI Action Payload Contract (client -> server)

Sample `ui_action` for slot selection:

```json
{
  "message": "Mình chọn khung giờ này",
  "ui_action": {
    "type": "select_slot",
    "clinic_id": "clinic-1",
    "booking_date": "2026-04-05",
    "start_time": "09:00",
    "service_ids": ["svc-1"],
    "pet_id": "pet-1"
  }
}
```

Validation notes:

- `ui_action.type` must be from allowed enum.
- Disallowed fields are rejected.
- Invalid date/time formats are rejected.
- On invalid payload, server emits:

```json
{
  "type": "error",
  "error_code": "INVALID_UI_ACTION",
  "recoverable": true,
  "suggestion": "Vui lòng cập nhật ứng dụng hoặc thử lại thao tác với dữ liệu hợp lệ."
}
```

## Automated Regression Coverage

Implemented test:

- `petties-agent-serivce/tests/test_websocket_chat.py`
  - `test_handle_chat_message_end_to_end_booking_journey`

Coverage:

- Normal chat without booking state update.
- Switch to booking and receive active `booking_state_update`.
- Cancel booking and receive inactive/cancelled state.
- Start booking again and receive active collecting state.
