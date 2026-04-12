# DIAGRAM_PROGRESS_CHECKLIST

- Generated date: 2026-04-11
- Source: docs-references/documentation/SDD/PETTIES_SDD.md

## Feature Class Diagram Status

| Feature No | Feature Name | Class Diagram |
|---|---|---|
| 4.1 | Authentication | [x] |
| 4.2 | User Profile Management | [x] |
| 4.3 | Staff and Scheduling Management | [x] |
| 4.4 | Pet Profile Management | [x] |
| 4.5 | Patient Management | [x] |
| 4.6 | EMR & Vaccination Management | [x] |
| 4.7 | Service Management | [x] |
| 4.8 | Chat Management | [x] |
| 4.9 | Booking Review Management | [x] |
| 4.10 | Clinic Management | [x] |
| 4.11 | SOS Booking | [x] |
| 4.12 | Booking Management | [x] |
| 4.13 | SOS Booking - Matching and Tracking | [x] |
| 4.14 | Clinic Discovery Management | [ ] |
| 4.15 | Notification Management | [x] |
| 4.16 | Payment Management | [x] |
| 4.17 | System Management | [x] |
| 4.18 | Report Management | [x] |
| 4.19 | AI Assistant | [x] |

## Function Sequence Diagram Status

| Feature No | Function | Sequence Diagram |
|---|---|---|
| 4.1.2 | User Registration with OTP (UC-PO-01) | [x] |
| 4.1.3 | Login with Username/Password | [x] |
| 4.1.4 | Sign in with Google Account | [x] |
| 4.1.5 | Forgot & Reset Password | [x] |
| 4.1.6 | Logout & Session Management | [x] |
| 4.2.2 | Sequence Diagram: View Profile / Update Profile (UC-PO-03, UC-VT-02, UC-CM-02) | [x] |
| 4.2.3 | Sequence Diagram: Change Password or Change Email (UC-PO-04, UC-VT-03) | [x] |
| 4.3.2 | Invite Staff by Email (UC-CM-03, UC-CO-06) | [x] |
| 4.3.3 | Create Staff Shift (UC-CM-04, UC-CO-07) | [x] |
| 4.3.4 | Delete Shift & Slot Operations | [x] |
| 4.4.2 | Add New Pet Record (UC-PO-04) | [x] |
| 4.4.3 | Update Pet Info (UC-PO-11) | [x] |
| 4.4.4 | Delete Pet (UC-PO-26) | [x] |
| 4.5.2 | View Patient Details (UC-VT-12) | [x] |
| 4.5.3 | View Patient History List (UC-CM-08) | [x] |
| 4.5.4 | View Patient Details (UC-CM-09) | [x] |
| 4.6.2 | View Pet Medical History (Cross-Clinic) (UC-VT-02) | [x] |
| 4.6.3 | Create EMR (SOAP Notes) (EMR-2, UC-VT-06) | [x] |
| 4.6.4 | Create Pet’s Vaccination Record / Update Pet’s Vaccination Record (UC-VT-08) | [x] |
| 4.6.5 | Additional Service & Incurred Costs (UC-VT-10) | [x] |
| 4.6.6 | Create Pet’s Vaccination Record / Update Pet’s Vaccination Record (UC-VT-08) | [x] |
| 4.7.2 | Create Service | [ ] |
| 4.7.3 | Create Master Service | [ ] |
| 4.7.4 | Update Service | [ ] |
| 4.7.5 | Update Master Service | [ ] |
| 4.7.6 | Delete Service | [ ] |
| 4.7.7 | Delete Master Service | [ ] |
| 4.7.8 | View All Service | [ ] |
| 4.7.9 | View All Master Service | [ ] |
| 4.7.10 | View Detail Service | [ ] |
| 4.7.11 | View Detail Master Service | [ ] |
| 4.7.12 | Inheritance Master Service For Clinics | [ ] |
| 4.8.2 | Create Conversation | [ ] |
| 4.8.3 | View All Conversation | [ ] |
| 4.8.4 | View Chat History | [ ] |
| 4.8.5 | Send Message | [ ] |
| 4.8.6 | View Chat History | [ ] |
| 4.8.7 | Create Auto Reply | [ ] |
| 4.8.8 | Update Auto Reply Message | [ ] |
| 4.9.2 | Create Review | [ ] |
| 4.9.3 | Delete Review | [ ] |
| 4.9.4 | Update Review | [ ] |
| 4.9.5 | View Clinic Review | [ ] |
| 4.10.2 | Create Clinic (UC-CO-03) | [x] |
| 4.10.3 | Approve/Reject Clinic (Admin Approval Flow) | [x] |
| 4.10.4 | Upload Clinic Image | [x] |
| 4.11.3 | Sequence Diagram: Start SOS Matching | [x] |
| 4.11.4 | Sequence Diagram: Confirm SOS Request (Accept) | [x] |
| 4.11.5 | Sequence Diagram: Decline & Escalate to Next Clinic | [x] |
| 4.11.6 | Sequence Diagram: Receive SOS alert | [x] |
| 4.11.7 | Sequence Diagram: Cancel SOS Matching | [x] |
| 4.11.8 | Sequence Diagram: Checkout with Custom Fee | [x] |
| 4.11.14 | Mark Treatment Finished (UC-VT-09) | [x] |
| 4.12.0 | API Specification Table | [ ] |
| 4.12.3 | Sequence Diagram: Book an Appointment | [x] |
| 4.12.4 | Sequence Diagram: Book on Behalf | [x] |
| 4.12.5 | Check Staff Availability | [x] |
| 4.12.6 | Reassign Staff | [x] |
| 4.12.7 | Add-on Service During Examination | [x] |
| 4.12.8 | Receive Payment & Checkout (SRS Screen #46, UC-CM-10) | [x] |
| 4.12.9 | Sequence Diagram: View My Bookings and Booking Details (UC-PO-08) | [x] |
| 4.12.10 | Sequence Diagram: Cancel Booking | [x] |
| 4.12.11 | View New Bookings (UC-VT-03) | [x] |
| 4.12.12 | Update Appointment Progress (UC-VT-04) | [x] |
| 4.12.13 | Check-in Patient (UC-VT-05) | [x] |
| 4.12.15 | Handle Cancellations & Refunds (UC-CM-07) | [x] |
| 4.12.16 | Check Staff Availability (UC-CM-14) | [x] |
| 4.12.17 | Reassign Staff to Service (UC-CM-15) | [x] |
| 4.12.18 | Manage Shifts - Delete Shift (UC-CM-16) | [x] |
| 4.12.20 | Sequence Diagram: View New Bookings (Manager) | [x] |
| 4.12.21 | Sequence Diagram: Assign Staff to Booking | [x] |
| 4.12.22 | Sequence Diagram: Reassign Staff | [x] |
| 4.12.23 | Sequence Diagram: Update Booking Progress | [x] |
| 4.12.24 | Sequence Diagram: View New Bookings | [x] |
| 4.12.25 | Sequence Diagram: Add Add-on Services | [x] |
| 4.12.26 | Sequence Diagram: Remove Add-on Services | [x] |
| 4.12.27 | Sequence Diagram: Book an appointment | [x] |
| 4.13.2 | Accept/Decline SOS Request (UC-SOS-10) | [x] |
| 4.13.3 | Request SOS & Auto-Match (UC-SOS-01, UC-SOS-09) | [x] |
| 4.13.4 | SOS Booking – Matching & Real-Time Tracking (UC-SOS-01, UC-SOS-02, UC-PO-15) | [x] |
| 4.13.5 | SOS Escalation & Timeout (UC-SOS-11, UC-SOS-12) | [x] |
| 4.13.6 | Track Staff Location (UC-SOS-02) | [x] |
| 4.13.7 | Staff Move & Start Service (UC-SOS-06, UC-SOS-07) | [x] |
| 4.13.8 | SOS Service Completion & Checkout (UC-SOS-08) | [x] |
| 4.14.2 | Search Nearby Clinics (UC-PO-05) | [x] |
| 4.15.3 | Sequence Diagram: Register FCM Token | [x] |
| 4.15.4 | Sequence Diagram: Send Push Notification | [x] |
| 4.15.8 | Sequence Diagram: SSE Subscription | [x] |
| 4.15.9 | Sequence Diagram: Push Notification via SSE | [x] |
| 4.15.10 | Sequence Diagram: Connection Timeout | [x] |
| 4.16.2 | Create QR payment | [ ] |
| 4.16.3 | View booking payment details | [ ] |
| 4.16.4 | View Payment Transactions History | [ ] |
| 4.16.5 | Process withdrawal transfer | [ ] |
| 4.16.6 | View List Withdraw Request | [ ] |
| 4.16.7 | View Wallet's Clinic | [ ] |
| 4.17.2 | View Platform Statistics | [ ] |
| 4.18.2 | Create Report | [x] |
| 4.18.3 | View My Report | [x] |
| 4.18.4 | Update Report | [x] |
| 4.18.5 | Delete Report | [x] |
| 4.18.6 | View All Report | [x] |
| 4.18.7 | Approve/ Reject Report | [x] |
| 4.19.2 | Sequence Diagram: AI ReAct Loop | [x] |
| 4.19.3 | AI Vision Pet Health Analysis (Planned / Future Design) | [ ] |
| 4.19.5 | Sequence Diagram: AI Vision Analysis to Booking (Planned) | [x] |
| 4.19.6 | WebSocket Message Schemas (Planned) | [ ] |
| 4.19.7 | Severity Mapping to Actions | [ ] |
| 4.19.8 | Overview | [ ] |
| 4.19.11 | Sequence Diagram: Use AI-Assisted Clinic Setup, Operation Flow | [x] |
| 4.19.12 | API Endpoints | [ ] |
| 4.19.13 | Database Schema Additions | [ ] |
| 4.19.14 | Role-Based AI Chat Context Isolation | [ ] |
| 4.19.17 | Sequence Diagram: Business AI Chat Session Flow | [x] |
| 4.19.18 | Sequence Diagram: Admin Playground Test Flow | [x] |
| 4.19.19 | MongoDB Document Model for AI Session Isolation | [x] |
| 4.19.21 | Sequence Diagram: Interact with ChatBot - Guided Booking (Interactive Components) | [x] |
| 4.19.22 | View aggregate feedback stats / Provide AI's Response Feedback / View Case Memory / Delete Case Memory | [ ] |
| 4.19.23 | Interact with ChatBot - Booking Tool Orchestration | [ ] |
| 4.19.24 | Use AI Diagnostic Support (Staff) | [ ] |
| 4.19.25 | Use Summarize pet's EMR | [ ] |
| 4.19.26 | Use Summarize patient info & EMR | [ ] |
| 4.19.27 | Use AI Diagnostic Support - Historical Sync Note | [x] |
| 4.19.28 | Use AI-Assisted Clinic Setup, Operation | [x] |

## Summary

- Feature class diagram: 18/19
- Function sequence diagram: 82/124
