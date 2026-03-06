# PETTIES - Software Requirements Specification (SRS)

**Project:** Petties - Veterinary Appointment Booking Platform
**Version:** 2.2.0 (Added Section 3.7 Staff and Scheduling Management - 8 functions documented)
**Last Updated:** 2026-03-06
**Document Status:** In Progress

---

## Table of Contents

1. [Product Overview](#1-product-overview)
2. [User Requirements](#2-user-requirements)
    - [2.3 Use Case Implementation Status Reference](#23-use-case-implementation-status-reference)
3. [Functional Requirements (Screen Flow)](#3-functional-requirements)
    - [3.2 Authentication & Onboarding](#32-authentication--onboarding)
    - [3.3 User Profile & Account Setup](#33-user-profile--account-setup)
    - [3.4 Pet Records & Health Hub](#34-pet-records--health-hub)
    - [3.5 Clinic Discovery Flow](#35-clinic-discovery-flow)
    - [3.6 Clinical Operations & Service Setup](#36-clinical-operations--service-setup)
    - [3.7 Staffing & Scheduling Flow](#37-staffing--scheduling-flow)
    - [3.8 Booking & Appointment Lifecycle Flow](#38-booking--appointment-lifecycle-flow)
    - [3.9 Electronic Medical Records (EMR) Flow](#39-electronic-medical-records-emr-flow)
    - [3.10 Specialized Services (SOS Emergency) Flow](#310-specialized-services-sos-emergency-flow)
    - [3.11 AI Assistance Flow](#311-ai-assistance-flow)
    - [3.12 Governance & Reporting Flow](#312-governance--reporting-flow)
    - [3.13 Clinic Setup AI Agent Flow](#313-clinic-setup-ai-agent-flow)
4. [Non-Functional Requirements](#5-non-functional-requirements)
5. [Requirement Appendix](#6-requirement-appendix)

---

## 1. PRODUCT OVERVIEW

### 1.1 Product Purpose

**Petties** là nền tảng kết nối chủ thú cưng (Pet Owner) với các phòng khám thú y (Veterinary Clinics). Hệ thống cho phép:

- 🐾 Chủ pet đặt lịch khám tại phòng khám hoặc tại nhà
- 🏥 Phòng khám quản lý dịch vụ, nhân viên, lịch làm việc
- 👨‍⚕️ Nhân viên quản lý ca làm, khám bệnh, ghi hồ sơ y tế
- 🤖 AI Chatbot hỗ trợ tư vấn chăm sóc thú cưng
- 📊 Admin quản lý toàn bộ nền tảng

### 1.2 Product Scope

| Aspect | Description |
|--------|-------------|
| **Platform** | Web (Admin, Clinic), Mobile (Pet Owner, Staff) |
| **Target Users** | Pet Owners, Veterinary Clinics, Staff, Admins |
| **Geography** | Vietnam (initial), Southeast Asia (future) |
| **Timeline** | 13 Sprints (10/12/2025 - 11/03/2026) |

### 1.3 Intended Audience

| Audience | Description |
|----------|-------------|
| Developers | Xây dựng và bảo trì hệ thống |
| QA/Testers | Kiểm tra chức năng và chất lượng |
| Product Owners | Theo dõi và ưu tiên requirements |
| Stakeholders | Đánh giá tính khả thi và business value |

### 1.4 Product Overview Diagram (Context Diagram)

```mermaid
flowchart TB
    PO["🐾 Pet Owner<br/>(Mobile)"]
    STAFF["👨‍⚕️ Staff<br/>(Mobile + Web)"]
    CM["👨‍💼 Clinic Manager<br/>(Web)"]
    CO["🏥 Clinic Owner<br/>(Web)"]
    ADMIN["🔧 Admin<br/>(Web)"]
    
    SYSTEM(("🐾 Petties<br/>System"))
    
    %% Pet Owner flows
    PO -->|"Register, Login, Profile Update"| SYSTEM
    PO -->|"Pet Profile (View EMR + Vaccination)"| SYSTEM
    PO -->|"Search Clinic, Create Booking"| SYSTEM
    PO -->|"Payment (Stripe)"| SYSTEM
    PO -->|"Review, AI Chat, Report Violation"| SYSTEM
    SYSTEM -->|"Booking Confirmation, Notifications"| PO
    SYSTEM -->|"Pet Profile (EMR + Vaccination Records)"| PO
    
    %% Staff flows
    STAFF -->|"Login, View Schedule"| SYSTEM
    STAFF -->|"View Assigned Bookings"| SYSTEM
    STAFF -->|"Check-in, Create/Edit EMR"| SYSTEM
    STAFF -->|"Add/Edit Vaccination, Check-out"| SYSTEM
    SYSTEM -->|"Assigned Bookings, Schedules"| STAFF
    SYSTEM -->|"Pet Profile (EMR + Vaccination, READ-ONLY cross-clinic)"| STAFF
    
    %% Clinic Manager flows
    CM -->|"Add/Remove Staff"| SYSTEM
    CM -->|"Create Staff Schedule"| SYSTEM
    CM -->|"Assign Staff to Booking"| SYSTEM
    SYSTEM -->|"Staff List, Booking List/Pending Bookings"| CM
    SYSTEM -->|"Schedule Overview"| CM
    
    %% Clinic Owner flows
    CO -->|"Register Clinic"| SYSTEM
    CO -->|"Manage Master Services (Templates + Weight Tiers)"| SYSTEM
    CO -->|"Configure Clinic Services (Inherit or Custom)"| SYSTEM
    CO -->|"Add Clinic Manager"| SYSTEM
    SYSTEM -->|"Clinic Status, Revenue Report"| CO
    SYSTEM -->|"Dashboard Analytics"| CO
    
    %% Admin flows
    ADMIN -->|"Login, Approve/Reject Clinic"| SYSTEM
    ADMIN -->|"Configure AI Agents"| SYSTEM
    ADMIN -->|"Manage Knowledge Base, Process Reports"| SYSTEM
    SYSTEM -->|"Pending Clinics, Platform Stats"| ADMIN
    SYSTEM -->|"User Reports, Agent Status"| ADMIN
```

### 1.5 System Architecture Overview

```mermaid
graph TB
    subgraph "Client Layer"
        WEB["petties-web<br/>(React + Vite)"]
        MOBILE["petties_mobile<br/>(Flutter)"]
    end
    
    subgraph "Backend Services"
        SPRING["backend-spring<br/>(Spring Boot)"]
        AI["petties-agent-service<br/>(FastAPI + LangGraph)"]
    end
    
    subgraph "Data Layer"
        PG[(PostgreSQL)]
        MONGO[(MongoDB)]
        REDIS[(Redis)]
        QDRANT[(Qdrant Cloud)]
    end
    
    WEB --> SPRING
    WEB --> AI
    MOBILE --> SPRING
    MOBILE --> AI
    SPRING --> PG
    SPRING --> MONGO
    SPRING --> REDIS
    AI --> PG
    AI --> QDRANT
```

---

## 2. USER REQUIREMENTS

### 2.1 User Roles

| Role | Platform | Description |
|------|----------|-------------|
| **PET_OWNER** | Mobile only | Chủ thú cưng, đặt lịch khám, xem hồ sơ y tế |
| **STAFF** | Mobile + Web | Nhân viên phòng khám (Nhân viên, Groomer, Lễ tân). Có chuyên môn cụ thể (`specialty`). |
| **CLINIC_MANAGER** | Web only | Quản lý phòng khám, gán booking cho nhân viên |
| **CLINIC_OWNER** | Web only | Chủ phòng khám, quản lý dịch vụ, doanh thu |
| **ADMIN** | Web only | Admin nền tảng, duyệt phòng khám, quản lý AI |

### 2.2 Use Cases (Organized by Feature Module)

> **Approach:** Trình bày đúng theo bảng **Feature - Function** đã thống nhất, không hiển thị trạng thái.

| Feature | Function |
|---|---|
| Authentication | Register Account |
| Authentication | Login |
| Authentication | Login by Google |
| Authentication | Logout |
| Authentication | Forgot Password |
| Authentication | Reset Password |
| User Profile Management | View Profile |
| User Profile Management | Update Profile |
| User Profile Management | View Staff's Profile |
| User Profile Management | Update Staff's Profile |
| Staff and Scheduling Management | Add Staff |
| Staff and Scheduling Management | Delete Staff |
| Staff and Scheduling Management | View List of Staffs |
| Staff and Scheduling Management | View Own Work Schedule |
| Staff and Scheduling Management | View Staff Shift |
| Staff and Scheduling Management | Create Staff Shift |
| Staff and Scheduling Management | Edit Staff Shift |
| Staff and Scheduling Management | Delete Staff Shift |
| Pet Profile Management | View Pet Profile |
| Pet Profile Management | Create Pet Profile |
| Pet Profile Management | Edit Pet Profile |
| Pet Profile Management | Delete Pet Profile |
| Patient Management | View Patient History List |
| Patient Management | View Patient Details |
| EMR & Vaccination Management | View Pet’s Medical Record |
| EMR & Vaccination Management | Update Pet’s Medical Record |
| EMR & Vaccination Management | Create Pet’s Medical Record |
| EMR & Vaccination Management | View Pet’s Vaccination Record |
| EMR & Vaccination Management | Update Pet’s Vaccination Record |
| EMR & Vaccination Management | Create Pet’s Vaccination Record |
| EMR & Vaccination Management | Receive Medication Reminders |
| Service Management | Create Service |
| Service Management | Create Master Service |
| Service Management | Update Service |
| Service Management | Update Master Service |
| Service Management | Delete Service |
| Service Management | Delete Master Service |
| Service Management | View All Service |
| Service Management | View All Master Service |
| Service Management | View Detail Service |
| Service Management | View Detail Master Service |
| Service Management | Inheritance Master Service For Clinics |
| Chat Management | Create Conversation |
| Chat Management | View All Coversation |
| Chat Management | Delete Message |
| Chat Management | Send Message |
| Chat Management | View Chat History |
| Chat Management | Create Auto Reply |
| Chat Management | Update Auto Reply Message |
| Booking Review Management | Create Review |
| Booking Review Management | Delete Review |
| Booking Review Management | Update Review |
| Booking Review Management | View Clinic Review |
| Clinic Management | View Clinic Details |
| Clinic Management | Create Clinic |
| Clinic Management | View Clinic |
| Clinic Management | Delete Clinic |
| Clinic Management | Update Clinic |
| Clinic Management | View clinic pending list |
| Clinic Management | Approve/Reject Clinic |
| Clinic Management | Active/ Suspend Clinic |
| Clinic Management | View Clinic Statistics |
| Booking Management | Book an appointment |
| Booking Management | Book on behalf |
| Booking Management | View my booking |
| Booking Management | View booking history |
| Booking Management | Cancel booking |
| Booking Management | Create SOS Booking |
| Booking Management | Track Staff location |
| Booking Management | Reassign Staff |
| Booking Management | Assign Staff to Booking |
| Booking Management | Check-in Patient |
| Booking Management | Check-out Patient |
| Booking Management | View New Bookings |
| Clinic Discovery Management | View Clinic On Map |
| Clinic Discovery Management | Search clinics |
| Clinic Discovery Management | View Clinic's List |
| Clinic Discovery Management | Filter and Sort |
| Clinic Discovery Management | View Clinic Details |
| Notification Management | Update Notification |
| Notification Management | View Notification |
| Notification Management | Create Notification |
| Notification Management | Delete Notification |
| Payment Management | Create QR Payment |
| Payment Management | View Invoice |
| Payment Management | View Payment Transactions History |
| Payment Management | Process Withdraw |
| Payment Management | View List Withdraw request |
| Payment Management | View wallet's clinic |
| System Management | View platform statistics |
| Report Management | Create Report Clinic |
| Report Management | Create Report Pet Owner |
| Report Management | View All Report |
| Report Management | Active/Suspend Report |
| AI Assistant | Ask ChatBot To Pet Care |
| AI Assistant | Booking With ChatBot |
| AI Assistant | Config Agent Parameter |
| AI Assistant | Test Agent Playground |
| AI Assistant | Turn On/Off Agent Tools |
| AI Assistant | Upload Document To Knowledge Base |

---

### 2.3 Use Case Implementation Status Reference

> **Legend:** ✅ Implemented | 🔄 In Progress | ❌ Not Started | 📋 Documented in SRS

#### Authentication & Account Management

| # | Use Case | UC-ID | SRS Ref | Backend | Frontend | Status |
|---|----------|-------|---------|---------|----------|--------|
| 1 | Register Account | UC-PO-01 | 3.2.1 | ✅ AuthController | ✅ Mobile | ✅ Done |
| 2 | Login | UC-PO-01a | 3.2.2 | ✅ AuthController | ✅ Mobile/Web | ✅ Done |
| 3 | Login by Google | UC-PO-02 | 3.2.2 | ✅ AuthController | ✅ Mobile/Web | ✅ Done |
| 4 | Forgot password | UC-PO-01b | 3.2.3 | ✅ AuthController | ✅ Mobile/Web | ✅ Done |
| 5 | Logout | UC-PO-01c | 3.2.4 | ✅ AuthController | ✅ Mobile/Web | ✅ Done |
| 6 | View profile | UC-PO-03 | 3.3.1 | ✅ UserController | ✅ Mobile/Web | ✅ Done |
| 7 | Edit information | UC-PO-03 | 3.3.1 | ✅ UserController | ✅ Mobile/Web | ✅ Done |
| 8 | Reset password | UC-PO-03d | 3.3.2 | ✅ UserController | ✅ Mobile/Web | ✅ Done |
| 9 | View landing page | - | - | N/A | ✅ Web | ✅ Done |

#### User & Notification Management

| # | Use Case | UC-ID | SRS Ref | Backend | Frontend | Status |
|---|----------|-------|---------|---------|----------|--------|
| 10 | View notification | - | - | ✅ NotificationController | ✅ Mobile/Web | ✅ Done |
| 11 | Receive Notification | - | - | ✅ FCM/SSE | ✅ Mobile/Web | ✅ Done |
| 12 | View user account | - | - | ✅ UserController | ✅ Web | ✅ Done |
| 13 | Create notification | - | - | ✅ NotificationService | ❌ | 🔄 Backend Only |
| 14 | Delete notification | - | - | ❌ | ❌ | ❌ Not Started |
| 109 | Cancel Email Change Request | UC-PROFILE-04 | 2.2.2 | ✅ UserController | ✅ Mobile | ✅ Done |
| 110 | Send FCM Push Notification | UC-NOTIF-01 | 2.2.11 | ✅ FcmController | ✅ Mobile | ✅ Done |
| 111 | Subscribe FCM Topic | UC-NOTIF-02 | 2.2.11 | ✅ FcmService | ✅ Mobile | ✅ Done |
| 112 | SSE Real-time Events | UC-NOTIF-03 | 2.2.11 | ✅ SseController | ✅ Web | ✅ Done |

#### Pet Management

| # | Use Case | UC-ID | SRS Ref | Backend | Frontend | Status |
|---|----------|-------|---------|---------|----------|--------|
| 15 | View Pet Profile | UC-PO-04 | 3.4.1 | ✅ PetController | ✅ Mobile | ✅ Done |
| 16 | Create Pet Profile | UC-PO-04 | 3.4.1 | ✅ PetController | ✅ Mobile | ✅ Done |
| 17 | Edit Pet Profile | UC-PO-04 | 3.4.2 | ✅ PetController | ✅ Mobile | ✅ Done |
| 18 | Delete Pet Profile | UC-PO-04 | 3.4.2 | ✅ PetController | ✅ Mobile | ✅ Done |
| 19 | View Pet vaccination records | UC-PO-12 | 3.4.3 | ✅ VaccinationController | ✅ Mobile | ✅ Done |
| 20 | View medical records | UC-PO-11 | 3.4.3 | ✅ EmrController | ✅ Mobile | ✅ Done |
| 94 | Update Pet Allergies | UC-PO-21 | - | ✅ PetController | ✅ Mobile | ✅ Done |
| 95 | Update Pet Weight | UC-PO-22 | - | ✅ PetController | ✅ Mobile | ✅ Done |

#### Clinic Discovery & Booking

| # | Use Case | UC-ID | SRS Ref | Backend | Frontend | Status |
|---|----------|-------|---------|---------|----------|--------|
| 21 | View Clinic's List | UC-PO-05 | 3.5.1 | ✅ ClinicController | ✅ Mobile/Web | ✅ Done |
| 22 | Search clinics | UC-PO-05 | 3.5.1 | ✅ ClinicController | ✅ Mobile | ✅ Done |
| 23 | View Clinic Details | UC-PO-05b | 3.5.2 | ✅ ClinicController | ✅ Mobile | ✅ Done |
| 24 | View Clinic On Map | - | - | ✅ ClinicController | ✅ Mobile | ✅ Done |
| 25 | Book an appointment | UC-PO-06 | 3.8.1 | ✅ BookingController | ✅ Mobile | ✅ Done |
| 26 | SOS Booking | UC-PO-15 | 3.10.1 | ✅ SosController | ✅ Mobile | ✅ Done |
| 27 | Receive SOS Alert | UC-CM-20 | 3.10.4 | ✅ SosController | ✅ Web | ✅ Done |
| 28 | Confirm/Decline SOS Request | UC-CM-20 | 3.10.4 | ✅ SosController | ✅ Web | ✅ Done |
| 29 | Track Staff location | UC-PO-17 | 3.10.2 | ✅ BookingController | ✅ Mobile | ✅ Done |
| 30 | Cancel SOS Matching | UC-PO-18 | 3.10.5 | ✅ SosController | ✅ Mobile | ✅ Done |
| 31 | Checkout with Custom SOS Fee | UC-CM-21 | 3.10.6 | ✅ BookingController | ✅ Web | ✅ Done |
| 32 | Cancel Booking | UC-PO-09 | - | ✅ BookingController | ✅ Mobile | ✅ Done |
| 33 | Make payment | UC-PO-10 | 3.8.2 | 🔄 Stripe Integration | ❌ | 🔄 In Progress |
| 34 | View invoice | - | - | ❌ | ❌ | ❌ Not Started |
| 35 | Receive medication reminders | - | - | ❌ | ❌ | ❌ Not Started |
| 96 | Clinic Geocode | UC-CO-09 | - | ✅ ClinicController | ✅ Web | ✅ Done |
| 97 | Clinic Distance Calculation | UC-CO-10 | - | ✅ ClinicController | ✅ Mobile | ✅ Done |

#### AI Assistant

| # | Use Case | UC-ID | SRS Ref | Backend | Frontend | Status |
|---|----------|-------|---------|---------|----------|--------|
| 36 | Booking With ChatBot | UC-PO-14c | 3.11.1 | ✅ Agent Service | ✅ Mobile | ✅ Done |
| 37 | Ask ChatBot To Pet Care | UC-PO-14a | 3.11.1 | ✅ Agent Service | ✅ Mobile | ✅ Done |
| 38 | Chat | UC-PO-14d | 3.11.2 | ✅ ChatController | ✅ Mobile | ✅ Done |
| 98 | Real-time Chat WebSocket | UC-PO-20 | - | ✅ ChatWebSocketController | ✅ Mobile/Web | ✅ Done |
| 99 | Chat Images Gallery | UC-PO-23 | - | ✅ ChatController | ✅ Mobile | ✅ Done |

#### Rating & Reporting

| # | Use Case | UC-ID | SRS Ref | Backend | Frontend | Status |
|---|----------|-------|---------|---------|----------|--------|
| 39 | Rate and review vet | UC-PO-13 | - | ❌ | ❌ | ❌ Not Started |
| 40 | Report clinic, vet | UC-PO-16 | 3.12.1 | ❌ | ❌ | 📋 Documented |

#### Admin Functions

| # | Use Case | UC-ID | SRS Ref | Backend | Frontend | Status |
|---|----------|-------|---------|---------|----------|--------|
| 41 | View list of pending clinics | UC-AD-02 | 3.6.2 | ✅ ClinicController | ✅ Web | ✅ Done |
| 42 | Approve/ Reject clinic | UC-AD-03 | 3.6.2 | ✅ ClinicController | ✅ Web | ✅ Done |
| 43 | View platform statistics | UC-AD-04 | - | ❌ | ❌ | ❌ Not Started |
| 44 | View revenue | UC-CO-05 | - | ❌ | ❌ | ❌ Not Started |
| 45 | View policy | - | - | ❌ | ❌ | ❌ Not Started |
| 46 | Update policy | - | - | ❌ | ❌ | ❌ Not Started |
| 47 | Upload Document To Knowledge Base | UC-AD-06 | - | ✅ Agent Service | ✅ Web | ✅ Done |
| 48 | Accept/ Reject User Reports | UC-AD-09 | - | ❌ | ❌ | ❌ Not Started |
| 49 | View User Report | UC-AD-08 | - | ❌ | ❌ | ❌ Not Started |
| 50 | Turn On/Off Agent Tools | UC-AD-05 | - | ✅ Agent Service | ✅ Web | ✅ Done |
| 51 | Config Agent Parameter | UC-AD-05 | - | ✅ Agent Service | ✅ Web | ✅ Done |
| 52 | Test Agent Playground | UC-AD-07 | - | ✅ Agent Service | ✅ Web | ✅ Done |
| 100 | SSE Real-time Notifications | UC-AD-10 | - | ✅ SseController | ✅ Web | ✅ Done |

#### Clinic Owner Functions

| # | Use Case | UC-ID | SRS Ref | Backend | Frontend | Status |
|---|----------|-------|---------|---------|----------|--------|
| 49 | Register Clinic | UC-CO-01 | 3.6.1 | ✅ ClinicController | ✅ Web | ✅ Done |
| 50 | Edit Clinic | UC-CO-02 | - | ✅ ClinicController | ✅ Web | ✅ Done |
| 51 | Create Clinic Service | UC-CO-03 | - | ✅ ClinicServiceController | ✅ Web | ✅ Done |
| 52 | Update Clinic Service | UC-CO-03 | - | ✅ ClinicServiceController | ✅ Web | ✅ Done |
| 53 | Delete Clinic Service | UC-CO-03 | - | ✅ ClinicServiceController | ✅ Web | ✅ Done |
| 54 | Create Master Services | UC-CO-08 | 3.6.3 | ✅ MasterServiceController | ✅ Web | ✅ Done |
| 55 | View Master Services | UC-CO-08 | - | ✅ MasterServiceController | ✅ Web | ✅ Done |
| 56 | Update Master Services | UC-CO-08 | - | ✅ MasterServiceController | ✅ Web | ✅ Done |
| 57 | Delete Master Services | UC-CO-08 | - | ✅ MasterServiceController | ✅ Web | ✅ Done |
| 58 | Inherit From Master Service | - | - | ✅ ClinicServiceController | ✅ Web | ✅ Done |
| 59 | Handle Clinic (Active/Suspend) | - | - | ✅ ClinicController | ✅ Web | ✅ Done |
| 60 | Configure Pricing And Weight Tiers | UC-CO-04 | 3.6.4 | ✅ ClinicPriceController | ✅ Web | ✅ Done |
| 101 | Service Home Visit Toggle | UC-CO-11 | - | ✅ ClinicServiceController | ✅ Web | ✅ Done |
| 102 | Service Price Per KM | UC-CO-12 | - | ✅ ClinicServiceController | ✅ Web | ✅ Done |
| 103 | Bulk Price Per KM Update | UC-CO-13 | - | ✅ ClinicServiceController | ✅ Web | ✅ Done |
| 104 | AI-Assisted Clinic Setup | UC-CO-14 | 3.13 | ❌ | ❌ | ❌ Not Started |
| 105 | AI Generate Service Descriptions | UC-CO-15 | 3.13 | ❌ | ❌ | ❌ Not Started |
| 106 | AI Pricing Suggestions | UC-CO-16 | 3.13 | ❌ | ❌ | ❌ Not Started |

#### Staff Management

| # | Use Case | UC-ID | SRS Ref | Backend | Frontend | Status |
|---|----------|-------|---------|---------|----------|--------|
| 61 | Add Staff | UC-CM-03 | 3.7.1 | ✅ ClinicStaffController | ✅ Web | ✅ Done |
| 62 | Delete Staff | UC-CO-07 | - | ✅ ClinicStaffController | ✅ Web | ✅ Done |
| 63 | View list of staff | UC-CM-02 | - | ✅ ClinicStaffController | ✅ Web | ✅ Done |
| 64 | Add staff | UC-CM-03 | 3.7.1 | ✅ ClinicStaffController | ✅ Web | ✅ Done |
| 65 | Create Staff Shift | UC-CM-04 | 3.7.2 | ✅ StaffShiftController | ✅ Web | ✅ Done |
| 66 | View Staff Shift Detail | UC-ST-02 | - | ✅ StaffShiftController | ✅ Web | ✅ Done |
| 67 | Update Staff Shift | UC-CM-16 | - | ✅ StaffShiftController | ✅ Web | ✅ Done |
| 68 | Block/Unblock Slot | - | - | ✅ StaffShiftController | ✅ Web | ✅ Done |
| 69 | View work schedule | UC-ST-02 | - | ✅ StaffShiftController | ✅ Mobile/Web | ✅ Done |
| 70 | View staff's profile | UC-ST-02 | - | ✅ UserController | ✅ Mobile | ✅ Done |
| 71 | Update Staff's Profile | UC-ST-02 | - | ✅ UserController | ✅ Mobile | ✅ Done |
| 104 | Block/Unblock Slot (Manual) | UC-CM-11 | 2.2.6 | ✅ StaffShiftController | ✅ Web | ✅ Done |
| 105 | Bulk Shift Delete | UC-CM-12 | 2.2.6 | ✅ StaffShiftController | ✅ Web | ✅ Done |

#### Manager Booking Operations

| # | Use Case | UC-ID | SRS Ref | Backend | Frontend | Status |
|---|----------|-------|---------|---------|----------|--------|
| 72 | View New Bookings | UC-CM-05 | - | ✅ BookingController | ✅ Web | ✅ Done |
| 73 | Assign Staff to Booking | UC-CM-06 | 3.8.3 | ✅ BookingController | ✅ Web | ✅ Done |
| 74 | Reassign Staff | UC-CM-06 | 3.8.4 | ✅ BookingController | ✅ Web | ✅ Done |
| 75 | View request cancel booking | UC-CM-07 | - | ✅ BookingController | ✅ Web | ✅ Done |
| 76 | Approve/ Reject Request | UC-CM-07 | - | 🔄 | ❌ | 🔄 In Progress |
| 77 | View Statistics | UC-CO-05 | - | ❌ | ❌ | ❌ Not Started |
| 78 | View Payment Transactions History | - | - | ❌ | ❌ | ❌ Not Started |
| 79 | Process Refund | UC-CM-07 | - | ❌ | ❌ | ❌ Not Started |
| 80 | View List Cancellation And Refund | - | - | ❌ | ❌ | ❌ Not Started |
| 106 | Check Staff Availability | UC-CM-14 | 2.2.5 | ✅ BookingController | ✅ Web | ✅ Done |
| 107 | Reassign Staff to Service | UC-CM-15 | 2.2.5 | ✅ BookingController | ✅ Web | ✅ Done |
| 108 | Staff Home Dashboard Summary | UC-ST-14 | 2.2.5 | ✅ BookingController | ✅ Mobile | ✅ Done |

#### File & Media Management

| # | Use Case | UC-ID | SRS Ref | Backend | Frontend | Status |
|---|----------|-------|---------|----------|----------|--------|
| 113 | Upload Pet Image | UC-FILE-01 | 2.2.12 | ✅ FileController | ✅ Mobile | ✅ Done |
| 114 | Upload Medical Document | UC-FILE-02 | 2.2.12 | ✅ FileController | ✅ Mobile | ✅ Done |
| 115 | Upload Clinic Logo/Banner | UC-FILE-03 | 2.2.12 | ✅ CloudinaryService | ✅ Web | ✅ Done |
| 116 | Upload Knowledge Base Doc | UC-FILE-04 | 2.2.12 | ✅ FileController | ✅ Web | ✅ Done |
| 117 | Delete Uploaded File | UC-FILE-05 | 2.2.12 | ✅ FileController | ✅ Mobile/Web | ✅ Done |
| 118 | View File Gallery | UC-FILE-06 | 2.2.12 | ✅ FileController | ✅ Mobile | ✅ Done |

#### Patient & EMR Management

| # | Use Case | UC-ID | SRS Ref | Backend | Frontend | Status |
|---|----------|-------|---------|---------|----------|--------|
| 81 | View patient list | UC-CM-08 | 3.9.6 | ✅ EmrController | ✅ Web | ✅ Done |
| 82 | View patient record | UC-CM-09 | 3.9.7 | ✅ EmrController | ✅ Web | ✅ Done |
| 83 | Search examined patients | UC-VT-12 | 3.9.5 | ✅ EmrController | ✅ Web | ✅ Done |
| 84 | View patient details | UC-CM-09 | 3.9.7 | ✅ EmrController | ✅ Web | ✅ Done |
| 85 | View patient history list | UC-VT-13 | - | ✅ EmrController | ✅ Mobile | ✅ Done |
| 86 | View pet's medical record | UC-VT-06 | 3.9.1 | ✅ EmrController | ✅ Mobile/Web | ✅ Done |
| 87 | Update pet's medical record | UC-VT-06 | 3.9.1 | ✅ EmrController | ✅ Mobile | ✅ Done |
| 88 | Create prescription | UC-VT-07 | 3.9.2 | ✅ EmrController | ✅ Mobile | ✅ Done |
| 89 | View pet's vaccination record | UC-VT-08 | 3.9.4 | ✅ VaccinationController | ✅ Mobile | ✅ Done |
| 90 | Update pet's vaccination record | UC-VT-08 | 3.9.4 | ✅ VaccinationController | ✅ Mobile | ✅ Done |
| 91 | Check in patient | UC-VT-05 | 3.8.6 | ✅ BookingController | ✅ Mobile/Web | ✅ Done |
| 92 | Checkout patient | UC-CM-10 | 3.8.6 | ✅ BookingController | ✅ Web | ✅ Done |
| 93 | View assigned booking | UC-VT-03 | - | ✅ BookingController | ✅ Mobile | ✅ Done |

#### Vaccination Reminders

| # | Use Case | UC-ID | SRS Ref | Backend | Frontend | Status |
|---|----------|-------|---------|---------|----------|--------|
| 119 | Schedule Vaccination Reminder | UC-VAC-01 | 2.2.3 | ✅ VaccinationReminderService | ✅ System | ✅ Done |
| 120 | Send Vaccination Due Notification | UC-VAC-02 | 2.2.3 | ✅ VaccinationReminderService | ✅ Mobile | ✅ Done |
| 121 | View Upcoming Vaccinations | UC-VAC-03 | 2.2.3 | ✅ VaccinationController | ✅ Mobile | ✅ Done |
| 122 | Mark Vaccination Completed | UC-VAC-04 | 2.2.3 | ✅ VaccinationController | ✅ Mobile | ✅ Done |

#### Implementation Summary

| Status | Count | Percentage |
|--------|-------|------------|
| ✅ Done | 104 | 85.2% |
| 🔄 In Progress | 5 | 4.1% |
| ❌ Not Started | 13 | 10.7% |
| **Total** | **122** | **100%** |

### 2.4 Cross-Reference: Use Case to SDD Mapping

Bảng tham chiếu giữa Use Cases trong SRS và các Module Implementation trong SDD (REPORT_4_SDD_SYSTEM_DESIGN.md):

#### Authentication & Account Management Mapping

| UC-ID | Use Case Name | SDD Module | SDD Section |
|-------|---------------|------------|-------------|
| UC-AUTH-01 | Register Account (Email/OTP) | Authentication Management | 3.1 |
| UC-AUTH-02 | Login by Google OAuth | Authentication Management | 3.1 |
| UC-AUTH-03 | Staff Login (Invited Account) | Authentication Management | 3.1 |
| UC-AUTH-04 | Manager Login | Authentication Management | 3.1 |
| UC-AUTH-05 | Invite Staff (Quick Add by Email) | Staff Management | 3.7 |
| UC-AUTH-06 | Register Clinic (Pending Approval) | Clinic Registration | 3.3 |
| UC-AUTH-07 | Admin Login | Authentication Management | 3.1 |

#### Pet Records & Health Hub Mapping

| UC-ID | Use Case Name | SDD Module | SDD Section |
|-------|---------------|------------|-------------|
| UC-PET-01 | Manage Pet Profiles | Pet Management | 3.5 |
| UC-PET-02 | View Pet EMR Records | EMR Management | 3.9 |
| UC-PET-03 | View Vaccination Records | Vaccination Management | 3.9.4 |
| UC-PET-04 | View Patient History (Mobile) | EMR Management | 3.9.7 |
| UC-PET-05 | Update Pet Allergies | Pet Management | 3.5 |
| UC-PET-06 | Update Pet Weight | Pet Management | 3.5 |
| UC-VAC-01 | Schedule Vaccination Reminder | Vaccination Reminders | 3.14 (New) |
| UC-VAC-02 | Send Vaccination Due Notification | Vaccination Reminders | 3.14 (New) |
| UC-VAC-03 | View Upcoming Vaccination Schedule | Vaccination Management | 3.9.4 |
| UC-VAC-04 | Mark Vaccination as Completed | Vaccination Management | 3.9.4 |

#### Booking & Appointment Mapping

| UC-ID | Use Case Name | SDD Module | SDD Section |
|-------|---------------|------------|-------------|
| UC-BOOK-01 | Create Booking Request | Booking Management | 3.8.1 |
| UC-BOOK-02 | View Available Slots | Slot Calculation | 3.7.3 |
| UC-BOOK-03 | Cancel Booking | Booking Management | 3.8.4 |
| UC-BOOK-04 | Reschedule Booking | Booking Management | 3.8.5 |
| UC-BOOK-05 | Check-in Patient | Booking Lifecycle | 3.8.6 |
| UC-BOOK-06 | Check-out Patient | Booking Lifecycle | 3.8.6 |

#### Clinical Operations Mapping

| UC-ID | Use Case Name | SDD Module | SDD Section |
|-------|---------------|------------|-------------|
| UC-SERVICE-01 | Configure Master Services | Service Management | 3.6.1 |
| UC-SERVICE-02 | Customize Clinic Services | Service Management | 3.6.1 |
| UC-SERVICE-03 | Configure Service Weight Tiers | Service Management | 3.6.1 |
| UC-STAFF-01 | Add Staff Member | Staff Management | 3.7.1 |
| UC-STAFF-02 | Remove Staff Member | Staff Management | 3.7.1 |
| UC-STAFF-03 | Create Staff Schedule | Scheduling Management | 3.7.2 |
| UC-STAFF-04 | Assign Staff to Booking | Booking Assignment | 3.8.3 |

#### SOS Emergency Mapping

| UC-ID | Use Case Name | SDD Module | SDD Section |
|-------|---------------|------------|-------------|
| UC-SOS-01 | Request SOS | SOS Emergency | 3.10.1 |
| UC-SOS-02 | Track Staff Location | SOS Emergency | 3.10.2 |
| UC-SOS-03 | View ETA & Route | SOS Emergency | 3.10.3 |
| UC-SOS-04 | Receive Arrival Alert | SOS Emergency | 3.10.4 |
| UC-SOS-09 | Auto-Match: Find Nearest Clinic | SOS Auto-Match | 3.10.5 |
| UC-SOS-10 | Auto-Match: Accept/Decline SOS | SOS Auto-Match | 3.10.6 |

#### AI Assistance Mapping

| UC-ID | Use Case Name | SDD Module | SDD Section |
|-------|---------------|------------|-------------|
| UC-AI-01 | Ask Pet Care Advice (RAG) | AI Agent Service | 3.11.1 |
| UC-AI-02 | Symptom Check | AI Agent Tools | 3.11.2 |
| UC-AI-03 | AI Booking Assistant | AI Agent Tools | 3.11.2 |
| UC-AI-04 | Real-time Chat (WebSocket) | Chat Management | 3.11.3 |
| UC-AI-05 | Chat Images Gallery | Chat Management | 3.11.3 |
| UC-AI-06 | Manage Agent Tools | Agent Configuration | 3.11.4 |
| UC-AI-07 | Manage Knowledge Base | Knowledge Base | 3.11.5 |
| UC-AI-08 | Test Agent Playground | Agent Testing | 3.11.6 |

#### Notification Management Mapping

| UC-ID | Use Case Name | SDD Module | SDD Section |
|-------|---------------|------------|-------------|
| UC-NOTIF-01 | Send FCM Push Notification | FCM Push Notifications | 3.13 (New) |
| UC-NOTIF-02 | Subscribe to FCM Topic | FCM Push Notifications | 3.13 (New) |
| UC-NOTIF-03 | Send SSE Real-time Event | SSE Real-time Notifications | 3.12 (New) |
| UC-NOTIF-04 | Subscribe to SSE Stream | SSE Real-time Notifications | 3.12 (New) |
| UC-NOTIF-05 | Send Batch Notifications | Notification Service | 3.4.3 |

#### File & Media Management Mapping

| UC-ID | Use Case Name | SDD Module | SDD Section |
|-------|---------------|------------|-------------|
| UC-FILE-01 | Upload Pet Image | File Upload Management | 3.15 (New) |
| UC-FILE-02 | Upload Medical Document | File Upload Management | 3.15 (New) |
| UC-FILE-03 | Upload Clinic Logo/Banner | File Upload Management | 3.15 (New) |
| UC-FILE-04 | Upload Knowledge Base Document | File Upload Management | 3.15 (New) |
| UC-FILE-05 | Delete Uploaded File | File Upload Management | 3.15 (New) |
| UC-FILE-06 | View File Gallery | File Upload Management | 3.15 (New) |

#### Governance & Administration Mapping

| UC-ID | Use Case Name | SDD Module | SDD Section |
|-------|---------------|------------|-------------|
| UC-GOV-01 | View Pending Clinics | Clinic Approval | 3.3.2 |
| UC-GOV-02 | Approve/Reject Clinic | Clinic Approval | 3.3.2 |
| UC-GOV-03 | View Platform Stats | Admin Dashboard | 3.12.1 |
| UC-GOV-04 | View User Reports | Reporting & Moderation | 3.12.2 |
| UC-GOV-05 | Moderate Users | User Management | 3.2.5 |
| UC-GOV-07 | Rate & Review | Review System | 3.12.3 |
| UC-GOV-08 | Report Violation | Reporting System | 3.12.2 |

> **Note:** Các section đánh dấu "(New)" cần được bổ sung vào SDD Document. Tham khảo existing sections để maintain consistency về format và structure.

---

### 2.5 Use Case Alignment by Feature (Updated: 04/03/2026)

Mục này ghi nhận **các use case còn thiếu** theo feature, đối chiếu từ code đã implement hiện tại (backend + AI service + web).

| Feature | Use case còn thiếu (mức tổng quát) | Hướng placement SDD |
|---|---|---|
| Notification Management | Create Notification; Delete Notification | 4.13.x |
| Payment Management | Process Withdraw; View List Withdraw request; View wallet's clinic | 4.12.x (hoặc tách 4.17.x Wallet/Settlement) |
| Report Management | Create Report Clinic; Create Report Pet Owner; View All Report; Active/Suspend Report | 4.15.x |
| System Management | View platform statistics (dashboard-level tổng hợp) | 4.14.x / 4.15.x |
| Clinic Management | View Clinic Statistics (analytics theo clinic) | 4.4.x / 4.15.x |
| Clinic Discovery Management | Filter and Sort (business rule/filter set đầy đủ theo spec) | 4.4.x |
| Chat Management | Delete Message (hard/soft delete ở level message) | 4.10.x |
| EMR & Vaccination Management | Receive Medication Reminders (luồng nhắc thuốc rõ ràng cho người dùng) | 4.9.x |
| AI Assistant (Clinic) | AI-Assisted Clinic Setup; AI Generate Service Descriptions; AI Pricing Suggestions | 4.12.x (AI Management cho clinic) |

> Ghi chú: Các use case không nằm trong bảng trên được xem là đã có implementation nền tảng trong code hiện tại ở mức feature-function.

> Alignment rule: Từ mốc 04/03/2026, mọi use case mới phải đặt theo feature group ở mục 2.5 và đồng bộ tên 1-1 giữa SRS và SDD.

---

## 3. FUNCTIONAL REQUIREMENTS

### 3.1 System Functional Overview

#### 3.1.1 Screens Flow

---

##### 3.1.1.1 Mobile App - Pet Owner Flow (24 screens)

```mermaid
flowchart LR
    PO([Pet Owner]) --> Splash

    subgraph Landing_Page
        Splash --> LandingPage[Landing Page]
    end

    subgraph Authentication
        LandingPage --> Login
        Login --> Register
        Login --> ForgotPassword[Forgot Password]
        ForgotPassword --> ResetPassword[Reset Password]
        ResetPassword --> Login
        Register --> Home
        Login --> Home
    end

    subgraph Pet_Management[Pet Management]
        Home --> MyPets[My Pets]
        MyPets --> PetDetail[Pet Detail]
        MyPets --> AddEditPet[Add/Edit Pet]
        PetDetail --> AddEditPet
    end

    subgraph Clinic_Discovery[Clinic Discovery]
        Home --> SearchClinics[Search Clinics]
        SearchClinics --> ClinicDetail[Clinic Detail]
    end

    subgraph Booking
        ClinicDetail --> CreateBooking[Create Booking]
        CreateBooking --> Payment
        Home --> MyBookings[My Bookings]
        MyBookings --> BookingDetail[Booking Detail]
    end

    subgraph SOS_Emergency[SOS Emergency]
        Home --> SOSRequest[Request SOS]
        SOSRequest --> SOSTracking[SOS Tracking]
        SOSTracking --> SOSArrived[Staff Arrived]
    end
    subgraph Review
        BookingDetail --> WriteReview[Write Review]
    end

    subgraph Communication
        Home --> AIChat[AI Chat]
    end

    subgraph Profile
        Home --> ProfileScreen[Profile]
        ProfileScreen --> EditProfile[Edit Profile]
        ProfileScreen --> ChangeEmail[Change Email]
        ProfileScreen --> ChangePassword[Change Password]
    end

    subgraph Notification
        Home --> Notifications
    end
```

---

##### 3.1.1.2 Mobile App - Staff Flow (16 screens)


```mermaid
flowchart LR
    STAFF([Staff]) --> Login

    subgraph Authentication
        Login --> StaffHome[Staff Home]
    end

    subgraph Schedule
        StaffHome --> MySchedule[My Schedule]
    end

    subgraph Booking_Management[Booking Management]
        StaffHome --> AssignedBookings[Assigned Bookings]
        AssignedBookings --> BookingDetail[Booking Detail]
        BookingDetail -- "Check-In" --> BookingDetail
        BookingDetail -- "Add Service" --> BookingDetail
        BookingDetail -- "Complete" --> BookingDetail
    end

    subgraph Patient_Management[Patient Management]
        StaffHome --> PatientsList[Patients List]
        PatientsList --> PatientDetails[Patient Details]
        BookingDetail -- "View Patient" --> PatientDetails
        PatientDetails --> ViewHistory[View History]
        PatientDetails --> CreateEMR[Create EMR]
        PatientDetails --> AddVaccination[Add Vaccination]
        PatientDetails --> BookingDetail
    end

    subgraph Notification
        StaffHome --> Notifications
    end

    subgraph Profile
        StaffHome --> ProfileScreen[Profile]
    end
```

---

##### 3.1.1.3 Web App - Staff Flow (9 screens)

```mermaid
flowchart LR
    STAFF([Staff]) --> Login

    subgraph Authentication
        Login --> StaffHome[Staff Home]
    end

    subgraph Booking_Management[Booking Management]
        StaffHome --> BookingsList[Bookings List]
        BookingsList --> BookingDetail[Booking Detail]
        BookingDetail -- "Check-In" --> BookingDetail
        BookingDetail -- "Add Service" --> BookingDetail
        BookingDetail -- "Complete" --> BookingDetail
    end

    subgraph Patient_Management[Patient Management]
        StaffHome --> PatientList[Patient List]
        PatientList --> PatientDetails[Patient Details]
        BookingDetail -- "View Patient" --> PatientDetails
        PatientDetails --> ViewHistory[View History]
        PatientDetails --> CreateEMR[Create EMR]
        PatientDetails --> AddVaccination[Add Vaccination]
        PatientDetails --> BookingDetail
    end

    subgraph General
        StaffHome --> ProfileScreen[Profile]
        StaffHome --> MySchedule[My Schedule]
    end
```

---

##### 3.1.1.4 Web App - Clinic Owner Flow (14 screens)

```mermaid
flowchart LR
    CO([Clinic Owner]) --> Login
    Login --> DashboardHub[Dashboard Hub]


    subgraph Clinic_Management[Clinic Management]
        DashboardHub --> MyClinics[My Clinics]
        MyClinics --> ClinicDetail[Clinic Detail]
        MyClinics --> ClinicEdit[Clinic Edit]
        DashboardHub --> RegisterClinic[Register Clinic]
    end

    subgraph Service_Management[Service Management]
        DashboardHub --> MasterServices[Master Services]
        MasterServices --> ClinicServices[Clinic Services]
    end

    subgraph Staff_Management[Staff Management]
        DashboardHub --> ManageStaff[Manage Staff]
    end

    subgraph Financial
        DashboardHub --> RevenueReports[Revenue Reports]
    end

    subgraph Notification
        DashboardHub --> Notifications
    end

    subgraph Profile
        DashboardHub --> ProfileScreen[Profile]
    end
```

---

##### 3.1.1.5 Web App - Clinic Manager Flow (13 screens)

```mermaid
flowchart LR
    CM([Clinic Manager]) --> Login

    subgraph Authentication
        Login --> Dashboard
    end

    subgraph Schedule_Management[Schedule Management]
        Dashboard --> StaffSchedules[Staff Schedules]
    end

    subgraph Booking_Management[Booking Management]
        Dashboard --> BookingsList[Bookings List]
        BookingsList --> BookingDetail[Booking Detail]
        BookingDetail --> AssignStaff[Assign Staff]
        BookingDetail -- "Add Service" --> BookingDetail
        BookingDetail --> PaymentCheckout[Receive Payment & Checkout]
        BookingDetail --> Refunds
    end

    subgraph Staff_Management[Staff Management]
        Dashboard --> StaffList[Staff List]
    end

    subgraph Patient_Management[Patient Management]
        Dashboard --> PatientList[Patient List]
        PatientList --> PatientDetail[Patient Detail]
    end

    subgraph Financial
        Dashboard --> RevenueReports[Revenue Reports]
    end

    subgraph Notification
        Dashboard --> Notifications
    end

    subgraph Profile
        Dashboard --> ProfileScreen[Profile]
    end
```

---

##### 3.1.1.6 Web App - Admin Flow (12 screens)

```mermaid
flowchart LR
    ADMIN([Admin]) --> Login

    subgraph Authentication
        Login --> Dashboard
    end

    subgraph Clinic_Approval[Clinic Approval]
        Dashboard --> PendingClinics[Pending Clinics]
        PendingClinics --> ClinicDetail[Clinic Detail]
    end

    subgraph User_Management[User Management]
        Dashboard --> Users
    end

    subgraph Platform_Analytics[Platform Analytics]
        Dashboard --> Statistics
    end

    subgraph AI_Service_Management[AI Service Management]
        Dashboard --> AgentTools[Agent Tools]
        Dashboard --> KnowledgeBase[Knowledge Base]
        Dashboard --> AgentPlayground[Agent Playground]
    end

    subgraph Moderation_Reporting[Moderation & Reporting]
        Dashboard --> UserReports[User Reports]
        UserReports --> ReportDetail[Report Detail]
    end

    subgraph Notification
        Dashboard --> Notifications
    end
```

#### 3.1.2 Screen Descriptions

> **Organized by Module/Feature** - Detailed descriptions of 80 screens grouped by functionality.
>
> **Format:** Table per Module showing ID, Screen Name, Platform/Role, and Description.

---

##### 3.1.2.1 Onboarding & Authentication Modules (#1-11)

| # | Module | Screen Name | Platform/Role | Description |
|:---:|:---|:---|:---|:---|
| 1 | Onboarding | Splash | Mobile/Pet Owner | Logo animation and auto-redirect to onboarding or home |
| 2 | Onboarding | Landing Page | Mobile/Pet Owner | 3 slides (Booking, AI, Health records). Skip and Continue/Start buttons |
| 3 | Auth | Login | Mobile/PO, Staff | Username + Password, Forgot Password link. Google Sign-in (TBI) |
| 4 | Auth | Register | Mobile/PO | 2-step flow: Form (User, Email, Password, Full Name, Phone) → OTP verification |
| 5 | Auth | Forgot Password | Mobile/PO | Enter email → Send OTP → Navigate to Reset Password |
| 6 | Auth | Reset Password | Mobile/PO | Enter OTP 6 digits + New Password to reset password |
| 7 | Auth | Login | Web/Staff, Admin | Shared login portal. Auto-redirect based on role. Blocks PET_OWNER |
| 8 | Auth | Register | Web/Clinic Owner | 2-step OTP registration for Clinic Owner accounts |
| 9 | Auth | Forgot Password | Web | Enter email to receive OTP for password reset |
| 10 | Auth | Reset Password | Web | Enter OTP + New Password to reset password |
| 11 | Auth | Landing Page | Web/Landing | Landing page with feature showcase for visitors |

##### 3.1.2.2 Home & Dashboard Module (#12-18)

| # | Screen Name | Platform/Role | Description |
|:---:|:---|:---|:---|
| 12 | Home | Mobile/PO | Welcome card, Pet stats, Quick actions, Preview pets, Bottom nav |
| 13 | Staff Home | Mobile/Staff | Welcome card, Today stats, Today schedule, Pending bookings |
| 14 | Staff Home | Web/Staff | Shift overview, pending examinations (Placeholder) |
| 15 | Dashboard Hub | Web/Clinic Owner | Today stats (Revenue, Bookings), Clinic info, Monthly revenue |
| 16 | Dashboard | Web/Manager | Today overview, Pending actions (Unassigned, Refunds), Recent table |
| 17 | Dashboard | Web/Admin | Service Health check (AI, Spring), Platform stats, Quick links |

##### 3.1.2.3 Pet Management & Clinic Discovery (#18-22)

| # | Module | Screen Name | Platform/Role | Description |
|:---:|:---|:---|:---|:---|
| 18 | Pet Mgt | My Pets | Mobile/PO | ListView with pet cards, Add (+) button, Empty state |
| 19 | Pet Mgt | Pet Detail | Mobile/PO | Header image, Info card. Actions: Edit, Delete |
| 20 | Pet Mgt | Add/Edit Pet | Mobile/PO | Form to add/edit pet info (image, name, species, breed, dob, weight) |
| 21 | Discovery | Search Clinics | Mobile/PO | Map view, GPS-based search, filters, ratings |
| 22 | Discovery | Clinic Detail | Mobile/PO | Gallery, info, services, reviews, Book button |

##### 3.1.2.4 Clinic & Service Management (#23-30)

| # | Module | Screen Name | Platform/Role | Description |
|:---:|:---|:---|:---|:---|
| 23 | Clinic Mgt | Register Clinic | Web/Owner | 2-step: ClinicForm → Image Upload after creation |
| 24 | Clinic Mgt | My Clinics | Web/Owner | Header with Create, Filters (status, name), ClinicList |
| 25 | Clinic Mgt | Clinic Detail | Web/Owner | Clinic details (info, images, legal documents) |
| 26 | Clinic Mgt | Clinic Edit | Web/Owner | Form to edit clinic info, gallery management |
| 27 | Clinic Mgt | Pending Clinics | Web/Admin | Table of pending clinics, Actions: View/Approve/Reject |
| 28 | Clinic Mgt | Clinic Detail | Web/Admin | Background check, legal verification for approval |
| 29 | Service Mgt | Master Services | Web/Owner | Manage service templates for all branches under this owner |
| 30 | Service Mgt | Clinic Services | Web/Owner | Configure specific pricing and status per clinic branch |

##### 3.1.2.5 Staff, Booking & Clinical Workspace (#31-49)

| # | Module | Screen Name | Platform/Role | Description |
|:---:|:---|:---|:---|:---|
| 31 | Staff Mgt | Manage Staff | Web/Owner | Clinic dropdown, StaffTable, QuickAddStaffModal (STAFF/MANAGER) |
| 32 | Staff Mgt | Staff List | Web/Manager | Manage branch vets directory, quick add tools |
| 33 | Booking | Create Booking | Mobile/PO | Select pet, service, date, time slot, notes |
| 34 | Booking | Payment | Mobile/PO | Stripe/Cash checkout with cost breakdown |
| 35 | Booking | My Bookings | Mobile/PO | Appointment list: Upcoming, Completed, Cancelled |
| 36 | Booking | Booking Detail | Mobile/PO | Real-time status timeline, actions, contact |
| 37 | Booking | Assigned Bookings | Mobile/Staff | List of assigned bookings (Today, Upcoming, Done) |
| 38 | Booking | Booking Detail | Mobile/Staff | Appointment details, pet info, owner contact, start check-in |
| 39 | Booking | Bookings List | Web/Staff | Bookings with advanced table filtering |
| 40 | Booking | Booking Detail | Web/Staff | Appointment details, triage actions |
| 41 | Booking | Bookings List | Web/Manager | Oversight of branch appointments |
| 42 | Booking | Assign Staff | Web/Manager | Assigning available doctors to requests |
| 43 | Booking | Refunds | Web/Manager | Cancellation management, refund processing |
| 44 | Clinical | Examination View | Mobile/Staff | Active examination screen (In-Progress) |
| 45 | Clinical | Create EMR | Mobile/Staff | Clinical notes (SOAP format), prescription entry |
| 46 | Clinical | Checkout | Web/Manager | Receive payment & Close booking (COMPLETED) |
| 47 | Clinical | Add Vaccination | Mobile/Staff | Record new immunization entries |
| 48 | Clinical | Examination Hub | Web/Staff | Main hub for managing active examinations |

##### 3.1.2.6 Patient & Schedule Management (#50-58)

| # | Module | Screen Name | Platform/Role | Description |
|:---:|:---|:---|:---|:---|
| 50 | Patient Mgt | Pet History | Mobile/Staff | Comprehensive view of medical history, vaccines |
| 51 | Patient Mgt | Patients List | Mobile/Staff | Directory of patients treated at clinic |
| 52 | Patient Mgt | Patient List | Web/Staff | Directory of patients treated at clinic |
| 53 | Patient Mgt | Patient History | Web/Staff | Detailed medical records, vaccine view |
| 54 | Patient Mgt | Patient List | Web/Manager | Patient directory with immunization alerts |
| 55 | Patient Mgt | Patient Detail | Web/Manager | Detailed clinical records view (read-only) |
| 56 | Schedule | My Schedule | Mobile/Staff | Personal calendar (Month/Week/Day views) |
| 57 | Schedule | My Schedule | Web/Staff | Desktop-optimized personal calendar |
| 58 | Schedule | Staff Schedules | Web/Manager | Roster management, shift allocation |

##### 3.1.2.7 Other Core Modules (#59-80)

| # | Module | Screen Name | Platform/Role | Description |
|:---:|:---|:---|:---|:---|
| 59 | SOS Emergency | Create SOS Request | Mobile/PO | Wizard to create SOS booking: address selection (Location Picker / GPS), pet selection, symptoms input. Includes cancel button and lat/lng coordinates. |
| 60 | SOS Emergency | SOS Tracking | Mobile/PO | Real-time GPS map showing vet location, route, and ETA |
| 61 | SOS Emergency | Start SOS Travel | Mobile/Staff | Emergency GPS toggle, route visual, geofence arrival confirmation |
| 62 | Communication | AI Chat | Mobile/PO | Chat with AI assistant (3 modes: RAG Knowledge, Symptom Checker, AI Booking) |
| 63 | Pet Health | Pet EMR History | Mobile/PO | View pet's medical records timeline (SOAP notes, prescriptions) |
| 64 | Pet Health | Pet Vaccination History | Mobile/PO | View pet's vaccination records with next due dates and reminders |
| 65 | Notification | Notifications | Mobile/PO, Staff | In-app notification center for users and staff |
| 66 | Notification | Notifications | Web/All Staff | Centralized operational and system alerts |
| 67 | Profile | Profile | Mobile/PO, Staff | Avatar, Info, Actions (Edit, Email, Pass, Logout) |
| 68 | Profile | Edit Profile | Mobile/PO, Staff | Form to edit personal info (name, phone, avatar) |
| 69 | Profile | Change Email | Mobile/PO, Staff | Form to change email with OTP verification |
| 70 | Profile | Change Pass | Mobile/PO, Staff | Form to change password (current + new) |
| 71 | Profile | Profile | Web/Staff, Admin | Shared profile page. Account info and security |
| 72 | Review | Write Review | Mobile/PO | 1-5 star rating and comment after booking COMPLETED |
| 73 | Financial | Revenue Reports | Web/Owner, Manager | Financial statements, growth charts (Branch specific for Manager) |
| 74 | User Mgt | Users | Web/Admin | Centralized management of all user accounts |
| 75 | Analytics | Statistics | Web/Admin | Specialized reports, data export tools |
| 76 | AI Mgt | Agent Tools | Web/Admin | Manage MCP tools for AI Agent |
| 77 | AI Mgt | Knowledge Base | Web/Admin | RAG config, Upload docs, Query Tester |
| 78 | AI Mgt | Agent Playground | Web/Admin | Prompt config, params tuning, chat testing |
| 79 | Moderation | User Reports | Web/Admin | Queue of violation reports from users |
| 80 | Moderation | Report Detail | Web/Admin | Panel for moderation actions (Warn/Suspend/Ban) |

#### 3.1.3 Screen Authorization

*Provide the system roles authorization to the system features (down to screens, and event to the screen activities if applicable) in the table form below.*

| Screen | GUEST | PET_OWNER | STAFF | CLINIC_OWNER | CLINIC_MANAGER | ADMIN |
|--------|:-----:|:---------:|:---:|:------------:|:--------------:|:-----:|
| **Authentication Module** | | | | | | |
| Landing Page (Web) | X | X | X | X | X | X |
|   → View features | X | X | X | X | X | X |
|   → Navigate to Login/Register | X | X | X | X | X | X |
| Login Screen (Mobile - PO) | X | | | | | |
|   → Enter email/password | X | | | | | |
|   → Google Sign-in | X | | | | | |
|   → Forgot Password link | X | | | | | |
| Login Screen (Mobile - Staff) | | | X | | | |
|   → Google Sign-in | | | X | | | |
| Login Screen (Web) | | | X | X | X | X |
|   → Google Sign-in (Staff) | | | X | X | X | X |
|   → Email/Password (Admin) | | | | | | X |
|   → Forgot Password link | | | | | | X |
| Register Screen | X | | | X | | |
|   → Fill registration form | X | | | X | | |
|   → Verify OTP | X | | | X | | |
| Forgot Password | X | | | | | |
|   → Enter email | X | | | | | |
|   → Verify OTP | X | | | | | |
|   → Set new password | X | | | | | |
| **Pet Owner Screens** | | | | | | |
| Home (Pet Owner) | | X | | | | |
|   → View quick stats | | X | | | | |
|   → Navigate to features | | X | | | | |
| My Pets | | X | | | | |
|   → View pet list | | X | | | | |
|   → Add new pet | | X | | | | |
|   → Edit pet | | X | | | | |
|   → Delete pet | | X | | | | |
| Pet Detail | | X | | | | |
|   → View pet info | | X | | | | |
|   → Upload photo | | X | | | | |
|   → View EMR history | | X | | | | |
|   → View vaccination | | X | | | | |
| Search Clinics | | X | | | | |
|   → Search by keyword | | X | | | | |
|   → Filter by distance | | X | | | | |
|   → View on map | | X | | | | |
| Clinic Detail | | X | | | | |
|   → View clinic info | | X | | | | |
|   → View services | | X | | | | |
|   → View reviews | | X | | | | |
|   → Book appointment | | X | | | | |
| Create Booking | | X | | | | |
|   → Select service | | X | | | | |
|   → Select pet | | X | | | | |
|   → Select slot | | X | | | | |
|   → Confirm booking | | X | | | | |
| My Bookings | | X | | | | |
|   → View upcoming | | X | | | | |
|   → View past | | X | | | | |
|   → Cancel booking | | X | | | | |
| AI Chat | | X | | | | |
|   → Send message | | X | | | | |
|   → View response | | X | | | | |
| Write Review | | X | | | | |
|   → Rate (1-5 stars) | | X | | | | |
|   → Write comment | | X | | | | |
| **Staff Screens** | | | | | | |
| Dashboard (Staff) | | | X | | | |
|   → View today stats | | | X | | | |
|   → View pending tasks | | | X | | | |
| My Schedule | | | X | | X | |
|   → View calendar | | | X | | X | |
|   → View shift details | | | X | | | |
| Assigned Bookings | | | X | | | |
|   → View booking list | | | X | | | |
|   → View booking details | | | X | | | |
| Check-in | | | X | | | |
|   → Confirm arrival | | | X | | | |
|   → Start examination | | | X | | | |
| Create EMR | | | X | | | |
|   → Fill SOAP form | | | X | | | |
|   → Add prescription | | | X | | | |
|   → Upload photos | | | X | | | |
| Check-out/Checkout | | | | | X | |
|   → Complete booking | | | | | X | |
|   → Collect cash payment/payment | | | | | X | |
| Patient History | | | X | | X | |
|   → View EMR records | | | X | | X | |
|   → View vaccination | | | X | | X | |
| **Clinic Manager Screens** | | | | | | |
| Manager Dashboard | | | | | X | |
|   → View clinic stats | | | | | X | |
|   → View pending tasks | | | | | X | |
| Staff List | | | | X | X | |
|   → View all staff | | | | X | X | |
|   → Add new staff | | | | X | X | |
|   → Remove staff | | | | X | X | |
| Staff Shift Calendar | | | | | X | |
|   → View all shifts | | | | | X | |
|   → Create shift | | | | | X | |
|   → Delete shift | | | | | X | |
| All Bookings | | | | | X | |
|   → View all bookings | | | | | X | |
|   → Assign vet | | | | | X | |
|   → Process refund | | | | | X | |
| **Clinic Owner Screens** | | | | | | |
| Owner Dashboard | | | | X | | |
|   → View revenue stats | | | | X | | |
|   → View clinic status | | | | X | | |
| Register Clinic | | | | X | | |
|   → Fill clinic info | | | | X | | |
|   → Upload images | | | | X | | |
|   → Submit for approval | | | | X | | |
| Clinic Info Edit | | | | X | | |
|   → Edit clinic details | | | | X | | |
|   → Manage gallery | | | | X | | |
| Service Management | | | | X | | |
|   → Add service | | | | X | | |
|   → Edit pricing | | | | X | | |
|   → Configure weight tiers | | | | X | | |
| Manager Assignment | | | | X | | |
|   → Assign manager | | | | X | | |
|   → Remove manager | | | | X | | |
| **Admin Screens** | | | | | | |
| Admin Dashboard | | | | | | X |
|   → View platform stats | | | | | | X |
|   → View pending items | | | | | | X |
| Pending Clinics | | | | | | X |
|   → View clinic list | | | | | | X |
|   → Approve clinic | | | | | | X |
|   → Reject clinic | | | | | | X |
| Master Services | | | | | | X |
|   → Add master service | | | | | | X |
|   → Edit service template | | | | | | X |
| User Reports | | | | | | X |
|   → View report queue | | | | | | X |
|   → Process report | | | | | | X |
|   → Warn/Suspend/Ban user | | | | | | X |
| AI Agent Config | | | | | | X |
|   → Configure agent | | | | | | X |
|   → Manage tools | | | | | | X |
| Knowledge Base | | | | | | X |
|   → Upload documents | | | | | | X |
|   → Delete documents | | | | | | X |
| **Shared Screens** | | | | | | |
| Profile | | X | X | X | X | X |
|   → View info | | X | X | X | X | X |
|   → Edit info | | X | X | X | X | X |
|   → Change password | | X | X | X | X | X |
| Notifications | | X | X | X | X | X |
|   → View list | | X | X | X | X | X |
|   → Mark as read | | X | X | X | X | X |

#### 3.1.4 Non-Screen Functions

*Provide the descriptions for the non-screen system functions, i.e batch/cron job, service, API, etc.*

| # | Feature | System Function | Description |
|---|---------|-----------------|-------------|
| 1 | Slot Generation | AutoSlotGenerationService | Auto-generate 30-minute slots from VET_SHIFT when Manager creates a work shift |
| 2 | Booking Expiration | BookingExpirationJob | Update status PENDING → EXPIRED/RELEASED after 15 minutes of non-payment (Slot reservation TTL) |
| 3 | Push Notification | FCMNotificationService | Send push notifications to mobile devices (booking updates, reminders) |
| 4 | Email Notification | EmailNotificationService | Send confirmation emails and appointment reminders |
| 5 | OTP Generation | OtpGenerationService | Generate 6-digit OTP codes, store in Redis with 5-minute TTL |
| 6 | JWT Token Refresh | TokenRefreshMiddleware | Auto-refresh access token before expiration |
| 7 | Token Blacklist | TokenBlacklistService | Add token to blacklist on logout or revocation |
| 8 | Distance Calculation | GeoDistanceService | Calculate distance from clinic to Home Visit address (Haversine formula) |
| 9 | Dynamic Pricing | PricingCalculationService | Calculate price: Base + Weight Tier + Distance Fee |
| 10 | Rating Aggregation | RatingAggregationService | Update rating_avg of Clinic/Staff after each review |
| 11 | AI Chatbot | AIChatbotService | Process messages via Single Agent + ReAct pattern |
| 12 | RAG Retrieval | RAGRetrievalService | Search Knowledge Base with vector similarity |
| 13 | Document Indexing | DocumentIndexingBatch | Chunking and embedding documents on upload |
| 14 | Vaccination Reminder | VaccinationReminderJob | Send vaccination reminders before due date (daily 8:00 AM) |
| 15 | GPS Location Update | GPSLocationWebSocket | Real-time update of Staff location during SOS Booking (SOS only, not Home Visit) |
| 16 | Slot Availability Check | SlotReservationService | Check and reserve slot when creating booking |
| 17 | Payment Webhook | StripeWebhookHandler | Receive callback from Stripe after payment [Planned] |
| 18 | Image Upload | CloudinaryUploadService | Upload and optimize images (avatar, pet, clinic) |
| 19 | Token Cleanup | TokenCleanupJob | Daily cron to delete expired refresh tokens and blacklisted tokens |
| 20 | No-Show Detection | NoShowDetectionJob | Mark booking as NO_SHOW if not checked-in after 30 minutes |
| 21 | EMR Locking | EMRLockingJob | Hourly job to LOCK EMRs that are >24h old (BR-57) |
| 22 | Patient Auto-Creation | PatientAutoCreationListener | Event listener to create ClinicPatient on first Check-in (BR-58) |


#### 3.1.5 Entity Relationship Diagram

```mermaid
erDiagram
    %% ==================== AUTH & USER ====================
    USER ||--o{ REFRESH_TOKEN : has
    USER ||--o{ BLACKLISTED_TOKEN : invalidates
    USER ||--o{ PET : owns
    USER ||--o{ CLINIC : owns
    USER ||--o{ CLINIC : works_at
    USER ||--o{ VET_SHIFT : works
    USER ||--o{ BOOKING : books
    USER ||--o{ NOTIFICATION : receives
    USER ||--o{ CHAT_CONVERSATION : participates

    %% ==================== CLINIC & SERVICES ====================
    CLINIC ||--o| CLINIC_PRICE_PER_KM : has_pricing
    CLINIC ||--o{ CLINIC_IMAGE : has_images
    CLINIC ||--o{ CLINIC_SERVICE : offers
    CLINIC ||--o{ VET_SHIFT : schedules
    CLINIC ||--o{ BOOKING : receives
    CLINIC ||--o{ CHAT_CONVERSATION : receives_chat
    MASTER_SERVICE ||--o{ CLINIC_SERVICE : defines
    CLINIC_SERVICE ||--o{ SERVICE_WEIGHT_PRICE : has_tiers
    MASTER_SERVICE ||--o{ SERVICE_WEIGHT_PRICE : has_default_tiers

    %% ==================== BOOKING (M:N via Junction Tables) ====================
    BOOKING ||--|{ BOOKING_SERVICE_ITEM : contains
    BOOKING_SERVICE_ITEM }|--|| CLINIC_SERVICE : references
    BOOKING_SERVICE_ITEM }o--o| USER : assigned_staff

    %% ==================== PET & MEDICAL ====================
    PET ||--o{ BOOKING : has
    PET ||--o{ EMR_RECORD : has
    PET ||--o{ VACCINATION_RECORD : receives
    BOOKING ||--o| EMR_RECORD : generates

    %% ==================== SCHEDULING & MULTI-SLOT ====================
    VET_SHIFT ||--|{ SLOT : contains
    BOOKING ||--|{ BOOKING_SLOT : reserves
    BOOKING_SLOT }|--|| SLOT : links
    BOOKING_SLOT }o--o| BOOKING_SERVICE_ITEM : for_service

    %% ==================== FINANCE ====================
    BOOKING ||--|| PAYMENT : has

    %% ==================== COMMUNICATION (MongoDB) ====================
    CHAT_CONVERSATION ||--o{ CHAT_MESSAGE : contains

    %% ==================== FUTURE ENTITIES (Not Implemented) ====================
    %% USER ||--o{ REVIEW : writes
    %% BOOKING ||--o{ REVIEW : has
    %% USER ||--o{ USER_REPORT : submits
    %% CLINIC ||--o{ USER_REPORT : is_reported

    %% ==================== AI SERVICE (Separate petties-agent-service) ====================
    %% AI_AGENT ||--o{ AI_PROMPT_VERSION : has
    %% AI_AGENT ||--o{ AI_CHAT_SESSION : handles
    %% AI_CHAT_SESSION ||--o{ AI_CHAT_MESSAGE : contains
    %% AI_AGENT }o--o{ AI_TOOL : uses
    %% AI_AGENT ||--o{ AI_KNOWLEDGE_DOC : references
```

##### Relationship Matrix (Cardinality)

| From (Ent. A) | To (Ent. B) | Relationship | Cardinality | Business Logic |
|:---|:---|:---|:---:|:---|
| **USER** | **PET** | owns | 1 : N | Một người nuôi có thể sở hữu nhiều thú cưng. |
| **USER** | **CLINIC** | owns | 1 : N | Một Clinic Owner có thể sở hữu nhiều chi nhánh phòng khám. |
| **CLINIC** | **USER** | works_at | 1 : N | Một phòng khám có nhiều nhân viên (Staff, Manager). Mỗi nhân viên chỉ thuộc 1 phòng khám. |
| **USER** | **VET_SHIFT** | works | 1 : N | Một nhân viên có nhiều ca trực. Mỗi ca trực thuộc sở hữu của 1 nhân viên. |
| **VET_SHIFT** | **SLOT** | contains | 1 : N | Một ca trực được chia thành nhiều ô thời gian 30 phút. |
| **BOOKING** | **BOOKING_SLOT** | reserves | 1 : N | Một lịch hẹn chiếm dùng một hoặc nhiều Slot (thông qua bảng BOOKING_SLOT). |
| **BOOKING_SLOT** | **SLOT** | links | N : 1 | Mỗi booking_slot liên kết với một slot cụ thể. |
| **USER** | **BOOKING** | books | 1 : N | Khách hàng tạo nhiều lịch hẹn theo thời gian. |
| **PET** | **VACCINATION_RECORD** | receives | 1 : N | Một thú cưng có lịch sử tiêm chủng nhiều lần (tương đương với sổ tiêm). |
| **PET** | **BOOKING** | has | 1 : N | Một thú cưng có lịch sử khám nhiều lần. |
| **BOOKING** | **PAYMENT** | has | 1 : 1 | Mỗi lịch hẹn có chính xác một bản ghi thanh toán (Cash/Stripe). |
| **BOOKING** | **EMR_RECORD** | generates | 1 : 0..1 | Một lịch hẹn chỉ phát sinh tối đa 01 bệnh án (nếu khám thành công). |
| **BOOKING** | **BOOKING_SERVICE_ITEM** | contains | 1 : N | Một lịch hẹn có thể chứa nhiều dịch vụ khác nhau. |
| **BOOKING_SERVICE_ITEM** | **CLINIC_SERVICE** | references | N : 1 | Mỗi item tham chiếu đến một dịch vụ cụ thể. |
| **BOOKING_SERVICE_ITEM** | **USER** | assigned_staff | N : 0..1 | Mỗi dịch vụ trong booking có thể được gán cho một Staff riêng. |
| **BOOKING_SLOT** | **BOOKING_SERVICE_ITEM** | for_service | N : 0..1 | Slot được dành cho service cụ thể trong booking. |
| **USER** | **CHAT_CONVERSATION** | participates | 1 : N | Một người dùng tham gia vào nhiều hội thoại 1-1. |
| **CLINIC** | **CHAT_CONVERSATION** | receives_chat | 1 : N | Một phòng khám nhận nhiều hội thoại từ khách hàng. |
| **CHAT_CONVERSATION** | **CHAT_MESSAGE** | contains | 1 : N | Một cuộc hội thoại chứa nhiều tin nhắn. |
| **CLINIC** | **CLINIC_SERVICE** | offers | 1 : N | Một phòng khám cung cấp nhiều loại dịch vụ. |
| **CLINIC** | **CLINIC_IMAGE** | has_images | 1 : N | Một phòng khám có nhiều ảnh thực tế/không gian. |
| **CLINIC** | **CLINIC_PRICE_PER_KM** | has_pricing | 1 : 0..1 | Một phòng khám có tối đa một cấu hình giá di chuyển. |
| **CLINIC_SERVICE** | **SERVICE_WEIGHT_PRICE** | has_tiers | 1 : N | Một dịch vụ có nhiều mức giá theo cân nặng. |
| **MASTER_SERVICE** | **CLINIC_SERVICE** | defines | 1 : N | Template dịch vụ chung được áp dụng cho nhiều phòng khám. |
| **MASTER_SERVICE** | **SERVICE_WEIGHT_PRICE** | has_default_tiers | 1 : N | Template có các mức giá mặc định theo cân nặng. |
| **BLACKLISTED_TOKEN** | **USER** | invalidates | N : 1 | Token bị vô hiệu hóa khi người dùng logout. |
| **REFRESH_TOKEN** | **USER** | has | N : 1 | Một user có thể có nhiều refresh token (multi-device). |
| **USER** | **NOTIFICATION** | receives | 1 : N | Một người dùng nhận nhiều thông báo. |

#### 3.1.6 Entities Description

Dưới đây là danh sách đầy đủ **24 thực thể** đang được sử dụng trong hệ thống Petties (17 PostgreSQL + 4 MongoDB + 3 Embedded):

##### PostgreSQL Entities (17 tables)

| Nhóm | Thực thể | Mô tả | Các trường chính |
|:---:|---|---|---|
| **Auth & User** | **USER** | Tài khoản định danh (5 roles) | user_id, username, email, password, role, working_clinic_id, specialty, fcm_token |
| | **REFRESH_TOKEN** | Token duy trì phiên đăng nhập | token_id, user_id, token_hash, expires_at |
| | **BLACKLISTED_TOKEN** | Token bị vô hiệu hóa sau logout | token_id, token_hash, user_id, expires_at |
| **Pet** | **PET** | Hồ sơ thông tin thú cưng | pet_id, user_id, name, species, breed, weight, gender, allergies, image_url |
| **Clinic** | **CLINIC** | Thông tin phòng khám thú y | clinic_id, owner_id, name, address, phone, status, latitude, longitude, operating_hours(JSON), rating_avg |
| | **CLINIC_IMAGE** | Ảnh không gian phòng khám | image_id, clinic_id, image_url, is_primary, display_order |
| | **CLINIC_PRICE_PER_KM** | Giá di chuyển theo km | clinic_id, price_per_km |
| | **MASTER_SERVICE** | Bản mẫu dịch vụ (Templates) | master_service_id, name, default_price, duration_time, slots_required, is_home_visit |
| | **CLINIC_SERVICE** | Dịch vụ thực tế tại phòng khám | service_id, clinic_id, master_service_id, name, base_price, is_home_visit, price_per_km, is_active |
| | **SERVICE_WEIGHT_PRICE** | Khung giá theo cân nặng | weight_price_id, service_id, master_service_id, min_weight, max_weight, price |
| **Scheduling** | **STAFF_SHIFT** | Ca trực của nhân viên | shift_id, staff_id, clinic_id, work_date, start_time, end_time, break_start, break_end, is_overnight |
| | **SLOT** | Đơn vị thời gian 30 phút | slot_id, shift_id, start_time, end_time, status (AVAILABLE/BOOKED/BLOCKED) |
| **Booking** | **BOOKING** | Lịch hẹn khám | booking_id, booking_code, pet_id, pet_owner_id, clinic_id, assigned_staff_id, type, status, total_price, distance_fee, home_address |
| | **BOOKING_SERVICE_ITEM** | M:N Booking ↔ Service | booking_service_id, booking_id, service_id, assigned_staff_id, unit_price, base_price, weight_price, quantity |
| | **BOOKING_SLOT** | M:N Booking ↔ Slot | booking_slot_id, booking_id, slot_id, booking_service_id |
| | **PAYMENT** | Giao dịch thanh toán | payment_id, booking_id, amount, method (CASH/STRIPE), status, stripe_payment_id, paid_at |
| **Notification** | **NOTIFICATION** | Thông báo đẩy/in-app | notification_id, user_id, clinic_id, shift_id, type, message, read |

##### MongoDB Documents (4 collections)

| Nhóm | Thực thể | Collection | Mô tả | Các trường chính |
|:---:|---|---|---|---|
| **Medical** | **EMR_RECORD** | emr_records | Bệnh án điện tử (SOAP) | _id, pet_id, booking_id, vet_id, subjective, objective, assessment, plan, weight_kg, temperature_c, prescriptions[], images[] |
| | **VACCINATION_RECORD** | vaccination_records | Sổ tiêm chủng | _id, pet_id, booking_id, vet_id, vaccine_name, batch_number, vaccination_date, next_due_date |
| **Communication** | **CHAT_CONVERSATION** | chat_conversations | Phiên hội thoại 1-1 | _id, pet_owner_id, clinic_id, clinic_name, last_message, last_message_at, unread_count_pet_owner, unread_count_clinic |
| | **CHAT_MESSAGE** | chat_messages | Nội dung tin nhắn | _id, chat_box_id, sender_id, sender_type, content, message_type (TEXT/IMAGE), status, is_read |

##### Embedded Classes (không có table riêng)

| Class | Embedded In | Mô tả | Các trường |
|---|---|---|---|
| **OperatingHours** | Clinic.operating_hours (JSON) | Giờ mở cửa theo ngày | open_time, close_time, break_start, break_end, is_closed |
| **Prescription** | EmrRecord.prescriptions[] | Đơn thuốc | medicine_name, dosage, frequency, duration_days, instructions |
| **EmrImage** | EmrRecord.images[] | Ảnh y khoa | url, description |

##### Future Entities (chưa implement - dành cho các UC còn lại)

| Thực thể | UC liên quan | Mô tả | Dự kiến các trường |
|---|---|---|---|
| **REVIEW** | UC-PO-13 | Đánh giá nhân viên/phòng khám | id, booking_id, reviewer_id, type (STAFF/CLINIC), rating, comment |
| **USER_REPORT** | UC-PO-16 | Báo cáo vi phạm | id, reporter_id, reported_user_id, clinic_id, category, status |

##### AI Service Entities (trong petties-agent-service riêng)

| Thực thể | Mô tả | Ghi chú |
|---|---|---|
| **AI_AGENT** | Cấu hình AI Agent | Managed trong petties-agent-service PostgreSQL |
| **AI_TOOL** | Công cụ (Tools) Agent sử dụng | @mcp.tool decorator |
| **AI_PROMPT_VERSION** | Version control cho System Prompt | Managed trong petties-agent-service |
| **AI_CHAT_SESSION** | Phiên hội thoại với AI | Managed trong petties-agent-service |
| **AI_CHAT_MESSAGE** | Tin nhắn trong phiên AI | Managed trong petties-agent-service |
| **AI_KNOWLEDGE_DOC** | Tài liệu nạp cho RAG | Managed trong Qdrant Cloud |

---

### 3.2 Authentication & Onboarding
 
 #### *3.2.1 Register New Account (UC-PO-01 / UC-CO-01)*
**User Story:**
> *As a Guest (Pet Owner or Clinic Owner), I want to create a new account using my email and OTP verification so that I can securely access the platform's features.*

**Function trigger**
- **Navigation Path (Mobile - Pet Owner):** Onboarding Screen → Login Screen → Registration Screen (Link "Đăng ký ngay").
- **Navigation Path (Web - Clinic Owner):** Landing Page → Login Page → Registration Page (Link "Đăng ký tại đây").
- **Timing frequency:** On demand (whenever a guest wants to join the platform).

**Function description**
- **Actors/Roles:** Guest (Pet Owner, Clinic Owner).
- **Purpose:** Allow a Guest to create a new identity on the platform. Web registration for Pet Owners is supported but requires mobile app for usage.
- **Interface:**
    - Full Name – text input
    - Phone Number – text input
    - Email Address – text input
    - Password, Confirm Password – password inputs
    - OTP Entry – 6-digit numeric input (verification screen)

**Data processing**
1. User submits the registration form.
2. System validates input formats and uniqueness of Phone/Email.
3. System generates a 6-digit OTP (Redis TTL 5m) and sends it via Email.
4. User enters the OTP.
5. System verifies OTP, creates the `USER` record with role `PET_OWNER` or `CLINIC_OWNER`, and issues JWT.

**Screen layout**
Figure 1. Screen User Registration (Mobile) - Data Entry
Figure 2. Screen User Registration (Mobile) - OTP Verification
Figure 3. Screen User Registration (Web) - Data Entry
Figure 4. Screen User Registration (Web) - OTP Verification

**Function details**
- **Data:** FullName, PhoneNumber, Email, Password, ConfirmPassword, OTP.
- **Validation:** 
    - All fields are required.
    - Phone/Email must not exist in the database.
    - Password must be at least 6 characters (BR-12).
    - OTP must match the one stored in Redis (BR-13).
- **Business rules:** BR-11, BR-12, BR-13.
- **Normal case:**
    1. User fills the registration form and submits.
    2. System sends OTP to the provided email.
    3. User enters the correct OTP.
    4. Account is activated and user is logged in.
- **Abnormal/Exception cases:**
    - A1. Phone/Email already registered – Show "Identity already exists".
    - A2. Password mismatch – The confirmation password does not match.
    - A3. Weak password – Does not meet complexity requirements.
    - A4. Invalid OTP – User enters the wrong 6 digits.
    - A5. Expired OTP – User enters code after 5 minutes.
    - E1. Email Service Down – System cannot send the verification code.

 #### *3.2.2 Login to System (UC-PO-01a / UC-VT-01 / UC-CM-01 / UC-AD-01)*
**User Story:**
> *As a user, I want to log in using my username/email or Google account so that I can access my personalized dashboard and features.*

**Function trigger**
- **Navigation Path (Mobile):** Onboarding Screen → Login Screen.
- **Navigation Path (Web):** Landing Page → Login Page.
- **Timing frequency:** Whenever a session expires or user logs out.

**Function description**
- **Actors/Roles:** All Roles (Pet Owner, Staff, Manager, Owner, Admin).
- **Purpose:** Authenticate users and establish a secure session.
- **Interface:**
    - Username – text input
    - Password – password input
    - Google Login Button – OAuth trigger

**Data processing**
1. User enters credentials or clicks Google icon.
2. System verifies credentials against the DB or Google OAuth provider.
3. System checks if account is `ACTIVE`.
4. System issues Access Token (24h) and Refresh Token (7d).
5. System redirects user based on their specific Role.

**Screen layout**
Figure 5. Screen Universal Login (Mobile)
Figure 6. Screen Universal Login (Web)

**Function details**
- **Data:** Username, Password, OAuth ID Token.
- **Validation:** 
    - Valid credentials.
    - Account status must be `ACTIVE`.
    - Role `PET_OWNER` must use Mobile platform.
- **Business rules:** BR-11, BR-16.
- **Normal case:**
    1. User enters correct email and password.
    2. System verifies and redirects to the appropriate dashboard.
- **Abnormal/Exception cases:**
    - A1. Invalid credentials – Show "Email or password incorrect".
    - A2. Banned account – User account is disabled by Admin.
    - A3. Google auth failed – OAuth provider returns an error.
    - A4. Platform mismatch – Pet Owner attempts to access Web dashboard (Redirect to mobile app prompt).
    - E1. Connection Error – Database or Auth service is unreachable.

 #### *3.2.3 Recover Password (UC-PO-01b)*
**User Story:**
> *As a user, I want to recover my account access via email verification if I forget my password so that I can regain entry to the system securely.*

**Function trigger**
- **Navigation Path (Mobile):** Login Screen → "Forgot Password?" Link.
- **Navigation Path (Web):** Login Page → "Khôi phục ngay" Link.
- **Timing frequency:** On demand.

**Function description**
- **Actors/Roles:** All Roles.
- **Purpose:** Recover account access via OTP verification.
- **Interface:**
    - Email – text input
    - OTP – 6-digit numeric input
    - New Password – password input

**Data processing**
1. User submits email.
2. System sends OTP if email exists.
3. User verifies OTP and provides a new password.
4. System updates password and invalidates previous tokens.

**Screen layout**
Figure 7. Screen Forgot Password (Mobile) - Email Request
Figure 8. Screen Reset Password (Mobile) - OTP & New Password
Figure 9. Screen Forgot Password (Web) - Email Request
Figure 10. Screen Reset Password (Web) - OTP & New Password

**Function details**
- **Data:** Email, OTP, NewPassword.
- **Validation:** OTP must be valid.
- **Normal case:**
    1. User verifies email with OTP.
    2. User sets a new password successfully.
- **Abnormal/Exception cases:**
    - A1. Email not found – Show "Identity does not exist".
    - A2. Invalid/Expired OTP – Verification fails.
    - E1. Email service timeout.

 #### *3.2.4 Sign Out (UC-PO-01c)*
**User Story:**
> *As a user, I want to sign out of my account so that my session is invalidated and my data remains secure after I finish using the platform.*

**Function trigger**
- **Navigation Path (Mobile):** Profile Screen → Logout Button.
- **Navigation Path (Web):** Sidebar/Header → Logout Button.
- **Timing frequency:** On demand.

**Function description**
- **Actors/Roles:** All Roles.
- **Purpose:** Terminate session and invalidate tokens.
- **Interface:** Confirmation Dialog (Logout/Cancel).

**Data processing**
1. User confirms logout.
2. System blacklists the Refresh Token in the database.
3. Frontend clears local storage/secure storage.

**Screen layout**
Figure 11. Screen Session Termination (Mobile)
Figure 12. Screen Session Termination (Web)

**Function details**
- **Data:** Authorization Header (Bearer AccessToken).
- **Validation:** 
    - Authorization Header must be present.
    - Token must follow the "Bearer <token>" format.
- **Normal case:**
    1. User clicks the "Logout" button on their profile/settings.
    2. Frontend clears local storage (tokens, user data).
    3. System receives logout request with Bearer token.
    4. Backend blacklists the access token in Redis.
    5. User is redirected to the login/landing screen.
- **Abnormal cases:**
    - A1. Network error – Offline logout clears local tokens but server-side blacklist fails until reconnected.
    - A2. Invalid Token – System returns 401 Unauthorized if the token is already invalid or missing.



### 3.3 User Profile & Account Setup
 
 #### *3.3.1 Update Personal Profile (UC-PO-03 / UC-VT-02 / UC-CM-02)*
**User Story:**
> *As a user, I want to view and update my personal information (Name, Avatar, Phone) so that my profile remains accurate and the clinic can contact me if needed.*

**Function trigger**
- **Navigation path:** Sidebar/Hub → Profile OR Profile Picture → Settings.
- **Timing frequency:** On demand.

**Function description**
- **Actors/Roles:** All Authenticated Users.
- **Purpose:** Update personal identity information and account avatar.
- **Interface:**
    - Full Name – text input
    - Phone Number – text input
    - Email Address – text display (Read-only, change via OTP)
    - Avatar – image upload button

**Data processing**
1. User opens profile settings.
2. User modifies Name or uploads a new Avatar.
3. System validates Name format and image size/type.
4. If Avatar is changed, upload to Cloudinary and update the `image_url` in the database.
5. System saves changes to the `USER` record and returns success.

**Screen layout**
Figure 13. Screen View & Edit Profile (Mobile)
Figure 14. Screen View & Edit Profile (Web)

**Function details**
- **Data:** FullName, PhoneNumber, Avatar (File).
- **Validation:** 
    - Full Name cannot be empty.
    - Avatar must be < 5MB and a valid image format (JPG/PNG).
- **Business rules:** N/A
- **Normal case:**
    1. User modifies their display name and clicks "Save".
    2. System updates the record and displays a success toast.
- **Abnormal/Exception cases:**
    - A1. Invalid file format – User tries to upload a non-image file.
    - A2. File too large – Avatar exceeds 5MB.
    - A3. Network failure – Update fails during Cloudinary upload.

 #### *3.3.2 Security Settings (Credentials Management)*
**Function trigger**
- **Navigation path:** Profile → Security tab.
- **Timing frequency:** On demand.

**Function description**
- **Actors/Roles:** All Authenticated Users.
- **Purpose:** Change critical credentials to maintain account security.
- **Interface:**
    - Current Password – password input
 #### *3.3.2 Manage Account Security (UC-PO-04 / UC-VT-03)*
**User Story:**
> *As a user, I want to manage my login credentials (Change Password, Change Email) so that I can maintain the security of my account over time.*

**Function trigger**
- **Navigation path:** Profile → Security tab.
- **Timing frequency:** On demand (when user wants to change password/email).

**Function description**
- **Actors/Roles:** All Authenticated Users.
- **Purpose:** Update sensitive account credentials.
- **Interface:**
    - Current Password – text input
    - New Password – text input
    - Confirm Password – text input
    - New Email – text input
    - OTP – 6-digit input

**Data processing**
1. Password Change Case: System verifies current password before allowing change.
2. Email Change Case: System requires OTP verification for the new email before updating.
3. System invalidates old tokens upon successful credential change.

**Screen layout**
Figure 15. Screen Change Password (Mobile)
Figure 16. Screen Change Email (Mobile)
Figure 17. Screen Change Password (Web)
Figure 18. Screen Change Email (Web)

**Function details**
- **Data:** CurrentPassword, NewPassword, NewEmail, OTP.
- **Validation:** 
    - Password must be at least 6 characters.
    - OTP is required for email changes (BR-13).
- **Business rules:** BR-12, BR-13, BR-51.
- **Normal case:**
    1. User enters current and new password.
    2. System confirms and updates the credential.
- **Abnormal/Exception cases:**
    - A1. Incorrect Current Password – Access denied.
    - A2. Email already in use – If changing to an existing user's email.
    - A3. OTP mismatch/Invalid – User enters wrong code.
    - A4. OTP Expired – User enters code after 5 minutes.
    - A5. Cooldown Active – User requests new OTP within 60s (BR-51).
    - A6. Max Attempts Reached – User enters wrong OTP 5 times (OTP is invalidated - BR-13).
    - E1. Connection timeout – Auth service is slow.

### 3.4 Pet Records & Health Hub
 
 #### *3.4.1 Manage Pet Profiles (UC-PO-04)*
**User Story:**
> *As a Pet Owner, I want to create a digital profile for my pet so that I can manage their medical history and book veterinary appointments easily.*

**Function trigger**
- **Navigation path:** Mobile Home → Hub → "Add Pet" OR Mobile Home → My Pets → (+) button.
- **Timing frequency:** On demand (when the owner gets a new pet).

**Function description**
- **Actors/Roles:** Pet Owner.
- **Purpose:** Allow users to register basic information for their pets to enable booking and medical tracking.
- **Interface:**
    - Pet Name – text input
    - Species (Dog/Cat/Other) – dropdown
    - Breed – text input or dropdown with suggestions
    - Birth Date – date picker
    - Weight (kg) – numeric input
    - Gender – radio buttons
    - Avatar – image upload

**Data processing**
1. User fills the form details.
2. System validates the birth date (cannot be in the future).
3. System saves the `PET` record linked to the current `USER_ID`.
4. System automatically initializes an empty Immunization Book for the pet.
5. System confirms and redirects the user to the pet list.

**Screen layout**
Figure 19. Screen Create New Pet Profile (Mobile)

**Function details**
- **Data:** PetName, Species, Breed, BirthDate, Weight, Gender, Avatar.
- **Validation:** 
    - Pet Name is mandatory.
    - Birth date must be before the current date.
    - Weight must be > 0.
- **Business rules:** BR-26.
- **Normal case:**
    1. User adds "Bella" (Dog, 2 years old) and saves.
    2. Bella appears in the list and is ready for booking.
- **Abnormal/Exception cases:**
    - A1. Invalid Birth Date – User selects a future date.
    - A2. Upload failure – Issues with Cloudinary service.
    - E1. Database error – Unable to create pet record.

 #### *3.4.2 Update or Delete Pet Profile (UC-PO-04)*
**User Story:**
> *As a Pet Owner, I want to update my pet's information or remove their profile (soft-delete) so that the records remain up-to-date and clutter-free.*

**Function trigger**
- **Navigation path:** My Pets → Select Pet → "Edit Profile".
- **Timing frequency:** On demand.

**Function description**
- **Actors/Roles:** Pet Owner.
- **Purpose:** Update current information or perform a soft-delete of a pet profile.
- **Interface:**
    - Current Details – populated form
    - Delete Pet – red action button

**Data processing**
1. User updates fields (e.g., Weight).
2. Update Case: System validates and saves the modified record.
3. Delete Case: System performs a soft-delete (status → `DELETED`) to preserve medical history.
4. Old EMR records remain accessible via the old Pet ID if requested by a vet.

**Screen layout**
Figure 20. Screen Manage Pet Profile (Mobile)

**Function details**
- **Logic:** Ensures medical integrity by not hard-deleting patient data with existing exam history.
- **Business rules:** BR-005-01 (EMR linking).
- **Abnormal/Exception cases:**
    - A1. Unauthorized Delete – User tries to delete a pet they do not own.

 #### *3.4.3 View Pet Health Records (UC-PO-11 / UC-PO-12)*
**User Story:**
> *As a Pet Owner, I want to see a unified view of my pet's medical events, weight trends, and vaccination status so that I can monitor their health and stay on top of medical needs.*

**Function trigger**
- **Navigation path:** My Pets → Select Pet → "Health Hub".
- **Timing frequency:** On demand.

**Function description**
- **Actors/Roles:** Pet Owner, Staff, Manager.
- **Purpose:** Provide a central dashboard for all medical events for a pet.
- **Interface:**
    - Vaccination Status – badge (Complete / Due / Overdue)
    - Medical History Timeline – list of past EMRs
    - Active Prescriptions – list
    - Weight Trend Chart – visual data

**Data processing**
1. System queries all `EMR`, `VACCINATION`, and `PRESCRIPTION` records for the specific `PET_ID`.
2. System calculates "Next Due Date" for vaccines.
3. System renders the visual dashboard.

**Screen layout**
Figure 21. Screen View Pet Health Hub (Mobile)
Figure 22. Screen View Pet Health Hub (Web)

**Function details**
- **Business rules:** BR-009-01 (Data sharing).
- **Abnormal/Exception cases:**
    - A1. No history – Displays "This pet has no medical records yet."
    - A2. Access denied – Clinic staff without an appointment for the pet attempts to view history (if BR-009-03 is strictly enforced).



### 3.5 Clinic Discovery Flow
 
 #### *3.5.1 Search & Filter Clinics (UC-PO-05)*
**User Story:**
> *As a Guest or Pet Owner, I want to find veterinary clinics based on my location, the services they offer, and their ratings so that I can choose the best medical care for my pet.*

**Function trigger**
- **Navigation path:** Home Screen → Search Bar.
- **Timing frequency:** On demand.

**Function description**
- **Actors/Roles:** Guest, Pet Owner.
- **Purpose:** Locate clinics matching specific criteria.
- **Interface:**
    - Search Bar (Keywords) – text input
    - Filter Button – modal trigger
    - Sort Options – dropdown (Distance, Rating)
    - Results View – list or map toggle

**Data processing**
1. User enters keywords or applies filters.
2. System calls Goong API for geolocation/distance.
3. System queries `CLINIC` and `SERVICE` tables for matches.
4. System ranks results and displays them.

**Screen layout**
Figure 23. Screen Search & Filter (Mobile)

**Function details**
- **Data:** Keywords, Location (Lat/Long), CategoryID, MinRating.
- **Validation:** 
    - At least one search criteria or default "All Nearby" is used.
    - Goong API Key must be valid.
- **Business rules:** BR-003-05 (Only APPROVED clinics shown).
- **Normal case:**
    1. User types "Vaccine" and selects "Near me".
    2. System lists 3 clinics within 5km.
- **Abnormal/Exception cases:**
    - A1. No results – Show friendly empty state.
    - A2. GPS errors – Fallback to default city center.
    - A3. API Limit – Goong fails, system falls back to text-based address search.

 #### *3.5.2 View Clinic Details (UC-PO-05b)*
**User Story:**
> *As a Guest or Pet Owner, I want to view detailed information, photos, and services of a clinic so that I can make an informed decision before booking.*

**Function trigger**
- **Navigation path:** Search Results → Select Clinic Card.
- **Timing frequency:** On demand.

**Function description**
- **Actors/Roles:** Guest, Pet Owner.
- **Purpose:** Present full clinic profile to the user.
- **Interface:**
    - Clinic Hero Image – visual
    - Info Section (Address, Hours, Rating) – text
    - Service Menu – list with prices
    - Staff Team – horizontal scroll list
    - Book Now Button – action trigger

**Data processing**
1. User clicks a clinic.
2. System retrieves Clinic details, Staff list, and Service catalog.
3. System renders the details page.

**Screen layout**
Figure 24. Screen Clinic Details (Mobile)

**Function details**
- **Data:** ClinicID.
- **Validation:** Clinic must be `APPROVED` and `ACTIVE`.
- **Normal case:**
    1. User views "PetCare Center".
    2. User sees they offer "Annual Checkup" for 200k.
    3. User sees Dr. Minh is available.
- **Abnormal/Exception cases:**
    - A1. Clinic not found/Inactive – Redirect to search with "Clinic is no longer available".
    - A2. Missing Services – Show "No services listed".

### 3.6 Clinical Operations & Service Setup
 
 #### *3.6.1 Register New Clinic*
**User Story:**
> *As a Clinic Owner, I want to register a new veterinary branch on the platform with all necessary legal documents so that it can be approved for operation.*

**Function trigger**
- **Navigation path:** Web Portal → Clinic Owner Dashboard → Create Clinic.
- **Timing frequency:** On demand.

**Function description**
- **Actors/Roles:** Clinic Owner.
- **Purpose:** Register a new veterinary branch on the platform to await approval.
- **Interface:**
    - Clinic Name – text input
    - Description – textarea
    - Address – text input (OSM Autocomplete)
    - Location Selection – Province/District/Ward selection
    - Specific Location – text input (Floor, building...)
    - Phone Number – text input
    - Email – text input
    - Operating Hours – 24/7 toggle or daily Slot-based (Open/Close/Break times)
    - Logo & Photos – file upload

**Data processing**
1. User provides identity and geographic information for the clinic.
2. User uploads legal documents.
3. System saves the record with `PENDING` status.
4. System notifies Platform Admins of the new registration request.

**Screen layout**
Figure 26. Screen Clinic Registration (Web)

**Function details**
- **Data:** ClinicName, Address, Phone, Latitude, Longitude, BusinessLicense, Photos.
- **Validation:** 
    - License file is mandatory.
    - Clinic name must be unique on the platform.
- **Business rules:** BR-003-05.
- **Normal case:**
    1. Owner submits "Sai Gon Pet Clinic" with full documentation.
    2. Status becomes `PENDING` awaiting admin review.
- **Abnormal/Exception cases:**
    - A1. Missing documents – Registration is blocked.
    - A2. Invalid coordinates – System cannot locate the address on the map.

 #### *3.6.2 Approve or Reject Clinic*
**User Story:**
> *As a Platform Admin, I want to review and verify clinic registration requests so that only legitimate and qualified clinics are allowed on the platform.*

**Function trigger**
- **Navigation path:** Admin Dashboard → Pending Requests.
- **Timing frequency:** On demand (Admin action).

**Function description**
- **Actors/Roles:** Platform Admin.
- **Purpose:** Verify the validity of a clinic before allowing public operations.
- **Interface:**
    - Document View Link – opens PDF
    - Admin Notes – text area
    - Approve/Reject buttons

**Data processing**
1. Admin reviews attached documents.
2. Admin selects Approve or Reject.
3. If Approved: status → `APPROVED`, clinic appears in search results.
4. If Rejected: status → `REJECTED`, requires rejection reason.
5. Notification is sent to the Clinic Owner.

**Screen layout**
Figure 27. Screen Clinic Approval & Moderation (Web)

**Function details**
- **Logic:** Only `APPROVED` clinics can set up services and accept bookings.
- **Normal case:**
    1. Admin verifies license and approves.
    2. Clinic is now visible on the mobile app.
- **Abnormal/Exception cases:**
    - A1. Rejection without reason – Blocked.
    - E1. Email notification failure – Owner does not receive the decision update.

 #### *3.6.3 Define Master Services (UC-CO-08)*
**User Story:**
> *As a Clinic Owner, I want to define a standardized catalog of services (templates) so that all my clinic branches offer consistent services.*

**Function trigger**
- **Navigation path:** Owner Dashboard → Services → Master Catalog.
- **Timing frequency:** On demand.

**Function description**
- **Actors/Roles:** Clinic Owner.
- **Purpose:** Define standard service templates for all branches.
- **Interface:**
    - Service Template Name – text input
    - Category – dropdown
    - Description – text area

**Data processing**
1. Owner creates a template (e.g., "General Check-up").
2. System saves to the `MASTER_SERVICE` table.
3. These templates become available for branch managers to select and price.

**Screen layout**
Figure 28. Screen Global Service Definition (Web)

**Function details**
- **Data:** Name, Description, Category.
- **Business rules:** N/A
- **Normal case:**
    1. Clinic Owner navigates to Master Services catalog.
    2. Owner clicks "Add Service" and enters "Rabies Vaccination".
    3. Owner selects category "VET_VACCINATION" and adds description.
    4. System saves the template, available for all branches to inherit.

 #### *3.6.4 Configure Branch Pricing (UC-CO-04)*
**User Story:**
> *As a Clinic Manager, I want to configure base prices and weight-based surcharges for services at my branch so that billing is accurate and adapted to local costs.*

**Function trigger**
- **Navigation path:** Manager Dashboard → My Clinic → Service Pricing.
- **Timing frequency:** On demand.

**Function description**
- **Actors/Roles:** Clinic Manager, Clinic Owner.
- **Purpose:** Set specific prices and weight-based surcharges for the current branch.
- **Interface:**
    - Base Price – numeric input
    - Weight Tiers – dynamic list of surcharges

**Data processing**
1. Manager selects a Master Service.
2. Manager sets a Base Price (e.g., 200k).
3. Manager adds tier-based surcharges (e.g., +50k for pets >10kg).
4. System updates the branch-specific service record.

**Screen layout**
Figure 29. Screen Branch Pricing Configuration (Web)

**Function details**
- **Data:** BasePrice, TierSurcharges.
- **Validation:** Price cannot be negative.
- **Logic:** Total price is calculated as `Base + Surcharge` during booking.
- **Business rules:** N/A
- **Normal case:**
    1. Manager navigates to Service Pricing for their branch.
    2. Manager selects "General Checkup" service.
    3. Manager sets base price ₫200,000 and adds surcharge tiers:
       - Small (0-5kg): +₫0
       - Medium (5-15kg): +₫50,000
       - Large (15-30kg): +₫100,000
    4. System saves pricing configuration for the branch.
- **Abnormal cases:**
    - A1. Tier overlap – User defines two prices for the same weight range.

 #### *3.6.5 Edit Clinic Information (UC-CO-02)*
**User Story:**
> *As a Clinic Owner, I want to update my clinic's contact information, description, and photos so that customers have the most current information.*

**Function trigger**
- **Navigation path:** Clinic Dashboard → Settings → Edit Info.
- **Timing frequency:** On demand.

**Function description**
- **Actors/Roles:** Clinic Owner.
- **Purpose:** Modify non-identity clinic details.
- **Interface:** Edit form with existing data pre-filled.

**Data processing**
1. User modifies fields (Description, Phone, Opening Hours).
2. System validates data format.
3. System saves updates to `CLINIC` table.

**Function details**
- **Data:** Description, Phone, Email, WorkingHours.
- **Validation:** Phone must be 10 digits. Email must be valid.

 #### *3.6.6 Create/Update/Delete Clinic Service (UC-CO-03)*
**User Story:**
> *As a Clinic Owner, I want to manage the specific services offered by my clinic branch so that I can control my service catalog.*

**Function trigger**
- **Navigation path:** Clinic Dashboard → Services → Manage Services.
- **Timing frequency:** On demand.

**Function description**
- **Actors/Roles:** Clinic Owner.
- **Purpose:** Full CRUD for branch-specific services.
- **Interface:** Service list with Add/Edit/Delete actions.

**Data processing**
1. Add: Owner creates a new service not from master.
2. Update: Owner modifies service name, description, or status (Active/Inactive).
3. Delete: System soft-deletes the service if it has no active bookings.

**Function details**
- **Business rules:** BR-012 (Deletion blocked if active bookings exist).

 #### *3.6.7 Inherit From Master Service*
**User Story:**
> *As a Clinic Owner, I want to quickly add services to my branch by selecting them from the Master Catalog so that I don't have to re-enter service details.*

**Function trigger**
- **Navigation path:** Manager Dashboard → Services → "Add from Master".
- **Timing frequency:** On demand.

**Function description**
- **Actors/Roles:** Clinic Owner, Manager.
- **Purpose:** Populate branch service catalog from global templates.
- **Interface:** List of Master Services with "Inherit" buttons.

**Data processing**
1. User selects template from Master Catalog.
2. System copies Name, Category, and Description to a new branch-service record.
3. User is prompted to set local pricing immediately.

**Function details**
- **Normal case:**
    1. Manager views Master Catalog.
    2. Manager clicks "Inherit" on "Rabies Vaccination".
    3. System creates local service record.
    4. Manager redirected to Pricing page for that service.

### 3.7 Staff Management & Scheduling
 
 #### *3.7.1 Invite New Staff (UC-CM-03 / UC-CO-06)*
**User Story:**
> *As a Clinic Owner/Manager, I want to invite new staff members via email so that they can securely access their role-specific dashboard using their existing Google accounts.*

**Function trigger**
- **Navigation path:** Staff Management → "Invite New Member".
- **Timing frequency:** On demand.

**Function description**
- **Actors/Roles:** Clinic Owner, Clinic Manager.
- **Purpose:** Add Veterinarians or Managers to the clinic team.
- **Interface:**
    - Email Address – text input
    - Role Selection – dropdown (Staff/Manager)
    - Specialty – dropdown (Visible only if Role is Staff)

**Data processing**
1. Manager enters email and selects role/specialty.
2. System validates email format and uniqueness within the context of active invitations.
3. System creates a `USER` record with `PENDING_INVITE` status (or links existing user).
4. System sends an email with an acceptance link.

**Screen layout**
Figure 30. Screen Staff Invitation (Web)

**Function details**
- **Data:** Email, Role, Specialty.
- **Validation:** 
    - Email required.
    - Specialty required if Role = Staff.
- **Business rules:** BR-35, BR-45, BR-46, BR-47.
- **Normal case:**
    1. Manager invites "dr.tung@gmail.com" as a Staff (Surgery).
    2. Dr. Tung receives an email.
    3. Dr. Tung logs in with Google and is automatically assigned to the clinic.
- **Abnormal/Exception cases:**
    - A1. User already in another clinic – Block invitation (BR-47).
    - A2. User blocked/banned – Prevent invitation.

 #### *3.7.2 Remove Staff Member (UC-CM-04)*
**User Story:**
> *As a Clinic Owner/Manager, I want to remove a staff member from my clinic so that they no longer have access to clinic operations and scheduling.*

**Function trigger**
- **Navigation path:** Staff Management → Select Staff → "Remove Staff".
- **Timing frequency:** On demand.

**Function description**
- **Actors/Roles:** Clinic Owner, Clinic Manager.
- **Purpose:** Revoke a staff member's association with the clinic (resignation, termination, or role change).
- **Interface:**
    1. **Staff Management Table:** List of all staff members with action menu
    2. **Remove Button:** Three-dot menu → "Remove Staff"
    3. **Confirmation Dialog:** Warning message with staff name + assigned shifts count
    4. **Confirm/Cancel Buttons:** Final action buttons

**Data processing**
1. User clicks "Remove Staff" for a specific staff member.
2. System displays confirmation modal with warning about active shifts.
3. User confirms removal.
4. System validates that staff has no active bookings (status IN_PROGRESS).
5. System unassigns staff from clinic (sets `working_clinic_id = NULL`).
6. System deletes all future shifts for this staff (soft delete).
7. System sends notification to removed staff via email.

**Screen layout**
Figure 31. Screen Staff Removal Confirmation Dialog (Web)

**Function details**
- **Data:**
    - staffId (UUID, required) - ID of staff member to remove
    - clinicId (UUID, required) - Clinic ID (from path parameter)
- **Validation:**
    - **Error Handling:**
        - E1. Staff has active bookings → Error: "Không thể xóa nhân viên đang có lịch hẹn đang thực hiện"
        - E2. Staff not found → Error: "Nhân viên không tồn tại"
        - E3. Staff not in this clinic → Error: "Nhân viên không thuộc phòng khám này"
        - E4. Cannot remove self → Error: "Không thể tự xóa chính mình khỏi phòng khám"
    - **Authorization Rules:**
        - Clinic Owner can remove any staff (Manager or Staff role)
        - Clinic Manager can only remove Staff role (not other Managers)
- **Business rules:** BR-48 (Staff can only belong to one clinic at a time).
- **Normal case:**
    1. Manager navigates to Staff Management page.
    2. Manager clicks three-dot menu for "Dr. Nguyen Minh".
    3. Manager clicks "Remove Staff".
    4. Confirmation modal shows: "Remove Dr. Nguyen Minh? This will delete 5 future shifts."
    5. Manager confirms → System removes staff, deletes shifts, sends notification.
    6. Toast: "Staff removed successfully".
- **Abnormal/Exception cases:**
    - A1. Staff has IN_PROGRESS booking → Show error "Cannot remove staff with active appointments".
    - A2. Last manager in clinic → Warn "Removing last manager will prevent scheduling operations".

 #### *3.7.3 View Staff List (UC-CM-05)*
**User Story:**
> *As a Clinic Owner/Manager, I want to view a list of all staff members currently associated with my branch so that I can manage my team.*

**Function trigger**
- **Navigation path:** Dashboard → Staff Management.
- **Timing frequency:** On demand.

**Function description**
- **Actors/Roles:** Clinic Owner, Clinic Manager.
- **Purpose:** Provide an overview of all staff members assigned to the clinic for monitoring and management.
- **Interface:**
    1. **Staff List Table:** Columns: Avatar, Full Name, Role, Specialty, Status, Actions
    2. **Search Bar:** Filter by name or email
    3. **Role Filter:** Dropdown (All/Manager/Staff)
    4. **Action Menu:** Three-dot menu for each staff (View Details / Remove)

**Data processing**
1. System queries all users where `working_clinic_id` matches current clinic.
2. System displays staff members sorted by role (Manager first, then Staff).
3. User can search by name or email to filter results.
4. User can click action menu to view details or remove staff.

**Screen layout**
Figure 32. Screen Staff List Management (Web)

**Function details**
- **Data:**
    - clinicId (UUID, required) - Clinic ID from path parameter
    - Response: List of StaffResponse objects containing:
        - userId (UUID) - Staff user ID
        - fullName (String) - Staff full name
        - email (String) - Staff email address
        - avatar (String, optional) - Avatar URL
        - role (Role enum) - CLINIC_MANAGER or STAFF
        - specialty (StaffSpecialty enum, optional) - Only for STAFF role
        - status (String) - Active/Inactive status
- **Validation:**
    - User must be Clinic Owner or Clinic Manager
    - If Clinic Manager: can only view staff from their own clinic
- **Business rules:** BR-45 (Only Manager and Staff roles are listed, Owner excluded).
- **Normal case:**
    1. Manager opens Staff Management page.
    2. System displays 8 staff members: 1 Manager + 7 Staff (Veterinarians).
    3. Manager uses search "Nguyen" → Filters to 3 matching staff.
    4. Manager clicks "View Details" → Opens staff profile modal.
- **Abnormal/Exception cases:**
    - A1. No staff assigned → Display empty state "Chưa có nhân viên nào. Hãy mời nhân viên mới."
    - A2. Network error → Toast "Không thể tải danh sách nhân viên".

 #### *3.7.4 View Own Work Schedule (UC-STAFF-01)*
**User Story:**
> *As a Staff, I want to view my personal work schedule (shifts) so that I know when I'm expected to work and can plan my time accordingly.*

**Function trigger**
- **Navigation path:** Staff Mobile → Bottom Tab "Schedule" OR Staff Web → Sidebar "My Schedule".
- **Timing frequency:** On demand.

**Function description**
- **Actors/Roles:** Staff (Mobile/Web).
- **Purpose:** Display all shifts assigned to the currently logged-in staff member.
- **Interface:**
    1. **Calendar View:** Monthly calendar with shift markers
    2. **List View:** Detailed list of shifts with date, time, break info
    3. **Shift Card:** Shows work date, start/end time, break times, overnight indicator, notes
    4. **Filter:** Date range picker (default: current week)
    5. **Slot Stats:** Total slots, available, booked, blocked counts per shift

**Data processing**
1. Staff opens Schedule screen.
2. System queries all shifts where `staff_id = current_user_id`.
3. System displays shifts in calendar + list view.
4. User can select date range to view future/past shifts.
5. User clicks on a shift → View detailed slot breakdown.

**Screen layout**
Figure 33. Screen My Work Schedule (Mobile - Staff)
Figure 34. Screen My Work Schedule (Web - Staff)

**Function details**
- **Data:**
    - staffId (UUID, auto-filled from authenticated user)
    - startDate (LocalDate, required) - Start of date range
    - endDate (LocalDate, required) - End of date range
    - Response: List of StaffShiftResponse containing:
        - shiftId (UUID) - Shift ID
        - staffId (UUID) - Staff user ID
        - staffName (String) - Staff full name
        - staffAvatar (String, optional) - Avatar URL
        - clinicId (UUID) - Clinic ID
        - clinicName (String) - Clinic name
        - workDate (LocalDate) - Scheduled work date
        - startTime (LocalTime) - Shift start time
        - endTime (LocalTime) - Shift end time
        - breakStart (LocalTime, optional) - Break start time
        - breakEnd (LocalTime, optional) - Break end time
        - isOvernight (Boolean) - True if shift spans midnight
        - notes (String, optional) - Manager notes for this shift
        - totalSlots (Integer) - Total number of 30-minute slots
        - availableSlots (Integer) - Available slots count
        - bookedSlots (Integer) - Booked slots count
        - blockedSlots (Integer) - Blocked slots count
        - displayDate (LocalDate) - Date to display shift on calendar
        - isContinuation (Boolean) - True if overnight shift continuation from previous day
- **Validation:**
    - User must have role STAFF
    - Cannot view other staff's schedules
- **Business rules:** BR-49 (Staff can only view their own shifts).
- **Normal case:**
    1. Staff opens "My Schedule" tab.
    2. System displays calendar with 5 shifts marked for the current week.
    3. Staff clicks on Monday 2026-03-10 → Sees shift 08:00-17:00 with 1h lunch break.
    4. Staff sees slot stats: 15 total slots, 8 booked, 7 available.
- **Abnormal/Exception cases:**
    - A1. No shifts assigned → Display empty state "Bạn chưa có ca làm việc nào".
    - A2. Overnight shift display → Show on both workDate and next day with "(Tiếp ca)" badge.

 #### *3.7.5 Create Staff Shift (UC-CM-06)*
**User Story:**
> *As a Clinic Manager, I want to assign specific working hours for Staff across multiple dates using a visual drag-to-create interface so that I can quickly schedule shifts without filling forms.*

**Function trigger**
- **Navigation path:** Manager Dashboard → Schedules → Calendar Grid View → Click empty cell + drag.
- **Timing frequency:** Weekly or monthly planning.

**Function description**
- **Actors/Roles:** Clinic Manager, Clinic Owner.
- **Purpose:** Create staff work shifts using visual drag-to-create UX with automatic slot generation.
- **Interface (Web):**
    1. **Staff Shift Grid (Calendar Table):**
       - **Rows:** Staff members (each staff = 1 row)
       - **Columns:** Dates (week view, 7 columns for Mon-Sun)
       - **Cells:** Empty (clickable) or Shift blocks (colored with time range)
    2. **Drag-to-Create Interaction:**
       - **Step 1:** Manager clicks empty cell → **Staff Selector Dropdown** appears inline
       - **Step 2:** Manager selects staff from dropdown
       - **Step 3:** Manager **drags mouse horizontally** across date cells to select multi-day range
       - **Step 4:** On **mouse release** → System auto-creates shifts with default time (08:00-17:00)
       - **No modal form**, no manual date/time input needed
    3. **Shift Block (Visual):**
       - Color-coded by staff
       - Shows time range (e.g., "08:00-17:00")
       - Click to view details in sidebar
    4. **Sidebar Detail Panel (when click existing shift):**
       - Staff name + avatar
       - Work date(s)
       - Time range (start, end, break)
       - Slot statistics (total, booked, available, blocked)
       - Actions: **Delete Shift** button

**Data processing**
1. Manager opens Calendar Grid View (default: current week).
2. Manager clicks an empty cell in the grid → Staff selector dropdown appears.
3. Manager selects staff "Dr. Nguyen Minh" from dropdown.
4. Manager **holds mouse button and drags** across 3 date cells (Mon, Tue, Wed).
5. On **mouse release**, system captures:
   - Selected staffId
   - Start date (first cell) and end date (last cell)
   - Default time: 08:00-17:00 (from clinic operating hours)
6. System sends API request with:
   - staffId
   - workDates: [Mon, Tue, Wed]
   - startTime: 08:00
   - endTime: 17:00
   - breakStart/breakEnd: auto-filled from clinic OH
   - repeatWeeks: 1 (default, no repeat)
7. System validates against clinic operating hours and existing shifts.
8. System creates 3 StaffShift records and auto-generates ~16 slots per shift.
9. Grid auto-refreshes → New shift blocks appear in colored cells.
10. Toast displays: "Created 3 shifts for Dr. Nguyen Minh".

**Screen layout**
Figure 35. Staff Shift Grid Calendar - Drag-to-Create (Web)
Figure 36. Sidebar Shift Detail Panel (Web)

**Function details**
- **Data:**
    - **Shift Creation Request (auto-generated from drag interaction):**
        - staffId (UUID, required) - Selected from dropdown
        - workDates (List<LocalDate>, required) - Date range from drag selection (1-14 dates)
        - startTime (LocalTime, default) - 08:00 (or clinic opening time)
        - endTime (LocalTime, default) - 17:00 (or clinic closing time)
        - breakStart (LocalTime, optional) - Auto-filled from clinic operating hours
        - breakEnd (LocalTime, optional) - Auto-filled from clinic operating hours
        - isOvernight (Boolean, default false) - Calculated based on time
        - repeatWeeks (Integer, default 1) - No repeat for drag-create
        - forceUpdate (Boolean, default false) - Skip conflicts by default
        - notes (String, optional) - Empty for drag-create
    - **Response:**
        - List of StaffShiftResponse (newly created shifts)
        - Summary: "Created X shifts, skipped Y (conflicts)"
- **Validation:**
    - **Error Handling:**
        - E1. Staff not found → "Nhân viên không tồn tại"
        - E2. Staff not in this clinic → "Nhân viên không thuộc phòng khám này"
        - E3. More than 14 dates dragged → "Không thể tạo quá 14 ca cùng lúc"
        - E4. Work date in the past → Skip with warning
        - E5. Clinic closed on dragged day → Skip with warning "Phòng khám đóng cửa vào Thứ Hai"
        - E6. Shift already exists and forceUpdate=false → Skip with warning "Đã có ca làm"
    - **Field Validation:**
        - workDates: At least 1 date (from drag), max 14 dates
        - Default time range must be within clinic operating hours
    - **Drag Interaction Validation:**
        - Must drag horizontally (across dates in same row)
        - Must select staff before dragging
        - Cannot drag across different staff rows
- **Business rules:** BR-50 (Auto slot generation), BR-51 (Default time from clinic OH), BR-52 (Skip conflicts without prompt).
- **Normal case:**
    1. Manager opens Calendar Grid for Week 12 (March 10-16).
    2. Manager clicks empty cell on Monday row for Dr. Nguyen Minh.
    3. Staff dropdown appears → Manager selects "Dr. Nguyen Minh".
    4. Manager drags from Monday to Friday (5 cells).
    5. Manager releases mouse → System creates 5 shifts (Mon-Fri, 08:00-17:00).
    6. Grid refreshes → 5 colored shift blocks appear.
    7. Toast: "Created 5 shifts for Dr. Nguyen Minh".
- **Abnormal/Exception cases:**
    - A1. Drag includes past date (Sunday is yesterday) → System skips Sunday, creates 4 shifts (Mon-Thu), toast: "Created 4 shifts, skipped 1 (past date)".
    - A2. Shift already exists on Wednesday → System creates Mon, Tue, Thu, Fri (4 shifts), skips Wed, toast: "Created 4 shifts, skipped 1 (already exists)".
    - A3. Clinic closed on Tuesday → System creates Mon, Wed, Thu, Fri (4 shifts), skips Tue, toast: "Created 4 shifts, skipped 1 (clinic closed)".
    - A4. Manager drags more than 14 cells → System limits to first 14 dates, shows warning modal "Tối đa 14 ca cùng lúc".
    - A5. Network error during creation → Loading indicator, retry button appears.


 #### *3.7.6 View Staff Shift (UC-CM-07)*
**User Story:**
> *As a Clinic Manager, I want to view all staff shifts for my clinic in a date range so that I can monitor coverage and identify scheduling gaps.*

**Function trigger**
- **Navigation path:** Manager Dashboard → Schedules → Select date range.
- **Timing frequency:** Daily or on demand.

**Function description**
- **Actors/Roles:** Clinic Manager, Clinic Owner.
- **Purpose:** View all staff shifts in a calendar or list format for scheduling oversight.
- **Interface:**
    1. **Calendar View:** Monthly calendar with color-coded shift indicators per staff
    2. **List View:** Table with columns: Staff Name, Date, Time, Slots Stats, Actions
    3. **Date Range Picker:** Filter by start/end date
    4. **Staff Filter:** Dropdown to view shifts for specific staff or "All Staff"
    5. **Shift Detail Modal:** Click on shift → View full details + slot breakdown

**Data processing**
1. Manager selects date range (e.g., current week).
2. System queries all shifts for clinic in that range.
3. System includes overnight shifts from previous day that extend into range.
4. System displays shifts in calendar with staff name + time labels.
5. Manager clicks on shift → Modal shows detailed slot list with booking info.

**Screen layout**
Figure 37. Screen Staff Shift Calendar (Web)
Figure 38. Screen Shift Detail Modal (Web)

**Function details**
- **Data:**
    - clinicId (UUID, required) - Clinic ID from path
    - startDate (LocalDate, required) - Start of date range
    - endDate (LocalDate, required) - End of date range
    - Response: List of StaffShiftResponse (same structure as UC-STAFF-01)
    - Shift Detail includes:
        - slots (List of SlotResponse) - All 30-minute slots with status
        - Each SlotResponse contains:
            - slotId (UUID)
            - startTime/endTime (LocalTime)
            - status (AVAILABLE/BOOKED/BLOCKED)
            - bookingId (UUID, if booked)
            - petName/petOwnerName (String, if booked)
            - serviceName/serviceCategory (String, if booked)
- **Validation:**
    - User must be Clinic Manager/Owner of this clinic
    - Date range cannot exceed 3 months
- **Business rules:** BR-53 (Overnight shifts appear on next day with continuation badge).
- **Normal case:**
    1. Manager opens Schedule Calendar.
    2. Manager selects "This Week" → Sees 25 shifts across 5 staff members.
    3. Manager clicks on "Dr. Minh - Mon 08:00-17:00".
    4. Modal shows 16 slots: 8 booked (green), 6 available (blue), 2 blocked (gray).
    5. Manager sees booking details for booked slots (pet name + service).
- **Abnormal/Exception cases:**
    - A1. No shifts in range → Empty state "Chưa có ca làm việc nào trong khoảng thời gian này".
    - A2. Overnight shift → Displayed on both days with badge "(Ca đêm)" and "(Tiếp ca)".

 #### *3.7.7 Delete Staff Shift (UC-CM-08)*
**User Story:**
> *As a Clinic Manager, I want to delete a staff shift so that I can correct scheduling mistakes or handle staff unavailability.*

**Function trigger**
- **Navigation path:** Schedule Calendar/List → Select Shift → "Delete Shift".
- **Timing frequency:** On demand.

**Function description**
- **Actors/Roles:** Clinic Manager, Clinic Owner.
- **Purpose:** Remove a scheduled shift from the system.
- **Interface:**
    1. **Delete Button:** Three-dot menu → "Delete Shift"
    2. **Confirmation Dialog:** Warning with shift details + booked slots count
    3. **Confirm/Cancel Buttons:** Final action

**Data processing**
1. Manager clicks "Delete Shift" for a specific shift.
2. System checks if shift has booked slots (status BOOKED).
3. If booked slots exist → Block deletion with error message.
4. If no booked slots → Display confirmation modal.
5. Manager confirms → System deletes shift (cascade deletes available/blocked slots).
6. System sends notification to staff: "Ca làm ngày {date} đã bị hủy".

**Screen layout**
Figure 39. Screen Delete Shift Confirmation (Web)

**Function details**
- **Data:**
    - shiftId (UUID, required) - Shift ID to delete
- **Validation:**
    - **Error Handling:**
        - E1. Shift has booked slots → "Không thể xóa ca có lịch hẹn đang hoạt động"
        - E2. Shift not found → "Ca làm việc không tồn tại"
        - E3. Shift not in manager's clinic → "Không có quyền xóa ca làm của phòng khám khác"
    - **Authorization:**
        - Only Clinic Manager/Owner can delete shifts
- **Business rules:** BR-54 (Cannot delete shifts with active bookings).
- **Normal case:**
    1. Manager selects shift "Dr. Minh - Fri 08:00-17:00".
    2. Manager clicks "Delete Shift".
    3. Confirmation: "Delete shift on 2026-03-14? No bookings affected."
    4. Manager confirms → Shift deleted, 16 slots removed.
    5. Notification sent to Dr. Minh: "Ca làm ngày 2026-03-14 đã bị hủy".
    6. Toast: "Shift deleted successfully".
- **Abnormal/Exception cases:**
    - A1. Shift has 3 booked slots → Error: "Không thể xóa ca có lịch hẹn đang hoạt động".
    - A2. Manager tries to delete shift from yesterday → Allowed (past shifts can be deleted for cleanup).

 #### *3.7.8 Bulk Delete Shifts (UC-CM-09)*
**User Story:**
> *As a Clinic Manager, I want to delete multiple shifts at once so that I can quickly clear incorrect schedules or handle mass cancellations.*

**Function trigger**
- **Navigation path:** Schedule Calendar → Multi-select mode → Select shifts → "Delete Selected".
- **Timing frequency:** On demand.

**Function description**
- **Actors/Roles:** Clinic Manager, Clinic Owner.
- **Purpose:** Delete multiple shifts in a single operation for efficiency.
- **Interface:**
    1. **Multi-select Mode:** Checkbox on each shift card
    2. **Select All Button:** Bulk select all visible shifts
    3. **Delete Selected Button:** Appears when ≥2 shifts selected
    4. **Confirmation Dialog:** Shows list of shifts to delete + total booked slots count
    5. **Progress Indicator:** Shows deletion progress (X/N shifts deleted)

**Data processing**
1. Manager enables multi-select mode.
2. Manager selects 5 shifts across different staff and dates.
3. Manager clicks "Delete Selected".
4. System validates each shift:
    - Shifts with booked slots → Skipped with warning
    - Shifts without booked slots → Queued for deletion
5. Confirmation modal shows: "Delete 5 shifts? 2 shifts have bookings and will be skipped."
6. Manager confirms → System deletes valid shifts one by one.
7. System sends individual notifications to affected staff.
8. Toast displays summary: "Deleted 3 shifts, skipped 2 (active bookings)".

**Screen layout**
Figure 40. Screen Bulk Delete Shifts (Web)
Figure 41. Screen Bulk Delete Confirmation Dialog (Web)

**Function details**
- **Data:**
    - shiftIds (List<UUID>, required) - List of shift IDs to delete (min 2, max 100)
- **Validation:**
    - **Error Handling:**
        - E1. Empty list → "Vui lòng chọn ít nhất một ca làm việc"
        - E2. More than 100 shifts → "Không thể xóa quá 100 ca cùng lúc"
        - E3. Individual shift errors → Collected and displayed in summary
    - **Partial Success Handling:**
        - System processes all shifts individually
        - Shifts with bookings are skipped, others deleted
        - Final toast shows: success count + skipped count + reasons
- **Business rules:** BR-55 (Partial deletion allowed, display summary of results).
- **Normal case:**
    1. Manager selects 10 shifts for "Dr. Minh" next week.
    2. Manager clicks "Delete Selected".
    3. Confirmation: "Delete 10 shifts? All shifts are available."
    4. Manager confirms → System deletes 10 shifts in ~2 seconds.
    5. Notification to Dr. Minh: "10 ca làm mới bị hủy".
    6. Toast: "Deleted 10 shifts successfully".
- **Abnormal/Exception cases:**
    - A1. Mixed results → "Deleted 7 shifts, skipped 3 (2 with bookings, 1 not found)".
    - A2. All shifts have bookings → "Cannot delete any shifts: all have active bookings".

---

### 3.8 Booking & Appointment Lifecycle Flow

 #### *3.8.1 Book Appointment (UC-PO-06 / UC-PO-07)*
**User Story:**
> *As a Pet Owner, I want to search and book a veterinary service for my pet at a specific time so that I can ensure they get the care they need.*

**Function trigger**
- **Navigation path:** Clinic Details → "Book Now" OR Mobile Home → "Quick Booking".
- **Timing frequency:** On demand.

**Function description**
- **Actors/Roles:** Pet Owner.
- **Purpose:** Pre-book a veterinary service at a specific time and location.
- **Interface:**
    - Pet Selection – dropdown/list
    - Service Selection – dropdown/list
    - Calendar – date selection
    - Slot Grid – select 30-minute intervals
    - "Proceed to Payment" – primary action button

**Data processing**
1. **[BOK-1] Mobile Booking Wizard (3-step Flow):**
    - **Step 1: Service Selection**: Owner selects one or more services.
    - **Step 2: Time Selection (Smart Availability)**: System finds slots where a vet with required specialty is free.
    - **Step 3: Review & Summary**: Calculation of `Base Price` + `Surcharge` + `Distance Fee` (for UC-PO-07).
2. System creates a `BOOKING` record with `PENDING` status.
3. System locks the selected slots for 15 minutes.

 #### *3.8.2 Process Payment (UC-PO-10)*
**User Story:**
> *As a Pet Owner, I want to securely pay for my booking online so that my appointment is confirmed.*

**Data processing**
1. User enters card info (Stripe).
2. Upon success:
    - Booking status: `PENDING` → `CONFIRMED`.
    - Payment status: `UNPAID` → `PAID`.
3. System notifies Clinic Manager via Web Dashboard.

 #### *3.8.3 Lifecycle Stages & Workflow Statuses*
The system tracks the full physical and logistical flow of each appointment using implemented booking statuses:

| Status | Trigger | Description |
| :--- | :--- | :--- |
| **PENDING** | Booking Created | Waiting for payment completion (15-min TTL). |
| **CONFIRMED** | Payment Success | Appointment is locked. Clinic confirms and staff is assigned. |
| **IN_PROGRESS** | Staff Action | Staff starts moving (for HOME_VISIT/SOS) or starts examination (IN_CLINIC). |
| **COMPLETED** | System | Final archival status. Review popup triggered for Owner. |
| **CANCELLED** | User/System Action | Booking is cancelled before service execution. |
| **NO_SHOW** | Staff/Clinic Action | Owner does not arrive within allowed grace period. |

 #### *3.8.4 Assign Staff to Booking (UC-CM-06)*
**User Story:**
> *As a Clinic Manager, I want to assign a qualified veterinarian to each pending appointment so that the service is delivered by the right professional.*

**Function trigger**
- **Navigation path:** Manager Dashboard → Management → Booking Dashboard → Click "Chi tiết" on PENDING/CONFIRMED booking.

**Data processing:**
1. Manager selects vet per service based on specialty matching.
2. System verifies vet availability and assigns.
3. Booking status remains `CONFIRMED` (Staff assigned).

 #### *3.8.5 Handle Patient Check-in/Out (UC-VT-05 / UC-CM-10)*
**Data processing:**
1. Check-in: Status → `IN_PROGRESS`. Start EMR.
2. Check-out: Status → `COMPLETED`. Lock EMR.

 #### *3.8.6 Add Incurred Service / Final Settlement (UC-VT-09)*
1. Staff adds additional services during exam.
2. System updates `total_price`.
3. Payment method check (CASH vs Online) for final settlement.

#### *3.8.7 View My Bookings (UC-PO-08)*
**User Story:**
> As a Pet Owner, I want to view all my bookings in one place so that I can track appointments, past visits, and their statuses.

**Function trigger**
- **Navigation path:** Mobile Home → Tab "Lịch hẹn" hoặc Profile → "Lịch sử đặt lịch".
- **Timing frequency:** On demand.

**Function description**
- **Actors/Roles:** Pet Owner
- **Purpose:** Xem danh sách tất cả các booking đã tạo, bao gồm cả lịch sử và upcoming appointments.
- **Interface:**
    - Tabs: "Sắp tới" / "Đã hoàn thành" / "Đã hủy"
    - Booking Card – hiển thị: Pet, Clinic, Service, Date/Time, Status badge
    - Filter – lọc theo trạng thái, ngày tháng

**Data processing**
1. System query tất cả bookings có `pet_owner_id = current_user`.
2. Nhóm theo status:
    - **Sắp tới:** `PENDING`, `CONFIRMED`, `IN_PROGRESS`
    - **Đã hoàn thành:** `COMPLETED`
    - **Đã hủy:** `CANCELLED`, `NO_SHOW`
3. Hiển thị danh sách với sorting theo `booking_date DESC`.
4. User click vào booking → Xem chi tiết (UC-PO-09 detail view).

**Screen layout**
Figure 38. Screen My Bookings List (Mobile) - Tab-based view.

**Function details**
- **Data:**
    - Request: `GET /api/bookings/my?status={status}&page={page}`
    - Response: `List<BookingDTO>` (id, petName, clinicName, serviceName, bookingDate, bookingTime, status, totalPrice)
- **Validation:** User phải đăng nhập.
- **Business rules:** BR-BOK-08 tại (5.1 Business Rules)
- **Normal case:** Danh sách hiển thị đầy đủ thông tin, status badge màu sắc rõ ràng.
- **Abnormal/Exception cases:**
    - A1. Chưa có booking nào → Hiển thị empty state "Bạn chưa có lịch hẹn nào".
    - A2. Network error → Toast "Không thể tải danh sách lịch hẹn".

#### *3.8.8 Cancel Booking (UC-PO-09)*
**User Story:**
> As a Pet Owner, I want to cancel my booking if I can no longer attend so that the slot becomes available for others.

**Function trigger**
- **Navigation path:** My Bookings → Chọn booking → Nút "Hủy lịch".
- **Timing frequency:** Before check-in.

**Function description**
- **Actors/Roles:** Pet Owner
- **Purpose:** Hủy booking khi chưa đến giờ hẹn hoặc chưa check-in.
- **Interface:**
    - Booking Detail Screen
    - "Hủy lịch hẹn" – danger button
    - Confirmation Modal – yêu cầu xác nhận + nhập lý do (optional)

**Data processing**
1. User click "Hủy lịch hẹn" → Modal xác nhận hiển thị.
2. User confirm → System kiểm tra:
    - Status phải là `PENDING`, `CONFIRMED` (chưa `IN_PROGRESS`).
    - Nếu status ≥ `IN_PROGRESS` → Không cho phép hủy.
3. System thực hiện:
    - Update `booking.status = CANCELLED`.
    - Restore slots về `AVAILABLE`.
    - Tạo notification cho Staff và Clinic Manager.
    - Nếu thanh toán online → Tạo refund request (UC-CM-07).
4. Toast: "Đã hủy lịch hẹn thành công".

**Screen layout**
Figure 39. Screen Cancel Booking Confirmation (Mobile) - Modal dialog.

**Function details**
- **Data:**
    - Request: `PUT /api/bookings/{id}/cancel` + `{ reason: "..." }`
    - Response: `{ success: true, message: "Đã hủy lịch hẹn" }`
- **Validation:**
    - Booking phải thuộc về user hiện tại.
    - Status phải < `IN_PROGRESS`.
- **Business rules:** BR-BOK-09 tại (5.1 Business Rules)
- **Normal case:** Booking status → `CANCELLED`, slots restored, notifications sent.
- **Abnormal/Exception cases:**
    - A1. Status = `IN_PROGRESS` → Toast "Không thể hủy lịch đã bắt đầu thực hiện dịch vụ".
    - A2. Booking không tồn tại → Toast "Lịch hẹn không hợp lệ".
    - A3. Network error → Toast "Không thể hủy lịch hẹn. Vui lòng thử lại".

 #### *3.8.9 View Assigned Bookings (UC-ST-03)*
**User Story:**
> As a Staff, I want to see all bookings assigned to me so that I know my schedule and can prepare for appointments.

**Function trigger**
- **Navigation path:** Staff Mobile Home → Tab "Lịch hẹn" OR Staff Web Dashboard → Menu "Lịch của tôi".
- **Timing frequency:** On demand.

**Function description**
- **Actors/Roles:** Staff
- **Purpose:** See bookings assigned to currently logged in staff.
- **Interface:**
    - Calendar View – tháng/tuần/ngày
    - List View – danh sách theo ngày
    - Booking Card – hiển thị: Pet, Owner, Service, Time, Status
    - Filter – lọc theo ngày, status

**Data processing**
1. System query tất cả bookings có `assigned_staff_id = current_staff`.
2. Hiển thị theo 2 chế độ:
    - **Calendar Mode:** Đánh dấu ngày có booking, click vào ngày → List view.
    - **List Mode:** Danh sách chi tiết từng booking, sorted by `booking_date`, `booking_time`.
3. Color-coded badges theo status:
    - `CONFIRMED`: Vàng (Đã xác nhận, chờ bắt đầu)
    - `IN_PROGRESS`: Tím (Đang thực hiện dịch vụ)
    - `COMPLETED`: Xanh lá (Hoàn thành)
    - `CANCELLED`/`NO_SHOW`: Xám/Đỏ (Đã hủy/Không đến)
4. User click vào booking → Xem chi tiết pet + owner + EMR cũ.

**Screen layout**
Figure 40. Screen Assigned Bookings (Mobile/Web) - Calendar + List hybrid.

**Function details**
- **Data:**
    - Request: `GET /api/bookings/staff/{staffId}?status={status}&page={page}&size={size}`
    - Response: `List<BookingDetailDTO>` (id, petName, petSpecies, ownerName, ownerPhone, serviceName, bookingDate, bookingTime, status, previousEMR)
- **Validation:** User phải có role `STAFF`.
- **Business rules:** BR-VT-03 tại (5.1 Business Rules)
- **Normal case:** Danh sách hiển thị đầy đủ, có thể filter và sort.
- **Abnormal/Exception cases:**
    - A1. Chưa có booking nào → Hiển thị empty state "Bạn chưa có lịch hẹn nào".
    - A2. Network error → Toast "Không thể tải danh sách lịch hẹn".

#### *3.8.10 Update Appointment Progress (UC-VT-04)*
**User Story:**
> As a Staff, I want to update the appointment status as I progress through check-in, examination, and check-out so that the system reflects real-time appointment state.

**Function trigger**
- **Navigation path:** Assigned Bookings → Chọn booking → Các nút action theo status.
- **Timing frequency:** During appointment lifecycle.

**Function description**
- **Actors/Roles:** Staff
- **Purpose:** Cập nhật trạng thái booking qua các giai đoạn đang được triển khai trong code: CONFIRMED → IN_PROGRESS → COMPLETED.
- **Interface:**
    - Booking Detail Screen với action buttons tùy status:
        - Status `CONFIRMED`:
            - IN_CLINIC/HOME_VISIT → Nút "Bắt đầu thực hiện dịch vụ" (check-in)
            - SOS → Nút "Bắt đầu di chuyển" (start-moving)
        - Status `IN_PROGRESS`:
            - Có thể thêm dịch vụ phát sinh
            - HOME_VISIT/SOS → "Xem lại hóa đơn & thanh toán" (checkout)
            - IN_CLINIC → "Hoàn tất khám" (complete)

**Data processing**
1. **Check-in Flow (UC-VT-05):**
    - Staff click "Bắt đầu thực hiện dịch vụ" → Status `CONFIRMED` → `IN_PROGRESS`.
    - System tạo EMR shell rỗng với `booking_id`, `pet_id`, `vet_id`.
    - Notification → Pet Owner: "Thú cưng của bạn đang được khám".

2. **Start Moving (SOS):**
    - Staff click "Bắt đầu di chuyển" → Status `CONFIRMED` → `IN_PROGRESS`.
    - Bật GPS tracking real-time cho SOS.

3. **Finish & Settlement:**
    - Staff click "Hoàn thành khám" → Modal xác nhận.
    - Với HOME_VISIT/SOS: thực hiện checkout để chốt hóa đơn và chuyển `COMPLETED`.
    - Với IN_CLINIC: complete trực tiếp từ `IN_PROGRESS` → `COMPLETED`.

**Screen layout**
Figure 41. Screen Appointment Progress Actions (Mobile) - Context-aware buttons.

**Function details**
- **Data:**
    - Request (implemented):
        - `POST /api/bookings/{id}/check-in`
        - `POST /api/bookings/{id}/start-moving`
        - `POST /api/bookings/{id}/checkout`
    - Response: `{ success: true, newStatus: "..." }`
- **Validation:**
    - Status transitions phải tuân thủ state machine (BOOKING_WORKFLOW.md).
    - Chỉ cho phép chuyển từ `CONFIRMED` → `IN_PROGRESS` hoặc `IN_PROGRESS` → `COMPLETED` theo action hợp lệ.
- **Business rules:** BR-VT-04 tại (5.1 Business Rules)
- **Normal case:** Status update smooth, notifications sent đúng actor.
- **Abnormal/Exception cases:**
    - A1. EMR chưa đầy đủ khi muốn hoàn tất lịch hẹn → Toast "Vui lòng hoàn thành EMR trước khi kết thúc".
    - A2. Invalid status transition → Toast "Không thể chuyển trạng thái này".

#### *3.8.11 Check-in Patient (UC-VT-05)*
**User Story:**
> As a Staff, I want to check in a patient when they arrive so that the examination process can begin.

**Function trigger**
- **Navigation path:** Assigned Bookings → Chọn booking với status `CONFIRMED` → Nút "Bắt đầu thực hiện dịch vụ".
- **Timing frequency:** When patient arrives.

**Function description**
- **Actors/Roles:** Staff
- **Purpose:** Xác nhận pet owner và thú cưng đã có mặt, bắt đầu quy trình khám.
- **Interface:**
    - Booking Detail Screen
    - "Check-in" – primary action button
    - Confirmation: "Xác nhận pet owner và thú cưng đã có mặt?"

**Data processing**
1. Staff click "Check-in" → Modal xác nhận hiển thị.
2. Staff confirm → System:
    - Update `booking.status = IN_PROGRESS`.
    - Tạo EMR shell rỗng (MongoDB).
    - Notification → Pet Owner: "Thú cưng của bạn đang được khám".
3. Staff bắt đầu nhập EMR và cập nhật dịch vụ phát sinh (nếu có).

**Screen layout**
Figure 42. Screen Check-in Confirmation (Mobile) - Simple modal.

**Function details**
- **Data:**
    - Request: `PUT /api/bookings/{id}/check-in`
    - Response: `{ success: true, emrId: "...", message: "Đã check-in" }`
- **Validation:**
    - Booking phải có status `CONFIRMED`.
    - Staff phải là assigned staff của booking.
- **Business rules:** BR-VT-05 tại (5.1 Business Rules)
- **Normal case:** Status → `IN_PROGRESS`, EMR shell tạo, notification gửi.
- **Abnormal/Exception cases:**
    - A1. Pet owner chưa đến → Staff có thể đánh dấu `NO_SHOW` (sau 15 phút).
    - A2. Booking đã check-in rồi → Toast "Booking đã được check-in trước đó".

#### *3.8.12 Mark Treatment Finished (UC-VT-09)*
**User Story:**
> As a Staff, I want to mark the treatment as finished after completing the examination and EMR documentation so that the booking can proceed to payment and checkout.

**Function trigger**
- **Navigation path:** Booking Detail (status `IN_PROGRESS`) → Nút "Hoàn thành khám".
- **Timing frequency:** After EMR is complete.

**Function description**
- **Actors/Roles:** Staff
- **Purpose:** Kết thúc quá trình khám, đánh dấu booking sẵn sàng thanh toán.
- **Interface:**
    - Booking Detail Screen với EMR summary
    - "Hoàn thành khám" – success button
    - Final Check Modal – hiển thị summary của EMR, yêu cầu xác nhận

**Data processing**
1. Staff click "Hoàn thành khám" → System validate:
    - EMR phải có `assessment` (mandatory).
    - EMR phải có `plan` (mandatory).
    - Nếu thiếu → Show error toast.
2. Nếu hợp lệ → Modal xác nhận hiển thị:
    - EMR summary (Subjective, Objective, Assessment, Plan).
    - Prescription summary (nếu có).
    - "Xác nhận hoàn thành khám?"
3. Staff confirm → System:
    - Update `booking.status = COMPLETED`.
    - Lock EMR (status `FINALIZED`, không thể chỉnh sửa nữa).
    - Notification → Clinic Manager: "Booking đã hoàn tất".
    - Notification → Pet Owner: "Lịch hẹn đã hoàn thành".

**Screen layout**
Figure 43. Screen Mark Treatment Finished (Mobile) - EMR summary modal.

**Function details**
- **Data:**
    - Request: `POST /api/bookings/{id}/checkout`
    - Response: `{ success: true, message: "Đã thanh toán và hoàn tất khám" }`
- **Validation:**
    - Booking status phải là `IN_PROGRESS`.
    - EMR phải có `assessment` và `plan`.
- **Business rules:** BR-VT-09 tại (5.1 Business Rules)
- **Normal case:** Status → `COMPLETED`, EMR locked, các thông báo hoàn tất được gửi.
- **Abnormal/Exception cases:**
    - A1. EMR chưa đầy đủ → Toast "Vui lòng hoàn thành Assessment và Plan trước".
    - A2. Network error → Toast "Không thể hoàn thành khám. Vui lòng thử lại".

#### *3.8.13 Staff Home Dashboard Summary (UC-VT-14)*
**User Story:**
> As a Staff, I want to see a summary of my daily schedule, upcoming appointments, and pending tasks on my home dashboard so that I can quickly understand my workload.

**Function trigger**
- **Navigation path:** Staff Mobile App Launch → Home Screen OR Staff Web Login → Dashboard.
- **Timing frequency:** On login, on refresh.

**Function description**
- **Actors/Roles:** Staff
- **Purpose:** Hiển thị tổng quan nhanh về lịch làm việc hôm nay và các task cần xử lý.
- **Interface:**
    - Dashboard Cards:
        - "Lịch hôm nay" – số ca làm, giờ làm việc
        - "Lịch hẹn hôm nay" – số booking (tổng / đã khám / còn lại)
        - "Cần xử lý" – số booking đang `CONFIRMED` hoặc `IN_PROGRESS`
        - "Upcoming" – booking sắp tới (trong 2 giờ)

**Data processing**
1. System query:
    - **Today's Shifts:** `SELECT * FROM staff_shifts WHERE staff_id = {id} AND work_date = TODAY`.
    - **Today's Bookings:** `SELECT * FROM bookings WHERE assigned_staff_id = {id} AND booking_date = TODAY`.
2. Tính toán:
    - Total bookings hôm nay.
    - Completed bookings (status `COMPLETED`).
    - Pending bookings (status `CONFIRMED`, `IN_PROGRESS`).
    - Upcoming bookings (booking_time trong 2 giờ tới).
3. Hiển thị cards với số liệu và quick actions:
    - "Xem lịch chi tiết" → Navigate to Calendar.
    - "Xem booking cần xử lý" → Navigate to Assigned Bookings (filter `IN_PROGRESS`).

**Screen layout**
Figure 44. Screen Staff Dashboard Summary (Mobile) - Card-based layout.

**Function details**
- **Data:**
    - Request: `GET /api/bookings/staff/home-summary`
    - Response: `{ totalShifts, shiftHours, totalBookings, completedBookings, pendingBookings, upcomingBookings[] }`
- **Validation:** User phải có role `STAFF`.
- **Business rules:** BR-VT-14 tại (5.1 Business Rules)
- **Normal case:** Dashboard hiển thị đầy đủ thông tin realtime.
- **Abnormal/Exception cases:**
    - A1. Không có ca làm hôm nay → Hiển thị "Bạn không có ca làm hôm nay".
    - A2. Network error → Toast "Không thể tải dashboard".

#### *3.8.14 Handle Cancellations & Refunds (UC-CM-07)*
**User Story:**
> As a Clinic Manager, I want to handle booking cancellations and process refunds so that customers are fairly compensated when appointments are cancelled.

**Function trigger**
- **Navigation path:** Manager Dashboard → "Booking đã hủy" section OR Notification "Booking bị hủy".
- **Timing frequency:** When Pet Owner cancels booking.

**Function description**
- **Actors/Roles:** Clinic Manager
- **Purpose:** Xử lý booking bị hủy, quyết định refund policy.
- **Interface:**
    - Cancelled Bookings List
    - Booking Detail Screen với info: Who cancelled, Reason, Payment status
    - Refund Actions:
        - "Hoàn tiền toàn bộ" – full refund
        - "Hoàn tiền một phần" – partial refund (input percentage)
        - "Không hoàn tiền" – no refund (theo policy)

**Data processing**
1. Pet Owner hủy booking (UC-PO-09) → System:
    - Update `booking.status = CANCELLED`.
    - Tạo notification → Manager.
2. Manager xem cancelled booking → Kiểm tra:
    - Payment method: `ONLINE` (cần refund) hoặc `CASH` (không cần refund).
    - Cancellation timing: Bao lâu trước giờ hẹn?
3. Manager chọn refund action:
    - **Full Refund (100%):** Nếu hủy trước 24h.
    - **Partial Refund (50%):** Nếu hủy trong vòng 24h.
    - **No Refund (0%):** Nếu hủy trong vòng 2h (theo policy BR-CM-07).
4. System thực hiện:
    - Tạo refund request tới Stripe (nếu online payment).
    - Update `payment.status = REFUNDED` hoặc `PARTIALLY_REFUNDED`.
    - Notification → Pet Owner: "Đã hoàn tiền {amount}".

**Screen layout**
Figure 45. Screen Handle Cancellations (Web) - Refund action modal.

**Function details**
- **Data:**
    - Request: `POST /api/bookings/{id}/refund` + `{ refundType: "FULL" | "PARTIAL", percentage: 50 }`
    - Response: `{ success: true, refundAmount: 200000, message: "Đã hoàn tiền" }`
- **Validation:**
    - Booking status phải là `CANCELLED`.
    - Payment status phải là `PAID`.
- **Business rules:** BR-CM-07 tại (5.1 Business Rules)
- **Normal case:** Refund processed, notification sent, payment status updated.
- **Abnormal/Exception cases:**
    - A1. Stripe refund failed → Toast "Hoàn tiền thất bại. Vui lòng thử lại".
    - A2. Payment đã refund rồi → Toast "Booking này đã được hoàn tiền".

#### *3.8.15 Receive Payment & Checkout (UC-CM-10)*
**User Story:**
> As a Staff/Clinic Manager, I want to finalize payment and complete the booking so that the appointment lifecycle is closed correctly.

**Function trigger**
- **Navigation path:** Booking Detail với status `IN_PROGRESS` → Nút "Xem lại hóa đơn & thanh toán" (HOME_VISIT/SOS) hoặc "Hoàn tất khám" (IN_CLINIC).
- **Timing frequency:** Khi kết thúc dịch vụ thực tế.

**Function description**
- **Actors/Roles:** Staff, Clinic Manager
- **Purpose:** Chốt hóa đơn thực tế (bao gồm dịch vụ phát sinh), cập nhật thanh toán và hoàn tất booking.
- **Interface:**
    - Booking Detail Screen với payment summary:
        - Total amount (base + add-ons).
        - Payment method (CASH / ONLINE).
    - Action buttons:
        - Nếu `CASH` → "Xác nhận đã nhận tiền" (input amount).
        - Nếu `ONLINE` (đã paid trước) → "Hoàn tất checkout" (direct confirm).

**Data processing**
1. Người dùng kiểm tra booking status = `IN_PROGRESS`.
2. Người dùng mở màn hình checkout, hệ thống tổng hợp giá trị cuối cùng:
    - Dịch vụ ban đầu + dịch vụ phát sinh.
    - Phí di chuyển/SOS (nếu có).
3. Người dùng xác nhận thanh toán (theo phương thức áp dụng) và checkout.
4. System hoàn tất:
    - Update `payment.status = PAID`.
    - Update `booking.status = COMPLETED`.
    - Notification → Pet Owner: "Đã hoàn thành khám. Cảm ơn bạn!".
    - Trigger review popup sau 1 phút (UC-PO-13).

**Screen layout**
Figure 46. Screen Receive Payment & Checkout (Web) - Payment confirmation modal.

**Function details**
- **Data:**
    - Request: `POST /api/bookings/{id}/checkout`.
    - Response: `{ success: true, message: "Đã hoàn thành checkout" }`
- **Validation:**
    - Booking status phải là `IN_PROGRESS`.
- **Business rules:** BR-CM-10 tại (5.1 Business Rules)
- **Normal case:** Payment confirmed, booking completed, review triggered.
- **Abnormal/Exception cases:**
    - A1. Amount nhận < total price → Toast "Số tiền nhận không đủ".
    - A2. Booking không ở trạng thái IN_PROGRESS → Toast "Chưa thể checkout".

#### *3.8.16 Check Staff Availability (UC-CM-14)*
**User Story:**
> As a Clinic Manager, I want to check a vet's availability before assigning them to a booking so that I don't create scheduling conflicts.

**Function trigger**
- **Navigation path:** Manager Dashboard → Booking Detail (PENDING/CONFIRMED) → Click "Gán nhân viên" → Modal hiển thị danh sách Staff.
- **Timing frequency:** Before assigning vet.

**Function description**
- **Actors/Roles:** Clinic Manager
- **Purpose:** Kiểm tra nhân viên nào có slot trống phù hợp với booking time.
- **Interface:**
    - Assign Staff Modal:
        - Dropdown "Chọn nhân viên" với availability indicators
        - "Xem lịch chi tiết" – link to Staff Calendar

**Data processing**
1. Manager chọn booking cần gán vet (booking_date, booking_time, slots_required).
2. System query danh sách vet available tại thời điểm đó.
3. Hiển thị danh sách Staff với:
    - Tên nhân viên.
    - Số slots trống hôm đó.
    - Rating (nếu có).
4. Manager chọn vet → Proceed to UC-CM-06 (Assign Staff).

**Screen layout**
Figure 47. Screen Check Staff Availability (Web) - Modal with vet list.

**Function details**
- **Data:**
    - Request: `GET /api/vets/available?clinicId={id}&date={date}&time={time}&slotsRequired={n}`
    - Response: `[ { vetId, vetName, availableSlots, rating } ]`
- **Validation:** User phải có role `CLINIC_MANAGER`.
- **Business rules:** BR-CM-14 tại (5.1 Business Rules)
- **Normal case:** Danh sách Staff available hiển thị, Manager chọn được.
- **Abnormal/Exception cases:**
    - A1. Không có Staff nào available → Toast "Không có nhân viên khả dụng. Vui lòng chọn giờ khác".
    - A2. Service yêu cầu specialty không có → Toast "Không có nhân viên phù hợp với chuyên môn".

#### *3.8.17 Reassign Staff to Service (UC-CM-15)*
**User Story:**
> As a Clinic Manager, I want to reassign a booking service to a different staff if the originally assigned staff is unavailable so that the appointment can still proceed.

**Function trigger**
- **Navigation path:** Manager Dashboard → Booking với status `CONFIRMED` → Nút "Gán lại nhân viên".
- **Timing frequency:** When vet calls in sick, emergency, or overloaded.

**Function description**
- **Actors/Roles:** Clinic Manager
- **Purpose:** Chuyển booking từ Staff A sang Staff B khi có thay đổi nhân sự.
- **Interface:**
    - Booking Detail Screen
    - "Gán lại nhân viên" – action button
    - Reassign Modal:
        - Current Staff: Dr. Minh
        - Reason for reassignment – dropdown (Staff nghỉ, Staff quá tải, Cấp cứu)
        - New Staff – dropdown (danh sách available vets từ UC-CM-14)

**Data processing**
1. Manager click "Gán lại nhân viên" → Modal hiển thị.
2. Manager chọn lý do reassign và vet mới → Click "Xác nhận".
3. System thực hiện:
    - Unlock slots của Staff cũ (nếu booking chưa bắt đầu thực hiện dịch vụ).
    - Lock slots mới cho Staff mới.
    - Update `booking_service_item.assigned_staff_id` theo từng dịch vụ được gán lại.
    - Notification → Staff cũ: "Booking đã được gán cho nhân viên khác".
    - Notification → Staff mới: "Bạn được gán booking mới".
    - Notification → Pet Owner: "Nhân viên khám thay đổi thành Dr. {new_vet_name}".
4. Toast: "Đã gán lại nhân viên thành công".

**Screen layout**
Figure 48. Screen Reassign Staff (Web) - Modal with reason and vet selector.

**Function details**
- **Data:**
    - Request: `POST /api/bookings/{bookingId}/services/{serviceId}/reassign` + `{ newStaffId: "...", reason: "..." }`
    - Response: `{ success: true, newVetName: "Dr. Hùng", message: "Đã gán lại nhân viên" }`
- **Validation:**
    - Booking status phải là `CONFIRMED` (chưa bắt đầu thực hiện dịch vụ).
    - New Staff phải có slot available tại thời điểm booking.
- **Business rules:** BR-CM-15 tại (5.1 Business Rules)
- **Normal case:** Staff reassigned, notifications sent, slots updated.
- **Abnormal/Exception cases:**
    - A1. Booking đã `IN_PROGRESS` → Toast "Không thể gán lại nhân viên khi đã bắt đầu thực hiện dịch vụ".
    - A2. New Staff không available → Toast "Nhân viên mới không có slot trống".
    - A3. Network error → Toast "Không thể gán lại nhân viên. Vui lòng thử lại".

---

### 3.9 Electronic Medical Records (EMR) Flow

> This section covers all EMR-related functionalities including clinical examination, prescription management, vaccination records, and patient lookup. EMR data is stored in MongoDB for flexible document structure while maintaining references to PostgreSQL entities.

#### *3.9.1 Record Clinical Exam (UC-VT-06)*
**User Story:**
> *As a Staff, I want to document clinical findings using the SOAP method so that the pet's medical history is accurately recorded.*

**Function trigger**
- **Navigation path:** Active Appointment → "Write EMR" OR Examination Hub.
- **Timing frequency:** During the examination.

**Function description**
- **Actors/Roles:** Staff.
- **Purpose:** Document clinical findings and treatment plans according to the SOAP standard.
- **Interface:**
    - [S] Subjective: (Owner symptoms) – text area
    - [O] Objective: (Physical exam/Vital signs) – text area
    - [A] Assessment: (Diagnosis) – text area
    - [P] Plan: (Treatment plan) – text area
    - Clinical Photos – photo upload button

**Data processing**
1. **[EMR-2] Clinical Examination (Mobile/Web SOAP):**
    - System verifies that the Booking status is `IN_PROGRESS` before allowing EMR creation.
    - Staff enters clinical findings:
        - **[S] Subjective**: Owner's observations, pet's behavior.
        - **[O] Objective**: Body temperature, weight (auto-synced to Pet Profile), heart rate, physical status.
        - **[A] Assessment**: Preliminary or final diagnosis. **(Mandatory)**.
        - **[P] Plan**: Treatment steps, follow-up advice. **(Mandatory)**.
2. System auto-populates Pet ID, Booking ID, and Clinic ID based on context.
3. **Clinical Photos (Optional)**: Up to 5 images can be attached to document symptoms or test results (saved to Cloudinary).
4. System saves the record and updates the Pet's master health timeline.

**Screen layout**
Figure 37. Screen Clinical Examination (Mobile) - Optimized for field work (large touch targets).
Figure 38. Screen Clinical Examination (Web) - Tabbed view for history + entry.

**Function details**
- **Data:** Subjective, Objective, Assessment, Plan (Text), Weight (Numeric), Temperature (Numeric), EMR images (List).
- **Validation:** 
    - Diagnosis (A) and Plan (P) are not empty.
    - Weight must be > 0.
- **Normal case:** Staff treats a cat for dehydratation, notes 4.2kg weight, and prescribes electrolytes.
- **Abnormal cases:**
    - A1. Booking not started – "Please check-in the patient before writing EMR."
    - A2. Photo upload failure – System allows saving text and retrying photo upload later.

 #### *3.9.2 Prescribe Medication (UC-VT-07)*
**User Story:**
> *As a Staff, I want to issue digital prescriptions so that the pet owner has a clear record of the required medication and dosage.*

**Function trigger**
- **Navigation path:** EMR Interface → "Add Prescription".
- **Timing frequency:** At the end of the visit.

**Function description**
- **Actors/Roles:** Staff.
- **Purpose:** Issue digital medication orders for the pet.
- **Interface:**
    - Drug Name – text input
    - Dosage – text input
    - Frequency – text input
    - Duration – text input

**Data processing**
1. Staff enters medication info.
2. System records entries in the `PRESCRIPTION` table linked to the current `EMR`.
3. Notifies the owner about the new prescription after Check-out.

**Screen layout**
Figure 39. Screen Digital Prescription (Mobile)
Figure 40. Screen Digital Prescription (Web)

**Function details**
- **Data:** Drug Name, Dosage, Frequency, Duration.
- **Normal case:** Staff prescribes antibiotics for 7 days.

 #### *3.9.3 Add Incurred Services*
**User Story:**
> *As a Staff, I want to record additional services performed during the exam so that the final invoice accurately reflects all costs.*

**Function trigger**
- **Navigation path:** EMR Interface → "Add Additional Service".
- **Timing frequency:** During or at the end of the examination.

**Function description**
- **Actors/Roles:** Staff.
- **Purpose:** Record medical services, procedures, or miscellaneous expenses (e.g., medical supplies, special handling fees) that were not pre-booked but performed during the visit.
- **Interface:**
    - Service Search/Select – dropdown/search for standard services
    - **Miscellaneous Item Name** – text input for non-standard costs
    - **Amount/Price** – number input for custom costs
    - Quantity – number input (default 1)
    - Notes – text input

**Data processing**
1. Staff selects a standard service OR enters a custom item name and its price.
2. System calculates the total additional cost.
3. System links these incurring items to the current `BOOKING` and `EMR`.
4. System updates the `totalPrice` of the Booking (Booking Total = Base Price + Surcharge + Incurred Services + Miscellaneous Costs).

**Screen layout**
Figure 41. Screen Additional Service Recording (Web)

**Function details**
- **Logic:** Only services belonging to the current clinic can be added.
- **Business rules:** BR-53, BR-54.
- **Normal case:** During a basic physical exam, the Staff identifies the need for an ear cleaning service and adds it to the record.

 #### *3.9.4 Add Vaccination Record (UC-VT-08)*
**User Story:**
> *As a Staff, I want to record vaccination details for a pet so that their immunization history is complete and the owner receives reminders for boosters.*

**Function trigger**
- **Navigation path:** EMR Interface → "Add Vaccination" OR Pet Health Hub → "Record Vaccine".
- **Timing frequency:** During or after vaccination service.

**Function description**
- **Actors/Roles:** Staff.
- **Purpose:** Document vaccination administered to a pet, including vaccine type, batch number, and next due date.
- **Interface:**
    - Vaccine Name – dropdown/search
    - Batch Number – text input
    - Administration Date – date picker (default: today)
    - Next Due Date – date picker
    - Notes – text area

**Data processing**
1. Staff selects or enters the vaccine details.
2. System creates a `VACCINATION_RECORD` in MongoDB linked to the Pet ID.
3. System calculates and schedules a reminder notification for the next due date.
4. System updates the Pet's Health Hub vaccination status badge.

**Screen layout**
Figure 42. Screen Add Vaccination Record (Mobile)
Figure 43. Screen Add Vaccination Record (Web)

**Function details**
- **Data:** VaccineName, BatchNumber, AdministrationDate, NextDueDate, Notes, PetID, VetID.
- **Validation:** 
    - Vaccine Name is required.
    - Next Due Date must be after Administration Date.
- **Business rules:** BR-55, BR-56.
- **Normal case:** Staff records Rabies vaccine for a dog, sets booster reminder for 1 year.
- **Abnormal/Exception cases:**
    - A1. Duplicate vaccine on same date – System warns but allows override.

 #### *3.9.5 Lookup Patient (UC-VT-12)*
**User Story:**
> *As a Staff, I want to search for a patient (pet) by name, owner name, or booking ID so that I can quickly access their medical records before or during an appointment.*

**Function trigger**
- **Navigation path:** Staff Dashboard → "Patient Search" OR Quick Search Bar.
- **Timing frequency:** On demand.

**Function description**
- **Actors/Roles:** Staff.
- **Purpose:** Quickly find a specific pet's profile and medical history.
- **Interface:**
    - Search Input – text field (Name, Owner, Booking ID)
    - Filter by Clinic – dropdown (for multi-clinic vets)
    - Results List – cards showing pet avatar, name, species, owner name

**Data processing**
1. Staff enters search query.
2. System queries `PET` and `USER` tables with LIKE matching.
3. System filters results to pets that have visited the vet's current clinic.
4. System returns paginated results.

**Screen layout**
Figure 44. Screen Patient Lookup (Mobile)
Figure 45. Screen Patient Lookup (Web)

**Function details**
- **Data:** SearchQuery, ClinicID.
- **Validation:** Search query must be at least 2 characters.
- **Business rules:** BR-57 (Privacy - only show patients from vet's clinic).
- **Normal case:** Staff searches "Bella" and finds 2 matching pets.
- **Abnormal/Exception cases:**
    - A1. No results – Show "Không tìm thấy kết quả".

 #### *3.9.6 View Patient List (UC-CM-08)*
**User Story:**
> *As a Clinic Manager, I want to view a list of all patients (pets) that have visited my clinic so that I can monitor patient volume and access records.*

**Function trigger**
- **Navigation path:** Manager Dashboard → "Patients" Tab.
- **Timing frequency:** On demand.

**Function description**
- **Actors/Roles:** Clinic Manager.
- **Purpose:** Access a comprehensive list of all pets registered or treated at the clinic.
- **Interface:**
    - Patient List Table – columns: Pet Name, Species, Owner, Last Visit, Total Visits
    - Search/Filter Bar – by name, species, date range
    - Pagination – 20 items per page
    - Export Button – CSV download

**Data processing**
1. System queries all `PET` records linked to `BOOKING` records for the manager's clinic.
2. System aggregates visit count and last visit date.
3. System returns paginated list with sorting options.

**Screen layout**
Figure 46. Screen Patient List (Web)

**Function details**
- **Data:** ClinicID, Filters (species, dateRange), SortBy, Page.
- **Business rules:** BR-58 (Data scope limited to clinic).
- **Normal case:** Manager views 150 patients with filter by "Dog" species.
- **Abnormal/Exception cases:**
    - A1. No patients – Show empty state with onboarding message.

 #### *3.9.7 View Patient Records (UC-CM-09)*
**User Story:**
> *As a Clinic Manager, I want to view the complete medical history of a patient so that I can review treatment quality and handle customer inquiries.*

**Function trigger**
- **Navigation path:** Patient List → Click Patient Row → "View Records".
- **Timing frequency:** On demand.

**Function description**
- **Actors/Roles:** Clinic Manager.
- **Purpose:** Access detailed medical records including EMR, prescriptions, and vaccinations for review.
- **Interface:**
    - Patient Header – Pet info, owner contact
    - Medical Timeline – chronological list of EMR entries
    - Vaccination Tab – immunization history
    - Prescription Tab – medication history
    - Print/Export Button – PDF generation

**Data processing**
1. System retrieves pet profile from PostgreSQL.
2. System queries `EMR_RECORD` and `VACCINATION_RECORD` from MongoDB.
3. System aggregates and sorts records by date.
4. System renders timeline with expandable details.

**Screen layout**
Figure 47. Screen Patient Records Detail (Web)

**Function details**
- **Data:** PetID, ClinicID.
- **Validation:** Manager can only view records from their own clinic.
- **Business rules:** BR-59 (Cross-clinic records hidden for privacy).
- **Normal case:** Manager reviews 5 EMR entries for a returning patient.
- **Abnormal/Exception cases:**
    - A1. No records – Show "Chưa có hồ sơ khám bệnh".

---

### 3.10 Specialized Services (SOS Emergency Flow)

 #### *3.10.1 Create SOS Booking (UC-PO-15)*
**User Story:**
> *As a Pet Owner, I want to create an emergency SOS booking so that the system automatically finds and contacts nearby clinics, and I can track the matching process in real-time.*

**Function trigger**
- **Navigation path:** Pet Owner Mobile Home → red “SOS Emergency” button → SOS Request Screen → Fill form → Click “Request SOS” → Navigate to SOS Radar Map Screen.
- **Timing frequency:** On-demand (24/7). At any moment, a Pet Owner may have **at most one** active SOS booking (BR-62).

**Function description**
- **Actors/Roles:** Pet Owner (Mobile only).
- **Purpose:** Create SOS emergency booking and initiate automatic matching with nearby clinics within 10km radius.
- **Interface:**
    1. **SOS Request Screen (Mobile - Pet Owner):**
       - **Pet Selector:** Dropdown list of owner’s pets
       - **Symptoms Field:** Multi-line text input for emergency symptoms description
       - **Location Fields:**
           - “Use Current Location” button (GPS)
           - Manual address input with Location Picker (Goong API)
           - Display: Latitude, Longitude, Address (reverse-geocoded)
       - **”Request SOS” Button:** Primary action (disabled if fields invalid)
    2. **SOS Radar Map Screen (Mobile - Pet Owner):**
       - **Full-screen Map:** Google Maps with owner location marker
       - **Radar Animation:** Visual search animation with 10km radius circle
       - **Clinic Markers:** Show nearby clinics (max 5) sorted by distance
       - **Status Banner:**
           - “Đang tìm phòng khám gần bạn...” (SEARCHING)
           - “Đang chờ phòng khám {name} xác nhận...” (PENDING_CLINIC_CONFIRM) with clinic name + distance
           - “Phòng khám {name} đã xác nhận!” (CONFIRMED) → Auto-navigate to SOS Tracking Screen
           - “Không tìm thấy phòng khám khả dụng” (NO_CLINIC/CANCELLED)
       - **Countdown Timer:** 60-second countdown per clinic (shows remainingSeconds from WebSocket)
       - **Current Clinic Index:** “Clinic 1/5”, “Clinic 2/5” (shows progress through clinic list)
       - **”Cancel SOS” Button:** Visible when status is SEARCHING or PENDING_CLINIC_CONFIRM
       - **WebSocket Subscription:** Subscribes to `/topic/sos-matching/{bookingId}` for real-time updates

**Data processing**
1. User opens SOS Request Screen and selects pet, enters symptoms, and location (GPS or manual).
2. User clicks “Request SOS” → System validates and creates SOS booking.
3. System finds nearby clinics (10km radius, max 5) and contacts first clinic.
4. App navigates to Radar Map Screen showing clinic markers, countdown timer (60s per clinic).
5. System sends real-time status updates: “Waiting for clinic confirmation...”, “Clinic declined, trying next...”, or “Confirmed!”.
6. When clinic confirms → App auto-navigates to Tracking Screen with staff details.
7. If no clinics available → Show error message with hotline number.

**Screen layout**
Figure 40. SOS Request Screen (Mobile - Pet Owner)
Figure 41. SOS Radar Map Screen with Countdown Timer (Mobile - Pet Owner)

**Function details**
- **Data:**
    - **SOS Match Request:**
        - petId (UUID, required) - Pet ID requiring emergency care
        - latitude (BigDecimal, required) - GPS latitude coordinate (-90 to 90)
        - longitude (BigDecimal, required) - GPS longitude coordinate (-180 to 180)
        - symptoms (String, optional) - Emergency symptom description (max 500 chars)
        - notes (String, optional) - Additional notes (max 500 chars)
        - address (String, required) - Full address (from reverse geocoding)
    - **SOS Match Response:**
        - bookingId (UUID) - Created SOS booking ID
        - status (BookingStatus) - Current status (SEARCHING, PENDING_CLINIC_CONFIRM, CONFIRMED, CANCELLED)
        - message (String) - User-facing message
        - clinicId (UUID, optional) - Contacted clinic ID
        - clinicName (String, optional) - Clinic name
        - clinicPhone (String, optional) - Clinic phone number (click-to-call)
        - clinicAddress (String, optional) - Clinic address
        - clinicLat (Double, optional) - Clinic latitude coordinate
        - clinicLng (Double, optional) - Clinic longitude coordinate
        - distanceKm (Double, optional) - Distance to clinic (km)
        - wsTopicUrl (String) - WebSocket topic URL to subscribe: `/topic/sos-matching/{bookingId}`
        - createdAt (DateTime) - Booking creation timestamp
        - expiresAt (DateTime) - Session expiration time (60s × 5 clinics + buffer)
        - currentClinicIndex (Integer, optional) - Current clinic index (1-based: 1/5, 2/5...)
        - totalClinicsInRange (Integer, optional) - Total clinics within radius
        - remainingSeconds (Long, optional) - Remaining time for clinic response (seconds)
        - staffId (UUID, optional) - Assigned staff ID (when CONFIRMED)
        - staffName (String, optional) - Staff name
        - staffPhone (String, optional) - Staff phone number (click-to-call)
        - staffAvatarUrl (String, optional) - Staff avatar URL
    - **WebSocket Status Message:**
        - event (MatchingEvent) - CLINIC_NOTIFIED / WAITING_NEXT / CONFIRMED / NO_CLINIC / CANCELLED
        - bookingId (UUID) - Booking ID
        - status (BookingStatus) - Booking status
        - message (String) - User notification message
        - currentClinicIndex (Integer) - Current clinic index (1-based)
        - totalClinicsInRange (Integer) - Total clinics count
        - remainingSeconds (Long) - Remaining seconds
        - clinicId, clinicName, clinicPhone, clinicLat, clinicLng, distanceKm (if clinic assigned)
        - staffId, staffName, staffPhone, staffAvatarUrl (when CONFIRMED)
- **Validation:**
    - **Error Handling:**
        - E1. Pet not owned by user → Error: “Bạn không sở hữu thú cưng này”
        - E2. Active SOS already exists → Show dialog: “Continue tracking” / “Cancel and create new”
        - E3. No clinics within 10km → Response: status=CANCELLED, message=”Không tìm thấy phòng khám...”
        - E4. Invalid coordinates (out of range) → Error: “Tọa độ không hợp lệ”
        - E5. Booking code collision (rare) → Backend retries with new random suffix (max 5 retries)
    - **Field Validation:**
        - petId: Must belong to authenticated user
        - latitude: -90 ≤ lat ≤ 90
        - longitude: -180 ≤ lng ≤ 180
        - symptoms: Max 500 characters
        - address: Required, not blank
- **Business rules:**
    - BR-59: Search radius 10 km from user location
    - BR-60: Max 5 clinics tried per SOS request
    - BR-61: 60-second timeout per clinic before escalation
    - BR-62: No duplicate active SOS bookings per user (enforced by distributed lock)
    - BR-63: Distributed lock prevents race conditions (sos:lock:user:{userId}, TTL=10s)
    - BR-64: Status flow: SEARCHING → PENDING_CLINIC_CONFIRM → CONFIRMED → IN_PROGRESS → COMPLETED/CANCELLED
    - BR-65: Session TTL = 60s × 5 clinics + 60s buffer = 360 seconds
    - BR-66: Booking code format: `SOS-{timestamp7digits}-{random3digits}` (e.g., SOS-1234567-890)
- **Normal case:**
    1. Pet Owner opens SOS Request Screen (no active SOS).
    2. App auto-fills current GPS location + reverse-geocoded address.
    3. Owner selects pet “Milo”, enters symptoms “Chó nôn liên tục, lả”.
    4. Owner clicks “Request SOS” → App submits request.
    5. Backend creates booking, finds 3 clinics within 10km, notifies Clinic A (closest, 2.5km).
    6. App navigates to Radar Screen, shows “Đang chờ Clinic A xác nhận...” + countdown 60s.
    7. After 30s, Clinic A accepts → WebSocket event CONFIRMED received.
    8. Radar Screen shows “Clinic A đã xác nhận! Staff: Dr. Tùng” + clinic phone.
    9. After 2s delay, app auto-navigates to SOS Tracking Screen (UC-PO-17).
- **Abnormal/Exception cases:**
    - A1. Active SOS exists: App shows dialog → Owner clicks “Continue tracking” → Navigate to Radar/Tracking Screen based on current status.
    - A2. No clinics found: Backend returns status=CANCELLED → App shows toast “Không tìm thấy phòng khám trong bán kính 10km. Vui lòng gọi hotline: 1900-xxx” → Stay on Request Screen.
    - A3. Clinic A times out (60s): Backend auto-escalates to Clinic B → WebSocket event WAITING_NEXT → Radar shows “Đang chờ Clinic B...” + countdown resets to 60s.
    - A4. All clinics exhausted: Backend sends NO_CLINIC event → Radar shows error message + hotline → “Back to Home” button appears.
    - A5. User cancels during matching: Owner clicks “Cancel SOS” → Navigate to UC-PO-18 → Booking cancelled, Redis session cleared → Navigate back to Home.
    - E1. GPS unavailable: App shows error “Không thể lấy vị trí GPS. Vui lòng bật định vị.” → Request button disabled until location obtained.
    - E2. Backend timeout: API request takes >30s → App shows loading spinner, then timeout error “Không thể kết nối máy chủ” → Retry button.

 #### *3.10.2 Track Staff Location (Real-time Tracking) (UC-PO-17)*
**User Story:**
> *As a Pet Owner, I want to track the assigned staff's real-time location during SOS emergency so that I know when they will arrive and can prepare accordingly.*

**Function trigger**
- **Navigation path:**
  - **Automatic:** After clinic confirms SOS (status=CONFIRMED) → App auto-navigates from SOS Radar Map Screen to SOS Tracking Screen.
  - **Manual:** My Bookings Tab → Select SOS Booking (status=CONFIRMED/IN_PROGRESS) → Click "Track" button → Navigate to SOS Tracking Screen.
- **Timing frequency:** Continuous tracking from when booking is CONFIRMED until status changes to COMPLETED or CANCELLED.

**Function description**
- **Actors/Roles:** Pet Owner (Mobile only).
- **Purpose:** Provide real-time visibility of assigned staff's location, route, and estimated arrival time during SOS emergency response.
- **Interface:**
    1. **SOS Tracking Screen (Mobile - Pet Owner):**
       - **Full-screen Map:** Google Maps with:
           - **Home Marker:** Pet owner's emergency location (red house icon)
           - **Clinic Marker:** Clinic location (clinic icon with name)
           - **Staff Marker:** Staff current location (moving marker with avatar, snapped to route polyline)
       - **Route Polyline:** Blue line showing route from clinic to home (Goong Direction API)
       - **Auto-fit Camera:** Map auto-zooms to show both home and staff positions
       - **Info Card (Bottom Sheet):**
           - **Staff Avatar & Name:** Profile picture + full name
           - **Staff Phone:** Click-to-call button
           - **Distance Display:** "Còn cách {X} km" (only shown when staff is moving)
           - **ETA Display:** "Dự kiến đến sau {Y} phút" (only shown when staff is moving)
           - **Status Text:** Dynamic messages based on distance:
               - "Bác sĩ đang trên đường đến..." (distance > 0.5 km)
               - "Bác sĩ gần đến nơi..." (distance ≤ 0.5 km)
               - "Bác sĩ rất gần..." (distance ≤ 0.1 km)
               - "Bác sĩ đã đến!" (distance < 0.05 km or arrived=true)
       - **Refresh Button:** Manual refresh button (top-right) for immediate location update
       - **Back Button:** Exit tracking screen
    2. **My Bookings Tab - SOS Booking Card:**
       - Shows "Track" button when status is CONFIRMED or IN_PROGRESS
       - Button disabled when status is COMPLETED or CANCELLED

**Data processing**
1. App navigates to Tracking Screen (auto after confirmation or manual from My Bookings).
2. Map initializes with 3 markers: home, clinic, and staff location with route polyline.
3. System polls staff location updates every 5 seconds, calculates distance and ETA.
4. Info card displays staff details, distance ("Còn cách X km"), and ETA ("Dự kiến đến sau Y phút").
5. Staff marker animates smoothly along route as location updates.
6. When staff arrives (distance < 0.05 km) → Show arrival notification, auto-navigate back to My Bookings after 3s.

**Screen layout**
Figure 42. SOS Tracking Screen with Staff Location, Route, and ETA (Mobile - Pet Owner)

**Function details**
- **Data:**
    - **Booking Details Request:**
        - bookingId (UUID) - Booking ID to track
    - **Booking Response (includes tracking data):**
        - bookingId (UUID) - Booking ID
        - status (BookingStatus) - Current status (CONFIRMED, IN_PROGRESS, COMPLETED, CANCELLED)
        - type (BookingType) - SOS
        - homeAddress (String) - Emergency address
        - homeLat (BigDecimal) - Home latitude coordinate
        - homeLong (BigDecimal) - Home longitude coordinate
        - clinicName (String) - Clinic name
        - clinicAddress (String) - Clinic address
        - clinicLat (BigDecimal) - Clinic latitude coordinate
        - clinicLng (BigDecimal) - Clinic longitude coordinate
        - assignedStaff (Object, optional) - Assigned staff information:
            - staffId (UUID) - Staff ID
            - staffName (String) - Staff full name
            - staffPhone (String) - Staff phone number (click-to-call)
            - staffAvatar (String) - Avatar URL
            - staffLat (BigDecimal, optional) - Staff current latitude coordinate
            - staffLng (BigDecimal, optional) - Staff current longitude coordinate
        - distanceKm (BigDecimal, optional) - Distance from staff to home (km)
        - estimatedArrival (Integer, optional) - Estimated arrival time (minutes)
        - arrivedAt (DateTime, optional) - Staff arrival timestamp
    - **Polling Frequency:** Every 5 seconds (configurable)
    - **WebSocket Topic:** `/topic/sos-tracking/{bookingId}` (fallback to polling if unavailable)
- **Validation:**
    - **Error Handling:**
        - E1. Booking not found → Navigate back, show toast "Không tìm thấy booking"
        - E2. Booking not SOS type → Navigate back, show toast "Booking không phải SOS"
        - E3. Staff not assigned → Show message "Chưa có nhân viên được phân công"
        - E4. Staff location unavailable → Show message "Đang chờ nhân viên bắt đầu di chuyển..."
        - E5. Network error (API timeout) → Retry 3 times, then show persistent error banner "Mất kết nối. Đang thử lại..."
        - E6. GPS permission denied (staff side) → Show message "Nhân viên chưa bật GPS"
    - **Business Validation:**
        - Tracking only available when booking status is CONFIRMED or IN_PROGRESS.
        - Distance/ETA only shown when staffLat and staffLng are not null.
        - Cannot track if booking is COMPLETED or CANCELLED → Hide "Track" button.
- **Business rules:**
    - BR-64: Status flow: CONFIRMED → IN_PROGRESS → COMPLETED
    - BR-73: Staff location updates every 3 seconds (staff-side GPS broadcast)
    - BR-74: Pet Owner polling interval: 5 seconds (to avoid excessive API calls)
    - BR-75: Arrival threshold: distance < 0.05 km (50 meters) or arrivedAt field set
    - BR-76: ETA calculation formula: `estimatedArrival = (distanceKm / 40) * 60` minutes (assumes 40 km/h avg speed)
    - BR-77: Route polyline fetched once from Goong Direction API (cached for session)
    - BR-78: Staff marker smooth animation: 1-second transition between position updates
- **Normal case:**
    1. Clinic confirms SOS, assigns staff "Dr. Tùng" → Owner auto-navigates to Tracking Screen.
    2. Map initializes with 3 markers: home (red), clinic (blue), staff (avatar).
    3. Route polyline from clinic to home is drawn.
    4. Staff starts travelling → staffLat/staffLng become available.
    5. App polls every 5s, receives updates: staffLat=10.762, staffLng=106.682, distanceKm=3.2, estimatedArrival=5.
    6. Info card shows: "Còn cách 3.2 km", "Dự kiến đến sau 5 phút", "Bác sĩ đang trên đường đến...".
    7. Staff marker animates smoothly along route polyline.
    8. After 5 minutes, distance reduces to 0.03 km → Status text: "Bác sĩ đã đến!".
    9. App plays notification sound, shows success message.
    10. After 3s delay, app auto-navigates back to My Bookings Tab.
- **Abnormal/Exception cases:**
    - A1. Staff not moving (staffLat/staffLng null): Info card shows "Đang chờ nhân viên bắt đầu di chuyển...", distance/ETA hidden.
    - A2. WebSocket connection fails: App shows toast "Không thể kết nối real-time, đang dùng chế độ polling", continues with 5s polling.
    - A3. Staff takes wrong route (deviates >500m from polyline): App refetches route from Goong API, redraws polyline.
    - A4. Booking status changes to CANCELLED during tracking: App receives status update → Show toast "SOS đã bị hủy" → Navigate back.
    - A5. Booking status changes to COMPLETED during tracking: App receives status update → Show toast "Đã hoàn tất khám SOS" → Navigate back.
    - E1. User denies location permission (owner side): Map cannot center on home → Use default center, show warning "Cần quyền vị trí để hiển thị bản đồ".
    - E2. Polling timeout (3 consecutive failures): Show persistent error banner "Mất kết nối. Vui lòng kiểm tra mạng.", keep retrying every 10s.
    - E3. Staff location jumps erratically (GPS inaccuracy): App applies smoothing filter (Kalman), ignores outliers >2km from previous position.

 #### *3.10.3 Receive SOS Alert & Confirm/Decline (UC-CM-20)*
**User Story:**
> *As a Clinic Manager, I want to receive real-time SOS emergency alerts so that I can quickly accept or decline requests based on clinic availability.*

**Function trigger**
- **Navigation path:** Manager Dashboard → SOS Alerts section (real-time notifications).
- **Timing frequency:** When SOS matching system contacts the clinic (60-second timeout per clinic).

**Function description**
- **Actors/Roles:** Clinic Manager.
- **Purpose:** Provide real-time notification of SOS emergency requests with pet/owner details and countdown timer to allow quick decision-making.
- **Interface:**
    1. **SOS Alert Modal (Web)**:
       - **Pet Information:** Pet name, species, breed, weight
       - **Owner Contact:** Owner name, phone number (click-to-call)
       - **Emergency Details:** Symptoms, home address with GPS coordinates
       - **Distance:** Distance from clinic to emergency location (km)
       - **Countdown Timer:** 60-second countdown showing remaining time to respond
       - **Actions:**
           - **"Accept & Assign Staff"** → Opens staff selection dropdown
           - **"Decline"** → Optional decline reason field
    2. **Staff Selection Dropdown:**
       - Lists available STAFF with specialty VETERINARIAN
       - Filters: Only staff from current clinic

**Data processing**
1. System finds nearby clinics and sends alert to first clinic via WebSocket.
2. Manager sees SOS Alert Modal with pet/owner details, symptoms, distance, and 60-second countdown.
3. Manager decides to accept (selects staff) or decline (optional reason).
4. If accept → System confirms booking, assigns staff, notifies pet owner.
5. If decline or timeout → System escalates to next clinic, updates manager's modal.

**Screen layout**
Figure 44. SOS Alert Modal with Countdown (Web - Manager Dashboard)

**Function details**
- **Data:**
    - **Confirmation Request (Accept):**
        - bookingId (UUID) - SOS booking ID
        - accepted (Boolean) - true when accepting
        - assignedStaffId (UUID) - Selected staff ID
    - **Confirmation Request (Decline):**
        - bookingId (UUID) - SOS booking ID
        - accepted (Boolean) - false when declining
        - declineReason (String, optional) - Decline reason
    - **WebSocket Alert Message:**
        - event (String) - "CLINIC_NOTIFIED"
        - bookingId (UUID) - Booking ID
        - petName (String) - Pet name
        - petSpecies (String) - Pet species (DOG, CAT, ...)
        - symptoms (String) - Emergency symptoms
        - petOwnerName (String) - Pet owner name
        - petOwnerPhone (String) - Pet owner phone number
        - homeAddress (String) - Emergency address
        - distanceKm (Double) - Distance from clinic (km)
        - remainingSeconds (Long) - Remaining time to respond (seconds)
- **Validation:**
    - **Error Handling:**
        - E1. Manager not authorized for clinic → HTTP 403
        - E2. Booking no longer in PENDING_CLINIC_CONFIRM status → HTTP 400
        - E3. Assigned staff not from manager's clinic → HTTP 400
    - **Business Validation:**
        - Manager can only confirm SOS requests assigned to their clinic.
        - Assigned staff must have role = STAFF and belong to manager's clinic.
- **Business rules:**
    - BR-59: Search radius 10 km.
    - BR-60: Max 5 clinics tried.
    - BR-61: 60-second timeout per clinic.
    - BR-67: Clinic Manager must assign staff when accepting SOS.
- **Normal case:**
    1. SOS matching system contacts Clinic A (closest).
    2. Manager sees modal with pet "Milo" needing emergency care.
    3. Manager reviews symptoms: "Chó bỏ ăn, nôn" and distance: 2.5 km.
    4. Manager selects staff "Dr. Tùng" and clicks "Accept".
    5. System confirms booking, assigns staff, notifies pet owner.
    6. Modal closes, manager sees booking in "Pending Bookings" list.
- **Abnormal/Exception cases:**
    - A1. Timeout: No response within 60s → System escalates to next clinic, modal shows "Đã chuyển sang phòng khám tiếp theo".
    - A2. Decline: Manager declines → System escalates, logs decline reason.
    - A3. Multiple Managers: If multiple managers online, first to click "Accept" wins; others see "Đã được xử lý bởi manager khác".

 #### *3.10.4 Cancel SOS Matching (UC-PO-18)*
**User Story:**
> *As a Pet Owner, I want to cancel my SOS request before confirmation so that I can stop the matching process if the emergency is resolved.*

**Function trigger**
- **Navigation path:** SOS Radar Map Screen → "Cancel SOS" button (visible when status is SEARCHING or PENDING_CLINIC_CONFIRM).
- **Timing frequency:** Available until booking status changes to CONFIRMED.

**Function description**
- **Actors/Roles:** Pet Owner (Mobile).
- **Purpose:** Allow pet owners to cancel SOS matching process before clinic confirmation.
- **Interface:**
    1. **Cancel Button:** Displayed on SOS Radar Map Screen.
    2. **Confirmation Dialog:**
       - Title: "Hủy yêu cầu SOS?"
       - Message: "Bạn có chắc muốn hủy yêu cầu cấp cứu? Bạn có thể tạo yêu cầu mới sau."
       - Actions: "Hủy yêu cầu" (danger) / "Quay lại" (secondary)

**Data processing**
1. User clicks "Cancel SOS" button on radar screen.
2. App shows confirmation dialog: "Bạn có chắc muốn hủy yêu cầu cấp cứu?".
3. User confirms cancellation → System validates and updates booking status to CANCELLED.
4. System notifies pet owner and current clinic (if any) via WebSocket.
5. App navigates back to Home, shows toast "Đã hủy yêu cầu SOS".

**Screen layout**
Figure 45. Cancel SOS Confirmation Dialog (Mobile)

**Function details**
- **Data:**
    - **Cancellation Request:**
        - bookingId (UUID) - Booking ID to cancel
    - **WebSocket Status Message (Pet Owner):**
        - event (String) - "CANCELLED"
        - bookingId (UUID) - Booking ID
        - status (String) - "CANCELLED"
        - message (String) - "Bạn đã hủy yêu cầu cấp cứu."
- **Validation:**
    - **Error Handling:**
        - E1. Booking not owned by user → HTTP 403
        - E2. Booking already CONFIRMED or COMPLETED → HTTP 400 "Không thể hủy booking ở trạng thái: {status}"
- **Business rules:**
    - BR-68: Pet Owner can only cancel SOS before clinic confirmation.
    - BR-69: After cancellation, Redis session is cleared and matching stops immediately.
- **Normal case:**
    1. Pet owner creates SOS request for pet "Milo".
    2. Radar screen shows "Đang chờ phòng khám xác nhận...".
    3. Owner's emergency situation improves (e.g., vomiting stopped).
    4. Owner clicks "Cancel SOS" → Confirmation dialog appears.
    5. Owner confirms → Booking cancelled, returns to Home.
- **Abnormal/Exception cases:**
    - A1. Clinic just confirmed (race condition): Backend returns 400 → App shows "Phòng khám đã xác nhận, không thể hủy".

 #### *3.10.5 Checkout with Custom SOS Fee (UC-STAFF-10)*
**User Story:**
> *As a Staff, I want to checkout SOS bookings with custom SOS fees included in total price so that I can properly finalize emergency services and collect payment.*

**Function trigger**
- **Navigation path:** Staff Mobile App → My Bookings Tab → Select SOS Booking (status = IN_PROGRESS) → Booking Detail Screen → "Hoàn tất khám" button.
- **Timing frequency:** After completing emergency medical examination and EMR documentation.

**Function description**
- **Actors/Roles:** Staff (Mobile).
- **Purpose:** Finalize SOS booking, apply SOS emergency fee, and complete payment for emergency service.
- **Interface:**
    1. **Booking Detail Screen (Mobile - Staff)**:
       - **Patient Info Card:**
           - Pet Name, Species, Owner Name
           - Booking Code (e.g., SOS-12345)
           - Booking Type Badge: "SOS Emergency"
       - **EMR Summary Section:**
           - Assessment, Plan preview
           - "View Full EMR" link
       - **Fee Breakdown Card:**
           - Base Services: {amount} VND (if services added during visit)
           - **SOS Emergency Fee**: {sosFee} VND (default from clinic config, editable)
           - **Total Amount**: {totalPrice} VND (auto-calculated)
       - **SOS Fee Override (Optional):**
           - Text input field "Điều chỉnh phí SOS (nếu cần)"
           - Hint: "Để trống nếu dùng phí mặc định"
       - **Action Button:**
           - "Hoàn tất khám" (primary button, full width)
           - "Hủy" (secondary, navigate back)

**Data processing**
1. Staff completes EMR documentation for SOS booking (status = IN_PROGRESS).
2. Staff navigates to Booking Detail screen, taps "Hoàn tất khám".
3. System displays fee breakdown with default SOS fee from clinic configuration.
4. (Optional) Staff can override SOS fee by entering custom amount (e.g., for discount).
5. Staff reviews total amount and taps "Hoàn tất khám" to confirm.
6. System sends checkout request with optional `overriddenSosFee` parameter.
7. Backend updates booking status to COMPLETED, recalculates total price with SOS fee.
8. System sends notification to pet owner: "Đã hoàn tất khám SOS cho {petName}".
9. Mobile app navigates back to bookings list, booking moves to "Completed" tab.

**Screen layout**
Figure 46. Booking Detail with Checkout (Mobile - Staff App)
Figure 47. SOS Fee Override Dialog (Mobile - Staff App)

**Function details**
- **Data:**
    - **Checkout Request:**
        - bookingId (UUID) - Booking ID (from path parameter)
        - overriddenSosFee (BigDecimal, optional) - Override SOS fee if needed (for special cases, e.g., discounts or adjustments)
    - **Response Data:**
        - success (Boolean) - true if checkout successful
        - message (String) - "Checkout thành công"
        - bookingId (UUID) - Booking ID
        - status (String) - "COMPLETED"
        - totalPrice (BigDecimal) - Total amount (including SOS fee)
        - sosFee (BigDecimal) - SOS emergency fee applied
        - completedAt (DateTime) - Completion timestamp
- **Validation:**
    - **Error Handling:**
        - E1. Booking not in IN_PROGRESS status → HTTP 400 "Booking không ở trạng thái IN_PROGRESS"
        - E2. Staff not assigned to this booking → HTTP 403 "Không có quyền checkout lịch hẹn này"
        - E3. Overridden SOS fee is negative → HTTP 400 "SOS fee không thể âm"
        - E4. EMR not created yet → Warning dialog "Chưa tạo hồ sơ bệnh án, tiếp tục checkout?"
    - **Business Validation:**
        - If `overriddenSosFee` not provided, use clinic-configured SOS fee or default 50,000 VND.
        - Total price recalculated: Base Services + overriddenSosFee (or default SOS fee).
        - Total price must be non-negative.
        - Staff must be assigned to this booking (security check).
- **Business rules:**
    - BR-70: SOS fee is configured per clinic via `ClinicPriceService`.
    - BR-71: SOS fee is added to booking during confirmation, can be overridden at checkout.
    - BR-72: Checkout updates status to COMPLETED and records final total price.
    - BR-73: Only assigned Staff can checkout SOS bookings (authorization).
- **Normal case:**
    1. Staff completes emergency examination for pet "Milo" (SOS booking).
    2. Staff creates EMR with assessment and treatment plan.
    3. Staff opens booking detail, sees status = IN_PROGRESS.
    4. Staff taps "Hoàn tất khám" → Fee breakdown displays:
        - Base Services: 0 VND (no additional services)
        - SOS Emergency Fee: 50,000 VND (clinic default)
        - **Total: 50,000 VND**
    5. Staff taps "Hoàn tất khám" to confirm (no override).
    6. System completes booking with totalPrice = 50,000 VND.
    7. Notification sent to owner: "Đã hoàn tất khám SOS cho Milo".
    8. App navigates back, booking appears in "Completed" tab.
- **Abnormal/Exception cases:**
    - A1. Staff overrides SOS fee to 30,000 VND (special discount) → Staff enters "30000" in override field → Total recalculated to 30,000 VND → Checkout successful.
    - A2. Checkout before EMR created → Warning dialog "Chưa tạo hồ sơ bệnh án, tiếp tục checkout?" → Staff can choose "Tạo EMR" or "Tiếp tục" (force checkout).
    - A3. Network error during checkout → App shows retry dialog with "Thử lại" button.
    - A4. Staff tries to checkout booking assigned to another staff → HTTP 403 "Không có quyền checkout lịch hẹn này".


### 3.11 AI Assistance Flow

 #### *3.11.1 Consult AI Assistant (UC-PO-14a / UC-PO-14b / UC-PO-14c)*
**User Story:**
> *As a Pet Owner, I want to consult an intelligent AI assistant for pet care advice and booking support so that I can get immediate answers 24/7.*

**Function trigger**
- **Navigation path:** Mobile Home → "AI Assistant" (Floating Action Button or Tab).
- **Timing frequency:** On demand (24/7).

**Function description**
- **Actors/Roles:** Pet Owner.
- **Purpose:** Provide an intelligent, conversational interface for pet care, symptom checking, and booking assistance.
- **Interface:**
    - **Chat Window:** Real-time streaming interface.
    - **Intelligent Prompts:** Quick action buttons (e.g., "Kiểm tra triệu chứng", "Tìm phòng khám", "Đặt lịch khám").
    - **Multi-modal Support:** Text input, future support for clinical photos.
    - **Citations:** Link to medical sources (RAG) for transparency.

**UC-PO-14: Chi tiết Use Case Trợ lý AI (Smart AI Assistant)**

| Thành phần | Đặc tả chi tiết |
|:---|:---|
| **Mục tiêu** | Cung cấp các khả năng thông minh qua hội thoại: Tra cứu cẩm nang thú y, gợi ý xử lý triệu chứng và thực hiện đặt lịch khám tự động. |
| **Tác nhân** | Pet Owner (Chủ thú cưng) |
| **Tiền điều kiện** | 1. Người dùng đã đăng nhập vào ứng dụng mobile.<br/>2. Thiết bị có kết nối Internet.<br/>3. AI Agent Service đang hoạt động (Status: ENABLED). |
| **Luồng xử lý chính** | 1. Người dùng chọn chức năng "AI Assistant" trên mobile app.<br/>2. Hệ thống hiển thị khung chat và các gợi ý thông minh.<br/>3. Người dùng nhập tin nhắn hoặc chọn nút gợi ý nhanh.<br/>4. AI Agent (ReAct Pattern) phân tích ý định (intent) và thực hiện:<br/>&nbsp;&nbsp;&nbsp;&nbsp;- Tra cứu kiến thức (RAG) nếu là câu hỏi tư vấn.<br/>&nbsp;&nbsp;&nbsp;&nbsp;- Gọi Tool (FastMCP) nếu cần tìm phòng khám hoặc đặt lịch.<br/>5. Hệ thống hiển thị phản hồi theo dạng streaming (từng từ) để tăng trải nghiệm.<br/>6. Người dùng nhận câu trả lời và có thể tiếp tục hỏi (Multi-turn conversation). |
| **Hậu điều kiện** | 1. Lịch sử trò chuyện được lưu trữ.<br/>2. Đơn đặt lịch được tạo thành công trong hệ thống (nếu có hành động đặt lịch). |
| **Quy tắc nghiệp vụ** | BR-42 (Cảnh báo ý kiến y tế); BR-43 (Không kê đơn thuốc); BR-21 (Gắn hồ sơ pet). |

**Use Case: Interaction Scenarios**

| Scenario | User Actions | AI Agent Logic (ReAct) | System Response |
|----------|--------------|-------------------------|-----------------|
| **General Pet Care** | User asks: "Mèo con 2 tháng tuổi nên tiêm phòng gì?" | Agent calls `pet_care_qa` tool to search knowledge base (RAG). | Agent provides a list of recommended vaccines with citations from veterinary documents. |
| **Symptom Lookup** | User describes: "Chó nhà tôi bỏ ăn và bị nôn, có sao không?" | Agent calls `symptom_search` tool based on keywords. | Agent suggests possible causes (e.g., gastritis, poisoning) and strongly advises visiting a vet. |
| **Clinic Discovery** | User asks: "Tìm phòng khám thú y ở Quận 7." | Agent calls `search_clinics` with parameters `district=7`. | Agent displays top 3 clinics in District 7 with addresses and ratings. |
| **Booking Search** | User says: "Tôi muốn đặt lịch ở phòng khám ABC ngày mai." | Agent calls `check_slots` for Clinic ABC on tomorrow's date. | Agent lists available slots (e.g., 09:00, 14:30) and asks User to pick one. |
| **Guided Booking** | User selects 14:00 and pet "Mimi". | Agent calls `create_booking` with the gathered parameters. | Agent confirms the booking creation: "Đã đặt lịch thành công (#B101) cho Mimi lúc 14:00 ngày mai." |

**Data processing**
1. **User Input:** User submits a message via WebSocket.
2. **Intent Analysis:** The AI Agent (FastAPI - LangGraph) analyzes the intent:
    - If **Information based:** Trigger RAG (Cohere Embedding + Qdrant Vector search).
    - If **Action based:** Trigger FastMCP Tool (Call Spring Boot APIs).
3. **ReAct Loop:** Agent repeats "Thought → Action → Observation" until a final answer is formed.
4. **Streaming Delivery:** Response tokens are sent back live to the mobile app UI.
5. **Context Persistence:** Chat history is saved in MongoDB (`ai_chat_sessions`, `ai_chat_messages`) for multi-turn conversation.

**Screen layout**
Figure 43. AI Chat Interface with Streaming Response (Mobile)

**Function details**
- **Safety Constraints:**
    - Must include a disclaimer: "Đây là thông tin tham khảo, không thay thế chẩn đoán của nhân viên."
    - Block medical advice related to controlled narcotics or illegal dosages.
- **Abnormal Cases:**
    - A1. Tool failure: System notifies "Máy chủ đang quá tải, vui lòng thử lại sau".
    - A2. Ambiguous query: Agent asks follow-up questions to narrow down the intent.
- **Business rules:** BR-42, BR-43.

 #### *3.11.2 Analyze Pet Health via Vision (UC-PO-14d)*
**User Story:**
> *As a Pet Owner, I want to upload photos of my pet for AI analysis so that I can identify potential health issues and get booking recommendations.*

**Function trigger**
- **Navigation path:** Mobile Home → "AI Assistant" → Gửi hình ảnh thú cưng qua chat.
- **Timing frequency:** On demand (24/7), đặc biệt khi phát hiện dấu hiệu bất thường trên thú cưng.

**Function description**
- **Actors/Roles:** Pet Owner.
- **Purpose:** Cho phép AI phân tích hình ảnh thú cưng để nhận diện các vấn đề sức khỏe tiềm ẩn, đưa ra cảnh báo và tự động đề xuất đặt lịch khám với dịch vụ phù hợp.
- **Interface:**
    - **Image Upload Button:** Nút camera/gallery trong chat input để chọn hình ảnh.
    - **Image Preview:** Hiển thị preview ảnh trước khi gửi.
    - **Analysis Results:** AI response với:
        - Danh sách vấn đề phát hiện được (detected issues)
        - Mức độ nghiêm trọng (severity indicator)
        - Cảnh báo khẩn cấp (nếu nghiêm trọng)
    - **Booking Suggestion Card:** Card đề xuất booking với:
        - Tên clinic gần nhất
        - Dịch vụ được chọn sẵn
        - Ngày/giờ gợi ý
        - Nút "Đặt lịch ngay"
    - **Pet Selection Dialog:** Popup cho user chọn pet khi có nhiều pet.

**UC-PO-14d: Chi tiết Use Case AI Vision Pet Health Analysis**

| Thành phần | Đặc tả chi tiết |
|:---|:---|
| **Mục tiêu** | Phân tích hình ảnh thú cưng để phát hiện bệnh/triệu chứng, cảnh báo người dùng và tự động đề xuất booking. |
| **Tác nhân** | Pet Owner (Chủ thú cưng) |
| **Tiền điều kiện** | 1. Người dùng đã đăng nhập vào ứng dụng mobile.<br/>2. Thiết bị có kết nối Internet.<br/>3. AI Agent Service đang hoạt động với Vision Model enabled.<br/>4. App đã có quyền truy cập Camera/Gallery.<br/>5. GPS permission đã được cấp để tìm clinic gần nhất. |
| **Luồng chính** | 1. User mở AI Assistant chat.<br/>2. User nhấn nút camera/gallery để chọn hình ảnh thú cưng.<br/>3. Hình ảnh được upload lên Cloudinary, nhận về URL.<br/>4. App gửi message với `image_url` và `user_location` (GPS) qua WebSocket.<br/>5. AI Agent gọi tool `analyze_pet_image` để phân tích hình ảnh.<br/>6. Agent nhận kết quả phân tích với detected issues và severity.<br/>7. Nếu severity là "moderate" hoặc cao hơn:<br/>   - Agent gọi `search_nearby_clinics` với user GPS.<br/>   - Agent gọi `get_user_pets` để lấy danh sách pet của user.<br/>   - Agent hỏi user chọn pet nào (nếu có nhiều pet).<br/>   - Agent gọi `create_booking_suggestion` để tạo đề xuất.<br/>8. AI trả về response với:<br/>   - Cảnh báo về vấn đề phát hiện được<br/>   - Booking Suggestion Card với thông tin đã điền sẵn.<br/>9. User nhấn "Đặt lịch ngay" → Navigate đến Booking Screen với params. |
| **Luồng thay thế** | A1. Hình ảnh không rõ ràng → AI yêu cầu gửi lại ảnh rõ hơn.<br/>A2. Không phát hiện vấn đề (severity: mild) → AI thông báo "Không phát hiện vấn đề nghiêm trọng" và khuyên theo dõi thêm.<br/>A3. User có nhiều pet → AI hiển thị Pet Selection Dialog để chọn.<br/>A4. Không tìm được clinic trong bán kính → AI mở rộng tìm kiếm hoặc thông báo. |
| **Hậu điều kiện** | 1. Lịch sử chat được lưu trữ (bao gồm image URL).<br/>2. Nếu user confirm booking → Đơn đặt lịch được tạo trong hệ thống. |
| **Quy tắc nghiệp vụ** | BR-42 (Cảnh báo ý kiến y tế); BR-43 (Không kê đơn thuốc); BR-44 (Disclaimer cho Vision Analysis). |

**Use Case: AI Vision Interaction Scenarios**

| Scenario | User Actions | AI Agent Logic (ReAct) | System Response |
|----------|--------------|-------------------------|-----------------|
| **Skin Disease Detection** | User uploads photo of dog with skin rash. | Agent calls `analyze_pet_image(image_url, pet_type="dog")`. Vision LLM analyzes image and detects "dermatitis, fungal infection suspected". | Agent responds: "⚠️ CẢNH BÁO: Phát hiện dấu hiệu viêm da, nghi ngờ nhiễm nấm. Nên đưa đến nhân viên thú y trong 24-48h." + Booking Suggestion Card. |
| **Eye Infection** | User uploads photo of cat with red, watery eyes. | Agent analyzes and detects "conjunctivitis, eye infection". Severity: moderate. | Agent warns about eye infection and suggests ophthalmology service. |
| **Wound Assessment** | User uploads photo of bleeding wound on pet. | Agent detects "open wound, bleeding". Severity: urgent. | Agent shows URGENT WARNING: "Vết thương hở, cần xử lý NGAY LẬP TỨC!" + SOS booking suggestion. |
| **Normal Health Check** | User uploads photo of healthy-looking pet asking "Bé có khỏe không?". | Agent analyzes and finds no visible issues. Severity: mild. | Agent responds: "Nhìn bé có vẻ khỏe mạnh! Không phát hiện vấn đề đáng lo ngại. Nhớ tiêm phòng định kỳ nhé." |
| **Multiple Pets Selection** | After analysis, AI needs to create booking but user has 3 pets. | Agent calls `get_user_pets` → returns 3 pets. | Agent asks: "Bạn muốn đặt lịch cho bé nào: 🐕 Lucky, 🐱 Mimi, hay 🐕 Bella?" User selects → Continue booking flow. |

**Data processing**
1. **Image Upload:** User selects image → Upload to Cloudinary → Receive public URL.
2. **WebSocket Message:** App sends `{type: "image", image_url: "...", latitude: 10.xxx, longitude: 106.xxx}`.
3. **Vision Analysis:** AI Agent calls `analyze_pet_image` tool which:
   - Sends image URL to Vision LLM (Gemini 2.0 Flash via OpenRouter).
   - Vision LLM analyzes and returns structured findings.
4. **Severity Assessment:** Agent evaluates severity:
   - `mild`: No action needed, just advice.
   - `moderate`: Suggest booking within 24-48h.
   - `severe`/`urgent`: Strong warning + immediate booking suggestion.
5. **Clinic Discovery:** If booking needed, Agent calls `search_nearby_clinics(lat, lng)`.
6. **Pet Selection:** Agent calls `get_user_pets` → If multiple pets, asks user to choose.
7. **Booking Suggestion:** Agent calls `create_booking_suggestion` to prepare booking data.
8. **Response Delivery:** AI streams response with warning message + BookingSuggestionCard component.
9. **User Confirmation:** User taps "Đặt lịch ngay" → App navigates to BookingScreen with pre-filled params.

**Screen layout**
Figure 45. AI Vision Chat Flow - Image Upload and Analysis (Mobile)
Figure 46. Booking Suggestion Card after Disease Detection (Mobile)
Figure 47. Pet Selection Dialog (Mobile)

**Function details**
- **Data Objects:**
    - `ImageMessage`: `{type: "image", image_url: string, latitude: float, longitude: float}`
    - `VisionAnalysisResult`: `{detected_issues: [], severity: string, recommended_services: [], urgent_warning: string}`
    - `BookingSuggestion`: `{clinic_id, clinic_name, services: [], suggested_date, suggested_time, estimated_price, urgency}`
- **Validation:**
    - Image format: JPEG, PNG (max 10MB).
    - GPS coordinates: Valid latitude (-90 to 90) and longitude (-180 to 180).
    - Image must contain visible pet content (reject non-pet images).
- **Safety Constraints:**
    - Disclaimer: "Phân tích hình ảnh chỉ mang tính tham khảo. Vui lòng đến phòng khám để được chẩn đoán chính xác."
    - Do not provide definitive medical diagnosis.
    - For `urgent` severity, always recommend immediate vet visit.
- **Normal case:**
    1. Pet Owner uploads photo of pet with skin rash via chat.
    2. AI Agent calls `analyze_pet_image` tool with image URL.
    3. Vision LLM analyzes and detects "dermatitis, fungal infection".
    4. Agent evaluates severity as "moderate".
    5. Agent calls `search_nearby_clinics` with owner's GPS.
    6. Agent responds with warning + BookingSuggestionCard.
    7. Owner taps "Đặt lịch ngay" → App navigates to booking screen.
- **Abnormal/Exception Cases:**
    - A1. Blurry/unclear image – Show "Hình ảnh không rõ ràng, vui lòng chụp lại."
    - A2. Non-pet image – Show "Không phát hiện thú cưng trong hình ảnh."
    - A3. User declines booking suggestion – Agent offers alternative care advice.
    - E1. Image upload fails – Show "Không thể tải ảnh lên, vui lòng thử lại."
    - E2. Vision LLM error – Fallback to text-based symptom_search if possible.
    - E3. No clinics found nearby – Expand search radius or show "Không tìm thấy phòng khám trong khu vực."
    - A4. GPS unavailable: Ask user to enable location or enter address manually.
- **Business rules:** BR-42, BR-43, BR-44, BR-45.

| BR-45 | Urgent Severity Handling: Khi phát hiện vấn đề nghiêm trọng (urgent), hệ thống phải hiển thị cảnh báo nổi bật và ưu tiên đề xuất SOS hoặc booking trong ngày. |

 #### *3.11.3 Manage AI Agent & Knowledge Base (UC-AD-05/06)*
**User Story:**
> *As a Platform Admin, I want to manage AI tools, system prompts, and the knowledge documents so that the AI remains accurate and helpful.*

**Function trigger**
- **Navigation path:** Admin Dashboard → AI Management.
- **Timing frequency:** Periodic updates.

**Function description**
- **Actors/Roles:** Platform Admin.
- **Purpose:** Control the behavior and knowledge of the Pet Care AI.
- **Interface:** 
    - Knowledge Base (Upload PDF/Markdown)
    - Prompt Editor (Update system instructions)
    - Tool Toggle (Enable/Disable specific functions like "Appointment Booking Tool")

**Data processing**
1. Admin uploads a document.
2. System processes text, generates vectors, and saves to MongoDB `AI_KNOWLEDGE_DOC`.
3. Admin updates Prompt. System creates a new `AI_PROMPT_VERSION`.

 #### *3.11.4 Test Agent Playground (UC-AD-07)*
**User Story:**
> *As a Platform Admin, I want to test the AI's behavior and tool-calling capabilities in a safe environment before deploying updates.*

**Function trigger**
- **Navigation path:** Admin Dashboard → AI Management → Playground.
- **Timing frequency:** During development/configuration.

**Function description**
- **Actors/Roles:** Platform Admin.
- **Purpose:** Sandbox for AI interaction testing.
- **Interface:** Chat interface with developer logs showing raw JSON tool calls.

### 3.12 Governance & Reporting Flow

 #### *3.12.1 Report Platform Violation (UC-PO-16)*
**User Story:**
> *As a User, I want to report policy violations or malpractice so that the platform admin can investigate and take action.*

**Function trigger**
- **Navigation path:** Booking Detail → "Report Issue".
- **Timing frequency:** After a visit or encounter.

**Function description**
- **Actors/Roles:** Pet Owner, Clinic Manager.
- **Purpose:** Report malpractice or violation of terms.
- **Interface:**
    - Category Selection (Abuse, Hygiene, No-show, etc.)
    - Evidence Upload (Photos)
    - Description text area

**Data processing**
1. User submits the report.
2. System creates a `USER_REPORT` record.
3. Notifies Platform Admin for moderation.

**Screen layout**
Figure 44. Screen Platform Violation Reporting (Mobile)

**Function details**
- **Business rules:** BR-31, BR-32.

 #### *3.12.2 View Platform Statistics & Revenue (UC-AD-04 / UC-CO-05)*
**User Story:**
> *As an Admin or Clinic Owner, I want to see visual charts of growth, revenue, and usage so that I can monitor the health of my business/platform.*

**Function trigger**
- **Navigation path:** Dashboard → Reports.
- **Timing frequency:** On demand.

**Function description**
- **Actors/Roles:** Admin (Platform-wide), Clinic Owner (Own Branch).
- **Purpose:** High-level dashboard for business metrics.
- **Interface:** Charts (Line, Bar, Pie) for Booking count, Revenue, and User growth.

 #### *3.12.3 Moderate Users & Content (UC-AD-09)*
**User Story:**
> *As a Platform Admin, I want to ban or suspend users who violate platform policies so that the community remains safe and professional.*

**Function trigger**
- **Navigation path:** Admin Dashboard → User Management → Select User.
- **Timing frequency:** On demand.

**Function description**
- **Actors/Roles:** Platform Admin.
- **Purpose:** Enforce governance on platform participants.
- **Interface:** User status toggle (Active/Suspended/Banned) and Reason field.

 #### *3.12.4 Manage Platform Policy*
**User Story:**
> *As a Platform Admin, I want to update terms of service and refund policies so that legal requirements are met.*

**Function trigger**
- **Navigation path:** Admin Dashboard → Governance → Policies.
- **Timing frequency:** On demand.

**Function description**
- **Actors/Roles:** Platform Admin.
- **Purpose:** Content management for site-wide legal text.
- **Interface:** Rich text editor.

### 3.13 Clinic Setup AI Agent Flow

#### *3.13.1 AI-Assisted Clinic Setup (UC-CO-14)*

**User Story:**
> *As a Clinic Owner, I want an AI assistant to help me quickly set up and configure my clinic profile, services, pricing, and descriptions so that I can launch my clinic on the platform in minutes instead of hours.*

**Function trigger**
- **Navigation path:** Web Dashboard → Clinic Setup → "Start with AI Assistant" (Button on onboarding wizard or Clinic Settings → AI Setup).
- **Timing frequency:** Once during initial clinic setup, or when updating large amounts of service information.

**Function description**
- **Actors/Roles:** Clinic Owner (Primary), Clinic Manager (Secondary - can edit).
- **Purpose:**
  - Accelerate clinic onboarding with AI-powered setup wizard.
  - Generate professional service descriptions automatically.
  - Suggest optimal pricing based on market data and clinic type.
  - Categorize and organize services intuitively.
  - Reduce manual data entry and human error.
- **Interface:**
  - **AI Setup Wizard:** Step-by-step dialog guided by AI.
  - **Service Preview Cards:** Cards showing generated service name, description, price range.
  - **Edit-in-Place:** Click any field to edit/approve AI suggestions.
  - **Bulk Actions:** "Approve All", "Regenerate All", "Add Custom Service".
  - **Progress Indicator:** Steps (Basic Info → Services → Pricing → Review).

**UC-CO-14: Chi tiết Use Case AI Hỗ trợ Thiết lập Phòng khám**

| Thành phần | Đặc tả chi tiết |
|:---|:---|
| **Mục tiêu** | Hỗ trợ chủ phòng khám thiết lập nhanh thông tin phòng khám, dịch vụ, giá cả, mô tả bằng AI. |
| **Tác nhân** | Clinic Owner (Chủ phòng khám) |
| **Tiền điều kiện** | 1. Clinic Owner đã đăng ký tài khoản và tạo clinic profile cơ bản (tên, địa chỉ, loại hình).<br/>2. AI Agent Service đang hoạt động (Status: ENABLED).<br/>3. Clinic chưa có services hoặc đang trong chế độ chỉnh sửa. |
| **Luồng xử lý chính** | 1. Owner nhấn nút "AI Setup" trong Clinic Dashboard.<br/>2. Hệ thống hiển thị AI Setup Wizard dialog.<br/>3. Owner chọn loại hình phòng khám (General Practice, Specialty, Emergency, Multi-specialty).<br/>4. Owner nhập thông tin cơ bản (nếu chưa có): địa chỉ, giờ hoạt động, loại thú cưng phục vụ (chó, mèo, exotic).<br/>5. AI Agent phân tích và gọi các tools để:<br/>&nbsp;&nbsp;&nbsp;&nbsp;- Tra cứu knowledge base về best practices cho loại hình phòng khám.<br/>&nbsp;&nbsp;&nbsp;&nbsp;- Tìm kiếm dữ liệu tham khảu về giá cả thị trường (nếu có).<br/>&nbsp;&nbsp;&nbsp;&nbsp;- Generate danh sách services phù hợp với category.<br/>&nbsp;&nbsp;&nbsp;&nbsp;- Tạo mô tả chi tiết cho từng service.<br/>&nbsp;&nbsp;&nbsp;&nbsp;- Đề xuất price range cho từng service.<br/>6. AI hiển thị danh sách services đã tạo dạng cards với thông tin:<br/>&nbsp;&nbsp;&nbsp;&nbsp;- Tên dịch vụ (VD: "Tiêm phòng DHPPi cho Chó")**<br/>&nbsp;&nbsp;&nbsp;&nbsp;- Mô tả chi tiết (AI-generated).**<br/>&nbsp;&nbsp;&nbsp;&nbsp;- Danh mục (Examination, Vaccination, Surgery, Grooming, etc.)**<br/>&nbsp;&nbsp;&nbsp;&nbsp;- Giá đề xuất (VNĐ).**<br/>&nbsp;&nbsp;&nbsp;&nbsp;- Estimated duration (phút).**<br/>7. Owner có thể:<br/>&nbsp;&nbsp;&nbsp;&nbsp;- Chỉnh sửa trực tiếp từng field.<br/>&nbsp;&nbsp;&nbsp;&nbsp;- Xóa service không muốn.<br/>&nbsp;&nbsp;&nbsp;&nbsp;- Thêm service mới thủ công.<br/>&nbsp;&nbsp;&nbsp;&nbsp;- Nhấn "Regenerate" để AI tạo lại mô tả.<br/>&nbsp;&nbsp;&nbsp;&nbsp;- Nhấn "Add More" để thêm services theo category khác.<br/>8. Owner nhấn "Next" để qua bước Pricing Tier Configuration.<br/>9. AI hiển thị gợi ý weight-based pricing tiers (nếu applicable):<br/>&nbsp;&nbsp;&nbsp;&nbsp;- Small (<5kg): Base price**<br/>&nbsp;&nbsp;&nbsp;&nbsp;- Medium (5-15kg): +20%**<br/>&nbsp;&nbsp;&nbsp;&nbsp;- Large (>15kg): +50%**<br/>10. Owner điều chỉnh và nhấn "Next" qua bước Review.<br/>11. Owner nhấn "Save & Publish" để lưu và kích hoạt.<br/>12. System redirect về Clinic Dashboard với tất cả services đã configured. |
| **Luồng thay thế** | A1. Owner muốn bắt đầu lại từ đầu → AI hỏi xác nhận và reset về trạng thái blank.<br/>A2. Owner muốn chỉ generate một số services → Owner chọn categories trước khi AI generate.<br/>A3. AI suggestions không phù hợp → Owner có thể chỉnh sửa thủ công hoặc yêu cầu AI regenerate.<br/>A4. Knowledge base không có thông tin → AI thông báo và sử dụng templates mặc định.<br/>A5. Owner muốn import services từ Master Services có sẵn → AI hỗ trợ bulk import với customization. |
| **Hậu điều kiện** | 1. Clinic có đầy đủ services với mô tả, giá cả, duration.<br/>2. Services được lưu trong `clinic_services` table với status ACTIVE.<br/>3. AI-generated content được audit log (metadata: `created_by_ai`, `confidence_score`). |
| **Quy tắc nghiệp vụ** | BR-50 (AI-generated content must be reviewable); BR-51 (Owner must approve all AI suggestions before publishing); BR-52 (AI cannot set final prices without owner confirmation). |

**Use Case: AI Clinic Setup Scenarios**

| Scenario | Owner Actions | AI Agent Logic | System Response |
|----------|---------------|----------------|-----------------|
| **Initial Setup - General Practice** | Owner clicks "AI Setup" for new clinic type "General Practice". | Agent calls `generate_clinic_services(clinic_type="general_practice", location="hcmc")`. Agent searches knowledge base for standard services and generates descriptions. | Agent returns 15 service cards covering: Examination, Vaccination, Deworming, Basic Tests, Grooming with descriptions and price suggestions. |
| **Add Specialty Services** | Owner selects "Add Ophthalmology Services". | Agent calls `generate_specialty_services(specialty="ophthalmology")`. Agent queries veterinary ophthalmology guidelines. | Agent returns 8 ophthalmology services: Eye Examination, Cataract Surgery, Glaucoma Treatment, etc. with detailed descriptions. |
| **Pricing Optimization** | Owner reviews AI-suggested prices for surgery services. | Agent calls `analyze_market_pricing(service_category="surgery", region="southern_vietnam")`. | Agent shows price comparison chart with market average vs suggested price. Owner can adjust. |
| **Multi-language Descriptions** | Owner wants service descriptions in English for foreign customers. | Agent calls `translate_service_descriptions(service_ids=[...], target_lang="en")`. | Agent generates English versions of all service descriptions. Owner can review both VN/EN. |
| **Competitor-based Pricing** | Owner asks "What should I charge compared to other clinics in District 7?". | Agent calls `analyze_competitor_pricing(location="district_7_hcmc", service_types=["vaccination", "examination"])`. | Agent returns analysis: "Your area average vaccination price: 150-200K. AI suggests: 180K (competitive but profitable)." |

**AI Tools cho Clinic Setup Agent**

| Tool Name | Purpose | Parameters | Returns |
|-----------|---------|------------|---------|
| `generate_clinic_services` | Generate danh sách services theo loại hình phòng khám | `clinic_type`, `pet_types`, `location`, `language` | `[{name, category, description, base_price, duration_minutes, ...}]` |
| `generate_service_description` | Tạo mô tả chi tiết cho một service | `service_name`, `category`, `target_pet`, `tone` (professional/friendly) | `{title, description, highlights[], faqs[]}` |
| `analyze_market_pricing` | Phân tích giá thị trường để đề xuất pricing | `service_category`, `region`, `clinic_type` | `{market_avg, price_range_low, price_range_high, recommendation}` |
| `translate_service_descriptions` | Dịch service descriptions sang ngôn ngữ khác | `service_ids[]`, `target_language` | `[{service_id, translated_title, translated_description}]` |
| `suggest_weight_tiers` | Đề xuất weight-based pricing tiers | `service_name`, `base_price`, `pet_type` | `[{weight_range, multiplier, final_price}]` |
| `import_master_services` | Import services từ Master Services template | `category`, `clinic_id`, `customizations[]` | `{imported_count, services[]}` |
| `audit_ai_content` | Kiểm tra AI-generated content | `content_type`, `content` | `{is_appropriate: bool, flags[], confidence}` |

**Data processing**

1. **Input Collection:** Wizard collects clinic type, location, pet types served, operating hours.
2. **Service Generation:** AI Agent calls `generate_clinic_services` based on clinic profile:
   - Queries knowledge base for standard veterinary services.
   - Generates contextually appropriate descriptions using LLM.
   - Suggests base prices based on market analysis.
3. **Review Workflow:** Services displayed as cards for owner review/editing:
   - Owner can edit any field inline.
   - Regenerate descriptions if unsatisfactory.
   - Delete unnecessary services.
4. **Pricing Tier Configuration:** AI suggests weight-based pricing multipliers:
   - Uses veterinary industry standards.
   - Adjusts for local market conditions.
5. **Bulk Import Option:** Owner can import from Master Services:
   - AI helps filter and customize templates.
   - Preserves ability to edit after import.
6. **Save & Publish:** All approved services saved with metadata:
   - `created_by_ai: true`
   - `ai_confidence_score: 0.85`
   - `owner_approved_at: timestamp`

**Screen layout**

```
┌─────────────────────────────────────────────────────────────────┐
│  AI Setup Wizard - Thiết lập Phòng khám                      │
├─────────────────────────────────────────────────────────────────┤
│  Step 1 of 4: Chọn loại hình phòng khám                      │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │ ○ General Practice    ○ Specialty    ○ Emergency     │   │
│  │ ○ Multi-Specialty     ○ Mobile Clinic                  │   │
│  └─────────────────────────────────────────────────────────┘   │
│                                                    [Next >]    │
├─────────────────────────────────────────────────────────────────┤
│  Step 2 of 4: Xem lại Services (15 services found)           │
│  ┌─────────────────────────────────────────────────────────────┐│
│  │ 🐕 Tiêm phòng DHPPi cho Chó                              ││
│  │ 📝 Mô tả: [AI-GENERATED] Tiêm phòng 6 bệnh...           ││
│  │ 💰 Giá: 180,000 VNĐ  ⏱️ 15 phút  📂 Vaccination         ││
│  │ [✏️ Edit] [🔄 Regenerate] [🗑️ Remove]                   ││
│  └─────────────────────────────────────────────────────────────┘│
│  ┌─────────────────────────────────────────────────────────────┐│
│  │ 🐕 Khám tổng quát                                        ││
│  │ 📝 Mô tả: [AI-GENERATED] Khám sức khỏe toàn diện...     ││
│  │ 💰 Giá: 250,000 VNĐ  ⏱️ 30 phút  📂 Examination          ││
│  │ [✏️ Edit] [🔄 Regenerate] [🗑️ Remove]                   ││
│  └─────────────────────────────────────────────────────────────┘│
│  [ + Add More Services ]  [Approve All]  [< Back] [Next >]   │
├─────────────────────────────────────────────────────────────────┤
│  Step 3 of 4: Cấu hình giá theo cân nặng                     │
│  ┌─────────────────────────────────────────────────────────────┐│
│  │ Tiêm phòng DHPPi                                         ││
│  │ ├── <5kg (Small):     180,000 VNĐ  [Edit]               ││
│  │ ├── 5-15kg (Medium):  216,000 VNĐ (+20%)  [Edit]        ││
│  │ └── >15kg (Large):    270,000 VNĐ (+50%)  [Edit]        ││
│  └─────────────────────────────────────────────────────────────┘│
│  [< Back] [Next >]                                            │
├─────────────────────────────────────────────────────────────────┤
│  Step 4 of 4: Review & Publish                                │
│  ✅ 15 Services đã được thiết lập                             │
│  ✅ Pricing tiers đã cấu hình                                │
│  📋 AI-generated content sẽ được đánh dấu trong hệ thống    │
│                                                                │
│  [ < Back ]  [ 💾 Save & Publish ]                           │
└─────────────────────────────────────────────────────────────────┘
```

**Function details**

- **Data Objects:**
  - `ClinicSetupRequest`: `{clinic_id, clinic_type, pet_types[], location, language}`
  - `GeneratedService`: `{name, category, description, base_price, duration_minutes, weight_tiers[], ai_confidence}`
  - `ServiceCardData`: `{service_id, name, description, price, duration, category, is_ai_generated}`
  - `PricingTierConfig`: `{service_id, weight_range, multiplier, final_price}`
- **Validation:**
  - Service names must be 10-100 characters.
  - Descriptions must be 50-500 characters.
  - Prices must be positive integers (VND).
  - Durations must be reasonable (5-480 minutes).
- **Safety Constraints:**
  - AI cannot create services with medical claims without vet verification flag.
  - Price suggestions must include disclaimer: "Giá tham khảo, vui lòng điều chỉnh theo thực tế".
  - AI-generated descriptions must be marked with `AI-GENERATED` label.
  - Owner must explicitly approve each service before publishing.
- **Business Rules:**
  - BR-50: All AI-generated content must be reviewable and editable.
  - BR-51: Owner must explicitly approve AI suggestions before publishing.
  - BR-52: Final pricing always requires owner confirmation.
  - BR-53: AI cannot modify existing manually-created services without permission.

**AI Agent Workflow (ReAct Pattern cho Clinic Setup)**

```mermaid
sequenceDiagram
    participant CO as Clinic Owner
    participant UI as Web Dashboard
    participant Agent as AI Agent (FastAPI)
    participant KB as Knowledge Base (Qdrant)
    participant DB as PostgreSQL

    CO->>UI: 1. Click "AI Setup Wizard"
    UI->>Agent: 2. POST /api/ai/clinic-setup/init {clinic_id}
    
    Agent->>DB: 3. Get clinic profile
    DB-->>Agent: 4. Clinic info (type, location, pets)
    
    Agent->>KB: 5. Search standard services by clinic_type
    KB-->>Agent: 6. Standard service templates
    
    Note over Agent: 7. Analyze and generate<br/>service list with<br/>descriptions & prices
    
    Agent->>Agent: 8. Call generate_clinic_services tool
    Agent->>KB: 9. Query market pricing data (optional)
    KB-->>Agent: 10. Price ranges for region
    
    Agent-->>UI: 11. Return generated services (cards)
    UI-->>CO: 12. Display wizard with service cards
    
    loop Review Loop
        CO->>UI: 13. Edit/Regenerate/Delete services
        UI->>Agent: 14. Update request
        Agent-->>UI: 15. Regenerated content
        UI-->>CO: 16. Updated cards
    end
    
    CO->>UI: 17. Click "Next" → Pricing Tier Config
    UI->>Agent: 18. Get weight tier suggestions
    Agent-->>UI: 19. Tier configurations
    UI-->>CO: 20. Display pricing tiers
    
    CO->>UI: 21. Adjust and confirm pricing
    UI->>Agent: 22. Validate pricing (BR-52)
    Agent-->>UI: 23. Validation result
    
    CO->>UI: 24. Click "Save & Publish"
    UI->>Agent: 25. Final save request
    Agent->>DB: 26. Save all services with metadata<br/>(created_by_ai=true, approved=true)
    DB-->>Agent: 27. Save confirmation
    Agent-->>UI: 28. Success response
    UI-->>CO: 29. Clinic Dashboard with all services
```

---

## 4. NON-FUNCTIONAL REQUIREMENTS

### 4.1 External Interfaces

#### 4.1.1 User Interfaces

| Platform | Technology | Description |
|----------|------------|-------------|
| Web Frontend | React 19 + Vite + TypeScript | Admin, Clinic Owner, Clinic Manager dashboards |
| Mobile App | Flutter 3.5 | Pet Owner, Staff mobile apps (iOS + Android) |

 #### *4.1.2 Hardware Interfaces*

| Interface | Description |
|-----------|-------------|
| GPS/Location | Mobile app dùng GPS để tìm clinic gần nhất |
| Camera | Upload ảnh pet, chứng chỉ |
| Push Notification | Firebase Cloud Messaging |

 #### *4.1.3 Software Interfaces*

| Interface | Provider | Purpose |
|-----------|----------|---------|
| Stripe API | Stripe | Payment processing |
| Google Sign-In | Google | OAuth authentication |
| Firebase | Google | Push notifications, analytics |
| OpenRouter API | OpenRouter | LLM inference (Cloud) - Gemini, Llama, Claude |
| DeepSeek API | DeepSeek | Alternative LLM provider (deepseek-chat) |
| LlamaIndex | LlamaIndex | 100% RAG Framework (VectorStoreIndex, SentenceSplitter, CohereEmbedding, QdrantVectorStore) |
| Cohere Embeddings | Cohere | Multilingual embeddings (embed-multilingual-v3, 1024 dims) |
| Qdrant Cloud | Qdrant | Vector database with Binary Quantization |
| DuckDuckGo Search | DuckDuckGo | Web search for AI (free, no API key) |
| Gmail SMTP | Google | Email notifications |
| Cloudinary | Cloudinary | Image storage & CDN |

 #### *4.1.4 Communication Interfaces*

| Protocol | Usage |
|----------|-------|
| HTTPS | All API calls |
| WSS | WebSocket for real-time chat |
| SMTP | Email sending |
| FCM | Push notifications |

### 4.2 Quality Attributes

#### 4.2.1 Usability

| Requirement | Target | Metric |
|-------------|--------|--------|
| Learnability | Users can complete basic tasks within 5 minutes | First-time task completion rate > 80% |
| Accessibility | WCAG 2.1 Level AA compliance | Pass automated accessibility tests |
| Mobile UX | Intuitive touch navigation | Touch target size ≥ 44px |
| Error Messages | Clear, actionable error messages | Vietnamese language support |
| Loading States | Visual feedback during operations | All async operations show loading indicators |

 #### *4.2.2 Reliability*

| Requirement | Target | Metric |
|-------------|--------|--------|
| Availability | 99.5% uptime | Monthly uptime percentage |
| MTBF (Mean Time Between Failures) | > 720 hours | Failure tracking |
| MTTR (Mean Time To Recovery) | < 1 hour | Incident response time |
| Data Backup | Daily automated backups | Backup success rate 100% |
| Failover | Auto-restart on crash | Docker restart policy: unless-stopped |

 #### *4.2.3 Performance*

| Requirement | Target | Metric |
|-------------|--------|--------|
| API Response Time | < 200ms (95th percentile) | Server-side latency |
| Page Load Time | < 3 seconds (FCP) | Lighthouse performance score |
| Database Query | < 100ms | Query execution time |
| Concurrent Users | 1000+ simultaneous | Load testing with k6 |
| Mobile App Size | < 50MB (APK) | Bundle size |

 #### *4.2.4 Maintainability and Continuous Integration*

| Requirement | Description |
|-------------|-------------|
| Version Control | Git with GitHub, branching strategy (main/develop/feature) |
| CI/CD Pipeline | GitHub Actions for automated testing and deployment |
| Documentation | README, API docs (Swagger), Code comments |
| Modularity | Microservices architecture (Backend + AI Service) |
| Logging | Structured logging với Loguru (Python), SLF4J (Java) |
| Monitoring | Docker healthchecks, Actuator endpoints |

 #### *4.2.5 Code Quality and Testability*

| Requirement | Target | Tools |
|-------------|--------|-------|
| Test Coverage | > 70% | JaCoCo (Java), pytest-cov (Python) |
| Unit Tests | All business logic | JUnit 5 (Java), pytest (Python) |
| Integration Tests | API endpoints | MockMvc (Spring), TestClient (FastAPI) |
| E2E Tests | Critical user flows | Playwright, Flutter integration tests |
| Code Quality | No critical issues | SonarQube (optional) |
| Linting | Consistent code style | ESLint (TS), Black (Python), Checkstyle (Java) |

### 4.3 Security Requirements

#### 4.3.1 Authentication & Authorization

| Requirement | Implementation | Description |
|-------------|----------------|-------------|
| JWT Authentication | Access token + Refresh token rotation | Stateless authentication với token expiry |
| Password Hashing | BCrypt (strength 10) | Secure password storage |
| OAuth 2.0 | Google Sign-In | Social login support |
| RBAC | 5 roles: PET_OWNER, STAFF, CLINIC_MANAGER, CLINIC_OWNER, ADMIN | Role-based access control |
| OTP Verification | 6-digit, 5-minute expiry | Email/phone verification |

#### 4.3.2 Anti-Spam & Rate Limiting

| Requirement | Limit | Purpose |
|-------------|-------|---------|
| **Registration Limit** | Max 3 registrations per IP per hour | Prevent spam accounts |
| **OTP Request Limit** | Max 3 OTP requests per email per 15 minutes | Prevent OTP abuse |
| **Login Attempt Limit** | Max 5 failed attempts, then 15-minute lockout | Prevent brute force |
| **API Rate Limit** | 100 requests per minute per user | Prevent API abuse |
| **Booking Limit** | Max 10 pending bookings per user | Prevent slot hoarding |
| **Review Limit** | 1 review per booking | Prevent review spam |

#### 4.3.3 Server-Side Validation

| Validation Type | Description |
|-----------------|-------------|
| Input Validation | All user inputs validated server-side (Jakarta Bean Validation) |
| SQL Injection Prevention | JPA/Hibernate parameterized queries |
| XSS Prevention | Output encoding, Content Security Policy |
| CSRF Protection | Token-based CSRF protection for web |
| File Upload Validation | Max size 10MB, allowed types: image/jpeg, image/png |
| Data Sanitization | HTML/Script tag stripping |

#### 4.3.4 Cloud Budget & Resource Controls

| Control | Limit | Provider |
|---------|-------|----------|
| **LLM API Budget** | $50/month limit with auto-pause | OpenRouter / DeepSeek |
| **Vector DB Storage** | 1GB free tier, monitor usage | Qdrant Cloud |
| **Email Sending** | 500 emails/day (Gmail SMTP) | Google |
| **Image Storage** | 25GB free tier, monitor usage | Cloudinary |
| **EC2 Instance** | t3.medium, auto-stop if idle > 2h | AWS |
| **Database Size** | 10GB limit, alert at 80% | PostgreSQL (RDS/EC2) |

#### 4.3.5 Logging & Monitoring

| Component | Tool | Integration |
|-----------|------|-------------|
| **Error Tracking** | Sentry | Capture exceptions from Backend + AI Service |
| **Discord Alerts** | Sentry → Discord Webhook | Real-time error notifications to #monitoring channel |
| **Application Logs** | SLF4J + Logback (Java), Python logging (Python) | Structured JSON logging |
| **Request Logging** | Spring Boot Actuator, FastAPI middleware | Track request/response metrics |
| **Health Checks** | `/api/actuator/health`, `/health` | Docker healthchecks + monitoring |
| **Uptime Monitoring** | UptimeRobot (optional) | Alert if services down |

**Backend Logging (Spring Boot):**

| File | Purpose | Rotation |
|------|---------|----------|
| `logs/petties-backend.log` | All logs (INFO+) | 10MB, 30 days |
| `logs/petties-error.log` | WARN + ERROR only | 10MB, 60 days |
| `logs/petties-json.log` | JSON structured (prod) | 20MB, 7 days |

Config: `logback-spring.xml`, `application.properties`

**AI Service Logging (FastAPI):**

| File | Purpose | Rotation |
|------|---------|----------|
| `logs/agent_service.log` | All logs | 10MB, 5 backups |
| `logs/agent_service_errors.log` | WARN + ERROR only | 10MB, 10 backups |

Config: `app/config/logging_config.py`, `app/config/settings.py`

**Discord Webhook Configuration:**
```
Channel: #monitoring
Events: Error, Critical, Fatal
Format: [SERVICE_NAME] [ERROR_TYPE] [TIMESTAMP] - Message
Sentry Integration: Enabled with issue alerts
```

#### 4.3.6 Data Protection

| Requirement | Implementation |
|-------------|----------------|
| HTTPS Only | TLS 1.3, HSTS header enabled |
| Data Encryption | AES-256 for sensitive data at rest |
| PII Handling | Minimal collection, user consent required |
| Data Retention | Soft delete with 30-day recovery window |
| Backup Encryption | Encrypted daily backups to S3 |
| GDPR Compliance | Right to erasure, data export available |

---

## 5. REQUIREMENT APPENDIX

### 5.1 Business Rules

*Provide common business rules that you must follow. The information can be provided in the table format as the sample below.*

| ID | Rule Definition |
|----|-----------------|
| BR-01 | Bookings must be created at least 2 hours before the appointment time. |
| BR-02 | Cancellations must be made at least 4 hours before the appointment (Non-refundable after this). |
| BR-03 | HOME_VISIT booking type requires a valid residential address and GPS coordinates. |
| BR-04 | Distance fee: 5,000 VND / km (applied from the 3rd kilometer onwards). |
| BR-05 | Each service has `slots_required` (default 1 slot = 30 minutes). |
| BR-06 | Online payment (Stripe) must be completed before the booking is CONFIRMED. |
| BR-07 | Cash payment is collected by the Staff at the Check-out stage. |
| BR-08 | Fully refundable if cancelled > 24 hours before appointment. |
| BR-09 | 50% refund if cancelled between 4-24 hours. 0% refund if < 4 hours. |
| BR-10 | System calculates refund amount automatically based on effective time of cancellation. |
| BR-11 | Users identify is Email. Staff accounts must use Google OAuth for login. |
| BR-12 | Password must be at least 6 characters. |
| BR-13 | OTP is valid for 5 minutes, with a maximum of 5 attempts for both login and sensitive actions (Email change, Password reset). |
| BR-14 | Staff accounts (Manager/Staff) are created via the Quick Add feature by Owners. |
| BR-15 | Clinics must be approved by Platform Admin before they become visible in search. |
| BR-16 | Pet Owners can register via Web/Mobile but can only log in and use the system via the Mobile app. Web portal access is blocked for this role. |
| BR-17 | Slot duration is fixed at 30 minutes per slot. |
| BR-18 | Shifts can include mandatory break times (e.g., lunch), which hide slots from public view. |
| BR-19 | Night shifts (End time < Start time) are treated as concluding the following day. |
| BR-20 | Active shifts with confirmed bookings cannot be deleted or modified in a way that orphans slots. |
| BR-21 | EMR Central Hub - All medical records are linked directly to the Pet Profile. |
| BR-22 | Staff can only edit an EMR while the booking status is IN_PROGRESS. |
| BR-23 | Once a booking is COMPLETED, the EMR is locked (Read-Only). |
| BR-24 | Authorized Staff from any clinic can read the pet's full EMR history. |
| BR-25 | The Pet Owner holds legal ownership of the records and can export them. |
| BR-26 | A Vaccination Book is automatically created upon pet profile creation. |
| BR-27 | Only Staff can add to or verify vaccination entries in the book. |
| BR-28 | Old vaccination records are never deleted; new entries are appended. |
| BR-29 | System suggests the next due date based on the vaccine's specific interval rules. |
| BR-30 | Vaccination notifications are sent to the owner 7 days and 1 day before the next due date. |
| BR-31 | Owners can report clinics/vets for malpractice or poor service after a COMPLETED visit. |
| BR-32 | Clinics can report Owners for NO_SHOW or abusive behavior. |
| BR-33 | Admin actions include: WARNING, TEMPORARY SUSPENSION, or PERMANENT BAN. |
| BR-34 | A booking can only be the subject of a violation report once. |
| BR-35 | Staff Invitation requires only Email and Role selection (Specialty for STAFF). FullName and Avatar are auto-filled from Google profile on first login. |
| BR-36 | Staff accounts created via email invitation must login via Google OAuth. Password is randomly generated and cannot be used for login. |
| BR-37 | Each clinic branch is limited to exactly one CLINIC_MANAGER. |
| BR-38 | A staff member can only be assigned to one branch at any given time. |
| BR-39 | EMR and Vaccination history are shared across clinics for pet welfare. |
| BR-40 | Booking history and payment details are private to each clinic. |
| BR-41 | A clinic only gains access to a pet's history once a booking is created. |
| BR-42 | The AI Assistant must provide general advice and state it is not a doctor. |
| BR-43 | AI can help search clinics and explain medical terms but cannot prescribe drugs. |
| BR-44 | Rating is possible only after a booking reaches "Completed" status. |
| BR-45 | PLATFORM_ADMIN accounts cannot be created or managed via any clinic-level interface. |
| BR-46 | CLINIC_MANAGER can only add STAFF accounts to their specific assigned branch. |
| BR-47 | CLINIC_OWNER can add both CLINIC_MANAGER and STAFF accounts to the branches they own. |
| BR-48 | System notifications (Welcome, OTP, Status updates) are sent via Email. |
| BR-49 | Staff Shifts and appointment slots must be scheduled for future times; retroactive scheduling (~the past~) is blocked. |
| BR-50 | Check-out for an appointment is blocked until the corresponding EMR (SOAP note) is drafted and saved. |
| BR-51 | Email change requests have a mandatory 60-second cooldown between OTP resend attempts. |
| BR-52 | Real-time GPS tracking is active ONLY for SOS Emergency bookings when the status is IN_PROGRESS (during movement). Standard Home Visits do not include real-time tracking. |
| BR-53 | Additional services and miscellaneous incurred costs must be visible in the final invoice/summary. |
| BR-54 | Adding additional services or custom costs automatically updates the total price of the booking for final reconciliation. |
| BR-55 | **[EMR]** EMR có thể UPDATE bởi Staff thuộc **cùng phòng khám đã tạo EMR** trong vòng **24 giờ** kể từ lúc tạo. |
| BR-56 | **[EMR]** EMR từ **phòng khám khác** chỉ được phép **READ-ONLY**, không thể chỉnh sửa. |
| BR-57 | **[EMR]** Sau 24 giờ kể từ thời điểm tạo, EMR bị **khóa vĩnh viễn** - chỉ READ-ONLY cho tất cả. |
| BR-58 | **[Patient]** Khi Pet khám **lần đầu** tại Clinic, hệ thống **TỰ ĐỘNG tạo ClinicPatient** record để liên kết Pet với Clinic, giúp hạn chế nhập thủ công. |
| BR-59 | **[SOS]** SOS Emergency bookings must search for clinics within 10km radius from pet owner's location. |
| BR-60 | **[SOS]** SOS Auto-Match attempts maximum 5 clinics per request. |
| BR-61 | **[SOS]** Each clinic has 60 seconds to respond to SOS request before escalation to next clinic. |
| BR-62 | **[SOS]** Pet Owner cannot create new SOS booking if existing SOS booking is in active status (SEARCHING, PENDING_CLINIC_CONFIRM, CONFIRMED, IN_PROGRESS). |
| BR-63 | **[SOS]** SOS bookings bypass specialty check - any available staff can be assigned regardless of specialty. |
| BR-64 | **[SOS]** SOS booking status flow: SEARCHING → PENDING_CLINIC_CONFIRM → CONFIRMED → IN_PROGRESS → COMPLETED/CANCELLED. |
| BR-65 | **[SOS]** If no clinic accepts SOS within timeout period, system cancels booking and provides hotline number (1900-PETTIES). |
| BR-66 | **[SOS]** SOS booking code format: "SOS-" + timestamp (must be unique). |


### 5.2 Common Requirements

1. Supports PNG, JPG, JPEG image file format, maximum image size 10MB.
2. Data in the form of lists, tables, etc. will be displayed as data tables with paging supported.
3. On each web page, there should be no more than 3 fonts displayed.
4. All changes, updates, and modifications are alerted by pop-up (Toast message).
5. Ensure the platform is accessible 24/7, with maintenance scheduled during off-peak hours.
6. JWT-based authentication with Access Token (24h) and Refresh Token (7 days).
7. Role-based Access Control (RBAC) with 5 roles: PET_OWNER, STAFF, CLINIC_MANAGER, CLINIC_OWNER, ADMIN.
8. Platform restrictions: PET_OWNER (Mobile only), STAFF (Mobile + Web), ADMIN/CLINIC_OWNER/MANAGER (Web only).
9. Server-side validation required for all input; client-side validation for UX only.
10. Vietnamese characters support (UTF-8) for all text fields.
11. Default timezone: Asia/Ho_Chi_Minh (UTC+7); all timestamps stored in UTC.
12. Primary language: Vietnamese; error and success messages displayed in Vietnamese.
13. All passwords must be at least 6 characters.
14. OTP codes are valid for 5 minutes with a maximum of 5 retry attempts before lockout.
15. Booking slots are fixed at 30 minutes per slot.
16. Cancellation policy: Free cancellation > 24h, 50% refund 4-24h, no refund < 4h before appointment.
17. All medical records (EMR, Vaccination) are linked directly to Pet Profile and shared across clinics.
18. AI Assistant provides general advice only and cannot prescribe medication.


 ### 5.3 Application Messages List

| # | Message Code | Message Type | Context | Content |
|---|--------------|--------------|---------|---------|
| 1 | MSG-E01 | Toast message | Invalid login credentials | "Email hoặc mật khẩu không đúng" |
| 2 | MSG-E02 | Toast message | JWT token expired | "Phiên đăng nhập đã hết hạn. Vui lòng đăng nhập lại." |
| 3 | MSG-E03 | Toast message | Unauthorized access attempt | "Bạn không có quyền truy cập" |
| 4 | MSG-E04 | In line | Invalid OTP entered | "Mã OTP không đúng. Bạn còn {n} lần thử." |
| 5 | MSG-E05 | Toast message | OTP has expired | "Mã OTP đã hết hạn. Vui lòng yêu cầu mã mới." |
| 6 | MSG-E06 | In line | Email already registered | "Email đã được đăng ký" |
| 7 | MSG-E07 | Toast message | Slot already booked by another user | "Slot đã được đặt. Vui lòng chọn slot khác." |
| 8 | MSG-E08 | Toast message | Cancellation within 4 hours | "Không thể hủy booking trong 4 giờ trước giờ hẹn" |
| 9 | MSG-E09 | In line | Pet selection required | "Vui lòng chọn thú cưng" |
| 10 | MSG-E10 | Toast message | Payment processing failed | "Thanh toán thất bại. Vui lòng thử lại." |
| 11 | MSG-E11 | Toast message | Refund processing failed | "Không thể hoàn tiền. Vui lòng liên hệ hỗ trợ." |
| 12 | MSG-E12 | In line, under text box | Required field is empty | "Trường này không được để trống" |
| 13 | MSG-E13 | Toast message | Internal server error | "Có lỗi xảy ra. Vui lòng thử lại sau." |
| 14 | MSG-E14 | Toast message | Phone number already exists | "Số điện thoại đã được đăng ký" |
| 15 | MSG-E15 | In line | Invalid phone format | "Số điện thoại không hợp lệ" |
| 16 | MSG-E16 | In line | Password too weak | "Mật khẩu phải có ít nhất 8 ký tự, bao gồm chữ và số" |
| 17 | MSG-E17 | Toast message | Clinic not approved yet | "Phòng khám chưa được phê duyệt" |
| 18 | MSG-E18 | Toast message | PET_OWNER trying to login on Web | "Tài khoản Pet Owner chỉ có thể đăng nhập qua ứng dụng Mobile" |
| 19 | MSG-E19 | Toast message | Shift has active bookings | "Không thể xóa ca làm việc đã có booking" |
| 20 | MSG-E20 | Toast message | No search results found | "Không tìm thấy kết quả" |
| 21 | MSG-S01 | Toast message | Registration completed | "Đăng ký thành công" |
| 22 | MSG-S02 | Toast message | Login successful | "Đăng nhập thành công" |
| 23 | MSG-S03 | Toast message | Password changed | "Đổi mật khẩu thành công" |
| 24 | MSG-S04 | Toast message | Booking created | "Đặt lịch thành công" |
| 25 | MSG-S05 | Toast message | Booking cancelled | "Hủy lịch thành công" |
| 26 | MSG-S06 | Toast message | Payment completed | "Thanh toán thành công" |
| 27 | MSG-S07 | Toast message | Pet profile created | "Thêm thú cưng thành công" |
| 28 | MSG-S08 | Toast message | Pet profile updated | "Cập nhật thông tin thú cưng thành công" |
| 29 | MSG-S09 | Toast message | Pet profile deleted | "Xóa thú cưng thành công" |
| 30 | MSG-S10 | Toast message | Clinic info updated | "Cập nhật thông tin phòng khám thành công" |
| 31 | MSG-S11 | Toast message | Staff added | "Thêm nhân viên thành công" |
| 32 | MSG-S12 | Toast message | Shift created | "Tạo ca làm việc thành công" |
| 33 | MSG-S13 | Toast message | OTP sent | "Mã OTP đã được gửi đến {email/phone}" |
| 34 | MSG-S14 | Toast message | Review submitted | "Gửi đánh giá thành công" |
| 35 | MSG-S15 | Toast message | EMR saved | "Lưu hồ sơ bệnh án thành công" |
| 36 | MSG-S16 | Toast message | Vaccination added | "Thêm thông tin tiêm chủng thành công" |
| 37 | MSG-S17 | Toast message | Check-in completed | "Check-in thành công" |
| 38 | MSG-S18 | Toast message | Check-out completed | "Check-out thành công. Lịch khám đã hoàn tất." |
| 39 | MSG-S19 | Toast message | Image uploaded | "Tải ảnh lên thành công" |
| 40 | MSG-S20 | Toast message | Profile updated | "Cập nhật thông tin cá nhân thành công" |
---

### 5.4 Test Strategy

#### 5.4.1 Test Types Overview

| Test Type | Description | Tools | Responsibility |
|-----------|-------------|-------|----------------|
| Unit Test | Test individual components (services, controllers) | JUnit 5, Mockito | Developer |
| Integration Test | Test component interactions (API endpoints) | Spring Boot Test | Developer |
| Functional Test | Test complete user scenarios (end-to-end) | Manual + Postman | QA Team |
| Security Test | Test authentication, authorization, vulnerabilities | OWASP ZAP, Manual | Security + QA |
| Performance Test | Test load and response time | JMeter, k6 | DevOps + QA |

---

#### 5.4.2 Functional Tests

Functional tests verify that the system behaves correctly from the user's perspective.

##### Authentication & Account

| TC-ID | Test Case | Pre-condition | Steps | Expected Result | Priority |
|-------|-----------|---------------|-------|-----------------|----------|
| TC-AUTH-01 | Register with valid email | User not registered | 1. Enter valid email, password 2. Enter OTP | Account created, redirect to home | High |
| TC-AUTH-02 | Register with existing email | Email already registered | 1. Enter existing email | Show error MSG-E06 | High |
| TC-AUTH-03 | Login with valid credentials | User exists | 1. Enter email/password 2. Submit | Login successful, JWT issued | High |
| TC-AUTH-04 | Login with wrong password | User exists | 1. Enter wrong password | Show error MSG-E01 | High |
| TC-AUTH-05 | Forgot password OTP | User exists | 1. Request OTP 2. Enter OTP 3. Set new password | Password changed | Medium |
| TC-AUTH-06 | OTP expired retry | OTP sent > 5 mins | 1. Enter expired OTP | Show error MSG-E05 | Medium |
| TC-AUTH-07 | Google OAuth login | Google account linked | 1. Click Google login | Login successful | Medium |
| TC-AUTH-08 | Pet Owner login on Web | Pet Owner account | 1. Try login on web | Show error MSG-E18 | High |

##### Pet Management

| TC-ID | Test Case | Pre-condition | Steps | Expected Result | Priority |
|-------|-----------|---------------|-------|-----------------|----------|
| TC-PET-01 | Add new pet | User logged in | 1. Fill pet info 2. Upload avatar 3. Save | Pet created, show MSG-S07 | High |
| TC-PET-02 | Edit pet info | Pet exists | 1. Update pet info 2. Save | Pet updated, show MSG-S08 | High |
| TC-PET-03 | Delete pet with no bookings | Pet has no active booking | 1. Delete pet 2. Confirm | Pet deleted, show MSG-S09 | Medium |
| TC-PET-04 | Delete pet with active booking | Pet has pending booking | 1. Try to delete | Show error, cannot delete | Medium |
| TC-PET-05 | View pet medical history | Pet has EMR records | 1. Open pet profile 2. View history | Show list of EMR records | High |

##### Booking Flow

| TC-ID | Test Case | Pre-condition | Steps | Expected Result | Priority |
|-------|-----------|---------------|-------|-----------------|----------|
| TC-BOOK-01 | Create IN_CLINIC booking | User logged in, pet exists | 1. Select clinic 2. Select service 3. Choose slot 4. Confirm | Booking created, status PENDING | High |
| TC-BOOK-02 | Create HOME_VISIT booking | Clinic supports home visit | 1. Select HOME_VISIT type 2. Enter address | Booking with location created | High |
| TC-BOOK-03 | Slot already booked | Same slot booked by another | 1. Select same slot | Show error MSG-E07 | High |
| TC-BOOK-04 | Cancel booking > 24h | Booking > 24h before | 1. Cancel booking | Full refund, show MSG-S05 | High |
| TC-BOOK-05 | Cancel booking < 4h | Booking < 4h before | 1. Try to cancel | Show error MSG-E08 | High |
| TC-BOOK-06 | Manager confirm booking | Booking status PENDING | 1. Manager clicks confirm | Status → CONFIRMED | High |
| TC-BOOK-07 | Manager assign staff | Booking status CONFIRMED | 1. Select staff 2. Assign | Status → CONFIRMED (Staff assigned) | High |
| TC-BOOK-08 | Staff start moving / check-in | Booking status CONFIRMED | 1. Staff clicks start moving / check-in | Status → IN_PROGRESS | High |
| TC-BOOK-09 | Staff checkout | Booking status IN_PROGRESS | 1. Staff clicks checkout | Status → COMPLETED | High |
| TC-BOOK-10 | Reassign staff | Booking status CONFIRMED | 1. Manager selects new staff | Staff changed, logic updated | Medium |

##### Payment Flow

| TC-ID | Test Case | Pre-condition | Steps | Expected Result | Priority |
|-------|-----------|---------------|-------|-----------------|----------|
| TC-PAY-01 | Cash payment | Booking IN_PROGRESS | 1. Select CASH 2. Confirm | Payment recorded | High |
| TC-PAY-02 | QR payment | Booking IN_PROGRESS | 1. Select QR 2. Scan | Payment callback received | High |
| TC-PAY-03 | Add extra service | Booking IN_PROGRESS | 1. Add service 2. Recalculate | Total price updated | Medium |

##### EMR & Patient

| TC-ID | Test Case | Pre-condition | Steps | Expected Result | Priority |
|-------|-----------|---------------|-------|-----------------|----------|
| TC-EMR-01 | Create EMR SOAP | Booking IN_PROGRESS | 1. Fill SOAP form 2. Save | EMR created, show MSG-S15 | High |
| TC-EMR-02 | Edit EMR within 24h | EMR < 24h old, same clinic | 1. Edit EMR 2. Save | EMR updated | Medium |
| TC-EMR-03 | Edit EMR after 24h | EMR > 24h old | 1. Try to edit | Read-only, cannot edit | Medium |
| TC-EMR-04 | View EMR from other clinic | EMR from different clinic | 1. Open EMR | Read-only view | Medium |
| TC-EMR-05 | Staff view patient before exam | Booking assigned | 1. Open patient info | Show pet info + history | High |
| TC-EMR-06 | Add vaccination record | Pet exists | 1. Add vaccine info 2. Save | Vaccination recorded | Medium |

---

#### 5.4.3 Security Tests

Security tests verify that the system is protected against unauthorized access and common vulnerabilities.

##### Authentication Security

| TC-ID | Test Case | Attack Vector | Steps | Expected Behavior | Priority |
|-------|-----------|---------------|-------|-------------------|----------|
| TC-SEC-01 | Brute force login | Multiple wrong passwords | 1. Submit wrong password 10+ times | Account locked after 5 attempts | High |
| TC-SEC-02 | SQL Injection login | Malicious input | 1. Enter `' OR '1'='1` in email | Input sanitized, error returned | High |
| TC-SEC-03 | JWT token tampering | Modified token | 1. Modify JWT payload 2. Send request | 401 Unauthorized | High |
| TC-SEC-04 | Expired token access | Token > 24h | 1. Use expired access token | 401 Unauthorized, MSG-E02 | High |
| TC-SEC-05 | Refresh token reuse | Token already used | 1. Reuse refresh token | Old token invalidated | Medium |
| TC-SEC-06 | Password plain text | Check storage | 1. Query database | Password is BCrypt hashed | High |

##### Authorization Security

| TC-ID | Test Case | Attack Vector | Steps | Expected Behavior | Priority |
|-------|-----------|---------------|-------|-------------------|----------|
| TC-SEC-07 | PET_OWNER access admin API | Role bypass | 1. Call /admin/* endpoint | 403 Forbidden, MSG-E03 | High |
| TC-SEC-08 | STAFF access other clinic data | Horizontal privilege | 1. Query other clinic's bookings | 403 Forbidden | High |
| TC-SEC-09 | Access other user's pet | IDOR attack | 1. GET /pets/{other_pet_id} | 403 Forbidden | High |
| TC-SEC-10 | MANAGER modify other clinic | Cross-clinic access | 1. Try to update other clinic | 403 Forbidden | High |
| TC-SEC-11 | Unauthenticated API access | No token | 1. Call protected endpoint without token | 401 Unauthorized | High |

##### Data Security

| TC-ID | Test Case | Attack Vector | Steps | Expected Behavior | Priority |
|-------|-----------|---------------|-------|-------------------|----------|
| TC-SEC-12 | XSS in user input | Stored XSS | 1. Enter `<script>alert(1)</script>` in name | Input sanitized/escaped | High |
| TC-SEC-13 | File upload malware | Malicious file | 1. Upload .exe as avatar | File type rejected | High |
| TC-SEC-14 | File size limit | DoS attack | 1. Upload file > 10MB | 413 Payload Too Large | Medium |
| TC-SEC-15 | HTTPS enforcement | Man-in-middle | 1. Access http:// | Redirect to https:// | High |
| TC-SEC-16 | Sensitive data in logs | Information leak | 1. Check server logs | No passwords/tokens logged | Medium |

##### API Security

| TC-ID | Test Case | Attack Vector | Steps | Expected Behavior | Priority |
|-------|-----------|---------------|-------|-------------------|----------|
| TC-SEC-17 | Rate limiting | DDoS attack | 1. Send 100+ requests/min | 429 Too Many Requests | Medium |
| TC-SEC-18 | CORS policy | Cross-origin attack | 1. Request from unknown origin | CORS blocked | High |
| TC-SEC-19 | Input validation bypass | Invalid data | 1. Send negative price value | 400 Bad Request | Medium |
| TC-SEC-20 | Mass assignment | Object injection | 1. Add `role: ADMIN` to request | Extra fields ignored | High |

---

**Document Status:** In Progress
**Version:** 1.7.0
**Last Updated:** 2026-01-28
**Author:** Petties Development Team