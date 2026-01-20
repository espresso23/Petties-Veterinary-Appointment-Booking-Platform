# PETTIES - Software Requirements Specification (SRS)

**Project:** Petties - Veterinary Appointment Booking Platform
**Version:** 1.3.2 (Booking Module - Manager Vet Assignment)
**Last Updated:** 2026-01-18
**Document Status:** In Progress

---

## Table of Contents

1. [Product Overview](#1-product-overview)
2. [User Requirements](#2-user-requirements)
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
4. [Non-Functional Requirements](#5-non-functional-requirements)
5. [Requirement Appendix](#6-requirement-appendix)

---

## 1. PRODUCT OVERVIEW

### 1.1 Product Purpose

**Petties** là nền tảng kết nối chủ thú cưng (Pet Owner) với các phòng khám thú y (Veterinary Clinics). Hệ thống cho phép:

- 🐾 Chủ pet đặt lịch khám tại phòng khám hoặc tại nhà
- 🏥 Phòng khám quản lý dịch vụ, bác sĩ, lịch làm việc
- 👨‍⚕️ Bác sĩ quản lý ca làm, khám bệnh, ghi hồ sơ y tế
- 🤖 AI Chatbot hỗ trợ tư vấn chăm sóc thú cưng
- 📊 Admin quản lý toàn bộ nền tảng

### 1.2 Product Scope

| Aspect | Description |
|--------|-------------|
| **Platform** | Web (Admin, Clinic), Mobile (Pet Owner, Vet) |
| **Target Users** | Pet Owners, Veterinary Clinics, Vets, Admins |
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
    VET["👨‍⚕️ Vet<br/>(Mobile + Web)"]
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
    
    %% Vet flows
    VET -->|"Login, View Schedule"| SYSTEM
    VET -->|"View Assigned Bookings"| SYSTEM
    VET -->|"Check-in, Create/Edit EMR"| SYSTEM
    VET -->|"Add/Edit Vaccination, Check-out"| SYSTEM
    SYSTEM -->|"Assigned Bookings, Schedules"| VET
    SYSTEM -->|"Pet Profile (EMR + Vaccination, READ-ONLY cross-clinic)"| VET
    
    %% Clinic Manager flows
    CM -->|"Add/Remove Vet"| SYSTEM
    CM -->|"Create Vet Schedule"| SYSTEM
    CM -->|"Assign Vet to Booking"| SYSTEM
    SYSTEM -->|"Vet List, Booking List/Pending Bookings"| CM
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
| **VET** | Mobile + Web | Bác sĩ thú y, khám bệnh, ghi EMR |
| **CLINIC_MANAGER** | Web only | Quản lý phòng khám, gán booking cho bác sĩ |
| **CLINIC_OWNER** | Web only | Chủ phòng khám, quản lý dịch vụ, doanh thu |
| **ADMIN** | Web only | Admin nền tảng, duyệt phòng khám, quản lý AI |

### 2.2 User Stories (Organized by Epic/Module)
> **Note:** Requirements are now organized by Functional Module rather than by User Role to align with System Design.

#### 2.2.1 Authentication & Onboarding
| UC-ID | Actor | User Story / Requirement | Priority |
| :--- | :--- | :--- | :--- |
| UC-PO-01 | Pet Owner | **Register & Login** (Email/OTP) | High |
| UC-PO-02 | Pet Owner | **Google Login** (OAuth 2.0) | High |
| UC-VT-01 | Vet | **Staff Login** (Invited Account) | High |
| UC-CM-01 | Manager | **Manager Login** | High |
| UC-CM-03 | Manager | **Invite Staff** (Quick Add by Email) | High |
| UC-CO-01 | Clinic Owner | **Register Clinic** (Pending Approval) | High |
| UC-AD-01 | Admin | **Admin Login** | High |

#### 2.2.2 User Profile & Account Setup
| UC-ID | Actor | User Story / Requirement | Priority |
| :--- | :--- | :--- | :--- |
| UC-PO-03 | Pet Owner | **Manage Personal Profile** (Update Info, Avatar) | Medium |
| UC-PO-03d| Pet Owner | **Change Password** | Medium |
| UC-PO-03c| Pet Owner | **Change Email** | Low |

#### 2.2.3 Pet Records & Health Hub
| UC-ID | Actor | User Story / Requirement | Priority |
| :--- | :--- | :--- | :--- |
| UC-PO-04 | Pet Owner | **Manage Pet Profiles** (Add/Edit/Delete) | High |
| UC-PO-11 | Pet Owner | **View Pet EMR Records** | Medium |
| UC-PO-12 | Pet Owner | **View Vaccination Records** | Medium |
| UC-VT-13 | Vet | **View Patient History** (Mobile) | High |

#### 2.2.4 Clinic Discovery & Search
| UC-ID | Actor | User Story / Requirement | Priority |
| :--- | :--- | :--- | :--- |
| UC-PO-05 | Pet Owner | **Search Clinics** (Location/Filter) | High |
| UC-PO-05b| Pet Owner | **View Clinic Details** | High |

#### 2.2.5 Booking & Appointment Lifecycle
| UC-ID | Actor | User Story / Requirement | Priority |
| :--- | :--- | :--- | :--- |
| UC-PO-06 | Pet Owner | **Book Clinic Visit** | High |
| UC-PO-07 | Pet Owner | **Book Home Visit** | High |
| UC-PO-08 | Pet Owner | **View My Bookings** | High |
| UC-PO-09 | Pet Owner | **Cancel Booking** | Medium |
| UC-PO-10 | Pet Owner | **Online Payment** (Stripe) | High |
| UC-VT-03 | Vet | **View Assigned Bookings** | High |
| UC-VT-04 | Vet | **Update Appointment Progress** | High |
| UC-VT-05 | Vet | **Check-in Patient** | High |
| UC-VT-09 | Vet | **Mark Treatment Finished** (Request payment) | High |
| UC-CM-05 | Manager | **View New Bookings** | High |
| UC-CM-06 | Manager | **Assign Vet to Booking** | High |
| UC-CM-07 | Manager | **Handle Cancellations & Refunds** | Medium |
| UC-CM-10 | Manager | **Receive Payment & Checkout** (Close booking) | High |

#### 2.2.6 Staffing & Scheduling
| UC-ID | Actor | User Story / Requirement | Priority |
| :--- | :--- | :--- | :--- |
| UC-VT-02 | Vet | **View Personal Schedule** | High |
| UC-CM-02 | Manager | **View Staff List** | High |
| UC-CM-04 | Manager | **Create Vet Shift** (Manual Scheduling) | High |
| UC-CM-05 | Manager | **Manage Shifts** (Delete/Edit) | Medium |
| UC-CO-06 | Clinic Owner | **Quick Add Staff** (Manager/Vet) | Medium |
| UC-CO-07 | Clinic Owner | **Manage Clinic Staff** | Medium |

#### 2.2.7 Clinical Operations & Service Setup
| UC-ID | Actor | User Story / Requirement | Priority |
| :--- | :--- | :--- | :--- |
| UC-CO-02 | Clinic Owner | **Manage Clinic Info** | High |
| UC-CO-03 | Clinic Owner | **Configure Clinic Services** | High |
| UC-CO-04 | Clinic Owner | **Configure Pricing & Weights** | High |
| UC-CO-08 | Clinic Owner | **Manage Master Services** | High |
| UC-CO-05 | Clinic Owner | **View Revenue Reports** | Medium |

#### 2.2.8 Patient Management (EMR & Care)
| UC-ID | Actor | User Story / Requirement | Priority |
| :--- | :--- | :--- | :--- |
| UC-VT-06 | Vet | **Create EMR Record** (SOAP) | High |
| UC-VT-07 | Vet | **Prescribe Medication** | Medium |
| UC-VT-08 | Vet | **Add Vaccination Record** | Medium |
| UC-VT-12 | Vet | **Patient Lookup** | Medium |
| UC-CM-08 | Manager | **View Patient List** | Medium |
| UC-CM-09 | Manager | **View Patient Records** | Medium |

#### 2.2.9 SOS Emergency Services
| UC-ID | Actor | User Story / Requirement | Priority |
| :--- | :--- | :--- | :--- |
| UC-PO-15 | Pet Owner | **Request SOS** | High |
| UC-PO-17 | Pet Owner | **Track Vet Location** | High |
| UC-PO-18 | Pet Owner | **View ETA & Route** | High |
| UC-PO-19 | Pet Owner | **Receive Arrival Alert** | High |
| UC-VT-10 | Vet | **Receive SOS Assignment** | High |
| UC-VT-11 | Vet | **Start Emergency Travel** (Manual Click) | High |
| UC-VT-11b| Vet | **Confirm SOS Arrival** (Manual Click/Auto-Geofence) | High |
| UC-CM-13 | Manager | **Dispatch SOS** (if manual) | Medium |

#### 2.2.10 AI Assistance & Agents
| UC-ID | Actor | User Story / Requirement | Priority |
| :--- | :--- | :--- | :--- |
| UC-PO-14a| Pet Owner | **Ask Pet Care Advice** (RAG) | Medium |
| UC-PO-14b| Pet Owner | **Symptom Check** | Medium |
| UC-PO-14c| Pet Owner | **AI Booking Assistant** | Medium |
| UC-AD-05 | Admin | **Manage Agent Tools** | Low |
| UC-AD-06 | Admin | **Manage Knowledge Base** | Low |
| UC-AD-07 | Admin | **Test Agent Playground** | Low |

#### 2.2.11 Platform Administration & Governance
| UC-ID | Actor | User Story / Requirement | Priority |
| :--- | :--- | :--- | :--- |
| UC-AD-02 | Admin | **View Pending Clinics** | High |
| UC-AD-03 | Admin | **Approve/Reject Clinic** | High |
| UC-AD-04 | Admin | **View Platform Stats** | Medium |
| UC-AD-08 | Admin | **View User Reports** | Medium |
| UC-AD-09 | Admin | **Moderate Users** (Ban/Suspend) | Medium |
| UC-PO-13 | Pet Owner | **Rate & Review** | Low |
| UC-PO-16 | Pet Owner | **Report Violation** | Low |

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
        SOSTracking --> SOSArrived[Vet Arrived]
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

##### 3.1.1.2 Mobile App - Vet Flow (16 screens)


```mermaid
flowchart LR
    VET([Vet]) --> Login

    subgraph Authentication
        Login --> VetHome[Vet Home]
    end

    subgraph Schedule
        VetHome --> MySchedule[My Schedule]
    end

    subgraph Booking_Management[Booking Management]
        VetHome --> AssignedBookings[Assigned Bookings]
        AssignedBookings --> BookingDetail[Booking Detail]
        BookingDetail -- "Check-In" --> BookingDetail
        BookingDetail -- "Add Service" --> BookingDetail
        BookingDetail -- "Complete" --> BookingDetail
    end

    subgraph Patient_Management[Patient Management]
        VetHome --> PatientsList[Patients List]
        PatientsList --> PatientDetails[Patient Details]
        BookingDetail -- "View Patient" --> PatientDetails
        PatientDetails --> ViewHistory[View History]
        PatientDetails --> CreateEMR[Create EMR]
        PatientDetails --> AddVaccination[Add Vaccination]
        PatientDetails --> BookingDetail
    end

    subgraph Notification
        VetHome --> Notifications
    end

    subgraph Profile
        VetHome --> ProfileScreen[Profile]
    end
```

---

##### 3.1.1.3 Web App - Vet Flow (9 screens)

```mermaid
flowchart LR
    VET([Vet]) --> Login

    subgraph Authentication
        Login --> VetHome[Vet Home]
    end

    subgraph Booking_Management[Booking Management]
        VetHome --> BookingsList[Bookings List]
        BookingsList --> BookingDetail[Booking Detail]
        BookingDetail -- "Check-In" --> BookingDetail
        BookingDetail -- "Add Service" --> BookingDetail
        BookingDetail -- "Complete" --> BookingDetail
    end

    subgraph Patient_Management[Patient Management]
        VetHome --> PatientList[Patient List]
        PatientList --> PatientDetails[Patient Details]
        BookingDetail -- "View Patient" --> PatientDetails
        PatientDetails --> ViewHistory[View History]
        PatientDetails --> CreateEMR[Create EMR]
        PatientDetails --> AddVaccination[Add Vaccination]
        PatientDetails --> BookingDetail
    end

    subgraph General
        VetHome --> ProfileScreen[Profile]
        VetHome --> MySchedule[My Schedule]
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
        Dashboard --> VetSchedules[Vet Schedules]
    end

    subgraph Booking_Management[Booking Management]
        Dashboard --> BookingsList[Bookings List]
        BookingsList --> BookingDetail[Booking Detail]
        BookingDetail --> AssignVet[Assign Vet]
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
| 3 | Auth | Login | Mobile/PO, Vet | Username + Password, Forgot Password link. Google Sign-in (TBI) |
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
| 13 | Vet Home | Mobile/Vet | Welcome card, Today stats, Today schedule, Pending bookings |
| 14 | Vet Home | Web/Vet | Shift overview, pending examinations (Placeholder) |
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
| 31 | Staff Mgt | Manage Staff | Web/Owner | Clinic dropdown, StaffTable, QuickAddStaffModal (VET/MANAGER) |
| 32 | Staff Mgt | Staff List | Web/Manager | Manage branch vets directory, quick add tools |
| 33 | Booking | Create Booking | Mobile/PO | Select pet, service, date, time slot, notes |
| 34 | Booking | Payment | Mobile/PO | Stripe/Cash checkout with cost breakdown |
| 35 | Booking | My Bookings | Mobile/PO | Appointment list: Upcoming, Completed, Cancelled |
| 36 | Booking | Booking Detail | Mobile/PO | Real-time status timeline, actions, contact |
| 37 | Booking | Assigned Bookings | Mobile/Vet | List of assigned bookings (Today, Upcoming, Done) |
| 38 | Booking | Booking Detail | Mobile/Vet | Appointment details, pet info, owner contact, start check-in |
| 39 | Booking | Bookings List | Web/Vet | Bookings with advanced table filtering |
| 40 | Booking | Booking Detail | Web/Vet | Appointment details, triage actions |
| 41 | Booking | Bookings List | Web/Manager | Oversight of branch appointments |
| 42 | Booking | Assign Vet | Web/Manager | Assigning available doctors to requests |
| 43 | Booking | Refunds | Web/Manager | Cancellation management, refund processing |
| 44 | Clinical | Examination View | Mobile/Vet | Active examination screen (In-Progress) |
| 45 | Clinical | Create EMR | Mobile/Vet | Clinical notes (SOAP format), prescription entry |
| 46 | Clinical | Checkout | Web/Manager | Receive payment & Close booking (COMPLETED) |
| 47 | Clinical | Add Vaccination | Mobile/Vet | Record new immunization entries |
| 48 | Clinical | Examination Hub | Web/Vet | Main hub for managing active examinations |

##### 3.1.2.6 Patient & Schedule Management (#50-58)

| # | Module | Screen Name | Platform/Role | Description |
|:---:|:---|:---|:---|:---|
| 50 | Patient Mgt | Pet History | Mobile/Vet | Comprehensive view of medical history, vaccines |
| 51 | Patient Mgt | Patients List | Mobile/Vet | Directory of patients treated at clinic |
| 52 | Patient Mgt | Patient List | Web/Vet | Directory of patients treated at clinic |
| 53 | Patient Mgt | Patient History | Web/Vet | Detailed medical records, vaccine view |
| 54 | Patient Mgt | Patient List | Web/Manager | Patient directory with immunization alerts |
| 55 | Patient Mgt | Patient Detail | Web/Manager | Detailed clinical records view (read-only) |
| 56 | Schedule | My Schedule | Mobile/Vet | Personal calendar (Month/Week/Day views) |
| 57 | Schedule | My Schedule | Web/Vet | Desktop-optimized personal calendar |
| 58 | Schedule | Vet Schedules | Web/Manager | Roster management, shift allocation |

##### 3.1.2.7 Other Core Modules (#59-80)

| # | Module | Screen Name | Platform/Role | Description |
|:---:|:---|:---|:---|:---|
| 59 | SOS Emergency | Create SOS Request | Mobile/PO | Wizard to create emergency SOS booking with location, pet selection |
| 60 | SOS Emergency | SOS Tracking | Mobile/PO | Real-time GPS map showing vet location, route, and ETA |
| 61 | SOS Emergency | Start SOS Travel | Mobile/Vet | Emergency GPS toggle, route visual, geofence arrival confirmation |
| 62 | Communication | AI Chat | Mobile/PO | Chat with AI assistant (3 modes: RAG Knowledge, Symptom Checker, AI Booking) |
| 63 | Pet Health | Pet EMR History | Mobile/PO | View pet's medical records timeline (SOAP notes, prescriptions) |
| 64 | Pet Health | Pet Vaccination History | Mobile/PO | View pet's vaccination records with next due dates and reminders |
| 65 | Notification | Notifications | Mobile/PO, Vet | In-app notification center for users and staff |
| 66 | Notification | Notifications | Web/All Staff | Centralized operational and system alerts |
| 67 | Profile | Profile | Mobile/PO, Vet | Avatar, Info, Actions (Edit, Email, Pass, Logout) |
| 68 | Profile | Edit Profile | Mobile/PO, Vet | Form to edit personal info (name, phone, avatar) |
| 69 | Profile | Change Email | Mobile/PO, Vet | Form to change email with OTP verification |
| 70 | Profile | Change Pass | Mobile/PO, Vet | Form to change password (current + new) |
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

| Screen | GUEST | PET_OWNER | VET | CLINIC_OWNER | CLINIC_MANAGER | ADMIN |
|--------|:-----:|:---------:|:---:|:------------:|:--------------:|:-----:|
| **Authentication Module** | | | | | | |
| Landing Page (Web) | X | X | X | X | X | X |
|   → View features | X | X | X | X | X | X |
|   → Navigate to Login/Register | X | X | X | X | X | X |
| Login Screen (Mobile - PO) | X | | | | | |
|   → Enter email/password | X | | | | | |
|   → Google Sign-in | X | | | | | |
|   → Forgot Password link | X | | | | | |
| Login Screen (Mobile - Vet) | | | X | | | |
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
| **Vet Screens** | | | | | | |
| Dashboard (Vet) | | | X | | | |
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
| Vet Shift Calendar | | | | | X | |
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
| 10 | Rating Aggregation | RatingAggregationService | Update rating_avg of Clinic/Vet after each review |
| 11 | AI Chatbot | AIChatbotService | Process messages via Single Agent + ReAct pattern |
| 12 | RAG Retrieval | RAGRetrievalService | Search Knowledge Base with vector similarity |
| 13 | Document Indexing | DocumentIndexingBatch | Chunking and embedding documents on upload |
| 14 | Vaccination Reminder | VaccinationReminderJob | Send vaccination reminders before due date (daily 8:00 AM) |
| 15 | GPS Location Update | GPSLocationWebSocket | Real-time update of Vet location during SOS Booking (SOS only, not Home Visit) |
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
    %% Auth & User
    USER ||--o{ REFRESH_TOKEN : has
    USER ||--o{ BLACKLISTED_TOKEN : invalidates
    USER ||--o{ PET : owns
    USER ||--o{ CLINIC : owns
    USER ||--o{ CLINIC : works_at
    USER ||--o{ VET_SHIFT : works
    USER ||--o{ BOOKING : books
    USER ||--o{ REVIEW : writes
    USER ||--o{ NOTIFICATION : receives
    USER ||--o{ USER_REPORT : submits
    USER ||--o{ CHAT_MESSAGE : sends
    USER ||--o{ AI_CHAT_SESSION : initiates

    %% Clinic & Services
    CLINIC ||--o{ CLINIC_IMAGE : has_images
    CLINIC ||--o{ SERVICE : offers
    CLINIC ||--o{ VET_SHIFT : schedules
    CLINIC ||--o{ BOOKING : receives
    CLINIC ||--o{ USER_REPORT : is_reported
    MASTER_SERVICE ||--o{ SERVICE : defines
    SERVICE ||--o{ SERVICE_WEIGHT_PRICE : has_tiers
    SERVICE ||--o{ BOOKING : used_in

    %% Pet & Medical
    PET ||--o{ BOOKING : has
    PET ||--o{ EMR : has
    PET ||--o{ VACCINATION : receives
    EMR ||--o{ PRESCRIPTION : contains
    EMR ||--o{ EMR_IMAGE : has_photos
    BOOKING ||--o| EMR : generates

    %% Scheduling & Multi-slot
    VET_SHIFT ||--|{ SLOT : contains
    BOOKING ||--|{ BOOKING_SLOT : reserves
    BOOKING_SLOT }|--|| SLOT : links

    %% Finance & Feedback
    BOOKING ||--|| PAYMENT : has
    BOOKING ||--o{ REVIEW : has

    %% Communication
    BOOKING ||--o{ CHAT_CONVERSATION : has
    CHAT_CONVERSATION ||--o{ CHAT_MESSAGE : contains
    USER ||--o{ CHAT_CONVERSATION : participates

    %% AI Agent Module
    AI_AGENT ||--o{ AI_PROMPT_VERSION : has
    AI_AGENT ||--o{ AI_CHAT_SESSION : handles
    AI_CHAT_SESSION ||--o{ AI_CHAT_MESSAGE : contains
    AI_AGENT }o--o{ AI_TOOL : uses
    AI_AGENT ||--o{ AI_KNOWLEDGE_DOC : references
    AI_KNOWLEDGE_DOC }o--o| USER : uploaded_by
    AI_SYSTEM_SETTING }o--|| AI_AGENT : configures
```

##### 📊 Relationship Matrix (Cardinality)

| From (Ent. A) | To (Ent. B) | Relationship | Cardinality | Business Logic |
|:---|:---|:---|:---:|:---|
| **USER** | **PET** | owns | 1 : N | Một người nuôi có thể sở hữu nhiều thú cưng. |
| **USER** | **CLINIC** | owns | 1 : N | Một Clinic Owner có thể sở hữu nhiều chi nhánh phòng khám. |
| **CLINIC** | **USER** | works_at | 1 : N | Một phòng khám có nhiều nhân viên (Vet, Manager). Mỗi nhân viên chỉ thuộc 1 phòng khám. |
| **USER** | **VET_SHIFT** | works | 1 : N | Một bác sĩ có nhiều ca trực. Mỗi ca trực thuộc sở hữu của 1 bác sĩ. |
| **VET_SHIFT** | **SLOT** | contains | 1 : N | Một ca trực được chia thành nhiều ô thời gian 30 phút. |
| **BOOKING** | **SLOT** | reserves | 1 : N | Một lịch hẹn chiếm dùng một hoặc nhiều Slot (thông qua bảng BOOKING_SLOT). |
| **USER** | **BOOKING** | books | 1 : N | Khách hàng tạo nhiều lịch hẹn theo thời gian. |
| **PET** | **VACCINATION** | receives | 1 : N | Một thú cưng có lịch sử tiêm chủng nhiều lần (tương đương với sổ tiêm). |
| **PET** | **BOOKING** | has | 1 : N | Một thú cưng có lịch sử khám nhiều lần. |
| **BOOKING** | **PAYMENT** | has | 1 : 1 | Mỗi lịch hẹn có chính xác một bản ghi thanh toán (Cash/Stripe). |
| **BOOKING** | **EMR** | generates | 1 : 0..1 | Một lịch hẹn chỉ phát sinh tối đa 01 bệnh án (nếu khám thành công). |
| **EMR** | **PRESCRIPTION**| contains | 1 : N | Một bệnh án có thể có nhiều đơn thuốc đi kèm. |
| **EMR** | **EMR_IMAGE** | has_photos | 1 : N | Một bệnh án có thể đính kèm nhiều ảnh y khoa (X-quang, triệu chứng). |
| **BOOKING** | **REVIEW** | receives | 1 : N | Một lịch hẹn nhận được review cho bác sĩ và review cho phòng khám. |
| **USER** | **USER_REPORT** | submits | 1 : N | Một người dùng có thể gửi nhiều báo cáo vi phạm. |
| **USER** | **CHAT_CONV.** | participates | 1 : N | Một người dùng tham gia vào nhiều hội thoại 1-1. |
| **CLINIC** | **SERVICE** | offers | 1 : N | Một phòng khám cung cấp nhiều loại dịch vụ. |
| **CLINIC** | **CLINIC_IMAGE**| has_images | 1 : N | Một phòng khám có nhiều ảnh thực tế/không gian. |
| **SERVICE** | **BOOKING** | used_in | 1 : N | Một loại dịch vụ được sử dụng trong nhiều lịch hẹn khác nhau. |
| **MASTER_SERVICE**| **SERVICE** | defines | 1 : N | Template dịch vụ chung được áp dụng cho nhiều phòng khám. |
| **AI_AGENT** | **AI_CHAT_SESSION** | handles | 1 : N | Một Agent xử lý nhiều phiên chat của nhiều người dùng khác nhau. |
| **AI_AGENT** | **AI_KNOWLEDGE_DOC**| references | N : N | Agent sử dụng các tài liệu tri thức để trả lời câu hỏi (RAG). |
| **AI_KNOWLEDGE_DOC** | **USER** | uploaded_by | N : 0..1 | Tài liệu tri thức được upload bởi admin. |
| **AI_CHAT_MESSAGE** | **AI_CHAT_SESSION**| contains | N : 1 | Thông tin tin nhắn trong phiên chat AI. |
| **AI_SYSTEM_SETTING** | **AI_AGENT** | configures | N : 1 | Cài đặt hệ thống áp dụng cho Agent. |
| **BLACKLISTED_TOKEN** | **USER** | invalidates | N : 1 | Token bị vô hiệu hóa khi người dùng logout. |

#### 3.1.5 Entities Description

Để đảm bảo tính nhất quán giữa tài liệu và mã nguồn, dưới đây là danh sách đầy đủ 30 thực thể được sử dụng trong hệ thống Petties:

| Nhóm | Thực thể | Mô tả | Các trường chính |
|:---:|---|---|---|
| **Auth & User** | **USER** | Tài khoản định danh (5 roles) | id, username, email, password, role, clinic_id, status |
| | **REFRESH_TOKEN** | Token duy trì phiên đăng nhập | id, user_id, token, expires_at |
| | **BLACKLISTED_TOKEN** | Token bị vô hiệu hóa sau logout | id, token, blacklisted_at, expires_at |
| **Clinic** | **CLINIC** | Thông tin phòng khám thú y | id, owner_id, name, address, phone, status, rating_avg |
| | **CLINIC_IMAGE** | Ảnh không gian phòng khám | id, clinic_id, image_url, is_primary |
| | **MASTER_SERVICE** | Bản mẫu dịch vụ (Templates) | id, owner_id, name, service_type, default_base_price |
| | **SERVICE** | Dịch vụ thực tế tại phòng khám | id, clinic_id, master_service_id, base_price, is_home_visit |
| | **SERVICE_WEIGHT_PRICE**| Khung giá cộng thêm theo cân nặng | id, service_id, min_weight, max_weight, price |
| **Pet** | **PET** | Hồ sơ thông tin thú cưng | id, owner_id, name, species, breed, birth_date, weight_kg |
| **Scheduling** | **VET_SHIFT** | Ca trực của bác sĩ tại phòng khám | id, vet_id, clinic_id, work_date, start_time, end_time |
| | **SLOT** | Đơn vị thời gian 30 phút | id, shift_id, start_time, end_time, status |
| **Booking** | **BOOKING** | Lịch hẹn khám (Clinic/Home) | id, booking_code, pet_id, service_id, total_price, status |
| | **BOOKING_SLOT** | Bảng trung gian gán booking vào slot | booking_id, slot_id |
| | **PAYMENT** | Giao dịch thanh toán | id, booking_id, amount, method, status, stripe_payment_id |
| **Medical** | **EMR** | Bệnh án điện tử (Tiêu chuẩn SOAP) | id, booking_id, subjective, objective, assessment, plan |
| | **EMR_IMAGE** | Ảnh y khoa đính kèm bệnh án | id, emr_id, image_url, description |
| | **PRESCRIPTION** | Đơn thuốc kê cho thú cưng | id, emr_id, drug_name, dosage, frequency, duration |
| | **VACCINATION** | Ghi nhận sự kiện tiêm chủng | id, pet_id, vaccine_name, administered_date, next_due_date |
| **Interaction**| **REVIEW** | Đánh giá bác sĩ/phòng khám | id, booking_id, reviewer_id, type, rating, comment |
| | **NOTIFICATION** | Thông báo đẩy/in-app | id, user_id, type, title, content, is_read |
| | **CHAT_CONVERSATION** | Phiên hội thoại 1-1 (Owner-Staff) | id, user1_id, user2_id, booking_id, last_message_at |
| | **CHAT_MESSAGE** | Nội dung tin nhắn chat | id, conversation_id, sender_id, content, is_read |
| | **USER_REPORT** | Báo cáo vi phạm nền tảng | id, reporter_id, reported_user_id, category, status |
| **AI Service** | **AI_AGENT** | Cấu hình trí tuệ nhân tạo | id, name, model, system_prompt, temperature, top_p |
| | **AI_TOOL** | Công cụ (Tools) Agent được dùng | id, name, tool_type, input_schema, enabled |
| | **AI_PROMPT_VERSION**| Version control cho System Prompt | id, agent_id, version, prompt_text, is_active |
| | **AI_CHAT_SESSION** | Phiên hội thoại với AI | id, agent_id, user_id, session_id, started_at |
| | **AI_CHAT_MESSAGE** | Ghi chép tin nhắn AI | id, session_id, role, content, message_metadata |
| | **AI_KNOWLEDGE_DOC** | Tài liệu nạp cho RAG | id, filename, file_path, processed, vector_count |
| | **AI_SYSTEM_SETTING**| Cấu hình API Keys Dashboard | id, key, value, category, is_sensitive |

---

### 3.2 Authentication & Onboarding
 
 #### *3.2.1 User Registration*
**Function trigger**
- **Navigation Path (Mobile - Pet Owner):** Onboarding Screen → Login Screen → Registration Screen (Link "Đăng ký ngay").
- **Navigation Path (Web - Clinic Owner):** Landing Page → Login Page → Registration Page (Link "Đăng ký tại đây").
- **Timing frequency:** On demand (whenever a guest wants to join the platform).

**Function description**
- **Actors/Roles:** Pet Owner (Web/Mobile), Clinic Owner (Web).
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

 #### *3.2.2 Universal Login*
**Function trigger**
- **Navigation Path (Mobile):** Onboarding Screen → Login Screen.
- **Navigation Path (Web):** Landing Page → Login Page.
- **Timing frequency:** Whenever a session expires or user logs out.

**Function description**
- **Actors/Roles:** All Roles (Pet Owner, Vet, Manager, Owner, Admin).
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
    - E1. Connection Error – Database or Auth service is unreachable.

 #### *3.2.3 Forgot & Reset Password*
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
    - A1. Email not found – Show "Email does not exist".
    - A2. Invalid/Expired OTP – Verification fails.

 #### *3.2.4 Session Termination (Sign out)*
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
- **Normal case:** User logs out and is redirected to the login/landing screen. System blacklists the token.
- **Abnormal cases:**
    - A1. Network error – Offline logout clears local tokens but server-side blacklist fails until reconnected.
    - A2. Invalid Token – System returns 401 Unauthorized if the token is already invalid or missing.



### 3.3 User Profile & Account Setup
 
 #### *3.3.1 View & Edit Profile*
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
    - New Password, Confirm New Password – password inputs
    - New Email – text input
    - Verification OTP – 6-digit input

**Data processing**
1. User provides current password for identity verification (Optional, based on security level).
2. For Password change: System checks current password match, then updates to new one.
3. For Email change (Step 1 - Request): 
    - User submits new email.
    - System validates email uniqueness and cooldown (60s).
    - System generates OTP, saves to Redis (TTL 5m), and sends to the *new* address.
4. For Email change (Step 2 - Verify):
    - User enters OTP.
    - System validates OTP code and max attempts (5 times - BR-13).
    - System updates user email in DB and clears OTP data.
5. System invalidates old sessions/tokens if necessary.

**Screen layout**
Figure 15. Screen Security Settings (Mobile) - Change Pass/Email
Figure 16. Screen Security Settings (Mobile) - Email OTP Verification
Figure 17. Screen Security Settings (Web) - Change Pass/Email
Figure 18. Screen Security Settings (Web) - Email OTP Verification

**Function details**
- **Data:** CurrentPassword, NewPassword, NewEmail, OTP.
- **Validation:** 
    - Current Password must match the database.
    - New Password must be at least 6 characters (BR-12).
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
 
 #### *3.4.1 Create New Pet Profile*
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

 #### *3.4.2 Manage Pet Profile (Update/Delete)*
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

 #### *3.4.3 View Pet Health Hub*
**Function trigger**
- **Navigation path:** My Pets → Select Pet → "Health Hub".
- **Timing frequency:** On demand.

**Function description**
- **Actors/Roles:** Pet Owner, Vet, Manager.
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
 
 #### *3.5.1 Smart Search & Filter*
**Function trigger**
- **Navigation path:** Mobile Home → Search Bar OR "Explore Clinics" button.
- **Timing frequency:** On demand.

**Function description**
- **Actors/Roles:** Guest, Pet Owner.
- **Purpose:** Find the most suitable veterinary clinics based on location, service, and rating.
- **Interface:**
    - Search Keyword – text input
    - Distance Filter – dropdown
    - Rating Filter – dropdown
    - Service Category – chips/multiselect
    - Home Visit Option – checkbox
    - View Mode – toggle (List / Map)

**Data processing**
1. User enters keywords or applies filters.
2. System retrieves the user's current GPS location (if permitted).
3. System calls Goong API to calculate driving distance or straight-line distance to candidate clinics.
4. System queries the `CLINIC` table for records with `status = 'APPROVED'` matching the filter criteria.
5. System sorts results by distance, rating, or relevance.
6. System displays the localized list or map markers.

**Screen layout**
Figure 23. Screen Smart Search & Filter (Mobile)

**Function details**
- **Data:** SearchKeyword, Latitude, Longitude, FilterCriteria.
- **Validation:** 
    - Search radius must be a positive number.
    - Only `APPROVED` clinics are shown.
- **Business rules:** BR-003-05.
- **Normal case:**
    1. User searches for "District 1" with "Vaccination" service.
    2. System returns a list of matching clinics within the specified radius.
- **Abnormal/Exception cases:**
    - A1. No clinics found – Display "No clinics match your criteria in this area."
    - A2. Location access denied – System defaults to the city center coordinates.
    - E1. Maps API Error – Map view cannot display markers.

 #### *3.5.2 View Clinic Details*
**Function trigger**
- **Navigation path:** Search Results → Select Clinic Card.
- **Timing frequency:** On demand.

**Function description**
- **Actors/Roles:** Guest, Pet Owner.
- **Purpose:** View full information, photos, and services of a specific clinic.
- **Interface:**
    - Image Carousel – swipeable gallery
    - Address Link – opens map app
    - Opening Hours – expandable section
    - Service List – grouped list with pricing
    - Staff Profiles – list of veterinarians

**Data processing**
1. User selects a clinic.
2. System retrieves data from `CLINIC`, `CLINIC_SERVICE`, `OPENING_HOURS`, and `USER` (staff) tables.
3. System calculates if the clinic is currently "OPEN" or "CLOSED" based on real-time server clock.
4. System renders the integrated profile view.

**Screen layout**
Figure 24. Screen View Clinic Details (Mobile)
Figure 25. Screen View Clinic Details (Web)

**Function details**
- **Data:** ClinicID.
- **Business rules:** N/A
- **Normal case:**
    1. User views "Sai Gon Pet Clinic" profile.
    2. User sees services and photos to decide on booking.
- **Abnormal/Exception cases:**
    - A1. Clinic inactive – Record suspended after search results were cached.
    - A2. Missing data – Clinic hasn't uploaded a service list yet.

### 3.6 Clinical Operations & Service Setup
 
 #### *3.6.1 Clinic Registration*
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

 #### *3.6.2 Clinic Approval & Moderation*
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

 #### *3.6.3 Global Service Definition (Master Catalog)*
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
- **Normal case:** Owner defines "Rabies Vaccination" template for the entire system.

 #### *3.6.4 Branch Pricing Configuration*
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
- **Abnormal cases:**
    - A1. Tier overlap – User defines two prices for the same weight range.

### 3.7 Staffing & Scheduling Flow
 
 #### *3.7.1 Staff Invitation by Email*
**Function trigger**
- **Navigation path:** Owner Dashboard → Staff Management → "Add Staff".
- **Timing frequency:** On demand (new hires).

**Function description**
- **Actors/Roles:** Clinic Owner, Clinic Manager.
- **Purpose:** Invite new staff by email. Staff will login with Google OAuth, and their profile info (name, avatar) will be auto-filled from Google account.
- **Interface:**
    - Email Address – text input
    - Role – radio selection (Vet, Manager)
    - Specialty – dropdown (for Vet role only)

**Data processing**
1. System validates email format and uniqueness.
2. If email already exists in system:
   - If user is not assigned to another clinic: assign to current clinic.
   - If user is already assigned to another clinic: reject with error.
3. If email does not exist: System creates a `USER` record with random password (unusable), assigned to clinic.
4. Staff logs in via Google OAuth on first access.
5. System auto-fills `fullName` and `avatar` from Google profile on first login.

**Screen layout**
Figure 30. Screen Staff Invitation by Email (Web)

**Function details**
- **Data:** Email, Role, Specialty (optional).
- **Validation:** 
    - Email must be valid format.
    - Email must not be assigned to another clinic.
    - Role must be valid within clinic context.
- **Business rules:** BR-35, BR-45, BR-46, BR-47.
- **Normal case:**
    1. Manager invites "bacsi@gmail.com" as Vet with "General" specialty.
    2. Dr. Nam logs in via Google OAuth and starts working.
- **Abnormal/Exception cases:**
    - A1. Email already assigned to another clinic – "User is already assigned to another clinic."


 #### *3.7.2 Clinician Roster Management (Vet Shift)*
**Function trigger**
- **Navigation path:** Manager Dashboard → Schedules → "Assign Shift".
- **Timing frequency:** Weekly or monthly planning.

**Function description**
- **Actors/Roles:** Clinic Manager.
- **Purpose:** Allocate specific working hours (shifts) to Veterinarians on specific days.
- **Interface:**
    - Staff Selection – dropdown
    - Flexible Date Selection – multi-select calendar/days (e.g., Mon-Wed-Fri)
    - Time Slot – start/end time inputs
    - **Overnight Toggle** – supports shifts crossing midnight (e.g., 22:00 - 06:00)
    - **Recurring Option** – repeat the selected pattern for X weeks (default 1)
    - Quick Presets – buttons for "Full Week", "2-4-6", "3-5-7"

**Data processing**
1. Manager selects a Vet, one or more dates, and a time range.
2. System detects if the shift is **Overnight** (End Time < Start Time).
3. **Conflict Check Logic (NEW):**
    - For each selected date:
        - System iterates through the Vet's existing shifts for that day (and the next day if overnight).
        - System uses the `timesOverlap()` helper to compare the new time range with existing shifts.
        - If an overlap is found, the system collects conflict details (Existing Shift vs New Shift).
4. If conflicts are found:
    - System opens a **Conflict Warning Modal** showing specific dates and times of overlap.
    - User Action: **Cancel** (return to form) or **Confirm Override** (Force Create).
5. If "Confirm Override" or no conflicts:
    - System creates one or more `VET_SHIFT` records.
    - If `forceUpdate = true`, the Backend performs an **Upsert** (replacing or merging with existing capacity).
6. Automatic Trigger: System generates bookable `SLOT` entries for each shift.

**Screen layout**
Figure 31. Screen Clinician Roster Management (Web) - Now including Conflict Warning Modal.

**Function details**
- **Data:** VetID, WorkDates (List), StartTime, EndTime, forceUpdate (Boolean).
- **Validation:** 
    - **Start/End Time:** If `isOvernight` is true, End Time can be earlier than Start Time.
    - **Max Duration:** Total shift duration must be within limits (e.g., 12h per shift).
    - **Date Range:** Bulk creation up to 14 days at a time.
- **Business rules:** BR-18, BR-19, BR-20, BR-49.
- **Abnormal/Exception cases:**
    - A1. Shift overlap – System triggers specific Warning Modal (BR-Conflict).
    - A2. Clinic closed – Shift falls outside of `OperatingHours`.

 #### *3.7.3 Logic: Auto Slot Generation*
**Function trigger**
- **Timing frequency:** Executed concurrently with `UC-SM-02`.
- **Navigation path:** Automated system logic from Backend.

**Function description**
- **Actors/Roles:** System.
- **Purpose:** Automatically slice a shift into bookable time slots for customers.
- **Interface:** N/A (View slot list from Admin side).

**Data processing**
1. System reads shift start/end times and the `isOvernight` flag.
2. System inherits **Break Time** from the Clinic's `OperatingHours` for that specific day of the week.
3. System iterates through the time range (splitting at midnight if overnight), creating a `SLOT` entity for each 30-minute interval.
4. System skips creating slots during defined break times.
5. System marks new slots as `AVAILABLE`.

**Screen layout**
(No separate interface for this automated process)

**Function details**
- **Business rules:** N/A

### 3.8 Booking & Appointment Lifecycle Flow

 #### *3.8.1 Create New Appointment*
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
1. **[BOK-1] Mobile Booking Wizard (3-step Flow with Smart Availability):**
    - **Step 1: Service Choice**: 
        - Pet Owner selects one or more services from the clinic's service catalog.
        - Each service displays: Name, Category, Base Price, Duration.
        - Services are publicly viewable (no authentication required for browsing).
    - **Step 2: Time Slot Selection (Smart Availability)**: 
        - **Smart Availability Algorithm**:
            - Input: Selected services (with required specialties), Clinic ID, Date.
            - System automatically finds time slots where **at least one vet** with the required specialty is available.
            - For multi-service bookings: System ensures consecutive slots can be fulfilled by checking vet availability for each service in sequence.
            - Returns: List of valid start times (30-minute intervals).
        - Interactive calendar showing days with available slots.
        - Slot grid showing available 30-minute intervals.
        - **No Vet Selection**: Vet assignment is handled by Manager post-booking.
    - **Step 3: Review & Summary**: 
        - Final price calculation: `Base Price` + `Weight Surcharge` (based on pet's last weight) + `Distance Fee` (if Home Visit, based on distance).
        - User confirms booking details.
        - Slot locking (TTL 15 minutes for payment).
2. System creates a `BOOKING` record with `PENDING` status (awaiting payment).
3. **Post-Booking Flow**: Manager assigns vet via Dashboard (UC-CM-06, Section 3.8.3).

**Screen layout**
Figure 32. Screen Mobile Booking Wizard (BOK-1) - 3 Steps: Service Selection, Time Selection, Summary.

**Function details**
- **Data:** PetID, ServiceID(s), SlotID(s), BookingDate, Address (for Home Visit).
- **Validation:** 
    - Appointment must be booked at least 2 hours in advance (BR-001-01).
    - User cannot book for a pet they do not own.
    - Selected slots must be available (not already booked).
- **Business rules:** BR-01, BR-02, BR-05, **BR-14 (Smart Availability Matching)**.
- **Normal case:**
    1. Pet Owner selects "Vaccination" service for their pet "Bella".
    2. System shows available time slots on Friday where a vet with VET_VACCINATION specialty is free.
    3. User selects 9:00 AM slot and proceeds to payment.
- **Abnormal/Exception cases:**
    - A1. Slot taken – Another user completed payment for this slot during the 15-minute TTL.
    - A2. Past date – User attempts to select a time that has already passed.
    - A3. Address out of range – Home visit distance exceeds clinic service range.
    - A4. No available slots – No vet with required specialty is available on selected date.

 #### *3.8.2 Payment & Confirmation*
**Function trigger**
- **Navigation path:** Redirected from `UC-BK-01` OR My Bookings → "Pay Now".
- **Timing frequency:** Within 15 minutes of slot selection.

**Function description**
- **Actors/Roles:** Pet Owner.
- **Purpose:** Securely pay for the booked service to confirm the appointment.
- **Interface:**
    - Payment Summary – fee breakdown
    - E-Wallet (MoMo/VNPAY) – radio buttons
    - Credit Card – Stripe element
    - "Confirm Payment" – action button

**Data processing**
1. User selects a payment method.
2. For Electronic Payment: System calls Third-party Payment Gateway (Stripe/VNPAY).
3. Upon Success: System updates `BOOKING` status to `CONFIRMED` and `SLOT` status to `BOOKED`.
4. System sends booking confirmation notification to the user.

**Screen layout**
Figure 33. Screen Payment & Confirmation (Mobile)

**Function details**
- **Data:** PaymentID, TransactionToken.
- **Normal case:** User pays via Stripe; appointment is confirmed immediately.
- **Abnormal/Exception cases:**
    - A1. Payment declined – Show "Insufficient balance or card error".
    - A2. Session expired – User took >15 minutes; slot is released.
    - E1. Gateway delay – Payment status becomes `UNKNOWN`, requiring manual reconciliation.

 #### *3.8.3 Clinician Assignment (Vet Assignment)*
**Function trigger**
- **Navigation path:** Manager Dashboard → Management → Booking Dashboard → Click "Chi tiết" on PENDING booking.
- **Timing frequency:** Daily or when a new booking arrives.

**Function description**
- **Actors/Roles:** Clinic Manager.
- **Purpose:** Assign a specific veterinarian to an upcoming appointment, either via auto-suggestion or manual selection.
- **Interface:**
    - Booking Info – summary card
    - Service List – each service displays an **inline dropdown** for vet selection
    - Available Vet Dropdown – shows vet name, avatar, specialty, workload
    - Suggested Vet Badge – green "Gợi ý" tag on recommended vet
    - Confirm Button – "Xác nhận & Gán Vet"

**Data processing**
1. **[BOK-3a] Check Vet Availability:**
    - Manager opens booking detail modal.
    - System calls `GET /bookings/{id}/available-vets-for-confirm` API.
    - Returns list of vets matching service specialty with availability status.
    - Each vet shows: avatar, name, specialty label, booking count today, hasAvailableSlots.

2. **[BOK-3b] Inline Vet Selection (Per Service):**
    - Each service in booking displays a dropdown.
    - Dropdown pre-selects suggested vet (based on auto-assignment algorithm).
    - Manager can click dropdown to change vet for specific service.
    - **Matching Rule:** Service Category must match Vet Specialty:
        - GROOMING_SPA → VET_GROOMING / GROOMER
        - CHECK_UP / VACCINATION / INTERNAL_MEDICINE → VET_GENERAL / VET_VACCINATION
        - SURGERY → VET_SURGERY
        - DENTAL → VET_DENTAL
        - DERMATOLOGY → VET_DERMATOLOGY
        - EMERGENCY → VET_EMERGENCY

3. **[BOK-3c] Confirm with Selected Vet:**
    - Manager clicks "Xác nhận & Gán Vet".
    - System calls `PATCH /bookings/{id}/confirm` with `selectedVetId`.
    - Backend reserves vet's time slots for the booking duration.
    - Booking status: PENDING → CONFIRMED → ASSIGNED.
    - System sends FCM notification to assigned vet.

**Screen layout**

```
┌─────────────────────────────────────────────────────────────────┐
│ CHI TIẾT ĐẶT LỊCH                              [X]              │
│ BK-12345                                                        │
├─────────────────────────────────────────────────────────────────┤
│ ┌──────────────────────┐  ┌──────────────────────┐             │
│ │ THÔNG TIN THÚ CƯNG   │  │ THÔNG TIN CHỦ        │             │
│ │ [Avatar] Bella       │  │ Nguyễn Văn A         │             │
│ │ Chó - Golden         │  │ 0901234567           │             │
│ └──────────────────────┘  └──────────────────────┘             │
├─────────────────────────────────────────────────────────────────┤
│ DỊCH VỤ ĐẶT                                                     │
│ ┌───────────────────────────────────────────────────────────┐  │
│ │ Khám da liễu  [Da liễu]                         250.000đ  │  │
│ │ 30 phút - 1 slot(s)  ⏰ 16:00 - 16:30                      │  │
│ │                                                            │  │
│ │ ✓ Bác sĩ: [▼ Tân Phạm (Gợi ý) - BS da liễu thú y      ]   │  │◄── Inline Dropdown
│ │           ├─ Tân Phạm (Gợi ý) ✓                           │  │
│ │           ├─ Nguyễn Văn B - BS đa khoa                    │  │
│ │           └─ Trần Thị C - BS da liễu                      │  │
│ └───────────────────────────────────────────────────────────┘  │
│                                                                  │
│ Tổng cộng: 250.000đ                                             │
├─────────────────────────────────────────────────────────────────┤
│                              [Đóng]  [Xác nhận & Gán Vet]       │
└─────────────────────────────────────────────────────────────────┘
```

Figure 34. Screen Clinician Assignment with Inline Vet Dropdown (Web)

**Function details**
- **Data:** BookingID, ServiceID, SelectedVetID.
- **Validation:**
    - Selected vet must have available slots for booking time.
    - Vet specialty must match service category.
- **Business rules:** BR-12 (Vet assignment), BR-13 (Slot reservation).
- **Normal case:**
    1. Manager opens PENDING booking detail.
    2. System shows suggested vet "Tân Phạm" for each service.
    3. Manager confirms with suggested vet or changes to different vet.
    4. System assigns vet and notifies via FCM.
- **Abnormal/Exception cases:**
    - A1. No available vet – System shows warning modal with options: "Xác nhận một phần" or "Hủy".
    - A2. Vet suddenly busy – Manager can reassign via ReassignVetModal after confirmation.
    - A3. Multiple services need different vets – Each service dropdown allows independent selection.

 #### *3.8.3b Vet Reassignment (Post-Confirmation)*
**Function trigger**
- **Navigation path:** Manager Dashboard → Booking Detail → Click "Đổi BS" button on a service.
- **Timing frequency:** When vet is unavailable or needs to be changed.

**Function description**
- **Actors/Roles:** Clinic Manager.
- **Purpose:** Change assigned vet for a specific service after booking is confirmed.
- **Interface:**
    - ReassignVetModal – shows available vets for the service
    - Vet List – with avatar, name, specialty, availability status
    - Confirm Button – "Xác nhận đổi"

**Data processing**
1. System calls `GET /bookings/{id}/services/{serviceId}/available-vets`.
2. Manager selects new vet from list.
3. System calls `POST /bookings/{id}/services/{serviceId}/reassign` with `newVetId`.
4. Backend releases old vet's slots and reserves new vet's slots.
5. Notifications sent to both old and new vet.

**Function details**
- **Normal case:** Manager changes from Dr. A to Dr. B due to scheduling conflict.
- **Abnormal cases:**
    - A1. New vet also unavailable – Show "Không có slot trống".

 #### *3.8.3c Add-on Service During Examination*
**Function trigger**
- **Navigation path:** Booking Detail (when status is IN_PROGRESS or ARRIVED) → "Thêm dịch vụ" button.
- **Timing frequency:** During examination when additional services needed.

**Function description**
- **Actors/Roles:** Vet, Clinic Manager.
- **Purpose:** Add extra services discovered during examination.
- **Interface:**
    - AddServiceModal – list of clinic services not already in booking
    - Service Selection – click to select
    - Confirm Button – "Xác nhận thêm"

**Data processing**
1. System calls `GET /services/clinic/{clinicId}` to get available services.
2. Filters out services already in booking.
3. Vet/Manager selects additional service.
4. System calls `POST /bookings/{id}/add-service` with `serviceId`.
5. Price calculated based on pet weight, added to booking total.
6. **Note:** Distance fee is NOT recalculated for add-on services.

**Function details**
- **Visibility:** Button only shows when booking status is `IN_PROGRESS` or `ARRIVED` (SOS only for ARRIVED).
- **Normal case:** Vet discovers ear infection during general checkup, adds "Ear Cleaning" service.

 #### *3.8.4 Patient Arrival & Departure (Check-in/Out)*
**Function trigger**
- **Navigation path:** Clinic Reception Dashboard OR Vet App → Active Bookings.
- **Timing frequency:** When the customer arrives at/leaves the clinic.

**Function description**
- **Actors/Roles:** Vet, Staff, Manager.
- **Purpose:** Record the physical flow of the appointment.
- **Interface:**
    - Check-in Button – "Mark as Arrived"
    - Check-out Button – "Complete Visit"

**Data processing**
1. Check-in: Status → `IN_PROGRESS`, records start time.
2. Check-out: System verifies EMR is complete, status → `COMPLETED`, records end time.
3. System sends a "Thank You" notification to the owner.

**Screen layout**
Figure 35. Screen Patient Arrival & Departure (Mobile)
Figure 36. Screen Patient Arrival & Departure (Web)

**Function details**
- **Logic:** Check-out is blocked if the medical record (EMR) has not been drafted.
- **Business rules:** BR-50.
- **Abnormal cases:**
    - A1. No-show – Status → `CANCELLED_BY_CLINIC`.

### 3.9 Electronic Medical Records (EMR) Flow

 #### *3.9.1 Clinical Examination (SOAP Notes)*
**Function trigger**
- **Navigation path:** Active Appointment → "Write EMR" OR Examination Hub.
- **Timing frequency:** During the examination.

**Function description**
- **Actors/Roles:** Vet.
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
    - Vet enters clinical findings:
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
- **Normal case:** Vet treats a cat for dehydratation, notes 4.2kg weight, and prescribes electrolytes.
- **Abnormal cases:**
    - A1. Booking not started – "Please check-in the patient before writing EMR."
    - A2. Photo upload failure – System allows saving text and retrying photo upload later.

 #### *3.9.2 Digital Prescription*
**Function trigger**
- **Navigation path:** EMR Interface → "Add Prescription".
- **Timing frequency:** At the end of the visit.

**Function description**
- **Actors/Roles:** Vet.
- **Purpose:** Issue digital medication orders for the pet.
- **Interface:**
    - Drug Name – text input
    - Dosage – text input
    - Frequency – text input
    - Duration – text input

**Data processing**
1. Vet enters medication info.
2. System records entries in the `PRESCRIPTION` table linked to the current `EMR`.
3. Notifies the owner about the new prescription after Check-out.

**Screen layout**
Figure 39. Screen Digital Prescription (Mobile)
Figure 40. Screen Digital Prescription (Web)

**Function details**
- **Data:** Drug Name, Dosage, Frequency, Duration.
- **Normal case:** Vet prescribes antibiotics for 7 days.

 #### *3.9.3 Additional Service Recording (Incurred Services)*
**Function trigger**
- **Navigation path:** EMR Interface → "Add Additional Service".
- **Timing frequency:** During or at the end of the examination.

**Function description**
- **Actors/Roles:** Vet.
- **Purpose:** Record medical services, procedures, or miscellaneous expenses (e.g., medical supplies, special handling fees) that were not pre-booked but performed during the visit.
- **Interface:**
    - Service Search/Select – dropdown/search for standard services
    - **Miscellaneous Item Name** – text input for non-standard costs
    - **Amount/Price** – number input for custom costs
    - Quantity – number input (default 1)
    - Notes – text input

**Data processing**
1. Vet selects a standard service OR enters a custom item name and its price.
2. System calculates the total additional cost.
3. System links these incurring items to the current `BOOKING` and `EMR`.
4. System updates the `totalPrice` of the Booking (Booking Total = Base Price + Surcharge + Incurred Services + Miscellaneous Costs).

**Screen layout**
Figure 41. Screen Additional Service Recording (Web)

**Function details**
- **Logic:** Only services belonging to the current clinic can be added.
- **Business rules:** BR-53, BR-54.
- **Normal case:** During a basic physical exam, the Vet identifies the need for an ear cleaning service and adds it to the record.

---

### 3.10 Specialized Services (SOS Emergency Flow)

 #### *3.10.1 Proactive Vet Tracking*
**Function trigger**
- **Navigation path:** SOS Booking Detail → "Track Vet".
- **Timing frequency:** From when the Vet starts travel until they arrive.

**Function description**
- **Actors/Roles:** Pet Owner.
- **Purpose:** Real-time visibility of the vet's approach during an SOS Emergency.
- **Interface:**
    - Live Map View
    - Vet Avatar & License Plate
    - Estimated Time of Arrival (ETA)

**Data processing**
1. System receives GPS coordinates from the Vet's mobile app.
2. System calculates ETA using Goong Maps API.
3. Renders the moving marker on the Owner's map.

**Screen layout**
Figure 41. Screen Proactive Vet Tracking (SOS Emergency - Mobile)

**Function details**
- **Data:** Vet Lat/Lng, Owner Lat/Lng.
- **Logic:** Tracking is disabled once the Vet marks arrival.
- **Business rules:** BR-03, BR-04, BR-52.

 #### *3.10.2 Travel Logistics (Vet Side)*
**Function trigger**
- **Navigation path:** Assigned Booking → "Start Travel".
- **Timing frequency:** Before arrival.

**Function description**
- **Actors/Roles:** Vet.
- **Purpose:** Enables emergency travel mode and GPS broadcast for SOS.
- **Interface:**
- **Interface:**
    - Navigation button (Open External Maps)
    - **Status Indicator** (En Route / Arriving)

**Data processing**
1. Sets booking travel status to `EN_ROUTE`.
2. Continuously sends coordinates to the server.
3. **Automatic Arrival:** System detects when Vet is within 100m of Owner's location and updates status to `ARRIVED` automatically.
4. **Fallback:** Manual "Confirmed Arrival" option if GPS fails.

**Screen layout**
Figure 42. Screen SOS Travel Logistics (Vet Side - Mobile)

**Function details**
- **Data:** Vet Lat/Lng.
- **Normal case:** Vet starts travel, system auto-completes arrival upon reaching destination.

### 3.11 AI Assistance Flow

 #### *3.11.1 Trợ lý AI Thông minh (Hỏi đáp chăm sóc & Đặt lịch tự động)*
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
5. **Context Persistence:** Chat history is saved in PostgreSQL for multi-turn conversation.

**Screen layout**
Figure 43. AI Chat Interface with Streaming Response (Mobile)

**Function details**
- **Safety Constraints:**
    - Must include a disclaimer: "Đây là thông tin tham khảo, không thay thế chẩn đoán của bác sĩ."
    - Block medical advice related to controlled narcotics or illegal dosages.
- **Abnormal Cases:**
    - A1. Tool failure: System notifies "Máy chủ đang quá tải, vui lòng thử lại sau".
    - A2. Ambiguous query: Agent asks follow-up questions to narrow down the intent.
- **Business rules:** BR-42, BR-43.

#### *3.11.2 AI Vision Pet Health Analysis (Nhận diện bệnh qua hình ảnh)*

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
| **Skin Disease Detection** | User uploads photo of dog with skin rash. | Agent calls `analyze_pet_image(image_url, pet_type="dog")`. Vision LLM analyzes image and detects "dermatitis, fungal infection suspected". | Agent responds: "⚠️ CẢNH BÁO: Phát hiện dấu hiệu viêm da, nghi ngờ nhiễm nấm. Nên đưa đến bác sĩ thú y trong 24-48h." + Booking Suggestion Card. |
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
- **Abnormal Cases:**
    - A1. Image upload fails: Show "Không thể tải ảnh lên, vui lòng thử lại."
    - A2. Vision LLM error: Fallback to text-based symptom_search if possible.
    - A3. No clinics found nearby: Expand search radius or show "Không tìm thấy phòng khám trong khu vực."
    - A4. GPS unavailable: Ask user to enable location or enter address manually.
- **Business rules:** BR-42, BR-43, BR-44, BR-45.

**Related Business Rules**
| Rule ID | Description |
|---------|-------------|
| BR-44 | Vision Analysis Disclaimer: Mọi kết quả phân tích hình ảnh phải kèm disclaimer rằng đây chỉ là tham khảo, không thay thế chẩn đoán của bác sĩ. |
| BR-45 | Urgent Severity Handling: Khi phát hiện vấn đề nghiêm trọng (urgent), hệ thống phải hiển thị cảnh báo nổi bật và ưu tiên đề xuất SOS hoặc booking trong ngày. |

### 3.12 Governance & Reporting Flow

 #### *3.12.1 Platform Violation Reporting*
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

---

## 4. NON-FUNCTIONAL REQUIREMENTS

### 4.1 External Interfaces

#### 4.1.1 User Interfaces

| Platform | Technology | Description |
|----------|------------|-------------|
| Web Frontend | React 19 + Vite + TypeScript | Admin, Clinic Owner, Clinic Manager dashboards |
| Mobile App | Flutter 3.5 | Pet Owner, Vet mobile apps (iOS + Android) |

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
| RBAC | 5 roles: PET_OWNER, VET, CLINIC_MANAGER, CLINIC_OWNER, ADMIN | Role-based access control |
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
| BR-07 | Cash payment is collected by the Vet at the Check-out stage. |
| BR-08 | Fully refundable if cancelled > 24 hours before appointment. |
| BR-09 | 50% refund if cancelled between 4-24 hours. 0% refund if < 4 hours. |
| BR-10 | System calculates refund amount automatically based on effective time of cancellation. |
| BR-11 | Users identify is Email. Staff accounts must use Google OAuth for login. |
| BR-12 | Password must be at least 6 characters. |
| BR-13 | OTP is valid for 5 minutes, with a maximum of 5 attempts for both login and sensitive actions (Email change, Password reset). |
| BR-14 | Staff accounts (Manager/Vet) are created via the Quick Add feature by Owners. |
| BR-15 | Clinics must be approved by Platform Admin before they become visible in search. |
| BR-16 | Pet Owners can register via Web/Mobile but can only log in and use the system via the Mobile app. Web portal access is blocked for this role. |
| BR-17 | Slot duration is fixed at 30 minutes per slot. |
| BR-18 | Shifts can include mandatory break times (e.g., lunch), which hide slots from public view. |
| BR-19 | Night shifts (End time < Start time) are treated as concluding the following day. |
| BR-20 | Active shifts with confirmed bookings cannot be deleted or modified in a way that orphans slots. |
| BR-21 | EMR Central Hub - All medical records are linked directly to the Pet Profile. |
| BR-22 | Vets can only edit an EMR while the booking status is IN_PROGRESS. |
| BR-23 | Once a booking is COMPLETED, the EMR is locked (Read-Only). |
| BR-24 | Authorized Vets from any clinic can read the pet's full EMR history. |
| BR-25 | The Pet Owner holds legal ownership of the records and can export them. |
| BR-26 | A Vaccination Book is automatically created upon pet profile creation. |
| BR-27 | Only Vets can add to or verify vaccination entries in the book. |
| BR-28 | Old vaccination records are never deleted; new entries are appended. |
| BR-29 | System suggests the next due date based on the vaccine's specific interval rules. |
| BR-30 | Vaccination notifications are sent to the owner 7 days and 1 day before the next due date. |
| BR-31 | Owners can report clinics/vets for malpractice or poor service after a COMPLETED visit. |
| BR-32 | Clinics can report Owners for NO_SHOW or abusive behavior. |
| BR-33 | Admin actions include: WARNING, TEMPORARY SUSPENSION, or PERMANENT BAN. |
| BR-34 | A booking can only be the subject of a violation report once. |
| BR-35 | Staff Invitation requires only Email and Role selection (Specialty for VET). FullName and Avatar are auto-filled from Google profile on first login. |
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
| BR-46 | CLINIC_MANAGER can only add VET accounts to their specific assigned branch. |
| BR-47 | CLINIC_OWNER can add both CLINIC_MANAGER and VET accounts to the branches they own. |
| BR-48 | System notifications (Welcome, OTP, Status updates) are sent via Email. |
| BR-49 | Vet Shifts and appointment slots must be scheduled for future times; retroactive scheduling (~the past~) is blocked. |
| BR-50 | Check-out for an appointment is blocked until the corresponding EMR (SOAP note) is drafted and saved. |
| BR-51 | Email change requests have a mandatory 60-second cooldown between OTP resend attempts. |
| BR-52 | Real-time GPS tracking is active ONLY for SOS Emergency bookings when the status is EN_ROUTE. Standard Home Visits do not include real-time tracking. |
| BR-53 | Additional services and miscellaneous incurred costs must be visible in the final invoice/summary. |
| BR-54 | Adding additional services or custom costs automatically updates the total price of the booking for final reconciliation. |
| BR-55 | **[EMR]** EMR có thể UPDATE bởi Vet thuộc **cùng phòng khám đã tạo EMR** trong vòng **24 giờ** kể từ lúc tạo. |
| BR-56 | **[EMR]** EMR từ **phòng khám khác** chỉ được phép **READ-ONLY**, không thể chỉnh sửa. |
| BR-57 | **[EMR]** Sau 24 giờ kể từ thời điểm tạo, EMR bị **khóa vĩnh viễn** - chỉ READ-ONLY cho tất cả. |
| BR-58 | **[Patient]** Khi Pet khám **lần đầu** tại Clinic, hệ thống **TỰ ĐỘNG tạo ClinicPatient** record để liên kết Pet với Clinic, giúp hạn chế nhập thủ công. |


### 5.2 Common Requirements

1. Supports PNG, JPG, JPEG image file format, maximum image size 10MB.
2. Data in the form of lists, tables, etc. will be displayed as data tables with paging supported.
3. On each web page, there should be no more than 3 fonts displayed.
4. All changes, updates, and modifications are alerted by pop-up (Toast message).
5. Ensure the platform is accessible 24/7, with maintenance scheduled during off-peak hours.
6. JWT-based authentication with Access Token (24h) and Refresh Token (7 days).
7. Role-based Access Control (RBAC) with 5 roles: PET_OWNER, VET, CLINIC_MANAGER, CLINIC_OWNER, ADMIN.
8. Platform restrictions: PET_OWNER (Mobile only), VET (Mobile + Web), ADMIN/CLINIC_OWNER/MANAGER (Web only).
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

**Document Status:** In Progress  
**Version:** 1.0.0  
**Last Updated:** 2025-12-19  
**Author:** Petties Development Team