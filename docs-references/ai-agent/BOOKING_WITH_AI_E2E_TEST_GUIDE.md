# E2E Test Guide - Booking With AI (PET_OWNER Mobile)

**Version:** 1.5  
**Last Updated:** 2026-03-22  
**Test Type:** Manual end-to-end  
**Scope:** Mobile app + AI service + Spring Boot booking APIs

> **Architecture Note (v2.0):** UI Cards được define trực tiếp trong tool return values (`ui_card` field). chat.py dùng generic dispatcher thay vì hardcoded extraction. Xem [AI_CHAT_WEBSOCKET_CONTRACT v2.0](../technical/AI_CHAT_WEBSOCKET_CONTRACT.md).

**Reference Documents:**
- [BOOKING_AI_TOOLS_REQUIREMENTS](../BOOKING_AI_TOOLS_REQUIREMENTS.md)
- [AI_CHAT_WEBSOCKET_CONTRACT v2.0](../technical/AI_CHAT_WEBSOCKET_CONTRACT.md)
- [PETTIES_SRS](../SRS/PETTIES_SRS.md)

---

## 1. Objectives

- Verify that the AI chooses tools from conversation meaning, not from a hardcoded wizard flow.
- Verify that the AI uses the full conversation context, not only the latest message.
- Verify that the booking flow can be completed in both modes:
  - One-shot prompt: the user provides almost all information in a single message.
  - Multi-turn prompt: the user gradually provides pet, clinic, service, date, and time.
- Verify that the mobile app correctly renders structured booking events:
  - `clinic_carousel`
  - `service_chips`
  - `slot_grid`
  - `booking_summary`
  - `booking_created`
- Verify that the mobile runtime includes the required booking support layers:
  - booking tracker
  - autocomplete prompt suggestions
  - quick actions on the booking summary
  - structured `ui_action` payloads over WebSocket
- Verify that previously reported UX regressions do not reappear:
  - asking for GPS again when location is already available
  - asking again for pet or clinic after the user already stated them
  - exposing `clinic_id` in user-visible chat bubbles
  - unnecessary greeting messages during booking
  - falling back to an unrelated nearby clinic when the user explicitly named a target clinic
  - rendering multiple assistant bubbles for the same booking turn
  - showing a clinic picker even when an explicit clinic was uniquely resolved

---

## 2. Required System Scope

### 2.1 Mandatory Components

- **Spring Boot Backend:** `backend-spring/petties`
- **AI Service:** `petties-agent-serivce`
- **Mobile App:** `petties_mobile`
- **PostgreSQL / MongoDB / Redis:** running under the target dev or test environment

### 2.2 Required Test Data

- At least one `PET_OWNER` account
- At least two pets under the same account
  - Example: `Rocky`, `Hadine`
- At least two clinics in Da Nang
  - One clinic whose name contains `PetCare`
  - One additional nearby clinic for fallback validation
- The `PetCare` clinic must have:
  - valid clinic services
  - available slots for the nearest Saturday
- Mobile GPS must be available as either a real device location or a stable mock location

### 2.3 AI Model and Runtime Preconditions

- The configured LLM must still exist on OpenRouter.
- Avoid deprecated or removed models because unexpected fallback can distort behavior.
- AI chat WebSocket streaming must be enabled and must deliver structured events.

---

## 3. Preconditions Before Testing

### 3.1 Backend

- Booking APIs respond normally.
- Clinic services API does not fail on valid clinic requests.
- Slot checking API returns the expected payload shape.
- Booking creation returns a `PENDING` booking or the current preview/draft contract defined by the system.

### 3.2 AI Service

- Booking orchestration is no longer driven by hardcoded keyword routing.
- Thin validation may still exist, but only for:
  - filtering unexpected parameters
  - simple type normalization
  - blocking truly missing minimum required fields
- Booking tools accept rich context fields such as:
  - `clinic_name_hint`
  - `service_hint`
  - `date_expression`
  - `time_preference`
  - conversation context

### 3.3 Mobile

- The AI chat UI can render:
  - thought/status line
  - booking tracker
  - autocomplete prompt suggestions
  - clinic cards
  - service chips
  - slot grid
  - booking summary card
  - booking created card
- AI chat components are grouped under:
  - `petties_mobile/lib/ui/chat/ai_chat/`
  - `petties_mobile/lib/ui/chat/ai_chat/utils/`
- GPS is not requested again on every message send.
- `clinic_id` is never shown directly in user-facing chat bubbles.
- Structured interactions such as clinic selection, service selection, slot selection, quick corrections, and booking confirmation must use `ui_action`, not long mobile-generated preset text.
- The composer must show default autocomplete prompt suggestions even when the input is still empty.

---

## 4. What To Observe During Testing

### 4.1 Mobile UI

- Observe each chat bubble, card, chip group, and slot grid.
- Observe whether the booking tracker updates correctly for pet, clinic, service, date, and time.
- Observe autocomplete prompt suggestions while the user is typing.
- Observe whether quick actions preserve valid context when the user performs corrections.
- Observe whether any unnecessary greeting message appears mid-flow.
- Observe whether the AI asks again for information that is already clear.

### 4.2 AI Service Logs

- Inspect the `Thought -> Action -> Observation` chain.
- Check whether the chosen tool matches the user intent.
- Verify there is no:
  - max-iteration loop
  - empty parameter parsing failure
  - encoding issue
  - unintended model fallback

### 4.3 Backend Logs

- Inspect requests sent to:
  - clinic search
  - clinic services lookup
  - slot checking
  - booking creation
- Verify that downstream IDs are passed in the correct format.

---

## 5. Happy Paths

### 5.1 Case A - One-Shot Prompt With Almost Complete Information

**Goal:** verify that AI can complete almost the whole flow from one natural prompt.

**Test Prompt:**
```text
Book an appointment for Hadine near Ngu Hanh Son, Da Nang, for a medical checkup at Pet Care this Saturday morning. If the nearest valid Pet Care clinic still has a slot, create the booking request for me and let the clinic manager confirm it later.
```

**Time resolution note:**

- For this guide, the test date is **2026-03-20** in **Asia/Saigon**.
- The phrase `this Saturday` must resolve to **2026-03-21**.

**Expected ideal processing:**

1. AI identifies:
   - pet: `Hadine`
   - clinic hint: `Pet Care`
   - location hint: `Ngu Hanh Son, Da Nang`
   - service intent: medical examination
   - date expression: `this Saturday` -> `2026-03-21`
   - time preference: morning
2. AI calls `get_user_pets` only if a concrete `pet_id` is still needed.
3. If the user explicitly named `Pet Care`, AI must resolve that clinic first and must not jump to an unrelated nearby clinic.
4. AI calls `get_clinic_services`.
5. AI calls `check_available_slots`.
6. If the booking request can be prepared, AI returns a `booking_summary` or proceeds to the current confirmation mechanism.

**Pass if:**

- AI does not ask again: `Which pet?`
- AI does not ask again: `Where are you?` if location is already available from prompt or runtime context
- AI does not emit an unnecessary greeting
- AI does not expose `clinic_id`
- AI shows either `service_chips` or moves directly to `slot_grid` / `booking_summary` in a coherent way

---

### 5.2 Case B - Multi-Turn Contextual Booking

**Goal:** verify that AI understands the full conversation context.

**Conversation:**

1. `I want to book an appointment for my pet`
2. `For Hadine`
3. `At Pet Care veterinary clinic`
4. `General checkup`
5. `Saturday morning`

**Expected behavior:**

- After step 2, AI does not ask again which pet.
- After step 3, AI does not switch to an unrelated nearby clinic.
- After step 4, AI does not ask again for the service if `general checkup` was mapped successfully.
- After step 5, AI resolves the relative date and checks slots.

**Pass if:**

- Each turn asks only for genuinely missing information
- The flow does not reset into a greeting
- The flow does not revert to a generic nearby-clinic search when the target clinic is already clear

---

### 5.3 Case C - Guided Booking With Structured UI Actions

**Goal:** verify that the interactive mobile flow works with structured events and does not depend on preset text.

**Steps:**

1. Open AI chat.
2. Choose a booking suggestion or type `I want to book an appointment`.
3. Select a pet card.
4. Select a clinic card.
5. Select services in `service_chips`.
6. Select a time from `slot_grid`.
7. Confirm in `booking_summary`.

**Pass if:**

- Mobile renders each event correctly.
- The structured flow uses `ui_action`, not synthetic text that the LLM must re-interpret.
- Selecting a clinic card does not expose `clinic_id` in the user bubble.
- Selecting service or slot preserves the previously selected pet and clinic context.

---

### 5.4 Case D - Fast Corrections From Booking Summary Card

**Goal:** verify that quick actions act as a correction layer instead of resetting the whole flow.

**Example steps:**

1. Reach `booking_summary`.
2. Tap quick action `Change time`.
3. Select a different slot from `slot_grid`.
4. Observe the updated summary.
5. Tap quick action `Change service`.
6. Select a different service.

**Pass if:**

- After `Change time`, the system keeps the same pet, clinic, service, and date if they are still valid.
- After `Change service`, the system renders only the next necessary step instead of restarting the flow.
- The booking tracker always reflects the latest valid state.
- The AI service correctly applies `latest explicit fact wins`.

---

### 5.5 Case E - Autocomplete And Booking Tracker Within 1-2 Prompts

**Goal:** verify that the mobile UI helps the user finish booking quickly without turning the experience into a manual wizard.

**Steps:**

1. Open AI chat.
2. Start typing `Book for Ha`.
3. Observe autocomplete prompt suggestions.
4. Pick a suitable suggestion or finish the prompt manually.
5. Send the first prompt.
6. Observe the booking tracker.
7. Send one short follow-up prompt for any missing detail, for example `Saturday morning`.

**Pass if:**

- Suggestions are relevant to pet names, clinic names, or time phrases currently being typed.
- The booking tracker appears early and updates progressively turn by turn.
- The user can reach the summary within 1-2 prompts for a sufficiently clear case.
- The user is not forced back into a full wizard when ambiguity is low.

---

## 5.6 Case M1 - Multi-Pet Trong 1 Prompt

**Mục tiêu:** Xác minh AI hiểu và xử lý đặt lịch cho nhiều pet trong một câu prompt tự nhiên.

**Test Prompt:**
```
Tôi muốn đặt lịch cho 2 bé mèo (Rocky và Hadine) ở PetCare cuối tuần này, sáng mai 9h
```

**Thời gian:**
- Hôm nay là thứ 6 (2026-03-20), "cuối tuần" = thứ 7 (2026-03-21)
- "Sáng mai 9h" = 09:00

**Kỳ vọng xử lý:**

1. AI nhận diện:
   - 2 pet: `Rocky`, `Hadine`
   - clinic hint: `PetCare`
   - date: `cuối tuần` -> `2026-03-21`
   - time: `09:00`
2. AI gọi `get_user_pets` để xác minh pet IDs
3. AI gọi `get_clinic_services` cho PetCare
4. AI gọi `check_available_slots` cho ngày 2026-03-21, giờ 09:00
5. Backend tạo **2 booking riêng biệt**, mỗi pet 1 booking, cùng clinic/date/time
6. AI trả về `booking_created` với `multiPetSummary` chứa thông tin 2 bookings

**Pass nếu:**
- AI không hỏi lại "Which pet?"
- AI không hỏi lại "Which clinic?" khi đã rõ PetCare
- Backend tạo đúng 2 booking records riêng biệt
- Response có `multiPetSummary` với số lượng bookings = 2
- Mỗi booking có đúng pet_id và services được chỉ định

---

### 5.7 Case M2 - Multi-Pet + Multi-Service

**Mục tiêu:** Xác minh AI xử lý được cả multi-pet lẫn multi-service trong cùng request.

**Test Prompt:**
```
Đặt lịch tiêm phòng + tổng quát cho 2 bé mèo của tôi ở PetCare thứ 7
```

**Kỳ vọng xử lý:**

1. AI nhận diện:
   - 2 pet: tự động lấy từ user account (hoặc hỏi nếu chưa rõ)
   - services: `tiêm phòng`, `tổng quát`
   - clinic hint: `PetCare`
   - date: thứ 7
2. AI gọi `get_clinic_services` để map service names thành service IDs
3. AI gọi `check_available_slots`
4. Backend tạo **2 booking**, mỗi booking gán đúng 2 services

**Pass nếu:**
- Mỗi pet được gán đúng cả 2 services
- Không tạo booking trùng lặp
- Multi-service được apply đúng cho từng pet

---

### 5.8 Case M3 - Multi-Turn Multi-Pet

**Mục tiêu:** Xác minh AI giữ context qua nhiều turns cho multi-pet booking.

**Cuộc hội thoại:**

1. `Tôi muốn đặt lịch cho 2 bé`
2. `Rocky và Hadine`
3. `PetCare Đà Nẵng`
4. `Thứ 7 sáng 9h`

**Kỳ vọng:**
- Sau step 1: AI không reset context
- Sau step 2: AI biết 2 pets, không hỏi lại pet
- Sau step 3: AI giữ nguyên 2 pets, không switch sang clinic khác
- Sau step 4: AI resolve date và tạo 2 bookings

**Pass nếu:**
- AI không hỏi lại pet sau khi đã specify
- Booking tracker hiển thị đúng 2 pets
- Final booking tạo đủ 2 records

---

### 5.9 Case M4 - Multi-Pet Với Pet Không Tồn Tại

**Mục tiêu:** Xác minh AI xử lý graceful khi user nhắc pet không thuộc account.

**Test Prompt:**
```
Đặt lịch cho 3 bé mèo (Rocky, Fluffy, Hadine) thứ 7 ở PetCare
```

**Giả định:** User chỉ có 2 pets là Rocky và Hadine, không có Fluffy.

**Kỳ vọng:**
- AI nhận diện Fluffy không thuộc account
- AI hỏi xác nhận: "Tôi thấy bạn có Rocky và Hadine, nhưng không tìm thấy Fluffy. Bạn có muốn tiếp tục với 2 bé còn lại không?"
- Hoặc AI tự động bỏ qua Fluffy và đặt cho 2 pets hợp lệ

**Pass nếu:**
- Không crash
- Không tạo booking với pet_id không hợp lệ
- User được thông báo rõ ràng về pet bị loại bỏ

---

### 5.10 Case M5 - Single-Pet Backward Compatible

**Mục tiêu:** Đảm bảo single-pet booking vẫn hoạt động bình thường.

**Test Prompt:**
```
Đặt lịch cho Rocky thứ 7 9h ở PetCare
```

**Kỳ vọng:**
- Backend tạo đúng 1 booking
- Response không có `multiPetSummary` (hoặc có với 1 item)
- Không có breaking change với flow cũ

**Pass nếu:**
- Tạo đúng 1 booking
- Mọi thông tin (pet, clinic, service, date, time) đúng như yêu cầu

---

### 5.11 Case M6 - Multi-Pet Khác Loài

**Mục tiêu:** Xác minh AI xử lý multi-pet với pets khác loài (mèo + chó).

**Test Prompt:**
```
Đặt lịch cho Rocky (mèo) và Buddy (chó) ở PetCare thứ 7 sáng
```

**Kỳ vọng:**
- AI nhận diện đúng 2 pets khác loài
- Tạo 2 bookings riêng biệt
- Services có thể khác nhau tùy loài (nếu clinic phân biệt)

---

### 5.12 Case M7 - Multi-Pet Cùng Dịch Vụ Khác Dịch Vụ

**Mục tiêu:** Xác minh AI xử lý được trường hợp mỗi pet cần services khác nhau.

**Test Prompt:**
```
Đặt lịch cho Rocky tiêm phòng và Hadine tổng quát ở PetCare thứ 7
```

**Kỳ vọng xử lý:**

1. AI parse ra:
   - Rocky + service: tiêm phòng
   - Hadine + service: tổng quát
2. Backend tạo 2 bookings với services khác nhau cho mỗi pet

**Pass nếu:**
- Mỗi booking có đúng service của pet tương ứng
- Không nhầm lẫn services giữa 2 pets

---

## 6. Mandatory Negative Cases

### 6.1 The User Names A Specific Clinic That Does Not Exist

**Prompt:**
```text
Book an appointment for Hadine at Super PetCare XYZ this Saturday morning.
```

**Expected behavior:**

- AI states that no matching clinic was found.
- AI asks the user to choose another clinic or suggests similar nearby clinics.
- AI does not silently switch to an unrelated nearest clinic.

### 6.2 The User Only Says “I Want To Book”

**Expected behavior:**

- AI asks only the minimum information needed to start:
  - which pet
  - which clinic or nearby area
  - which service
  - which day / time window
- AI does not preload or over-ask for unnecessary data.

### 6.3 GPS Is Disabled

**Prompt:**
```text
Find a clinic near me and book an appointment for me.
```

**Expected behavior:**

- AI or mobile asks for location permission or asks for a text area.
- The flow does not crash.
- The system does not fabricate location.

### 6.4 Clinic Services API Fails

**Expected behavior:**

- AI reports that it could not load clinic services.
- Loading does not get stuck indefinitely.
- If possible, AI suggests trying another clinic or retrying later.

### 6.5 No Slot Is Available

**Expected behavior:**

- AI reports that the requested date or time has no available slot.
- AI suggests alternative dates or times.
- AI does not attempt to create a booking on an unavailable slot.

### 6.6 Quick Actions Must Not Destroy Valid Context

**Expected behavior:**

- If the user taps `Change time`, the system must not clear a valid pet or clinic.
- If the user taps `Change service`, the system must not go back to asking for the pet if the pet is already clear.
- If the user taps `Change clinic`, old service or slot data may become invalid, but valid pet and date intent must remain when still applicable.

---

## 7. Regression Checklist

Mark each item as passed when verified:

- [ ] No unnecessary greeting during booking
- [ ] No repeated pet question when the prompt already named `Hadine`
- [ ] No repeated GPS question when usable location is already available
- [ ] No fallback to an unrelated nearest clinic when the user explicitly named `PetCare`
- [ ] No `clinic_id` exposed in chat bubbles
- [ ] No infinite loading after tool results are already available
- [ ] No empty booking tool parameter parsing errors
- [ ] No long preset text used instead of structured `ui_action` for quick actions
- [ ] Booking tracker is not lost after quick corrections
- [ ] Valid context is preserved after `Change time`, `Change service`, and `Change date`
- [ ] Relevant autocomplete prompt suggestions are shown while typing
- [ ] Default autocomplete prompt suggestions appear even when the composer is empty
- [ ] No multiple scattered assistant bubbles for the same booking turn
- [ ] If an explicit clinic matches exactly one valid clinic, AI continues automatically without re-showing clinic picker cards
- [ ] Clinic cards show enough information for quick decisions: image/logo when available, distance, rating, match reason, starting price, and matched services
- [ ] After `booking_created`, the card includes `View my bookings` and can open booking detail or the bookings tab
- [ ] No encoding errors in assistant-visible booking content
- [ ] No `max iterations reached` loop in the basic booking flow

---

## 8. Pass / Fail Criteria By Layer

### 8.1 Mobile Pass

- Correctly renders cards, chips, and slot grids
- Correctly renders booking tracker, quick actions, and autocomplete suggestions
- Does not reset the flow unexpectedly
- Does not expose technical metadata to the user
- Each booking turn produces one visible assistant response, while secondary updates are merged

### 8.2 AI Service Pass

- Selects tools according to prompt meaning
- Uses a natural tool chain instead of a rigid linear script
- Asks follow-up questions only when truly necessary

### 8.3 Backend Pass

- Returns clinics, services, slots, and bookings in the expected schema
- Does not produce UUID formatting errors
- Does not fail downstream requests in the happy path
- When a clinic hint resolves uniquely, downstream APIs receive the canonical clinic ID

---

## 9. Failure Report Template

Every failure report should include:

- **User prompt / user action**
- **Actual result**
- **Expected result**
- **Screenshot or video**
- **AI service logs**
- **Backend logs**
- **Model in use**
- **Whether GPS was on or off**
- **Whether the session was new or existing**

Short template:

```text
Title: AI asks again for pet even though Hadine was already stated
Prompt: "Book an appointment for Hadine at PetCare this Saturday morning"
Actual: AI replies "Which pet do you want to book for?"
Expected: AI should use Hadine as the target pet and only ask for the next missing field
Model: meta-llama/llama-3.3-70b-instruct
GPS: On
Session: Existing conversation
```

---

## 10. Final Acceptance Outcome

The `Booking with AI` feature is considered E2E-ready when:

1. Users can book from natural prompts without being forced into a rigid form.
2. AI understands the full conversation context.
3. Tool selection is driven by intent and schema, not by hardcoded flow labels.
4. Mobile renders the booking flow through structured events, booking tracker, autocomplete, and quick actions rather than inferring state from raw text.
5. Bookings are created safely without exposing technical metadata or confusing clinic/pet/service selections.
6. Quick corrections after the summary preserve valid context and ask only for the truly missing part.
7. Users can go from `1-2 prompts -> summary / confirm -> booking created -> view my booking` without being pushed back to a wizard-like manual flow when the request is already clear.
