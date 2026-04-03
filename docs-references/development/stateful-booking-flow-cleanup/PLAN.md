# Stateful Booking Flow Cleanup Plan

Last updated: 2026-03-27

## Overview

This plan defines the cleanup and completion work for the server-driven stateful booking flow.

The current codebase already contains partial implementation for booking session state, MongoDB persistence,
utility MCP tools, booking state MCP tools, and mobile WebSocket consumption. However, these pieces are not
fully aligned yet, and some modules currently fail at import/runtime.

The goal of this cleanup is to make the booking flow run end-to-end with one authoritative server state,
minimal duplication, deterministic reducer rules, and a mobile client that consumes server state as the
primary source of truth.

## Current Problems

- `utility_tools.py` imports a missing symbol and breaks MCP tools package import.
- `booking_session_tools.py` uses old helper names that do not match `booking_session.py`.
- Booking session reducer logic exists, but the surrounding tools are not fully wired to it.
- Mobile receives `booking_state` events, but the tracker still expects a flatter payload and relies heavily
  on local merge logic.
- New booking state tools are registered in code, but they are not yet treated as stable system-managed tools.
- There is no focused regression test suite for reducer rules, interruption handling, or booking state restore.

## Scope

### In Scope

- AI service booking session model cleanup
- MCP booking session tools cleanup
- MCP utility tools stabilization
- MongoDB booking state persistence verification
- WebSocket booking state propagation verification
- Mobile tracker alignment with server booking state
- Targeted tests for booking state reducers and WebSocket state updates

### Out of Scope

- Full redesign of booking tool orchestration
- New backend Spring booking APIs
- Large UI redesign for mobile booking chat
- Documentation outside booking flow cleanup

## Implementation Checklist

### Phase 1. Stabilize runtime imports

- Remove dead imports from `petties-agent-serivce/app/core/tools/mcp_tools/utility_tools.py`
- Align `petties-agent-serivce/app/core/tools/mcp_tools/booking_session_tools.py` with the actual API in
  `petties-agent-serivce/app/core/agents/booking_session.py`
- Verify `app/core/tools/mcp_tools/__init__.py` imports cleanly

### Phase 2. Normalize booking session state

- Keep one canonical `BookingSessionState` and `BookingDraft`
- Preserve reducer rules for clinic/date/booking_type invalidation
- Expose helpers for start, update, suspend, resume, complete, and cancel
- Keep state summary fields predictable for prompt and client consumption

### Phase 3. Fix and register booking-related MCP tools

- Make booking state tools read/write booking state via runtime context and MongoDB
- Ensure utility tools return deterministic, schema-friendly payloads
- Treat booking session tools and utility tools as system-managed tools so they can be enabled consistently

### Phase 4. Align mobile with server state

- Update `AiBookingTrackerSnapshot` to read nested `booking_state.draft`
- Keep server booking state as the preferred source of truth
- Retain local merge helpers only as UI fallback support

### Phase 5. Add regression coverage

- Add reducer tests for booking session state transitions and invalidation rules
- Add tool tests for session lifecycle and utility tools
- Add WebSocket tests for booking state propagation

## Acceptance Criteria

- MCP tools package imports without runtime error
- Booking session MCP tools use the same state model as `booking_session.py`
- Booking state persists in MongoDB and is restored into runtime context on new turns
- Mobile can parse server `booking_state` payloads directly from WebSocket events
- Reducer and state propagation behavior have automated test coverage

## Files Expected To Change

- `petties-agent-serivce/app/core/agents/booking_session.py`
- `petties-agent-serivce/app/core/tools/mcp_tools/booking_session_tools.py`
- `petties-agent-serivce/app/core/tools/mcp_tools/utility_tools.py`
- `petties-agent-serivce/app/core/tools/scanner.py`
- `petties_mobile/lib/ui/chat/ai_chat/utils/ai_booking_tracker.dart`
- `petties-agent-serivce/tests/test_booking_session.py`
- `petties-agent-serivce/tests/test_websocket_chat.py`

## Cleanup Rule

- Remove only code that is clearly dead, mismatched, or on a broken runtime path.
- If a file is still the correct ownership point for the feature, refactor it instead of deleting it.
