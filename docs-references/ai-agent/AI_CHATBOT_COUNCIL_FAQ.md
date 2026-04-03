# AI Chatbot Council FAQ

Last updated: 2026-04-02

## Opening Position

Petties AI Chatbot is a controlled assistant for pet-care guidance and booking support.
It does not replace staff, clinic managers, or the booking backend.

## Suggested Questions and Answers

### Q1. Does the chatbot create bookings automatically without user consent?

No. Booking mutation is gated. The chatbot must collect the required fields, summarize them, and wait for explicit confirmation before creating the booking.

### Q2. How do you prevent the chatbot from booking the wrong clinic?

We separate clinic discovery from slot confirmation. `search_clinics_nearby` resolves candidate clinics, and `check_available_slots` is used only when a clinic is already known or resolved with enough confidence.

### Q3. What happens if the user says only "my pet"?

The runtime resolves the user's pet first with `get_user_pets` before continuing with pet-specific advice or booking.

### Q4. Why do you still allow web search?

Web search is allowed only for pet-owner general guidance when the internal knowledge base is insufficient. It is blocked for staff clinical diagnosis flows.

### Q5. What if the AI service or backend is slow?

The system uses bounded loops, rate limiting, timeout handling, and recoverable error responses. The safe degraded behavior is to stop mutation, inform the user, and ask them to retry.

### Q6. What if exact slots cannot be confirmed?

The chatbot should not invent slot availability. It either returns real slot results from `check_available_slots` or asks the user to choose another clinic/date/time.

### Q7. How do you protect privacy?

The chatbot uses authenticated sessions, session ownership checks, and role-based tool whitelists. Users can only access their own personalized data in business chat.

### Q8. Why use booking session tools?

Booking session tools reduce repeated questions, preserve collected fields across reconnects, and make booking safer by keeping a structured draft state.

### Q9. What is the backup plan if the live demo fails?

- Show saved session restore and explain reconnect behavior.
- Demonstrate clinic discovery without mutation.
- Show the deterministic confirmation gate before booking creation.
- Present the runtime truth and audit checklist as evidence of controlled behavior.

## Demo Red Flags To Avoid

- Do not claim exact slots before slot-check output exists.
- Do not present `search_clinics_by_name` as the standard public booking flow.
- Do not describe feedback as direct learning into Case Memory.
- Do not describe REST message POST as the primary real-time chat path.
