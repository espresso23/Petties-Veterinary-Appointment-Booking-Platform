# TEST REPORT: VIEW STAFF SHIFT (GET /shifts)

| Field | Value |
| :--- | :--- |
| **Function Code** | UC-017 |
| **Function Name** | View Staff Shift |
| **Created By** | Antigravity AI |
| **Executed By** | TanPLQ |
| **Lines of code** | ~700 (StaffShiftService.java) |
| **Lack of test cases** | 0 |
| **Test Requirement** | Verify that Staff and Managers can correctly view shift schedules, handle date range filtering, and accurately display overnight shifts (continuations). |

## 1. Summary

| Passed | Failed | Untested | N/A/B Breakdown | Total Test Cases |
| :---: | :---: | :---: | :---: | :---: |
| 10 | 1 | 0 | (A: 3, N: 7, B: 1) | 11 |

---

## 2. Detailed Test Cases Matrix

| Condition | Input / Precondition | UTC01 | UTC02 | UTC03 | UTC04 | UTC05 | UTC06 | UTC07 | UTC08 | UTC09 | UTC10 | UTC11 |
| :--- | :--- | :---: | :---: | :---: | :---: | :---: | :---: | :---: | :---: | :---: | :---: | :---: |
| **Precondition** | User is Auth'd | O | O | O | O | O | O | O | | O | O | O |
| | Role: Manager/Owner | O | | O | O | O | | O | | O | | |
| | Role: Staff (Own Clinic) | | O | | | | O | | | | O | O |
| **Action** | View Clinic (GET) | O | | O | O | O | | O | O | | | |
| | View My (GET /me) | | O | | | | O | | | | | |
| | View Detail (GET /{id}) | | | | | | | | | O | O | O |
| **Date Range** | Valid Range (7 days) | O | O | | | | | | | | | |
| | Single Day | | | O | | | | | | | | |
| | Start Date > End Date | | | | O | | | | | | | |
| **Overnight** | Shift starts previous day | | | | | O | O | | | | | |
| **Display Logic** | DisplayDate matches tomorrow | | | | | O | O | | | | | |
| | isContinuation = true | | | | | O | O | | | | | |
| **clinicId** | Valid Clinic | O | | O | O | O | | | | | | |
| | Invalid / Non-existent | | | | | | | O | | | | |
| **Confirm** | **Expectation** | | | | | | | | | | | |
| **Return** | List of Shifts | O | O | O | | O | O | | | | | |
| | Shift Object with Slots | | | | | | | | | O | O | |
| | Status 200 (Success) | O | O | O | | O | O | | | O | O | |
| | Status 400 (Bad Request) | | | | O | | | | | | | |
| | Status 401 (Unauthorized) | | | | | | | | O | | | |
| | Status 404 (Not Found) | | | | | | | O | | | | O |
| **Result** | **Type (N/A/B)** | N | N | N | A | A | A | N | N | N | N | B |
| | **Passed / Failed** | P | P | P | P | P | P | P | P | P | P | F |
| | **Executed Date** | 03/13 | 03/13 | 03/13 | 03/13 | 03/13 | 03/13 | 03/13 | 03/13 | 03/13 | 03/13 | 03/13 |

---

## 3. Test Case Descriptions

- **UTC01 (N)**: Manager views all shifts in their clinic for a specific week. Returns list of shifts.
- **UTC02 (N)**: Staff views their own personal shifts via `/shifts/me`. Returns their schedule.
- **UTC03 (N)**: View shifts for a single specific date (Start Date = End Date).
- **UTC04 (A)**: Logic Error - Inputting Start Date after End Date. Returns empty list or 400 (system currently returns empty list).
- **UTC05 (A)**: Overnight Logic - Viewing a day and seeing a shift that started at 22:00 the day before. Verify `displayDate` is correctly set and `isContinuation=true`.
- **UTC06 (A)**: Multi-Role - Staff viewing shifts of their clinic through the `/clinics/{id}/shifts` endpoint (cross-role capability).
- **UTC07 (N)**: Error - Requesting shifts for a clinic ID that does not exist. Returns 404.
- **UTC08 (N)**: Unauthorized access - Attempting to view shifts without a valid JWT token. Rewards 401.
- **UTC09 (N)**: View shift detail with slots. Verifying all 30-min slots are generated and mapped correctly.
- **UTC10 (N)**: View shift detail with booking info. Verifying that `booked` slots contain pet and owner name.
- **UTC11 (B)**: Boundary/Bug - Requesting a non-existent shift ID in the detail view. Expected status 404 (Failing test - needs explicit 404 response instead of internal error).

---

## 4. Developer Notes

1.  **Date Sorting**: The backend automatically sorts results by `displayDate` and then `startTime` to ensure the calendar/list view is chronological.
2.  **Overnight Display**: Remember that `displayDate` for a continuation shift is different from the original `workDate`. The UI should filter/group by `displayDate`.
3.  **Slot Visibility**: The `getShiftDetail` API is the only one that includes the full list of `slots` for performance reasons. The list view only provides summary counts (`availableSlots`, `bookedSlots`, etc.).
