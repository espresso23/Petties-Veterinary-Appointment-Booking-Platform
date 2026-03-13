# System Test Guide

## 1. Introduction
This document provides guidelines and templates for conducting System Testing for the Petties project - a Veterinary Appointment Booking Platform.
System Testing focuses on simulating real End-to-End user flows on both Web and Mobile platforms, ensuring the system meets the Business Requirements properly.

## 2. Testing Scope
Based on the current project status, the following business flows have been completed (✅) and are ready for system testing:

*   **User & Account Management:** Login, Registration, Profile Update for all roles (Pet Owner, Clinic Staff, Clinic Manager, Admin).
*   **Pet Management:** Create, edit, and delete pet profiles by Pet Owners.
*   **Booking Management:** 
    *   Pet Owners creating new appointments.
    *   Staff/Managers viewing, confirming, or rejecting appointments.
    *   Staff updating appointment statuses (PENDING -> CONFIRMED -> IN_PROGRESS -> COMPLETED).
    *   Cancelling appointments.
*   **AI Assistant Integration:**
    *   Advising on general pet care knowledge.
    *   Context-aware automated booking consultation.
    *   Submitting SOS cases / Querying the Knowledge Graph.

## 3. Distinguishing System Test and Unit Test
*   **Unit Test:** (Programming Level) Written by Developers to test individual functions/methods in isolation. Runs in the background within the codebase.
*   **System Test (This Document):** (User Level) Written and executed by QA/Testers. Simulates clicking and typing actions of end-users on the Web or Mobile App UI. Verifies screen outputs and corresponding data changes at the endpoints.

## 4. Test Report File Structure

### 4.1 Test Planning Template (Index/Summary)
Mẫu này dùng để tổng hợp danh sách các chức năng cần test trong hệ thống (thường là trang đầu tiên của file test):

| Column | Description |
| :--- | :--- |
| **No** | Số thứ tự. |
| **Function Name** | Tên chức năng (Feature Name). |
| **Sheet Name** | Tên Sheet tương ứng chứa chi tiết các Test Case. |
| **Description** | Mô tả ngắn gọn về chức năng. |
| **Pre-Condition** | Điều kiện tiên quyết chung cho toàn bộ chức năng. |

### 4.2 Detailed Test Case Template
Mẫu chi tiết cho từng Test Case trong các sheet cụ thể:

| Column | Description |
| :--- | :--- |
| **Test Case ID** | A unique identifier for the test scenario (e.g., TC_SYS_BKG_01). |
| **Test Case Description** | A brief description of the scenario's objective; what is being tested. |
| **Test Case Procedure** | Step-by-step instructions (Step 1, Step 2...). Must be clear and unambiguous. |
| **Expected Results** | The anticipated UI outcome (e.g., Toast message displaying, screen redirection). *Note: UI Text MUST be in Vietnamese according to Petties Rules.* |
| **Pre-conditions** | Prerequisites that must be met BEFORE executing the test (e.g., Account is logged in, Pet is created). |
| **Round 1/2/3 Status** | The Pass/Fail/Pending status of each testing round. |
| **Test date** | Execution date. |
| **Tester** | Name of the person conducting the test. |
| **Note (Actual Result & Bug ID)** | The field to document actual outcomes if the test FAILS, including the Bug ticket Link/ID. |

## 5. Diverse Coverage Requirement (Important)
System Test cases **MUST NOT ONLY** cover the "Happy Path" (successful workflows). To ensure system robustness, test authors must strictly include:
1. **Negative Test Cases:** Inputting invalid data (e.g., wrong email format, wrong password, date in the past).
2. **Boundary/Edge Cases:** Exceeding maximum lengths, empty mandatory fields, booking fully booked timeslots, or testing timezone boundaries.
3. **Cancellation & Rollback Cases:** Cancelling an action halfway and ensuring no junk data is saved.
4. **Validation Behaviors:** Checking that proper Vietnamese validation strings display correctly without crashing the app.

## 6. Important Rules (Petties Rules)
*   **Vietnamese-Only UI (100% Vietnamese Rule):** All "Expected Results" related to UI messages, buttons, and validation errors MUST be described in Vietnamese within the Test Report file.
*   **Role-Platform Matrix:**
    *   Pet Owners ONLY test on the Mobile App.
    *   Clinic Managers / Admins ONLY test on the Web.
    *   Staff test on both Web and Mobile.
*   **No Browser Native Dialog Rule:** The system strictly prohibits using `window.alert`. Therefore, in Expected Results, use "Display Toast message" or "Display Confirmation Modal", NOT "Display Browser Popup".

## 6. Sample Workflow

**Feature: Booking Management**
1. **Pre-condition:** Prepare 1 Pet Owner account (Mobile) and 1 Staff account (Web).
2. **Execute TC_SYS_BKG_01:** Pet Owner (Mobile) selects a Clinic, Date/Time, Pet, and creates an appointment. Verify the Toast message "Đặt lịch thành công".
3. **Execute TC_SYS_BKG_03:** Staff (Web) opens "Quản lý lịch hẹn", switches to "Chờ xác nhận" tab. Verify that the newly created appointment appears.
4. **Execute TC_SYS_BKG_04:** Staff (Web) clicks "Xác nhận". Verify the status changes to CONFIRMED and the corresponding Toast message appears.

*(Please refer to the specific CSV Test Report file for a complete list of Test Cases across all modules).*
