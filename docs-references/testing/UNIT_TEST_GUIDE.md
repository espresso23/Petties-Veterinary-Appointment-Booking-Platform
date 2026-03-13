# Unit Test Guide (Decision Table Format)

## 1. Introduction
This document provides guidelines and a structural template for writing **Unit Test Reports** for the Petties project.
Unlike System Tests (which test End-to-End user flows), Unit Tests focus on specific functions or methods within the codebase (e.g., Spring Boot Services or Controllers, AI Service functions).

This guide uses the **Decision Table (Condition-Action Matrix)** approach. This is a highly professional white-box testing methodology that ensures 100% logic coverage by mapping every possible combination of input conditions to their expected system outputs.

## 2. Advantages of the Decision Table Format
*   **Complete Coverage:** Forces the developer/tester to list all logical edge cases (e.g., Unauthorized access, Invalid GPS data, Missing parameters) that might be missed in textual descriptions.
*   **Clear Traceability:** Uses binary indicators (usually `0` or `X`) to show exactly which conditions correspond to which outcomes, eliminating ambiguity.
*   **Code Alignment:** Mimics the `if/else` control flow of the actual code, making it easy to map a test case ID (e.g., UTCID01) directly to a JUnit or Pytest function name.

## 3. The Report Structure

The Unit Test Decision Table is divided into three main sections:

### A. Header Information (Metadata)
Captures the context of the test suite.
*   **Function Code / Name:** The specific service method or API endpoint being tested (e.g., `Track Staff Location`, `createBooking`).
*   **Created By / Executed By:** The developer/tester responsible.
*   **Lines of Code (LOC):** The size of the function being tested.
*   **Test Requirement:** A brief description of what the function is supposed to validate or accomplish.
*   **Overview Stats:** Counts of Passed, Failed, Untested, and Total Test Cases.

### B. Matrix Body (Conditions & Actions)
The grid where test scenarios are designed. Each column from left to right represents a single Test Case (UTCID01, UTCID02, etc.).

*   **Condition (Input):** The states or inputs fed into the function.
    *   *Precondition:* E.g., "GPS / WebSocket Connected", "Staff Assigned to Booking".
    *   *Staff/User Action:* E.g., "Send Valid GPS", "Unauthorized Staff ID".
    *   *Logic/Thresholds:* E.g., "Distance < 0.5km".
*   **Confirm/Return (Output):** The expected behavior of the system based on the active conditions above.
    *   *Return State:* E.g., "Broadcast to WebSocket", "Status 200 HTTP".
    *   *Exception:* E.g., "Exception (403/Forbidden)", "Throws NullPointerException".

*Note: In the matrix, mark a cell with `0` or `X` if that condition applies to the specific test case column. If the cell is empty, the condition is False or N/A.*

### C. Result Summary (Footer)
Records the outcome of the execution.
*   **Type:** Categorize the test case. Common codes:
    *   `N` (Normal / Happy Path)
    *   `A` (Abnormal / Exception Path)
    *   `B` (Boundary / Edge Case)
*   **Passed / Failed:** `P` (Pass) or `F` (Fail).
*   **Executed Date:** When the script was run.

## 4. How to Use the CSV Template
A `.csv` template mirroring this structure is provided alongside this guide (`_SEP490_SP26_Report5_Unit_Test_Template.csv`).

1.  **Open in Excel/Google Sheets:** The CSV format is best viewed and edited in a spreadsheet application so the grid layout is preserved.
2.  **Define Conditions:** List all possible inputs and logic branches for your function in the left-most column.
3.  **Define Expected Returns:** List all possible outputs, status codes, and exceptions.
4.  **Create Test Cases (Columns):** For each UTCID column, place a `0` (or `X`) in the relevant Condition rows, and then place a `0` in the corresponding Return/Exception rows that should result from those conditions.
5.  **Execute & Record:** Run your JUnit/Pytest scripts, compare the results against the matrix, and fill out the Result footer (P/F).

## 5. Connecting back to Code (Petties standard)
When implementing the actual code for these tests in the repository (e.g., `backend-spring/petties/src/test/...`), name your test methods to reflect the Matrix.

*Example matching UTCID01 in the image:*
```java
@Test
@DisplayName("UTCID01 - Track Staff Location: Success when Valid GPS and Connected")
void testTrackLocation_ValidGps_BroadcastsToWebSocket() {
   // Implementation
}
```
This ensures perfect alignment between documentation and codebase.
