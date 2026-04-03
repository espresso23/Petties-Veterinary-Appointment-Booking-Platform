# II. Software Design Document

> Update note dated 2026-04-01: older sections describing `analyze_pet_image`, legacy feedback-driven Case Memory, polling-based confirmed EMR sync, or the previous feedback loop are no longer the deployed architecture. The active AI diagnosis runtime reference is defined in [ai_diagnose_service/01_RUNTIME_FLOW.md](D:/SEP490/petties/docs-references/ai_diagnose_service/01_RUNTIME_FLOW.md), the active requirements are in [PETTIES_SRS.md](D:/SEP490/petties/docs-references/documentation/SRS/PETTIES_SRS.md) section `3.11.11`, and the trust-boundary rules are in [AI_SERVICE_TECHNICAL_SPECIFICATION.md](D:/SEP490/petties/docs-references/documentation/AI_SERVICE_TECHNICAL_SPECIFICATION.md).

**Project:** Petties - Veterinary Appointment Booking Platform
**Version:** 3.3.10 (Grounded SOAP synthesis with KB and Case Memory evidence)
**Last Updated:** 2026-04-02
**Document Status:** In Progress

## TABLE OF CONTENTS
- [1. System Design](#1-system-design)
    - [1.1 System Architecture](#11-system-architecture)
    - [1.2 Package Diagram](#12-package-diagram)
    - [1.3 UML Diagram Standards](#13-uml-diagram-standards)
- [2. Database Design](#2-database-design)
    - [2.1 Relational Database Design (PostgreSQL)](#21-relational-database-design-postgresql)
    - [2.2 NoSQL Database Design (MongoDB)](#22-nosql-database-design-mongodb)
- [3. API Design Specifications](#3-api-design-specifications)
    - [3.1 Implemented Modules (Backend - Spring Boot)](#31-implemented-modules-backend---spring-boot)
    - [3.2 Implemented Modules (AI Service - Python)](#32-implemented-modules-ai-service---python)
    - [3.3 Planned Modules (Backend)](#33-planned-modules-backend)
- [4. Detailed Design](#4-detailed-design)
    - [4.1 Authentication](#41-authentication)
    - [4.2 User Profile Management](#42-user-profile-management)
    - [4.20 AI Tool Booking Orchestration APIs](#420-ai-tool-booking-orchestration-apis)
    - [4.21 Staff AI Diagnosis in EMR Workspace](#421-staff-ai-diagnosis-in-emr-workspace)
    - [4.22 AI Health Summary for Pet Owner](#422-ai-health-summary-for-pet-owner)
    - [4.23 Staff AI Chat Panel](#423-staff-ai-chat-panel)
    - [4.24 Historical Resolution Note for Confirmed EMR Sync](#424-historical-resolution-note-for-confirmed-emr-sync)
### 4.3 Staff and Scheduling Management

This module covers clinic roster management and staff shift scheduling. The current design is centered around two controllers and two services: one pair manages clinic staff assignment by email and roster removal, while the other pair manages shift creation, schedule viewing, shift detail lookup, and shift deletion.

#### 4.3.1 Class Diagram

The class diagram below is intentionally simplified to keep Staff and Scheduling readable. The sequence diagrams in this section use the same set of core classes only: controller, service, repositories, and the main scheduling entities.

```mermaid
classDiagram
    class ClinicStaffController {
        +getStaff(UUID clinicId)
        +inviteByEmail(UUID clinicId, InviteByEmailRequest)
        +removeStaff(UUID clinicId, UUID userId)
    }

    class StaffShiftController {
        +createShift(UUID clinicId, StaffShiftRequest)
        +getShiftsByClinic(UUID clinicId, LocalDate startDate, LocalDate endDate)
        +getMyShifts(LocalDate startDate, LocalDate endDate)
        +getShiftDetail(UUID shiftId)
        +deleteShift(UUID shiftId)
    }

    class ClinicStaffService {
        +getClinicStaff(UUID clinicId)
        +inviteByEmail(UUID clinicId, InviteByEmailRequest)
        +removeStaff(UUID clinicId, UUID userId)
        +hasManager(UUID clinicId)
    }

    class StaffShiftService {
        +createShifts(UUID clinicId, StaffShiftRequest)
        +getShiftsByClinic(UUID clinicId, LocalDate startDate, LocalDate endDate)
        +getShiftsByStaff(UUID staffId, LocalDate startDate, LocalDate endDate)
        +getShiftDetail(UUID shiftId)
        +deleteShift(UUID shiftId)
    }

    class ClinicRepository {
        <<interface>>
    }

    class UserRepository {
        <<interface>>
    }

    class StaffShiftRepository {
        <<interface>>
    }

    class SlotRepository {
        <<interface>>
    }

    class User {
        +UUID userId
        +String email
        +Role role
        +StaffSpecialty specialty
        +Clinic workingClinic
    }

    class Clinic {
        +UUID clinicId
        +String name
        +Map~String, OperatingHours~ operatingHours
        +User owner
    }

    class StaffShift {
        +UUID shiftId
        +LocalDate workDate
        +LocalTime startTime
        +LocalTime endTime
        +Boolean isOvernight
        +List~Slot~ slots
    }

    class Slot {
        +UUID slotId
        +LocalTime startTime
        +LocalTime endTime
        +SlotStatus status
    }

    ClinicStaffController --> ClinicStaffService
    StaffShiftController --> StaffShiftService

    ClinicStaffService --> ClinicRepository
    ClinicStaffService --> UserRepository
    StaffShiftService --> ClinicRepository
    StaffShiftService --> UserRepository
    StaffShiftService --> StaffShiftRepository
    StaffShiftService --> SlotRepository

    ClinicRepository --> Clinic
    UserRepository --> User
    StaffShiftRepository --> StaffShift
    SlotRepository --> Slot

    User --> Clinic : workingClinic
    StaffShift --> Clinic
    StaffShift --> User : staff
    StaffShift --> Slot : slots
```

#### 4.3.2 Class Specifications

**1. `ClinicStaffController`**
- **Responsibility:** Expose staff roster APIs for clinic-level web operations.
- **Key Methods:** `getStaff()`, `inviteByEmail()`, `removeStaff()`.

**2. `ClinicStaffService`**
- **Responsibility:** Enforce clinic-level authorization and maintain the relationship between `User` and `Clinic` for staff membership.
- **Key Methods:** `getClinicStaff()`, `inviteByEmail()`, `removeStaff()`, `hasManager()`.

**3. `StaffShiftController`**
- **Responsibility:** Expose schedule APIs for clinic-wide shift management and staff self-view.
- **Key Methods:** `createShift()`, `getShiftsByClinic()`, `getMyShifts()`, `getShiftDetail()`, `deleteShift()`.

**4. `StaffShiftService`**
- **Responsibility:** Handle shift validation, slot generation, overnight continuation logic, slot statistics, and shift deletion rules.
- **Key Methods:** `createShifts()`, `getShiftsByClinic()`, `getShiftsByStaff()`, `getShiftDetail()`, `deleteShift()`.

**5. `User` / `Clinic`**
- **Responsibility:** Store clinic membership, role, specialty, and ownership context used by staff management flows.

**6. `StaffShift` / `Slot`**
- **Responsibility:** Represent scheduled work periods and 30-minute booking capacity generated for each shift.

#### 4.3.3 Sequence Diagram: Invite Staff by Email (UC-STAFF-01)

This flow creates or reuses a user account and associates it with the target clinic.

```mermaid
sequenceDiagram
    actor Manager as Clinic Owner/Manager
    participant UI as Staff Management UI
    participant CSC as ClinicStaffController
    participant CSS as ClinicStaffService
    participant CR as ClinicRepository
    participant UR as UserRepository
    participant DB as Database

    Manager->>UI: Enter email, role, specialty
    UI->>CSC: POST /clinics/{clinicId}/staff/invite-by-email
    CSC->>CSS: inviteByEmail(clinicId, request)
    CSS->>CR: findById(clinicId)
    CR->>DB: Load clinic
    DB-->>CR: Clinic
    CR-->>CSS: Clinic
    CSS->>CSS: Validate clinic access and role rules
    CSS->>UR: findByEmail(email)
    UR->>DB: Load user by email
    DB-->>UR: Existing user or null
    UR-->>CSS: User or null

    alt Existing user available
        CSS->>CSS: Validate user is not linked to another clinic
        CSS->>UR: save(updatedUser)
        UR->>DB: Update role, clinic, specialty
        DB-->>UR: Saved
        UR-->>CSS: Updated user
    else New user required
        CSS->>UR: save(newUser)
        UR->>DB: Insert user with clinic assignment
        DB-->>UR: Saved
        UR-->>CSS: Created user
    end

    CSS-->>CSC: Success
    CSC-->>UI: 200 OK
    UI-->>Manager: Show invite success state
```

#### 4.3.4 Sequence Diagram: Delete Staff (UC-STAFF-02)

This flow removes a user's clinic association after authorization checks.

```mermaid
sequenceDiagram
    actor Manager as Clinic Owner/Manager
    participant UI as Staff Management UI
    participant CSC as ClinicStaffController
    participant CSS as ClinicStaffService
    participant CR as ClinicRepository
    participant UR as UserRepository
    participant DB as Database

    Manager->>UI: Delete selected staff member
    UI->>CSC: DELETE /clinics/{clinicId}/staff/{userId}
    CSC->>CSS: removeStaff(clinicId, userId)
    CSS->>CR: findById(clinicId)
    CR->>DB: Load clinic
    DB-->>CR: Clinic
    CR-->>CSS: Clinic
    CSS->>UR: findById(userId)
    UR->>DB: Load target user
    DB-->>UR: User
    UR-->>CSS: User
    CSS->>CSS: Validate clinic ownership and caller permission
    CSS->>CSS: Clear targetUser.workingClinic
    CSS->>UR: save(targetUser)
    UR->>DB: Update user clinic assignment
    DB-->>UR: Saved
    UR-->>CSS: Updated user
    CSS-->>CSC: Success
    CSC-->>UI: 200 OK
    UI-->>Manager: Refresh roster
```

#### 4.3.5 Sequence Diagram: View Own Work Schedule (UC-STAFF-04)

This flow returns shifts for the authenticated staff member, including overnight continuation items.

```mermaid
sequenceDiagram
    actor Staff
    participant UI as My Schedule UI
    participant SSC as StaffShiftController
    participant SSS as StaffShiftService
    participant UR as UserRepository
    participant SSR as StaffShiftRepository
    participant DB as Database

    Staff->>UI: Select date range
    UI->>SSC: GET /shifts/me?startDate=...&endDate=...
    SSC->>SSC: Resolve authenticated user
    SSC->>UR: findById(currentUserId)
    UR->>DB: Load current user
    DB-->>UR: User
    UR-->>SSC: Current user
    SSC->>SSS: getShiftsByStaff(userId, startDate, endDate)
    SSS->>SSR: findByStaffAndDateRange(userId, startDate, endDate)
    SSR->>DB: Load regular shifts
    DB-->>SSR: Shift list
    SSR-->>SSS: Shift list
    SSS->>SSR: findOvernightShiftsByStaffFromPreviousDay(userId, dayBefore)
    SSR->>DB: Load overnight shifts
    DB-->>SSR: Overnight shift list
    SSR-->>SSS: Overnight shift list
    SSS->>SSS: Map responses and sort by displayDate
    SSS-->>SSC: StaffShiftResponse list
    SSC-->>UI: 200 OK
    UI-->>Staff: Render own schedule
```

#### 4.3.6 Sequence Diagram: Create Staff Shift (UC-STAFF-05)

This flow validates requested dates and creates or updates shifts with generated slots.

```mermaid
sequenceDiagram
    actor Manager as Clinic Owner/Manager
    participant UI as Scheduling UI
    participant SSC as StaffShiftController
    participant SSS as StaffShiftService
    participant UR as UserRepository
    participant CR as ClinicRepository
    participant SSR as StaffShiftRepository
    participant SR as SlotRepository
    participant DB as Database

    Manager->>UI: Submit shift request
    UI->>SSC: POST /clinics/{clinicId}/shifts
    SSC->>SSS: createShifts(clinicId, request)
    SSS->>UR: findById(staffId)
    UR->>DB: Load staff user
    DB-->>UR: User
    UR-->>SSS: User
    SSS->>CR: findById(clinicId)
    CR->>DB: Load clinic
    DB-->>CR: Clinic
    CR-->>SSS: Clinic
    SSS->>SSS: Validate clinic ownership, dates, times, overnight rules

    loop Each requested work date
        SSS->>SSR: findOneByStaff_UserIdAndWorkDate(staffId, workDate)
        SSR->>DB: Load existing shift for day
        DB-->>SSR: Existing shift or null
        SSR-->>SSS: Existing shift or null
        alt Force update existing shift
            SSS->>SR: findByShift_ShiftIdAndStatusOrderByStartTime(shiftId, BOOKED)
            SR->>DB: Load booked slots
            DB-->>SR: Booked slot list
            SR-->>SSS: Booked slot list
            SSS->>SSS: Reject conflicting updates or regenerate slots
        else New shift
            SSS->>SSS: Build shift and generate 30-minute slots
        end
        SSS->>SSR: save(shift)
        SSR->>DB: Persist shift and slots
        DB-->>SSR: Saved shift
        SSR-->>SSS: Saved shift
    end

    SSS-->>SSC: Created or updated shifts
    SSC-->>UI: 201 Created
    UI-->>Manager: Show scheduling result
```

#### 4.3.7 Sequence Diagram: View Staff Shift (UC-STAFF-06)

This flow supports both clinic-wide schedule viewing and single-shift inspection.

```mermaid
sequenceDiagram
    actor User as Owner/Manager/Staff
    participant UI as Scheduling UI
    participant SSC as StaffShiftController
    participant SSS as StaffShiftService
    participant SSR as StaffShiftRepository
    participant DB as Database

    User->>UI: Open clinic schedule for date range
    UI->>SSC: GET /clinics/{clinicId}/shifts?startDate=...&endDate=...
    SSC->>SSS: getShiftsByClinic(clinicId, startDate, endDate)
    SSS->>SSR: findByClinicAndDateRange(clinicId, startDate, endDate)
    SSR->>DB: Load clinic shifts
    DB-->>SSR: Shift list
    SSR-->>SSS: Shift list
    SSS->>SSR: findOvernightShiftsFromPreviousDay(clinicId, dayBefore)
    SSR->>DB: Load overnight continuation shifts
    DB-->>SSR: Overnight shift list
    SSR-->>SSS: Overnight shift list
    SSS-->>SSC: StaffShiftResponse list
    SSC-->>UI: 200 OK
    UI-->>User: Render clinic schedule

    User->>UI: Open one shift detail
    UI->>SSC: GET /shifts/{shiftId}
    SSC->>SSS: getShiftDetail(shiftId)
    SSS->>SSR: findByIdWithSlots(shiftId)
    SSR->>DB: Load shift with slots
    DB-->>SSR: Shift detail
    SSR-->>SSS: Shift detail
    SSS-->>SSC: StaffShiftResponse with slots
    SSC-->>UI: 200 OK
    UI-->>User: Render shift detail
```

#### 4.3.8 Sequence Diagram: Delete Staff Shift (UC-STAFF-07)

This flow deletes a shift only when no booked slot exists.

```mermaid
sequenceDiagram
    actor Manager as Clinic Owner/Manager
    participant UI as Scheduling UI
    participant SSC as StaffShiftController
    participant SSS as StaffShiftService
    participant SSR as StaffShiftRepository
    participant SR as SlotRepository
    participant DB as Database

    Manager->>UI: Delete selected shift
    UI->>SSC: DELETE /shifts/{shiftId}
    SSC->>SSS: deleteShift(shiftId)
    SSS->>SSR: findByIdWithSlots(shiftId)
    SSR->>DB: Load shift with slots
    DB-->>SSR: Shift
    SSR-->>SSS: Shift
    SSS->>SR: existsByShift_ShiftIdAndStatus(shiftId, BOOKED)
    SR->>DB: Check booked slots
    DB-->>SR: true or false
    SR-->>SSS: true or false

    alt Shift has booked slots
        SSS-->>SSC: Throw BadRequestException
        SSC-->>UI: 400 Bad Request
        UI-->>Manager: Show deletion error
    else Shift can be deleted
        SSS->>SSR: delete(shift)
        SSR->>DB: Delete shift and slots
        DB-->>SSR: Success
        SSR-->>SSS: Deleted
        SSS->>SSS: Trigger post-delete side effects
        SSS-->>SSC: Success
        SSC-->>UI: 204 No Content
        UI-->>Manager: Refresh schedule
    end
```

#### 4.3.9 Cross-Reference to SRS

| SDD Section | SRS Reference | Description |
|-------------|---------------|-------------|
| 4.3.1 Class Diagram | 3.7.1 - 3.7.7 | Overall staff and scheduling structure |
| 4.3.3 Invite Staff by Email | 3.7.1 | Staff invitation and clinic assignment |
| 4.3.4 Delete Staff | 3.7.2 | Remove clinic association from staff |
| 4.3.5 View Own Work Schedule | 3.7.4 | Staff self-schedule lookup |
| 4.3.6 Create Staff Shift | 3.7.5 | Multi-date shift creation with slots |
| 4.3.7 View Staff Shift | 3.7.6 | Clinic shift list and shift detail |
| 4.3.8 Delete Staff Shift | 3.7.7 | Shift deletion with booking guard |

---


## 1. System Design

### 1.1 System Architecture

```mermaid
flowchart TD
    subgraph INFRA["DEPLOYMENT & INFRASTRUCTURE"]
        direction LR
        Docker["Docker<br/>(Containerization)"]
        GitHub["GitHub Actions<br/>(CI/CD)"]
        AWS["AWS EC2<br/>(Backend Services)"]
        Vercel["Vercel<br/>(Frontend Hosting)"]
    end

    subgraph FRONTEND["FRONTEND"]
        direction TB
        User["User<br/>Web & Mobile"]
        User --> Flutter
        User --> React
        Flutter["Flutter 3.5<br/>(Mobile App)<br/>Pet Owner, Staff"]
        React["React 19<br/>(Web Dashboard)<br/>Admin, Clinic Staff, Staff"]
    end

    subgraph BACKEND["BACKEND"]
        direction TB
        APIGateway["API Gateway<br/>NGINX<br/>- Real-time Routing<br/>- Load Balancing<br/>- Rate Limiting"]
        APIGateway --> SpringBoot
        APIGateway --> Python
        SpringBoot["Spring Boot 3.4<br/>- API Management<br/>- Authentication<br/>- REST API Endpoints<br/>- WebSocket Server"]
        Python["Python FastAPI<br/>- AI Agent Service<br/>- AI Chat Streaming<br/>- RAG Pipeline"]
        SpringBoot <-.-> Python
    end

    subgraph STORAGE["STORE DATA"]
        direction LR
        Redis[("Redis 7<br/>(Cache & OTP)")]
        Cloudinary["Cloudinary<br/>(Media Assets)"]
        Firebase["Firebase<br/>(Push Notifications)<br/>[Planned]"]
        QdrantCloud[("Qdrant Cloud<br/>(Vector DB)")]
        MongoDB[("MongoDB 7<br/>(Flexible Schema Data)")]
        PostgreSQL[("PostgreSQL 16<br/>(Primary DB)")]
    end

    subgraph EXTERNAL["EXTERNAL SERVICES"]
        direction LR
        Cohere["Cohere API<br/>(Embeddings)"]
        OpenRouter["OpenRouter API<br/>(LLM Gateway)"]
        GoogleMaps["Google Maps API<br/>(Geocoding)"]
        Stripe["Stripe<br/>(Payments)<br/>[Planned]"]
    end

    %% Main Flow Connections
    INFRA --> FRONTEND
    Flutter --> APIGateway
    React --> APIGateway

    %% Backend to Storage - Data Query
    SpringBoot -->|"Data Query"| PostgreSQL
    SpringBoot --> Redis
    SpringBoot --> MongoDB
    SpringBoot --> Cloudinary
    SpringBoot -.-> Firebase
    Python --> PostgreSQL
    Python --> QdrantCloud

    %% Backend to External Services
    Python --> Cohere
    Python --> OpenRouter
    SpringBoot --> GoogleMaps
    SpringBoot -.-> Stripe

    %% Styling
    classDef frontend fill:#dbeafe,stroke:#3b82f6,stroke-width:2px
    classDef backend fill:#fed7aa,stroke:#f97316,stroke-width:2px
    classDef storage fill:#d1fae5,stroke:#10b981,stroke-width:2px
    classDef infra fill:#e9d5ff,stroke:#a855f7,stroke-width:2px
    classDef external fill:#f3f4f6,stroke:#6b7280,stroke-width:1px
    classDef planned fill:#fef9c3,stroke:#ca8a04,stroke-width:1px,stroke-dasharray:5,5

    class User,Flutter,React frontend
    class APIGateway,SpringBoot,Python backend
    class Redis,Cloudinary,QdrantCloud,PostgreSQL,MongoDB storage
    class Docker,GitHub,AWS,Vercel infra
    class Cohere,OpenRouter,GoogleMaps external
    class Firebase,Stripe planned
```

**Layered view (FE → BE → AI → DB)** – Sơ đồ dưới thể hiện cùng kiến trúc theo luồng từ trái sang phải: Frontend → Core Backend → AI Agent Service (cùng cấp với Backend) → Data & External. AI được tách thành một layer độc lập để làm rõ trách nhiệm và luồng request.

```mermaid
flowchart LR
    subgraph FE["FRONTEND"]
        direction TB
        U["User<br/>Web & Mobile"]
        F["Flutter 3.5<br/>Mobile"]
        R["React 19<br/>Web"]
        U --> F
        U --> R
    end

    subgraph BE["CORE BACKEND"]
        direction TB
        NGINX["API Gateway<br/>NGINX"]
        SB["Spring Boot 3.4<br/>REST · Auth · Biz"]
        NGINX --> SB
    end

    subgraph AI["AI AGENT SERVICE"]
        direction TB
        FA["FastAPI<br/>Single Agent · ReAct"]
        RAG["RAG Pipeline<br/>LlamaIndex"]
        MCP["Tools<br/>FastMCP"]
        FA --> RAG
        FA --> MCP
    end

    subgraph DB["DATA & KNOWLEDGE"]
        direction TB
        PG[("PostgreSQL 16")]
        MDB[("MongoDB 7")]
        RD[("Redis 7")]
        QD[("Qdrant Cloud")]
        CL["Cloudinary"]
        PG
        MDB
        RD
        QD
        CL
    end

    subgraph EXT["EXTERNAL SERVICES"]
        direction TB
        OR["OpenRouter<br/>LLM"]
        CO["Cohere<br/>Embeddings"]
        GM["Google Maps"]
        OR
        CO
        GM
    end

    FE -->|"HTTPS / WSS"| BE
    BE -->|"Proxy / API"| AI
    AI -->|"Query · Config"| PG
    AI -->|"Vectors"| QD
    BE -->|"CRUD"| PG
    BE --> RD
    BE --> MDB
    BE --> CL
    BE --> GM
    AI --> OR
    AI --> CO

    style AI fill:#c4b5fd,stroke:#6d28d9,stroke-width:3px
    style FE fill:#dbeafe,stroke:#3b82f6
    style BE fill:#fed7aa,stroke:#f97316
    style DB fill:#d1fae5,stroke:#10b981
    style EXT fill:#f3f4f6,stroke:#6b7280
```

**The Petties Platform** is designed with a modern, scalable, and modular architecture, clearly separating frontend and backend responsibilities. This ensures high performance, flexibility for scaling, and easy integration with third-party services.

**1. User Role:**
- **Guest** - Can view clinic listings, search clinics, and view basic information
- **Pet Owner** - Can register pets, book appointments, chat with AI assistant, view EMR history, and manage profile (Mobile only)
- **Staff** - Can view appointments, manage schedule, create EMR records, and access patient history (Web + Mobile)
- **Clinic Manager** - Manages clinic operations, staff scheduling, booking management, and patient records (Web only)
- **Clinic Owner** - Manages clinic profile, services, pricing, staff, and views analytics (Web only)
- **Admin** - Manages the system, user accounts, clinic approvals, AI agent configuration, and oversees system operations (Web only)

**2. Frontend Layer:**
- Built with **React 19** (Web Dashboard) and **Flutter 3.5** (Mobile App) for responsive and real-time user experiences
- Uses **WebSocket clients** to receive live AI chat streaming
- Integrates **Neobrutalism design system** for consistent UI/UX
- Static assets are distributed through **Cloudinary CDN** to improve performance

**3. Backend Layer:**
- **Spring Boot 3.4 Server:** Handles API management, authentication (JWT), REST API endpoints, and business logic for clinics, bookings, users, pets, and EMR
- **Python FastAPI Service:** Processes AI chat requests, runs Single Agent with ReAct pattern, performs RAG queries, and supports real-time WebSocket streaming
- **API Gateway (NGINX):** Manages real-time routing, SSL termination, load balancing, and rate limiting

**4. Store Data:**
- **PostgreSQL 16** - Primary relational database storing users, clinics, bookings, pets, EMR, and AI agent configurations (shared by both services)
- **MongoDB 7** - Used for auditing, logs, and flexible schema data (e.g., patient records or specialized logs)
- **Redis 7** - Caches OTP codes, session data, and rate limiting counters with TTL-based expiration
- **Qdrant Cloud** - Stores vector embeddings for RAG knowledge base (1024 dimensions, Binary Quantization)
- **Cloudinary** - Manages media assets (images, avatars, clinic photos) efficiently with CDN delivery
- **Firebase** - Used for push notifications to mobile devices [Planned]

**5. Deployment & Infrastructure:**
- **Vercel** - Used for frontend (React) deployment with automatic preview deployments
- **AWS EC2** - Provides backend infrastructure and scalable cloud hosting for Spring Boot and FastAPI services
- **Docker** - Containerizes backend services (Spring Boot, FastAPI, NGINX), enabling flexible deployment and CI/CD pipelines
- **GitHub Actions** - Automated CI/CD for building, testing, and deploying all services

---

### 1.2 Package Diagram

#### 1.2.1 Back-End Package Diagram

##### Spring Boot Service (backend-spring)

```mermaid
flowchart TB
    subgraph BACKEND["backend-spring (Spring Boot 3.4 + Java 21)"]
        direction TB

        subgraph PRESENTATION["Presentation Layer (Controllers)"]
            style PRESENTATION fill:#90EE90
            direction LR
            controller["controller"]
        end

        subgraph BUSINESS["Business Layer"]
            style BUSINESS fill:#98FB98
            direction LR
            service["service"]
            serviceImpl["service/impl"]
        end

        subgraph DATA_ACCESS["Data Access Layer"]
            style DATA_ACCESS fill:#87CEEB
            direction LR
            repository["repository"]
        end

        subgraph DOMAIN["Domain Layer"]
            style DOMAIN fill:#FFB6C1
            direction LR
            model["model"]
            enums["model/enums"]
        end

        subgraph DTO_LAYER["DTO Layer"]
            style DTO_LAYER fill:#DDA0DD
            direction LR
            dto["dto"]
            mapper["mapper"]
        end

        subgraph CROSS_CUTTING["Cross-Cutting Concerns"]
            style CROSS_CUTTING fill:#F0E68C
            direction LR
            config["config"]
            security["security"]
            exception["exception"]
            validation["validation"]
        end

        subgraph INFRASTRUCTURE["Infrastructure Layer"]
            style INFRASTRUCTURE fill:#D3D3D3
            direction LR
            util["util"]
            converter["converter"]
            scheduler["scheduler"]
            event["event"]
        end

        subgraph MIGRATION["Database Migration"]
            style MIGRATION fill:#FFFACD
            direction LR
            dbMigration["db/migration"]
        end

        subgraph TESTING["Testing Layer"]
            style TESTING fill:#E6E6FA
            direction LR
            test["test"]
        end
    end

    %% Layer dependencies with <<import>> and <<use>> stereotypes
    %% Flow: Controller → DTO → Service → Repository → Entity
    PRESENTATION -.->|"<<use>>"| DTO_LAYER
    PRESENTATION -.->|"<<import>>"| BUSINESS
    BUSINESS -.->|"<<use>>"| DTO_LAYER
    BUSINESS -.->|"<<import>>"| DATA_ACCESS
    BUSINESS -.->|"<<use>>"| DOMAIN
    DATA_ACCESS -.->|"<<import>>"| DOMAIN
    DTO_LAYER -.->|"<<use>>"| DOMAIN

    %% Cross-Cutting Concerns (applies to all layers)
    CROSS_CUTTING -.->|"<<configure>>"| PRESENTATION
    CROSS_CUTTING -.->|"<<configure>>"| BUSINESS
    CROSS_CUTTING -.->|"<<configure>>"| DATA_ACCESS

    %% Infrastructure dependencies
    BUSINESS -.->|"<<use>>"| INFRASTRUCTURE

    %% Migration applies to Domain
    MIGRATION -.->|"<<migrate>>"| DOMAIN

    %% Testing dependencies
    TESTING -.->|"<<import>>"| PRESENTATION
    TESTING -.->|"<<import>>"| BUSINESS
```

##### Python AI Agent Service (petties-agent-serivce)

```mermaid
flowchart TB
    subgraph AI_SERVICE["petties-agent-serivce (FastAPI + Python 3.12)"]
        direction TB

        subgraph PRESENTATION["Presentation Layer (API)"]
            style PRESENTATION fill:#90EE90
            direction LR
            api["api"]
        end

        subgraph CORE["Core Layer"]
            style CORE fill:#87CEEB
            direction LR
            core["core"]
        end

        subgraph SERVICES["Services Layer"]
            style SERVICES fill:#F0E68C
            direction LR
            services["services"]
        end

        subgraph DATABASE["Database Layer"]
            style DATABASE fill:#FFA07A
            direction LR
            db["db"]
        end

        subgraph CONFIG["Configuration Layer"]
            style CONFIG fill:#D3D3D3
            direction LR
            config["config"]
        end

        subgraph TESTING["Testing Layer"]
            style TESTING fill:#E6E6FA
            direction LR
            tests["tests"]
        end
    end

    %% Layer dependencies
    PRESENTATION -.->|"<<import>>"| CORE
    CORE -.->|"<<import>>"| SERVICES
    CORE -.->|"<<use>>"| DATABASE
    SERVICES -.->|"<<use>>"| CONFIG
    TESTING -.->|"<<import>>"| PRESENTATION
    TESTING -.->|"<<import>>"| CORE
```

##### Package Descriptions - Spring Boot Service:

| No | Package | Layer Responsibility |
|----|---------|---------------------|
| **Presentation Layer** |
| 01 | controller | **REST API Layer** - Handles HTTP requests and maps them to service methods. Responsible for request validation, authentication checks, and response formatting. Implements `@RestController` pattern with route mapping to `/api/*` endpoints. |
| **Business Layer** |
| 02 | service | **Business Logic Layer** - Contains core business rules, transaction management (`@Transactional`), and orchestration of operations. Implements concrete Service classes for simplicity and direct implementation. Coordinates between repositories and external integrations. |

| **Data Access Layer** |
| 04 | repository | **Data Access Layer** - Provides CRUD operations and custom query methods using Spring Data JPA. Abstracts database interactions with PostgreSQL. Implements Repository pattern with method naming conventions for query generation. |
| **Domain Layer** |
| 05 | model | **Domain Entity Layer** - JPA entities mapped to PostgreSQL tables. Defines data structure, relationships (`@OneToMany`, `@ManyToOne`, `@ManyToMany`), and lifecycle hooks. Uses Hibernate for ORM with auditing fields (createdAt, updatedAt). |
| 06 | model/enums | **Enumeration Types** - Type-safe constants for domain concepts (Role, Status, Type). Ensures data integrity and provides readable code instead of magic strings/numbers. |
| **DTO Layer** |
| 07 | dto | **Data Transfer Objects** - Defines API contracts between client and server. Handles request validation (Jakarta Bean Validation annotations), response shaping, and prevents entity exposure. Organized by feature domain. |
| 08 | mapper | **Object Mapping Layer** - MapStruct-based mappers for Entity ↔ DTO conversion. Eliminates boilerplate mapping code and ensures type-safe transformations between layers. |
| **Cross-Cutting Concerns** |
| 09 | config | **Configuration Layer** - Spring beans for cross-cutting concerns: Security (JWT filter, authentication), external services (Redis, Cloudinary, Google Maps), JPA/Hibernate settings, WebSocket, Swagger/OpenAPI, and CORS configuration. |
| 10 | security | **Security Layer** - JWT token provider, authentication filter, custom `UserDetailsService`, and role-based access control. Implements Spring Security 6.x with stateless session management. |
| 11 | exception | **Error Handling Layer** - Centralized exception handling with `@ControllerAdvice`. Defines custom exceptions (BadRequest, NotFound, Unauthorized, Forbidden) and standardized error responses with Vietnamese messages. |
| 12 | validation | **Custom Validation Layer** - Custom Bean Validation annotations and validators for business rules not covered by standard annotations (e.g., phone format, date range validation). |
| **Infrastructure Layer** |
| 13 | util | **Utility Layer** - Stateless helper classes for common operations (token manipulation, date formatting, string processing, slug generation). Shared across multiple services without business logic. |
| 14 | converter | **Data Conversion Layer** - JPA `AttributeConverter` implementations for complex type mappings (JSON ↔ Object, Enum ↔ String). Enables storing structured data in database columns. |
| 15 | scheduler | **Scheduled Tasks Layer** - Spring `@Scheduled` jobs for background processing (appointment reminders, expired token cleanup, report generation). Implements cron-based and fixed-rate scheduling. |
| 16 | event | **Event Handling Layer** - Spring Application Events for decoupled communication between components. Implements async event publishing and listeners for notifications, audit logging, and side effects. |
| **Database Migration** |
| 17 | db/migration | **Schema Migration Layer** - Flyway SQL migration scripts with versioned naming (`V{timestamp}__{description}.sql`). Manages database schema evolution across environments. |
| **Testing Layer** |
| 18 | test | **Testing Layer** - JUnit 5 + Mockito test suites organized by component type (controller, service, repository). Includes unit tests with mocked dependencies and integration tests with `@SpringBootTest`. Follows Arrange-Act-Assert pattern with test fixtures for data setup. |

##### Package Descriptions - Python AI Agent Service:

| No | Package | Layer Responsibility |
|----|---------|---------------------|
| **API Layer** |
| 01 | api/routes | **REST Endpoint Layer** - FastAPI route handlers exposing AI service capabilities. Manages HTTP endpoints for chat sessions, agent configuration, tool registry, knowledge base, and settings. Uses Pydantic for request/response validation. |
| 02 | api/websocket | **Real-time Communication Layer** - WebSocket endpoints for bidirectional streaming. Enables real-time AI chat with token-by-token streaming and ReAct trace visualization. Handles connection lifecycle and message protocols. |
| 03 | api/middleware | **Request Interception Layer** - Cross-cutting middleware for authentication (JWT validation), logging, and request preprocessing. Integrates with Spring Boot's auth system for user context extraction. |
| 04 | api/schemas | **API Contract Layer** - Pydantic models defining request/response structures. Provides runtime validation, serialization, and OpenAPI documentation generation for all API endpoints. |
| 05 | api/dependencies | **Dependency Injection Layer** - FastAPI dependencies for common operations (database sessions, current user, pagination). Enables reusable request-scoped resources across routes. |
| **Core - Agent Layer** |
| 06 | core/agents | **AI Agent Orchestration** - Implements Single Agent with ReAct pattern (Thought → Action → Observation loop) using LangGraph StateGraph. Manages agent state, decision-making, and response generation. |
| 07 | core/agents/state | **Agent State Management** - TypedDict definitions for ReAct state (messages, steps, current thought, tool calls). Enables stateful conversation and reasoning trace tracking. |
| 08 | core/agents/factory | **Agent Construction Layer** - Factory pattern for dynamic agent instantiation. Loads configuration (prompts, parameters, enabled tools) from PostgreSQL database at runtime. |
| **Core - Tool Layer** |
| 09 | core/tools | **Tool Infrastructure Layer** - FastMCP server setup for tool registration and execution. Provides decorator-based tool definition (`@mcp.tool`) with semantic descriptions for LLM function calling. |
| 10 | core/tools/mcp_tools | **Tool Implementation Layer** - Code-based tools with semantic descriptions. Each tool is a function decorated with `@mcp.tool()` providing capabilities like Q&A, symptom search, clinic lookup, booking creation. |
| 11 | core/tools/scanner | **Tool Discovery Layer** - Auto-scans Python modules for `@mcp.tool` decorated functions. Syncs discovered tools to database for admin management (enable/disable, assign to agents). |
| 12 | core/tools/executor | **Tool Execution Layer** - Validates tool parameters against schema and executes through MCP server. Handles tool errors gracefully and returns structured results to agent. |
| **Core - RAG Layer** |
| 13 | core/rag | **Knowledge Retrieval Layer** - LlamaIndex-based RAG engine with Cohere embeddings (1024 dims) and Qdrant Cloud vector storage. Handles document chunking, embedding, indexing, and semantic search for context augmentation. |
| **Core - Utilities** |
| 14 | core/config_helper | **Dynamic Configuration Layer** - Loads API keys, model settings, and prompts from PostgreSQL. Enables runtime configuration changes without service restart. |
| 15 | core/init_db | **Database Initialization** - Seed data scripts and initial setup for agents, tools, and system settings. Runs on application startup. |
| 16 | core/sentry | **Error Monitoring Layer** - Sentry SDK integration for error tracking, performance monitoring, and distributed tracing across async operations. |
| **Services Layer** |
| 17 | services | **External Integration Layer** - Clients for external APIs (OpenRouter LLM, Cohere embeddings). Handles streaming responses, retry logic, and error handling for cloud AI providers. |
| **Database Layer** |
| 18 | db/postgres/models | **ORM Model Layer** - SQLAlchemy ORM models defining entities (Agent, Tool, KnowledgeDocument, SystemSetting). AI chat session/message không thuộc PostgreSQL scope; toàn bộ AI chat history lưu trên MongoDB. |
| 19 | db/postgres/session | **Session Management Layer** - AsyncSession factory for database connections. Manages connection pooling and transaction scopes for async operations. |
| 20 | db/migrations | **Schema Migration Layer** - Alembic migration scripts for database schema versioning. Enables safe schema evolution across environments with up/down migrations. |
| **Configuration Layer** |
| 21 | config | **Environment Configuration** - Pydantic Settings for environment variables. Centralized configuration for database URLs, API keys, and logging setup with validation. |
| 22 | config/logging | **Logging Configuration** - Structured logging setup with JSON formatting for production. Configures log levels, handlers, and formatters per environment. |
| **Testing Layer** |
| 23 | tests | **Testing Layer** - pytest test suites for API endpoints, agent logic, tool execution, and RAG pipeline. Includes unit tests with mocks and integration tests with test database. Uses pytest-asyncio for async testing. |

---

#### 1.2.2 Front-End Package Diagram

##### React Web Dashboard (petties-web)

```mermaid
flowchart TB
    subgraph WEB["petties-web (React 19 + Vite + TypeScript)"]
        direction TB

        subgraph SIDE_PANELS["Shared Modules"]
            style SIDE_PANELS fill:#D3D3D3
            direction TB
            store["store"]
            hooks["hooks"]
            utils["utils"]
            config["config"]
            lib["lib"]
        end

        subgraph PAGES["pages"]
            style PAGES fill:#90EE90
            direction LR
            pagesAuth["auth"]
            pagesAdmin["admin"]
            pagesClinicOwner["clinic-owner"]
            pagesClinicManager["clinic-manager"]
            pagesVet["vet"]
            pagesShared["shared"]
        end

        subgraph COMPONENTS["components"]
            style COMPONENTS fill:#98FB98
            direction LR
            compCore["core"]
            compModules["modules"]
        end

        subgraph LAYOUTS["layouts"]
            style LAYOUTS fill:#DDA0DD
            direction LR
            layouts["layouts"]
        end

        subgraph SERVICES["services"]
            style SERVICES fill:#F0E68C
            direction LR
            servicesApi["api"]
            servicesWebsocket["websocket"]
        end

        subgraph TYPES["types"]
            style TYPES fill:#87CEEB
            direction LR
            types["types"]
        end

        subgraph TESTING["__tests__"]
            style TESTING fill:#E6E6FA
            direction LR
            tests["__tests__"]
        end
    end

    %% Layer dependencies with <<import>> and <<use>> stereotypes
    %% Flow: Layouts → Pages → Components → Services → Types
    SIDE_PANELS -.->|"<<use>>"| COMPONENTS
    layouts -.->|"<<import>>"| PAGES
    PAGES -.->|"<<use>>"| COMPONENTS
    PAGES -.->|"<<use>>"| SIDE_PANELS
    COMPONENTS -.->|"<<import>>"| SERVICES
    SERVICES -.->|"<<use>>"| TYPES
    TESTING -.->|"<<import>>"| COMPONENTS
```

##### Flutter Mobile App (petties_mobile)

```mermaid
flowchart TB
    subgraph MOBILE["petties_mobile (Flutter 3.5 + Dart)"]
        direction TB

        subgraph SIDE_PANELS["Shared Modules"]
            style SIDE_PANELS fill:#D3D3D3
            direction TB
            providers["providers"]
            utils["utils"]
            cfgConstants["config/constants"]
            cfgTheme["config/theme"]
            cfgEnv["config/env"]
        end

        subgraph UI_SCREENS["ui (screens)"]
            style UI_SCREENS fill:#90EE90
            direction LR
            uiAuth["auth"]
            uiPetOwner["pet_owner"]
            uiVet["vet"]
            uiPet["pet"]
            uiProfile["profile"]
        end

        subgraph UI_WIDGETS["ui/widgets"]
            style UI_WIDGETS fill:#98FB98
            direction LR
            coreWidgets["core/widgets"]
            widgets["widgets"]
        end

        subgraph DATA["data"]
            style DATA fill:#F0E68C
            direction LR
            dataServices["services"]
            dataModels["models"]
            dataDatasources["datasources"]
            dataRepositories["repositories"]
        end

        subgraph ROUTING["routing"]
            style ROUTING fill:#87CEEB
            direction LR
            routing["routing"]
        end

        subgraph CORE["core"]
            style CORE fill:#FFB6C1
            direction LR
            coreError["error"]
            coreNetwork["network"]
        end

        subgraph TESTING["test"]
            style TESTING fill:#E6E6FA
            direction LR
            test["test"]
        end
    end

    %% Layer dependencies with <<import>> and <<use>> stereotypes
    %% Flow: Routing → Screens → Widgets → Providers → Data → Core
    routing -.->|"<<import>>"| UI_SCREENS
    UI_SCREENS -.->|"<<use>>"| UI_WIDGETS
    UI_SCREENS -.->|"<<use>>"| SIDE_PANELS
    SIDE_PANELS -.->|"<<import>>"| DATA
    DATA -.->|"<<use>>"| CORE
    TESTING -.->|"<<import>>"| UI_SCREENS
    TESTING -.->|"<<import>>"| SIDE_PANELS
```

##### Package Descriptions - React Web Dashboard:

| No | Package | Layer Responsibility |
|----|---------|---------------------|
| **Pages Layer** |
| 01 | pages | **Route Page Layer** - Top-level page components mapping to routes. Each page represents a complete view for a specific role (Admin, Clinic Owner, Clinic Manager, Staff). Organized by role and feature domain. |
| 02 | pages/auth | **Authentication Pages** - Login, registration, and password recovery flows with OTP verification. Handles unauthenticated user journeys. |
| 03 | pages/admin | **Admin Dashboard Pages** - System administration views including clinic approvals, AI agent configuration, tool management, knowledge base, and system settings. |
| 04 | pages/clinic-owner | **Clinic Owner Pages** - Clinic management views for owners including profile editing, service configuration, pricing, and staff management. |
| 05 | pages/clinic-manager | **Clinic Manager Pages** - Operational views for daily clinic management including bookings, schedules, and patient records. |
| 06 | pages/vet | **Veterinarian Pages** - Staff-specific views for appointments, patient records, and schedule management. |
| 07 | pages/shared | **Shared Pages** - Cross-role pages like profile management accessible by all authenticated users. |
| **Components Layer** |
| 08 | components | **Reusable UI Components** - Modular, composable UI building blocks organized by domain (auth, clinic, profile, dashboard). Follows atomic design principles with consistent Neobrutalism styling. |
| 09 | components/common | **Shared Components** - Generic UI components used across multiple features (modals, inputs, dialogs, loading states). Framework-agnostic and highly reusable. |
| **Layouts Layer** |
| 10 | layouts | **Page Layout Layer** - Role-based layout wrappers providing consistent navigation, sidebar, and header structure. Implements layout composition pattern for DRY page structure. |
| **Services Layer** |
| 11 | services/api | **API Client Layer** - Axios-based HTTP client with interceptors for JWT handling, error transformation, and request/response logging. Provides typed service methods for each API domain. |
| 12 | services/websocket | **WebSocket Client Layer** - Real-time communication for AI chat streaming. Manages connection lifecycle, reconnection, and message handling. |
| **State Management** |
| 13 | store | **Global State Layer** - Zustand stores for application-wide state (auth, user profile, clinic data). Provides selectors, actions, and persistence for client-side state management. |
| **Hooks Layer** |
| 14 | hooks | **Custom React Hooks** - Reusable stateful logic encapsulation (useAuth, useToast, useDebounce). Abstracts common patterns and side effects for clean component code. |
| **Types Layer** |
| 15 | types | **TypeScript Definitions** - Shared type definitions for API responses, domain models, and component props. Ensures type safety across the application. |
| **Utils Layer** |
| 16 | utils | **Utility Functions** - Pure helper functions for common operations (date formatting, validation, token handling, error processing). Stateless and side-effect free. |
| **Config Layer** |
| 17 | config | **Environment Configuration** - Environment-specific settings (API URLs, feature flags). Centralizes configuration management with type-safe access. |
| **Lib Layer** |
| 18 | lib | **Third-party Integrations** - Wrappers and configurations for external libraries (Sentry error tracking). Isolates vendor-specific code from application logic. |
| **Testing Layer** |
| 19 | __tests__ | **Testing Layer** - Vitest/Jest test suites for components and hooks. Includes unit tests with React Testing Library and integration tests for user flows. Uses MSW for API mocking. |

##### Package Descriptions - Flutter Mobile App:

| No | Package | Layer Responsibility |
|----|---------|---------------------|
| **UI Layer - Screens** |
| 01 | ui/screens | **Screen Layer** - Full-page widget compositions representing complete views. Each screen corresponds to a route and composes widgets for specific user flows. Organized by user role (pet_owner, vet) and feature domain (auth, pet, profile). |
| 02 | ui/auth | **Authentication Screens** - Login, registration, password recovery flows with OTP verification. Handles unauthenticated user journeys with form validation. |
| 03 | ui/pet_owner | **Pet Owner Screens** - Home and feature screens exclusive to pet owners including booking, AI chat, and pet management. |
| 04 | ui/vet | **Veterinarian Screens** - Staff-specific screens for appointments, patient records, and schedule management. |
| **UI Layer - Widgets** |
| 05 | ui/core/widgets | **Core Widgets** - Foundational reusable widgets (buttons, text fields, loaders). Implements Neobrutalism design system with consistent styling across the app. |
| 06 | ui/widgets | **Feature Widgets** - Domain-specific widgets organized by feature (profile, pet, booking). Composable building blocks for screens. |
| **Data Layer** |
| 07 | data/services | **API Service Layer** - Dio-based HTTP services for backend communication. Handles request construction, response parsing, and error transformation. Implements service classes per domain (auth, user, pet). |
| 08 | data/models | **Data Model Layer** - Dart classes representing API responses and domain entities. Provides fromJson/toJson methods for serialization. Immutable data structures with factory constructors. |
| 09 | data/datasources | **Data Source Layer** - Abstracts data retrieval from local (SharedPreferences, Hive) and remote (API) sources. Implements Repository pattern's data source abstraction. |
| 10 | data/repositories | **Repository Layer** - Orchestrates between local and remote data sources. Implements caching strategies, offline-first logic, and data synchronization. Single source of truth for data access. |
| **State Management** |
| 11 | providers | **State Provider Layer** - Provider/Riverpod state management. Exposes reactive state to widgets with notifyListeners for UI updates. Handles async state loading and error states. |
| **Routing Layer** |
| 12 | routing | **Navigation Layer** - GoRouter configuration with role-based route guards. Defines route paths, redirects, and deep linking. Implements declarative navigation pattern. |
| **Config Layer** |
| 13 | config/constants | **App Constants** - Static configuration values (colors, strings, dimensions). Centralizes magic values for consistent UI and easy theming. |
| 14 | config/theme | **Theme Configuration** - MaterialApp theme definition with Neobrutalism styling. Defines colors, typography, component themes, and dark mode support. |
| 15 | config/env | **Environment Configuration** - Environment-specific settings (dev, test, prod). Manages API URLs and feature flags per build configuration. |
| **Core Layer** |
| 16 | core/error | **Error Handling Layer** - Custom exception classes and failure types. Standardizes error representation for consistent handling across the app. |
| 17 | core/network | **Network Layer** - Dio client setup with interceptors for JWT injection, token refresh, and error mapping. Centralizes HTTP configuration. |
| **Utils Layer** |
| 18 | utils | **Utility Layer** - Stateless helper functions for common operations (validators, date formatters, storage helpers, permission handling, API error processing). Shared across all layers without business logic. |
| **Entry Points** |
| 19 | main.dart | **Application Entry** - App initialization including Provider setup, Firebase init, GoRouter configuration, and theme application. |
| **Testing Layer** |
| 20 | test | **Testing Layer** - Flutter test suites for widgets, providers, and services. Includes unit tests with mocktail/mockito, widget tests with WidgetTester, and integration tests with flutter_driver. |

---

### 1.3 UML Diagram Standards

Tài liệu này định nghĩa các quy tắc chuẩn hóa khi viết Class Diagram và Sequence Diagram cho Petties SDD.

#### 1.3.1 Class Diagram Rules

**1. Class Structure:**
```mermaid
classDiagram
    class ClassName {
        -privateField type
        +publicMethod(param) returnType
    }
```
- `-` : private field
- `+` : public method
- Không cần ghi getter/setter

**2. Class Types:**
| Type | Content |
|------|---------|
| Controller | Methods là các API endpoints |
| Service | Methods là business logic |
| Repository | Interface với `<<interface>>`, methods là query |
| Entity | Fields đầy đủ, không có methods (trừ isExpired, etc.) |
| Enum | Dùng `<<enumeration>>` stereotype |

**3. Stereotypes:**
- `<<interface>>` : cho Repository interfaces
- `<<enumeration>>` : cho Enum types
- `<<abstract>>` : cho abstract classes

**4. Relationships:**
| Symbol | Meaning |
|--------|---------|
| `-->` | Dependency (Controller --> Service, Service --> Repository) |
| `--o` | Aggregation |
| `--*` | Composition |
| `--|>` | Inheritance |
| `..|>` | Implementation |

**5. Field Naming:**
- Fields viết camelCase
- Type viết sau field: `+UUID userId`
- Generic types dùng `~`: `Optional~User~`, `List~Pet~`

**6. Method Signatures:**
- Format: `+methodName(paramType) ReturnType`
- Nhiều params: `+method(String, UUID) ResponseEntity`
- Không có return: `+method(param) void`

**7. Dependency Grouping:**
- Nhóm dependencies theo comment: `%% Controller Dependencies`
- Thứ tự: Controller → Service → Repository → Entity

**8. Classes bắt buộc cho mỗi module:**
- 1 Controller
- 1+ Services
- 1+ Repositories
- 1+ Entities
- 1+ Enums (nếu có)

**9. Naming Convention:**
| Type | Pattern |
|------|---------|
| Controller | `[Feature]Controller` |
| Service | `[Feature]Service` |
| Repository | `[Entity]Repository` |
| Entity | `[EntityName]` (singular) |

---

#### 1.3.2 Sequence Diagram Rules

**1. Participants bắt buộc:**
```
actor User as [Tên Role]           %% Pet Owner, Staff, Clinic Manager
participant UI as [Tên Screen]     %% Mobile/Web
participant [Abbrev] as [ControllerName]
participant [Abbrev] as [ServiceName]
participant [Abbrev] as [RepositoryName]
participant DB as Database          %% BẮT BUỘC có
```

**2. Message Numbering:**
- Đánh số thứ tự liên tục trước mỗi message: `1.`, `2.`, `3....`
- Số bắt đầu từ 1, liên tục đến hết sequence
- **KHÔNG dùng `autonumber`**

**3. Database Actions:**
Khi Repository gọi Database, ghi rõ hành động thực hiện (thay vì câu SQL cụ thể):
```
Check if user exists by email
Save new user record
Update user profile status
Soft delete user record
```

**4. Activation Boxes:**
- Mỗi `activate` phải có `deactivate` tương ứng
- Activate khi bắt đầu xử lý, deactivate khi trả về

**5. Arrow Types:**
| Arrow | Meaning |
|-------|---------|
| `->>` | Synchronous request (gọi method) |
| `-->>` | Response (trả về kết quả) |
| `->` | Async message (không đợi response) |

**6. Flow Pattern chuẩn:**
```
User → UI → Controller → Service → Repository → Database
(Response ngược lại cùng thứ tự)
```

**7. Error Handling:** Dùng `alt`/`else` block cho success/error cases

**8. Naming Convention viết tắt:**
| Abbreviation | Full Name |
|--------------|-----------|
| AC | AuthController |
| AS | AuthService |
| UR | UserRepository |
| CR | ClinicRepository |
| DB | Database |
| ES | EmailService |
| JTP | JwtTokenProvider |

**9. Role Abbreviations:**
| Abbrev | Role |
|--------|------|
| PO | Pet Owner |
| V | Staff |
| CM | Clinic Manager |
| CO | Clinic Owner |
| A | Admin |

---

**Complete Example - Delete Flow with alt/else + activate/deactivate:**

```mermaid
sequenceDiagram
    actor CM as Clinic Manager
    participant UI as Manager Dashboard (Web)
    participant C as StaffShiftController
    participant S as StaffShiftService
    participant R as StaffShiftRepository
    participant DB as Database

    CM->>UI: 1. Select the staff shift to delete
    UI->>C: 2. DELETE /api/v1/shifts/{shiftId}
    activate C
    C->>S: 3. deleteShift(shiftId)
    activate S
    S->>R: 4. findById(id)
    activate R
    R->>DB: 5. Find staff shift record by ID
    
    alt [Staff Shift does not exist]
        DB-->>R: 6. Return null
        deactivate R
        R-->>S: 7. Optional.empty()
        S-->>C: 8. Throw NotFoundException
        deactivate S
        C-->>UI: 9. HTTP 404 Not Found
        deactivate C
        UI-->>CM: 10. Display error "Staff shift not found"
    else [Staff Shift exists]
        DB-->>R: 6. Return staff shift record
        deactivate R
        R-->>S: 7. StaffShift Entity
        S->>R: 8. softDelete(staffShift)
        activate R
        R->>DB: 9. Update deleted status to true
        DB-->>R: 10. Return success
        deactivate R
        R-->>S: 11. Success
        deactivate S
        S-->>C: 12. void
        C-->>UI: 13. HTTP 200 OK
        deactivate C
        UI-->>CM: 14. Display success "Delete vet shift success"
    end
```

---

## 2. DATABASE DESIGN

Petties uses a **Polyglot Persistence** architecture with multiple database types serving different purposes:

| Database | Type | Use Case | Tables/Collections |
|----------|------|----------|-------------------|
| **PostgreSQL 16** (Backend) | Relational (RDBMS) | Structured data with strict relationships | 21 tables |
| **PostgreSQL 16** (AI Service) | Relational (RDBMS) | Agent configuration, tool governance, RAG metadata | 5 tables |
| **MongoDB 7** | Document (NoSQL) | Flexible, nested, schema-less data, AI chat history | 6 collections |

---

### 2.1 Relational Database Design (PostgreSQL)

PostgreSQL is used as the primary relational database for both Spring Boot Backend and AI Agent Service, providing foreign keys, ACID transactions, and complex queries.

> **Database Architecture:**
> - **Shared PostgreSQL Instance**: Both services connect to the same PostgreSQL server
> - **Separate Schemas (optional)**: AI Service tables can use separate schema or logical naming for operational isolation
> - **Total Tables in Current Codebase**: 26 tables (21 Backend + 5 AI Service)

#### 2.1.0 Presentation Notes

Phần này có thể dùng trực tiếp khi thuyết trình Database Design trong buổi báo cáo.

**Talking Script - PostgreSQL Overview:**

"Trong Petties, PostgreSQL là lớp dữ liệu quan hệ trung tâm cho toàn bộ nghiệp vụ chính. Hiện tại hệ thống có 26 bảng PostgreSQL, trong đó 21 bảng phục vụ backend Spring Boot và 5 bảng phục vụ AI service. Chúng tôi chọn PostgreSQL vì cần tính toàn vẹn dữ liệu, ràng buộc khóa ngoại, và khả năng xử lý tốt các nghiệp vụ booking, phân ca, thanh toán và cấu hình hệ thống."

"Ở backend nghiệp vụ, nhóm bảng quan trọng nhất gồm User, Clinic, Pet, StaffShift, Slot, Booking, BookingService, Payment và Review. Các bảng này tạo thành luồng dữ liệu xuyên suốt từ lúc người dùng đăng ký tài khoản, tạo hồ sơ thú cưng, tìm phòng khám, đặt lịch, phân công nhân sự, đến thanh toán và đánh giá sau dịch vụ."

"Một điểm quan trọng trong thiết kế là chúng tôi tách booking thành nhiều lớp dữ liệu. Bảng Booking lưu thông tin lịch hẹn tổng thể, bảng booking_services lưu từng dịch vụ cụ thể trong lịch hẹn, còn bảng booking_slots quản lý các slot thời gian thực sự bị chiếm dụng. Cách tách này giúp hệ thống hỗ trợ nhiều dịch vụ trong một booking, nhiều slot cho một booking, và dễ mở rộng cho các luồng như home visit hoặc SOS."

"Ngoài ra, module dịch vụ cũng được chuẩn hóa khá rõ. Chúng tôi có master_services làm template dùng chung, clinic_services là dịch vụ thực tế của từng phòng khám, service_weight_prices cho giá theo cân nặng, và vaccine_templates cùng vaccine_dose_prices cho nghiệp vụ tiêm chủng. Nhờ vậy, hệ thống vừa tái sử dụng được cấu hình chung, vừa cho phép từng phòng khám tùy biến dịch vụ riêng."

"For the AI service, PostgreSQL is used for governance data such as agents, tools, knowledge_documents, disease normalization tables, and system_settings. AI chat runtime data is intentionally stored in MongoDB, while vector search and case memory are stored in Qdrant. This separation mirrors the current codebase and keeps the data model aligned with runtime behavior."

**Talking Script - Key Design Rationale:**

"Về mặt thiết kế, chúng tôi chia PostgreSQL thành ba lớp logic. Lớp thứ nhất là dữ liệu lõi nghiệp vụ như user, clinic, pet, booking. Lớp thứ hai là dữ liệu cấu hình và pricing như master service, clinic service, vaccine template. Lớp thứ ba là dữ liệu hỗ trợ vận hành như notification, chat auto reply setting và AI system settings. Cách phân tách này giúp tài liệu, code và database dễ bảo trì hơn khi hệ thống mở rộng."

"Một điểm nữa là phần quan hệ được thiết kế theo hướng bám sát nghiệp vụ thực tế. Ví dụ một clinic có nhiều staff shift, một shift có nhiều slot, một booking có nhiều service và nhiều slot, còn một payment gắn 1-1 với một booking. Các cardinality này giúp hệ thống kiểm soát rõ dữ liệu và giảm rủi ro inconsistency khi xử lý booking đồng thời."

#### 2.1.1 Entity Relationship Diagram (Conceptual)

> **Lưu ý:** ERD ở mức Conceptual tập trung vào **dữ liệu** và **quan hệ** giữa các đối tượng trong hệ thống, không đi sâu vào chi tiết database design (columns, types, constraints).

##### A. Core Business Entities

| Entity | Description | Key Relationships |
|--------|-------------|-------------------|
| **User** | System user across all roles | 1 User -> N Pets, N Bookings, N Notifications, N Reports, N Subscriptions |
| **Pet** | Pet profile registered in the platform | 1 Pet -> N Bookings, N EMRs, N Vaccination Records |
| **Clinic** | Approved veterinary clinic | 1 Clinic -> N Services, N Staff Shifts, N Bookings, N Reports |
| **ClinicService** | Clinic-specific service offering | 1 Service -> N BookingServiceItems, N Weight Prices, N VaccineDosePrices |
| **VaccineTemplate** | Vaccination template and reminder rule | 1 Template -> N Clinic Services |
| **Booking** | Appointment / home-visit / SOS booking | 1 Booking -> 1 Pet, 1 Clinic, N Services, N Slots, 1 Payment, 0..N RefundApplications |
| **RefundApplication** | Refund workflow for disputed or cancelled bookings | N RefundApplications -> 1 Booking, 1 Clinic |
| **Report** | Incident report raised by users | N Reports -> 1 Booking, 1 User, 1 Clinic |
| **UserSubscription** | Purchased AI subscription plan | N Subscriptions -> 1 User, 1 Plan |
| **Voucher** | Voucher definition and discount rules | N ClinicVouchers -> 1 Voucher |
| **ChatAutoReplySetting** | Clinic auto-reply configuration | N Settings -> 1 Clinic |
| **EMRRecord** | Electronic medical record (MongoDB) | 1 EMR -> 1 Pet, 1 Staff, 1 Booking (optional) |
| **VaccinationRecord** | Vaccination history (MongoDB) | 1 Record -> 1 Pet, 1 Staff |
| **ChatConversation** | Pet Owner <-> Clinic thread (MongoDB) | 1 Conversation -> N Messages |
| **Agent** | Single-agent AI runtime configuration | 1 Agent -> N AI Chat Sessions (logical, MongoDB runtime) |
| **Tool** | FastMCP tool registry metadata | Governed independently in PostgreSQL; enabled by runtime policy |
| **KnowledgeDocument** | RAG document metadata | Metadata in PostgreSQL, vectors in Qdrant |
| **DiseaseCatalog** | Canonical disease taxonomy | 1 DiseaseCatalog -> N DiseaseAliases |
| **SystemSetting** | Runtime AI provider/settings registry | Standalone configuration table for API keys and defaults |

##### B. Entity Relationships Diagram (ERD)

```mermaid
erDiagram
    USER ||--o{ REFRESH_TOKEN : has
    USER ||--o{ BLACKLISTED_TOKEN : invalidates
    USER ||--o{ PET : owns
    USER ||--o{ BOOKING : books
    USER ||--o{ BOOKING : proxies
    USER }o--|| CLINIC : works_at
    USER ||--o{ STAFF_SHIFT : works
    USER ||--o{ NOTIFICATION : receives
    USER ||--o{ REPORT : files
    USER ||--o{ USER_SUBSCRIPTION : purchases

    CLINIC ||--o{ CLINIC_IMAGE : has_images
    CLINIC ||--o| CLINIC_PRICE_PER_KM : has_pricing
    CLINIC ||--o{ CLINIC_SERVICE : offers
    CLINIC ||--o{ STAFF_SHIFT : schedules
    CLINIC ||--o{ BOOKING : receives
    CLINIC ||--o{ REPORT : receives_report
    CLINIC ||--o{ CHAT_AUTO_REPLY_SETTING : configures
    CLINIC ||--o{ CLINIC_VOUCHER : activates
    CLINIC ||--o| CLINIC_BALANCE : has_balance
    CLINIC ||--o{ WITHDRAWAL : requests

    MASTER_SERVICE ||--o{ CLINIC_SERVICE : defines
    MASTER_SERVICE ||--o{ SERVICE_WEIGHT_PRICE : has_default_tiers
    VACCINE_TEMPLATE ||--o{ CLINIC_SERVICE : linked_to
    CLINIC_SERVICE ||--o{ SERVICE_WEIGHT_PRICE : has_weight_tiers
    CLINIC_SERVICE ||--o{ VACCINE_DOSE_PRICE : has_dose_prices

    PET ||--o{ BOOKING : has
    PET ||--o{ EMR_RECORD : has
    PET ||--o{ VACCINATION_RECORD : receives

    STAFF_SHIFT ||--|{ SLOT : contains

    BOOKING ||--|{ BOOKING_SERVICE : contains
    BOOKING ||--|{ BOOKING_SLOT : reserves
    BOOKING ||--|| PAYMENT : has
    BOOKING ||--o{ REFUND_APPLICATION : receives
    BOOKING ||--o{ REPORT : may_trigger
    BOOKING ||--o| EMR_RECORD : generates
    BOOKING_SERVICE }|--|| CLINIC_SERVICE : references
    BOOKING_SERVICE }o--o| USER : assigned_staff
    BOOKING_SLOT }|--|| SLOT : links
    BOOKING_SLOT }o--o| BOOKING_SERVICE : for_service

    SUBSCRIPTION_PLAN ||--o{ USER_SUBSCRIPTION : defines
    VOUCHER ||--o{ CLINIC_VOUCHER : is_enabled_as

    DISEASE_CATALOG ||--o{ DISEASE_ALIAS : maps_aliases

    CHAT_CONVERSATION ||--o{ CHAT_MESSAGE : contains

    %% AI runtime chat history is stored in MongoDB, not PostgreSQL.
    %% Tools are standalone registry rows; no assigned_agents JSON relation is active.
```

##### C. Entity Groups by Domain

| Domain | Entities | Purpose |
|--------|----------|---------|
| **User Management** | User, RefreshToken, BlacklistedToken | Users, authentication, authorization |
| **Pet Health** | Pet, EMRRecord (MongoDB), VaccinationRecord (MongoDB) | Pet profile and medical history |
| **Clinic Operations** | Clinic, ClinicImage, ClinicPricePerKm, ChatAutoReplySetting, ClinicBalance, Withdrawal | Clinic setup, operations, finance, chat automation |
| **Services & Pricing** | MasterService, ClinicService, ServiceWeightPrice, VaccineTemplate, VaccineDosePrice, Voucher, ClinicVoucher | Service catalog, pricing, vaccination templates, promotions |
| **Scheduling** | StaffShift, Slot | Staff schedules and time-slot inventory |
| **Booking & Revenue** | Booking, BookingServiceItem, BookingSlot, Payment, RefundApplication, Report | Appointments, payments, refund processing, incident governance |
| **Subscriptions & Governance** | SubscriptionPlan, UserSubscription, ClinicStrikeConfig, UserStrikeConfig | AI subscription lifecycle and strike policies |
| **Notifications** | Notification | System notifications |
| **Communication** | ChatConversation (Mongo), ChatMessage (Mongo) | Direct chat between pet owner and clinic |
| **AI Service** | Agent, Tool, KnowledgeDocument, DiseaseCatalog, DiseaseAlias, DiseaseMappingReviewItem, SystemSetting, AIChatSession (Mongo), AIChatMessage (Mongo), AIProactiveNotification (Mongo), ChatFeedback (Mongo), KnowledgeGraphTriplet (Mongo) | Single-agent governance, diagnosis normalization, RAG, and AI runtime telemetry |

##### D. Detailed ERD (Database Design)

> **Note:** The detailed ERD is generated from the canonical PostgreSQL DBML artifact.
> DBML source code: [`docs-references/database/PETTIES_DBML.dbml`](../../database/PETTIES_DBML.dbml)
> Current DBML scope: PostgreSQL only (30 Spring Boot tables + 7 AI service tables). MongoDB and Qdrant are documented separately in Sections 2.2 and 2.3.

**Instructions to generate Detailed ERD:**
1. Visit https://dbdiagram.io/
2. Copy content from `PETTIES_DBML.dbml`
3. Paste into editor
4. Export PNG/PDF

```
[Detailed ERD Diagram - Paste screenshot from dbdiagram.io here]
```
#### 2.1.2 Table Groups

##### Spring Boot Backend Tables (30 tables)

| Group | Tables | Description |
|-------|--------|-------------|
| **Auth & User** | users, refresh_tokens, blacklisted_tokens | User management and authentication |
| **Pet** | pets | Pet profiles |
| **Clinic** | clinics, clinic_images, clinic_price_per_km | Clinic management and distance pricing |
| **Services** | master_services, clinic_services, service_weight_prices, vaccine_templates, vaccine_dose_prices | Services, pricing, and vaccination master data |
| **Scheduling** | staff_shifts, slots | Staff work schedules |
| **Booking & Payment** | bookings, booking_services, booking_slots, payments, refund_applications, clinic_balances, withdrawals | Appointments, payments, refunds, clinic finance |
| **Commercial & Governance** | reports, subscription_plans, user_subscriptions, vouchers, clinic_vouchers, clinic_strike_config, user_strike_config | Incident governance, subscriptions, vouchers, strike policies |
| **Operations** | notifications, chat_auto_reply_settings | System notifications and clinic chat automation |

##### AI Agent Service Tables (7 tables)

| Group | Tables | Description |
|-------|--------|-------------|
| **Agent Runtime** | agents, tools | Single-agent runtime parameters and tool registry |
| **Knowledge Base** | knowledge_documents | RAG document metadata |
| **Diagnosis Normalization** | disease_catalog, disease_aliases | Canonical disease taxonomy and active alias registry |
| **Settings** | system_settings | API keys and runtime/provider configuration |

##### AI Agent Service Relationship Notes

| Relationship | Type | Source of Truth | Presentation Guidance |
|-------------|------|-----------------|-----------------------|
| `disease_aliases.canonical_code -> disease_catalog.canonical_code` | Physical FK | SQLAlchemy model + Alembic migration | Show as solid FK relation in ERD |
| `agents`, `tools`, `knowledge_documents`, `system_settings` | Standalone governance tables | SQLAlchemy model | Show as independent administrative tables |
| `ai_chat_sessions.user_id` -> Spring `users.user_id` | Logical cross-database reference | MongoDB runtime document | Document as logical reference, not FK |
| `ai_chat_messages.session_id` -> `ai_chat_sessions._id` | Logical document relation | MongoDB runtime document | Keep in MongoDB documentation, not PostgreSQL ERD |

#### 2.1.3 Table Descriptions
#### 2.1.3 Table Descriptions

##### 2.1.3.1 Spring Boot Backend Tables

###### Auth & User Tables

**Table: users**

**Description:** Stores all user accounts with different roles (Pet Owner, Staff, Clinic Manager, Clinic Owner, Admin). Supports soft delete for data retention.

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| user_id | UUID | PK | Primary Key |
| username | VARCHAR(50) | UNIQUE, NOT NULL | Login username |
| password | VARCHAR(255) | NOT NULL | Password (hashed) |
| phone | VARCHAR(20) | UNIQUE | Phone number |
| email | VARCHAR(100) | UNIQUE, NOT NULL | Email address |
| full_name | VARCHAR(100) | | Full name |
| avatar | VARCHAR(500) | | Avatar URL (Cloudinary) |
| avatar_public_id | VARCHAR(100) | | Cloudinary public ID |
| role | ENUM | NOT NULL | PET_OWNER, STAFF, CLINIC_MANAGER, CLINIC_OWNER, ADMIN |
| specialty | ENUM | | MEDICAL, GROOMER |
| rating_avg | DECIMAL(2,1) | DEFAULT 0.0 | Average rating |
| rating_count | INT | DEFAULT 0 | Number of ratings |
| fcm_token | VARCHAR(500) | | Firebase Cloud Messaging token |
| address | VARCHAR(500) | | Default address (Pet Owner) |
| working_clinic_id | UUID | FK→clinics | Working clinic |
| created_at | TIMESTAMP | DEFAULT now() | Created date |
| updated_at | TIMESTAMP | DEFAULT now() | Updated date |
| deleted_at | TIMESTAMP | | Soft delete timestamp |

**Table: refresh_tokens**

**Description:** JWT refresh tokens for multi-device authentication. Allows users to stay logged in across sessions without re-entering credentials.

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| token_id | UUID | PK | Primary Key |
| user_id | UUID | FK→users, NOT NULL | Token owner |
| token_hash | VARCHAR(255) | UNIQUE, NOT NULL | Refresh token hash |
| expires_at | TIMESTAMP | NOT NULL | Expiration time |
| created_at | TIMESTAMP | DEFAULT now() | Created date |

**Table: blacklisted_tokens**

**Description:** Invalidated tokens after logout to prevent reuse until expiration. Ensures security when users explicitly log out.

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| token_id | UUID | PK | Primary Key |
| token_hash | VARCHAR(255) | UNIQUE, NOT NULL | Blacklisted token hash |
| user_id | UUID | NOT NULL | Token owner |
| expires_at | TIMESTAMP | NOT NULL | Expiration time |
| created_at | TIMESTAMP | DEFAULT now() | Created date |

###### Pet Table

**Table: pets**

**Description:** Pet profiles belonging to Pet Owners. Contains medical information like allergies, weight, and species for veterinary services.

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| pet_id | UUID | PK | Primary Key |
| user_id | UUID | FK→users, NOT NULL | Owner (Pet Owner) |
| name | VARCHAR(255) | NOT NULL | Pet name |
| species | ENUM | NOT NULL | DOG, CAT, BIRD, RABBIT, HAMSTER, FISH, OTHER |
| breed | VARCHAR(255) | NOT NULL | Breed |
| date_of_birth | DATE | NOT NULL | Birth date |
| weight | DECIMAL(10,2) | NOT NULL | Weight (kg) |
| gender | VARCHAR(50) | NOT NULL | Gender |
| color | VARCHAR(100) | | Fur color |
| allergies | TEXT | | Allergies (if any) |
| image_url | VARCHAR(500) | | Pet image |
| image_public_id | VARCHAR(100) | | Cloudinary public ID |
| created_at | TIMESTAMP | NOT NULL | Created date |
| updated_at | TIMESTAMP | | Updated date |
| deleted_at | TIMESTAMP | | Soft delete timestamp |

###### Clinic Tables

**Table: clinics**

**Description:** Veterinary clinic profiles registered by Clinic Owners. Requires admin approval before becoming visible to users. Supports soft delete for data retention.

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| clinic_id | UUID | PK | Primary Key |
| owner_id | UUID | FK→users, NOT NULL | Clinic owner |
| name | VARCHAR(200) | NOT NULL | Clinic name |
| description | TEXT | | Description |
| address | VARCHAR(500) | NOT NULL | Full address |
| ward | VARCHAR(100) | | Ward |
| district | VARCHAR(100) | | District |
| province | VARCHAR(100) | | Province/City |
| specific_location | VARCHAR(200) | | Specific location |
| phone | VARCHAR(20) | NOT NULL | Phone number |
| email | VARCHAR(100) | | Contact email |
| bank_name | VARCHAR(100) | | Bank name for payments |
| account_number | VARCHAR(50) | | Bank account number |
| latitude | DECIMAL(10,8) | | Latitude |
| longitude | DECIMAL(11,8) | | Longitude |
| logo | VARCHAR(500) | | Logo URL |
| business_license_url | VARCHAR(500) | | Business license URL |
| operating_hours | JSONB | | Operating hours (JSON) |
| status | ENUM | NOT NULL, DEFAULT 'PENDING' | PENDING, APPROVED, REJECTED, SUSPENDED |
| rejection_reason | TEXT | | Rejection reason |
| rating_avg | DECIMAL(2,1) | DEFAULT 0.0 | Rating score |
| rating_count | INT | DEFAULT 0 | Number of ratings |
| approved_at | TIMESTAMP | | Approval date |
| created_at | TIMESTAMP | NOT NULL | Created date |
| updated_at | TIMESTAMP | | Updated date |
| deleted_at | TIMESTAMP | | Soft delete |
| version | BIGINT | DEFAULT 0 | Optimistic locking |

**operating_hours JSONB Structure:**
```json
{
  "monday": {"open_time": "08:00", "close_time": "18:00", "break_start": "12:00", "break_end": "13:00", "is_closed": false},
  "tuesday": {...},
  "sunday": {"is_closed": true}
}
```

**Table: clinic_images**

**Description:** Gallery images for clinic profiles with ordering support. Clinics can upload multiple images to showcase their facilities.

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| image_id | UUID | PK | Primary Key |
| clinic_id | UUID | FK→clinics, NOT NULL | Clinic |
| image_url | VARCHAR(500) | NOT NULL | Image URL |
| caption | VARCHAR(200) | | Image caption |
| display_order | INT | DEFAULT 0 | Display order |
| is_primary | BOOLEAN | DEFAULT false | Primary image |
| created_at | TIMESTAMP | DEFAULT now() | Created date |

**Table: clinic_price_per_km**

**Description:** Travel pricing for Home Visit services. One-to-one relationship with clinics. Used to calculate distance-based fees.

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| clinic_id | UUID | PK, FK→clinics | 1:1 with clinics (@MapsId) |
| price_per_km | DECIMAL(12,2) | | Travel price per km |
| sos_fee | DECIMAL(12,2) | | Additional SOS travel fee |
| version | BIGINT | NOT NULL, DEFAULT 0 | Optimistic locking |
| created_at | TIMESTAMP | | Created date |
| updated_at | TIMESTAMP | | Updated date |

###### Service Tables

**Table: master_services**

**Description:** Service templates created by Clinic Owner, inherited by individual clinic services. Defines default pricing, duration, and categories.

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| master_service_id | UUID | PK | Primary Key |
| name | VARCHAR(200) | NOT NULL | Service name |
| description | TEXT | | Description |
| default_price | DECIMAL(19,2) | | Default price |
| duration_time | INT | | Duration (minutes) |
| slots_required | INT | DEFAULT 1 | Required slots |
| is_home_visit | BOOLEAN | DEFAULT false | Supports Home Visit |
| default_price_per_km | DECIMAL(19,2) | | Default price/km |
| service_category | VARCHAR(100) | | Category |
| pet_type | VARCHAR(100) | | Pet type (Dog, Cat, All) |
| icon | VARCHAR(100) | | Icon identifier |
| created_at | TIMESTAMP | DEFAULT now() | Created date |
| updated_at | TIMESTAMP | DEFAULT now() | Updated date |

**Table: clinic_services**

**Description:** Actual services offered by clinics, either inherited from master_services or custom created. Clinics can customize pricing and availability.

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| service_id | UUID | PK | Primary Key |
| clinic_id | UUID | FK→clinics, NOT NULL | Clinic |
| master_service_id | UUID | FK→master_services | Template (nullable) |
| is_custom | BOOLEAN | DEFAULT true | true=Custom, false=Inherited |
| name | VARCHAR(200) | NOT NULL | Service name |
| description | TEXT | | Description |
| base_price | DECIMAL(19,2) | NOT NULL | Base price |
| duration_time | INT | NOT NULL | Duration (minutes) |
| slots_required | INT | NOT NULL | Required slots |
| is_active | BOOLEAN | DEFAULT true | Is active |
| is_home_visit | BOOLEAN | DEFAULT false | Supports Home Visit |
| service_category | ENUM | | GROOMING_SPA, VACCINATION, CHECK_UP, SURGERY, DENTAL, DERMATOLOGY, OTHER |
| pet_type | VARCHAR(100) | | Pet type |
| reminder_interval | INT | | Reminder amount before due date |
| reminder_unit | VARCHAR(50) | | Reminder unit (DAYS, WEEKS, MONTHS, YEARS) |
| vaccine_template_id | UUID | FK→vaccine_templates | Linked vaccine template when service is vaccination |
| created_at | TIMESTAMP | NOT NULL | Created date |
| updated_at | TIMESTAMP | | Updated date |
| version | BIGINT | DEFAULT 0 | Optimistic locking |

**Table: vaccine_templates**

**Description:** Vaccine master data used for clinic vaccination services and scheduling reminders.

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| vaccine_template_id | UUID | PK | Primary Key |
| name | VARCHAR(100) | NOT NULL | Vaccine name |
| manufacturer | VARCHAR(100) | | Manufacturer |
| description | TEXT | | Description |
| default_price | DECIMAL(19,2) | | Suggested default price |
| min_age_weeks | INT | | Minimum age in weeks |
| repeat_interval_days | INT | | Suggested repeat interval |
| series_doses | INT | | Number of doses in series |
| is_annual_repeat | BOOLEAN | DEFAULT false | Annual booster flag |
| min_interval_days | INT | | Minimum interval between doses |
| target_species | ENUM | NOT NULL | Target species |
| created_at | TIMESTAMP | DEFAULT now() | Created date |
| updated_at | TIMESTAMP | DEFAULT now() | Updated date |

**Table: vaccine_dose_prices**

**Description:** Price breakdown by dose number for vaccination services.

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| id | UUID | PK | Primary Key |
| service_id | UUID | FK→clinic_services, NOT NULL | Vaccination service |
| dose_number | INT | NOT NULL | Dose order in series |
| dose_label | VARCHAR(100) | | Human-readable label |
| price | DECIMAL(19,2) | NOT NULL | Dose price |
| is_active | BOOLEAN | DEFAULT true | Is active |
| created_at | TIMESTAMP | DEFAULT now() | Created date |
| updated_at | TIMESTAMP | DEFAULT now() | Updated date |

**Table: service_weight_prices**

**Description:** Weight-based pricing tiers for services (e.g., grooming costs more for larger pets). Links to either clinic services or master services.

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| weight_price_id | UUID | PK | Primary Key |
| service_id | UUID | FK→clinic_services | Clinic service (nullable) |
| master_service_id | UUID | FK→master_services | Master template (nullable) |
| min_weight | DECIMAL(10,2) | NOT NULL | Minimum weight (kg) |
| max_weight | DECIMAL(10,2) | NOT NULL | Maximum weight (kg) |
| price | DECIMAL(19,2) | NOT NULL | Price for weight range |
| created_at | TIMESTAMP | DEFAULT now() | Created date |
| updated_at | TIMESTAMP | DEFAULT now() | Updated date |

###### Scheduling Tables

**Table: staff_shifts**

**Description:** Work schedules for staff at specific clinics. Auto-generates 30-minute slots for booking. Supports overnight shifts and break times.

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| shift_id | UUID | PK | Primary Key |
| staff_id | UUID | FK→users, NOT NULL | Staff member |
| clinic_id | UUID | FK→clinics, NOT NULL | Clinic |
| work_date | DATE | NOT NULL | Work date |
| start_time | TIME | NOT NULL | Shift start time |
| end_time | TIME | NOT NULL | Shift end time |
| break_start | TIME | | Lunch break start |
| break_end | TIME | | Lunch break end |
| is_overnight | BOOLEAN | DEFAULT false | Overnight shift flag |
| notes | VARCHAR(500) | | Notes |
| created_at | TIMESTAMP | DEFAULT now() | Created date |
| updated_at | TIMESTAMP | DEFAULT now() | Updated date |

**Table: slots**

**Description:** 30-minute time blocks auto-generated from staff_shifts. Used for booking appointments. Status tracks availability.

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| slot_id | UUID | PK | Primary Key |
| shift_id | UUID | FK→staff_shifts, NOT NULL | Parent shift |
| start_time | TIME | NOT NULL | Slot start time |
| end_time | TIME | NOT NULL | Slot end time |
| status | ENUM | NOT NULL, DEFAULT 'AVAILABLE' | AVAILABLE, BOOKED, BLOCKED |
| created_at | TIMESTAMP | DEFAULT now() | Created date |
| updated_at | TIMESTAMP | DEFAULT now() | Updated date |

###### Booking Tables

**Table: bookings**

**Description:** Appointment records connecting pets, pet owners, clinics, and optional assigned staff. Core booking entity supporting IN_CLINIC, HOME_VISIT, and SOS types.

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| booking_id | UUID | PK | Primary Key |
| version | BIGINT | | Optimistic locking |
| booking_code | VARCHAR(20) | UNIQUE, NOT NULL | Booking code (BK-YYYYMMDD-XXXX) |
| pet_id | UUID | FK→pets, NOT NULL | Pet being treated |
| pet_owner_id | UUID | FK→users, NOT NULL | Pet owner |
| clinic_id | UUID | FK→clinics | Target clinic (nullable while SOS is SEARCHING) |
| assigned_staff_id | UUID | FK→users | Assigned staff |
| proxy_booker_id | UUID | FK→users | Staff who created booking on behalf of pet owner (NULL if self-booked) |
| booking_date | DATE | NOT NULL | Appointment date |
| booking_time | TIME | NOT NULL | Appointment time |
| type | ENUM | NOT NULL | IN_CLINIC, HOME_VISIT, SOS |
| home_address | VARCHAR(500) | | Address (Home Visit/SOS only) |
| home_lat | DECIMAL(10,7) | | Home latitude |
| home_long | DECIMAL(10,7) | | Home longitude |
| distance_km | DECIMAL(5,2) | | Distance in km |
| distance_fee | DECIMAL(12,2) | | Travel fee |
| sos_fee | DECIMAL(12,2) | | SOS emergency surcharge |
| total_price | DECIMAL(12,2) | NOT NULL | Total price |
| status | ENUM | NOT NULL, DEFAULT 'PENDING' | (See State Machine below) |
| cancellation_reason | VARCHAR(255) | | Cancellation reason |
| cancelled_by | UUID | | Cancelled by user |
| notes | TEXT | | Notes |
| symptoms | TEXT | | Symptom description (SOS bookings) |
| confirmed_at | TIMESTAMP | | When clinic confirmed the booking |
| arrived_at | TIMESTAMP | | When staff arrived (Home Visit/SOS) |
| created_at | TIMESTAMP | | Created date |

**Booking Status State Machine (persisted in DB):**
```
PENDING → CONFIRMED → IN_PROGRESS → COMPLETED
PENDING → SEARCHING → PENDING_CLINIC_CONFIRM → CONFIRMED
```
Alternative persisted paths: CANCELLED, NO_SHOW

**Table: booking_services**

**Description:** Junction table linking bookings to specific clinic services (Many-to-Many). Captures price snapshot at booking time for historical accuracy.

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| booking_service_id | UUID | PK | Primary Key |
| booking_id | UUID | FK→bookings, NOT NULL | Parent booking |
| pet_id | UUID | FK→pets | Pet receiving the service |
| service_id | UUID | FK→clinic_services, NOT NULL | Clinic service |
| assigned_staff_id | UUID | FK→users | Staff assigned to this service |
| unit_price | DECIMAL(12,2) | | Price snapshot at booking time |
| base_price | DECIMAL(12,2) | | Base price |
| weight_price | DECIMAL(12,2) | | Weight-based price |
| quantity | INT | DEFAULT 1 | Quantity |
| is_add_on | BOOLEAN | DEFAULT false | Arising/add-on service flag |
| created_at | TIMESTAMP | DEFAULT now() | Created date |

**Table: booking_slots**

**Description:** Junction table linking bookings to specific time slots (Many-to-Many). Allows services to occupy multiple consecutive slots.

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| booking_slot_id | UUID | PK | Primary Key |
| booking_id | UUID | FK→bookings, NOT NULL | Parent booking |
| slot_id | UUID | FK→slots, NOT NULL | Reserved slot |
| booking_service_id | UUID | FK→booking_services | Associated service item |
| created_at | TIMESTAMP | DEFAULT now() | Created date |

**Table: payments**

**Description:** Payment records with 1:1 relationship to bookings. Supports multiple payment methods (CASH, QR, CARD) with Stripe integration.

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| payment_id | UUID | PK | Primary Key |
| booking_id | UUID | FK→bookings, UNIQUE, NOT NULL | 1:1 with Booking |
| amount | DECIMAL(12,2) | NOT NULL | Payment amount |
| payment_description | VARCHAR(100) | | Payment description |
| method | ENUM | NOT NULL | CASH, QR, CARD |
| status | ENUM | NOT NULL, DEFAULT 'PENDING' | PENDING, PAID, REFUNDED, FAILED |
| stripe_payment_id | VARCHAR(255) | | Stripe transaction ID |
| paid_at | TIMESTAMP | | Payment timestamp |
| created_at | TIMESTAMP | | Created date |

###### Notification Table

**Table: notifications**

**Description:** In-app notifications for users about clinic approvals, shift assignments, booking updates, and medical reminders. Supports read/unread status.

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| notification_id | UUID | PK | Primary Key |
| user_id | UUID | FK→users, NOT NULL | Notification recipient |
| clinic_id | UUID | FK→clinics | Related clinic (optional) |
| shift_id | UUID | FK→staff_shifts | Related shift (optional) |
| type | ENUM | NOT NULL | (See Notification Types) |
| emr_id | VARCHAR(50) | | MongoDB ObjectId |
| message | TEXT | NOT NULL | Notification content |
| reason | TEXT | | Reason (for rejection) |
| read | BOOLEAN | DEFAULT false | Read status |
| action_type | VARCHAR(100) | | Action type (e.g., QUICK_BOOKING, INFO_ONLY) |
| action_data | TEXT | | JSON payload for action buttons |
| created_at | TIMESTAMP | NOT NULL | Created date |

**Notification Types:**
- Clinic: APPROVED, REJECTED, PENDING, CLINIC_PENDING_APPROVAL, CLINIC_VERIFIED
- StaffShift: STAFF_SHIFT_ASSIGNED, STAFF_SHIFT_UPDATED, STAFF_SHIFT_DELETED
- Booking: BOOKING_CREATED, BOOKING_CONFIRMED, BOOKING_ASSIGNED, BOOKING_CANCELLED, BOOKING_CHECKIN, BOOKING_COMPLETED, STAFF_ON_WAY, STAFF_ARRIVED
- Medical: RE_EXAMINATION_REMINDER, VACCINATION_REMINDER
- DB CHECK only (not yet in JPA enum): BOOKING_REMINDER, SYSTEM, PROMOTION

##### 2.1.3.2 AI Agent Service Tables

###### Table: agents

**Purpose:** Stores the single-agent runtime configuration for Petties AI Assistant. This table controls model selection and generation parameters without storing prompt version history in PostgreSQL.

**Relationship status in current codebase:**
- There is **no `prompt_versions` table** in the active schema.
- There is **no `system_prompt` column** in `agents`; the default system prompt is hardcoded in `app/core/agents/single_agent.py`.
- Tools are managed as standalone registry records, not as child rows of `agents`.

| Column | Type | Constraints | Purpose & Business Context |
|--------|------|-------------|---------------------------|
| id | INT | PK, AUTO_INCREMENT | Auto-increment primary key for internal references |
| name | VARCHAR(100) | UNIQUE, NOT NULL | Unique runtime identifier such as `petties_agent` |
| description | TEXT | | Human-readable description shown in admin tools |
| temperature | FLOAT | DEFAULT 0.7 | Controls response randomness |
| max_tokens | INT | DEFAULT 2000 | Maximum response length limit |
| top_p | FLOAT | DEFAULT 0.9 | Nucleus sampling parameter |
| model | VARCHAR(100) | DEFAULT OpenRouter model ID | Runtime LLM model selection |
| enabled | BOOLEAN | DEFAULT true | Master switch for assistant availability |
| created_at | TIMESTAMPTZ | DEFAULT now() | Creation timestamp |
| updated_at | TIMESTAMPTZ | onupdate=now() | Last modification timestamp |

###### Table: tools

**Purpose:** Stores metadata for code-based tools decorated with `@mcp.tool`. These rows define semantic descriptions and schemas used by the runtime when deciding which tool can be called.

**Relationship status in current codebase:**
- There is **no physical foreign key** from `tools` to `agents`.
- There is **no active `assigned_agents` JSON field** in the current schema.
- Tool availability is governed by scanner/policy/runtime logic, not by relational assignment rows.

| Column | Type | Constraints | Purpose & Business Context |
|--------|------|-------------|---------------------------|
| id | INT | PK, AUTO_INCREMENT | Auto-increment primary key |
| name | VARCHAR(100) | UNIQUE, NOT NULL | Tool identifier matching the Python function name |
| description | TEXT | | Semantic description used by the LLM for tool selection |
| tool_type | ENUM(`tooltype`) | DEFAULT `CODE_BASED` | Distinguishes FastMCP tools from API-based tools |
| input_schema | JSON | | JSON schema describing input parameters |
| output_schema | JSON | | JSON schema describing output structure |
| enabled | BOOLEAN | DEFAULT false | Default registry state before runtime policy enables the tool |
| created_at | TIMESTAMPTZ | DEFAULT now() | Record creation timestamp |
| updated_at | TIMESTAMPTZ | onupdate=now() | Last modification timestamp |

###### Table: knowledge_documents

**Purpose:** Tracks documents uploaded to the RAG knowledge base. PostgreSQL stores metadata while embeddings and searchable payloads live in Qdrant.

| Column | Type | Constraints | Purpose & Business Context |
|--------|------|-------------|---------------------------|
| id | INT | PK, AUTO_INCREMENT | Auto-increment primary key |
| filename | VARCHAR(255) | NOT NULL | Original uploaded filename |
| file_path | VARCHAR(500) | NOT NULL | File storage path |
| file_type | VARCHAR(10) | | File extension used for parsing strategy |
| file_size | INT | | File size in bytes |
| processed | BOOLEAN | DEFAULT false | Whether the file has been chunked and indexed |
| vector_count | INT | DEFAULT 0 | Number of generated text vectors |
| image_count | INT | DEFAULT 0 | Number of generated image vectors |
| uploaded_by | VARCHAR(100) | | Admin username for audit |
| notes | TEXT | | Optional document note |
| uploaded_at | TIMESTAMPTZ | DEFAULT now() | Upload timestamp |
| processed_at | TIMESTAMPTZ | | Processing completion timestamp |

###### Table: disease_catalog

**Purpose:** Stores canonical disease identities used by the AI diagnosis pipeline so KB, KG, EMR, and vision outputs can normalize into the same disease code.

| Column | Type | Constraints | Purpose & Business Context |
|--------|------|-------------|---------------------------|
| id | INT | PK, AUTO_INCREMENT | Internal primary key |
| canonical_code | VARCHAR(100) | UNIQUE, NOT NULL | Canonical disease code shared across diagnosis flows |
| display_name_vi | VARCHAR(255) | NOT NULL | Vietnamese display name for staff-facing diagnosis flows |
| species | VARCHAR(50) | DEFAULT `all` | Species scoping |
| is_active | BOOLEAN | DEFAULT true | Canonical disease activation flag |
| notes | TEXT | | Clinical note or mapping note |
| created_at | TIMESTAMPTZ | DEFAULT now() | Creation timestamp |
| updated_at | TIMESTAMPTZ | onupdate=now() | Last modification timestamp |

###### Table: disease_aliases

**Purpose:** Stores aliases and synonyms that map free-text disease labels back to canonical disease codes.

| Column | Type | Constraints | Purpose & Business Context |
|--------|------|-------------|---------------------------|
| id | INT | PK, AUTO_INCREMENT | Internal primary key |
| canonical_code | VARCHAR(100) | FK -> disease_catalog.canonical_code | Canonical disease link |
| source_type | VARCHAR(50) | NOT NULL | Source of alias such as EMR, KG, KB, or vision |
| alias_text | VARCHAR(255) | NOT NULL | Original alias text |
| normalized_alias | VARCHAR(255) | NOT NULL | Normalized lookup value |
| species | VARCHAR(50) | DEFAULT `all` | Species scoping |
| is_active | BOOLEAN | DEFAULT true | Alias activation flag |
| created_at | TIMESTAMPTZ | DEFAULT now() | Creation timestamp |
| updated_at | TIMESTAMPTZ | onupdate=now() | Last modification timestamp |

###### Table: system_settings

**Purpose:** Stores runtime-configurable settings for the AI service, including provider credentials and vector-store endpoints editable from the admin dashboard.

| Column | Type | Constraints | Purpose & Business Context |
|--------|------|-------------|---------------------------|
| id | INT | PK, AUTO_INCREMENT | Auto-increment primary key |
| key | VARCHAR(100) | UNIQUE, NOT NULL | Unique setting key such as `OPENROUTER_API_KEY` |
| value | TEXT | NOT NULL | Setting value; masked in admin UI when sensitive |
| category | ENUM(`settingcategory`) | DEFAULT `general` | Groups settings by provider or subsystem |
| is_sensitive | BOOLEAN | DEFAULT false | Marks credentials and secrets |
| description | TEXT | | Human-readable admin tooltip |
| created_at | TIMESTAMPTZ | DEFAULT now() | Creation timestamp |
| updated_at | TIMESTAMPTZ | DEFAULT now(), onupdate=now() | Last modification timestamp |

**Setting Categories:**
- `llm`: OpenRouter settings
- `rag`: Shared RAG orchestration settings
- `embeddings`: Embedding provider settings
- `vector_db`: Qdrant settings
- `general`: Generic application settings
- `web_search`: Tavily/web-search provider settings

###### AI Runtime Storage Decision

**Decision:** AI governance state stays in PostgreSQL, conversational runtime state stays in MongoDB, and retrieval/case-memory vectors stay in Qdrant.

**Active storage split:**
- PostgreSQL: `agents`, `tools`, `knowledge_documents`, `disease_catalog`, `disease_aliases`, `system_settings`
- MongoDB: `ai_chat_sessions`, `ai_chat_messages`, `ai_proactive_notifications`, `chat_feedback`, `knowledge_graph_triplets`
- Qdrant: `petties_knowledge_base`, `petties_case_memory_v2`, `petties_kb_images`

###### AI PostgreSQL Relationship Summary

| Source Table | Target Table | Relationship Type | Implemented In Code | Notes |
|-------------|--------------|-------------------|---------------------|-------|
| `disease_aliases` | `disease_catalog` | Physical FK | Yes | `disease_aliases.canonical_code -> disease_catalog.canonical_code` |
| `agents` | - | Standalone | Yes | Single runtime agent row with independent parameters |
| `tools` | - | Standalone | Yes | Tool registry governed by runtime policy |
| `knowledge_documents` | - | Standalone | Yes | RAG metadata table |
| `system_settings` | - | Standalone | Yes | Runtime configuration store |

###### AI Table Description Summary

| Table | Primary Role | Why Separate | Main Users |
|------|--------------|-------------|-----------|
| `agents` | LLM runtime parameters | Keeps model tuning separate from code deploys | Admin, AI service |
| `tools` | Tool registry metadata | Supports runtime tool governance and discovery | Admin, AI service |
| `knowledge_documents` | RAG document metadata | Tracks upload and indexing lifecycle | Admin, AI service |
| `disease_catalog` | Canonical diagnosis dictionary | Normalizes diagnosis outputs across sources | Staff AI diagnosis, AI service |
| `disease_aliases` | Alias normalization layer | Maps free-text disease labels to canonical codes | Staff AI diagnosis, AI service |
| `system_settings` | Runtime secrets and provider configs | Centralized operational configuration | Admin, AI service |

#### 2.1.4 Enum Types Summary
#### 2.1.4 Enum Types Summary

##### Spring Boot Backend Enums

| Enum | Values |
|------|--------|
| **role** | PET_OWNER, STAFF, CLINIC_MANAGER, CLINIC_OWNER, ADMIN |
| **staff_specialty** | MEDICAL, GROOMER |
| **clinic_status** | PENDING, APPROVED, REJECTED, SUSPENDED |
| **booking_type** | IN_CLINIC, HOME_VISIT, SOS |
| **booking_status** | PENDING, SEARCHING, PENDING_CLINIC_CONFIRM, CONFIRMED, IN_PROGRESS, COMPLETED, CANCELLED, NO_SHOW |
| **slot_status** | AVAILABLE, BOOKED, BLOCKED |
| **service_category** | GROOMING_SPA, VACCINATION, CHECK_UP, SURGERY, DENTAL, DERMATOLOGY, OTHER |
| **payment_method** | CASH, QR, CARD |
| **payment_status** | PENDING, PAID, REFUNDED, FAILED |
| **notification_type** | APPROVED, REJECTED, PENDING, CLINIC_PENDING_APPROVAL, STAFF_SHIFT_ASSIGNED, STAFF_SHIFT_UPDATED, STAFF_SHIFT_DELETED, BOOKING_CREATED, BOOKING_CONFIRMED, BOOKING_CANCELLED, BOOKING_CHECKIN, BOOKING_COMPLETED, STAFF_ON_WAY, STAFF_ARRIVED, BOOKING_ASSIGNED, CLINIC_VERIFIED, RE_EXAMINATION_REMINDER, VACCINATION_REMINDER (+ DB CHECK: BOOKING_REMINDER, SYSTEM, PROMOTION) |
| **pet_species** | DOG, CAT, BIRD, RABBIT, HAMSTER, FISH, OTHER |
| **target_species** | DOG, CAT, BOTH |
| **auto_reply_condition** | OFF_HOURS, ALWAYS |

##### AI Agent Service Enums

| Enum | Values |
|------|--------|
| **tool_type** | CODE_BASED, API_BASED |
| **setting_category** | Stored as VARCHAR in `system_settings.category` (values used in code: llm, rag, embeddings, vector_db, general) |
| **message_role** | Document-level value in MongoDB messages (`user`, `assistant`, `system`, `tool`) |
| **file_type** | Stored as VARCHAR in `knowledge_documents.file_type` (examples: pdf, docx, txt, md) |

#### 2.1.5 Index Strategy

##### Spring Boot Backend Indexes

| Table | Index Name | Columns | Type | Purpose |
|-------|------------|---------|------|---------|
| users | idx_users_email | email | UNIQUE | Email lookup |
| users | idx_users_phone | phone | UNIQUE | Phone lookup |
| users | idx_users_role | role | B-TREE | Role filtering |
| clinics | idx_clinics_status | status | B-TREE | Status filtering |
| clinics | idx_clinics_location | (latitude, longitude) | B-TREE | Geo queries |
| bookings | idx_bookings_code | booking_code | UNIQUE | Code lookup |
| bookings | idx_bookings_status | status | B-TREE | Status filtering |
| bookings | idx_bookings_date | booking_date | B-TREE | Date range queries |
| staff_shifts | idx_shift_staff_date | (staff_id, work_date) | COMPOSITE | Staff schedule lookup |
| staff_shifts | idx_shift_clinic_date | (clinic_id, work_date) | COMPOSITE | Clinic schedule |
| slots | idx_slot_shift | shift_id | B-TREE | Shift lookup |
| slots | idx_slot_status | status | B-TREE | Available slots |

##### AI Agent Service Indexes

| Table | Index Name | Columns | Type | Purpose |
|-------|------------|---------|------|---------|
| agents | idx_agents_name | name | UNIQUE | Agent lookup by name |
| tools | idx_tools_name | name | UNIQUE | Tool lookup by name |
| system_settings | idx_system_settings_key | key | UNIQUE | Setting lookup |

##### Cross-Service References

> **Note:** Với quyết định lưu AI chat trên MongoDB, mapping `user_id` từ Spring Boot backend được lưu như logical reference trong document Mongo (`ai_chat_sessions.user_id`).

#### 2.1.6 Complete ERD (All Tables)

> **Note:** Complete ERD covers the full active PostgreSQL schema: 37 tables (30 Spring Boot + 7 AI service).
> This ERD is the detailed database-design view with columns, types, and constraints.
> DBML source code: [`docs-references/database/PETTIES_DBML.dbml`](../../database/PETTIES_DBML.dbml)
> MongoDB collections and Qdrant collections are documented separately in Sections 2.2 and 2.3.

**Instructions to generate Complete ERD:**
1. Visit https://dbdiagram.io/
2. Copy content from `PETTIES_DBML.dbml`
3. Paste into editor
4. Export PNG/PDF

```
[Complete ERD Diagram - Paste screenshot from dbdiagram.io here]
```
---

### 2.2 NoSQL Database Design (MongoDB)

MongoDB is used for flexible data with nested documents, no strict schema required.

#### 2.2.0 Presentation Notes

**Talking Script - MongoDB Overview:**

"Bên cạnh PostgreSQL, Petties sử dụng MongoDB cho các dữ liệu có cấu trúc linh hoạt và thay đổi thường xuyên. Thay vì ép toàn bộ dữ liệu vào mô hình quan hệ, chúng tôi tách các phần phù hợp hơn với document model sang MongoDB. Hiện tại MongoDB phục vụ hai nhóm chính: dữ liệu y tế và dữ liệu chat."

"Nhóm thứ nhất là EMR và Vaccination Record. Đây là dữ liệu có nhiều trường mô tả, nội dung dài, và các phần tử lồng nhau như prescriptions hoặc images. Dùng MongoDB giúp lưu trữ các hồ sơ này tự nhiên hơn, không cần tách quá nhiều bảng phụ như trong relational model."

"Nhóm thứ hai là chat. Hệ thống có chat giữa Pet Owner và Clinic, đồng thời có AI chat giữa User và AI Agent. Các message trong chat thường phát sinh liên tục, có metadata khác nhau theo từng loại message, nên MongoDB phù hợp hơn để lưu session, message, tool trace, feedback và proactive notification log."

"Tuy dùng MongoDB, chúng tôi vẫn giữ liên kết logic với PostgreSQL thông qua các khóa tham chiếu như pet_id, booking_id, clinic_id hoặc user_id. Nghĩa là PostgreSQL vẫn là nguồn định danh chuẩn của hệ thống, còn MongoDB tối ưu cho việc lưu document giàu nội dung và đọc ghi linh hoạt. Đây là lý do kiến trúc dữ liệu của Petties được thiết kế theo hướng polyglot persistence thay vì chỉ dùng một loại database duy nhất."

#### 2.2.1 Collections Overview

```mermaid
flowchart LR
    subgraph MongoDB["MongoDB 7 (Document Store)"]
        direction TB
        EMR["emr_records<br/>Electronic Medical Records"]
        VAX["vaccination_records<br/>Vaccination History"]
        CONV["chat_conversations<br/>Chat Sessions (Owner-Clinic)"]
        MSG["chat_messages<br/>Messages (Owner-Clinic)"]
        AICONV["ai_chat_sessions<br/>AI Chat Sessions"]
        AIMSG["ai_chat_messages<br/>AI Chat Messages"]
    end

    style EMR fill:#90EE90
    style VAX fill:#87CEEB
    style CONV fill:#FFB6C1
    style MSG fill:#DDA0DD
    style AICONV fill:#FFDAB9
    style AIMSG fill:#E6E6FA
```

| Collection | Description | Avg Doc Size | Reference to PostgreSQL |
|------------|-------------|--------------|------------------------|
| emr_records | Electronic Medical Records (SOAP format) | ~2KB | pet_id, booking_id, staff_id, clinic_id |
| vaccination_records | Vaccination history | ~500B | pet_id, booking_id, staff_id, clinic_id |
| chat_conversations | 1-1 chat sessions | ~300B | pet_owner_id, clinic_id |
| chat_messages | Messages | ~200B | sender_id, chat_box_id (MongoDB _id) |
| ai_chat_sessions | AI-user chat sessions | ~500B | user_id, agent_id (logical ref) |
| ai_chat_messages | AI-user chat messages + metadata | ~1KB | session_id (MongoDB _id) |

#### 2.2.2 Collection Descriptions

##### Collection: emr_records

**Description:** Electronic Medical Records in SOAP format (Subjective, Objective, Assessment, Plan) with embedded prescriptions and images.

**Sample Document:**
```json
{
  "_id": ObjectId("507f1f77bcf86cd799439011"),
  "petId": "550e8400-e29b-41d4-a716-446655440000",
  "bookingId": "550e8400-e29b-41d4-a716-446655440001",
  "staffId": "550e8400-e29b-41d4-a716-446655440002",
  "clinicId": "550e8400-e29b-41d4-a716-446655440003",
  "clinicName": "ABC Veterinary Clinic",
  "staffName": "Dr. Nguyen Van A",

  "subjective": "Owner reports pet stopped eating for 2 days, lethargic, vomited once this morning.",

  "objective": "Temperature: 39.5°C (mild fever). Heart: normal. Breathing: normal. Abdomen: slightly distended, tender in epigastric region. Mucous membranes: slightly pale.",

  "assessment": "Acute gastritis. Suspected ingestion of inappropriate food.",

  "plan": "Medical treatment for 5 days. Rest, feed soft and digestible food. Follow-up in 5 days if no improvement.",

  "notes": "",
  "weightKg": 4.5,
  "temperatureC": 39.5,
  "heartRate": 120,
  "bcs": 5,

  "prescriptions": [
    {
      "medicineName": "Amoxicillin 250mg",
      "dosage": "1 tablet",
      "frequency": "Twice daily",
      "durationDays": 5,
      "instructions": "Take after meals"
    },
    {
      "medicineName": "Omeprazole 20mg",
      "dosage": "1/2 tablet",
      "frequency": "Once daily (morning)",
      "durationDays": 5,
      "instructions": "Take 30 minutes before meals"
    }
  ],

  "images": [
    {
      "url": "https://res.cloudinary.com/petties/emr/xray-abdomen-001.jpg",
      "description": "Abdominal X-ray - No foreign body detected"
    }
  ],

  "examinationDate": ISODate("2025-01-26T10:30:00Z"),
  "reExaminationDate": ISODate("2025-01-31T00:00:00Z"),
  "createdAt": ISODate("2025-01-26T10:30:00Z")
}
```

**Fields:**

| Field | Type | Description |
|-------|------|-------------|
| petId | UUID | Pet reference (indexed) |
| bookingId | UUID | Booking reference (indexed) |
| staffId | UUID | Staff who created EMR |
| clinicId | UUID | Clinic reference |
| clinicName | String | Denormalized clinic name |
| staffName | String | Denormalized staff name |
| subjective | String | S - Symptoms described by owner |
| objective | String | O - Clinical observations |
| assessment | String | A - Diagnosis |
| plan | String | P - Treatment plan |
| notes | String | Additional notes |
| weightKg | BigDecimal | Pet weight at examination |
| temperatureC | BigDecimal | Body temperature |
| heartRate | Integer | Heart rate (bpm) |
| bcs | Integer | Body Condition Score (1-9) |
| images | EmrImage[] | Embedded images (url, description) |
| prescriptions | Prescription[] | Embedded prescriptions (medicineName, dosage, frequency, durationDays, instructions) |
| examinationDate | DateTime | Examination date |
| reExaminationDate | DateTime | Scheduled re-examination date |
| createdAt | DateTime | Record creation timestamp |

**Indexes:**
- `{ petId: 1 }` - Find EMR by pet
- `{ bookingId: 1 }` - Find by booking

##### Collection: vaccination_records

**Description:** Pet vaccination history, tracking administered vaccines and booster schedules.

**Sample Document:**
```json
{
  "_id": ObjectId("507f1f77bcf86cd799439012"),
  "petId": "550e8400-e29b-41d4-a716-446655440000",
  "bookingId": "550e8400-e29b-41d4-a716-446655440001",
  "staffId": "550e8400-e29b-41d4-a716-446655440002",
  "clinicId": "550e8400-e29b-41d4-a716-446655440003",
  "clinicName": "ABC Veterinary Clinic",
  "staffName": "Dr. Nguyen Van A",

  "vaccineName": "5-in-1 Vaccine (DHPP+Lepto)",
  "batchNumber": "VN2025-001234",
  "status": "COMPLETED",

  "vaccineTemplateId": "550e8400-e29b-41d4-a716-446655440010",
  "doseNumber": 2,
  "totalDoses": 3,
  "seriesId": "550e8400-e29b-41d4-a716-446655440020",

  "vaccinationDate": "2025-01-26",
  "nextDueDate": "2026-01-26",
  "reminderSent": false,

  "notes": "Booster dose 2. Pet is healthy, no adverse reactions. Schedule dose 3 in 1 year.",

  "createdAt": ISODate("2025-01-26T10:15:00Z")
}
```

**Fields:**

| Field | Type | Description |
|-------|------|-------------|
| petId | UUID | Pet reference (indexed) |
| bookingId | UUID | Booking reference |
| staffId | UUID | Staff who administered |
| clinicId | UUID | Clinic reference |
| clinicName | String | Denormalized clinic name |
| staffName | String | Denormalized staff name |
| vaccineName | String | Vaccine name |
| batchNumber | String | Batch number for tracking |
| status | String | PENDING, COMPLETED |
| vaccineTemplateId | UUID | Link to vaccine_templates master data |
| doseNumber | Integer | Dose number in series (e.g., 1, 2, 3) |
| totalDoses | Integer | Total doses in series (e.g., 3) |
| seriesId | UUID | Groups related doses together |
| vaccinationDate | LocalDate | Date administered |
| nextDueDate | LocalDate | Next due date (indexed) |
| reminderSent | Boolean | Whether reminder notification was sent |
| notes | String | Additional notes |
| createdAt | DateTime | Record creation timestamp |

**Indexes:**
- `{ petId: 1, vaccinationDate: -1 }` - Pet's vaccination history
- `{ nextDueDate: 1 }` - Find upcoming vaccinations

##### Collection: chat_conversations

**Description:** 1-1 chat sessions between Pet Owner and Clinic.

**Sample Document:**
```json
{
  "_id": ObjectId("507f1f77bcf86cd799439013"),
  "petOwnerId": "550e8400-e29b-41d4-a716-446655440000",
  "clinicId": "550e8400-e29b-41d4-a716-446655440001",

  "clinicName": "ABC Veterinary Clinic",
  "clinicLogo": "https://res.cloudinary.com/petties/clinics/clinic-001-logo.jpg",
  "petOwnerName": "Nguyen Van A",
  "petOwnerAvatar": "https://res.cloudinary.com/petties/avatars/user-001.jpg",

  "lastMessage": "Cam on Staff, ngay mai em se dem be den!",
  "lastMessageSender": "PET_OWNER",
  "lastMessageAt": ISODate("2025-01-26T15:30:00Z"),

  "unreadCountPetOwner": 0,
  "unreadCountClinic": 1,

  "petOwnerOnline": false,
  "clinicOnline": true,

  "lastAutoReplyAt": ISODate("2025-01-26T12:00:00Z"),
  "lastAutoReplyType": "QUICK_REPLY",

  "createdAt": ISODate("2025-01-20T08:00:00Z"),
  "updatedAt": ISODate("2025-01-26T15:30:00Z")
}
```

**Indexes:**
- `{ petOwnerId: 1, clinicId: 1 }` (unique) - One conversation per pet owner-clinic pair
- `{ lastMessageAt: -1 }` - Sort by most recent activity

##### Collection: chat_messages

**Description:** Messages within a conversation.

**Sample Document:**
```json
{
  "_id": ObjectId("507f1f77bcf86cd799439014"),
  "chatBoxId": "507f1f77bcf86cd799439013",

  "senderId": "550e8400-e29b-41d4-a716-446655440000",
  "senderType": "PET_OWNER",
  "senderName": "Nguyen Van A",
  "senderAvatar": "https://res.cloudinary.com/petties/avatars/user-001.jpg",

  "content": "Xin chao, em muon hoi lich tiem phong cho be nha em?",
  "messageType": "TEXT",
  "imageUrl": null,

  "status": "DELIVERED",
  "isRead": true,
  "readAt": ISODate("2025-01-26T14:35:00Z"),

  "actionButtons": [
    {
      "id": "btn-1",
      "label": "Dat lich ngay",
      "type": "BOOKING"
    }
  ],

  "createdAt": ISODate("2025-01-26T14:30:00Z")
}
```

**Inner Enums:**
- **SenderType:** PET_OWNER, CLINIC
- **MessageType:** TEXT, IMAGE, IMAGE_TEXT
- **MessageStatus:** SENT, DELIVERED, SEEN

**Inner Class ActionButton:**
- `id` (String), `label` (String), `type` (String: MENU, OFFER, BOOKING, CUSTOM)

##### Collection: ai_chat_sessions

**Description:** Session-level data cho hội thoại AI với người dùng.

**Sample Document:**
```json
{
    "_id": ObjectId("507f1f77bcf86cd799439015"),
    "session_id": "ai-sess-9e5a",
    "user_id": "550e8400-e29b-41d4-a716-446655440000",
    "agent_name": "petties_agent",
    "started_at": ISODate("2026-03-04T09:00:00Z"),
    "ended_at": null,
    "status": "ACTIVE"
}
```

**Indexes:**
- `{ session_id: 1 }` unique - session lookup
- `{ user_id: 1, started_at: -1 }` - user session history

##### Collection: ai_chat_messages

**Description:** Message-level data cho chat AI-user, bao gồm trace metadata từ ReAct/tool execution.

**Sample Document:**
```json
{
    "_id": ObjectId("507f1f77bcf86cd799439016"),
    "session_id": ObjectId("507f1f77bcf86cd799439015"),
    "role": "assistant",
    "content": "Bé có thể đang bị viêm dạ dày nhẹ...",
    "react_trace": {
        "steps": [
            {"type": "thought", "content": "Cần tra cứu knowledge base"}
        ]
    },
    "tool_calls": [
        {"tool_name": "pet_knowledge_search"}
    ],
    "sources": ["doc_12_chunk_3"],
    "timestamp": ISODate("2026-03-04T09:00:05Z")
}
```

**Indexes:**
- `{ session_id: 1, timestamp: 1 }` - ordered conversation replay
- `{ role: 1, timestamp: -1 }` - analytics by role

##### Chat Message Indexes (chat_messages)

**Indexes:**
- `{ chatBoxId: 1, createdAt: -1 }` - Messages in conversation
- `{ chatBoxId: 1, isRead: 1 }` - Unread message queries

##### Collection: ai_proactive_notifications

**Description:** Lưu trữ lịch sử hệ thống AI chủ động gửi thông báo (Push/Email) cho người dùng dựa trên phân tích dữ liệu (ví dụ: nhắc lịch tiêm phòng, cảnh báo sức khỏe).

**Sample Document:**
```json
{
    "_id": ObjectId("507f1f77bcf86cd799439017"),
    "user_id": "550e8400-e29b-41d4-a716-446655440000",
    "pet_id": "550e8400-e29b-41d4-a716-446655440011",
    "notification_type": "VACCINE_REMINDER",
    "title": "Đã đến lịch tiêm phòng Dại cho bé Miu",
    "content": "Theo hồ sơ, bé Miu cần tiêm nhắc lại vaccine Dại vào tuần tới. Vui lòng đặt lịch sớm nhé!",
    "status": "SENT",
    "error_message": null,
    "context_data": {
        "vaccine_name": "Rabies",
        "last_dose_date": "2025-03-10"
    },
    "created_at": ISODate("2026-03-05T08:00:00Z"),
    "sent_at": ISODate("2026-03-05T08:00:05Z")
}
```

**Indexes:**
- `{ user_id: 1, created_at: -1 }` - Lịch sử thông báo của user
- `{ status: 1 }` - Truy vấn các thông báo lỗi hoặc pending

##### Collection: chat_feedback

**Description:** Store user feedback for AI responses (thumbs up, thumbs down, report, confirmed) for analytics, audit, and operational monitoring. Feedback does not update Case Memory.

**Sample Document:**
```json
{
    "_id": ObjectId("507f1f77bcf86cd799439018"),
    "message_id": ObjectId("507f1f77bcf86cd799439016"),
    "session_id": ObjectId("507f1f77bcf86cd799439015"),
    "user_id": "550e8400-e29b-41d4-a716-446655440000",
    "feedback_type": "THUMBS_UP",
    "feedback_category": "medical",
    "feedback_text": "The answer was useful and clinically clear.",
    "weight": 0.6,
    "used_for_enrichment": false,
    "created_at": ISODate("2026-03-04T09:15:00Z")
}
```

**Indexes:**
- `{ message_id: 1 }` (unique) - 1 feedback / 1 message
- `{ session_id: 1 }` - Analyze feedback by session
- `{ user_id: 1 }` - Analyze satisfaction by user

---

## 2.3 Vector Database Design (Qdrant)

Hệ thống sử dụng **Qdrant Cloud** làm Vector Database chính để lưu trữ các metadata và vector embeddings phục vụ cho tính năng RAG (Retrieval-Augmented Generation) và Visual Case Memory. 
Toàn bộ collection sử dụng metric **Cosine Similarity** và vector dimensions từ mô hình **Cohere** (`1024` chiều) kết hợp với **Jina CLIP v2** (`1024` chiều) cho hình ảnh.

### 2.3.1 Collection: petties_knowledge_base

**Description:** Lưu trữ các chunks văn bản trích xuất từ tài liệu y khoa do Admin upload (PDF, DOCX) để cung cấp kiến thức nền cho RAG. Chỉ sử dụng text embedding.

**Vector Configuration:**
- Tên vector mặc định (`""`): Size 1024, Distance COSINE (Cohere embed-multilingual-v3.0)

**Payload Structure (Metadata):**
| Field | Type | Description |
|-------|------|-------------|
| document_id | String | UUID tham chiếu tới bảng `knowledge_documents` trong PostgreSQL |
| chunk_id | String | ID duy nhất cho đoạn trích (text chunk) |
| text_content | String | Nội dung văn bản của đoạn trích phục vụ retrieval |
| source_file | String | Tên file gốc |
| page_num | Integer | Số trang (nếu có từ cấu trúc tài liệu) |
| created_at | String | ISO-8601 Timestamp thời điểm index |

### 2.3.2 Collection: petties_case_memory_v2

**Description:** EMR-driven Case Memory for confirmed veterinary records. Stores text and image evidence from confirmed EMR so AI can retrieve similar real cases during diagnosis support.

**Vector Configuration:**
Use separate vectors for text and image retrieval:
- `text`: Size 1024, Distance COSINE (Cohere embed-multilingual-v3.0)
- `image`: Size 1024, Distance COSINE (Jina CLIP v2)

**Payload Structure (Metadata):**
| Field | Type | Description |
|-------|------|-------------|
| case_id | String | Stable identifier in the form `emr:{emr_id}` |
| source_type | String | Data source marker such as `confirmed_emr` |
| clinic_id | String | Clinic UUID associated with the EMR |
| pet_id | String | Pet UUID associated with the EMR |
| booking_id | String | Booking UUID if the EMR originated from a booking |
| doctor_id | String | Doctor/staff UUID who confirmed the EMR |
| species | String | Pet species |
| breed | String | Pet breed |
| chief_complaint | String | Chief complaint captured in the EMR |
| symptoms | Array | Structured symptom list |
| physical_exam | Array | Structured physical examination findings |
| clinical_notes | String | Additional clinical notes |
| final_diagnosis_text | String | Final diagnosis text from confirmed EMR |
| canonical_code | String | Normalized disease code when mapping is available; otherwise null/provisional |
| exam_at | String | Examination timestamp |
| emr_updated_at | String | Last EMR update timestamp used for case-memory upsert |
| image_urls | Array | Clinical image URLs attached to the EMR |
| image_embedding_provider | String | Image embedding provider metadata, for example `jina-clip-v2` |

### 2.3.3 Collection: petties_kb_images

**Description:** Lưu trữ vector embeddings của ảnh trích xuất từ PDF documents trong Knowledge Base. Hỗ trợ **Hybrid Search (text + image similarity)** khi user gửi ảnh bệnh để tra cứu.

**Vector Configuration:**
- `text`: Size 1024, Distance COSINE (Cohere embed-multilingual-v3.0) - mô tả document
- `image`: Size 1024, Distance COSINE (Jina CLIP v2) - ảnh bệnh từ PDF

**Payload Structure (Metadata):**
| Field | Type | Description |
|-------|------|-------------|
| document_id | String | UUID tham chiếu tới bảng `knowledge_documents` trong PostgreSQL |
| filename | String | Tên file PDF gốc |
| image_id | String | ID duy nhất của ảnh (format: `p{page}_img{index}_{hash}`) |
| image_index | Integer | Thứ tự ảnh trong document |
| extracted_at | String | ISO-8601 Timestamp khi extract |
| metadata | Object | Metadata bổ sung (notes, file_type,...) |

**Usage:**
- Khi upload PDF có ảnh bệnh → tự động extract ảnh + tạo image embeddings
- Query `/knowledge/query-hybrid` để tìm ảnh tương tự
- Integration với AI Diagnose: khi Staff gửi ảnh bệnh, tìm cases có ảnh tương tự trong KB

**Files Modified:**
- `app/core/rag/rag_engine.py` - Image extraction + indexing
- `app/api/routes/knowledge.py` - Endpoint `/query-hybrid`
- `app/db/postgres/models.py` - Thêm field `image_count`

---

## 3. API DESIGN SPECIFICATIONS

> **Note:** API version prefix `/api/v1` (Backend) has been simplified to `/api`. AI Service is accessed via `/ai` prefix through NGINX.

### 3.1 Implemented Modules (Backend - Spring Boot)

> **Base Path:** `/api`
> **Access:** Requires JWT, Public for Auth/Search

#### 3.1.1 Authentication (`/auth`)
| Method | Endpoint | Description | Access |
|--------|----------|-------------|--------|
| POST | `/api/auth/login` | Username/Password login | Public |
| POST | `/api/auth/google` | Google OAuth login/register | Public |
| POST | `/api/auth/register/send-otp` | Init registration with Email OTP | Public |
| POST | `/api/auth/register/verify-otp` | Complete registration | Public |
| POST | `/api/auth/refresh` | Refresh Access Token (Rotation) | Public |
| GET | `/api/auth/me` | Get current user basic info | Auth |
| POST | `/api/auth/forgot-password` | Request password reset OTP | Public |
| POST | `/api/auth/logout` | Revoke token | Auth |

#### 3.1.2 User Profile (`/users`)
| Method | Endpoint | Description | Access |
|--------|----------|-------------|--------|
| GET | `/api/users/profile` | Get detailed profile | Auth |
| PUT | `/api/users/profile` | Update profile info | Auth |
| POST | `/api/users/profile/avatar` | Upload avatar | Auth |
| DELETE | `/api/users/profile/avatar` | Delete avatar | Auth |
| PUT | `/api/users/profile/password` | Change password | Auth |
| POST | `/api/users/profile/email/request-change` | Request email change (Step 1) | Auth |
| POST | `/api/users/profile/email/verify-change` | Verify email change (Step 2) | Auth |

#### 3.1.3 Clinic Management (`/clinics`)
| Method | Endpoint | Description | Access |
|--------|----------|-------------|--------|
| GET | `/api/clinics` | List all clinics (Filter/Page) | Public |
| GET | `/api/clinics/{id}` | Get details | Public |
| POST | `/api/clinics` | Create clinic | Clinic Owner |
| PUT | `/api/clinics/{id}` | Update profile | Clinic Owner |
| POST | `/api/clinics/{id}/images` | Upload gallery image | Clinic Owner |
| POST | `/api/clinics/{id}/logo` | Upload logo | Clinic Owner |
| DELETE | `/api/clinics/{id}/images/{imageId}` | Delete gallery image | Clinic Owner |
| GET | `/api/clinics/nearby` | Geo-search nearby | Public |
| GET | `/api/clinics/search` | Name search | Public |
| GET | `/api/clinics/owner/my-clinics` | Get my clinics | Clinic Owner |

#### 3.1.4 Clinic Staff Management (`/clinics/{id}/staff`)
| Method | Endpoint | Description | Access |
|--------|----------|-------------|--------|
| GET | `/api/clinics/{id}/staff` | List all staff | CM, CO, Admin |
| GET | `/api/clinics/{id}/staff/has-manager` | Check manager logic | CM, CO |
| POST | `/api/clinics/{id}/staff/invite-by-email` | Invite staff by email (Google OAuth) | CM, CO |
| PATCH | `/api/clinics/{id}/staff/{userId}/specialty` | Update staff specialty | CM, CO |
| DELETE | `/api/clinics/{id}/staff/{userId}` | Remove staff | CM, CO |

#### 3.1.5 Shift & Slot Management (`/shifts`, `/slots`)
| Method | Endpoint | Description | Access |
|--------|----------|-------------|--------|
| GET | `/api/clinics/{id}/shifts` | Get shifts in date range (Week/Month) | CM, CO, STAFF |
| POST | `/api/clinics/{id}/shifts` | Create shifts (Auto-gen slots, Break sync, Repeat weeks, Overnight) | CM, CO |
| GET | `/api/shifts/me` | Get shifts of logged-in vet | STAFF |
| GET | `/api/shifts/{id}` | Get shift detail with Slots & Bookings | CM, CO, STAFF |
| DELETE | `/api/shifts/{id}` | Delete individual shift (blocked if has bookings) | CM, CO |
| DELETE | `/api/shifts/bulk` | Delete multiple shifts (Bulk) | CM, CO |
| PATCH | `/api/slots/{id}/block` | Manually block slot | CM, CO |
| PATCH | `/api/slots/{id}/unblock` | Unblock slot | CM, CO |

#### 3.1.8 Booking Report (`/reports`, `/admin/reports`)
| Method | Endpoint | Description | Access |
|--------|----------|-------------|--------|
| POST | `/api/reports` | Submit a report for a booking | Auth |
| GET | `/api/reports/my` | Get own submitted reports | Auth |
| GET | `/api/admin/reports` | Get all reports (filtered) | Admin |
| PUT | `/api/admin/reports/{id}/resolve` | Approve/Reject a report | Admin |

#### 3.1.9 Commercial, Subscription & Governance APIs
> Documentation baseline aligned with the approved 20-module checklist dated 2026-03-25. These modules were added or materially expanded by the merged codebase and must remain represented in the SDD even when their detailed class and sequence diagrams are still being expanded.

| Module | Base Endpoint | Scope Summary | Access |
|--------|---------------|---------------|--------|
| Subscription Plan Management | `/subscriptions/plans` | Plan listing, active plans, detail view, admin create/update | Public + Admin |
| User Subscription Management | `/subscriptions` | Subscribe, clinic subscription status/history, cancel subscription, admin history view | Clinic Owner + Admin |
| Voucher Management | `/vouchers` | Admin voucher CRUD, clinic voucher application, pet owner voucher discovery and discount calculation | Admin + Clinic Manager + Auth |
| Refund Application Management | `/refund-applications` | Create refund records, clinic history, admin pending/all, status updates | Clinic Owner + Admin |
| Withdrawal Management | `/withdrawals` | Clinic withdrawal request list/detail and admin review decisions | Clinic Owner + Admin |
| Governance Report & Strike Config | `/reports`, `/reports/{id}` (PUT/DELETE for reporter), `/admin/reports`, `/admin/clinic-strike-config`, `/admin/user-strike-config` | Reports: create with optional `attachmentUrls` (HTTPS), reporter update/withdraw (`WITHDRAWN`), admin resolve; strike thresholds (no `/v1` prefix; base path `/api`) | Auth + Admin |
| SePay Webhook Integration | `/api/webhooks/sepay` | Payment callback ingestion and downstream booking/payment reconciliation | System |

#### 3.1.6 Clinic Services (`/services`)
| Method | Endpoint | Description | Access |
|--------|----------|-------------|--------|
| GET | `/api/services` | List own services | Clinic Owner |
| POST | `/api/services` | Create service | Clinic Owner |
| PUT | `/api/services/{id}` | Update service | Clinic Owner |
| DELETE | `/api/services/{id}` | Delete service | Clinic Owner |
| PATCH | `/api/services/{id}/status` | Toggle active | Clinic Owner |
| PATCH | `/api/services/{id}/home-visit` | Toggle Home Visit | Clinic Owner |

#### 3.1.7 File Management (`/files`)
| Method | Endpoint | Description | Access |
|--------|----------|-------------|--------|
| POST | `/api/files/upload` | Upload generic file | Auth |
| POST | `/api/files/upload/avatar` | Upload avatar (resize) | Auth |

### 3.2 Implemented Modules (AI Service - Python)

> **Base Path:** `/ai` (Mapped via NGINX to Internal Port 8000)

#### 3.2.1 Chat & Sessions (`/ai/chat`)
| Method | Endpoint | Description | Access |
|--------|----------|-------------|--------|
| POST | `/ai/chat/sessions` | Create new chat session | Auth |
| GET | `/ai/chat/sessions` | List history sessions | Auth |
| GET | `/ai/chat/sessions/{id}` | Get session details | Auth |
| WS | `/ws/chat/{session_id}` | WebSocket Real-time Chat | Auth |

#### 3.2.2 Agent Management (`/ai/agents`)
| Method | Endpoint | Description | Access |
|--------|----------|-------------|--------|
| GET | `/ai/agents` | List the current single-agent runtime configurations | Admin |
| GET | `/ai/agents/{id}` | Get agent detail with currently enabled tools | Admin |
| PUT | `/ai/agents/{id}` | Update runtime config (model, temperature, limits, enabled state) | Admin |
| POST | `/ai/agents/{id}/test` | Test Agent (ReAct Trace) | Admin |

#### 3.2.3 Tool Registry (`/ai/tools`)
| Method | Endpoint | Description | Access |
|--------|----------|-------------|--------|
| POST | `/ai/tools/scan` | Scan & Sync Code-based Tools (FastMCP) | Admin |
| GET | `/ai/tools` | List Registered Tools | Admin |
| GET | `/ai/tools/{id}` | Get a single tool detail | Admin |
| PUT | `/ai/tools/{id}/enable` | Enable/Disable Tool | Admin |
| DELETE | `/ai/tools/{id}` | Delete tool metadata from registry | Admin |
| POST | `/ai/tools/{tool_name}/execute` | Execute a tool directly for admin testing | Admin |

#### 3.2.4 Knowledge Base RAG (`/ai/knowledge`)
| Method | Endpoint | Description | Access |
|--------|----------|-------------|--------|
| POST | `/ai/knowledge/upload` | Upload PDF/Docx | Admin |
| POST | `/ai/knowledge/documents/{id}/process` | Index to Qdrant (Cohere Embedding) | Admin |
| GET | `/ai/knowledge/documents` | List documents status | Admin |
| POST | `/ai/knowledge/query` | Test RAG Retrieval | Admin |
| GET | `/ai/knowledge/status` | KB Status & Stats | Admin |

#### 3.2.5 Feedback & Data Improvement (`/ai/chat`)
| Method | Endpoint | Description | Access |
|--------|----------|-------------|--------|
| POST | `/ai/chat/feedback` | Submit feedback (thumbs up/down/report) for a message | Auth |
| GET | `/ai/chat/feedback/stats` | Get feedback statistics by role and period | Admin |

#### 3.2.6 Knowledge Graph & Case Memory (`/ai/knowledge`)
| Method | Endpoint | Description | Access |
|--------|----------|-------------|--------|
| POST | `/ai/knowledge/build-kg` | Build Knowledge Graph from indexed documents | Admin |
| GET | `/ai/knowledge/kg-stats` | Get Knowledge Graph statistics (entities, relations) | Admin |
| POST | `/ai/knowledge/embed-confirmed-cases` | Legacy endpoint note; active Case Memory sync is EMR-driven | Admin |
| GET | `/ai/knowledge/case-memory/stats` | Get Case Memory statistics (total cases, categories) | Admin |

### 3.3 Implemented Modules (Backend) - Previously Planned

> **Note:** These modules were originally marked as "Planned" but are now **FULLY IMPLEMENTED** and functional in production.

#### 3.3.1 Patient Management Module

> **Status:** ✅ **IMPLEMENTED** (Sprint 7-8). All endpoints functional.

| Method | Endpoint | Description | Access |
|--------|----------|-------------|--------|
| GET | `/api/clinics/{id}/patients` | List patients of clinic | CM, STAFF |
| GET | `/api/patients/{id}` | Get Patient & Owner details | CM, STAFF |
| PUT | `/api/pets/{id}` | Update Patient Info | CM, STAFF |
| GET | `/api/patients/{id}/emrs` | Get EMR History (Shared) | CM, STAFF |
| POST | `/api/bookings/{id}/emr` | Create EMR for Booking | STAFF |
| PUT | `/api/emrs/{id}` | Update EMR Content | STAFF |
| GET | `/api/patients/{id}/vaccinations` | Get Vaccination History | CM, STAFF |
| POST | `/api/patients/{id}/vaccinations` | Add Vaccination Record | STAFF |
| PUT | `/api/vaccinations/{id}` | Edit Vaccination Record | STAFF |
| DELETE | `/api/vaccinations/{id}` | Delete Vaccination Record | STAFF |

#### 3.3.2 Booking Management Module

> **Status:** ✅ **IMPLEMENTED** (Sprint 6-7). Full booking lifecycle supported.

| Method | Endpoint | Description | Access |
|--------|----------|-------------|--------|
| POST | `/api/bookings` | Create new booking (Select slot) | Pet Owner |
| GET | `/api/bookings/my-bookings` | List own bookings | Pet Owner |
| GET | `/api/clinics/{id}/bookings` | List clinic bookings | CM, STAFF |
| PATCH | `/api/bookings/{id}/status` | Update booking status | CM, STAFF |

#### 3.3.3 Clinic Discovery & Search Module

> **Status:** ✅ **IMPLEMENTED** (Sprint 4-5). Integrated with Goong Maps API. Endpoints are under `/api/clinics`.

| Method | Endpoint | Description | Access |
|--------|----------|-------------|--------|
| GET | `/api/clinics/nearby` | Find clinics by coordinates (lat, lng, radius) | Public |
| GET | `/api/clinics/search` | Search by keyword, service, area | Public |
| GET | `/api/clinics/{id}/distance` | Get distance from point to clinic | Public |

#### 3.3.4 Vaccination History Module (Merged)

> **Status:** ✅ **IMPLEMENTED** (Sprint 7). Fully integrated with EMR module.

| Method | Endpoint | Description | Access |
|--------|----------|-------------|--------|
| GET | `/api/pets/{petId}/vaccinations` | Get full vaccination history | Auth |
| POST | `/api/bookings/{bookingId}/vaccinations` | Add new vaccination record (Must link to Booking) | STAFF |
| PUT | `/api/vaccinations/{id}` | Edit record | STAFF |
| DELETE | `/api/vaccinations/{id}` | Delete record | STAFF |

---

## 4. DETAILED DESIGN

### 4.1 Authentication

#### 4.1.1 Class Diagram - Authentication

```mermaid
classDiagram
    class AuthController {
        -AuthService authService
        -UserService userService
        -RegistrationOtpService registrationOtpService
        -PasswordResetService passwordResetService
        +register(RegisterRequest) ResponseEntity
        +sendRegistrationOtp(SendOtpRequest) ResponseEntity
        +verifyOtpAndRegister(VerifyOtpRequest) ResponseEntity
        +resendOtp(String email) ResponseEntity
        +login(LoginRequest) ResponseEntity
        +googleSignIn(GoogleSignInRequest) ResponseEntity
        +refreshToken(String) ResponseEntity
        +logout(String) ResponseEntity
        +getCurrentUser() ResponseEntity
        +forgotPassword(ForgotPasswordRequest) ResponseEntity
        +resetPassword(ResetPasswordRequest) ResponseEntity
        +resendPasswordResetOtp(String email) ResponseEntity
    }

    class AuthService {
        -UserRepository userRepository
        -PasswordEncoder passwordEncoder
        -JwtTokenProvider tokenProvider
        -AuthenticationManager authenticationManager
        -RefreshTokenRepository refreshTokenRepository
        -BlacklistedTokenRepository blacklistedTokenRepository
        -GoogleAuthService googleAuthService
        +register(RegisterRequest) AuthResponse
        +login(LoginRequest) AuthResponse
        +loginWithGoogle(GoogleSignInRequest) AuthResponse
        +refreshToken(String refreshToken) AuthResponse
        +logout(String accessToken) void
        +getCurrentUser() User
        -saveRefreshToken(UUID, String) void
        -findOrCreateGoogleUser(GoogleUserInfo, String) User
        -createUserFromGoogle(GoogleUserInfo, String) User
        -validateRolePlatformAccess(Role, String) void
    }

    class RegistrationOtpService {
        -UserRepository userRepository
        -PasswordEncoder passwordEncoder
        -JwtTokenProvider tokenProvider
        -RefreshTokenRepository refreshTokenRepository
        -OtpService otpService
        -EmailService emailService
        -OtpRedisService otpRedisService
        +sendRegistrationOtp(SendOtpRequest) SendOtpResponse
        +verifyOtpAndRegister(VerifyOtpRequest) AuthResponse
        +resendOtp(String email) SendOtpResponse
        -saveRefreshToken(UUID, String) void
    }

    class PasswordResetService {
        -UserRepository userRepository
        -PasswordEncoder passwordEncoder
        -OtpService otpService
        -EmailService emailService
        -OtpRedisService otpRedisService
        +sendPasswordResetOtp(ForgotPasswordRequest) SendOtpResponse
        +verifyOtpAndResetPassword(ResetPasswordRequest) MessageResponse
        +resendPasswordResetOtp(String email) SendOtpResponse
    }

    class UserService {
        -UserRepository userRepository
        +getUserById(UUID) UserResponse
        +updateProfile(UUID, ProfileRequest) UserResponse
    }

    class OtpService {
        +generateOtp() String
        +getExpiryMinutes() int
    }

    class OtpRedisService {
        -RedisTemplate redisTemplate
        +savePendingRegistration(PendingRegistrationData) void
        +getPendingRegistration(String email) Optional
        +deletePendingRegistration(String email) void
        +savePasswordResetOtp(String, String) void
        +getPasswordResetOtp(String) Optional
        +deletePasswordResetOtp(String) void
        +incrementPasswordResetAttempts(String) void
        +getPasswordResetCooldownRemaining(String) long
    }

    class EmailService {
        +sendRegistrationOtpEmail(String, String) void
        +sendPasswordResetOtpEmail(String, String) void
    }

    class GoogleAuthService {
        +verifyIdToken(String idToken) GoogleUserInfo
    }

    class JwtTokenProvider {
        +generateToken(UUID, String, String) String
        +generateRefreshToken(UUID, String) String
        +validateToken(String) boolean
        +getUserIdFromToken(String) UUID
        +getUsernameFromToken(String) String
        +getTokenType(String) String
        +getExpirationDateFromToken(String) Date
    }

    class UserRepository {
        <<interface>>
        +findByUsername(String) Optional~User~
        +findByEmail(String) Optional~User~
        +findById(UUID) Optional~User~
        +findByIdWithWorkingClinic(UUID) Optional~User~
        +existsByUsername(String) boolean
        +existsByEmail(String) boolean
        +save(User) User
    }

    class RefreshTokenRepository {
        <<interface>>
        +findByTokenHash(String) Optional~RefreshToken~
        +deleteAllByUserId(UUID) void
        +delete(RefreshToken) void
        +save(RefreshToken) RefreshToken
    }

    class BlacklistedTokenRepository {
        <<interface>>
        +existsByTokenHash(String) boolean
        +save(BlacklistedToken) BlacklistedToken
    }

    class User {
        +UUID userId
        +String username
        +String email
        +String password
        +String fullName
        +String phone
        +String avatar
        +Role role
        +Clinic workingClinic
    }

    class RefreshToken {
        +Long id
        +UUID userId
        +String tokenHash
        +LocalDateTime expiresAt
        +isExpired() boolean
    }

    class BlacklistedToken {
        +Long id
        +String tokenHash
        +UUID userId
        +LocalDateTime expiresAt
    }

    class Role {
        <<enumeration>>
        PET_OWNER
        STAFF
        CLINIC_MANAGER
        CLINIC_OWNER
        ADMIN
    }

    %% Controller Dependencies
    AuthController --> AuthService
    AuthController --> UserService
    AuthController --> RegistrationOtpService
    AuthController --> PasswordResetService

    %% AuthService Dependencies
    AuthService --> UserRepository
    AuthService --> RefreshTokenRepository
    AuthService --> BlacklistedTokenRepository
    AuthService --> GoogleAuthService
    AuthService --> JwtTokenProvider

    %% RegistrationOtpService Dependencies
    RegistrationOtpService --> UserRepository
    RegistrationOtpService --> RefreshTokenRepository
    RegistrationOtpService --> OtpService
    RegistrationOtpService --> OtpRedisService
    RegistrationOtpService --> EmailService
    RegistrationOtpService --> JwtTokenProvider

    %% PasswordResetService Dependencies
    PasswordResetService --> UserRepository
    PasswordResetService --> OtpService
    PasswordResetService --> OtpRedisService
    PasswordResetService --> EmailService

    %% UserService Dependencies
    UserService --> UserRepository

    %% Repository to Entity relationships
    UserRepository ..> User
    RefreshTokenRepository ..> RefreshToken
    BlacklistedTokenRepository ..> BlacklistedToken
    User --> Role
```

#### 4.1.2 User Registration with OTP (UC-PO-01)

**Sequence Diagram:**

```mermaid
sequenceDiagram
    actor User as Pet Owner
    participant UI as Register Screen (Mobile/Web)
    participant AC as AuthController
    participant ROS as RegistrationOtpService
    participant ORS as OtpRedisService
    participant ES as EmailService
    participant UR as UserRepository
    participant RTR as RefreshTokenRepository
    participant JTP as JwtTokenProvider
    participant DB as Database

    User->>UI: 1. Input info & click "Send OTP"
    activate UI
    UI->>AC: 2. sendRegistrationOtp(Request)
    activate AC
    AC->>ROS: 3. sendRegistrationOtp(Request)
    activate ROS
    ROS->>UR: 4. existsByEmail(email)
    activate UR
    UR->>DB: 5. Check email exists
    activate DB
    DB-->>UR: 6. Not exists
    deactivate DB
    UR-->>ROS: 7. false
    deactivate UR
    ROS->>ORS: 8. savePendingRegistration(data)
    activate ORS
    ORS-->>ROS: 9. OK (saved to Redis)
    deactivate ORS
    ROS->>ES: 10. sendRegistrationOtpEmail(email, otp)
    activate ES
    ES-->>User: 11. Receive OTP via Email
    deactivate ES
    ROS-->>AC: 12. SendOtpResponse
    deactivate ROS
    AC-->>UI: 13. 200 OK (OTP Sent)
    deactivate AC
    UI-->>User: 14. Show OTP Input Screen
    deactivate UI

    User->>UI: 15. Input OTP & click "Register"
    activate UI
    UI->>AC: 16. verifyOtpAndRegister(VerifyOtpRequest)
    activate AC
    AC->>ROS: 17. verifyOtpAndRegister(Request)
    activate ROS
    ROS->>ORS: 18. getPendingRegistration(email)
    activate ORS
    ORS-->>ROS: 19. PendingRegistrationData
    deactivate ORS
    ROS->>ROS: 20. validateOtp(inputOtp, storedOtp)
    ROS->>UR: 21. save(New User)
    activate UR
    UR->>DB: 22. Insert new user
    activate DB
    DB-->>UR: 23. Inserted
    deactivate DB
    UR-->>ROS: 24. Saved User Entity
    deactivate UR
    ROS->>ORS: 25. deletePendingRegistration(email)
    ROS->>JTP: 26. generateToken(userId, username, role)
    activate JTP
    JTP-->>ROS: 27. Access Token
    deactivate JTP
    ROS->>JTP: 28. generateRefreshToken(userId, username)
    activate JTP
    JTP-->>ROS: 29. Refresh Token
    deactivate JTP
    ROS->>RTR: 30. save(RefreshToken)
    activate RTR
    RTR->>DB: 31. Insert refresh token
    activate DB
    DB-->>RTR: 32. Inserted
    deactivate DB
    RTR-->>ROS: 33. OK
    deactivate RTR
    ROS-->>AC: 34. AuthResponse (Tokens)
    deactivate ROS
    AC-->>UI: 35. 201 Created (Tokens)
    deactivate AC
    UI-->>User: 36. Redirect to Home Page
    deactivate UI
```

#### 4.1.3 Login with Username/Password

**Sequence Diagram:**

```mermaid
sequenceDiagram
    actor User as User
    participant UI as Login Screen
    participant AC as AuthController
    participant AS as AuthService
    participant AM as AuthenticationManager
    participant UR as UserRepository
    participant JTP as JwtTokenProvider
    participant RTR as RefreshTokenRepository
    participant DB as Database

    User->>UI: 1. Input Username/Password & click "Login"
    activate UI
    UI->>AC: 2. login(LoginRequest)
    activate AC
    AC->>AS: 3. login(LoginRequest)
    activate AS
    AS->>AM: 4. authenticate(credentials)
    activate AM
    AM->>UR: 5. loadUserByUsername(username)
    activate UR
    UR->>DB: 6. Query user by username
    activate DB
    DB-->>UR: 7. User record
    deactivate DB
    UR-->>AM: 8. UserDetails
    deactivate UR
    AM-->>AS: 9. Authentication Object
    deactivate AM
    
    AS->>UR: 10. findByIdWithWorkingClinic(userId)
    activate UR
    UR->>DB: 11. Query user with working clinic
    activate DB
    DB-->>UR: 12. User with Clinic
    deactivate DB
    UR-->>AS: 13. User Entity
    deactivate UR
    
    alt Role = PET_OWNER AND Platform = Web
        AS-->>AC: 14a. 403 Forbidden
        AC-->>UI: 15a. Error: Mobile Only
        UI-->>User: 16a. Show Mobile App prompt
    else Valid Platform
        AS->>RTR: 14b. deleteAllByUserId(userId)
        activate RTR
        RTR->>DB: 15b. Delete old refresh tokens
        activate DB
        DB-->>RTR: 16b. Deleted
        deactivate DB
        deactivate RTR
        AS->>JTP: 17b. generateToken(userId, username, role)
        activate JTP
        JTP-->>AS: 18b. Access Token
        deactivate JTP
        AS->>JTP: 19b. generateRefreshToken(userId, username)
        activate JTP
        JTP-->>AS: 20b. Refresh Token
        deactivate JTP
        AS->>RTR: 21b. save(RefreshToken)
        activate RTR
        RTR->>DB: 22b. Insert refresh token
        activate DB
        DB-->>RTR: 23b. Inserted
        deactivate DB
        RTR-->>AS: 24b. OK
        deactivate RTR
        AS-->>AC: 25b. AuthResponse
        deactivate AS
        AC-->>UI: 26b. 200 OK (AuthResponse)
        deactivate AC
        UI-->>User: 27b. Login Success
        deactivate UI
    end
```

#### 4.1.4 Sign in with Google Account

**Sequence Diagram:**

```mermaid
sequenceDiagram
    actor User as User
    participant UI as Login Screen
    participant AC as AuthController
    participant AS as AuthService
    participant GAS as GoogleAuthService
    participant UR as UserRepository
    participant RTR as RefreshTokenRepository
    participant JTP as JwtTokenProvider
    participant DB as Database

    User->>UI: 1. Click "Sign in with Google"
    activate UI
    UI->>GAS: 2. Redirect to Google Sign-In
    GAS-->>UI: 3. Return ID Token
    UI->>AC: 4. googleSignIn(idToken, platform)
    activate AC
    AC->>AS: 5. loginWithGoogle(request)
    activate AS
    AS->>GAS: 6. verifyIdToken(idToken)
    activate GAS
    GAS-->>AS: 7. GoogleUserInfo (email, name, picture)
    deactivate GAS
    AS->>UR: 8. findByEmail(email)
    activate UR
    UR->>DB: 9. Query user by email
    activate DB
    DB-->>UR: 10. Result Set
    deactivate DB
    UR-->>AS: 11. Optional~User~
    deactivate UR
    
    alt User not exists
        AS->>AS: 12a. createUserFromGoogle(info, platform)
        AS->>UR: 13a. save(New User)
        activate UR
        UR->>DB: 14a. Insert new user
        activate DB
        DB-->>UR: 15a. Inserted
        deactivate DB
        UR-->>AS: 16a. Saved User
        deactivate UR
    end
    
    AS->>AS: 17. validateRolePlatformAccess(role, platform)
    
    alt Role-Platform Mismatch
        AS-->>AC: 18a. 403 Forbidden
        AC-->>UI: 19a. Error (Role mismatch)
        UI-->>User: 20a. Show error message
    else Valid Access
        AS->>RTR: 18b. deleteAllByUserId(userId)
        activate RTR
        RTR->>DB: 19b. Delete old refresh tokens
        activate DB
        DB-->>RTR: 20b. Deleted
        deactivate DB
        deactivate RTR
        AS->>JTP: 21b. generateToken(userId, username, role)
        activate JTP
        JTP-->>AS: 22b. Access Token
        deactivate JTP
        AS->>JTP: 23b. generateRefreshToken(userId, username)
        activate JTP
        JTP-->>AS: 24b. Refresh Token
        deactivate JTP
        AS->>RTR: 25b. save(RefreshToken)
        activate RTR
        RTR->>DB: 26b. Insert refresh token
        activate DB
        DB-->>RTR: 27b. Inserted
        deactivate DB
        RTR-->>AS: 28b. OK
        deactivate RTR
        AS-->>AC: 29b. AuthResponse
        AC-->>UI: 30b. 200 OK (tokens)
        UI-->>User: 31b. Login Successful
    end
    deactivate AS
    deactivate AC
    deactivate UI
```

#### 4.1.5 Forgot & Reset Password

**Sequence Diagram:**

```mermaid
sequenceDiagram
    actor User as User
    participant UI as Forgot Password Screen
    participant AC as AuthController
    participant PS as PasswordResetService
    participant ORS as OtpRedisService
    participant ES as EmailService
    participant UR as UserRepository
    participant DB as Database

    User->>UI: 1. Input Email & click "Send OTP"
    activate UI
    UI->>AC: 2. forgotPassword(ForgotPasswordRequest)
    activate AC
    AC->>PS: 3. sendPasswordResetOtp(request)
    activate PS
    PS->>UR: 4. findByEmail(email)
    activate UR
    UR->>DB: 5. Query user by email
    activate DB
    DB-->>UR: 6. User record
    deactivate DB
    UR-->>PS: 7. User Entity
    deactivate UR
    PS->>ORS: 8. getPasswordResetCooldownRemaining(email)
    activate ORS
    ORS-->>PS: 9. 0 (no cooldown)
    deactivate ORS
    PS->>ORS: 10. savePasswordResetOtp(email, otp)
    activate ORS
    ORS-->>PS: 11. OK (saved to Redis)
    deactivate ORS
    PS->>ES: 12. sendPasswordResetOtpEmail(email, otp)
    activate ES
    ES-->>User: 13. Receive OTP via Email
    deactivate ES
    PS-->>AC: 14. SendOtpResponse
    deactivate PS
    AC-->>UI: 15. 200 OK (OTP Sent)
    deactivate AC
    UI-->>User: 16. Show Reset Password Form
    deactivate UI

    User->>UI: 17. Input OTP & New Password
    activate UI
    UI->>AC: 18. resetPassword(ResetPasswordRequest)
    activate AC
    AC->>PS: 19. verifyOtpAndResetPassword(request)
    activate PS
    PS->>ORS: 20. getPasswordResetOtp(email)
    activate ORS
    ORS-->>PS: 21. PasswordResetOtpData
    deactivate ORS
    PS->>PS: 22. validateOtp(inputOtp, storedOtp)
    PS->>UR: 23. findByEmail(email)
    activate UR
    UR->>DB: 24. Query user by email
    activate DB
    DB-->>UR: 25. User record
    deactivate DB
    UR-->>PS: 26. User Entity
    deactivate UR
    PS->>PS: 27. passwordEncoder.encode(newPassword)
    PS->>UR: 28. save(User with new password)
    activate UR
    UR->>DB: 29. Update user password
    activate DB
    DB-->>UR: 30. Updated
    deactivate DB
    UR-->>PS: 31. OK
    deactivate UR
    PS->>ORS: 32. deletePasswordResetOtp(email)
    PS-->>AC: 33. MessageResponse (Success)
    deactivate PS
    AC-->>UI: 34. 200 OK (Password Reset Success)
    deactivate AC
    UI-->>User: 35. Redirect to Login
    deactivate UI
```

#### 4.1.6 Logout & Session Management

**Sequence Diagram:**

```mermaid
sequenceDiagram
    actor User as User
    participant UI as App/Web
    participant AC as AuthController
    participant AS as AuthService
    participant JTP as JwtTokenProvider
    participant BTR as BlacklistedTokenRepository
    participant RTR as RefreshTokenRepository
    participant DB as Database

    User->>UI: 1. Click "Logout"
    activate UI
    UI->>AC: 2. logout(Authorization: Bearer accessToken)
    activate AC
    AC->>AS: 3. logout(accessToken)
    activate AS
    AS->>JTP: 4. validateToken(accessToken)
    activate JTP
    JTP-->>AS: 5. Valid
    deactivate JTP
    AS->>JTP: 6. getUserIdFromToken(accessToken)
    activate JTP
    JTP-->>AS: 7. userId
    deactivate JTP
    AS->>AS: 8. Create BlacklistedToken (hash token)
    AS->>BTR: 9. save(BlacklistedToken)
    activate BTR
    BTR->>DB: 10. Insert blacklisted token
    activate DB
    DB-->>BTR: 11. Inserted
    deactivate DB
    BTR-->>AS: 12. OK
    deactivate BTR
    AS->>RTR: 13. deleteAllByUserId(userId)
    activate RTR
    RTR->>DB: 14. Delete all refresh tokens
    activate DB
    DB-->>RTR: 15. Deleted
    deactivate DB
    RTR-->>AS: 16. OK
    deactivate RTR
    AS-->>AC: 17. Success
    deactivate AS
    AC-->>UI: 18. 200 OK
    deactivate AC
    UI->>UI: 19. Clear local storage (tokens)
    UI-->>User: 20. Redirect to Login Screen
    deactivate UI
```

---

### 4.2 User Profile Management

#### 4.2.1 Class Diagram - User Profile

```mermaid
classDiagram
    class UserController {
        -UserService userService
        -AuthService authService
        -EmailChangeService emailChangeService
        +getProfile() ResponseEntity
        +updateProfile(UpdateProfileRequest) ResponseEntity
        +uploadAvatar(MultipartFile) ResponseEntity
        +deleteAvatar() ResponseEntity
        +changePassword(ChangePasswordRequest) ResponseEntity
        +requestEmailChange(EmailChangeRequest) ResponseEntity
        +verifyEmailChange(VerifyRequest) ResponseEntity
        +resendEmailChangeOtp() ResponseEntity
        +cancelEmailChange() ResponseEntity
    }

    class UserService {
        -UserRepository userRepository
        -CloudinaryService cloudinaryService
        -PasswordEncoder passwordEncoder
        +getUserById(UUID) UserResponse
        +updateProfile(UUID, UpdateProfileRequest) UserResponse
        +uploadAvatar(UUID, MultipartFile) UserResponse
        +deleteAvatar(UUID) UserResponse
        +changePassword(UUID, ChangePasswordRequest) void
    }

    class EmailChangeService {
        -UserRepository userRepository
        -OtpService otpService
        -EmailService emailService
        -OtpRedisService otpRedisService
        +requestEmailChange(UUID, String) String
        +verifyAndChangeEmail(UUID, String, String) UserResponse
        +resendEmailChangeOtp(UUID) String
        +cancelEmailChange(UUID) String
    }

    class UserRepository {
        <<interface>>
        +findById(UUID) Optional~User~
        +findByEmail(String) Optional~User~
        +existsByEmailAndUserIdNot(String, UUID) boolean
        +save(User) User
    }

    class User {
        +UUID userId
        +String username
        +String email
        +String phone
        +String fullName
        +String avatar
        +Role role
        +Clinic workingClinic
        +StaffSpecialty specialty
        +BigDecimal ratingAvg
        +Integer ratingCount
    }

    class AuthService {
        +getCurrentUser() User
    }

    class CloudinaryService {
        +uploadImage(MultipartFile, String folder) UploadResponse
        +deleteImage(String publicId) void
    }

    UserController --> UserService
    UserController --> AuthService
    UserController --> EmailChangeService
    UserService --> UserRepository
    UserService --> CloudinaryService
    EmailChangeService --> UserRepository
    EmailChangeService --> OtpRedisService
    EmailChangeService --> EmailService
    EmailChangeService --> OtpService
```

#### 4.2.2 Sequence Diagram: View & Update Profile (UC-PO-03, UC-VT-02, UC-CM-02)

```mermaid
sequenceDiagram
    actor U as User
    participant UI as Web/Mobile App
    participant UC as UserController
    participant AS as AuthService
    participant US as UserService
    participant CS as CloudinaryService
    participant UR as UserRepository
    participant DB as Database

    U->>UI: 1. Edit info or select new Avatar
    UI->>UC: 2. updateProfile(UserRequest) or uploadAvatar(file)
    activate UC
    UC->>AS: 3. getCurrentUser()
    activate AS
    AS-->>UC: 4. Current User Entity
    deactivate AS
    UC->>US: 5. updateProfile / uploadAvatar(userId, request)
    activate US
    
    alt is Avatar Upload
        US->>CS: 6a. uploadImage(file, "avatars")
        activate CS
        CS-->>US: 7a. URL + PublicID
        deactivate CS
    end

    US->>UR: 8. save(Updated User Entity)
    activate UR
    UR->>DB: 9. Update User Profile Data
    activate DB
    DB-->>UR: 10. Success
    deactivate DB
    UR-->>US: 11. Saved User
    deactivate UR
    US-->>UC: 12. UserResponse
    deactivate US
    UC-->>UI: 13. 200 OK (User Data)
    deactivate UC
    UI-->>U: 14. Update UI state
```

#### 4.2.3 Sequence Diagram: Change Password or Change Email (UC-PO-04, UC-VT-03)

##### Change Email with OTP Flow

```mermaid
sequenceDiagram
    actor U as User
    participant UI as Web/Mobile App
    participant UC as UserController
    participant AS as AuthService
    participant ECS as EmailChangeService
    participant ORS as OtpRedisService
    participant ES as EmailService
    participant UR as UserRepository
    participant DB as Database

    U->>UI: 1. Input new Email & click "Change"
    UI->>UC: 2. requestEmailChange(emailRequest)
    activate UC
    UC->>AS: 3. getCurrentUser()
    UC->>ECS: 4. requestEmailChange(userId, newEmail)
    activate ECS
    ECS->>ORS: 5. Check Cooldown (60s)
    Note over ECS, ORS: If cooldown active -> Error 400
    ECS->>ORS: 6. saveEmailChangeOtp(userId, newEmail, otp)
    ECS->>ES: 7. sendEmailChangeOtpEmail(newEmail, otp)
    ECS-->>UC: 8. Success message
    deactivate ECS
    UC-->>UI: 9. Show OTP Input
    deactivate UC

    U->>UI: 10. Input OTP
    UI->>UC: 11. verifyEmailChange(verifyRequest)
    activate UC
    UC->>AS: 12. getCurrentUser()
    UC->>ECS: 13. verifyEmailChange(userId, newEmail, otp)
    activate ECS
    ECS->>ORS: 14. getEmailChangeOtp(userId)
    Note over ECS, ORS: Validate OTP & Max Attempts (3 times)
    ORS-->>ECS: 15. Valid
    ECS->>UR: 16. save(Updated User Email)
    activate UR
    UR->>DB: 17. Update User Email
    activate DB
    DB-->>UR: 18. Success
    deactivate DB
    UR-->>ECS: 19. Saved User
    deactivate UR
    ECS->>ORS: 20. deleteEmailChangeOtp(userId)
    ECS-->>UC: 21. UserResponse
    deactivate ECS
    UC-->>UI: 22. 200 OK (Updated Profile)
    deactivate UC
```

##### Change Password Flow

```mermaid
sequenceDiagram
    actor U as User
    participant UI as Change Password Screen
    participant UC as UserController
    participant US as UserService
    participant AS as AuthService
    participant UR as UserRepository
    participant DB as Database

    U->>UI: 1. Input Current & New Password
    UI->>UC: 2. changePassword(request)
    activate UC
    UC->>AS: 3. getCurrentUser()
    activate AS
    AS-->>UC: 4. User Entity
    deactivate AS
    UC->>US: 5. changePassword(userId, request)
    activate US
    US->>UR: 6. findById(userId)
    activate UR
    UR-->>US: 7. User Entity
    deactivate UR
    US->>US: 8. Verify matches(currentPass, storedPass)
    alt Password Mismatch
        US-->>UC: 9a. Throw BadRequestException
        UC-->>UI: 10a. Error: Incorrect Password
    else Valid Matches
        US->>US: 9b. passwordEncoder.encode(newPass)
        US->>UR: 10b. save(User)
        activate UR
        UR->>DB: 11b. Update Password
        activate DB
        DB-->>UR: 12b. Updated
        deactivate DB
        UR-->>US: 13b. OK
        deactivate UR
        US-->>UC: 14b. Success
        deactivate US
        UC-->>UI: 15b. 200 OK
        deactivate UC
        UI-->>U: 16b. Success Message
    end
```

#### 4.2.4 Cross-Reference to SRS

| SDD Section | SRS Reference | Description |
|-------------|---------------|-------------|
| 4.2.1 Class Diagram | 3.3 User Profile & Account Setup | Overall module structure |
| 4.2.2 View & Update Profile | 3.3.1 (UC-PO-03, UC-VT-02, UC-CM-02) | View and update personal info & avatar |
| 4.2.3 Change Password or Change Email | 3.3.2 (UC-PO-04, UC-VT-03) | Change password and email with OTP |

---

### 4.3 Staff and Scheduling Management

Tương tác quan trọng nhất là việc mời nhân viên (Staff/Manager) vào phòng khám và quản lý ca trực của họ.

#### 4.3.1 Class Diagram - Staffing & Scheduling

```mermaid
classDiagram
    class ClinicStaffController {
        -ClinicStaffService staffService
        +getStaff(UUID) ResponseEntity
        +inviteByEmail(UUID, InviteByEmailRequest) ResponseEntity
        +removeStaff(UUID, UUID) ResponseEntity
    }

    class ClinicStaffService {
        -UserRepository userRepository
        +getClinicStaff(UUID) List~StaffResponse~
        +inviteByEmail(UUID, InviteByEmailRequest) void
        +removeStaff(UUID, UUID) void
    }

    class VetShiftController {
        -VetShiftService vetShiftService
        +createShift(UUID, VetShiftRequest) ResponseEntity
        +getShiftsByClinic(UUID, LocalDate, LocalDate) ResponseEntity
        +deleteShift(UUID) ResponseEntity
        +blockSlot(UUID) ResponseEntity
    }

    class VetShiftService {
        -VetShiftRepository vetShiftRepository
        -SlotRepository slotRepository
        +createShifts(UUID, VetShiftRequest) List~VetShiftResponse~
        +generateSlots(VetShift, LocalTime, LocalTime) void
        +validateOperatingHours(...) void
        +blockSlot(UUID) SlotResponse
    }

    class VetShiftRepository {
        <<interface>>
        +findByClinicAndDateRange(...) List
        +existsByVet_UserIdAndWorkDateAndTimeRange(...) boolean
        +save(VetShift) VetShift
    }

    ClinicStaffController --> ClinicStaffService
    VetShiftController --> VetShiftService
    VetShiftService --> VetShiftRepository
    ClinicStaffService --> UserRepository
```

#### 4.3.2 Invite Staff by Email (UC-CM-03, UC-CO-06)

```mermaid
sequenceDiagram
    actor O as Clinic Owner/Manager
    participant UI as Staff List Screen
    participant SC as ClinicStaffController
    participant SS as ClinicStaffService
    participant AS as AuthService
    participant UR as UserRepository
    participant DB as Database

    O->>UI: 1. Input Email, Role, Specialty (No Name/Phone required)
    UI->>SC: 2. inviteByEmail(clinicId, request)
    activate SC
    SC->>SS: 3. inviteByEmail(clinicId, request)
    activate SS
    SS->>AS: 4. getCurrentUser()
    activate AS
    AS-->>SS: 5. currentUser
    deactivate AS
    SS->>SS: 6. Validate Permissions (Owner vs Manager)
    SS->>UR: 7. findByEmail(email)
    activate UR
    UR->>DB: 8. Query user
    activate DB
    DB-->>UR: 9. User Entity (or null)
    deactivate DB
    UR-->>SS: 10. User / null
    deactivate UR
    alt User Already Exists
        SS->>SS: 11a. Check if assigned to another clinic
        SS->>SS: 12a. Update Role & WorkingClinic
    else New User
        SS->>SS: 11b. Create User Entity (waiting for Google Login)
        SS->>SS: 12b. Set Random Password & WorkingClinic
    end
    SS->>UR: 13. save(User)
    activate UR
    UR->>DB: 14. Save to DB
    activate DB
    DB-->>UR: 15. OK
    deactivate DB
    UR-->>SS: 16. OK
    deactivate UR
    SS-->>SC: 17. void
    deactivate SS
    SC-->>UI: 18. 200 OK (Success Message)
    deactivate SC
    UI-->>O: 19. "Staff invited successfully" notification
```

#### 4.3.3 Create Staff Shift (UC-CM-04, UC-CO-07)

```mermaid
sequenceDiagram
    actor M as Clinic Manager
    participant UI as VetShift Dashboard (Web)
    participant C as VetShiftController
    participant S as VetShiftService
    participant R as VetShiftRepository
    participant DB as Database

    M->>UI: 1. Choose Staff, Dates, Time Range
    UI->>C: 2. createShift(clinicId, request)
    activate C
    C->>S: 3. createShifts(clinicId, request)
    activate S
    loop For each WorkDate
        S->>R: 4. Check for overlaps (existsBy...)
        R-->>S: 5. Conflict found (Boolean/Entity)
        alt forceUpdate = false AND Conflicts exist
            S-->>C: 6a. throw ConflictException
            C-->>UI: 7a. 409 Conflict (Return conflict details)
            UI-->>M: 8a. Show Conflict Warning Modal
        else No Conflicts OR forceUpdate = true
            S->>S: 6b. Create VetShift Entity
            S->>S: 7b. Generate 30-min Slots
            S->>R: 8b. Save Shift & Slots
            R->>DB: 9b. Persist
            DB-->>R: 10b. OK
        end
    end
    S-->>C: 11. List~VetShiftResponse~
    deactivate S
    C-->>UI: 12. 201 Created
    deactivate C
    UI-->>M: 13. Refresh Calendar
```

#### 4.3.4 Delete Shift & Slot Operations

```mermaid
sequenceDiagram
    actor M as Clinic Manager
    participant UI as Manager Dashboard (Web)
    participant C as VetShiftController
    participant S as VetShiftService
    participant VSR as VetShiftRepository
    participant SR as SlotRepository
    participant DB as Database

    M->>UI: 1. Select shift & click "Delete"
    activate UI
    UI->>C: 2. deleteShift(shiftId)
    activate C
    C->>S: 3. deleteShift(id)
    activate S
    S->>VSR: 4. findById(id)
    activate VSR
    VSR->>DB: 5. Query shift by ID
    activate DB
    DB-->>VSR: 6. VetShift with Slots
    deactivate DB
    VSR-->>S: 7. VetShift Entity
    deactivate VSR
    S->>S: 8. Check all slots AVAILABLE or BLOCKED
    alt Has BOOKED slots
        S-->>C: 9a. throw BadRequestException
        C-->>UI: 10a. 400 Error: Cannot delete shift with bookings
        UI-->>M: 11a. Show error message
    else All slots deletable
        S->>SR: 9b. deleteAll(slots)
        activate SR
        SR->>DB: 10b. Delete all slots of shift
        activate DB
        DB-->>SR: 11b. Deleted
        deactivate DB
        SR-->>S: 12b. OK
        deactivate SR
        S->>VSR: 13b. delete(shift)
        activate VSR
        VSR->>DB: 14b. Delete shift
        activate DB
        DB-->>VSR: 15b. Deleted
        deactivate DB
        VSR-->>S: 16b. OK
        deactivate VSR
        S-->>C: 17b. void
        deactivate S
        C-->>UI: 18b. 204 No Content
        deactivate C
        UI-->>M: 19b. Remove shift from Calendar
        deactivate UI
    end
```
#### 4.3.5 Business Rules

1.  **Staff Roles Control:**
    -   CLINIC_OWNER có quyền thêm CLINIC_MANAGER và STAFF.
    -   CLINIC_MANAGER chỉ có quyền thêm Nhân viên (STAFF).
2.  **Manager Limit:** Mỗi phòng khám chỉ có tối đa 1 Manager.
3.  **Invitation Logic:** Hỗ trợ mời staff qua email. Nếu email chưa có tài khoản, hệ thống tạo user chờ đăng nhập qua Google OAuth. **Họ tên và Avatar sẽ được đồng bộ tự động từ Google Profile khi login lần đầu**, người mời không cần nhập. (Phone là thông tin không bắt buộc).
4.  **Slot Duration:** Tự động tạo slots 30 phút khi tạo shift.
5.  **Break Time Sync:** Giờ nghỉ tự động lấy từ Clinic Operating Hours nếu shift nằm trong khoảng đó.
6.  **Overnight Shifts:** Nếu endTime < startTime (vd: 22:00 → 06:00), hệ thống tự detect và set isOvernight = true.
7.  **Overlap Prevention:** Mỗi vet chỉ có 1 shift/ngày. Sử dụng forceUpdate=true để ghi đè shift cũ.
8.  **Delete Protection:** Không thể xóa shift có slots ở trạng thái BOOKED.
9.  **Block Permission:** Chỉ CLINIC_OWNER và CLINIC_MANAGER được block/unblock slots.
10. **Repeat Weeks:** Có thể tạo lịch lặp lại tối đa 12 tuần liên tiếp.
11. **Past Date Skip:** Không tạo shift cho ngày trong quá khứ.
12. **Closed Day Skip:** Không tạo shift vào ngày phòng khám đóng cửa.
13. **SSE Notifications:** Gửi batch notification cho Staff khi được assign shifts mới.

---

### 4.4 Pet Profile Management

#### 4.4.1 Class Diagram - Pet Records

```mermaid
classDiagram
    class PetController {
        -PetService petService
        +getPets(String species, String breed, Pageable) ResponseEntity
        +getMyPets() ResponseEntity
        +getPet(UUID) ResponseEntity
        +createPet(PetRequest, MultipartFile) ResponseEntity
        +updatePet(UUID, PetRequest, MultipartFile) ResponseEntity
        +deletePet(UUID) ResponseEntity
    }

    class PetService {
        -PetRepository petRepository
        -AuthService authService
        -CloudinaryService cloudinaryService
        +createPet(PetRequest, MultipartFile) PetResponse
        +getMyPets() List~PetResponse~
        +getPet(UUID) PetResponse
        +updatePet(UUID, PetRequest, MultipartFile) PetResponse
        +deletePet(UUID) void
    }

    class PetRepository {
        <<interface>>
        +findById(UUID) Optional~Pet~
        +findByOwner(User) List~Pet~
        +save(Pet) Pet
        +delete(Pet) void
    }

    class Pet {
        +UUID id
        +String name
        +String species
        +String breed
        +LocalDate dateOfBirth
        +Double weight
        +String gender
        +String imageUrl
        +User owner
    }

    class CloudinaryService {
        +uploadImage(MultipartFile, String folder) UploadResponse
        +deleteImage(String publicId) void
    }

    PetController --> PetService
    PetService --> PetRepository
    PetRepository ..> Pet
    PetService --> CloudinaryService
```

#### 4.4.2 Add New Pet Record (UC-PO-04)

```mermaid
sequenceDiagram
    actor Owner as Pet Owner
    participant UI as Add Pet Screen (Mobile)
    participant PC as PetController
    participant PS as PetService
    participant AS as AuthService
    participant CS as CloudinaryService
    participant DB as Database

    Owner->>UI: 1. Input pet info & select image & click "Save"
    activate UI
    UI->>PC: 2. createPet(petRequest, imageFile)
    activate PC
    PC->>PS: 3. createPet(request, image)
    activate PS
    PS->>AS: 4. getCurrentUser()
    activate AS
    AS-->>PS: 5. User Entity
    deactivate AS
    alt Image is provided
        PS->>CS: 6a. uploadImage(image, "pets")
        activate CS
        CS-->>PS: 7a. UploadResponse (URL)
        deactivate CS
    end
    PS->>PR: 8. save(Pet Entity)
    activate PR
    PR-->>PS: 9. Saved Pet
    deactivate PR
    PS-->>PC: 10. PetResponse
    deactivate PS
    PC-->>UI: 11. PetResponse(created)
    deactivate PC
    UI-->>Owner: 12. Show new pet in list
    deactivate UI
```

#### 4.4.3 Update Pet Info (UC-PO-11)

```mermaid
sequenceDiagram
    actor Owner as Pet Owner
    participant UI as Edit Pet Screen (Mobile)
    participant PC as PetController
    participant PS as PetService
    participant CS as CloudinaryService
    participant DB as Database

    Owner->>UI: 1. Edit pet info & click "Save"
    activate UI
    UI->>PC: 2. updatePet(petId, petRequest, imageFile)
    activate PC
    PC->>PS: 3. updatePet(id, request, image)
    activate PS
    PS->>DB: 4. findById(id)
    activate DB
    DB-->>PS: 5. Pet Entity
    deactivate DB
    PS->>PS: 6. validateOwnership(pet, currentUser)
    alt New image provided
        PS->>CS: 7a. deleteImage(oldPublicId)
        activate CS
        CS-->>PS: 8a. OK
        PS->>CS: 9a. uploadImage(newImage, "pets")
        CS-->>PS: 10a. New URL
        deactivate CS
    end
    PS->>DB: 11. save(Updated Pet)
    activate DB
    DB-->>PS: 12. OK
    deactivate DB
    PS-->>PC: 13. PetResponse
    deactivate PS
    PC-->>UI: 14. PetResponse(updated)
    deactivate PC
    UI-->>Owner: 15. Show updated pet
    deactivate UI
```

#### 4.4.4 Delete Pet (UC-PO-26)

```mermaid
sequenceDiagram
    actor Owner as Pet Owner
    participant UI as Pet Detail Screen (Mobile)
    participant PC as PetController
    participant PS as PetService
    participant CS as CloudinaryService
    participant DB as Database

    Owner->>UI: 1. Click "Delete" & confirm
    activate UI
    UI->>PC: 2. deletePet(petId)
    activate PC
    PC->>PS: 3. deletePet(id)
    activate PS
    PS->>DB: 4. findById(id)
    activate DB
    DB-->>PS: 5. Pet Entity
    deactivate DB
    PS->>PS: 6. validateOwnership(pet, currentUser)
    alt Pet has image
        PS->>CS: 7a. deleteImage(publicId)
        activate CS
        CS-->>PS: 8a. OK
        deactivate CS
    end
    PS->>DB: 9. delete(Pet)
    activate DB
    DB-->>PS: 10. OK
    deactivate DB
    PS-->>PC: 11. 204 No Content
    deactivate PS
    PC-->>UI: 12. Success
    deactivate PC
    UI-->>Owner: 13. Remove pet from list
    deactivate UI
```


---

### 4.5 Patient Management

Module quản lý bệnh nhân (Patient) tại phòng khám. Cho phép Staff và Clinic Manager tìm kiếm, xem danh sách và chi tiết hồ sơ bệnh nhân.

#### 4.5.1 Class Diagram - Patient Management

```mermaid
classDiagram
    class PatientController {
        -PatientService patientService
        +searchPatients(UUID, String) ResponseEntity
        +getClinicPatients(UUID, Pageable) ResponseEntity
        +getPatientDetail(UUID) ResponseEntity
    }

    class PatientService {
        -PetRepository petRepository
        -BookingRepository bookingRepository
        -UserRepository userRepository
        +searchPatients(UUID, String) List~PatientResponse~
        +getClinicPatients(UUID, Pageable) Page~PatientResponse~
        +getPatientDetail(UUID) PatientDetailResponse
    }

    class PetRepository {
        <<interface>>
        +findById(UUID) Optional~Pet~
        +findByUserId(UUID) List~Pet~
    }

    class Pet {
        +UUID id
        +UUID userId
        +String name
        +String species
        +String breed
        +BigDecimal weight
        +String imageUrl
    }

    PatientController --> PatientService
    PatientService --> PetRepository
    PetRepository ..> Pet
```


#### 4.5.2 Lookup Patient (UC-VT-12)

```mermaid
sequenceDiagram
    actor V as Staff
    participant UI as Search Interface
    participant PC as PatientController
    participant PS as PatientService
    participant PR as PetRepository
    participant UR as UserRepository
    participant DB as PostgreSQL

    V->>UI: 1. Enter search query (name/owner/bookingId)
    activate UI
    UI->>PC: 2. GET /patients/search?q=query&clinicId=xxx
    activate PC
    PC->>PS: 3. searchPatients(clinicId, query)
    activate PS
    PS->>PR: 4. findByNameContainingAndClinicId(query, clinicId)
    activate PR
    PR->>DB: 5. SELECT pets WHERE name LIKE %query%
    activate DB
    DB-->>PR: 6. List<Pet>
    deactivate DB
    PR-->>PS: 7. Pets matching name
    deactivate PR
    PS->>UR: 8. findByNameContaining(query)
    activate UR
    UR->>DB: 9. SELECT users WHERE fullName LIKE %query%
    activate DB
    DB-->>UR: 10. List<User> (Owners)
    deactivate DB
    UR-->>PS: 11. Users matching
    deactivate UR
    PS->>PS: 12. Merge & filter by clinic visits
    PS-->>PC: 13. List<PatientSearchResponse>
    deactivate PS
    PC-->>UI: 14. 200 OK (paginated results)
    deactivate PC
    UI-->>V: 15. Display patient cards
    deactivate UI
```

#### 4.5.3 View Patient List (UC-CM-08)

```mermaid
sequenceDiagram
    actor M as Manager
    participant UI as Patient List Page
    participant PC as PatientController
    participant PS as PatientService
    participant BR as BookingRepository
    participant PR as PetRepository
    participant DB as PostgreSQL

    M->>UI: 1. Navigate to Patients Tab
    activate UI
    UI->>PC: 2. GET /patients?clinicId=xxx&page=0&size=20
    activate PC
    PC->>PS: 3. getPatientList(clinicId, filters, pageable)
    activate PS
    PS->>BR: 4. findDistinctPetsByClinicId(clinicId)
    activate BR
    BR->>DB: 5. SELECT DISTINCT pet_id FROM bookings WHERE clinic_id=xxx
    activate DB
    DB-->>BR: 6. List<UUID> petIds
    deactivate DB
    BR-->>PS: 7. Pet IDs
    deactivate BR
    PS->>PR: 8. findAllById(petIds)
    activate PR
    PR->>DB: 9. SELECT * FROM pets WHERE id IN (...)
    activate DB
    DB-->>PR: 10. List<Pet>
    deactivate DB
    PR-->>PS: 11. Pets with owner info
    deactivate PR
    PS->>PS: 12. Aggregate visit counts & last visit dates
    PS-->>PC: 13. Page<PatientListResponse>
    deactivate PS
    PC-->>UI: 14. 200 OK (paginated list)
    deactivate PC
    UI-->>M: 15. Render patient table with filters
    deactivate UI
```

#### 4.5.4 View Patient Records (UC-CM-09)

```mermaid
sequenceDiagram
    actor M as Manager
    participant UI as Patient Detail Page
    participant PC as PatientController
    participant PS as PatientService
    participant PR as PetRepository
    participant ER as EMRRepository
    participant VR as VaccinationRepository
    participant PG as PostgreSQL
    participant MG as MongoDB

    M->>UI: 1. Click patient row -> View Records
    activate UI
    UI->>PC: 2. GET /patients/{petId}/records?clinicId=xxx
    activate PC
    PC->>PS: 3. getPatientRecords(petId, clinicId)
    activate PS
    PS->>PR: 4. findById(petId)
    activate PR
    PR->>PG: 5. Query pet profile
    activate PG
    PG-->>PR: 6. Pet Entity
    deactivate PG
    PR-->>PS: 7. Pet with owner
    deactivate PR
    PS->>ER: 8. findByPetIdAndClinicId(petId, clinicId)
    activate ER
    ER->>MG: 9. Query EMR documents
    activate MG
    MG-->>ER: 10. List<EMRRecord>
    deactivate MG
    ER-->>PS: 11. EMR history
    deactivate ER
    PS->>VR: 12. findByPetId(petId)
    activate VR
    VR->>MG: 13. Query vaccination documents
    activate MG
    MG-->>VR: 14. List<VaccinationRecord>
    deactivate MG
    VR-->>PS: 15. Vaccination history
    deactivate VR
    PS->>PS: 16. Build timeline & aggregate
    PS-->>PC: 17. PatientRecordsResponse
    deactivate PS
    PC-->>UI: 18. 200 OK (full history)
    deactivate PC
    UI-->>M: 19. Render timeline, tabs, export button
    deactivate UI
```

---

### 4.6 EMR & Vaccination Management

#### 4.6.1 Class Diagram - EMR

```mermaid
classDiagram
    class PatientController {
        -PatientService patientService
        +searchPatients(UUID, String) ResponseEntity
        +getPetMedicalHistory(UUID) ResponseEntity
        +createEMR(UUID, EMRRequest) ResponseEntity
        +addVaccinationRecord(UUID, VaccinationRequest) ResponseEntity
    }

    class PatientService {
        -PetRepository petRepository
        -EMRRepository emrRepository
        -VaccinationRepository vaccinationRepository
        -BookingRepository bookingRepository
        +searchPatients(UUID, String) List~PatientResponse~
        +getPetMedicalHistory(UUID, UUID) PetHistoryResponse
        +createEMR(UUID, EMRRequest) EMRResponse
        +addVaccinationRecord(UUID, VaccinationRequest) VaccinationResponse
    }

    class EMRRepository {
        <<interface>>
        +findById(UUID) Optional~EMR~
        +findByPet(Pet) List~EMR~
        +save(EMR) EMR
    }

    class VaccinationRepository {
        <<interface>>
        +findByPet(Pet) List~Vaccination~
        +save(Vaccination) Vaccination
    }

    class EMR {
        +UUID emrId
        +Booking booking
        +Pet pet
        +String subjective
        +String objective
        +String assessment
        +String plan
        +List~ClinicService~ additionalServices
        +List~IncurredCost~ miscCosts
    }

    class IncurredCost {
        +UUID costId
        +String itemName
        +BigDecimal amount
        +Integer quantity
    }

    class Vaccination {
        +UUID vaccinationId
        +Pet pet
        +String vaccineName
        +LocalDate administeredDate
        +LocalDate nextDueDate
    }

    PatientController --> PatientService
    PatientService --> EMRRepository
    PatientService --> VaccinationRepository
    EMRRepository ..> EMR
    EMR --> IncurredCost
    VaccinationRepository ..> Vaccination
```

#### 4.6.2 View Pet Medical History (Cross-Clinic) (UC-VT-02)

```mermaid
sequenceDiagram
    actor V as Staff
    participant UI as Staff Dashboard
    participant PC as PatientController
    participant PS as PatientService
    participant BR as BookingRepository
    participant EMRR as EMRRepository
    participant VR as VaccinationRepository
    participant DB as Database

    V->>UI: 1. Search Pet or Select from Booking
    activate UI
    UI->>PC: 2. getPetMedicalHistory(petId)
    activate PC
    PC->>PS: 3. getPetMedicalHistory(petId, clinicId)
    activate PS
    PS->>BR: 4. Check entitlement (petId, clinicId)
    activate BR
    BR->>DB: 5. Query pet bookings for clinic
    activate DB
    DB-->>BR: 6. Booking exists
    deactivate DB
    BR-->>PS: 7. Confirmed
    deactivate BR
    PS->>EMRR: 8. findByPet(petId)
    activate EMRR
    EMRR->>DB: 9. Query EMR records for pet
    activate DB
    DB-->>EMRR: 10. EMR List
    deactivate DB
    EMRR-->>PS: 11. List<EMR>
    deactivate EMRR
    PS->>VR: 12. findByPet(petId)
    activate VR
    VR->>DB: 13. Query vaccination records for pet
    activate DB
    DB-->>VR: 14. Vaccination List
    deactivate DB
    VR-->>PS: 15. List<Vaccination>
    deactivate VR
    PS-->>PC: 16. PetHistoryResponse
    deactivate PS
    PC-->>UI: 17. 200 OK
    deactivate PC
    UI-->>V: 18. Display history timeline
    deactivate UI
```

#### 4.6.3 Create EMR (SOAP Notes) (EMR-2, UC-VT-06)

Staff Create EMR now includes two read-only context blocks before completion of the SOAP flow: an `AI Health Summary` card backed by `PetHealthSummaryLLMService`, and an `EMR History Summary` panel showing the 3 most recent EMR records for the same pet. The health-summary endpoint remains shared with the existing pet health summary feature, but Staff access is restricted to pets already linked to the staff's current clinic through booking or EMR data.

```mermaid
sequenceDiagram
    actor V as Staff
    participant UI as EMR Form (Mobile/Web)
    participant PC as PatientController
    participant PS as PatientService
    participant BR as BookingRepository
    participant PR as PetRepository
    participant EMRR as EMRRepository
    participant AI as AI Service
    participant DB as Database

    V->>UI: 1. Open Create EMR screen
    activate UI
    UI->>PC: 2. getHealthSummary(petId)
    activate PC
    PC->>PS: 3. getHealthSummary(petId)
    activate PC
    activate PS
    PS->>PS: 4. Validate pet owner or staff clinic scope
    PS->>EMRR: 5. findByPetIdOrderByCreatedAtDesc(petId)
    activate EMRR
    EMRR->>DB: 6. Query EMR history
    activate DB
    DB-->>EMRR: 7. EMR list
    deactivate DB
    EMRR-->>PS: 8. EMR list
    deactivate EMRR
    PS->>AI: 9. POST /pet-health-summary/synthesize
    activate AI
    AI-->>PS: 10. AI health summary payload
    deactivate AI
    PS-->>PC: 11. PetHealthSummaryResponse
    deactivate PS
    PC-->>UI: 12. 200 OK
    deactivate PC
    UI-->>V: 13. Show AI Health Summary + EMR History Summary
    deactivate UI

    V->>UI: 14. Fill SOAP form (S, O, A, P + Weight)
    activate UI
    UI->>PC: 15. createEMR(bookingId, EMRRequest)
    activate PC
    PC->>PS: 16. createEMR(bookingId, request)
    activate PS
    PS->>BR: 17. findById(bookingId)
    activate BR
    BR->>DB: 18. Query booking by ID
    activate DB
    DB-->>BR: 19. Booking Entity
    deactivate DB
    BR-->>PS: 20. Booking
    deactivate BR
    PS->>PS: 21. Validate status == IN_PROGRESS
    PS->>PS: 22. Validate Staff is assigned
    PS->>EMRR: 23. save(EMR: subjective, objective, assessment, plan)
    activate EMRR
    EMRR->>DB: 24. Insert new EMR record
    activate DB
    DB-->>EMRR: 25. Inserted
    deactivate DB
    EMRR-->>PS: 26. Saved EMR
    deactivate EMRR
    PS->>PR: 27. updatePetWeight(petId, newWeight)
    activate PR
    PR->>DB: 28. Update pet weight
    activate DB
    DB-->>PR: 29. Updated
    deactivate DB
    PR-->>PS: 30. OK
    deactivate PR
    PS-->>PC: 31. EMRResponse
    deactivate PS
    PC-->>UI: 32. 201 Created
    deactivate PC
    UI-->>V: 33. Show success & update medical timeline
    deactivate UI
```

#### 4.6.4 Add Vaccination Record (UC-VT-08)

```mermaid
sequenceDiagram
    actor V as Staff
    participant UI as Vaccination Form
    participant PC as PatientController
    participant PS as PatientService
    participant PR as PetRepository
    participant VR as VaccinationRepository
    participant DB as Database

    V->>UI: 1. Fill vaccine info & click "Add"
    activate UI
    UI->>PC: 2. addVaccinationRecord(petId, vaccinationRequest)
    activate PC
    PC->>PS: 3. addVaccinationRecord(petId, request)
    activate PS
    PS->>PR: 4. findById(petId)
    activate PR
    PR->>DB: 5. Query pet by ID
    activate DB
    DB-->>PR: 6. Pet Entity
    deactivate DB
    PR-->>PS: 7. Pet
    deactivate PR
    PS->>PS: 8. Validate entitlement
    PS->>VR: 9. save(Vaccination entity)
    activate VR
    VR->>DB: 10. Insert vaccination record
    activate DB
    DB-->>VR: 11. Inserted
    deactivate DB
    VR-->>PS: 12. Saved Vaccination
    deactivate VR
    PS-->>PC: 13. VaccinationResponse
    deactivate PS
    PC-->>UI: 14. 201 Created
    deactivate PC
    UI-->>V: 15. Update vaccination card
    deactivate UI
```

#### 4.6.5 Additional Service & Incurred Costs (UC-VT-10)

```mermaid
sequenceDiagram
    actor V as Staff
    participant UI as EMR Interface
    participant PC as PatientController
    participant PS as PatientService
    participant SR as ServiceRepository
    participant BR as BookingRepository
    participant DB as Database

    alt Standard Service
        V->>UI: 1a. Select from Clinic Catalog
        UI->>PC: 2a. addAdditionalService(bookingId, serviceId)
        PC->>PS: 3a. addAdditionalService(...)
        PS->>SR: 4a. findById(serviceId)
        activate SR
        SR->>DB: 5a. Query clinic service by ID
        activate DB
        DB-->>SR: 6a. Service Entity (Price)
        deactivate DB
        SR-->>PS: 7a. Service
        deactivate SR
    else Custom Incurred Cost
        V->>UI: 1b. Type name & manual price
        UI->>PC: 2b. addIncurredCost(bookingId, costRequest)
        PC->>PS: 3b. addIncurredCost(...)
        Note over PS: Create IncurredCost entity
    end

    PS->>BR: 8. findById(bookingId)
    activate BR
    BR->>DB: 9. Query booking by ID
    activate DB
    DB-->>BR: 10. Booking Entity
    deactivate DB
    BR-->>PS: 11. Booking
    deactivate BR
    
    PS->>PS: 12. Recalculate totalPrice
    Note over PS: Total = Base + Surcharge + Services + Misc
    
    PS->>BR: 13. save(Updated Booking)
    activate BR
    BR->>DB: 14. Update booking total price
    activate DB
    DB-->>BR: 15. Updated
    deactivate DB
    BR-->>PS: 16. OK
    deactivate BR
    
    PS-->>PC: 17. Success
    PC-->>UI: 18. 200 OK (Updated Balance)
    UI-->>V: 19. Update UI with new Total
```

#### 4.6.6 Add Vaccination Record (UC-VT-08)

```mermaid
sequenceDiagram
    actor V as Staff
    participant UI as EMR/Health Hub
    participant PC as PatientController
    participant PS as PatientService
    participant VR as VaccinationRepository
    participant PR as PetRepository
    participant DB as MongoDB

    V->>UI: 1. Click "Add Vaccination"
    activate UI
    V->>UI: 2. Enter: VaccineName, BatchNo, Date, NextDue
    UI->>PC: 3. POST /vaccinations (VaccinationRequest)
    activate PC
    PC->>PS: 4. addVaccinationRecord(petId, request)
    activate PS
    PS->>PR: 5. findById(petId)
    activate PR
    PR-->>PS: 6. Pet Entity
    deactivate PR
    PS->>VR: 7. save(VaccinationRecord)
    activate VR
    VR->>DB: 8. Insert vaccination document
    activate DB
    DB-->>VR: 9. Saved
    deactivate DB
    VR-->>PS: 10. VaccinationRecord
    deactivate VR
    PS->>PS: 11. Schedule reminder notification
    PS-->>PC: 12. VaccinationResponse
    deactivate PS
    PC-->>UI: 13. 201 Created
    deactivate PC
    UI-->>V: 14. Show success & update Health Badge
    deactivate UI
```

---

### 4.7 Service Management

Module quản lý dịch vụ phòng khám (Clinic Services) và dịch vụ mẫu hệ thống (Master Services). Cho phép Clinic Owner tạo, chỉnh sửa, xóa dịch vụ của phòng khám; Admin quản lý danh sách dịch vụ mẫu.

#### 4.7.1 Class Diagram - Service Management

```mermaid
classDiagram
    class ClinicServiceController {
        -ClinicServiceService clinicServiceService
        -VaccineDosePriceService vaccineDosePriceService
        +createService(ClinicServiceRequest) ResponseEntity
        +getAllServices() ResponseEntity
        +getServiceById(UUID) ResponseEntity
        +updateService(UUID, ClinicServiceUpdateRequest) ResponseEntity
        +deleteService(UUID, UUID) ResponseEntity
        +updateServiceStatus(UUID, Boolean) ResponseEntity
        +updateHomeVisitStatus(UUID, Boolean) ResponseEntity
        +inheritFromMasterService(UUID, UUID, BigDecimal, BigDecimal) ResponseEntity
        +getServicesByClinicId(UUID) ResponseEntity
        +getCompatibleServices(UUID, PetSpecies, Boolean) ResponseEntity
        +getDosePrices(UUID) ResponseEntity
        +setDosePrice(UUID, Integer, String, BigDecimal) ResponseEntity
    }

    class MasterServiceController {
        -MasterServiceService masterServiceService
        +createMasterService(MasterServiceRequest) ResponseEntity
        +getAllMasterServices() ResponseEntity
        +getMasterServiceById(UUID) ResponseEntity
        +updateMasterService(UUID, MasterServiceUpdateRequest) ResponseEntity
        +deleteMasterService(UUID) ResponseEntity
        +searchMasterServices(String) ResponseEntity
        +getMasterServicesByCategory(String) ResponseEntity
        +getMasterServicesByPetType(String) ResponseEntity
    }

    class ClinicServiceService {
        -ClinicServiceRepository serviceRepository
        -MasterServiceRepository masterServiceRepository
        +createService(ClinicServiceRequest) ClinicServiceResponse
        +getAllServices() List~ClinicServiceResponse~
        +getServiceById(UUID) ClinicServiceResponse
        +updateService(UUID, ClinicServiceUpdateRequest) ClinicServiceResponse
        +deleteService(UUID, UUID) void
        +updateServiceStatus(UUID, Boolean) ClinicServiceResponse
        +inheritFromMasterService(UUID, UUID, BigDecimal, BigDecimal) ClinicServiceResponse
        +getCompatibleServices(UUID, PetSpecies, Boolean) List~ClinicServiceResponse~
    }

    class MasterServiceService {
        -MasterServiceRepository masterServiceRepository
        +createMasterService(MasterServiceRequest) MasterServiceResponse
        +getAllMasterServices() List~MasterServiceResponse~
        +getMasterServiceById(UUID) MasterServiceResponse
        +updateMasterService(UUID, MasterServiceUpdateRequest) MasterServiceResponse
        +deleteMasterService(UUID) void
        +searchMasterServicesByName(String) List~MasterServiceResponse~
    }

    class VaccineDosePriceService {
        -VaccineDosePriceRepository dosePriceRepository
        +getDosePrices(UUID) List~VaccineDosePriceDTO~
        +setDosePrice(UUID, Integer, String, BigDecimal) VaccineDosePriceDTO
        +deleteDosePrice(UUID, Integer) void
    }

    class ClinicServiceRepository {
        <<interface>>
        +findById(UUID) Optional~ClinicService~
        +findByClinicId(UUID) List~ClinicService~
        +save(ClinicService) ClinicService
        +deleteById(UUID) void
    }

    class MasterServiceRepository {
        <<interface>>
        +findById(UUID) Optional~MasterService~
        +findAll() List~MasterService~
        +findByNameContaining(String) List~MasterService~
    }

    class ClinicService {
        +UUID serviceId
        +UUID clinicId
        +UUID masterServiceId
        +Boolean isCustom
        +String name
        +String description
        +BigDecimal basePrice
        +Integer durationTime
        +Integer slotsRequired
        +Boolean isActive
        +Boolean isHomeVisit
        +ServiceCategory serviceCategory
    }

    class MasterService {
        +UUID masterServiceId
        +String name
        +String description
        +BigDecimal defaultPrice
        +Integer durationTime
        +Boolean isHomeVisit
        +String serviceCategory
        +String petType
    }

    class ServiceCategory {
        <<enumeration>>
        GROOMING_SPA
        VACCINATION
        CHECK_UP
        SURGERY
        DENTAL
        DERMATOLOGY
        OTHER
    }

    ClinicServiceController --> ClinicServiceService
    ClinicServiceController --> VaccineDosePriceService
    MasterServiceController --> MasterServiceService
    ClinicServiceService --> ClinicServiceRepository
    MasterServiceService --> MasterServiceRepository
    ClinicServiceRepository ..> ClinicService
    MasterServiceRepository ..> MasterService
    ClinicService --> ServiceCategory
```

#### 4.7.2 Create Service

> **Sequence Diagram:** TODO - Clinic Owner tạo dịch vụ mới cho phòng khám.

#### 4.7.3 Create Master Service

> **Sequence Diagram:** TODO - Admin tạo dịch vụ mẫu hệ thống.

#### 4.7.4 Update Service

> **Sequence Diagram:** TODO - Clinic Owner cập nhật thông tin dịch vụ.

#### 4.7.5 Update Master Service

> **Sequence Diagram:** TODO - Admin cập nhật dịch vụ mẫu.

#### 4.7.6 Delete Service

> **Sequence Diagram:** TODO - Clinic Owner xóa dịch vụ phòng khám.

#### 4.7.7 Delete Master Service

> **Sequence Diagram:** TODO - Admin xóa dịch vụ mẫu.

#### 4.7.8 View All Service

> **Sequence Diagram:** TODO - Xem danh sách dịch vụ của phòng khám.

#### 4.7.9 View All Master Service

> **Sequence Diagram:** TODO - Xem danh sách dịch vụ mẫu hệ thống.

#### 4.7.10 View Detail Service

> **Sequence Diagram:** TODO - Xem chi tiết dịch vụ phòng khám.

#### 4.7.11 View Detail Master Service

> **Sequence Diagram:** TODO - Xem chi tiết dịch vụ mẫu.

#### 4.7.12 Inheritance Master Service For Clinics

> **Sequence Diagram:** TODO - Clinic Owner kế thừa dịch vụ mẫu cho phòng khám.


---

### 4.8 Chat Management

Module quản lý tin nhắn giữa Pet Owner và Clinic (1-1 chat). Hỗ trợ gửi tin nhắn text, hình ảnh, đánh dấu đã đọc, và WebSocket real-time.

#### 4.8.1 Class Diagram - Chat Management

```mermaid
classDiagram
    class ChatController {
        -ChatService chatService
        -AuthService authService
        -CloudinaryService cloudinaryService
        +createOrGetConversation(CreateConversationRequest) ResponseEntity
        +getConversations(int, int) ResponseEntity
        +getConversation(String) ResponseEntity
        +getMessages(String, int, int) ResponseEntity
        +sendMessage(String, SendMessageRequest) ResponseEntity
        +sendMessageWithFile(String, String, MultipartFile) ResponseEntity
        +uploadImage(String, MultipartFile) ResponseEntity
        +markAsRead(String) ResponseEntity
        +getUnreadCount() ResponseEntity
    }

    class ChatService {
        -ChatConversationRepository conversationRepo
        -ChatMessageRepository messageRepo
        -SimpMessagingTemplate messagingTemplate
        +createOrGetConversation(UUID, CreateConversationRequest) ConversationResponse
        +getConversations(UUID, Role, Pageable) Page~ConversationResponse~
        +getConversation(String, UUID) ConversationResponse
        +sendMessage(String, UUID, SenderType, SendMessageRequest) MessageResponse
        +getMessages(String, UUID, Pageable) Page~MessageResponse~
        +markAsRead(String, UUID) void
        +getUnreadCount(UUID, Role) UnreadCountResponse
    }

    class ChatConversationRepository {
        <<interface>>
        +findByPetOwnerIdAndClinicId(UUID, UUID) Optional~ChatConversation~
        +findByPetOwnerId(UUID) List~ChatConversation~
        +findByClinicId(UUID) List~ChatConversation~
    }

    class ChatConversation {
        +ObjectId id
        +UUID petOwnerId
        +UUID clinicId
        +String lastMessage
        +DateTime lastMessageAt
        +String status
    }

    class ChatMessage {
        +ObjectId id
        +ObjectId chatBoxId
        +UUID senderId
        +String senderType
        +String content
        +String messageType
        +Boolean isRead
    }

    ChatController --> ChatService
    ChatService --> ChatConversationRepository
    ChatConversationRepository ..> ChatConversation
    ChatConversation --* ChatMessage
```

#### 4.8.2 Create Conversation

> **Sequence Diagram:** TODO - Pet Owner tạo cuộc hội thoại mới với phòng khám.

#### 4.8.3 View All Conversation

> **Sequence Diagram:** TODO - Xem danh sách tất cả cuộc hội thoại.

#### 4.8.4 Delete Message

> **Sequence Diagram:** TODO - Xóa tin nhắn trong cuộc hội thoại.

#### 4.8.5 Send Message

> **Sequence Diagram:** TODO - Gửi tin nhắn text/hình ảnh trong cuộc hội thoại.

#### 4.8.6 View Chat History

> **Sequence Diagram:** TODO - Xem lịch sử tin nhắn trong cuộc hội thoại.

#### 4.8.7 Create Auto Reply

> **Sequence Diagram:** TODO - Clinic tạo tin nhắn tự động trả lời.

#### 4.8.8 Update Auto Reply Message

> **Sequence Diagram:** TODO - Clinic cập nhật tin nhắn tự động trả lời.


---

### 4.9 Booking Review Management

Module quản lý đánh giá (review) sau khi hoàn tất booking. Pet Owner có thể đánh giá phòng khám theo rating (1-5 sao) và nhận xét. Điểm đánh giá trung bình được cập nhật vào Clinic profile.

#### 4.9.1 Class Diagram - Booking Review Management

```mermaid
classDiagram
    class ReviewController {
        -ReviewService reviewService
        -UserRepository userRepository
        +createReview(ReviewRequestDTO) ResponseEntity
        +updateReview(UUID, ReviewRequestDTO) ResponseEntity
        +deleteReview(UUID) ResponseEntity
        +getClinicReviews(UUID) ResponseEntity
    }

    class ReviewService {
        -ReviewRepository reviewRepository
        -BookingRepository bookingRepository
        -ClinicRepository clinicRepository
        +createReview(User, ReviewRequestDTO) ReviewResponseDTO
        +updateReview(UUID, User, ReviewRequestDTO) ReviewResponseDTO
        +deleteReview(UUID, User) void
        +getClinicReviews(UUID) List~ReviewResponseDTO~
    }

    class ReviewRepository {
        <<interface>>
        +findById(UUID) Optional~Review~
        +findByClinicId(UUID) List~Review~
        +findByBookingId(UUID) Optional~Review~
        +save(Review) Review
        +deleteById(UUID) void
    }

    class Review {
        +UUID reviewId
        +UUID bookingId
        +UUID petOwnerId
        +UUID clinicId
        +Integer rating
        +String comment
        +LocalDateTime createdAt
        +LocalDateTime updatedAt
    }

    ReviewController --> ReviewService
    ReviewService --> ReviewRepository
    ReviewRepository ..> Review
```

#### 4.9.2 Create Review

> **Sequence Diagram:** TODO - Pet Owner tạo đánh giá sau khi hoàn tất booking.

#### 4.9.3 Delete Review

> **Sequence Diagram:** TODO - Pet Owner xóa đánh giá đã tạo.

#### 4.9.4 Update Review

> **Sequence Diagram:** TODO - Pet Owner cập nhật nội dung đánh giá.

#### 4.9.5 View Clinic Review

> **Sequence Diagram:** TODO - Xem danh sách đánh giá của phòng khám.


---

### 4.10 Clinic Management

#### 4.10.1 Class Diagram - Clinic & Services

```mermaid
classDiagram
    class ClinicController {
        -ClinicService clinicService
        -CloudinaryService cloudinaryService
        +getAllClinics(ClinicStatus, String, Pageable) ResponseEntity
        +getClinicById(UUID) ResponseEntity
        +createClinic(ClinicRequest) ResponseEntity
        +updateClinic(UUID, ClinicRequest) ResponseEntity
        +approveClinic(UUID, ApproveRequest) ResponseEntity
        +rejectClinic(UUID, RejectRequest) ResponseEntity
        +uploadClinicImage(UUID, MultipartFile) ResponseEntity
        +searchNearby(BigDecimal lat, BigDecimal lng, Double radius) ResponseEntity
    }

    class ClinicService {
        -ClinicRepository clinicRepository
        -UserRepository userRepository
        -ClinicImageRepository imageRepository
        +getAllClinics(...) Page~ClinicResponse~
        +getClinicById(UUID) ClinicResponse
        +createClinic(ClinicRequest) ClinicResponse
        +updateClinic(UUID, ClinicRequest) ClinicResponse
        +approveClinic(UUID, String) ClinicResponse
        +rejectClinic(UUID, String) ClinicResponse
        +findNearbyClinics(BigDecimal, BigDecimal, Double) List~ClinicResponse~
    }

    class ClinicRepository {
        <<interface>>
        +findById(UUID) Optional~Clinic~
        +findAll(Specification, Pageable) Page~Clinic~
        +save(Clinic) Clinic
        +findNearby(BigDecimal, BigDecimal, Double) List~Clinic~
    }

    class ClinicImageRepository {
        <<interface>>
        +save(ClinicImage) ClinicImage
        +deleteById(UUID) void
    }

    class Clinic {
        +UUID clinicId
        +String name
        +String address
        +BigDecimal latitude
        +BigDecimal longitude
        +BigDecimal ratingAvg
        +Integer ratingCount
        +ClinicStatus status
        +User owner
    }

    class ClinicImage {
        +UUID imageId
        +String imageUrl
        +Boolean isPrimary
    }

    class ClinicStatus {
        <<enumeration>>
        PENDING
        APPROVED
        REJECTED
        SUSPENDED
    }

    class CloudinaryService {
        +uploadImage(MultipartFile, String folder) UploadResponse
        +deleteImage(String publicId) void
    }

    ClinicController --> ClinicService
    ClinicController --> CloudinaryService
    ClinicService --> ClinicRepository
    ClinicService --> ClinicImageRepository
    ClinicRepository ..> Clinic
    ClinicImageRepository ..> ClinicImage
```

#### 4.10.2 Create Clinic (UC-CO-03)

```mermaid
sequenceDiagram
    actor Owner as Clinic Owner
    participant UI as Clinic Register Screen (Web)
    participant CC as ClinicController
    participant CS as ClinicService
    participant AS as AuthService
    participant DB as Database

    Owner->>UI: 1. Input clinic info & click "Register"
    activate UI
    UI->>CC: 2. createClinic(clinicRequest)
    activate CC
    CC->>AS: 3. getCurrentUser()
    activate AS
    AS-->>CC: 4. User Entity (CLINIC_OWNER)
    deactivate AS
    CC->>CS: 5. createClinic(request, ownerId)
    activate CS
    CS->>CR: 6. save(Clinic Entity with status=PENDING)
    activate CR
    CR-->>CS: 7. Saved Clinic
    deactivate CR
    CS-->>CC: 8. ClinicResponse
    deactivate CS
    CC-->>UI: 9. ClinicResponse(created)
    deactivate CC
    UI-->>Owner: 10. Show "Pending Approval" notification
    deactivate UI
```

#### 4.10.3 Approve/Reject Clinic (Admin Approval Flow)

```mermaid
sequenceDiagram
    actor Admin as Administrator
    participant UI as Admin Dashboard
    participant CC as ClinicController
    participant CS as ClinicService
    participant DB as Database

    Admin->>UI: 1. Select clinic & click "Approve"
    activate UI
    UI->>CC: 2. approveClinic(clinicId, reason)
    activate CC
    CC->>CS: 3. approveClinic(id, reason)
    activate CS
    CS->>CR: 4. findById(id)
    activate CR
    CR-->>CS: 5. Clinic Entity
    deactivate CR
    CS->>CS: 6. Validate status == PENDING
    CS->>CR: 7. save(Updated Clinic)
    activate CR
    CR-->>CS: 8. OK
    deactivate CR
    CS-->>CC: 9. ClinicResponse
    deactivate CS
    CC-->>UI: 10. ApproveResponse(success)
    deactivate CC
    UI-->>Admin: 11. Show "Approved" status
    deactivate UI
```

#### 4.10.4 Upload Clinic Image

```mermaid
sequenceDiagram
    actor Owner as Clinic Owner
    participant UI as Clinic Edit Screen
    participant CC as ClinicController
    participant CS as ClinicService
    participant Cloud as CloudinaryService
    participant CIR as ClinicImageRepository

    Owner->>UI: 1. Select image & click "Upload"
    activate UI
    UI->>CC: 2. uploadClinicImage(clinicId, imageFile)
    activate CC
    CC->>CS: 3. uploadClinicImage(clinicId, file)
    activate CS
    CS->>Cloud: 4. uploadImage(file, "clinics")
    activate Cloud
    Cloud-->>CS: 5. Image URL
    deactivate Cloud
    CS->>CIR: 6. save(ClinicImage)
    activate CIR
    CIR-->>CS: 7. Saved Image
    deactivate CIR
    CS-->>CC: 8. ClinicResponse
    deactivate CS
    CC-->>UI: 9. Updated Clinic Data
    deactivate CC
    UI-->>Owner: 10. Show uploaded image
    deactivate UI
```

---

### 4.11 SOS Emergency Booking

The SOS Emergency Booking module provides real-time emergency veterinary care matching, connecting pet owners in urgent situations with nearby available clinics. The system uses GPS-based proximity search, automated escalation, and WebSocket notifications to ensure rapid response.

#### Cross-Reference to SRS

| SDD Section | SRS Reference | Description |
|-------------|---------------|-------------|
| 4.11.1 Class Diagram | 3.10 SOS Emergency Flow | Overall module structure |
| 4.11.2 Class Specifications | 3.10.1 - 3.10.6 | Detailed class responsibilities |
| 4.11.3 Start SOS Matching | UC-PO-15, 3.10.1 | Pet Owner initiates SOS request |
| 4.11.4 Confirm SOS Request | UC-CM-20, 3.10.3 | Clinic Manager accepts request |
| 4.11.5 Decline & Escalate | UC-CM-20, 3.10.3 | Auto-escalation logic |
| 4.11.6 Receive SOS alert | UC-CM-20, 3.10.3 | Clinic manager receives SOS alert |
| 4.11.7 Cancel SOS Matching | UC-PO-18, 3.10.4 | Pet Owner cancels before confirmation |
| 4.11.8 Checkout with Custom Fee | UC-STAFF-10, 3.10.5 | Staff checkout with optional SOS fee override |

#### 4.11.1 Class Diagram

```mermaid
classDiagram
    %% Controllers
    class SosController {
        +startMatching(SosMatchRequest, UserPrincipal)
        +confirmSos(UUID, SosConfirmRequest, UserPrincipal)
        +getStatus(UUID)
        +getActiveSosBooking(UserPrincipal)
        +getActiveSosAlerts(UserPrincipal)
        +cancelMatching(UUID, UserPrincipal)
    }

    class BookingController {
        +checkout(UUID, CheckoutRequest, UserPrincipal)
        +complete(UUID, UserPrincipal)
    }

    %% Services
    class SosMatchingService {
        +startMatching(SosMatchRequest, UUID)
        +processConfirmation(SosConfirmRequest, UUID)
        +escalateToNextClinic(UUID)
        +checkTimeouts()
        +getActiveSosBooking(UUID)
        +getMatchingStatus(UUID)
        +getActiveSosAlertsForManager(UUID)
        +cancelMatching(UUID, UUID)
    }

    class SosSessionManager {
        +acquireUserLock(UUID)
        +releaseUserLock(UUID)
        +acquireBookingLock(UUID)
        +releaseBookingLock(UUID)
        +createSession(UUID, List~Clinic~)
        +clearSession(UUID)
        +hasCurrentClinicTimedOut(UUID)
    }

    class SosNotificationService {
        +notifyOwnerClinicContacted(UUID, Clinic, int, int, double)
        +notifyOwnerWaitingNext(UUID, Clinic, int, int)
        +notifyOwnerConfirmed(UUID, Clinic, User, Double, Integer)
        +notifyOwnerNoClinic(UUID)
        +notifyOwnerCancelled(UUID)
        +alertClinic(Booking, Clinic, int, int)
        +notifyClinicStaleAlert(UUID, UUID, MatchingEvent)
    }

    class BookingService {
        +processCheckoutAuthorized(UUID, CheckoutRequest, User)
        +complete(UUID, User)
    }

    class LocationService {
        +calculateDistance(BigDecimal, BigDecimal, BigDecimal, BigDecimal) double
    }

    class ClinicPriceService {
        +getSosFee(UUID) Optional~BigDecimal~
    }

    %% Repositories
    class BookingRepository {
        <<interface>>
        +findActiveSosBookingsByPetOwner(UUID)
        +findByStatusAndBookingType(BookingStatus, BookingType)
        +findByClinicIdAndStatusAndType(UUID, BookingStatus, BookingType, Pageable)
    }

    class ClinicRepository {
        <<interface>>
        +findNearbyClinics(BigDecimal, BigDecimal, double) List~Clinic~
    }

    class PetRepository {
        <<interface>>
        +findById(UUID) Optional~Pet~
    }

    class UserRepository {
        <<interface>>
        +findById(UUID) Optional~User~
    }


```

#### 4.11.2 Class Specifications

**1. SosController**
-   **Responsibility:** REST API endpoints for SOS emergency booking operations.
-   **Key Methods:**
    -   `startMatching(SosMatchRequest, UserPrincipal)`: Initiates SOS matching process for pet owner.
    -   `confirmMatching(UUID, SosConfirmRequest, UserPrincipal)`: Clinic manager accepts or declines SOS request.
    -   `getMatchingStatus(UUID)`: Retrieves current matching status for a booking.
    -   `getActiveSosAlertsForManager(UserPrincipal)`: Returns active SOS alerts for logged-in clinic manager (catch-up mechanism).
    -   `cancelMatching(UUID, UserPrincipal)`: Pet owner cancels SOS request before confirmation.

**2. SosMatchingService**
-   **Responsibility:** Core business logic for SOS matching, escalation, and timeout handling.
-   **Key Methods:**
    -   `startMatching(SosMatchRequest, UUID)`: Creates SOS booking, finds nearby clinics, notifies first clinic.
    -   `processConfirmation(SosConfirmRequest, UUID)`: Handles clinic acceptance/decline with staff assignment validation.
    -   `escalateToNextClinic(UUID)`: Moves to next clinic when current times out or declines.
    -   `checkTimeouts()`: Scheduled job checks for timed-out bookings (runs every 5 seconds).
    -   `getActiveSosBooking(UUID)`: Retrieves active SOS booking for pet owner (prevents duplicates).
    -   `getActiveSosAlertsForManager(UUID)`: Fetches active alerts for clinic manager (WebSocket catch-up).
    -   `cancelMatching(UUID, UUID)`: Cancels SOS matching and clears Redis session.
    -   `confirmSos(Booking, User, UUID)`: Confirms SOS, assigns staff, applies SOS fee, notifies owner.
    -   `declineSos(Booking, String)`: Logs decline reason and escalates to next clinic.

**3. SosSessionManager**
-   **Responsibility:** Manages Redis-based SOS matching sessions with distributed locking.
-   **Key Methods:**
    -   `createSession(UUID, List<Clinic>)`: Stores clinic list and initial index in Redis.
    -   `sessionExists(UUID)`: Checks if session exists for booking.
    -   `getCurrentIndex(UUID)`: Retrieves current clinic index from session.
    -   `getClinicIds(UUID)`: Retrieves clinic ID list from session.
    -   `updateIndex(UUID, int)`: Updates current clinic index when escalating.
    -   `updateNotifiedAt(UUID)`: Updates timestamp when clinic is notified (for timeout calculation).
    -   `getElapsedSeconds(UUID)`: Calculates elapsed time since last notification.
    -   `hasCurrentClinicTimedOut(UUID)`: Checks if 60-second timeout exceeded.
    -   `clearSession(UUID)`: Deletes session from Redis (on completion/cancellation).
    -   `acquireBookingLock(UUID)`: Acquires distributed lock for booking (prevents race conditions).
    -   `releaseBookingLock(UUID)`: Releases distributed lock.
    -   `acquireUserLock(UUID)`: Acquires lock for user (prevents duplicate SOS requests).
    -   `releaseUserLock(UUID)`: Releases user lock.

**4. SosNotificationService**
-   **Responsibility:** WebSocket broadcasting for real-time SOS status updates.
-   **WebSocket Topics:**
    -   `/topic/sos-matching/{bookingId}` - Pet owner subscribes for status updates
    -   `/topic/clinic/{clinicId}/sos-alert` - Clinic managers subscribe for SOS alerts
-   **Key Methods:**
    -   `notifyOwnerClinicContacted(UUID, Clinic, int, int, double)`: Notifies owner that clinic is being contacted.
    -   `notifyOwnerWaitingNext(UUID, Clinic, int, int)`: Notifies owner about escalation to next clinic.
    -   `notifyOwnerConfirmed(UUID, Clinic, User, Double, Integer)`: Notifies owner of confirmation with staff details.
    -   `notifyOwnerNoClinic(UUID)`: Notifies owner that no clinics are available.
    -   `notifyOwnerCancelled(UUID)`: Notifies owner that request was cancelled.
    -   `alertClinic(Booking, Clinic, int, int)`: Sends SOS alert to clinic managers.
    -   `notifyClinicStaleAlert(UUID, UUID, MatchingEvent)`: Notifies clinic that alert is no longer active (handled/timed out).

**5. BookingService**
-   **Responsibility:** General booking operations including checkout and completion.
-   **Key Methods:**
    -   `processCheckoutAuthorized(UUID, CheckoutRequest, User)`: Processes checkout for bookings including SOS fee calculation.
    -   `complete(UUID, User)`: Marks booking as completed after payment confirmation.

**6. SosSessionManager (Redis Data Structure)**
-   **Session Format:**
    ```
    sos:session:{bookingId} -> {
      "clinicIds": ["uuid1", "uuid2", ...],
      "currentIndex": 0,
      "notifiedAt": 1234567890,
      "maxClinics": 5,
      "timeoutSeconds": 60
    }
    sos:lock:booking:{bookingId} -> 1 (TTL: 10s)
    sos:lock:user:{userId} -> 1 (TTL: 10s)
    ```

**Business Rules:**
- **BR-59:** Search radius 10km from user location
- **BR-60:** Max 5 clinics to try
- **BR-61:** 60 seconds timeout per clinic
- **BR-62:** No duplicate active SOS bookings per user (enforced by user lock)
- **BR-63:** Distributed lock prevents race conditions during confirmation
- **BR-64:** Status flow: SEARCHING → PENDING_CLINIC_CONFIRM → CONFIRMED → IN_PROGRESS → COMPLETED/CANCELLED
- **BR-65:** Session TTL = 60s × 5 clinics + 60s buffer = 360 seconds
- **BR-66:** Unique booking code format: `SOS-{timestamp}-{random}`
- **BR-67:** Clinic manager must assign staff when accepting SOS
- **BR-68:** Pet owner can only cancel SOS before clinic confirmation
- **BR-69:** After cancellation, Redis session is cleared and matching stops immediately
- **BR-70:** SOS fee is configured per clinic via ClinicPriceService (default: 50,000 VND)
- **BR-71:** SOS fee is added to booking.totalPrice during confirmation, not checkout
- **BR-72:** Checkout updates status to COMPLETED and records payment method

#### 4.11.3 Sequence Diagram: Start SOS Matching

Pet Owner submits an SOS request. The system validates the request, finds nearby clinics, creates the SOS booking, and starts the matching process.

```mermaid
sequenceDiagram
    actor PO as Pet Owner
    participant UI as Mobile SOS Screen
    participant SC as SosController
    participant MS as SosMatchingService
    participant SN as SosNotificationService
    participant DB as Database

    PO->>UI: Fill pet, symptoms, and location
    UI->>SC: POST /api/sos/start
    SC->>MS: startMatching(request, petOwnerId)
    MS->>DB: Check active SOS, find nearby clinics, create booking
    MS->>SN: alertClinic(booking, firstClinic,...)
    MS->>SN: notifyOwnerClinicContacted(...)
    MS-->>SC: SosMatchResponse
    SC-->>UI: 201 Created
    UI-->>PO: Open radar screen and wait for confirmation
```

#### 4.11.4 Sequence Diagram: Confirm SOS Request (Accept)

Clinic Manager reviews SOS alert and accepts the request by assigning a staff member. System updates booking, applies SOS fee, and notifies pet owner.

```mermaid
sequenceDiagram
    actor CM as Clinic Manager
    participant UI as SosAlertModal (Web)
    participant SC as SosController
    participant MS as SosMatchingService
    participant SM as SosSessionManager
    participant BR as BookingRepository
    participant UR as UserRepository
    participant CPS as ClinicPriceService
    participant SN as SosNotificationService
    participant NS as NotificationService
    participant DB as Database

    CM->>UI: 1. Review alert & click "Accept" + select staff
    activate UI
    UI->>SC: 2. POST /api/sos/{bookingId}/confirm + request
    activate SC
    SC->>MS: 3. processConfirmation(request, clinicManagerId)
    activate MS

    MS->>SM: 4. acquireBookingLock(bookingId)
    activate SM
    SM->>DB: 5. Acquire Redis Booking Lock
    activate DB
    DB-->>SM: 6. Success
    deactivate DB
    SM-->>MS: 7. true
    deactivate SM

    MS->>BR: 8. findById(bookingId)
    activate BR
    BR->>DB: 9. Get Booking Details
    activate DB
    DB-->>BR: 10. Booking (PENDING_CLINIC_CONFIRM)
    deactivate DB
    BR-->>MS: 11. Booking
    deactivate BR

    MS->>MS: 12. Validate Status

    MS->>UR: 13. findById(clinicManagerId)
    activate UR
    UR->>DB: 14. Get Manager Details
    activate DB
    DB-->>UR: 15. Manager User
    deactivate DB
    UR-->>MS: 16. Manager User
    deactivate UR

    MS->>MS: 17. Validate Manager Role & Clinic

    MS->>UR: 19. findById(assignedStaffId)
    activate UR
    UR->>DB: 20. Get Staff Details
    activate DB
    DB-->>UR: 21. Staff User
    deactivate DB
    UR-->>MS: 22. Staff User
    deactivate UR

    MS->>MS: 23. validateAssignedStaffForSos(staff, clinic) - Check staff.role == STAFF and staff.workingClinic == manager.workingClinic

    MS->>CPS: 24. getSosFee()
    activate CPS
    CPS->>DB: 25. Query Clinic Prices
    activate DB
    DB-->>CPS: 26. SOS Fee Amount
    deactivate DB
    CPS-->>MS: 27. SOS Fee Amount
    deactivate CPS

    MS->>BR: 28. save(Booking)
    activate BR
    BR->>DB: 29. Update Booking Status & Assigned Staff & Total Price
    activate DB
    DB-->>BR: 30. Success
    deactivate DB
    BR-->>MS: 31. Booking
    deactivate BR

    MS->>NS: 32. sendBookingAssignedNotificationToStaff()
    activate NS
    NS-->>MS: 33. void
    deactivate NS

    MS->>SM: 34. clearSession()
    activate SM
    SM->>DB: 35. Delete Redis Session
    activate DB
    DB-->>SM: 36. Success
    deactivate DB
    SM-->>MS: 37. void
    deactivate SM

    MS->>SN: 38. notifyOwnerConfirmed()
    activate SN
    SN->>SN: 39. broadcast to /topic/sos-matching/{bookingId}
    SN-->>MS: 40. void
    deactivate SN

    MS->>SN: 41. notifyClinicStaleAlert()
    activate SN
    SN->>SN: 42. broadcast to /topic/clinic/{clinicId}/sos-alert
    SN-->>MS: 43. void
    deactivate SN

    MS->>MS: 44. Build SosMatchResponse
    MS-->>SC: 45. SosMatchResponse (CONFIRMED)
    deactivate MS
    SC-->>UI: 46. HTTP 200 OK
    deactivate SC
    UI-->>CM: 47. Close modal, show toast "Đã xác nhận SOS"
    deactivate UI

    MS->>SM: 48. releaseBookingLock()
    activate SM
    SM->>DB: 49. Release Redis Booking Lock
    deactivate SM
```

#### 4.11.5 Sequence Diagram: Decline & Escalate to Next Clinic

Clinic Manager declines SOS request. System escalates to the next clinic in the list and notifies both parties.

```mermaid
sequenceDiagram
    actor CM as Clinic Manager
    participant UI as SosAlertModal (Web)
    participant SC as SosController
    participant MS as SosMatchingService
    participant SM as SosSessionManager
    participant BR as BookingRepository
    participant CR as ClinicRepository
    participant SN as SosNotificationService
    participant DB as Database

    CM->>UI: 1. Click "Decline" + optional reason
    activate UI
    UI->>SC: 2. POST /api/sos/{bookingId}/confirm + request (accepted=false)
    activate SC
    SC->>MS: 3. processConfirmation(request, clinicManagerId)
    activate MS

    MS->>SM: 4. acquireBookingLock(bookingId)
    activate SM
    SM->>DB: 5. Acquire Redis Booking Lock
    activate DB
    DB-->>SM: 6. Success
    deactivate DB
    SM-->>MS: 7. true
    deactivate SM

    MS->>BR: 8. findById(bookingId)
    activate BR
    BR->>DB: 9. Get Booking Details
    activate DB
    DB-->>BR: 10. Booking
    deactivate DB
    BR-->>MS: 11. Booking
    deactivate BR

    MS->>MS: 12. Validate manager authorization
    MS->>MS: 13. declineSos(booking, reason) - Log reason

    MS->>BR: 14. save(Booking)
    activate BR
    BR->>DB: 15. Clear Clinic ID from Booking
    activate DB
    DB-->>BR: 16. Success
    deactivate DB
    BR-->>MS: 17. Booking
    deactivate BR

    MS->>MS: 18. escalateToNextClinic(bookingId)

    MS->>SM: 19. getCurrentIndex(bookingId)
    activate SM
    SM->>DB: 20. Get Current Index from Session
    activate DB
    DB-->>SM: 21. Integer
    deactivate DB
    SM-->>MS: 22. Integer
    deactivate SM

    MS->>SM: 23. getClinicIds(bookingId)
    activate SM
    SM->>DB: 24. Get Clinic List from Session
    activate DB
    DB-->>SM: 25. Array
    deactivate DB
    SM-->>MS: 26. List of Clinics
    deactivate SM

    MS->>SN: 27. notifyClinicStaleAlert()
    activate SN
    SN->>SN: 28. broadcast to /topic/clinic/{oldClinicId}/sos-alert
    SN-->>MS: 29. void
    deactivate SN

    MS->>MS: 30. Calculate nextIndex = currentIndex + 1

    alt All clinics exhausted
        MS->>BR: 31a. save(Booking)
        activate BR
        BR->>DB: 32a. Update Booking Status (CANCELLED)
        deactivate BR
        MS->>SM: 33a. clearSession(bookingId)
        MS->>SN: 34a. notifyOwnerNoClinic(bookingId)
        MS-->>SC: 35a. SosMatchResponse (CANCELLED)
    else Next clinic available
        MS->>CR: 31b. findById(nextClinicId)
        activate CR
        CR->>DB: 32b. Get Clinic Details
        activate DB
        DB-->>CR: 33b. Clinic Data
        deactivate DB
        CR-->>MS: 34b. Clinic
        deactivate CR

        MS->>SM: 35b. updateIndex(nextIndex)
        activate SM
        SM->>DB: 36b. Update Session Index
        deactivate SM

        MS->>SM: 37b. updateNotifiedAt()
        activate SM
        SM->>DB: 38b. Update Session Timestamp
        deactivate SM

        MS->>BR: 39b. save(Booking)
        activate BR
        BR->>DB: 40b. Update Booking Clinic ID
        activate DB
        DB-->>BR: 41b. Success
        deactivate DB
        BR-->>MS: 42b. Booking
        deactivate BR

        MS->>SN: 43b. notifyOwnerWaitingNext()
        activate SN
        SN->>SN: 44b. broadcast to /topic/sos-matching/{bookingId}
        SN-->>MS: 45b. void
        deactivate SN

        MS->>SN: 46b. alertClinic()
        activate SN
        SN->>SN: 47b. broadcast to /topic/clinic/{nextClinicId}/sos-alert
        SN-->>MS: 48b. void
        deactivate SN

        MS-->>SC: 49b. SosMatchResponse (PENDING_CLINIC_CONFIRM)
        deactivate MS
    end

    SC-->>UI: 50. HTTP 200 OK + SosMatchResponse
    deactivate SC
    UI-->>CM: 51. Close modal, show toast "Đã từ chối yêu cầu"
    deactivate UI

    MS->>SM: 52. releaseBookingLock(bookingId)
    activate SM
    SM->>DB: 53. Release Redis Booking Lock
    deactivate SM
```

#### 4.11.6 Sequence Diagram: Receive SOS alert

Clinic Manager receives the SOS alert in real time. When the dashboard reloads or reconnects, the system loads the currently active SOS alerts for synchronization.

```mermaid
sequenceDiagram
    actor CM as Clinic Manager
    participant SN as SosNotificationService
    participant UI as Manager Dashboard
    participant SC as SosController
    participant MS as SosMatchingService
    participant DB as Database

    SN-->>UI: /topic/clinic/{clinicId}/sos-alert
    UI-->>CM: Show SOS alert with countdown

    alt Page reload or reconnect
        UI->>SC: GET /api/sos/alerts/active
        SC->>MS: getActiveSosAlertsForManager(managerId)
        MS->>DB: Load active SOS alerts for the clinic
        MS-->>SC: Active alert list
        SC-->>UI: 200 OK
        UI-->>CM: Sync visible SOS alerts
    end
```

#### 4.11.7 Sequence Diagram: Cancel SOS Matching

Pet Owner cancels the SOS request before clinic confirmation. The system updates the booking, stops the matching process, and notifies related clients.

```mermaid
sequenceDiagram
    actor PO as Pet Owner
    participant UI as Radar Map Screen
    participant SC as SosController
    participant MS as SosMatchingService
    participant SN as SosNotificationService
    participant DB as Database

    PO->>UI: Tap "Cancel SOS"
    UI->>SC: DELETE /api/sos/{bookingId}
    SC->>MS: cancelMatching(bookingId, petOwnerId)
    MS->>DB: Update booking to CANCELLED and clear matching session
    MS->>SN: notifyOwnerCancelled(bookingId)
    MS->>SN: notifyClinicStaleAlert(...)
    MS-->>SC: Success
    SC-->>UI: 204 No Content
    UI-->>PO: Return to Home and show success message
```

#### 4.11.8 Sequence Diagram: Checkout with Custom Fee

Staff finalizes the SOS booking, optionally overrides the SOS fee, and completes the booking checkout flow.

```mermaid
sequenceDiagram
    actor S as Staff
    participant UI as Staff Booking Detail
    participant BC as BookingController
    participant BS as BookingService
    participant CPS as ClinicPriceService
    participant BNS as BookingNotificationService
    participant DB as Database

    S->>UI: Enter custom SOS fee if needed
    UI->>BC: POST /api/bookings/{id}/checkout
    BC->>BS: processCheckoutAuthorized(bookingId, request, currentUser)
    BS->>DB: Load booking and validate permission/status

    alt Custom SOS fee provided
        BS->>BS: Apply overridden fee
    else No custom fee
        BS->>CPS: getSosFee(clinicId)
    end

    BS->>DB: Save COMPLETED status, totalPrice, and sosFee
    BS->>BNS: pushBookingUpdateToUsers(booking, "COMPLETED")
    BS-->>BC: BookingResponse
    BC-->>UI: 200 OK
    UI-->>S: Show checkout success
```

---

### 4.12 Booking Management

This section documents the standard booking management module implemented in `BookingController` and `BookingService`. SOS-specific matching and emergency flows are documented separately in Section 4.11.

**Last Updated:** 2026-03-16

#### 4.12.0 API Specification Table

| # | Method | Endpoint | Role | Description | Status |
|---|--------|----------|------|-------------|--------|
| 0 | GET | `/bookings/public/available-slots` | Public | View available slots for a clinic date and service set | Done |
| 1 | POST | `/bookings/public/estimated-completion` | Public | Calculate estimated completion before booking | Done |
| 2 | POST | `/bookings` | PET_OWNER | Book an appointment | Done |
| 3 | POST | `/bookings/proxy` | PET_OWNER | Book on behalf of another recipient | Done |
| 4 | GET | `/bookings/my-bookings` | PET_OWNER | View my bookings and booking history | Done |
| 5 | GET | `/bookings/my/proxy` | PET_OWNER | View my proxy bookings | Done |
| 6 | GET | `/bookings/{bookingId}` | PET_OWNER, STAFF, CLINIC_MANAGER, ADMIN | View booking details | Done |
| 7 | GET | `/bookings/code/{bookingCode}` | PET_OWNER, STAFF, CLINIC_MANAGER, ADMIN | View booking by code | Done |
| 8 | POST | `/bookings/{bookingId}/cancel` | PET_OWNER, CLINIC_MANAGER, ADMIN | Cancel booking | Done |
| 9 | GET | `/bookings/clinic/{clinicId}` | CLINIC_MANAGER, CLINIC_OWNER, ADMIN | View new bookings and clinic bookings | Done |
| 10 | GET | `/bookings/{bookingId}/availability` | CLINIC_MANAGER, ADMIN | Check staff availability for booking | Done |
| 11 | GET | `/bookings/{bookingId}/staff-options` | CLINIC_MANAGER, ADMIN | Get staff options for assignment | Done |
| 12 | POST | `/bookings/{bookingId}/confirm` | CLINIC_MANAGER, ADMIN | Assign staff to booking during confirmation | Done |
| 13 | GET | `/bookings/{bookingId}/services/{serviceId}/available-staff` | CLINIC_MANAGER, CLINIC_OWNER, ADMIN | Get reassignment candidates for service item | Done |
| 14 | PUT | `/bookings/{bookingId}/services/{serviceId}/reassign` | CLINIC_MANAGER, ADMIN | Reassign staff for service item | Done |
| 15 | GET | `/bookings/staff/{staffId}` | STAFF, CLINIC_MANAGER, ADMIN | View assigned bookings | Done |
| 16 | GET | `/bookings/staff/home-summary` | STAFF, ADMIN | View staff home summary | Done |
| 17 | POST | `/bookings/{bookingId}/check-in` | STAFF, ADMIN | Start execution for in-clinic booking | Done |
| 18 | POST | `/bookings/{bookingId}/start-moving` | STAFF, CLINIC_MANAGER, ADMIN | Start movement for home-visit execution | Done |
| 19 | POST | `/bookings/{bookingId}/arrived` | STAFF, CLINIC_MANAGER, ADMIN | Mark arrival for home-visit execution | Done |
| 20 | POST | `/bookings/{bookingId}/checkout` | STAFF, CLINIC_MANAGER | Checkout and complete booking | Done |
| 21 | GET | `/bookings/{bookingId}/available-add-ons` | STAFF, CLINIC_MANAGER, ADMIN | View available add-on services | Done |
| 22 | POST | `/bookings/{bookingId}/services` | STAFF, CLINIC_MANAGER, ADMIN | Add service to booking | Done |
| 23 | DELETE | `/bookings/{bookingId}/services/{serviceId}` | STAFF, CLINIC_MANAGER, ADMIN | Remove add-on service from booking | Done |
| 24 | GET | `/bookings/clinic/{clinicId}/today` | STAFF | View clinic today bookings with shared visibility | Done |
| 25 | POST | `/bookings/{bookingId}/notify-on-way` | CLINIC_MANAGER, ADMIN | Notify owner that staff is on the way | Done |

**Booking Status Flow:**
```
PENDING -> CONFIRMED -> IN_PROGRESS -> COMPLETED
          \\            \\
           CANCELLED    NO_SHOW
```

#### 4.12.1 Class Diagram

The class diagram below is intentionally simplified to focus on the controller-facing structure of Booking Management. The sequence diagrams in this section use the same set of core classes only: controller, service, repositories, `StaffAssignmentService`, and the main domain entities.

```mermaid
classDiagram
    class BookingController {
        +getAvailableSlots(UUID, LocalDate, List~UUID~) ResponseEntity
        +getEstimatedCompletion(UUID, EstimatedCompletionRequest) ResponseEntity
        +createBooking(BookingRequest, UserDetails) ResponseEntity
        +createProxyBooking(ProxyBookingRequest, UserDetails) ResponseEntity
        +getMyBookings(UserDetails, Pageable) ResponseEntity
        +getMyProxyBookings(UserDetails, Pageable) ResponseEntity
        +getBookingsByClinic(UUID, BookingStatus, BookingType, Pageable) ResponseEntity
        +getBookingsByStaff(UUID, BookingStatus, Pageable) ResponseEntity
        +getBookingById(UUID) ResponseEntity
        +getBookingByCode(String) ResponseEntity
        +getStaffAvailability(UUID) ResponseEntity
        +getStaffOptions(UUID) ResponseEntity
        +confirmBooking(UUID, BookingConfirmRequest) ResponseEntity
        +reassignStaff(UUID, UUID, ReassignStaffRequest) ResponseEntity
        +cancelBooking(UUID, String, UserDetails) ResponseEntity
        +checkIn(UUID, UserDetails) ResponseEntity
        +startMoving(UUID, UserDetails) ResponseEntity
        +arrived(UUID, UserDetails) ResponseEntity
        +checkout(UUID, CheckoutRequest, UserDetails) ResponseEntity
        +getAvailableAddOns(UUID, UserDetails) ResponseEntity
        +addService(UUID, AddServiceRequest, UserDetails) ResponseEntity
        +removeServiceFromBooking(UUID, UUID, UserDetails) ResponseEntity
        +getStaffHomeSummary(UserDetails) ResponseEntity
        +getClinicTodayBookings(UUID, UserDetails) ResponseEntity
    }

    class BookingService {
        +createBooking(BookingRequest, UUID) BookingResponse
        +createProxyBooking(ProxyBookingRequest, UUID) BookingResponse
        +getMyBookings(UUID, Pageable) Page~BookingResponse~
        +getMyProxyBookings(UUID, Pageable) Page~BookingResponse~
        +getBookingsByClinic(UUID, BookingStatus, BookingType, Pageable) Page~BookingResponse~
        +getBookingsByStaff(UUID, BookingStatus, Pageable) Page~BookingResponse~
        +getBookingById(UUID) BookingResponse
        +getBookingByCode(String) BookingResponse
        +checkStaffAvailability(UUID) StaffAvailabilityCheckResponse
        +getAvailableStaffForConfirm(UUID) List~StaffOptionDTO~
        +confirmBooking(UUID, BookingConfirmRequest) BookingResponse
        +getAvailableStaffForReassign(UUID, UUID) List~AvailableStaffResponse~
        +reassignStaffForService(UUID, UUID, UUID) BookingResponse
        +cancelBooking(UUID, String, UUID) BookingResponse
        +checkIn(UUID, User) BookingResponse
        +startMoving(UUID, User) BookingResponse
        +arrived(UUID, User) BookingResponse
        +processCheckoutAuthorized(UUID, CheckoutRequest, User) BookingResponse
        +getAvailableServicesForAddOn(UUID, User) List~ClinicServiceResponse~
        +addServiceToBooking(UUID, UUID, User) BookingResponse
        +removeServiceFromBooking(UUID, UUID, User) BookingResponse
        +getStaffHomeSummary(UUID) StaffHomeSummaryResponse
        +getClinicTodayBookings(UUID, User) List~ClinicTodayBookingResponse~
    }

    class BookingRepository {
        <<interface>>
        +findById(UUID) Optional~Booking~
        +findByIdWithDetails(UUID) Optional~Booking~
        +findByBookingCode(String) Optional~Booking~
        +findByClinicIdAndStatusAndType(UUID, BookingStatus, BookingType, Pageable) Page~Booking~
        +findByAssignedStaffIdAndStatus(UUID, BookingStatus, Pageable) Page~Booking~
        +findByPetOwnerId(UUID, Pageable) Page~Booking~
        +findByProxyBookerId(UUID, Pageable) Page~Booking~
        +findByAssignedStaffIdAndBookingDate(UUID, LocalDate) List~Booking~
        +findByAssignedStaffIdAndBookingDateBetweenAndStatusIn(UUID, LocalDate, LocalDate, List~BookingStatus~) List~Booking~
        +findByClinicIdAndDateWithDetails(UUID, LocalDate) List~Booking~
        +save(Booking) Booking
    }

    class BookingServiceItemRepository {
        <<interface>>
        +findById(UUID) Optional~BookingServiceItem~
        +delete(BookingServiceItem) void
    }

    class PetRepository {
        <<interface>>
        +findById(UUID) Optional~Pet~
        +save(Pet) Pet
    }

    class ClinicRepository {
        <<interface>>
        +findById(UUID) Optional~Clinic~
    }

    class ClinicServiceRepository {
        <<interface>>
        +findById(UUID) Optional~ClinicService~
        +findAllById(Iterable~UUID~) List~ClinicService~
        +findByClinicClinicIdAndIsActiveTrue(UUID) List~ClinicService~
    }

    class UserRepository {
        <<interface>>
        +findById(UUID) Optional~User~
        +save(User) User
    }

    class StaffAssignmentService {
        +checkStaffAvailabilityForBooking(Booking) StaffAvailabilityCheckResponse
        +getAvailableStaffForBookingConfirm(Booking) List~StaffOptionDTO~
        +assignStaffToAllServices(Booking) Map~UUID, User~
        +reserveSlotsForBooking(Booking) void
        +getAvailableStaffForReassign(UUID, LocalDate, LocalTime, StaffSpecialty, int, UUID) List~AvailableStaffResponse~
        +reassignStaffForService(UUID, UUID, BookingServiceItemRepository) void
        +releaseSlotsForBooking(Booking) void
        +findAvailableSlots(UUID, LocalDate, List~UUID~) List~LocalTime~
    }

    class Booking {
        +UUID bookingId
        +String bookingCode
        +BookingStatus status
        +BookingType type
        +BigDecimal totalPrice
        +BigDecimal distanceFee
        +LocalDate bookingDate
        +LocalTime bookingTime
        +LocalDateTime arrivedAt
    }

    class BookingServiceItem {
        +UUID bookingServiceId
        +ClinicService service
        +Pet pet
        +User assignedStaff
        +Boolean isAddOn
        +BigDecimal weightPrice
    }

    class ClinicService {
        +UUID serviceId
        +String name
        +BigDecimal basePrice
        +Integer durationTime
        +Boolean isHomeVisit
    }

    class Pet {
        +UUID id
        +String name
        +Species species
        +Double weight
    }

    class Clinic {
        +UUID clinicId
        +String name
    }

    class User {
        +UUID userId
        +Role role
        +StaffSpecialty specialty
    }

    BookingController --> BookingService
    BookingService --> BookingRepository
    BookingService --> BookingServiceItemRepository
    BookingService --> PetRepository
    BookingService --> ClinicRepository
    BookingService --> ClinicServiceRepository
    BookingService --> UserRepository
    BookingService --> StaffAssignmentService
    BookingService --> Booking
    BookingRepository --> Booking
    BookingServiceItemRepository --> BookingServiceItem
    PetRepository --> Pet
    ClinicRepository --> Clinic
    ClinicServiceRepository --> ClinicService
    UserRepository --> User
    Booking "1" *-- "many" BookingServiceItem
    Booking --> Pet
    Booking --> Clinic
    Booking --> User : petOwner
    Booking --> User : assignedStaff
    BookingServiceItem --> ClinicService
    BookingServiceItem --> Pet
    BookingServiceItem --> User : assignedStaff
```

#### 4.12.2 Class Specifications

**1. BookingController**
- **Responsibility:** Exposes REST endpoints for booking creation, lookup, assignment, execution, checkout, and service management.
- **Key Methods:** `createBooking()`, `createProxyBooking()`, `getMyBookings()`, `getBookingsByClinic()`, `confirmBooking()`, `cancelBooking()`, `checkIn()`, `startMoving()`, `arrived()`, `checkout()`.

**Smart Availability Algorithm**:
The system implements a "Smart Availability" feature that automatically filters available time slots based on:
1.  Selected service(s) and their required vet specialties
2.  Staff working shifts for the selected date
3.  Existing bookings (to avoid double-booking)

**2. BookingService**
- **Responsibility:** Implements booking business rules, permission checks, assignment coordination, status transitions, and price updates.
- **Key Methods:** `createBooking()`, `createProxyBooking()`, `confirmBooking()`, `reassignStaffForService()`, `cancelBooking()`, `addServiceToBooking()`, `removeServiceFromBooking()`, `processCheckoutAuthorized()`.

**3. StaffAssignmentService**
- **Responsibility:** Resolves assignment and reassignment options based on clinic, specialty, and availability constraints.
- **Key Methods:** `checkStaffAvailabilityForBooking()`, `getAvailableStaffForBookingConfirm()`, `assignStaffToAllServices()`, `reserveSlotsForBooking()`, `getAvailableStaffForReassign()`, `findAvailableSlots()`.

**4. BookingRepository**
- **Responsibility:** Main persistence gateway for booking list, detail, summary, and status-transition queries.
- **Key Queries:** `findByClinicIdAndStatusAndType()`, `findByAssignedStaffIdAndStatus()`, `findByPetOwnerId()`, `findByProxyBookerId()`, `findByIdWithDetails()`, `findByAssignedStaffIdAndBookingDateBetweenAndStatusIn()`.

**5. BookingServiceItemRepository**
- **Responsibility:** Persists and removes individual booking service items, especially for reassignment and add-on updates.
- **Key Methods:** `findById()`, `delete()`.

**6. PetRepository / ClinicRepository / ClinicServiceRepository / UserRepository**
- **Responsibility:** Provide the booking module with pet ownership, clinic context, service catalog, and user/staff lookup data.
- **Key Queries:** `findById()`, `findAllById()`, `findByClinicClinicIdAndIsActiveTrue()`, `save()`.

**7. Booking / BookingServiceItem / ClinicService / Pet / Clinic / User**
- **Responsibility:** Represent the booking aggregate and the main domain data loaded and updated by Booking Management flows.

#### 4.12.3 Sequence Diagram: Book an Appointment

```mermaid
sequenceDiagram
    actor PO as Pet Owner
    participant UI as Mobile Booking Wizard
    participant BC as BookingController
    participant BS as BookingService
    participant SAS as StaffAssignmentService
    participant CR as ClinicRepository
    participant CSR as ClinicServiceRepository
    participant UR as UserRepository
    participant PR as PetRepository
    participant BR as BookingRepository
    participant DB as Database

    PO->>UI: Select clinic, services, and date
    UI->>BC: GET /bookings/public/available-slots
    BC->>BS: getAvailableSlots(clinicId, date, serviceIds)
    BS->>SAS: findAvailableSlots(clinicId, date, serviceIds)
    SAS->>DB: Read shift and slot availability
    SAS-->>BS: Available slot list
    BS-->>BC: AvailableSlotsResponse
    BC-->>UI: 200 OK

    PO->>UI: Request estimated completion
    UI->>BC: POST /bookings/public/estimated-completion
    BC->>BS: calculateEstimatedCompletion(...)
    BS->>CR: findById(clinicId)
    CR->>DB: Load clinic and operating hours
    DB-->>CR: Clinic
    CR-->>BS: Clinic
    BS->>CSR: findAllById(serviceIds)
    CSR->>DB: Load clinic services
    DB-->>CSR: Service list
    CSR-->>BS: Service list
    BS-->>BC: EstimatedCompletionResponse
    BC-->>UI: 200 OK

    PO->>UI: Confirm booking
    UI->>BC: POST /bookings
    BC->>BS: createBooking(request, ownerId)
    BS->>UR: findById(ownerId)
    UR->>DB: Load pet owner
    DB-->>UR: User
    UR-->>BS: Pet owner
    BS->>CR: findById(clinicId)
    CR->>DB: Load clinic
    DB-->>CR: Clinic
    CR-->>BS: Clinic
    BS->>PR: findById(petId)
    PR->>DB: Load pet
    DB-->>PR: Pet
    PR-->>BS: Pet
    BS->>CSR: findAllById(serviceIds)
    CSR->>DB: Load clinic services
    DB-->>CSR: Service list
    CSR-->>BS: Service list
    BS->>BS: Calculate service price, distance fee, and final totals
    BS->>BR: save(booking)
    BR->>DB: Insert booking and booking service items
    DB-->>BR: Saved booking
    BR-->>BS: Saved booking
    BS->>BS: Trigger post-create side effects
    BS-->>BC: BookingResponse
    BC-->>UI: 201 Created
```

**Key Technical Details**:
-   **New API**: `GET /api/bookings/public/available-slots` - Returns available time slots based on service specialty matching
-   **Staff Assignment**: Intentionally omitted from mobile flow. Manager assigns vet post-booking via Dashboard (Section 3.8.4)
-   **Slot Reservation**: Slots are temporarily locked for 15 minutes to allow payment completion

#### 4.12.4 Sequence Diagram: Book on Behalf

```mermaid
sequenceDiagram
    actor PO as Pet Owner
    participant UI as Proxy Booking Screen
    participant BC as BookingController
    participant BS as BookingService
    participant UR as UserRepository
    participant PR as PetRepository
    participant CR as ClinicRepository
    participant CSR as ClinicServiceRepository
    participant BR as BookingRepository
    participant DB as Database

    PO->>UI: Fill recipient, proxy pet, service, and schedule
    UI->>BC: POST /bookings/proxy
    BC->>BS: createProxyBooking(request, proxyBookerId)
    BS->>UR: findById(proxyBookerId)
    UR->>DB: Load proxy booker
    DB-->>UR: User
    UR-->>BS: Proxy booker
    BS->>UR: save(newRecipientUser)
    UR->>DB: Insert guest recipient user
    DB-->>UR: Saved recipient
    UR-->>BS: Recipient user
    BS->>CR: findById(clinicId)
    CR->>DB: Load clinic
    DB-->>CR: Clinic
    CR-->>BS: Clinic
    loop For each proxy pet
        BS->>PR: save(newPet)
        PR->>DB: Insert recipient pet
        DB-->>PR: Saved pet
        PR-->>BS: Pet
    end
    BS->>CSR: findAllById(serviceIds)
    CSR->>DB: Load clinic services
    DB-->>CSR: Service list
    CSR-->>BS: Service list
    BS->>BS: Calculate booking totals
    BS->>BR: save(booking)
    BR->>DB: Insert proxy booking and service items
    DB-->>BR: Saved booking
    BR-->>BS: Saved booking
    BS->>BS: Trigger post-create side effects
    BS-->>BC: BookingResponse
    BC-->>UI: 201 Created
```

**Matching Rules (Service Category → Staff Specialty):**
| Service Category | Required Staff Specialty |
|-----------------|------------------------|
| GROOMING_SPA | GROOMER |
| VACCINATION, CHECK_UP, SURGERY, DENTAL, DERMATOLOGY, OTHER | VET |

#### 4.12.5 Check Staff Availability

```mermaid
sequenceDiagram
    actor M as Clinic Manager
    participant UI as Manager Dashboard
    participant BC as BookingController
    participant BS as BookingService
    participant VAS as VetAssignmentService

    M->>UI: 1. View Booking Details
    UI->>BC: 2. GET /bookings/{id}/check-vet-availability
    activate BC
    BC->>BS: 3. checkVetAvailability(id)
    activate BS
    BS->>VAS: 4. checkVetAvailabilityForBooking(booking)
    activate VAS
    VAS-->>BS: 5. VetAvailabilityCheckResponse
    deactivate VAS
    BS-->>BC: 6. Response
    deactivate BS
    BC-->>UI: 7. JSON Data
    deactivate BC
    UI-->>M: 8. Show availability status for each service
```

#### 4.12.6 Reassign Staff

```mermaid
sequenceDiagram
    actor M as Clinic Manager
    participant UI as Manager Dashboard
    participant BC as BookingController
    participant BS as BookingService
    participant VAS as VetAssignmentService

    M->>UI: 1. Select specific service in booking
    UI->>BC: 2. GET /.../available-vets
    BC->>BS: 3. getAvailableVetsForReassign(bookingId, serviceId)
    BS-->>BC: 4. List of available vets
    BC-->>UI: 5. Show vet list
    M->>UI: 6. Select new vet & Confirm
    UI->>BC: 7. POST /.../reassign
    activate BC
    BC->>BS: 8. reassignVetForService(bookingId, serviceId, newVetId)
    activate BS
    BS->>VAS: 9. reassignVetForService(...)
    Note over VAS: Release old slots & Reserve new slots
    VAS-->>BS: 10. OK
    BS-->>BC: 11. Updated Booking
    deactivate BS
    BC-->>UI: 12. Success
    deactivate BC
```

#### 4.12.7 Add-on Service During Examination

Thêm dịch vụ phát sinh trong lúc khám (chỉ hiện khi status = IN_PROGRESS hoặc ARRIVED cho SOS).

```mermaid
sequenceDiagram
    actor V as Staff/Manager
    participant UI as Dashboard
    participant BC as BookingController
    participant BS as BookingService
    participant PS as PricingService
    participant DB as Database

    V->>UI: 1. Click "Thêm dịch vụ" (only visible when IN_PROGRESS/ARRIVED)
    UI->>UI: 2. Show AddServiceModal with available services
    V->>UI: 3. Select service to add
    UI->>BC: 4. POST /bookings/{id}/add-service with serviceId
    activate BC
    BC->>BS: 5. addServiceToBooking(bookingId, serviceId)
    activate BS
    BS->>DB: 6. findById(bookingId)
    DB-->>BS: 7. Booking Entity
    BS->>BS: 8. Validate status is IN_PROGRESS or ARRIVED
    BS->>PS: 9. calculateServicePrice(service, petWeight)
    PS-->>BS: 10. Calculated price
    BS->>BS: 11. Create BookingServiceItem
    BS->>BS: 12. Update booking totalPrice (NOT recalculate distance fee)
    BS->>DB: 13. save(Booking with new service)
    BS-->>BC: 14. Updated BookingResponse
    deactivate BS
    BC-->>UI: 15. 200 OK
    deactivate BC
    UI-->>V: 16. Close modal, refresh booking detail
```

**Notes:**
-   Distance fee is NOT recalculated when adding services
-   Price is calculated based on pet's current weight
-   Only services from the same clinic can be added

#### 4.12.8 Receive Payment & Checkout (SRS Screen #46, UC-CM-10)

```mermaid
sequenceDiagram
    actor M as Clinic Manager
    participant UI as Manager Dashboard
    participant BC as BookingController
    participant BS as BookingService
    participant PR as PaymentRepository
    participant DB as Database

    M->>UI: 1. Click "Receive Payment & Checkout"
    activate UI
    UI->>BC: 2. POST /bookings/{id}/checkout
    activate BC
    BC->>BS: 3. processCheckout(id)
    activate BS
    BS->>DB: 4. findById(id)
    activate DB
    DB-->>BS: 5. Booking Entity (Status: IN_PROGRESS)
    deactivate DB
    BS->>PR: 6. findByBooking(booking)
    activate PR
    PR-->>BS: 7. Payment Entity
    deactivate PR
    BS->>BS: 8. Mark payment as PAID & update paidAt
    BS->>BS: 9. Set booking status to COMPLETED
    BS->>DB: 10. saveAll (Booking, Payment)
    activate DB
    DB-->>BS: 11. OK
    deactivate DB
    BS-->>BC: 12. BookingResponse
    deactivate BS
    BC-->>UI: 13. 200 OK (Completed)
    deactivate BC
    UI-->>M: 14. Update UI (Move booking to COMPLETED tab)
    deactivate UI
```

#### 4.12.9 Sequence Diagram: View My Bookings and Booking Details (UC-PO-08)

```mermaid
sequenceDiagram
    actor PO as Pet Owner
    participant UI as My Bookings Screen
    participant BC as BookingController
    participant BS as BookingService
    participant BR as BookingRepository
    participant DB as Database

    PO->>UI: Open My Bookings
    UI->>BC: GET /bookings/my-bookings
    BC->>BS: getMyBookings(ownerId, pageable)
    BS->>BR: findByPetOwnerId(ownerId, pageable)
    BR->>DB: Load owner bookings
    DB-->>BR: Booking page
    BR-->>BS: Booking page
    BS-->>BC: Page~BookingResponse~
    BC-->>UI: 200 OK

    PO->>UI: Select one booking
    UI->>BC: GET /bookings/{bookingId}
    BC->>BS: getBookingById(bookingId)
    BS->>BR: findById(bookingId)
    BR->>DB: Load booking detail
    DB-->>BR: Booking
    BR-->>BS: Booking
    BS-->>BC: BookingResponse
    BC-->>UI: 200 OK
```

**Notes:**
-   Bookings are grouped into 3 tabs: Upcoming (PENDING, CONFIRMED, IN_PROGRESS), Completed (COMPLETED), Cancelled (CANCELLED, NO_SHOW)
-   Empty state shown if no bookings exist
-   Pet Owner can click on any booking to view details

#### 4.12.10 Sequence Diagram: Cancel Booking

```mermaid
sequenceDiagram
    actor U as Pet Owner or Clinic Manager
    participant UI as Booking Detail Screen
    participant BC as BookingController
    participant BS as BookingService
    participant BR as BookingRepository
    participant SAS as StaffAssignmentService
    participant DB as Database

    U->>UI: Enter cancellation reason
    UI->>BC: POST /bookings/{bookingId}/cancel
    BC->>BS: cancelBooking(bookingId, reason, currentUserId)
    BS->>BR: findById(bookingId)
    BR->>DB: Load booking
    DB-->>BR: Booking
    BR-->>BS: Booking
    BS->>BS: Validate status and cancellation rule
    BS->>SAS: releaseSlotsForBooking(booking)
    BS->>BR: save(cancelledBooking)
    BR->>DB: Update booking status and cancellation fields
    DB-->>BR: Saved booking
    BR-->>BS: Saved booking
    BS->>BS: Trigger post-cancel side effects
    BS-->>BC: BookingResponse
    BC-->>UI: 200 OK
```

#### 4.12.20 Sequence Diagram: View New Bookings (Manager)

```mermaid
sequenceDiagram
    actor CM as Clinic Manager
    participant UI as Manager Booking Dashboard
    participant BC as BookingController
    participant BS as BookingService
    participant BR as BookingRepository
    participant DB as Database

    CM->>UI: Open clinic booking dashboard
    UI->>BC: GET /bookings/clinic/{clinicId}
    BC->>BS: getBookingsByClinic(clinicId, status, type, pageable)
    BS->>BR: findByClinicIdAndStatusAndType(clinicId, status, type, pageable)
    BR->>DB: Load clinic bookings by filters
    DB-->>BR: Booking page
    BR-->>BS: Booking page
    BS-->>BC: Page~BookingResponse~
    BC-->>UI: 200 OK
    UI-->>CM: Show manager booking list with new or actionable items by filter
```

#### 4.12.21 Sequence Diagram: Assign Staff to Booking

```mermaid
sequenceDiagram
    actor CM as Clinic Manager
    participant UI as Assignment Modal
    participant BC as BookingController
    participant BS as BookingService
    participant BR as BookingRepository
    participant BSI as BookingServiceItemRepository
    participant SAS as StaffAssignmentService
    participant UR as UserRepository
    participant DB as Database

    CM->>UI: Open assignment modal
    UI->>BC: GET /bookings/{bookingId}/availability
    BC->>BS: checkStaffAvailability(bookingId)
    BS->>BR: findById(bookingId)
    BR->>DB: Load pending booking
    DB-->>BR: Booking
    BR-->>BS: Booking
    BS->>SAS: checkStaffAvailabilityForBooking(booking)
    SAS->>DB: Read booking services, staff, shifts, and slots
    SAS-->>BS: StaffAvailabilityCheckResponse
    BS-->>BC: Availability result
    BC-->>UI: 200 OK

    UI->>BC: GET /bookings/{bookingId}/staff-options
    BC->>BS: getAvailableStaffForConfirm(bookingId)
    BS->>BR: findById(bookingId)
    BR->>DB: Load booking
    DB-->>BR: Booking
    BR-->>BS: Booking
    BS->>SAS: getAvailableStaffForBookingConfirm(booking)
    SAS->>DB: Load assignment candidates
    SAS-->>BS: List~StaffOptionDTO~
    BS-->>BC: Staff options
    BC-->>UI: 200 OK

    CM->>UI: Confirm assignment
    UI->>BC: POST /bookings/{bookingId}/confirm
    BC->>BS: confirmBooking(bookingId, request)
    BS->>BR: findById(bookingId)
    BR->>DB: Load booking
    DB-->>BR: Booking
    BR-->>BS: Booking
    opt removeUnavailableServices = true
        BS->>SAS: checkStaffAvailabilityForBooking(booking)
        BS->>BSI: delete(unavailableItems)
    end
    alt Manual assignment
        BS->>UR: findById(selectedStaffId)
        UR->>DB: Load chosen staff
        DB-->>UR: User
        UR-->>BS: Staff
        BS->>SAS: reserveSlotsForBooking(booking)
    else Auto assignment
        BS->>SAS: assignStaffToAllServices(booking)
        BS->>SAS: reserveSlotsForBooking(booking)
    end
    BS->>BR: save(confirmedBooking)
    BR->>DB: Persist booking and service assignments
    DB-->>BR: Saved booking
    BR-->>BS: Saved booking
    BS->>BS: Trigger post-confirm side effects
    BS-->>BC: BookingResponse
    BC-->>UI: 200 OK
```

#### 4.12.22 Sequence Diagram: Reassign Staff for Service Item

```mermaid
sequenceDiagram
    actor CM as Clinic Manager
    participant UI as Reassign Modal
    participant BC as BookingController
    participant BS as BookingService
    participant BR as BookingRepository
    participant BSI as BookingServiceItemRepository
    participant SAS as StaffAssignmentService
    participant UR as UserRepository
    participant DB as Database

    CM->>UI: Open service item reassignment
    UI->>BC: GET /bookings/{bookingId}/services/{serviceId}/available-staff
    BC->>BS: getAvailableStaffForReassign(bookingId, serviceId)
    BS->>BR: findById(bookingId)
    BR->>DB: Load booking
    DB-->>BR: Booking
    BR-->>BS: Booking
    BS->>BSI: findById(serviceId)
    BSI->>DB: Load booking service item
    DB-->>BSI: Service item
    BSI-->>BS: Service item
    BS->>SAS: getAvailableStaffForReassign(clinicId, bookingDate, startTime, specialty, slotsNeeded, currentStaffId)
    SAS->>DB: Read reassignment candidates
    SAS-->>BS: List~AvailableStaffResponse~
    BS-->>BC: Candidate list
    BC-->>UI: 200 OK

    CM->>UI: Select replacement staff
    UI->>BC: PUT /bookings/{bookingId}/services/{serviceId}/reassign
    BC->>BS: reassignStaffForService(bookingId, serviceId, newStaffId)
    BS->>BR: findById(bookingId)
    BR->>DB: Load booking
    DB-->>BR: Booking
    BR-->>BS: Booking
    BS->>SAS: reassignStaffForService(serviceId, newStaffId, bookingServiceItemRepository)
    BS->>BR: findById(bookingId)
    BR->>DB: Reload updated booking
    DB-->>BR: Updated booking
    BR-->>BS: Updated booking
    BS->>UR: findById(newStaffId)
    UR->>DB: Load new staff
    DB-->>UR: User
    UR-->>BS: New staff
    BS->>BS: Trigger post-reassign side effects
    BS-->>BC: BookingResponse
    BC-->>UI: 200 OK
```

#### 4.12.23 Sequence Diagram: Update Booking Progress

```mermaid
sequenceDiagram
    actor O as Staff or Clinic Manager
    participant UI as Booking Detail Screen
    participant BC as BookingController
    participant BS as BookingService
    participant BR as BookingRepository
    participant DB as Database

    alt Check-in
        O->>UI: Start in-clinic execution
        UI->>BC: POST /bookings/{bookingId}/check-in
        BC->>BS: checkIn(bookingId, currentUser)
        BS->>BR: findByIdWithDetails(bookingId)
        BR->>DB: Load booking with details
        DB-->>BR: Booking
        BR-->>BS: Booking
        BS->>BR: save(status = IN_PROGRESS)
        BR->>DB: Update booking
        DB-->>BR: Saved booking
        BR-->>BS: Saved booking
        BS->>BS: Trigger post-check-in side effects
        BS-->>BC: BookingResponse
        BC-->>UI: 200 OK
    else Start moving
        O->>UI: Start movement
        UI->>BC: POST /bookings/{bookingId}/start-moving
        BC->>BS: startMoving(bookingId, currentUser)
        BS->>BR: findById(bookingId)
        BR->>DB: Load booking
        DB-->>BR: Booking
        BR-->>BS: Booking
        BS->>BR: save(status = IN_PROGRESS)
        BR->>DB: Update booking
        DB-->>BR: Saved booking
        BR-->>BS: Saved booking
        BS->>BS: Trigger post-start-moving side effects
        BS-->>BC: BookingResponse
        BC-->>UI: 200 OK
    else Arrived
        O->>UI: Mark arrival
        UI->>BC: POST /bookings/{bookingId}/arrived
        BC->>BS: arrived(bookingId, currentUser)
        BS->>BR: findById(bookingId)
        BR->>DB: Load booking
        DB-->>BR: Booking
        BR-->>BS: Booking
        BS->>BR: save(arrivedAt = now)
        BR->>DB: Update booking arrival
        DB-->>BR: Saved booking
        BR-->>BS: Saved booking
        BS->>BS: Trigger post-arrival side effects
        BS-->>BC: BookingResponse
        BC-->>UI: 200 OK
    else Checkout
        O->>UI: Complete execution
        UI->>BC: POST /bookings/{bookingId}/checkout
        BC->>BS: processCheckoutAuthorized(bookingId, request, currentUser)
        BS->>BR: findById(bookingId)
        BR->>DB: Load booking
        DB-->>BR: Booking
        BR-->>BS: Booking
        BS->>BS: Recalculate final totals if needed
        BS->>BR: save(status = COMPLETED, final totals)
        BR->>DB: Update booking completion
        DB-->>BR: Saved booking
        BR-->>BS: Saved booking
        BS->>BS: Trigger post-checkout side effects
        BS-->>BC: BookingResponse
        BC-->>UI: 200 OK
    end
```

#### 4.12.24 Sequence Diagram: View Assigned Bookings and Staff Home Summary

```mermaid
sequenceDiagram
    actor S as Staff
    participant HomeUI as Staff Home
    participant ListUI as Assigned Bookings Screen
    participant BC as BookingController
    participant BS as BookingService
    participant BR as BookingRepository
    participant DB as Database

    S->>HomeUI: Open staff home
    HomeUI->>BC: GET /bookings/staff/home-summary
    BC->>BS: getStaffHomeSummary(staffId)
    BS->>BR: findByAssignedStaffIdAndBookingDate(staffId, today)
    BR->>DB: Load today's assigned bookings
    DB-->>BR: Today's bookings
    BR-->>BS: Today's bookings
    BS->>BR: findByAssignedStaffIdAndBookingDateBetweenAndStatusIn(staffId, today, next7Days, activeStatuses)
    BR->>DB: Load upcoming assigned bookings
    DB-->>BR: Upcoming bookings
    BR-->>BS: Upcoming bookings
    BS-->>BC: StaffHomeSummaryResponse
    BC-->>HomeUI: 200 OK

    S->>ListUI: Open assigned bookings
    ListUI->>BC: GET /bookings/staff/{staffId}
    BC->>BS: getBookingsByStaff(staffId, status, pageable)
    BS->>BR: findByAssignedStaffIdAndStatus(staffId, status, pageable)
    BR->>DB: Load assigned bookings
    DB-->>BR: Booking page
    BR-->>BS: Booking page
    BS-->>BC: Page~BookingResponse~
    BC-->>ListUI: 200 OK
```

#### 4.12.25 Sequence Diagram: Add Add-on Service

```mermaid
sequenceDiagram
    actor O as Staff or Clinic Manager
    participant UI as Booking Detail Screen
    participant BC as BookingController
    participant BS as BookingService
    participant BR as BookingRepository
    participant CSR as ClinicServiceRepository
    participant BSI as BookingServiceItemRepository
    participant DB as Database

    O->>UI: Open add-on service management
    UI->>BC: GET /bookings/{bookingId}/available-add-ons
    BC->>BS: getAvailableServicesForAddOn(bookingId, currentUser)
    BS->>BR: findById(bookingId)
    BR->>DB: Load booking
    DB-->>BR: Booking
    BR-->>BS: Booking
    BS->>CSR: findByClinicClinicIdAndIsActiveTrue(clinicId)
    CSR->>DB: Load active clinic services
    DB-->>CSR: Service list
    CSR-->>BS: Service list
    BS-->>BC: List~ClinicServiceResponse~
    BC-->>UI: 200 OK

    O->>UI: Select one service
    UI->>BC: POST /bookings/{bookingId}/services
    BC->>BS: addServiceToBooking(bookingId, serviceId, currentUser)
    BS->>BR: findById(bookingId)
    BR->>DB: Load booking
    DB-->>BR: Booking
    BR-->>BS: Booking
    BS->>CSR: findById(serviceId)
    CSR->>DB: Load clinic service
    DB-->>CSR: Clinic service
    CSR-->>BS: Clinic service
    BS->>BS: Calculate additional service price
    BS->>BR: save(updatedBooking)
    BR->>DB: Persist add-on item and new total
    DB-->>BR: Saved booking
    BR-->>BS: Saved booking
    BS->>BS: Trigger post-add-service side effects
    BS-->>BC: BookingResponse
    BC-->>UI: 200 OK
```

#### 4.12.26 Sequence Diagram: Remove Add-on Service

```mermaid
sequenceDiagram
    actor O as Staff or Clinic Manager
    participant UI as Booking Detail Screen
    participant BC as BookingController
    participant BS as BookingService
    participant BR as BookingRepository
    participant BSI as BookingServiceItemRepository
    participant DB as Database

    O->>UI: Remove existing add-on item
    UI->>BC: DELETE /bookings/{bookingId}/services/{serviceId}
    BC->>BS: removeServiceFromBooking(bookingId, serviceId, currentUser)
    BS->>BR: findById(bookingId)
    BR->>DB: Load booking
    DB-->>BR: Booking
    BR-->>BS: Booking
    BS->>BSI: delete(itemToRemove)
    BSI->>DB: Delete add-on service item
    DB-->>BSI: Deleted
    BSI-->>BS: Success
    BS->>BR: save(updatedBooking)
    BR->>DB: Persist new total
    DB-->>BR: Saved booking
    BR-->>BS: Saved booking
    BS->>BS: Trigger post-remove-service side effects
    BS-->>BC: BookingResponse
    BC-->>UI: 200 OK
```

#### 4.12.27 Sequence Diagram: Vaccination Booking Advisory in Standard Flow

```mermaid
sequenceDiagram
    actor PO as Pet Owner
    participant UI as Mobile Booking Wizard or AI Booking Chat
    participant BT as Booking Tools
    participant SBC as SpringBackendClient
    participant VC as VaccinationController
    participant VS as VaccinationService
    participant DB as Database

    PO->>UI: 1. Chọn pet và dịch vụ tiêm chủng
    activate UI
    UI->>BT: 2. get_clinic_services(clinic_id, pet_species, is_home_visit)
    activate BT
    BT->>SBC: 3. GET /services/by-clinic/{clinicId}/compatible
    activate SBC
    SBC->>DB: 4. SELECT compatible clinic services + dose prices
    activate DB
    DB-->>SBC: 5. Service metadata
    deactivate DB
    SBC-->>BT: 6. Vaccination service list
    deactivate SBC
    BT-->>UI: 7. serviceCategory, vaccineTemplateId, dosePrices
    deactivate BT
    UI->>BT: 8. check_vaccination_status(pet_id, vaccine_template_id)
    activate BT
    BT->>SBC: 9. GET /vaccinations/pet/{petId}
    activate SBC
    SBC->>VC: 10. getVaccinationsByPet(petId)
    activate VC
    VC->>VS: 11. getVaccinationsByPet(petId)
    activate VS
    VS->>DB: 12. SELECT vaccination history by pet
    activate DB
    DB-->>VS: 13. Vaccination history
    deactivate DB
    VS-->>VC: 14. VaccinationResponse list
    deactivate VS
    VC-->>SBC: 15. History response
    deactivate VC
    SBC->>VC: 16. getUpcomingVaccinations(petId)
    activate VC
    VC->>VS: 17. getUpcomingVaccinations(petId)
    activate VS
    VS->>DB: 18. SELECT vaccination templates and predicted due doses
    activate DB
    DB-->>VS: 19. Upcoming vaccination suggestions
    deactivate DB
    VS-->>VC: 20. VaccinationResponse list
    deactivate VS
    VC-->>SBC: 21. Upcoming response
    deactivate VC
    SBC-->>BT: 22. Vaccination history + upcoming doses
    deactivate SBC
    BT-->>UI: 23. Advisory summary, recent doses, recommended next dose
    deactivate BT
    UI-->>PO: 24. Hiển thị giá theo mũi + gợi ý nhẹ, vẫn giữ flow booking chuẩn
    deactivate UI
```

**Notes:**
-   Only bookings with status trước IN_PROGRESS can be cancelled
-   Slots are restored to AVAILABLE status
-   Notifications sent to Clinic Manager and assigned Staff (if any)
-   If payment method is ONLINE, refund request is created (handled by UC-CM-07)

#### 4.12.11 View Assigned Bookings (UC-VT-03)

```mermaid
sequenceDiagram
    actor V as Staff
    participant UI as Staff Schedule Screen (Mobile/Web)
    participant API as BookingController
    participant SVC as BookingService
    participant DB as PostgreSQL

    V->>UI: 1. Navigate to "Lịch hẹn" screen
    activate UI
    UI->>API: 2. GET /api/bookings/staff/{staffId}
    activate API
    API->>SVC: 3. getBookingsByStaff(staffId, status, pageable)
    activate SVC
    SVC->>DB: 4. SELECT * FROM bookings WHERE vet_id = ? AND status IN (...)
    activate DB
    DB-->>SVC: 5. List<Booking>
    deactivate DB
    SVC->>SVC: 6. Apply filters (date range, status, service type)
    SVC->>SVC: 7. Sort by booking_date ASC
    SVC-->>API: 8. List<BookingResponse>
    deactivate SVC
    API-->>UI: 9. 200 OK + booking list
    deactivate API
    UI-->>V: 10. Display bookings with status badges
    deactivate UI
```

**Notes:**
-   Filters available: Today, Upcoming, Completed, All
-   Status badges: CONFIRMED (yellow), IN_PROGRESS (purple), COMPLETED (green), CANCELLED/NO_SHOW (gray/red)
-   Empty state shown if no assigned bookings
-   Staff can click on booking to view details and take actions

#### 4.12.12 Update Appointment Progress (UC-VT-04)

```mermaid
sequenceDiagram
    actor V as Staff
    participant UI as Booking Detail Screen (Mobile/Web)
    participant API as BookingController
    participant SVC as BookingService
    participant ER as EMRRepository
    participant BR as BookingRepository
    participant DB as PostgreSQL

    V->>UI: 1. View booking detail
    activate UI
    UI->>UI: 2. Show action button based on status
    V->>UI: 3. Click action button (Check-in / Start moving / Checkout / Complete)
    UI->>API: 4. POST /api/bookings/{id}/{action}
    activate API
    API->>SVC: 5. updateBookingStatus(bookingId, newStatus)
    activate SVC
    SVC->>BR: 6. findById(bookingId)
    activate BR
    BR->>DB: 7. SELECT * FROM bookings WHERE booking_id = ?
    activate DB
    DB-->>BR: 8. Booking entity
    deactivate DB
    BR-->>SVC: 9. Booking
    deactivate BR
    SVC->>SVC: 10. Validate status transition (CONFIRMED→IN_PROGRESS hoặc IN_PROGRESS→COMPLETED)
    alt Status transition valid
        alt Action = check-in hoặc start-moving
            SVC->>ER: 11. createEMRShell(bookingId, petId, vetId)
            activate ER
            ER->>DB: 12. INSERT INTO emr (booking_id, pet_id, vet_id)
            activate DB
            DB-->>ER: 13. EMR created
            deactivate DB
            deactivate ER
        else Action = checkout/complete
            SVC->>ER: 14. findByBooking(bookingId)
            activate ER
            ER->>DB: 15. SELECT * FROM emr WHERE booking_id = ?
            activate DB
            DB-->>ER: 16. EMR entity
            deactivate DB
            deactivate ER
            SVC->>SVC: 17. Validate EMR has Assessment and Plan
            alt EMR incomplete
                SVC-->>API: 18. Throw BadRequestException
                deactivate SVC
                API-->>UI: 19. 400 Bad Request
                deactivate API
                UI-->>V: 20. Show error toast
                deactivate UI
            end
        end
        SVC->>SVC: 21. Update booking status
        SVC->>BR: 22. save(booking)
        activate BR
        BR->>DB: 23. UPDATE bookings SET status = ?
        activate DB
        DB-->>BR: 24. OK
        deactivate DB
        deactivate BR
        SVC-->>API: 25. BookingResponse (updated status)
        deactivate SVC
        API-->>UI: 26. 200 OK
        deactivate API
        UI-->>V: 27. Update UI with new status
    else Invalid transition
        SVC-->>API: 11. Throw BadRequestException
        deactivate SVC
        API-->>UI: 12. 400 Bad Request
        deactivate API
        UI-->>V: 13. Show error toast
    end
    deactivate UI
```

**Notes:**
-   Valid status transitions: CONFIRMED → IN_PROGRESS → COMPLETED
-   EMR shell is created when booking starts execution (check-in/start-moving)
-   Checkout/complete requires valid trạng thái hiện tại là IN_PROGRESS
-   Notifications sent to Pet Owner and Clinic Manager on status changes

#### 4.12.13 Check-in Patient (UC-VT-05)

```mermaid
sequenceDiagram
    actor V as Staff
    participant UI as Booking Detail Screen (Mobile/Web)
    participant API as BookingController
    participant SVC as BookingService
    participant ER as EMRRepository
    participant BR as BookingRepository
    participant NR as NotificationRepository
    participant DB as PostgreSQL

    V->>UI: 1. Click "Check-in" button
    activate UI
    UI->>UI: 2. Show confirmation modal
    V->>UI: 3. Confirm check-in
    UI->>API: 4. POST /api/bookings/{id}/check-in
    activate API
    API->>SVC: 5. checkInPatient(bookingId)
    activate SVC
    SVC->>BR: 6. findById(bookingId)
    activate BR
    BR->>DB: 7. SELECT * FROM bookings WHERE booking_id = ?
    activate DB
    DB-->>BR: 8. Booking entity (Status: CONFIRMED)
    deactivate DB
    BR-->>SVC: 9. Booking
    deactivate BR
    SVC->>SVC: 10. Validate: status = CONFIRMED
    alt Status = CONFIRMED
        SVC->>SVC: 11. Update booking.status = IN_PROGRESS
        SVC->>BR: 12. save(booking)
        activate BR
        BR->>DB: 13. UPDATE bookings SET status = 'IN_PROGRESS'
        activate DB
        DB-->>BR: 14. OK
        deactivate DB
        deactivate BR
        SVC->>ER: 15. createEMRShell(booking)
        activate ER
        ER->>DB: 16. INSERT INTO emr (booking_id, pet_id, vet_id, created_at)
        activate DB
        DB-->>ER: 17. EMR created
        deactivate DB
        deactivate ER
        SVC->>NR: 18. Create notification for Pet Owner
        activate NR
        NR->>DB: 19. INSERT INTO notifications
        activate DB
        DB-->>NR: 20. OK
        deactivate DB
        deactivate NR
        SVC-->>API: 21. BookingResponse (IN_PROGRESS)
        deactivate SVC
        API-->>UI: 22. 200 OK
        deactivate API
        UI-->>V: 23. Show success toast + update UI
    else Invalid status
        SVC-->>API: 11. Throw BadRequestException
        deactivate SVC
        API-->>UI: 12. 400 Bad Request
        deactivate API
        UI-->>V: 13. Show error toast
    end
    deactivate UI
```

**Notes:**
-   Only bookings with status CONFIRMED can be checked in
-   EMR shell is created with booking_id, pet_id, vet_id, created_at
-   Notification sent to Pet Owner: "Thú cưng của bạn đang được khám"
-   After check-in, Staff can start filling EMR (UC-VT-06)

#### 4.11.14 Mark Treatment Finished (UC-VT-09)

```mermaid
sequenceDiagram
    actor V as Staff
    participant UI as Booking Detail Screen (Mobile/Web)
    participant API as BookingController
    participant SVC as BookingService
    participant ER as EMRRepository
    participant BR as BookingRepository
    participant NR as NotificationRepository
    participant DB as PostgreSQL

    V->>UI: 1. Click "Hoàn thành khám" button
    activate UI
    UI->>UI: 2. Show confirmation modal
    V->>UI: 3. Confirm finish treatment
    UI->>API: 4. POST /api/bookings/{id}/finish
    activate API
    API->>SVC: 5. finishTreatment(bookingId)
    activate SVC
    SVC->>BR: 6. findById(bookingId)
    activate BR
    BR->>DB: 7. SELECT * FROM bookings WHERE booking_id = ?
    activate DB
    DB-->>BR: 8. Booking entity (Status: IN_PROGRESS)
    deactivate DB
    BR-->>SVC: 9. Booking
    deactivate BR
    SVC->>ER: 10. findByBooking(bookingId)
    activate ER
    ER->>DB: 11. SELECT * FROM emr WHERE booking_id = ?
    activate DB
    DB-->>ER: 12. EMR entity
    deactivate DB
    ER-->>SVC: 13. EMR
    deactivate ER
    SVC->>SVC: 14. Validate EMR completeness
    alt EMR has Assessment AND Plan
        SVC->>SVC: 15. Update booking.status = COMPLETED
        SVC->>BR: 16. save(booking)
        activate BR
        BR->>DB: 17. UPDATE bookings SET status = 'COMPLETED'
        activate DB
        DB-->>BR: 18. OK
        deactivate DB
        deactivate BR
        SVC->>NR: 19. Create notifications (Pet Owner, Manager)
        activate NR
        NR->>DB: 20. INSERT INTO notifications
        activate DB
        DB-->>NR: 21. OK
        deactivate DB
        deactivate NR
        SVC-->>API: 22. BookingResponse (COMPLETED)
        deactivate SVC
        API-->>UI: 23. 200 OK
        deactivate API
        UI-->>V: 24. Show success toast + update UI
    else EMR incomplete
        SVC-->>API: 15. Throw BadRequestException
        deactivate SVC
        API-->>UI: 16. 400 Bad Request
        deactivate API
        UI-->>V: 17. Show error toast "Vui lòng hoàn thành EMR"
    end
    deactivate UI
```

**Notes:**
-   EMR must have Assessment and Plan fields filled before treatment can be marked finished
-   Booking status changes from IN_PROGRESS to COMPLETED
-   Notification sent to Clinic Manager: "Booking đã hoàn tất"
-   Notification sent to Pet Owner: "Lịch hẹn đã hoàn thành"

#### 4.12.15 Handle Cancellations & Refunds (UC-CM-07)

```mermaid
sequenceDiagram
    actor CM as Clinic Manager
    participant UI as Manager Dashboard (Web)
    participant API as BookingController
    participant SVC as BookingService
    participant PR as PaymentRepository
    participant BR as BookingRepository
    participant NR as NotificationRepository
    participant DB as PostgreSQL

    CM->>UI: 1. View cancelled bookings section
    activate UI
    UI->>API: 2. GET /api/bookings/cancelled
    activate API
    API->>SVC: 3. getCancelledBookings(clinicId)
    activate SVC
    SVC->>DB: 4. SELECT * FROM bookings WHERE status = 'CANCELLED'
    activate DB
    DB-->>SVC: 5. List<Booking>
    deactivate DB
    SVC-->>API: 6. List<BookingResponse>
    deactivate SVC
    API-->>UI: 7. 200 OK + cancelled bookings
    deactivate API
    UI-->>CM: 8. Display list with refund status
    CM->>UI: 9. Click on booking to process refund
    UI->>UI: 10. Show refund modal
    CM->>UI: 11. Select refund option (Full, Partial, None)
    CM->>UI: 12. Enter refund amount (if partial)
    UI->>API: 13. POST /api/bookings/{id}/refund
    activate API
    API->>SVC: 14. processRefund(bookingId, refundData)
    activate SVC
    SVC->>BR: 15. findById(bookingId)
    activate BR
    BR->>DB: 16. SELECT * FROM bookings WHERE booking_id = ?
    activate DB
    DB-->>BR: 17. Booking entity
    deactivate DB
    BR-->>SVC: 18. Booking
    deactivate BR
    SVC->>PR: 19. findByBooking(booking)
    activate PR
    PR->>DB: 20. SELECT * FROM payments WHERE booking_id = ?
    activate DB
    DB-->>PR: 21. Payment entity
    deactivate DB
    PR-->>SVC: 22. Payment
    deactivate PR
    SVC->>SVC: 23. Calculate refund based on policy
    alt Payment method = ONLINE
        SVC->>SVC: 24. Create refund transaction
        SVC->>PR: 25. Update payment.refund_amount
        activate PR
        PR->>DB: 26. UPDATE payments SET refund_amount = ?
        activate DB
        DB-->>PR: 27. OK
        deactivate DB
        deactivate PR
    end
    SVC->>NR: 28. Create notification for Pet Owner
    activate NR
    NR->>DB: 29. INSERT INTO notifications
    activate DB
    DB-->>NR: 30. OK
    deactivate DB
    deactivate NR
    SVC-->>API: 31. RefundResponse
    deactivate SVC
    API-->>UI: 32. 200 OK
    deactivate API
    UI-->>CM: 33. Show success toast + update UI
    deactivate UI
```

**Notes:**
-   Refund policy: Cancel >24h before appointment = 100% refund, <24h = 50% refund, <6h = no refund
-   Only ONLINE payment bookings require refund processing
-   CASH bookings are marked as cancelled without refund
-   Notification sent to Pet Owner with refund details

#### 4.12.16 Check Staff Availability (UC-CM-14)

```mermaid
sequenceDiagram
    actor CM as Clinic Manager
    participant UI as Booking Detail Screen (Web)
    participant API as BookingController
    participant SVC as BookingService
    participant VR as VetRepository
    participant SR as SlotRepository
    participant DB as PostgreSQL

    CM->>UI: 1. Click "Gán nhân viên" button
    activate UI
    UI->>API: 2. GET /api/bookings/{id}/available-vets
    activate API
    API->>SVC: 3. getAvailableVets(bookingId)
    activate SVC
    SVC->>DB: 4. SELECT * FROM bookings WHERE booking_id = ?
    activate DB
    DB-->>SVC: 5. Booking (date, time, services)
    deactivate DB
    SVC->>VR: 6. findByClinic(clinicId)
    activate VR
    VR->>DB: 7. SELECT * FROM clinic_staff WHERE clinic_id = ? AND role = 'STAFF'
    activate DB
    DB-->>VR: 8. List<Staff>
    deactivate DB
    VR-->>SVC: 9. List<Staff>
    deactivate VR
    SVC->>SVC: 10. Filter vets by service specialty
    loop For each vet
        SVC->>SR: 11. checkAvailability(vetId, bookingSlots)
        activate SR
        SR->>DB: 12. SELECT * FROM slots WHERE vet_id = ? AND slot_time IN (...)
        activate DB
        DB-->>SR: 13. List<Slot>
        deactivate DB
        SR-->>SVC: 14. Availability status
        deactivate SR
        SVC->>SVC: 15. Calculate workload (bookings count for day)
    end
    SVC-->>API: 16. List<VetAvailabilityDTO>
    deactivate SVC
    API-->>UI: 17. 200 OK + available vets
    deactivate API
    UI-->>CM: 18. Display vet list with badges (Available, Busy)
    deactivate UI
```

**Notes:**
-   Staff availability is checked based on:
    -   Shift schedule (vet must have shift on booking date)
    -   Slot availability (slots not already BOOKED)
    -   Service specialty matching
    -   Current workload (number of bookings assigned for the day)
-   Staff are sorted by availability and workload (least busy first)
-   Unavailable vets are shown with reason (No shift, Fully booked, Wrong specialty)

#### 4.12.17 Reassign Staff to Service (UC-CM-15)

```mermaid
sequenceDiagram
    actor CM as Clinic Manager
    participant UI as Booking Detail Screen (Web)
    participant API as BookingController
    participant SVC as BookingService
    participant BR as BookingRepository
    participant SR as SlotRepository
    participant NR as NotificationRepository
    participant DB as PostgreSQL

    CM->>UI: 1. Click "Gán lại nhân viên" button
    activate UI
    UI->>UI: 2. Show reassignment modal
    CM->>UI: 3. Select reassignment reason
    CM->>UI: 4. Select new vet from dropdown
    UI->>API: 5. POST /api/bookings/{id}/reassign-vet
    activate API
    API->>SVC: 6. reassignVet(bookingId, newVetId, reason)
    activate SVC
    SVC->>BR: 7. findById(bookingId)
    activate BR
    BR->>DB: 8. SELECT * FROM bookings WHERE booking_id = ?
    activate DB
    DB-->>BR: 9. Booking with current vet
    deactivate DB
    BR-->>SVC: 10. Booking
    deactivate BR
    SVC->>SVC: 11. Store old vet ID
    SVC->>SVC: 12. Validate new vet availability
    alt New vet is available
        SVC->>SR: 13. Update old vet's slots to AVAILABLE
        activate SR
        SR->>DB: 14. UPDATE slots SET status = 'AVAILABLE' WHERE vet_id = ? AND booking_id = ?
        activate DB
        DB-->>SR: 15. OK
        deactivate DB
        deactivate SR
        SVC->>SR: 16. Update new vet's slots to BOOKED
        activate SR
        SR->>DB: 17. UPDATE slots SET status = 'BOOKED', booking_id = ? WHERE vet_id = ? AND slot_time IN (...)
        activate DB
        DB-->>SR: 18. OK
        deactivate DB
        deactivate SR
        SVC->>BR: 19. Update booking.vet_id = newVetId
        activate BR
        BR->>DB: 20. UPDATE bookings SET vet_id = ?
        activate DB
        DB-->>BR: 21. OK
        deactivate DB
        deactivate BR
        SVC->>NR: 22. Create notifications (old vet, new vet, pet owner)
        activate NR
        NR->>DB: 23. INSERT INTO notifications (x3)
        activate DB
        DB-->>NR: 24. OK
        deactivate DB
        deactivate NR
        SVC-->>API: 25. BookingResponse (updated)
        deactivate SVC
        API-->>UI: 26. 200 OK
        deactivate API
        UI-->>CM: 27. Show success toast + update UI
    else New vet not available
        SVC-->>API: 13. Throw BadRequestException
        deactivate SVC
        API-->>UI: 14. 400 Bad Request
        deactivate API
        UI-->>CM: 15. Show error toast
    end
    deactivate UI
```

**Notes:**
-   Reassignment reasons: Staff unavailable, Staff overloaded, Emergency, Other
-   Old vet's slots are released back to AVAILABLE
-   New vet's corresponding slots are marked as BOOKED
-   Notifications sent to:
    -   Old Staff: "Bạn đã được gỡ khỏi lịch hẹn [Booking ID]"
    -   New Staff: "Bạn được phân công lịch hẹn mới [Booking ID]"
    -   Pet Owner: "Nhân viên của bạn đã được thay đổi thành Dr. [Name]"

#### 4.12.18 Manage Shifts - Delete Shift (UC-CM-16)

```mermaid
sequenceDiagram
    actor CM as Clinic Manager
    participant UI as Shift Management Screen (Web)
    participant API as VetShiftController
    participant SVC as VetShiftService
    participant SR as SlotRepository
    participant VSR as VetShiftRepository
    participant BR as BookingRepository
    participant DB as PostgreSQL

    CM->>UI: 1. Click "Xóa ca làm" button on shift
    activate UI
    UI->>UI: 2. Show confirmation modal
    CM->>UI: 3. Confirm deletion
    UI->>API: 4. DELETE /api/vet-shifts/{shiftId}
    activate API
    API->>SVC: 5. deleteShift(shiftId, clinicId)
    activate SVC
    SVC->>VSR: 6. findById(shiftId)
    activate VSR
    VSR->>DB: 7. SELECT * FROM vet_shifts WHERE shift_id = ?
    activate DB
    DB-->>VSR: 8. VetShift entity
    deactivate DB
    VSR-->>SVC: 9. VetShift
    deactivate VSR
    SVC->>SR: 10. findByShift(shiftId)
    activate SR
    SR->>DB: 11. SELECT * FROM slots WHERE shift_id = ?
    activate DB
    DB-->>SR: 12. List<Slot>
    deactivate DB
    SR-->>SVC: 13. List<Slot>
    deactivate SR
    SVC->>SVC: 14. Check if any slot has status = BOOKED
    alt No BOOKED slots
        SVC->>SR: 15. Delete all slots for this shift
        activate SR
        SR->>DB: 16. DELETE FROM slots WHERE shift_id = ?
        activate DB
        DB-->>SR: 17. OK
        deactivate DB
        deactivate SR
        SVC->>VSR: 18. Delete shift
        activate VSR
        VSR->>DB: 19. DELETE FROM vet_shifts WHERE shift_id = ?
        activate DB
        DB-->>VSR: 20. OK
        deactivate DB
        deactivate VSR
        SVC-->>API: 21. Success message
        deactivate SVC
        API-->>UI: 22. 200 OK
        deactivate API
        UI-->>CM: 23. Show success toast + update UI
    else Has BOOKED slots
        SVC->>BR: 15. findBySlots(bookedSlots)
        activate BR
        BR->>DB: 16. SELECT * FROM bookings WHERE slot_id IN (...)
        activate DB
        DB-->>BR: 17. List<Booking>
        deactivate DB
        BR-->>SVC: 18. Affected bookings
        deactivate BR
        SVC-->>API: 19. Throw ConflictException with booking details
        deactivate SVC
        API-->>UI: 20. 409 Conflict + affected bookings
        deactivate API
        UI-->>CM: 21. Show error modal with booking list
    end
    deactivate UI
```

**Notes:**
-   Shift can only be deleted if no slots are BOOKED
-   If shift has booked slots, system shows list of affected bookings and prevents deletion
-   Manager must reassign or cancel bookings before deleting shift
-   All AVAILABLE and BLOCKED slots are deleted along with the shift

#### 4.12.19 Cross-Reference to SRS

| SRS Section | Use Case | Main Backend Flow |
|-------------|----------|-------------------|
| 3.8.1 | Book an Appointment | `GET /bookings/public/available-slots`, `POST /bookings/public/estimated-completion`, `POST /bookings` |
| 3.8.2 | Book on Behalf | `POST /bookings/proxy` |
| 3.8.3 | View My Bookings, Booking History, and Booking Details | `GET /bookings/my-bookings`, `GET /bookings/{bookingId}`, `GET /bookings/code/{bookingCode}` |
| 3.8.4 | Cancel Booking | `POST /bookings/{bookingId}/cancel` |
| 3.8.5 | View New Bookings | `GET /bookings/clinic/{clinicId}` |
| 3.8.6 | Assign Staff to Booking | `GET /bookings/{bookingId}/availability`, `GET /bookings/{bookingId}/staff-options`, `POST /bookings/{bookingId}/confirm` |
| 3.8.7 | Reassign Staff for Service Item | `GET /bookings/{bookingId}/services/{serviceId}/available-staff`, `PUT /bookings/{bookingId}/services/{serviceId}/reassign` |
| 3.8.8 | Update Booking Progress | `POST /bookings/{bookingId}/check-in`, `POST /bookings/{bookingId}/start-moving`, `POST /bookings/{bookingId}/arrived`, `POST /bookings/{bookingId}/checkout` |
| 3.8.9 | View Assigned Bookings | `GET /bookings/staff/{staffId}` |
| 3.8.10 | View Staff Home Summary | `GET /bookings/staff/home-summary` |
| 3.8.11 | Add Add-on Service | `GET /bookings/{bookingId}/available-add-ons`, `POST /bookings/{bookingId}/services` |
| 3.8.12 | Remove Add-on Service | `DELETE /bookings/{bookingId}/services/{serviceId}` |
| 3.8.13 | Vaccination Booking Advisory in Standard Flow | `GET /services/by-clinic/{clinicId}/compatible`, `GET /vaccinations/pet/{petId}`, `GET /vaccinations/pet/{petId}/upcoming` |

---

### 4.13 SOS Emergency Management

#### 4.13.1 Class Diagram - SOS Emergency

**Business Rules:** BR-59, BR-60, BR-61, BR-62, BR-63, BR-64, BR-65, BR-66

**Architecture Overview:**
The SOS Emergency module uses a **refactored service-oriented architecture** with clear separation of concerns:
-   **SosMatchingService:** Core business logic for matching process
-   **SosSessionManager:** Redis session management (clinic lists, index, timestamps, locks)
-   **SosNotificationService:** WebSocket broadcasting to Pet Owners and Clinic Managers

```mermaid
classDiagram
    class SosController {
        -SosMatchingService sosMatchingService
        +startMatching(SosMatchRequest) ResponseEntity~SosMatchResponse~
        +confirmSos(SosConfirmRequest) ResponseEntity~SosMatchResponse~
        +getStatus(UUID) ResponseEntity~SosMatchResponse~
        +cancelMatching(UUID) ResponseEntity~Void~
    }
    class SosMatchingService {
        -BookingRepository bookingRepository
        -ClinicRepository clinicRepository
        -PetRepository petRepository
        -UserRepository userRepository
        -LocationService locationService
        -SosSessionManager sessionManager
        -SosNotificationService sosNotificationService
        +startMatching(SosMatchRequest, UUID) SosMatchResponse
        +processConfirmation(SosConfirmRequest, UUID) SosMatchResponse
        +escalateToNextClinic(UUID) SosMatchResponse
        +cancelMatching(UUID, UUID) void
        +checkTimeouts() void
        +getMatchingStatus(UUID) SosMatchResponse
        +getActiveSosBooking(UUID) Optional~Booking~
        -createSosBooking(Pet, SosMatchRequest, UUID) Booking
        -confirmSos(Booking, User, UUID) SosMatchResponse
        -declineSos(Booking, String) SosMatchResponse
        -handleNoClinicAvailable(Booking) SosMatchResponse
    }
    class SosSessionManager {
        -RedisTemplate~String,Object~ redisTemplate
        +acquireUserLock(UUID) boolean
        +releaseUserLock(UUID) void
        +createSession(UUID, List~Clinic~) void
        +clearSession(UUID) void
        +getCurrentIndex(UUID) Optional~Integer~
        +getClinicIds(UUID) Optional~List~String~~
        +updateIndex(UUID, int) void
        +updateNotifiedAt(UUID) void
        +getNotifiedAt(UUID) Optional~Long~
        +hasCurrentClinicTimedOut(UUID) boolean
        +getElapsedSeconds(UUID) long
        +sessionExists(UUID) boolean
        +hasMoreClinics(UUID) boolean
        +getClinicTimeoutSeconds() int
        +getMaxClinicsToTry() int
    }
    class SosNotificationService {
        -SimpMessagingTemplate messagingTemplate
        +notifyOwnerClinicContacted(UUID, Clinic, int, int, double) void
        +notifyOwnerWaitingNext(UUID, Clinic, int, int) void
        +notifyOwnerConfirmed(UUID, Clinic, User) void
        +notifyOwnerNoClinic(UUID) void
        +notifyOwnerCancelled(UUID) void
        +alertClinic(Booking, Clinic, int, int) void
        +getClinicTimeoutSeconds() int
    }
    class SosMatchingScheduler {
        -SosMatchingService sosMatchingService
        +checkSosTimeouts() void
    }
    class BookingRepository {
        <<interface>>
        +save(Booking) Booking
        +findById(UUID) Optional~Booking~
        +findByStatusAndBookingType(BookingStatus, BookingType) List~Booking~
        +findActiveSosBookingsByPetOwner(UUID) List~Booking~
    }
    class ClinicRepository {
        <<interface>>
        +findNearbyClinics(BigDecimal, BigDecimal, double) List~Clinic~
    }
    class SosMatchRequest {
        +UUID petId
        +BigDecimal latitude
        +BigDecimal longitude
        +String symptoms
        +String notes
    }
    class SosMatchResponse {
        +UUID bookingId
        +BookingStatus status
        +String message
        +UUID clinicId
        +String clinicName
        +String clinicPhone
        +Double distanceKm
        +String wsTopicUrl
    }
    class SosMatchingStatusMessage {
        +UUID bookingId
        +BookingStatus bookingStatus
        +MatchingEvent event
        +String message
        +Integer currentClinicIndex
        +Integer totalClinicsInRange
        +Long remainingSeconds
    }

    SosController --> SosMatchingService
    SosMatchingService --> BookingRepository
    SosMatchingService --> ClinicRepository
    SosMatchingService --> SosSessionManager
    SosMatchingService --> SosNotificationService
    SosMatchingScheduler --> SosMatchingService
    SosSessionManager --> RedisTemplate
    SosNotificationService --> SimpMessagingTemplate
```

**Class Specifications:**

**1. SosMatchingService**
-   **Responsibility:** Core SOS matching business logic
-   **Key Methods:**
    -   `startMatching()`: Initialize SOS request, find nearby clinics, notify first clinic
    -   `processConfirmation()`: Handle clinic accept/decline
    -   `escalateToNextClinic()`: Move to next clinic on timeout/decline
    -   `checkTimeouts()`: Scheduled job to detect timed-out requests
    -   `getActiveSosBooking()`: Check if user has active SOS
    -   `confirmSos()`: Update booking to CONFIRMED, assign staff
    -   `declineSos()`: Clear clinic field, escalate to next
    -   `handleNoClinicAvailable()`: Cancel booking when all clinics exhausted

**2. SosSessionManager**
-   **Responsibility:** Manage Redis session data for SOS matching
-   **Key Methods:**
    -   `acquireUserLock()/releaseUserLock()`: Distributed lock to prevent race conditions
    -   `createSession()`: Store clinic IDs, index, timestamp
    -   `clearSession()`: Clean up session data
    -   `updateNotifiedAt()`: Record when current clinic was notified (for accurate timeout)
    -   `hasCurrentClinicTimedOut()`: Check if 60 seconds elapsed
    -   `sessionExists()`: Validate session before operations

**Redis Keys Used:**
-   `sos:matching:{bookingId}:clinics` - List of clinic IDs
-   `sos:matching:{bookingId}:index` - Current clinic index
-   `sos:matching:{bookingId}:createdAt` - Session creation timestamp
-   `sos:matching:{bookingId}:notifiedAt` - When current clinic was notified
-   `sos:lock:user:{userId}` - User lock to prevent duplicate requests

**3. SosNotificationService**
-   **Responsibility:** WebSocket broadcasting for SOS status updates
-   **Key Methods:**
    -   `notifyOwnerClinicContacted()`: Broadcast to Pet Owner when clinic is contacted
    -   `notifyOwnerWaitingNext()`: Broadcast when escalating to next clinic
    -   `notifyOwnerConfirmed()`: Broadcast when clinic confirms
    -   `notifyOwnerNoClinic()`: Broadcast when no clinics available
    -   `alertClinic()`: Send alert to Clinic Manager

**WebSocket Topics:**
-   `/topic/sos-matching/{bookingId}` - Pet Owner subscribes for status updates
-   `/topic/clinic/{clinicId}/sos-alert` - Clinic Manager subscribes for SOS alerts

**Business Rules:**
-   **BR-59:** Search radius 10km from user location
-   **BR-60:** Max 5 clinics to try
-   **BR-61:** 60 seconds timeout per clinic
-   **BR-62:** No duplicate active SOS bookings per user
-   **BR-63:** Distributed lock prevents race conditions
-   **BR-64:** Status flow: SEARCHING → PENDING_CLINIC_CONFIRM → CONFIRMED → IN_PROGRESS → COMPLETED/CANCELLED
-   **BR-65:** Session TTL = 60s * 5 clinics + 60s buffer = 360s
-   **BR-66:** Unique booking code format: `SOS-{timestamp}-{random}`

#### 4.13.3 Request SOS & Auto-Match (UC-SOS-01, UC-SOS-09)

**Business Rules:** BR-59 (10km radius), BR-60 (max 5 clinics), BR-61 (60s timeout), BR-62 (no duplicate active SOS), BR-64 (status flow), BR-66 (unique booking code)

```mermaid
sequenceDiagram
    actor PO as Pet Owner
    participant UI1 as SosRequestScreen (Mobile)
    participant UI2 as SosRadarMapScreen (Mobile)
    participant SC as SosController
    participant MS as SosMatchingService
    participant BS as BookingService
    participant BR as BookingRepository
    participant CR as ClinicRepository
    participant DB as Database

    PO->>UI1: 1. Open SOS Request screen
    activate UI1
    UI1->>SC: 2. GET /api/sos/active (check active SOS booking)
    activate SC
    SC->>MS: 3. getActiveSosBookingForCurrentUser()
    activate MS
    MS->>BR: 4. findActiveSosByOwnerId(ownerId)
    activate BR
    BR->>DB: 5. Query active SOS bookings
    activate DB
    DB-->>BR: 6. Active booking (if any)
    deactivate DB
    BR-->>MS: 7. Optional~Booking~
    deactivate BR
    MS-->>SC: 8. Active SOS booking (if any)
    deactivate MS
    SC-->>UI1: 9. 200 OK (active booking or null)
    deactivate SC

    alt Active SOS booking exists
        UI1-->>PO: 10. Show dialog: continue tracking or cancel and create new
    end

    PO->>UI1: 11. Fill pet, symptoms, location and submit
    UI1->>SC: 12. POST /api/sos/start (SosMatchRequest)
    activate SC
    SC->>BS: 13. createSosBooking(request)
    activate BS
    BS->>BR: 14. save(new Booking(type=SOS, status=PENDING, ...))
    activate BR
    BR->>DB: 15. INSERT booking
    activate DB
    DB-->>BR: 16. Booking saved
    deactivate DB
    BR-->>BS: 17. Booking
    deactivate BR
    BS-->>SC: 18. Booking
    deactivate BS

    SC->>MS: 19. startSos(booking, request)
    activate MS
    MS->>CR: 20. searchNearbyClinics(lat, lng, 10km)
    activate CR
    CR->>DB: 21. Query clinics within radius
    activate DB
    DB-->>CR: 22. List~Clinic~ (sorted by distance)
    deactivate DB
    CR-->>MS: 23. Clinics (max 5)
    deactivate CR

    alt No clinics found
        MS->>BR: 24. update booking status: NO_CLINIC
        activate BR
        BR->>DB: 25. UPDATE bookings SET status='NO_CLINIC'
        activate DB
        DB-->>BR: 26. Success
        deactivate DB
        BR-->>MS: 27. Booking updated
        deactivate BR
        MS-->>SC: 28. SosMatchResponse (status=NO_CLINIC)
        SC-->>UI1: 29. 201 Created (NO_CLINIC)
        UI1-->>PO: 30. Show "No clinic available" message
    else Clinics found
        MS->>DB: 24c. Store SOS session (clinics, index=0, createdAt)
        MS-->>UI2: 25c. Push initial matching status over WebSocket
        MS-->>SC: 26c. SosMatchResponse (bookingId, status=SEARCHING)
        SC-->>UI1: 27c. 201 Created (SEARCHING)
        deactivate MS
        deactivate SC

        UI1->>UI2: 28c. Navigate to SosRadarMapScreen(bookingId)
        UI2->>UI2: 29c. Start radar animation & countdown
        note over UI2: UI2 subscribes to SOS matching WebSocket topic<br/>and optionally polls /api/sos/{bookingId}/status
    end
```

#### 4.13.4 SOS Emergency Booking – Matching & Real-Time Tracking (UC-SOS-01, UC-SOS-02, UC-PO-15)

This subsection describes the end-to-end SOS booking experience from the Pet Owner’s perspective, combining matching and real-time tracking flows.

```mermaid
sequenceDiagram
    actor PO as Pet Owner
    participant UI1 as SosRequestScreen (Mobile)
    participant UI2 as SosRadarMapScreen (Mobile)
    participant UI3 as SosTrackingScreen (Mobile)
    participant SC as SosController
    participant TC as TrackingController
    participant BS as BookingService
    participant SMS as SosMatchingService
    participant TS as TrackingService
    participant BR as BookingRepository
    participant CR as ClinicRepository
    participant DB as Database

    PO->>UI1: 1. Open SOS Request screen
    UI1->>SC: 2. GET /api/sos/active
    SC->>SMS: 3. getActiveSosBookingForCurrentUser()
    SMS->>BR: 4. findActiveSosByOwnerId(ownerId)
    BR->>DB: 5. SELECT active SOS bookings
    DB-->>BR: 6. Result
    BR-->>SMS: 7. Optional~Booking~
    SMS-->>SC: 8. Active SOS booking (if any)
    SC-->>UI1: 9. 200 OK (BookingResponse or null)

    alt Active SOS booking exists
        UI1-->>PO: 10. Show dialog (continue tracking / cancel & create new)
    end

    PO->>UI1: 11. Submit SOS form (pet, symptoms, location)
    UI1->>SC: 12. POST /api/sos/start (SosMatchRequest)
    SC->>BS: 13. createSosBooking(request)
    BS->>BR: 14. save(Booking type=SOS)
    BR->>DB: 15. INSERT booking
    DB-->>BR: 16. Saved booking
    BR-->>BS: 17. Booking
    BS-->>SC: 18. Booking
    SC->>SMS: 19. startSos(booking, request)

    SMS->>CR: 20. searchNearbyClinics(lat, lng, radius)
    CR->>DB: 21. SELECT clinics
    DB-->>CR: 22. List clinics
    CR-->>SMS: 23. Clinics (max 5)

    alt No clinic available
        SMS->>BR: 24. update status NO_CLINIC
        BR->>DB: 25. UPDATE bookings
        DB-->>BR: 26. OK
        BR-->>SMS: 27. Booking updated
        SMS-->>SC: 28. SosMatchResponse(status=NO_CLINIC)
        SC-->>UI1: 29. 201 Created (NO_CLINIC)
        UI1-->>PO: 30. Show "No clinic available" and stop flow
    else Clinic found and accepts
        SMS->>SMS: 24c. Initialize SosSession (searching=true)
        SMS-->>UI2: 25c. WebSocket /topic/sos.{bookingId}.status (SEARCHING)
        SMS-->>SC: 26c. SosMatchResponse(status=SEARCHING)
        SC-->>UI1: 27c. 201 Created (SEARCHING)
        UI1->>UI2: 28c. Navigate to SosRadarMapScreen(bookingId)
        UI2->>UI2: 29c. Show radar and countdown

        SMS->>SMS: 30c. Mark CONFIRMED with matched clinic
        SMS-->>UI2: 31c. WebSocket status (CONFIRMED, clinic)
        UI2-->>PO: 32c. Show confirmed clinic info
        UI2->>UI3: 33c. After short delay, navigate to SosTrackingScreen(bookingId)
    end

    UI3->>UI3: 34. Subscribe /topic/booking.{bookingId}.location
    UI3->>TC: 35. GET /tracking/booking/{bookingId} (initial location)
    TC->>TS: 36. getLatestLocation(bookingId)
    TS->>BR: 37. findById(bookingId)
    BR->>DB: 38. SELECT booking
    DB-->>BR: 39. Booking
    BR-->>TS: 40. Booking
    TS-->>TC: 41. LocationUpdateResponse (initial snapshot)
    TC-->>UI3: 42. 200 OK
    UI3-->>PO: 43. Render map with home + staff marker (if available)

    loop Real-time tracking
        TS-->>UI3: 44. WebSocket /topic/booking.{bookingId}.location (LocationUpdateResponse)
        UI3->>UI3: 45. Snap marker to route polyline, animate, update ETA/distance
        UI3-->>PO: 46. Update tracking UI and status text
    end

    alt Staff arrives (arrived=true)
        TS-->>UI3: 47. LocationUpdateResponse(arrived=true)
        UI3-->>PO: 48. Show "Vet has arrived" message
        UI3->>UI3: 49. After delay, navigate back to Home
    end
```

#### 4.13.2 Accept/Decline SOS Request (UC-SOS-10)

```mermaid
sequenceDiagram
    actor CM as Clinic Manager
    participant UI as Web Manager
    participant SC as SOSController
    participant MS as SosMatchingService
    participant BR as BookingRepository
    participant DB as Database
    participant WS as WebSocket

    CM->>UI: 1. Nhận thông báo & Click "Chấp nhận"
    activate UI
    UI->>SC: 2. POST /api/sos/{id}/confirm (accept=true)
    activate SC
    SC->>MS: 3. processConfirmation(id, true)
    activate MS
    MS->>BR: 4. findById(id)
    activate BR
    BR->>DB: 5. Truy vấn thông tin booking
    activate DB
    DB-->>BR: 6. Thông tin Booking
    deactivate DB
    BR-->>MS: 7. Booking Entity
    deactivate BR
    MS->>BR: 8. Cập nhật thông tin nhận ca
    activate BR
    BR->>DB: 9. Cập nhật status: CONFIRMED & gán clinic_id
    activate DB
    DB-->>BR: 10. Xác nhận cập nhật
    deactivate DB
    BR-->>MS: 11. Hoàn tất
    deactivate BR
    MS->>WS: 12. Push trạng thái CONFIRMED cho Pet Owner
    MS-->>SC: 13. OK
    deactivate MS
    SC-->>UI: 14. 200 OK
    deactivate SC
    UI-->>CM: 15. Chuyển hướng đến trang Chi tiết ca cấp cứu
    deactivate UI
```

#### 4.13.5 SOS Escalation & Timeout (UC-SOS-11, UC-SOS-12)

```mermaid
sequenceDiagram
    participant Job as Scheduled Task (Hệ thống)
    participant MS as SosMatchingService
    participant BR as BookingRepository
    participant DB as Database
    participant WS as WebSocket

    loop Kiểm tra mỗi 5 giây
        Job->>MS: 1. Hoàn thành kiểm tra timeout cấp cứu
        activate MS
        MS->>BR: 2. Tìm các booking PENDING_CLINIC_CONFIRM quá 60s
        activate BR
        BR->>DB: 3. Truy vấn các booking hết hạn phản hồi
        activate DB
        DB-->>BR: 4. Danh sách các booking hết hạn
        deactivate DB
        BR-->>MS: 5. Danh sách cần xử lý
        deactivate BR
        
        loop Với mỗi booking hết hạn
            MS->>DB: 6. Lấy dữ liệu phiên tìm kiếm hiện tại
            alt Vẫn còn phòng khám tiếp theo (index < 5)
                MS->>MS: 7. Chọn phòng khám kế tiếp trong danh sách
                MS->>DB: 8. Cập nhật lại index trong phiên tìm kiếm
                MS->>WS: 9. Thông báo cho phòng khám tiếp theo
                MS->>WS: 10. Push cập nhật "Đang tìm phòng khám tiếp theo" cho chủ pet
            else Không còn phòng khám nào trong bán kính
                MS->>BR: 11. Cập nhật trạng thái hủy ca do không có clinic
                activate BR
                BR->>DB: 12. Cập nhật status: CANCELLED
                activate DB
                DB-->>BR: 13. Xác nhận cập nhật
                deactivate DB
                BR-->>MS: 14. Hoàn tất
                deactivate BR
                MS->>WS: 15. Push trạng thái NO_CLINIC & cung cấp số hotline cho chủ pet
            end
        end
        MS-->>Job: 16. Hoàn tất chu kỳ kiểm tra
        deactivate MS
    end
```

#### 4.13.6 Track Staff Location (UC-SOS-02)

```mermaid
sequenceDiagram
    actor PO as Pet Owner
    participant UI as Mobile App
    participant SC as SOSController
    participant SS as SOSService
    participant DB as Database
    participant LS as LocationService

    loop Cập nhật mỗi 5 giây (Màn hình Tracking)
        UI->>SC: 1. GET /api/sos/{id}/track
        activate SC
        SC->>SS: 2. getTrackingInfo(id)
        activate SS
        SS->>DB: 3. Lấy vị trí hiện tại của nhân viên
        activate DB
        DB-->>SS: 4. Tọa độ (Lat, Lng)
        deactivate DB
        SS->>LS: 5. calculateETA(vị trí nhân viên, vị trí chủ pet)
        activate LS
        LS-->>SS: 6. Thông tin ETA (Thời gian & Khoảng cách)
        deactivate LS
        SS-->>SC: 7. Trả về TrackingResponse
        deactivate SS
        SC-->>UI: 8. 200 OK
        deactivate SC
        UI-->>PO: 9. Cập nhật vị trí trên bản đồ & Hiển thị ETA mới
    end
```

#### 4.13.7 Staff Move & Start Service (UC-SOS-06, UC-SOS-07)
**Transitions:** `CONFIRMED → IN_PROGRESS` (khi Staff bấm "Bắt đầu di chuyển")

```mermaid
sequenceDiagram
    actor V as Staff (Nhân viên)
    participant UI as Staff Mobile App
    participant BC as BookingController
    participant BS as BookingService
    participant BR as BookingRepository
    participant DB as Database
    participant WS as WebSocket

    V->>UI: 1. Click "Bắt đầu di chuyển"
    activate UI
    UI->>BC: 2. POST /api/bookings/{id}/start-moving
    activate BC
    BC->>BS: 3. startMoving(id)
    activate BS
    BS->>BR: 4. findById(id)
    BR-->>BS: 5. Booking Entity
    BS->>BR: 6. Update status to IN_PROGRESS
    activate BR
    BR->>DB: 7. Update status: IN_PROGRESS
    activate DB
    DB-->>BR: 8. Confirmed
    deactivate DB
    BR-->>BS: 9. Done
    deactivate BR
    Note over BS,WS: Gửi thông báo cho Pet Owner: "BS đang trên đường đến"
    BS->>WS: 10. Notify Pet Owner (Status: IN_PROGRESS)
    BS-->>BC: 11. Success
    deactivate BS
    BC-->>UI: 12. 200 OK
    deactivate BC
    UI-->>V: 13. Mở bản đồ dẫn đường & Start GPS Broadcast
    deactivate UI
```

#### 4.13.8 SOS Service Completion & Checkout (UC-SOS-08)
**Transitions:** `IN_PROGRESS → COMPLETED` (khi Staff bấm "Checkout")

```mermaid
sequenceDiagram
    actor V as Staff (Nhân viên)
    participant UI as Staff Mobile App
    participant BC as BookingController
    participant BS as BookingService
    participant DB as Database

    V->>UI: 1. Click "Checkout" (Sau khi sơ cứu xong)
    activate UI
    UI->>BC: 2. POST /api/bookings/{id}/checkout (CheckoutRequest)
    activate BC
    BC->>BS: 3. processCheckout(id, request)
    activate BS
    Note over BS: Tính toán phí SOS và dịch vụ đi kèm
    BS->>DB: 4. Lưu Hóa đơn (EMR) & Update status: COMPLETED
    BS-->>BC: 5. Success
    deactivate BS
    BC-->>UI: 6. 200 OK
    deactivate BC
    UI-->>V: 13. Hiển thị thông báo hoàn tất ca cấp cứu
    deactivate UI
```

---

### 4.14 Clinic Discovery Management

#### 4.14.1 Class Diagram - Clinic Discovery
*(Logic maps to Clinic Service `findNearbyClinics`)*

#### 4.14.2 Search Nearby Clinics (UC-PO-05)

```mermaid
sequenceDiagram
    actor User as Pet Owner
    participant UI as Clinic Search Screen (Mobile)
    participant CC as ClinicController
    participant CS as ClinicService
    participant CR as ClinicRepository

    User->>UI: 1. Allow location access
    activate UI
    UI->>UI: 2. Get current coordinates (lat, lng)
    UI->>CC: 3. findNearbyClinics(lat, lng, radius)
    activate CC
    CC->>CS: 4. findNearbyClinics(lat, lng, radius)
    activate CS
    CS->>CR: 5. findNearby(lat, lng, radius)
    activate CR
    CR-->>CS: 6. List of Clinics (Spatial Query)
    deactivate CR
    CS-->>CC: 7. List~ClinicResponse~
    deactivate CS
    CC-->>UI: 8. List<ClinicResponse>
    deactivate CC
    UI-->>User: 9. Display clinics on map & list
    deactivate UI
```

---

### 4.15 Notification Management

Firebase Cloud Messaging (FCM) enables real-time push notifications to mobile devices. This module handles FCM token management and notification delivery across Android and iOS platforms.

**Key Features:**
-   Token registration on app startup
-   Token removal on logout
-   Single-user push notifications
-   Batch notifications to multiple users
-   Automatic token cleanup for invalid/expired tokens
-   Platform-specific configuration (Android channel, iOS sound)

#### 4.15.1 Class Diagram - FCM Push Notifications

```mermaid
classDiagram
    class FcmController {
        -FcmService fcmService
        -JwtTokenProvider jwtTokenProvider
        +registerToken(String, FcmTokenRequest) ResponseEntity~Map~
        +removeToken(String) ResponseEntity~Map~
    }
    class FcmService {
        -FirebaseMessaging firebaseMessaging
        -UserRepository userRepository
        +registerToken(UUID, String) void
        +removeToken(UUID) void
        +sendToUser(User, String, String, Map) boolean
        +sendToUsers(List~User~, String, String, Map) int
        +sendToUser(UUID, String, String, Map) boolean
        -handleFcmError(User, FirebaseMessagingException) void
    }
    class FcmTokenRequest {
        +String fcmToken
    }
    class UserRepository {
        <<interface>>
        +findById(UUID) Optional~User~
        +save(User) User
    }
    class FirebaseMessaging {
        <<external>>
        +send(Message) String
        +sendEachForMulticast(MulticastMessage) BatchResponse
    }

    FcmController --> FcmService
    FcmService --> UserRepository
    FcmService --> FirebaseMessaging
```

#### 4.15.2 Class Specifications

**1. FcmController**
-   **Responsibility:** Handle FCM token registration/removal endpoints
-   **Key Methods:**
    -   `registerToken()`: Register FCM token for authenticated user
    -   `removeToken()`: Remove FCM token on logout

**2. FcmService**
-   **Responsibility:** Manage FCM token lifecycle and send push notifications
-   **Key Methods:**
    -   `registerToken()`: Store FCM token in user entity
    -   `removeToken()`: Clear FCM token from user entity
    -   `sendToUser()`: Send notification to a single user
    -   `sendToUsers()`: Send batch notifications
    -   `handleFcmError()`: Handle FCM errors and invalid tokens

**Business Rules:**
-   **BR-FCM-01:** FCM token must be non-empty
-   **BR-FCM-02:** Invalid/expired tokens are automatically removed
-   **BR-FCM-03:** Android notifications use `petties_notifications` channel
-   **BR-FCM-04:** Batch notifications report success count

#### 4.15.3 Sequence Diagram: Register FCM Token

```mermaid
sequenceDiagram
    actor U as User (Mobile)
    participant MA as Mobile App
    participant FC as FcmController
    participant FS as FcmService
    participant UR as UserRepository
    participant DB as Database

    U->>MA: 1. Open app & login
    activate MA
    MA->>MA: 2. Request FCM token from Firebase SDK
    MA->>FC: 3. POST /api/fcm/token (JWT, fcmToken)
    activate FC
    FC->>FC: 4. Extract userId from JWT
    FC->>FS: 5. registerToken(userId, fcmToken)
    activate FS

    alt Empty FCM token
        FS-->>FC: 6a. Log warning, return
        FC-->>MA: 7a. 200 OK (silently ignore)
    else Valid FCM token
        FS->>UR: 6b. findById(userId)
        activate UR
        UR->>DB: 7b. SELECT * FROM users WHERE user_id = ?
        activate DB
        DB-->>UR: 8b. User entity
        deactivate DB
        UR-->>FS: 9b. Optional~User~
        deactivate UR

        FS->>FS: 10b. user.setFcmToken(fcmToken)
        FS->>UR: 11b. save(user)
        activate UR
        UR->>DB: 12b. UPDATE users SET fcm_token = ? WHERE user_id = ?
        activate DB
        DB-->>UR: 13b. Updated
        deactivate DB
        UR-->>FS: 14b. User
        deactivate UR

        FS-->>FC: 15b. void (success)
        deactivate FS
        FC-->>MA: 16b. 200 OK {"message": "FCM token registered"}
        deactivate FC
        MA-->>U: 17b. Ready to receive push notifications
        deactivate MA
    end
```

#### 4.15.4 Sequence Diagram: Send Push Notification

```mermaid
sequenceDiagram
    participant BS as BookingService
    participant FS as FcmService
    participant UR as UserRepository
    participant DB as Database
    participant FCM as Firebase Cloud Messaging
    participant Device as User Device

    Note over BS: Booking confirmed event
    BS->>FS: 1. sendToUser(userId, title, body, data)
    activate FS
    FS->>UR: 2. findById(userId)
    activate UR
    UR->>DB: 3. SELECT * FROM users WHERE user_id = ?
    activate DB
    DB-->>UR: 4. User entity
    deactivate DB
    UR-->>FS: 5. Optional~User~
    deactivate UR

    alt User has no FCM token
        FS-->>BS: 6a. return false (skip)
    else User has FCM token
        FS->>FS: 6b. Build FCM Message (title, body, data, Android/iOS config)
        FS->>FCM: 7b. send(message)
        activate FCM

        alt Token valid
            FCM->>Device: 8b. Push notification
            activate Device
            Device-->>U: 9b. Show notification
            deactivate Device
            FCM-->>FS: 10b. Response (messageId)
            deactivate FCM
            FS-->>BS: 11b. return true (success)
        else Token invalid/expired
            FCM-->>FS: 8c. FirebaseMessagingException (UNREGISTERED)
            deactivate FCM
            FS->>FS: 9c. handleFcmError() - Clear token
            FS->>UR: 10c. save(user with fcmToken=null)
            UR->>DB: 11c. UPDATE users SET fcm_token = NULL
            FS-->>BS: 12c. return false
        end
    end
    deactivate FS
```

#### 4.15.5 Cross-Reference to SRS

| Requirement | Description | Implementation |
|------------|-------------|----------------|
| FR-NOTIF-01 | Push notifications for booking updates | `FcmService.sendToUser()` after booking status changes |
| FR-NOTIF-02 | Push notifications for SOS alerts | `SosNotificationService` calls `FcmService.sendToUser()` |
| FR-NOTIF-03 | Token registration on app startup | `FcmController.registerToken()` |
| FR-NOTIF-04 | Token cleanup on logout | `FcmController.removeToken()` |
| NFR-NOTIF-01 | Support Android and iOS | `AndroidConfig` and `ApnsConfig` in message |

---


Server-Sent Events (SSE) provide unidirectional real-time updates from server to client. Unlike WebSocket (bidirectional), SSE is ideal for push notifications, live status updates, and event streaming.

**Key Features:**
-   Long-lived HTTP connections (30 minutes timeout)
-   Multi-tab/device support per user
-   Automatic heartbeat (30 seconds)
-   Connection lifecycle management
-   Event types: CONNECTED, HEARTBEAT, NOTIFICATION, SHIFT_UPDATE

**Advantages over WebSocket:**
-   Simpler protocol (HTTP-based)
-   Auto-reconnect in browsers
-   Better for one-way push notifications
-   No need for bidirectional communication

#### 4.15.6 Class Diagram - SSE Real-time

```mermaid
classDiagram
    class SseController {
        -SseEmitterService sseEmitterService
        -AuthService authService
        -JwtTokenProvider jwtTokenProvider
        +subscribe(String) SseEmitter
        +getStats() Map~String,Object~
    }
    class SseEmitterService {
        -Map~UUID,List~SseEmitter~~ emitters
        +subscribe(UUID) SseEmitter
        +pushToUser(UUID, SseEventDto) void
        +pushToUsers(List~UUID~, SseEventDto) void
        +sendHeartbeats() void
        +disconnectUser(UUID) void
        +getConnectionCount(UUID) int
        +getTotalConnectionCount() int
        +isUserConnected(UUID) boolean
        -removeEmitter(UUID, SseEmitter) void
        -sendHeartbeat(UUID, SseEmitter) void
    }
    class SseEventDto {
        +String type
        +Object data
        +LocalDateTime timestamp
        +heartbeat() SseEventDto
    }
    class SseEmitter {
        <<Spring>>
        +send(SseEventBuilder) void
        +complete() void
        +onCompletion(Runnable) void
        +onTimeout(Runnable) void
        +onError(Consumer) void
    }

    SseController --> SseEmitterService
    SseEmitterService --> SseEmitter
```

#### 4.15.7 Class Specifications

**1. SseController**
-   **Responsibility:** Handle SSE subscription endpoint
-   **Key Methods:**
    -   `subscribe()`: Create SSE connection for authenticated user
    -   `getStats()`: Return connection statistics (Admin only)

**2. SseEmitterService**
-   **Responsibility:** Manage SSE connections and push events
-   **Key Methods:**
    -   `subscribe()`: Create SseEmitter and register callbacks
    -   `pushToUser()`: Push event to all user connections
    -   `pushToUsers()`: Batch push to multiple users
    -   `sendHeartbeats()`: Scheduled task to keep connections alive
    -   `disconnectUser()`: Close all user connections (on logout)

**3. SseEventDto**
-   **Responsibility:** Standard event format for SSE messages
-   **Fields:**
    -   `type`: Event type (CONNECTED, HEARTBEAT, NOTIFICATION, SHIFT_UPDATE)
    -   `data`: Event payload (varies by type)
    -   `timestamp`: Event timestamp

**Business Rules:**
-   **BR-SSE-01:** Connection timeout 30 minutes
-   **BR-SSE-02:** Heartbeat every 30 seconds
-   **BR-SSE-03:** Users can have multiple connections (multi-tab)
-   **BR-SSE-04:** Auto-cleanup on timeout/error/completion
-   **BR-SSE-05:** Initial CONNECTED event sent on subscription

#### 4.15.8 Sequence Diagram: SSE Subscription

```mermaid
sequenceDiagram
    actor U as User
    participant UI as Web Dashboard
    participant SC as SseController
    participant AS as AuthService
    participant JTP as JwtTokenProvider
    participant SS as SseEmitterService

    U->>UI: 1. Open dashboard page
    activate UI
    UI->>UI: 2. Create EventSource connection
    UI->>SC: 3. GET /api/sse/subscribe?token=JWT
    activate SC

    SC->>JTP: 4. validateToken(token)
    activate JTP
    JTP-->>SC: 5. true
    deactivate JTP

    SC->>JTP: 6. getUserIdFromToken(token)
    activate JTP
    JTP-->>SC: 7. userId
    deactivate JTP

    SC->>SS: 8. subscribe(userId)
    activate SS
    SS->>SS: 9. Create SseEmitter (timeout=30min)
    SS->>SS: 10. Add to emitters map
    SS->>SS: 11. Register onCompletion/onTimeout/onError callbacks
    SS->>UI: 12. Send CONNECTED event
    SS-->>SC: 13. SseEmitter
    deactivate SS
    SC-->>UI: 14. SSE stream started (200 OK)
    deactivate SC
    UI-->>U: 15. Connected (ready to receive events)
    deactivate UI

    Note over SS: Every 30 seconds
    SS->>UI: 16. HEARTBEAT event
    Note over UI: Connection stays alive
```

#### 4.15.9 Sequence Diagram: Push Notification via SSE

```mermaid
sequenceDiagram
    participant BS as BookingService
    participant SS as SseEmitterService
    participant E1 as SseEmitter (Tab 1)
    participant E2 as SseEmitter (Tab 2)
    participant U1 as User Browser Tab 1
    participant U2 as User Browser Tab 2

    Note over BS: Booking status changed to CONFIRMED
    BS->>BS: 1. Prepare event data
    BS->>SS: 2. pushToUser(userId, SseEventDto{type:"NOTIFICATION", data:{...}})
    activate SS

    SS->>SS: 3. Get all emitters for userId
    alt User has 2 active connections
        SS->>E1: 4a. send(event: "NOTIFICATION", data: {...})
        activate E1
        E1->>U1: 5a. Dispatch event
        activate U1
        U1->>U1: 6a. Show notification badge
        deactivate U1
        deactivate E1

        SS->>E2: 4b. send(event: "NOTIFICATION", data: {...})
        activate E2
        E2->>U2: 5b. Dispatch event
        activate U2
        U2->>U2: 6b. Show notification badge
        deactivate U2
        deactivate E2
    else Connection error on Tab 2
        SS->>E2: 7. send(event) throws IOException
        SS->>SS: 8. removeEmitter(userId, E2)
        SS->>SS: 9. E2.complete()
    end
    deactivate SS
```

#### 4.15.10 Sequence Diagram: Connection Timeout

```mermaid
sequenceDiagram
    participant UI as Web Dashboard
    participant E as SseEmitter
    participant SS as SseEmitterService

    Note over E: 30 minutes elapsed
    E->>E: 1. Timeout triggered
    E->>SS: 2. onTimeout() callback
    activate SS
    SS->>SS: 3. removeEmitter(userId, emitter)
    SS->>SS: 4. Clean up empty list
    deactivate SS
    E->>UI: 5. EventSource error event
    activate UI
    UI->>UI: 6. Auto-reconnect (browser behavior)
    UI->>SC: 7. GET /api/sse/subscribe?token=JWT
    Note over UI: New connection created
    deactivate UI
```

#### 4.15.11 Cross-Reference to SRS

| Requirement | Description | Implementation |
|------------|-------------|----------------|
| FR-SSE-01 | Real-time notifications | `SseEmitterService.pushToUser()` |
| FR-SSE-02 | Multi-tab support | `Map<UUID, List<SseEmitter>>` |
| FR-SSE-03 | Connection heartbeat | `@Scheduled` task `sendHeartbeats()` |
| FR-SSE-04 | Auto-reconnect on timeout | Browser EventSource auto-reconnect |
| FR-SSE-05 | Shift update notifications | `pushToUser()` with `SHIFT_UPDATE` event |
| NFR-SSE-01 | Connection timeout 30 minutes | `SSE_TIMEOUT` constant |
| NFR-SSE-02 | Graceful disconnect | `onCompletion/onTimeout/onError` callbacks |

---

### 4.16 Payment Management

Module quản lý thanh toán cho các booking. Hỗ trợ thanh toán QR (SePay), kiểm tra trạng thái, xem lịch sử giao dịch, và quản lý ví phòng khám.

#### 4.16.1 Class Diagram - Payment Management

```mermaid
classDiagram
    class PaymentController {
        -QrPaymentService qrPaymentService
        -PaymentHistoryService paymentHistoryService
        -TransactionService transactionService
        -AuthService authService
        +checkPaymentStatus(UUID) ResponseEntity
        +getPaymentMethod(UUID) ResponseEntity
        +getBookingTotal(UUID) ResponseEntity
        +getPaymentDescription(UUID) ResponseEntity
        +getMyPayments(Integer, String) ResponseEntity
        +getMyClinicPayments(Integer, String) ResponseEntity
        +getClinicPayments(UUID, Integer, String) ResponseEntity
        +listSePayTransactions(Integer, String, String, String, String) ResponseEntity
    }

    class QrPaymentService {
        -PaymentRepository paymentRepository
        -SePayClient sePayClient
        +checkQrStatus(UUID) QrStatusResult
    }

    class PaymentHistoryService {
        -PaymentRepository paymentRepository
        -BookingRepository bookingRepository
        +getPaymentHistoryByPetOwnerId(UUID, Integer, String) List~Map~
        +getPaymentHistoryByClinicId(UUID, Integer, String) List~Map~
    }

    class TransactionService {
        -BookingRepository bookingRepository
        -PaymentRepository paymentRepository
        +generatePaymentDescription(UUID) String
        +getBookingTotalPrice(UUID) BigDecimal
        +isQrPayment(UUID) boolean
        +getAllBookings() List~Booking~
    }

    class PaymentRepository {
        <<interface>>
        +findByBookingId(UUID) Optional~Payment~
        +findByStatus(PaymentStatus) List~Payment~
    }

    class Payment {
        +UUID paymentId
        +UUID bookingId
        +BigDecimal amount
        +PaymentMethod method
        +PaymentStatus status
        +String stripePaymentId
        +LocalDateTime paidAt
    }

    class PaymentStatus {
        <<enumeration>>
        PENDING
        PAID
        REFUNDED
        FAILED
    }

    class PaymentMethod {
        <<enumeration>>
        CASH
        QR
        CARD
    }

    PaymentController --> QrPaymentService
    PaymentController --> PaymentHistoryService
    PaymentController --> TransactionService
    QrPaymentService --> PaymentRepository
    PaymentHistoryService --> PaymentRepository
    TransactionService --> PaymentRepository
    PaymentRepository ..> Payment
    Payment --> PaymentStatus
    Payment --> PaymentMethod
```

#### 4.16.2 Create QR Payment

> **Sequence Diagram:** TODO - Tạo mã QR thanh toán cho booking.

#### 4.16.3 View Invoice

> **Sequence Diagram:** TODO - Xem hóa đơn chi tiết của booking.

#### 4.16.4 View Payment Transactions History

> **Sequence Diagram:** TODO - Xem lịch sử giao dịch thanh toán.

#### 4.16.5 Process Withdraw

> **Sequence Diagram:** TODO - Xử lý yêu cầu rút tiền từ ví phòng khám.

#### 4.16.6 View List Withdraw Request

> **Sequence Diagram:** TODO - Xem danh sách yêu cầu rút tiền.

#### 4.16.7 View Wallet's Clinic

> **Sequence Diagram:** TODO - Xem thông tin ví của phòng khám.


---

### 4.17 System Management

Module quản lý hệ thống dành cho Admin. Cung cấp thống kê tổng quan nền tảng (số lượng users, clinics, bookings, revenue).

#### 4.17.1 Class Diagram - System Management

> **TODO:** Class diagram sẽ được bổ sung khi implement AdminDashboardController.

#### 4.17.2 View Platform Statistics

> **Sequence Diagram:** TODO - Admin xem thống kê tổng quan nền tảng (users, clinics, bookings, revenue).


---

### 4.18 Report Management

#### 4.18.1 Class Diagram - Reporting

```mermaid
classDiagram
    class ReportController {
        -ReportService reportService
        +submitReport(ReportRequest) ResponseEntity
        +getMyReports(UUID, Pageable) ResponseEntity
        +getPendingReports(Pageable) ResponseEntity
        +processReport(UUID, ProcessRequest) ResponseEntity
    }

    class ReportService {
        -ReportRepository reportRepository
        -UserRepository userRepository
        -NotificationService notificationService
        +createReport(ReportRequest) ReportResponse
        +getUserReports(UUID, Pageable) Page~ReportResponse~
        +getPendingReports(Pageable) Page~ReportResponse~
        +processReport(UUID, ProcessRequest) void
    }

    class Report {
        +UUID reportId
        +User reporter
        +User reportedUser
        +Clinic reportedClinic
        +Booking relatedBooking
        +ReportCategory category
        +String description
        +List~String~ evidenceUrls
        +ReportStatus status
        +String adminNotes
        +LocalDateTime createdAt
        +LocalDateTime processedAt
    }

    class ReportRepository {
        <<interface>>
        +findById(UUID) Optional~Report~
        +findByReporter(User, Pageable) Page~Report~
        +findByStatus(ReportStatus, Pageable) Page~Report~
        +save(Report) Report
    }

    ReportController --> ReportService
    ReportService --> ReportRepository
    ReportService --> NotificationService
    ReportRepository ..> Report
```

#### 4.18.2 Submit Platform Violation Report (UC-PO-16)

```mermaid
sequenceDiagram
    actor U as User (Pet Owner/Manager)
    participant UI as Report Form
    participant RC as ReportController
    participant RS as ReportService
    participant CS as CloudinaryService
    participant RR as ReportRepository
    participant NS as NotificationService
    participant DB as Database

    U->>UI: 1. Click "Report Issue" on Booking Detail
    activate UI
    U->>UI: 2. Select category (Abuse, Hygiene, No-show...)
    U->>UI: 3. Enter description & upload evidence photos
    UI->>CS: 4. Upload photos
    activate CS
    CS-->>UI: 5. Evidence URLs
    deactivate CS
    UI->>RC: 6. POST /reports (ReportRequest)
    activate RC
    RC->>RS: 7. createReport(request)
    activate RS
    RS->>RS: 8. Validate & enrich with user context
    RS->>RR: 9. save(Report)
    activate RR
    RR->>DB: 10. INSERT report
    activate DB
    DB-->>RR: 11. Saved
    deactivate DB
    RR-->>RS: 12. Report Entity
    deactivate RR
    RS->>NS: 13. notifyAdmins(NEW_REPORT_ALERT)
    activate NS
    NS-->>RS: 14. Sent
    deactivate NS
    RS-->>RC: 15. ReportResponse
    deactivate RS
    RC-->>UI: 16. 201 Created
    deactivate RC
    UI-->>U: 17. Show success message
    deactivate UI
```

#### 4.18.3 Admin Process Report

```mermaid
sequenceDiagram
    actor A as Admin
    participant UI as Admin Dashboard
    participant RC as ReportController
    participant RS as ReportService
    participant RR as ReportRepository
    participant UR as UserRepository
    participant NS as NotificationService
    participant DB as Database

    A->>UI: 1. Navigate to Pending Reports
    activate UI
    UI->>RC: 2. GET /admin/reports?status=PENDING
    activate RC
    RC->>RS: 3. getPendingReports(pageable)
    activate RS
    RS->>RR: 4. findByStatus(PENDING, pageable)
    activate RR
    RR-->>RS: 5. Page<Report>
    deactivate RR
    RS-->>RC: 6. Page<ReportResponse>
    deactivate RS
    RC-->>UI: 7. 200 OK (list)
    deactivate RC
    UI-->>A: 8. Display reports table
    
    A->>UI: 9. Click report -> Review details
    A->>UI: 10. Enter admin notes & select action
    UI->>RC: 11. PATCH /admin/reports/{id}/process
    activate RC
    RC->>RS: 12. processReport(id, ProcessRequest)
    activate RS
    RS->>RR: 13. findById(id)
    activate RR
    RR-->>RS: 14. Report
    deactivate RR
    
    alt Action: WARN_USER
        RS->>UR: 15a. Update user warning count
        RS->>NS: 16a. Notify reported user (WARNING)
    else Action: BAN_USER
        RS->>UR: 15b. Update user status = BANNED
        RS->>NS: 16b. Notify user (ACCOUNT_BANNED)
    else Action: SUSPEND_CLINIC
        RS->>DB: 15c. Update clinic status = SUSPENDED
        RS->>NS: 16c. Notify clinic owner
    else Action: DISMISS
        Note over RS: No action on reported entity
    end
    
    RS->>RR: 17. save(updatedReport with status=PROCESSED)
    RS->>NS: 18. Notify reporter (REPORT_PROCESSED)
    RS-->>RC: 19. OK
    deactivate RS
    RC-->>UI: 20. 200 OK
    deactivate RC
    UI-->>A: 21. Refresh list
    deactivate UI
 ```

---

### 4.19 AI Assistant

#### 4.19.1 Class Diagram - AI Service

```mermaid
classDiagram
    class AgentController {
        -AgentService agentService
        +chat(ChatRequest) StreamingResponse
        +clearHistory(UUID) void
    }

    class AgentService {
        -LangGraphEngine engine
        -ToolRegistry toolRegistry
        -RAGEngine ragEngine
        +processQuery(userId, query) Stream
    }

    class LangGraphEngine {
        -StateStore stateStore
        +runReActLoop(prompt) Node
    }

    class ToolRegistry {
        -FastMCPProtocol mcp
        +callTool(toolName, args) ToolOutput
    }

    class RAGEngine {
        -QdrantClient vectorDb
        -CohereEmbedding embedding
        +retrieveContext(query) List~Node~
    }

    AgentController --> AgentService
    AgentService --> LangGraphEngine
    AgentService --> ToolRegistry
    AgentService --> RAGEngine
```

#### 4.19.2 Sequence Diagram: AI ReAct Loop

```mermaid
sequenceDiagram
    actor PO as Pet Owner
    participant UI as Chat UI (Mobile)
    participant AC as AgentController
    participant AS as AgentService
    participant LG as LangGraphEngine
    participant TR as ToolRegistry
    participant RE as RAGEngine

    PO->>UI: 1. Send "Book Staff for Bella tomorrow"
    activate UI
    UI->>AC: 2. chatRequest(query)
    activate AC
    AC->>AS: 3. processQuery(userId, query)
    activate AS
    AS->>LG: 4. runReActLoop(state)
    activate LG
    
    Note over LG: Step 1: Reasoning (Thought)
    LG-->>AS: 5. Request Tool: "find_slots"
    AS->>TR: 6. callTool("find_slots", {pet: "Bella", date: "tomorrow"})
    activate TR
    Note right of TR: Call fast-mcp plugin link to Spring Boot
    TR-->>AS: 7. Observation: "Available slots: 09:00, 10:00"
    deactivate TR
    AS->>LG: 8. Update State with Observation
    
    Note over LG: Step 2: Reasoning (Thought)
    LG-->>AS: 9. Final Answer: "Tôi tìm thấy 2 khung giờ..."
    deactivate LG
    
    AS-->>AC: 10. StreamingResponse (Chunks)
    deactivate AS
    AC-->>UI: 11. WebSocket / SSE Stream
    deactivate AC
    UI-->>PO: 12. Display text progressively
    deactivate UI
```

#### 4.19.3 AI Vision Pet Health Analysis (Planned / Future Design)

```mermaid
classDiagram
    %% === AI SERVICE LAYER ===
    class ChatWebSocket {
        <<FastAPI WebSocket>>
        +connect(websocket, user_id)
        +receive_message(message)
        +send_stream_response(chunks)
    }

    class SingleAgent {
        -llm_client: OpenRouterClient
        -enabled_tools: List~str~
        -system_prompt: str
        +invoke(message: str, context: dict) str
        +stream(message: str) AsyncIterator
        -_think_node(state) dict
        -_act_node(state) dict
        -_observe_node(state) dict
    }

    class OpenRouterClient {
        -api_key: str
        -model: str
        +generate(prompt: str) LLMResponse
        +generate_with_image(prompt: str, image_url: str) LLMResponse
        +stream(prompt: str) AsyncIterator
    }

    %% === VISION TOOLS ===
    class VisionTools {
        <<@mcp.tool>>
        +analyze_pet_image(image_url, pet_type, symptoms) VisionAnalysisResult
    }

    class VisionAnalysisResult {
        +detected_issues: List~DetectedIssue~
        +severity: SeverityLevel
        +recommended_services: List~UUID~
        +urgent_warning: str
        +next_steps: str
    }

    class DetectedIssue {
        +name: str
        +description: str
        +confidence: float
        +affected_area: str
    }

    class SeverityLevel {
        <<enumeration>>
        MILD
        MODERATE
        SEVERE
        URGENT
    }

    %% === BOOKING TOOLS ===
    class BookingTools {
        <<@mcp.tool>>
        +search_nearby_clinics(lat, lng, radius_km) List~ClinicResult~
        +get_user_pets(user_id) List~PetSummary~
        +create_booking_suggestion(pet_id, clinic_id, service_ids, urgency) BookingSuggestion
    }

    class ClinicResult {
        +clinic_id: UUID
        +name: str
        +address: str
        +distance_km: float
        +rating: float
        +available_services: List~str~
    }

    class PetSummary {
        +pet_id: UUID
        +name: str
        +species: str
        +breed: str
        +image_url: str
    }

    class BookingSuggestion {
        +pet_id: UUID
        +clinic_id: UUID
        +clinic_name: str
        +clinic_address: str
        +services: List~ServiceInfo~
        +suggested_date: date
        +suggested_time: time
        +estimated_price: int
        +urgency: str
        +warning_message: str
        +confirmation_action: dict
    }

    %% === WEBSOCKET SCHEMAS ===
    class ImageMessage {
        +type: str = "image"
        +image_url: str
        +latitude: float
        +longitude: float
        +text: str
    }

    class BookingSuggestionMessage {
        +type: str = "booking_suggestion"
        +suggestion: BookingSuggestion
    }

    %% === RELATIONSHIPS ===
    ChatWebSocket --> SingleAgent : uses
    SingleAgent --> OpenRouterClient : uses
    SingleAgent --> VisionTools : calls
    SingleAgent --> BookingTools : calls
    VisionTools --> VisionAnalysisResult : returns
    VisionTools --> OpenRouterClient : calls generate_with_image
    BookingTools --> ClinicResult : returns
    BookingTools --> PetSummary : returns
    BookingTools --> BookingSuggestion : returns
    VisionAnalysisResult --> DetectedIssue : contains
    VisionAnalysisResult --> SeverityLevel : has
    ChatWebSocket --> ImageMessage : receives
    ChatWebSocket --> BookingSuggestionMessage : sends
```

#### 4.19.4 Class Specifications (Planned)

**1. OpenRouterClient (Extended)**
- **Responsibility:** Giao tiếp với OpenRouter API, hỗ trợ cả text và multimodal (image) input.
- **Key Methods:**
    - `generate_with_image(prompt, image_url)`: Gửi prompt kèm hình ảnh đến Vision LLM (Gemini 2.0 Flash).
    - Trả về structured response với detected issues.

**2. VisionTools (@mcp.tool)**
- **Responsibility:** Phân tích hình ảnh thú cưng để nhận diện vấn đề sức khỏe.
- **Key Methods:**
    - `analyze_pet_image(image_url, pet_type, symptoms_description)`:
        - Gọi Vision LLM với prompt chuyên biệt cho pet health analysis.
        - Parse response để trích xuất detected issues, severity.
        - Map issues sang recommended service categories.

**3. BookingTools (@mcp.tool)**
- **Responsibility:** Hỗ trợ tìm clinic và tạo booking suggestion.
- **Key Methods:**
    - `search_nearby_clinics(lat, lng, radius_km)`: Gọi Spring Boot API `/clinics/nearby` với Haversine distance.
    - `get_user_pets(user_id)`: Gọi API `/pets/my` để lấy danh sách pet của user.
    - `create_booking_suggestion(...)`: Tạo booking suggestion object với thông tin đã điền sẵn.

**4. BookingSuggestion**
- **Responsibility:** Data object chứa thông tin booking được AI đề xuất.
- **Fields:**
    - `confirmation_action`: Deep link params để mobile app navigate đến booking screen.

#### 4.19.5 Sequence Diagram: AI Vision Analysis to Booking (Planned)

```mermaid
sequenceDiagram
    actor PO as Pet Owner
    participant UI as Chat UI (Mobile)
    participant CD as Cloudinary
    participant WS as ChatWebSocket (FastAPI)
    participant SA as SingleAgent
    participant VT as VisionTools
    participant LLM as OpenRouter (Gemini 2.0)
    participant BT as BookingTools
    participant API as Spring Boot API

    Note over PO, UI: Step 1: Upload Image
    PO->>UI: 1. Tap camera icon, select pet photo
    activate UI
    UI->>CD: 2. Upload image
    activate CD
    CD-->>UI: 3. Return image_url
    deactivate CD

    Note over UI, WS: Step 2: Send Image Message
    UI->>WS: 4. WebSocket: {type: "image", image_url, lat, lng}
    activate WS
    WS->>SA: 5. invoke(message, context)
    activate SA

    Note over SA: Step 3: ReAct - Thought
    SA->>SA: 6. Detect image in message
    SA->>SA: 7. Decide to call analyze_pet_image tool

    Note over SA, LLM: Step 4: Vision Analysis
    SA->>VT: 8. analyze_pet_image(image_url, pet_type)
    activate VT
    VT->>LLM: 9. generate_with_image(prompt, image_url)
    activate LLM
    Note right of LLM: Vision LLM analyzes image
    LLM-->>VT: 10. Analysis result (JSON)
    deactivate LLM
    VT-->>SA: 11. VisionAnalysisResult {issues, severity: "moderate", services}
    deactivate VT

    Note over SA: Step 5: ReAct - Observe & Think
    SA->>SA: 12. Severity >= moderate → Need booking

    Note over SA, API: Step 6: Find Nearby Clinics
    SA->>BT: 13. search_nearby_clinics(lat, lng)
    activate BT
    BT->>API: 14. GET /clinics/nearby?lat=...&lng=...
    activate API
    API-->>BT: 15. List of clinics
    deactivate API
    BT-->>SA: 16. [Clinic A, Clinic B, ...]
    deactivate BT

    Note over SA, API: Step 7: Get User Pets
    SA->>BT: 17. get_user_pets(user_id)
    activate BT
    BT->>API: 18. GET /pets/my
    activate API
    API-->>BT: 19. [Lucky, Mimi, Bella]
    deactivate API
    BT-->>SA: 20. List of pets
    deactivate BT

    Note over SA, UI: Step 8: Ask Pet Selection (if multiple)
    SA-->>WS: 21. Stream: "Bạn muốn đặt lịch cho bé nào?"
    WS-->>UI: 22. Display pet selection
    UI-->>PO: 23. Show pet options
    PO->>UI: 24. Select "Lucky"
    UI->>WS: 25. {type: "text", content: "Lucky"}
    WS->>SA: 26. Continue with pet selection

    Note over SA, BT: Step 9: Create Booking Suggestion
    SA->>BT: 27. create_booking_suggestion(pet_id, clinic_id, services, urgency)
    activate BT
    BT-->>SA: 28. BookingSuggestion object
    deactivate BT

    Note over SA, UI: Step 10: Return Final Response
    SA-->>WS: 29. Stream: Warning + BookingSuggestion
    deactivate SA
    WS-->>UI: 30. {type: "booking_suggestion", suggestion: {...}}
    deactivate WS
    UI-->>PO: 31. Display warning + "Đặt lịch ngay" button
    deactivate UI

    Note over PO, UI: Step 11: Confirm Booking
    PO->>UI: 32. Tap "Đặt lịch ngay"
    UI->>UI: 33. Navigate to BookingScreen with params
```

#### 4.19.6 WebSocket Message Schemas (Planned)

**1. Image Message (Client → Server)**
```json
{
  "type": "image",
  "image_url": "https://res.cloudinary.com/petties/image/upload/v123/pet_photo.jpg",
  "text": "Bé nhà mình bị như này có sao không?",
  "latitude": 10.7769,
  "longitude": 106.7009
}
```

**2. Booking Suggestion Message (Server → Client)**
```json
{
  "type": "booking_suggestion",
  "warning_message": "⚠️ CẢNH BÁO: Phát hiện dấu hiệu viêm da, nghi ngờ nhiễm nấm. Nên đưa đến nhân viên thú y trong 24-48h.",
  "suggestion": {
    "pet_id": "uuid-pet",
    "pet_name": "Lucky",
    "clinic_id": "uuid-clinic",
    "clinic_name": "Phòng khám ABC",
    "clinic_address": "123 Nguyễn Văn A, Quận 7",
    "services": [
      {"id": "uuid-service", "name": "Khám da liễu", "price": 200000}
    ],
    "suggested_date": "2026-01-16",
    "suggested_time": "09:00",
    "estimated_price": 200000,
    "urgency": "moderate",
    "confirmation_action": {
      "action": "open_booking",
      "params": {
        "pet_id": "uuid-pet",
        "clinic_id": "uuid-clinic",
        "service_ids": ["uuid-service"],
        "date": "2026-01-16",
        "time": "09:00"
      }
    }
  }
}
```

**3. Pet Selection Message (Server → Client)**
```json
{
  "type": "pet_selection",
  "message": "Bạn muốn đặt lịch cho bé nào?",
  "pets": [
    {"pet_id": "uuid-1", "name": "Lucky", "species": "Chó", "image_url": "..."},
    {"pet_id": "uuid-2", "name": "Mimi", "species": "Mèo", "image_url": "..."}
  ]
}
```

#### 4.19.7 Severity Mapping to Actions

| Severity | Description | AI Action |
|----------|-------------|-----------|
| `MILD` | Không phát hiện vấn đề nghiêm trọng | Chỉ đưa lời khuyên, không đề xuất booking |
| `MODERATE` | Phát hiện vấn đề cần theo dõi | Đề xuất booking trong 24-48h |
| `SEVERE` | Vấn đề nghiêm trọng | Khuyến cáo đến phòng khám sớm |
| `URGENT` | Cần can thiệp ngay | Cảnh báo khẩn cấp + đề xuất SOS |

#### 4.18.7a AI Vision ML Architecture (v2 - Implemented 2026)

> **Note:** Section này mô tả kiến trúc ML-based mới, khác với Vision LLM (Gemini) ở section 4.18.3-4.18.7.

**Architecture Overview:**

```mermaid
flowchart TD
    A[Image Upload] --> B[Jina CLIP Embedding]
    B --> C[Qdrant Case Memory]
    B --> D[ONNX Classifier]
    D --> E[Uncertainty Estimation]
    D --> F[GradCAM Heatmap]
    C --> G[Similar Cases]
    E --> H{Uncertainty > Threshold?}
    F --> H
    G --> H
    H -->|Yes| I[Low Confidence Response]
    H -->|No| J[Full Prediction Result]
    I --> K[Add Disclaimer]
    J --> L[Return to Agent]
```

**Key Components:**

| Component | Technology | Purpose |
|-----------|------------|---------|
| Image Embedding | Jina CLIP v2 | Extract 1024-dim vector from image |
| Classifier | ONNX + LoRA | Disease classification |
| Case Memory | Qdrant (named vectors) | Retrieve similar confirmed cases |
| Uncertainty | Monte Carlo Dropout | Estimate prediction confidence |
| Heatmap | GradCAM | Visualize AI attention area |
| Training | MONAI + LoRA | Efficient fine-tuning |

**Database Schema - vision_disease_classes:**

```sql
CREATE TABLE vision_disease_classes (
    id SERIAL PRIMARY KEY,
    code VARCHAR(50) UNIQUE NOT NULL,    -- "viem_da"
    name_vi VARCHAR(100) NOT NULL,        -- "Viêm da"
    description TEXT,
    species VARCHAR(50) DEFAULT 'all',   -- 'dog', 'cat', 'all'
    is_active BOOLEAN DEFAULT TRUE,
    requires_retrain BOOLEAN DEFAULT FALSE,
    label_count INTEGER DEFAULT 0,
    min_label_required INTEGER DEFAULT 50,
    model_version VARCHAR(50),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);
```

**API Endpoints:**

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/v1/vision/predict` | POST | Predict disease from image |
| `/api/v1/vision/diseases` | GET | List active diseases |
| `/api/v1/vision/drift-check` | GET | Check model drift |
| `/api/v1/vision/trigger-retrain` | POST | Manual retrain trigger |
| `/api/v1/vision-diseases` | GET/POST/PATCH/DELETE | CRUD for diseases |

**MLOps Pipeline:**

```mermaid
flowchart TD
    A[Trigger: 200+ cases OR Drift] --> B[Extract from MongoDB]
    B --> C[Prepare Dataset]
    C --> D[MONAI Augmentation]
    D --> E[Train LoRA]
    E --> F[Evaluate]
    F --> G{F1 > threshold?}
    G -->|Yes| H[Export ONNX]
    G -->|No| I[Skip Deploy]
    H --> J[Deploy to Production]
    J --> K[Update Model Version]
```

**Prediction Response Schema:**

```json
{
  "predictions": [
    {"disease": "viem_da", "confidence": 0.85, "name_vi": "Viêm da"},
    {"disease": "nam_da", "confidence": 0.12, "name_vi": "Nấm da"}
  ],
  "uncertainty": 0.15,
  "heatmap_url": "https://cloudinary.com/heatmap/...",
  "case_memory_matches": [
    {"case_id": "...", "diagnosis": "viem_da", "similarity": 0.92}
  ]
}
```

**Status:** Infrastructure implemented, waiting for trained model.


#### 4.19.8 Overview

**Feature Description:**

Clinic Setup AI Agent là workflow AI hỗ trợ Clinic Owner khởi tạo nhanh danh mục dịch vụ cho phòng khám trên nền tảng Petties. Scope hiện tại tập trung vào việc generate service catalog theo loại hình clinic và nhóm thú cưng phục vụ, sau đó cho phép owner review, chỉnh sửa và lưu thủ công.

#### 4.19.9 Class Diagram

```mermaid
classDiagram
    class ClinicSetupController {
        <<REST Controller>>
        +initSetup(clinicId)
        +generateServices(request)
        +updateService(serviceData)
        +saveServices(clinicId, services)
    }

    class ClinicSetupService {
        <<Business Logic>>
        -agentService: AgentService
        -clinicService: ClinicService
        -clinicServiceRepository: ClinicServiceRepository
        -masterServiceRepository: MasterServiceRepository
        
        +initSetup(clinicId)
        +generateClinicServices(request)
        +saveGeneratedServices(clinicId, services)
    }

    class AgentService {
        <<AI Service>>
        -agent: CompiledStateGraph
        -chatHistoryService: ChatHistoryService
        
        +executeClinicSetupTask(taskType, params)
        +generateServices(params)
    }

    class ClinicSetupAgentTools {
        <<FastMCP Tools>>
        +generate_clinic_services()
    }

    class ClinicService {
        <<Entity>>
        -clinicServiceId: UUID
        -name: String
        -description: String
        -basePrice: BigDecimal
        -duration: Integer
        -category: ServiceCategory
        -isAiGenerated: Boolean
        -aiConfidenceScore: Float
    }

    class MasterService {
        <<Entity>>
        -masterServiceId: UUID
        -name: String
        -description: String
        -basePrice: BigDecimal
        -category: ServiceCategory
    }

    ClinicSetupController --> ClinicSetupService
    ClinicSetupService --> AgentService
    ClinicSetupService --> ClinicService
    ClinicSetupService --> MasterService
    
    AgentService --> ClinicSetupAgentTools
    AgentService --> ChatHistoryService
    
```

#### 4.19.10 Class Specifications

**1. ClinicSetupController**

- **Responsibility:** REST API endpoints cho luồng AI generate clinic services.
- **Key Methods:**

| Method | HTTP | Path | Description |
|--------|------|------|-------------|
| `initSetup` | POST | `/api/ai/clinic-setup/init` | Khởi tạo setup session cho clinic |
| `generateServices` | POST | `/api/ai/clinic-setup/services` | Generate services theo loại hình |
| `updateService` | PUT | `/api/ai/clinic-setup/services/{id}` | Update một service |
| `saveServices` | POST | `/api/ai/clinic-setup/save` | Lưu tất cả services đã approve |

**2. ClinicSetupService**

- **Responsibility:** Business logic cho clinic setup workflow.
- **Key Methods:**

| Method | Description |
|--------|-------------|
| `initSetup(clinicId)` | Khởi tạo session, lấy clinic profile |
| `generateClinicServices(request)` | Gọi AI Agent để generate services |
| `saveGeneratedServices(clinicId, services)` | Save services với metadata (ai_generated=true) |

**3. AgentService (Clinic Setup Methods)**

- **Responsibility:** Handle AI operations cho clinic setup.
- **Key Methods:**

| Method | Description |
|--------|-------------|
| `executeClinicSetupTask(taskType, params)` | Execute clinic setup task via ReAct agent |
| `generateServices(params)` | Generate services list |

**4. ClinicSetupAgentTools**

- **Responsibility:** FastMCP tools cho clinic setup operations.

| Tool Name | Description |
|-----------|-------------|
| `generate_clinic_services` | Generate services based on clinic type |

#### 4.19.11 Sequence Diagram: AI Generate Clinic Services Flow

```mermaid
sequenceDiagram
    participant CO as Clinic Owner
    participant UI as Web Dashboard
    participant CSC as ClinicSetupController
    participant CSS as ClinicSetupService
    participant AS as AgentService
    participant KB as Knowledge Base (Qdrant)
    participant DB as PostgreSQL
    CO->>UI: 1. Click "AI Generate Services"
    UI->>CSC: 2. POST /api/ai/clinic-setup/init {clinicId}
    activate CSC
    CSC->>CSS: 3. initSetup(clinicId)
    activate CSS
    CSS->>DB: 4. getClinicById(clinicId)
    DB-->>CSS: 5. Clinic entity
    CSS-->>CSC: 6. SetupResponse
    CSC-->>UI: 7. 200 OK
    UI-->>CO: 8. Display service setup form
    
    CO->>UI: 9. Select clinic type & pets
    UI->>CSC: 10. POST /api/ai/clinic-setup/services {clinicType, pets, location}
    CSC->>CSS: 11. generateClinicServices(request)
    activate CSS
    CSS->>AS: 12. generateServices(params)
    activate AS
    
    AS->>KB: 13. Query standard services by type
    KB-->>AS: 14. Service templates
    
    AS-->>CSS: 15. Generated services array
    CSS-->>CSC: 16. ServicesResponse
    CSC-->>UI: 17. 200 OK
    
    UI-->>CO: 18. Display service cards
    
    loop Review Loop
        CO->>UI: 19. Edit/Delete/Regenerate service
        UI->>CSC: 20. PUT /api/ai/clinic-setup/services/{id}
        CSC->>CSS: 21. updateService(data)
        CSS-->>CSC: 22. Updated service
        CSC-->>UI: 23. 200 OK
        UI-->>CO: 24. Updated card
    end
    
    CO->>UI: 25. Click "Save All"
    UI->>CSC: 26. POST /api/ai/clinic-setup/save {services[]}
    CSC->>CSS: 27. saveGeneratedServices(clinicId, services)
    activate CSS
    
    loop Each Service
        CSS->>DB: 28a. save(service with ai_metadata)
    end
    
    DB-->>CSS: 29. Saved confirmations
    CSS-->>CSC: 30. SaveResult
    CSC-->>UI: 31. 200 OK
    UI-->>CO: 32. Success message
    
    deactivate CSS
    deactivate CSC
```

#### 4.19.12 API Endpoints

**Clinic Setup API**

| Method | Endpoint | Description | Request | Response |
|--------|----------|-------------|---------|----------|
| `POST` | `/api/ai/clinic-setup/init` | Initialize setup session | `{clinicId}` | `{sessionId, clinicInfo, steps[]}` |
| `POST` | `/api/ai/clinic-setup/services` | Generate services | `{clinicType, petTypes[], serviceScope[]}` | `{services: [{name, description, category, duration, aiConfidence}]}` |
| `PUT` | `/api/ai/clinic-setup/services/{id}` | Update service | `{name, description, price, duration}` | `{updated}` |
| `POST` | `/api/ai/clinic-setup/save` | Save all services | `{services[]}` | `{savedCount, serviceIds[]}` |
| `GET` | `/api/ai/clinic-setup/{sessionId}` | Get session status | - | `{step, services[], progress}` |

**Request/Response Objects**

```typescript
// Generate Services Request
interface GenerateServicesRequest {
    clinicType: 'GENERAL_PRACTICE' | 'SPECIALTY' | 'EMERGENCY' | 'MULTI_SPECIALTY' | 'MOBILE_CLINIC';
    petTypes: ('DOG' | 'CAT' | 'EXOTIC')[];
    serviceScope?: string[];
}

// Generated Service
interface GeneratedService {
    id?: UUID;
    name: string;
    description: string;
    category: ServiceCategory;
    duration: number;   // minutes
    aiConfidence: number;  // 0.0 - 1.0
    isAiGenerated: boolean;
}

// Save Request
interface SaveServicesRequest {
    clinicId: UUID;
    services: GeneratedService[];
}
```

#### 4.19.13 Database Schema Additions

**New/Modified Tables:**

| Table | Type | Description |
|-------|------|-------------|
| `clinic_services` | Modified | Add `is_ai_generated`, `ai_confidence_score`, `ai_prompt_version` columns |
| `ai_setup_sessions` | New | Track setup wizard sessions |
| `ai_generated_content_log` | New | Audit log for AI-generated content |

**AI Setup Session Table:**

```sql
CREATE TABLE ai_setup_sessions (
    session_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    clinic_id UUID NOT NULL REFERENCES clinics(clinic_id),
    step VARCHAR(50) NOT NULL,
    clinic_type VARCHAR(50),
    pet_types JSONB,
    language VARCHAR(10) DEFAULT 'VI',
    status VARCHAR(20) DEFAULT 'IN_PROGRESS',
    created_at TIMESTAMP DEFAULT NOW(),
    completed_at TIMESTAMP,
    metadata JSONB
);
```

**AI Content Audit Log:**

```sql
CREATE TABLE ai_generated_content_log (
    log_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    entity_type VARCHAR(50) NOT NULL,
    entity_id UUID NOT NULL,
    content_type VARCHAR(50) NOT NULL,
    original_content TEXT,
    generated_content TEXT,
    ai_prompt TEXT,
    confidence_score FLOAT,
    owner_approved BOOLEAN DEFAULT FALSE,
    approved_by UUID,
    approved_at TIMESTAMP,
    created_at TIMESTAMP DEFAULT NOW()
);
```

#### 4.19.14 Role-Based AI Chat Context Isolation

This design bổ sung lớp isolation cho AI Assistant để tách hoàn toàn giữa business chat và admin playground. Mỗi session phải mang đầy đủ ownership metadata (`user_id`, `user_role`, `clinic_id`, `context_type`) và được kiểm tra trước khi nạp history hoặc mở WebSocket. MongoDB là nguồn lưu trữ chính cho session/messages nhằm hỗ trợ ReAct trace, streaming persistence, và resume multi-turn conversation mà không lẫn context.

#### 4.19.15 Class Diagram - Chat Session Isolation

```mermaid
classDiagram
    class ChatSessionController {
        +createSession(CreateChatSessionRequest) ChatSessionResponse
        +listSessions(ChatSessionFilter) SessionListResponse
        +getSession(String) ChatSessionDetailResponse
        +deleteSession(String) void
    }

    class PlaygroundWebSocketController {
        +connect(WebSocket, String) void
        +handleMessage(String, CurrentUser) void
    }

    class BusinessChatWebSocketController {
        +connect(WebSocket, String) void
        +handleMessage(String, CurrentUser) void
    }

    class ChatSessionService {
        +createSession(CurrentUser, String, String, Integer) ChatSessionDocument
        +validateSessionAccess(String, CurrentUser, String) ChatSessionDocument
        +listUserSessions(CurrentUser, String) List~ChatSessionDocument~
        +appendMessage(ChatMessageDocument) void
        +loadHistory(String, CurrentUser, String) List~ChatMessageDocument~
    }

    class ContextPolicyService {
        +resolveContextType(Boolean) ChatContextType
        +resolveClinicScope(CurrentUser) String
        +getAllowedTools(String, String) List~String~
        +buildPromptContext(CurrentUser, String) dict
    }

    class ChatSessionRepository {
        <<interface>>
        +save(ChatSessionDocument) ChatSessionDocument
        +findBySessionId(String) Optional~ChatSessionDocument~
        +findByOwner(String, String, String) List~ChatSessionDocument~
        +delete(String) void
    }

    class ChatMessageRepository {
        <<interface>>
        +save(ChatMessageDocument) ChatMessageDocument
        +findBySessionId(String, Integer) List~ChatMessageDocument~
    }

    class ChatSessionDocument {
        +String sessionId
        +String userId
        +String userRole
        +String clinicId
        +ChatContextType contextType
        +Integer agentId
        +datetime createdAt
        +datetime updatedAt
    }

    class ChatMessageDocument {
        +String messageId
        +String sessionId
        +String userId
        +String role
        +String content
        +ChatContextType contextType
        +dict reactTrace
        +dict toolCalls
        +datetime timestamp
    }

    class ChatContextType {
        <<enumeration>>
        BUSINESS_CHAT
        PLAYGROUND_TEST
    }

    ChatSessionController --> ChatSessionService
    PlaygroundWebSocketController --> ChatSessionService
    PlaygroundWebSocketController --> ContextPolicyService
    BusinessChatWebSocketController --> ChatSessionService
    BusinessChatWebSocketController --> ContextPolicyService
    ChatSessionService --> ChatSessionRepository
    ChatSessionService --> ChatMessageRepository
    ChatSessionService --> ChatSessionDocument
    ChatSessionService --> ChatMessageDocument
    ContextPolicyService --> ChatContextType
    ChatSessionDocument --> ChatContextType
    ChatMessageDocument --> ChatContextType
```

#### 4.19.16 Class Specifications

**1. ChatSessionController**
- **Responsibility:** Expose REST endpoints để tạo, liệt kê, xem chi tiết, xóa session theo đúng ownership và context.
- **Key Methods:**
    - `createSession(...)`: Tạo session mới với `BUSINESS_CHAT` hoặc `PLAYGROUND_TEST`.
    - `listSessions(...)`: Chỉ trả về sessions thuộc user hiện tại và đúng context filter.

**2. BusinessChatWebSocketController**
- **Responsibility:** Quản lý real-time business AI chat cho người dùng nghiệp vụ.
- **Key Methods:**
    - `connect(...)`: Xác thực JWT, validate session ownership, nạp history business.
    - `handleMessage(...)`: Stream ReAct response và persist cả user/assistant messages.

**3. PlaygroundWebSocketController**
- **Responsibility:** Quản lý sandbox test riêng cho admin.
- **Key Methods:**
    - `connect(...)`: Chỉ chấp nhận `ADMIN` với session `PLAYGROUND_TEST`.
    - `handleMessage(...)`: Cho phép provider/model override, log trace đầy đủ cho debug.

**4. ChatSessionService**
- **Responsibility:** Trung tâm điều phối session lifecycle, ownership check, Mongo persistence, history loading.
- **Key Methods:**
    - `validateSessionAccess(...)`: Từ chối truy cập chéo user/context.
    - `appendMessage(...)`: Lưu message với metadata trace/tool calls.

**5. ContextPolicyService**
- **Responsibility:** Xây dựng role-aware prompt context và tool governance.
- **Key Methods:**
    - `getAllowedTools(userRole, contextType)`: Trả về danh sách tool được phép dùng.
    - `resolveClinicScope(user)`: Suy ra `clinic_id` cho role clinic-scoped.

#### 4.19.17 Sequence Diagram: Business AI Chat Session Flow

```mermaid
sequenceDiagram
    actor PO as Pet Owner
    participant UI as AI Chat Screen
    participant CC as ChatSessionController
    participant BWS as BusinessChatWebSocketController
    participant CSS as ChatSessionService
    participant CPS as ContextPolicyService
    participant CSR as ChatSessionRepository
    participant CMR as ChatMessageRepository
    participant DB as MongoDB

    PO->>UI: 1. Mở AI chat nghiệp vụ
    activate UI
    UI->>CC: 2. Tạo session BUSINESS_CHAT
    activate CC
    CC->>CSS: 3. createSession(currentUser, BUSINESS_CHAT, clinicId, agentId)
    activate CSS
    CSS->>CPS: 4. resolveClinicScope(currentUser)
    activate CPS
    CPS-->>CSS: 5. clinicId hoặc null
    deactivate CPS
    CSS->>CSR: 6. save(sessionDocument)
    activate CSR
    CSR->>DB: 7. Insert ai_chat_sessions document
    activate DB
    DB-->>CSR: 8. Session saved
    deactivate DB
    CSR-->>CSS: 9. ChatSessionDocument
    deactivate CSR
    CSS-->>CC: 10. ChatSessionResponse
    deactivate CSS
    CC-->>UI: 11. session_id
    deactivate CC
    UI->>BWS: 12. Open WebSocket /ws/chat/{session_id}
    activate BWS
    BWS->>CSS: 13. validateSessionAccess(session_id, currentUser, BUSINESS_CHAT)
    activate CSS
    CSS->>CSR: 14. findBySessionId(session_id)
    activate CSR
    CSR->>DB: 15. Find session by session_id
    activate DB
    DB-->>CSR: 16. Session document
    deactivate DB
    CSR-->>CSS: 17. Session document
    deactivate CSR
    CSS->>CMR: 18. findBySessionId(session_id, 50)
    activate CMR
    CMR->>DB: 19. Query ai_chat_messages by session_id
    activate DB
    DB-->>CMR: 20. Message history
    deactivate DB
    CMR-->>CSS: 21. Message history
    deactivate CMR
    CSS-->>BWS: 22. Access granted + history
    deactivate CSS
    UI->>BWS: 23. Gửi user message
    BWS->>CPS: 24. getAllowedTools(userRole, BUSINESS_CHAT)
    activate CPS
    CPS-->>BWS: 25. Allowed tools + prompt context
    deactivate CPS
    BWS->>CMR: 26. save(user message)
    activate CMR
    CMR->>DB: 27. Insert user message document
    activate DB
    DB-->>CMR: 28. Saved
    deactivate DB
    CMR-->>BWS: 29. Saved
    deactivate CMR
    BWS->>CMR: 30. save(assistant message + react_trace)
    activate CMR
    CMR->>DB: 31. Insert assistant message document
    activate DB
    DB-->>CMR: 32. Saved
    deactivate DB
    CMR-->>BWS: 33. Saved
    deactivate CMR
    BWS-->>UI: 34. Stream response
    UI-->>PO: 35. Hiển thị hội thoại
    deactivate BWS
    deactivate UI
```

#### 4.19.18 Sequence Diagram: Admin Playground Test Flow

```mermaid
sequenceDiagram
    actor A as Admin
    participant UI as Playground Page
    participant CC as ChatSessionController
    participant PWS as PlaygroundWebSocketController
    participant CSS as ChatSessionService
    participant CPS as ContextPolicyService
    participant CMR as ChatMessageRepository
    participant DB as MongoDB

    A->>UI: 1. Mở Playground
    activate UI
    UI->>CC: 2. Tạo session PLAYGROUND_TEST
    activate CC
    CC->>CSS: 3. createSession(adminUser, PLAYGROUND_TEST, null, agentId)
    activate CSS
    CSS-->>CC: 4. Playground session response
    deactivate CSS
    CC-->>UI: 5. session_id
    deactivate CC
    UI->>PWS: 6. Open WebSocket playground session
    activate PWS
    PWS->>CSS: 7. validateSessionAccess(session_id, adminUser, PLAYGROUND_TEST)
    activate CSS
    CSS-->>PWS: 8. Access granted
    deactivate CSS
    UI->>PWS: 9. Gửi test prompt + provider/model override
    PWS->>CPS: 10. getAllowedTools(ADMIN, PLAYGROUND_TEST)
    activate CPS
    CPS-->>PWS: 11. Admin tool set + debug context
    deactivate CPS
    PWS->>CMR: 12. save(test message)
    activate CMR
    CMR->>DB: 13. Insert PLAYGROUND_TEST message
    activate DB
    DB-->>CMR: 14. Saved
    deactivate DB
    CMR-->>PWS: 15. Saved
    deactivate CMR
    PWS->>CMR: 16. save(response + react_trace + tool logs)
    activate CMR
    CMR->>DB: 17. Insert assistant debug message
    activate DB
    DB-->>CMR: 18. Saved
    deactivate DB
    CMR-->>PWS: 19. Saved
    deactivate CMR
    PWS-->>UI: 20. Stream trace + final answer
    UI-->>A: 21. Hiển thị kết quả test
    deactivate PWS
    deactivate UI
```

#### 4.19.19 MongoDB Document Model for AI Session Isolation

**Collection: `ai_chat_sessions`**

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `session_id` | string | Yes | Public session identifier |
| `user_id` | string | Yes | Owner của session |
| `user_role` | string | Yes | Vai trò tạo session |
| `clinic_id` | string/null | Conditional | Clinic scope cho Staff, Clinic Manager, Clinic Owner |
| `context_type` | string | Yes | `BUSINESS_CHAT` hoặc `PLAYGROUND_TEST` |
| `agent_id` | int/null | No | Agent đang được dùng |
| `created_at` | datetime | Yes | Thời điểm tạo |
| `updated_at` | datetime | Yes | Thời điểm cập nhật cuối |

**Collection: `ai_chat_messages`**

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `message_id` | string | Yes | Message identifier |
| `session_id` | string | Yes | Reference tới `ai_chat_sessions.session_id` |
| `user_id` | string | Yes | Owner để phục vụ ownership check nhanh |
| `role` | string | Yes | `user`, `assistant`, `system`, `tool` |
| `content` | string | Yes | Nội dung message |
| `context_type` | string | Yes | Đồng bộ với session context |
| `react_trace` | object/null | No | Thought/Action/Observation trace |
| `tool_calls` | array/object/null | No | Log tool calls |
| `sources` | array/null | No | Citation/RAG sources |
| `timestamp` | datetime | Yes | Thời điểm lưu |

**Required Indexes**
- `ai_chat_sessions`: unique(`session_id`), index(`user_id`), index(`context_type`), index(`user_id`, `context_type`, `updated_at`)
- `ai_chat_messages`: unique(`message_id`), index(`session_id`, `timestamp`), index(`user_id`, `context_type`)

#### 4.19.20 Cross-Reference to SRS

| SDD Section | SRS Reference | Description |
|-------------|---------------|-------------|
| 4.18.15 Class Diagram - Chat Session Isolation | 3.11.5 | Overall class structure for role-based session isolation |
| 4.18.17 Business AI Chat Session Flow | 3.11.1, 3.11.5, 3.11.6 | Business chat ownership, history loading, Mongo persistence |
| 4.18.18 Admin Playground Test Flow | 3.11.4, 3.11.5 | Admin-only isolated test environment |
| 4.18.19 MongoDB Document Model | 3.11.1, 3.11.4, 3.11.5 | Session/message fields and indexes for context isolation |
| 4.18.21 Booking With ChatBot - Guided Booking (Interactive Components) | 3.11.1 | Booking flow in business chat: booking type clarification, interactive components selection, Booking Summary Card confirm, create PENDING booking, clinic manager confirmation |

#### 4.18.21 Sequence Diagram: Booking With ChatBot - Guided Booking (Interactive Components)

Tham chiếu hợp đồng WebSocket: docs-references/documentation/technical/AI_CHAT_WEBSOCKET_CONTRACT.md.


```mermaid
sequenceDiagram
    actor PO as Pet Owner
    participant UI as Chat UI (Mobile)
    participant WS as Business Chat WebSocket (FastAPI)
    participant IB as InteractiveBookingFlow
    participant BT as Booking Tools (FastMCP)
    participant API as Spring Boot API
    participant CM as Clinic Manager (Web)

    Note over UI: Khi mở chat, UI hiển thị Suggested Prompts (chips)
    UI-->>PO: Suggested Prompts: "Tôi muốn đặt lịch khám", "Sổ tiêm chủng sắp tới", "Tìm phòng khám theo triệu chứng"

    PO->>UI: Tap "Tôi muốn đặt lịch khám"
    UI->>WS: WebSocket {ui_action: {type: "start_booking"}, location?}
    WS->>IB: handle(ui_action)

    IB->>BT: get_user_pets()
    BT-->>IB: pets
    IB-->>UI: Render Pet Cards

    PO->>UI: Tap Pet Card
    UI->>WS: {ui_action: {type: "select_pet", pet_id}}
    WS->>IB: handle(ui_action)
    IB-->>UI: Quick Replies: "Khám tại phòng khám" / "Khám tại nhà"

    PO->>UI: Tap booking type
    UI->>WS: {ui_action: {type: "select_booking_type", booking_type}}
    WS->>IB: handle(ui_action)
    IB-->>UI: Quick Replies: "Khám bệnh" / "Tiêm phòng" / "Tỉa lông" (+ nhập tự do triệu chứng)

    PO->>UI: Tap service category
    UI->>WS: {ui_action: {type: "select_service_category", category}}
    WS->>IB: handle(ui_action)

    IB->>BT: search_clinics_nearby(lat, lng)
    BT->>API: GET /clinics/nearby
    API-->>BT: clinics
    BT-->>IB: clinics
    IB-->>UI: Render Clinic Cards (carousel)

    PO->>UI: Tap Clinic Card
    UI->>WS: {ui_action: {type: "select_clinic", clinic_id}}
    WS->>IB: handle(ui_action)

    IB->>BT: get_clinic_services(clinic_id)
    BT->>API: GET /clinics/{id}/services
    API-->>BT: services
    BT-->>IB: services
    IB-->>UI: Render Service Chips (multi-select)

    PO->>UI: Select services
    UI->>WS: {ui_action: {type: "select_services", service_ids}}
    WS->>IB: handle(ui_action)
    IB-->>UI: Render Date Chips

    PO->>UI: Tap date
    UI->>WS: {ui_action: {type: "select_date", booking_date}}
    WS->>IB: handle(ui_action)

    IB->>BT: check_available_slots(clinic_id, date, service_ids)
    BT->>API: GET /slots/available
    API-->>BT: availableSlots
    BT-->>IB: availableSlots
    IB-->>UI: Render Time Slot Chips (grid)

    PO->>UI: Tap time slot
    UI->>WS: {ui_action: {type: "select_slot", booking_date, start_time}}
    WS->>IB: handle(ui_action)

    IB-->>UI: Render Booking Summary Card + quick actions
    Note over UI: User co the doi nhanh thu cung, phong kham, dich vu, ngay, gio ngay tren summary card truoc khi xac nhan
    Note over UI: Chỉ khi bấm "XÁC NHẬN ĐẶT LỊCH" mới tạo booking

    PO->>UI: Tap "XÁC NHẬN ĐẶT LỊCH"
    UI->>WS: {ui_action: {type: "confirm_booking"}}
    WS->>IB: handle(ui_action)

    IB->>BT: create_booking_for_user(..., confirmed=true)
    BT->>API: POST /bookings (status=PENDING)
    API-->>BT: booking created
    BT-->>IB: booking
    IB-->>UI: Render booking result

    Note over CM,API: Clinic manager xác nhận thời gian cuối hoặc đề xuất đổi slot
    CM->>API: Confirm booking OR propose new time
    API-->>PO: Notify via app (push/in-app)
```

**Mobile booking summary interaction notes (updated 2026-03-20)**
- The Booking Summary Card is not only the final confirmation screen. It also acts as a `hybrid correction layer` that reduces free-form typing and prevents the user from being pushed back into a manual booking wizard.
- Quick actions on the card must send an explicit adjustment intent such as changing pet, clinic, service, date, or time while preserving all still-valid booking context.
- After each quick action, the AI service must apply `latest explicit fact wins` and render only the next necessary step, such as clinic cards, service chips, slot grid, or an updated summary.
- The mobile composer must provide `autocomplete prompt suggestions` based on the current input, quick prompts, and booking tracker state so the user can complete booking in 1-2 prompts whenever possible.
- The WebSocket layer must accept structured `ui_action` payloads without requiring an accompanying natural-language sentence. `ui_action` is the source of truth for structured booking interactions.
- Mobile must maintain a lightweight `booking tracker snapshot` at runtime so the user can clearly follow resolved fields without reopening a full summary card at every turn.
- Mobile AI booking components must be grouped under `petties_mobile/lib/ui/chat/ai_chat/` and `petties_mobile/lib/ui/chat/ai_chat/utils/` so they remain clearly separated from regular chat and easier to maintain.
- The WebSocket adapter and mobile renderer must enforce `one visible assistant response per turn`: events such as `thinking`, `tool_call`, `tool_result`, `stream`, `service_chips`, `slot_grid`, `booking_summary`, and `booking_created` must be merged into the same assistant turn instead of creating multiple scattered bubbles.
- AI booking tools must include a `clinic hint -> canonical clinic id` resolution layer before calling services, slot, or creation APIs so the system does not surface `clinicId invalid format` errors when only a clinic name or hint is available.
- When backend clinic options return exactly one clinic matching an explicit hint, the mobile UI must not render a clinic picker card. That clinic is considered auto-resolved and the booking flow must continue directly.
- The `booking_created` card must let the user continue immediately to `View my bookings`: mobile should fetch booking detail using `bookingId` or `bookingCode` and open `AppointmentDetailScreen`; if that fetch fails or no valid identifier exists yet, the system must fall back to `PetOwnerHomeScreen(tab=2)`.
---

### 4.20 AI Data Improvement Mechanisms

He thong AI cua Petties su dung 4 co che chinh de cai thien do chinh xac theo thoi gian: **Query Expansion**, **Knowledge Graph**, **Visual Case Memory**, va **Feedback Loop**. Cac co che nay hoat dong dong thoi, bo sung cho nhau, va ap dung cho **tat ca roles** (PET_OWNER, STAFF, CLINIC_MANAGER, CLINIC_OWNER, ADMIN) tren **tat ca loai tuong tac AI** (pet health Q&A, booking, EMR, clinic management, revenue analysis,...).

In the **current implementation**, Visual Case Memory stores **hybrid embeddings** of confirmed cases: 
- **Text embeddings** using **Cohere embed-multilingual-v3.0** (1024-dim)
- **Image embeddings** using **Jina CLIP v2** (1024-dim) when images are provided
Persisted in Qdrant `petties_case_memory` with named vectors `text` and `image`. This allows the Agent to retrieve similar, previously confirmed cases when answering new queries (including those with images) and to explicitly reference “similar past cases confirmed by Staff/Vet” in explanations.

**Reference:** `AI_AGENT_DATA_IMPROVEMENT_STRATEGY.md` (sections 7-12)

#### 4.20.1 Class Diagram - AI Data Improvement

```mermaid
classDiagram
    %% === QUERY EXPANSION ===
    class QueryExpander {
        -llm_client: OpenRouterClient
        -min_word_threshold: int = 5
        +expand_query(query: str, pet_type: str) str
        -_build_expansion_prompt(query: str, pet_type: str) str
        -_is_short_query(query: str) bool
    }

    %% === KNOWLEDGE GRAPH ===
    class KnowledgeGraphService {
        -kg_index: KnowledgeGraphIndex
        -graph_store: SimpleGraphStore
        -llm_client: OpenRouterClient
        +build_from_documents(documents: List) int
        +query_graph(query: str, top_k: int) KGQueryResult
        +extract_triplets(text: str) List~Triplet~
        +get_graph_stats() dict
    }

    class Triplet {
        +subject: str
        +predicate: str
        +object: str
        +source_chunk_id: str
    }

    class KGQueryResult {
        +triplets: List~Triplet~
        +related_entities: List~str~
        +reasoning_chain: str
    }

    %% === VISUAL CASE MEMORY ===
    class CaseMemoryService {
        -qdrant_client: QdrantClient
        -text_embedding_model: CohereEmbedding
        -image_embedding_client: JinaImageEmbeddings
        -collection_name: str = "petties_case_memory"
        +upsert_case(case: ConfirmedCase) str
        +search_similar(query: str, threshold: float) List~CaseResult~
        +prune_low_score_cases(min_score: float) int
        +get_stats() CaseMemoryStats
    }

    %% === IMAGE EMBEDDINGS ===
    class JinaImageEmbeddings {
        -api_key: str
        -model: str = "jina-clip-v2"
        +embed_image_urls(urls: List[str]) List~List[float]~
        +embed_image_base64(base64_strings: List[str]) List~List[float]~
    }

    class ConfirmedCase {
        +case_id: str
        +session_id: str
        +message_id: str
        +feedback_category: FeedbackCategory
        +user_role: str
        +visual_description: str
        +diagnosis: str
        +species: str
        +symptoms: List~str~
        +treatment: str
        +tool_used: str
        +image_urls: List~str~
        +diagnosis_support_count: int
        +confidence_score: float

        +created_at: datetime
    }

    class CaseResult {
        +case: ConfirmedCase
        +similarity_score: float
        +final_score: float
    }

    class CaseMemoryStats {
        +total_cases: int
        +medical_cases: int
        +booking_cases: int
        +clinic_ops_cases: int
        +avg_quality_score: float

    }

    %% === FEEDBACK LOOP ===
    class FeedbackService {
        -mongodb: MongoDBClient
        -case_memory: CaseMemoryService
        -collection_name: str = "chat_feedback"
        +save_feedback(feedback: FeedbackRequest) FeedbackResponse
        +process_positive_feedback(message_id: str, feedback: dict, image_urls: List) bool
        +list_feedback(filters: dict, page: int, limit: int) List~dict~
        +update_feedback(feedback_id: str, update_data: dict) bool
        +delete_feedback(feedback_id: str) bool
        +classify_interaction(message: ChatMessage) FeedbackCategory
        +get_feedback_stats(role: str, period: str) dict
        -_auto_classify(message: ChatMessage, tool_used: str) FeedbackCategory
        -_get_latest_user_images(session_id: str) List~str~
        -_extract_case_by_category(message: ChatMessage, category: FeedbackCategory) ConfirmedCase
        -_calculate_feedback_weight(user_role: str) float
    }

    class FeedbackRequest {
        +message_id: str
        +session_id: str
        +user_role: str
        +feedback_type: FeedbackType
        +feedback_category: FeedbackCategory
        +feedback_reason: FeedbackReason
        +feedback_text: str
        +tool_used: str
    }

    class FeedbackResponse {
        +status: str
        +case_embedded: bool
        +category: FeedbackCategory
    }

    class FeedbackType {
        <<enumeration>>
        THUMBS_UP
        THUMBS_DOWN
        REPORT
    }

    class FeedbackCategory {
        <<enumeration>>
        MEDICAL
        BOOKING
        CLINIC_OPS
        KNOWLEDGE
        GENERAL
    }

    class FeedbackReason {
        <<enumeration>>
        INCORRECT_INFO
        UNHELPFUL
        OFFENSIVE
        WRONG_TOOL
        SLOW_RESPONSE
        OTHER
    }

    %% === ROLE FEEDBACK WEIGHTS ===
    class FeedbackWeightConfig {
        +STAFF_CONFIRMED: float = 1.0
        +CLINIC_MANAGER_POSITIVE: float = 0.7
        +CLINIC_OWNER_POSITIVE: float = 0.7
        +PET_OWNER_THUMBS_UP: float = 0.6
        +ADMIN_PLAYGROUND: float = 0.0
    }

    %% === HYBRID RAG ENGINE (updated) ===
    class HybridRAGEngine {
        -rag_engine: LlamaIndexRAGEngine
        -kg_service: KnowledgeGraphService
        -case_memory: CaseMemoryService
        -query_expander: QueryExpander
        +query(user_query: str, pet_type: str) HybridResult
        -_merge_and_rerank(rag_results, kg_results, case_results) List
    }

    class HybridResult {
        +answer: str
        +rag_sources: List~str~
        +kg_reasoning: str
        +similar_cases: List~CaseResult~
        +confidence: float
    }

    %% === RELATIONSHIPS ===
    HybridRAGEngine --> QueryExpander : uses
    HybridRAGEngine --> KnowledgeGraphService : uses
    HybridRAGEngine --> CaseMemoryService : uses
    HybridRAGEngine "1" --> "1" LlamaIndexRAGEngine : wraps

    FeedbackService --> CaseMemoryService : embeds confirmed cases
    FeedbackService --> FeedbackWeightConfig : uses weights
    FeedbackService ..> FeedbackRequest : receives
    FeedbackService ..> FeedbackResponse : returns
    FeedbackService ..> FeedbackCategory : classifies

    CaseMemoryService ..> ConfirmedCase : stores
    CaseMemoryService ..> CaseResult : returns

    KnowledgeGraphService ..> Triplet : extracts
    KnowledgeGraphService ..> KGQueryResult : returns

    class LlamaIndexRAGEngine {
        <<existing>>
        +query(query: str, top_k: int) List~Node~
    }
```

#### 4.20.2 Class Specifications

**1. QueryExpander**

| Responsibility | Mo rong query ngan gon thanh cau hoi day du hon truoc khi search RAG |
|---------------|----------------------------------------------------------------------|
| Location | `petties-agent-serivce/app/core/rag/query_expander.py` |

| Method | Description |
|--------|-------------|
| `expand_query(query, pet_type)` | Neu query < 5 tu: goi LLM mo rong them dong nghia, thuat ngu thu y, trieu chung lien quan. Tra ve query goc + bo sung. |
| `_build_expansion_prompt(query, pet_type)` | Tao prompt cho LLM: them synonym, medical terms, species context |
| `_is_short_query(query)` | Kiem tra query co it hon min_word_threshold tu khong |

**2. KnowledgeGraphService**

| Responsibility | Xay dung va query do thi tri thuc thu y (Symptom -> Disease -> Treatment) |
|---------------|---------------------------------------------------------------------------|
| Location | `petties-agent-serivce/app/core/rag/knowledge_graph.py` |

| Method | Description |
|--------|-------------|
| `build_from_documents(documents)` | Tao KG index tu tai lieu: parse, extract triplets, luu vao graph store. Tra ve so triplets. |
| `query_graph(query)` | Duyet graph de tim quan he: trieu chung -> benh -> xu ly. Tra ve KGQueryResult. |
| `extract_triplets(text)` | Goi LLM extract (subject, predicate, object) tu text chunk. |
| `get_graph_stats()` | So entity, so relation, top diseases, top symptoms. |

**3. CaseMemoryService**

| Responsibility | Quan ly case memory trong Qdrant: luu, tim, cap nhat, prune cases tu EMR confirmed |
|---------------|-------------------------------------------------------------------------------|
| Location | `petties-agent-serivce/app/core/rag/case_memory.py` |

| Method | Description |
|--------|-------------|
| `upsert_case(case)` | Embed text description + metadata vao Qdrant `petties_case_memory`. Tra ve case_id. Nguon: EMR confirmed (thay vi feedback). |
| `search_similar(query, threshold)` | Tim cases tuong tu theo similarity thuần; disease support metrics duoc tinh downstream trong staff diagnosis service. |
| `prune_low_score_cases(min_score)` | Xoa cases cu co quality gate thap hoac stale support score thap. Tra ve so cases da xoa. |
| `get_stats()` | Thong ke: total cases, avg quality score, image support, va trang thai collection. |

**4. FeedbackService** *(Deprecated - se duoc remove)*

> **⚠️ 2026-03-17 Update:** FeedbackService se duoc remove khoi codebase. Feedback chi con luu tru de phan tich UX, khong con duoc dung lam nguon học cho AI.
> 
> Case memory nguon tu EMR confirmed (xem `EmrCaseMemorySyncService`).

| Responsibility | ~~Thu thap, phan loai, xu ly feedback tu tat ca roles. Auto-embed confirmed cases.~~ Chi con: Luu tru feedback de phan tich UX |
|---------------|-----------------------------------------------------------------------------------|
| Location | `petties-agent-serivce/app/core/services/feedback_service.py` |

| Method | Description |
|--------|-------------|
| `save_feedback(feedback)` | ~~Luu feedback vao MongoDB. Tu dong goi `_auto_classify` va `process_positive_feedback` neu la positive.~~ Chi luu vao MongoDB. |
| `process_positive_feedback(message_id, feedback, image_urls)` | ~~Trích xuất case theo category...~~ Deprecated |
| `list_feedback(filters, page, limit)` | Lấy danh sách feedback kèm phân trang và lọc theo role, category, type cho Admin. |
| `update_feedback(feedback_id, update_data)` | Update feedback metadata for analytics and monitoring only. |
| `delete_feedback(feedback_id)` | Append-only policy: deleting feedback is not supported. |
| `classify_interaction(message)` | ~~Phân loại tương tác dựa trên tool call history trong trace.~~ Deprecated |
| `_auto_classify(message, tool_used)` | ~~Logic tự động gán category: MEDICAL_TOOLS, BOOKING_TOOLS, CLINIC_OPS_TOOLS.~~ Deprecated |
| `_get_latest_user_images(session_id)` | ~~Truy vấn MongoDB tìm User Message gần nhất trong session để lấy ảnh lâm sàng.~~ Deprecated |
| `get_feedback_stats(role, period)` | Thống kê hiệu suất AI và tỷ lệ hài lòng theo vai trò. |
| `_calculate_feedback_weight(user_role)` | ~~STAFF=1.0, CLINIC_MANAGER/OWNER=0.7, PET_OWNER=0.6, ADMIN=0.0~~ Deprecated |

**5. HybridRAGEngine**

| Responsibility | Ket hop 3 nguon tri thuc (RAG + KG + Case Memory) de tra loi chinh xac hon |
|---------------|-----------------------------------------------------------------------------|
| Location | `petties-agent-serivce/app/core/rag/hybrid_engine.py` |

| Method | Description |
|--------|-------------|
| `query(user_query, pet_type)` | Pipeline: expand query -> search RAG + KG + Case Memory song song -> merge & re-rank -> tra ve HybridResult |
| `_merge_and_rerank(rag, kg, cases)` | Ket hop ket qua tu 3 nguon, tinh final_score dua tren relevance + quality boost |

#### 4.20.3 Sequence Diagram: Query Expansion Flow

```mermaid
sequenceDiagram
    actor User as User (Any Role)
    participant Agent as AI Agent (ReAct)
    participant QE as QueryExpander
    participant LLM as LLM (OpenRouter)
    participant RAG as RAG Engine (Qdrant)

    User->>Agent: 1. "cho non bo an"
    activate Agent

    Agent->>QE: 2. expand_query("cho non bo an", "cho")
    activate QE

    QE->>QE: 3. _is_short_query() -> true (3 tu < 5)
    QE->>LLM: 4. Prompt: "Mo rong query thu y: cho non bo an"
    activate LLM
    LLM-->>QE: 5. "cho non mua oi chan an bieng an viem da day ngo doc parvo giun san"
    deactivate LLM

    QE-->>Agent: 6. Expanded: "cho non bo an cho non mua oi chan an bieng an viem da day ngo doc parvo giun san"
    deactivate QE

    Agent->>RAG: 7. query(expanded_query, top_k=5)
    activate RAG
    RAG-->>Agent: 8. Top 5 chunks (relevance cao hon vi co nhieu tu khoa match)
    deactivate RAG

    Agent-->>User: 9. Tra loi chinh xac hon nho expanded query
    deactivate Agent
```

#### 4.20.4 Sequence Diagram: Knowledge Graph Build & Query

```mermaid
sequenceDiagram
    actor Admin
    participant API as AI Service API
    participant KG as KnowledgeGraphService
    participant LLM as LLM (OpenRouter)
    participant Store as SimpleGraphStore
    participant Qdrant as Qdrant Cloud

    Note over Admin,Qdrant: === PHASE 1: Build KG tu tai lieu ===
    Admin->>API: 1. POST /ai/knowledge/build-kg (document_ids)
    activate API

    API->>KG: 2. build_from_documents(documents)
    activate KG

    loop Moi document chunk
        KG->>LLM: 3. extract_triplets(chunk_text)
        activate LLM
        Note right of LLM: "Meo bi ran tai thuong<br/>ngua, lac dau, can thuoc<br/>nho tai, rua tai"
        LLM-->>KG: 4. Triplets:<br/>(Ran_tai, trieu_chung, Ngua)<br/>(Ran_tai, trieu_chung, Lac_dau)<br/>(Ran_tai, xu_ly, Thuoc_nho_tai)<br/>(Ran_tai, thuong_gap, Meo)
        deactivate LLM

        KG->>Store: 5. Store triplets in graph
        KG->>Qdrant: 6. Embed triplet text (hybrid: vector + graph)
    end

    KG-->>API: 7. {total_triplets: 1250, entities: 340}
    deactivate KG
    API-->>Admin: 8. 200 OK - KG built successfully
    deactivate API

    Note over Admin,Qdrant: === PHASE 2: Hybrid Query (RAG + KG) ===
    actor User
    participant Agent as AI Agent

    User->>Agent: 9. "Meo ho khan chay nuoc mui"
    activate Agent

    par RAG Search
        Agent->>Qdrant: 10. Vector search (Cohere embedding)
        Qdrant-->>Agent: 11. Top 5 chunks tuong tu
    and KG Traversal
        Agent->>KG: 12. query_graph("ho khan + chay nuoc mui")
        activate KG
        KG->>Store: 13. Duyet graph relationships
        Note right of Store: Ho_khan --chi_diem--> Viem_mui_hong<br/>Chay_nuoc_mui --chi_diem--> Viem_mui_hong<br/>Viem_mui_hong --thuong_gap--> Meo<br/>Viem_mui_hong --xu_ly--> Khang_sinh
        Store-->>KG: 14. Related triplets + reasoning chain
        KG-->>Agent: 15. KGQueryResult {triplets, reasoning_chain}
        deactivate KG
    end

    Agent->>Agent: 16. Merge RAG chunks + KG reasoning
    Agent-->>User: 17. "Nghi viem duong ho hap tren (Viem mui hong).<br/>Logic: Ho khan + Chay mui -> Viem mui hong (thuong gap o meo).<br/>Xu ly: Khang sinh + Giu am + Kham tai phong kham."
    deactivate Agent
```

#### 4.20.5 Sequence Diagram: Visual Case Memory Flow

```mermaid
sequenceDiagram
    actor UserA as User A (Pet Owner)
    participant Agent as AI Agent
    participant Vision as LLM Vision (OpenRouter)
    participant CaseMem as CaseMemoryService
    participant RAG as RAG Engine
    participant MongoDB as MongoDB
    actor Staff as Staff

    Note over UserA,Staff: === LAN 1: Case moi - Chua co case tham chieu ===
    UserA->>Agent: 1. Gui anh tai meo + "Meo bi gi?"
    activate Agent

    Agent->>Vision: 2. analyze_pet_image(image_url)
    activate Vision
    Vision-->>Agent: 3. "Ong tai chua can nau den, dong cuc<br/>giong ba ca phe, viem do"
    deactivate Vision

    Agent->>CaseMem: 4. search_similar("can nau den tai meo")
    activate CaseMem
    CaseMem-->>Agent: 5. [] (khong co case nao)
    deactivate CaseMem

    Agent->>RAG: 6. query("can nau den tai meo ba ca phe")
    RAG-->>Agent: 7. Chunks tu tai lieu thu y

    Agent-->>UserA: 8. "Nghi ran tai (Ear Mites). Nen dua di kham."
    Agent->>MongoDB: 9. Save message + react_trace + visual_description
    deactivate Agent

    Note over UserA,Staff: === STAFF XAC NHAN ===
    Staff->>MongoDB: 10. Feedback: CONFIRMED + "Dung, ran tai Otodectes"
    activate MongoDB

    MongoDB->>CaseMem: 11. process_positive_feedback()
    activate CaseMem
    Note right of CaseMem: Extract case:<br/>visual: "can nau den dang ba ca phe"<br/>diagnosis: "Ran tai (Otodectes)"<br/>species: "meo", body_part: "tai"<br/>weight: 1.0
    CaseMem->>CaseMem: 12. Embed text -> Qdrant petties_case_memory
    deactivate CaseMem
    deactivate MongoDB

    Note over UserA,Staff: === LAN 2: Case tuong tu - Co case tham chieu ===
    actor UserB as User B (Pet Owner moi)
    UserB->>Agent: 13. Gui anh tai meo khac cung can den
    activate Agent

    Agent->>Vision: 14. analyze_pet_image(new_image)
    Vision-->>Agent: 15. "Tai meo co chat nau den, viem"

    Agent->>CaseMem: 16. search_similar("tai meo chat nau den viem")
    activate CaseMem
    CaseMem-->>Agent: 17. Case #1: Ran tai, score 0.92
    deactivate CaseMem

    Agent->>RAG: 18. Bo sung thong tin tu KB
    RAG-->>Agent: 19. Additional context

    Agent-->>UserB: 20. "Ran tai (Otodectes cynotis), do tin cay 92%<br/>dua tren case tuong tu da duoc Staff xac nhan.<br/>Can thuoc nho tai + ve sinh. Nen dat lich kham."
    deactivate Agent
```

#### 4.20.6 Sequence Diagram: Feedback Loop - All Roles

```mermaid
sequenceDiagram
    actor User as User (Any Role)
    participant Client as Mobile / Web
    participant API as AI Service API
    participant FBS as FeedbackService
    participant MongoDB as MongoDB
    participant CaseMem as CaseMemoryService
    participant Qdrant as Qdrant Cloud

    Note over User,Qdrant: === THU THAP FEEDBACK ===
    User->>Client: 1. Bam Thumbs Up / Down / Report
    Client->>API: 2. POST /ai/chat/feedback
    activate API
    Note right of API: Body: {message_id, session_id,<br/>user_role, feedback_type,<br/>feedback_category, feedback_reason,<br/>feedback_text, tool_used}

    API->>FBS: 3. save_feedback(request)
    activate FBS

    FBS->>MongoDB: 4. Insert feedback vao chat_feedback
    MongoDB-->>FBS: 5. saved

    Note over FBS: 6. Kiem tra: feedback_type == THUMBS_UP ?

    alt Positive Feedback (thumbs_up)
        FBS->>MongoDB: 7. get_chat_message(message_id)
        MongoDB-->>FBS: 8. Original message + react_trace

        FBS->>FBS: 9. classify_interaction(message)
        Note right of FBS: Dua tren tools trong react_trace:<br/>MEDICAL_TOOLS -> "medical"<br/>BOOKING_TOOLS -> "booking"<br/>CLINIC_OPS_TOOLS -> "clinic_ops"<br/>else -> "general"

        FBS->>FBS: 10. _calculate_feedback_weight(user_role)
        Note right of FBS: STAFF: 1.0<br/>CLINIC_MANAGER/OWNER: 0.7<br/>PET_OWNER: 0.6<br/>ADMIN: 0.0 (skip embed)

        alt user_role != ADMIN
            FBS->>FBS: 11. _extract_case_by_category(message, category)
            Note right of FBS: medical: {diagnosis, symptoms, treatment}<br/>booking: {clinic, service, slot}<br/>clinic_ops: {query, tool, result}

            FBS->>CaseMem: 12. upsert_case(confirmed_case)
            activate CaseMem
            CaseMem->>Qdrant: 13. Embed text + metadata
            Qdrant-->>CaseMem: 14. OK
            CaseMem->>CaseMem: 15. Check existing similar (threshold 0.95)
            alt Case tuong tu da ton tai
                CaseMem->>Qdrant: 16. upsert latest payload
            end
            CaseMem-->>FBS: 17. case_id
            deactivate CaseMem
        end

        FBS-->>API: 18. {status: "saved", case_embedded: true, category: "medical"}
    else Negative Feedback (thumbs_down / report)
        FBS->>MongoDB: 19. Flag message for review
        FBS-->>API: 20. {status: "saved", case_embedded: false, category: "medical"}
    end

    deactivate FBS
    API-->>Client: 21. 200 OK - FeedbackResponse
    deactivate API
    Client-->>User: 22. "Cam on ban da gop y!"
```

#### 4.20.7 Sequence Diagram: Hybrid Query (RAG + KG + Case Memory)

```mermaid
sequenceDiagram
    actor User as User (Any Role)
    participant Agent as AI Agent (ReAct)
    participant Hybrid as HybridRAGEngine
    participant QE as QueryExpander
    participant RAG as LlamaIndexRAGEngine
    participant KG as KnowledgeGraphService
    participant CaseMem as CaseMemoryService
    participant LLM as LLM (OpenRouter)

    User->>Agent: 1. "Meo ho khan 3 ngay chay nuoc mui"
    activate Agent

    Agent->>Hybrid: 2. query("Meo ho khan 3 ngay chay nuoc mui", "meo")
    activate Hybrid

    Hybrid->>QE: 3. expand_query(query, "meo")
    QE-->>Hybrid: 4. Expanded query (them dong nghia, medical terms)

    par Tim kiem song song 3 nguon
        Hybrid->>RAG: 5a. query(expanded_query, top_k=5)
        activate RAG
        RAG-->>Hybrid: 6a. Top 5 document chunks
        deactivate RAG
    and
        Hybrid->>KG: 5b. query_graph(expanded_query)
        activate KG
        KG-->>Hybrid: 6b. Triplets + reasoning chain:<br/>Ho_khan -> Viem_mui_hong<br/>Chay_mui -> Viem_mui_hong<br/>Viem_mui_hong -> Khang_sinh
        deactivate KG
    and
        Hybrid->>CaseMem: 5c. search_similar(expanded_query)
        activate CaseMem
        CaseMem-->>Hybrid: 6c. Similar cases:<br/>Case #12: Meo ho + chay mui -> Viem duong ho hap<br/>(similarity=0.94)
        deactivate CaseMem
    end

    Hybrid->>Hybrid: 7. _merge_and_rerank(rag, kg, cases)
    Note right of Hybrid: Hybrid layer merges relevance from KB/KG/Case Memory;<br/>disease support metrics are applied downstream in staff diagnosis service

    Hybrid-->>Agent: 8. HybridResult {answer, sources, reasoning, cases, confidence: 0.89}
    deactivate Hybrid

    Agent->>LLM: 9. Tong hop: RAG evidence + KG logic + Case tham chieu
    LLM-->>Agent: 10. Final answer (structured)

    Agent-->>User: 11. "Nghi viem duong ho hap tren (confidence 89%).<br/>KG logic: Ho khan + Chay mui -> Viem mui hong.<br/>23 case tuong tu da xac nhan boi Staff.<br/>Khuyen: Khang sinh + Giu am + Dat lich kham."
    deactivate Agent
```

#### 4.20.8 Per-User Context vs Shared Knowledge

```mermaid
flowchart TB
    subgraph PER_USER["DU LIEU RIENG MOI USER (MongoDB)"]
        direction TB
        U1["User A (PET_OWNER)<br/>Session #1 - 20 messages"]
        U2["User B (STAFF)<br/>Session #5 - 8 messages"]
        U3["User C (CLINIC_MANAGER)<br/>Session #12 - 35 messages"]
    end
    subgraph SHARED["DU LIEU CHUNG TOAN HE THONG (Qdrant + MongoDB)"]
        direction TB
        RAG["RAG Knowledge Base<br/>(Tai lieu thu y, petties_knowledge_base)"]
        KG["Knowledge Graph<br/>(Triplets trong MongoDB knowledge_graph_triplets)"]
        CM["Case Memory<br/>(Cases confirmed, petties_case_memory_v2)"]
    end
    
    subgraph FEEDBACK_FLOW["FEEDBACK NUOI DU LIEU CHUNG"]
        FB1["PET_OWNER: Thumbs Up<br/>weight 0.6"]
        FB2["STAFF: Confirmed<br/>weight 1.0"]
        FB3["CLINIC_MANAGER: Positive<br/>weight 0.7"]
    end
    
    U1 -->|"Query"| RAG
    U1 -->|"Query"| KG
    U1 -->|"Query"| CM
    U2 -->|"Query"| RAG
    U2 -->|"Query"| KG
    U2 -->|"Query"| CM
    U3 -->|"Query"| RAG
    U3 -->|"Query"| KG
    U3 -->|"Query"| CM
    
    U1 -.-> FB1
    U2 -.-> FB2
    U3 -.-> FB3
    
    FB1 -->|"Embed"| CM
    FB2 -->|"Embed (uu tien)"| CM
    FB3 -->|"Embed"| CM
```

| Du lieu | Pham vi | Luu o dau | Cap nhat khi nao |
|---------|---------|-----------|-----------------|
| Chat session | RIENG moi user | MongoDB `ai_chat_sessions` | Moi lan tao session moi |
| Chat messages + ReAct trace | RIENG moi session | MongoDB `ai_chat_messages` | Moi message gui/nhan |
| Chat feedback | User gui RIENG | MongoDB `chat_feedback` | User bam thumbs up/down |
| RAG Knowledge Base | Shared across all users | Qdrant `petties_knowledge_base` | Admin uploads and reprocesses knowledge documents |
| Knowledge Graph | Shared across all users | MongoDB `knowledge_graph_triplets` | Extracted subject-predicate-object facts used by graph-based retrieval |
| Case Memory | CHUNG toan he thong | Qdrant `petties_case_memory_v2` | Upsert from confirmed EMR records |
| AI Runtime Governance | Shared configuration | PostgreSQL `agents`, `tools`, `system_settings` | Admin governs model parameters, tool availability, and provider settings |
| Du lieu nghiep vu | Realtime query | PostgreSQL (Spring Boot) | Business operations |

**Nguyen tac:** User RIENG hoi -> He thong tra loi dua tren tri thuc CHUNG -> Feedback RIENG duoc giu lai de audit/monitoring -> Tat ca user huong loi tu tri thuc CHUNG duoc cap nhat qua KB va EMR confirmed.

#### 4.20.9 Qdrant Collection Schema - Case Memory

```json
{
  "collection": "petties_case_memory",
  "vectors": {
    "text": {"size": 1024, "distance": "Cosine"},
    "image": {"size": 1024, "distance": "Cosine"}
  },
  "payload_schema": {
    "case_id": "keyword",
    "session_id": "keyword",
    "message_id": "keyword",
    "user_role": "keyword",
    "visual_description": "text",
    "diagnosis": "text",
    "species": "keyword",
    "body_part": "keyword",
    "symptoms": "keyword[] (array)",
    "treatment": "text",
    "tool_used": "keyword",
    "diagnosis_support_count": "integer",
    "confidence_score": "float",
    "created_at": "datetime",
    "last_confirmed_at": "datetime"
  }
}
```

**Case retrieval formula:**

```
final_score = cosine_similarity

```

#### 4.20.10 Accuracy Improvement Over Time

| Giai doan | Thoi gian | So cases | Chat luong AI |
|-----------|-----------|----------|---------------|
| Khoi dau | Thang 1 | 0-50 | Dua vao tai lieu + LLM general knowledge |
| Tich luy | Thang 2-3 | 50-500 | Co case thuc te de tham chieu, chinh xac hon |
| Truong thanh | Thang 4-6 | 500-5000 | Phu hau het benh thuong gap, do tin cay cao |
| Chuyen gia | Thang 6+ | 5000+ | Xu ly duoc ca case hiem, co the de xuat phuong an dieu tri |

```mermaid
flowchart LR
    subgraph COLLECT["1. Thu thap"]
        C1["Chat messages"]
        C2["Feedback (all roles)"]
        C3["Tai lieu thu y"]
        C4["Confirmed cases"]
    end
    
    subgraph PROCESS["2. Xu ly"]
        P1["Query Expansion"]
        P2["KG Triplet Extraction"]
        P3["Case Embedding"]
        P4["Feedback Classification"]
    end
    
    subgraph IMPROVE["3. Cai thien"]
        I1["RAG Knowledge Base mo rong"]
        I2["Knowledge Graph phong phu hon"]
        I3["Case Memory lon dan"]
        I4["Prompt tinh chinh theo role"]
    end
    
    subgraph DEPLOY["4. Trien khai"]
        D1["AI tra loi chinh xac hon"]
        D2["Do tin cay tang"]
        D3["Case coverage rong hon"]
    end
    
    COLLECT --> PROCESS --> IMPROVE --> DEPLOY
    DEPLOY -->|"Vong lap lien tuc"| COLLECT
```

#### 4.20.11 Periodic Maintenance Schedule

| Tan suat | Hanh dong | Muc dich | Trach nhiem |
|----------|-----------|----------|-------------|
| Hang ngay | Embed confirmed cases vao Qdrant (tat ca categories) | Case Memory lon dan | Auto (Scheduler) |
| Hang ngay | Auto-classify implicit feedback (booking success, EMR lookup success) | Thu thap feedback tu dong | Auto (Scheduler) |
| Hang tuan | Review cases bi thumbs_down - phan loai theo category va role | Phat hien van de cu the tung tool/role | Admin review |
| Hang tuan | Phan tich `wrong_tool` feedback -> dieu chinh tool routing | Tool routing chinh xac hon | Admin + Auto |
| Hang thang | Prune cases co quality gate thap hoac stale support score thap | Tranh nhieu vector store | Auto (Scheduler) |
| Hang thang | Thong ke feedback theo role -> dieu chinh role-specific prompts | Prompt tot hon cho tung role | Admin review |
| Hang quy | Re-rank toan bo case memory | Dam bao case tot nhat duoc uu tien | Admin + Auto |

#### 4.20.12 Cross-Reference to SRS

| SDD Section | SRS Reference | Description |
|-------------|---------------|-------------|
| 4.19.1 Class Diagram | 3.11 AI Assistant | Overall class structure for AI improvement mechanisms |
| 4.19.3 Query Expansion | 3.11.1, 3.11.6 | Expands short queries before RAG search |
| 4.19.4 Knowledge Graph | 3.11.1 | Builds symptom-disease-treatment graph from vet documents |
| 4.19.5 Visual Case Memory | 3.11.1, 3.11.3 | Accumulates confirmed image diagnosis cases |
| 4.19.6 Feedback Loop | 3.11.1-3.11.6 | Collects and processes feedback from all roles |
| 4.19.7 Hybrid Query | 3.11.1, 3.11.6 | Combines RAG + KG + Case Memory for better accuracy |
| 4.19.8 Per-User vs Shared | 3.11.5 | Data isolation: per-user sessions vs shared knowledge |

---

---


## 5. TECHNOLOGY STACK SUMMARY


### Frontend (petties-web)
- **Framework:** React 19 + Vite (rolldown-vite)
- **Language:** TypeScript 5.9.x
- **State Management:** Zustand 5.x
- **Routing:** React Router v7.9
- **Styling:** Tailwind CSS v4 (Neobrutalism design)
- **HTTP Client:** Axios
- **Real-time:** Native WebSocket API

### Backend (backend-spring)
- **Framework:** Spring Boot 3.4.x
- **Language:** Java 21
- **Architecture:** Layered (Controller -> Service -> Repository)
- **Security:** Spring Security 6.x + JWT
- **Database Access:** Spring Data JPA + Hibernate
- **Validation:** Jakarta Bean Validation
- **Caching:** Spring Data Redis
- **Image Upload:** Cloudinary SDK

### AI Agent Service (petties-agent-serivce)
- **Framework:** FastAPI 0.115.x
- **Language:** Python 3.12
- **Agent Framework:** LangGraph 0.2.x (Single Agent + ReAct Pattern)
- **RAG Framework:** LlamaIndex 0.11.x
- **Tool Protocol:** FastMCP 2.3.x (@mcp.tool() decorator)
- **LLM Provider:** OpenRouter API (Gemini 2.0 Flash, Llama 3.3 70B)
- **Embeddings:** Cohere embed-multilingual-v3.0 (1024 dimensions)
- **Vector DB:** Qdrant Cloud (Binary Quantization)

### Mobile (petties_mobile)
- **Framework:** Flutter 3.x
- **Language:** Dart SDK 3.x
- **State Management:** Provider 6.x
- **Routing:** GoRouter 14.x
- **HTTP Client:** Dio 5.x
- **Local Storage:** SharedPreferences, Hive
- **Auth:** Google Sign-In, JWT

### Databases
- **PostgreSQL 16:** Primary relational database (Neon Cloud)
- **Redis 7:** OTP, session caching (Upstash Cloud)
- **Qdrant Cloud:** Vector embeddings (1024 dimensions)

### Infrastructure
- **Development:** Docker Compose (local databases)
- **Test Environment:** AWS EC2, Neon Test Branch
- **Production:** AWS EC2 (backend + AI), Vercel (frontend), Neon Main
- **CI/CD:** GitHub Actions
- **Reverse Proxy:** NGINX with SSL (Let's Encrypt)
- **Image Storage:** Cloudinary
- **Push Notifications:** Firebase [Planned]
- **Payments:** Stripe [Planned]

---

**Prepared by:** Petties Development Team
**Document Version:** 3.3.8 (Aligned API coverage with merged commercial and AI runtime modules)
**Last Updated:** 2026-03-25

---

## Appendix A: File Upload & Media Management

Cloudinary-based file upload service for handling images and documents. Supports multiple use cases with optimized transformations for avatars, clinic images, and clinical photos.

**Key Features:**
- Multi-format support (JPEG, PNG, GIF, WEBP, PDF)
- Automatic image optimization (quality, format, size)
- Use-case specific transformations (avatar resize, clinic image limits)
- File validation (size, content type)
- Cloudinary folder organization
- Secure file deletion

#### A.1 Class Diagram - File Upload

```mermaid
classDiagram
    class FileController {
        -CloudinaryService cloudinaryService
        +uploadAvatar(MultipartFile) ResponseEntity~UploadResponse~
        +uploadClinicImage(MultipartFile) ResponseEntity~UploadResponse~
        +uploadEmrImage(MultipartFile) ResponseEntity~UploadResponse~
        +deleteFile(String) ResponseEntity~Map~
    }
    class CloudinaryService {
        -Cloudinary cloudinary
        +uploadFile(MultipartFile, String) UploadResponse
        +uploadAvatar(MultipartFile) UploadResponse
        +uploadClinicImage(MultipartFile) UploadResponse
        +uploadEmrImage(MultipartFile) UploadResponse
        +deleteFile(String) boolean
        -validateFile(MultipartFile) void
        -checkCloudinaryConfig() void
        -mapUploadResult(Map) UploadResponse
    }
    class UploadResponse {
        +String url
        +String publicId
        +String format
        +int width
        +int height
        +long bytes
    }
    class Cloudinary {
        <<external>>
        +uploader() Uploader
        +config CloudinaryConfig
    }

    FileController --> CloudinaryService
    CloudinaryService --> Cloudinary
```

#### A.2 Class Specifications

**1. FileController**
- **Responsibility:** Handle file upload endpoints for different use cases
- **Key Methods:**
  - `uploadAvatar()`: Upload user avatar (300x300 crop)
  - `uploadClinicImage()`: Upload clinic photo (1200x800 limit)
  - `uploadEmrImage()`: Upload clinical image (1600x1200 limit)
  - `deleteFile()`: Delete file from Cloudinary

**2. CloudinaryService**
- **Responsibility:** Manage file upload/deletion with Cloudinary
- **Key Methods:**
  - `uploadFile()`: Generic upload with folder path
  - `uploadAvatar()`: Avatar-specific transformation (face detection crop)
  - `uploadClinicImage()`: Clinic image transformation (limit dimensions)
  - `uploadEmrImage()`: Clinical image transformation (high quality)
  - `deleteFile()`: Delete file by publicId

**Business Rules:**
- **BR-FILE-01:** Max file size 10MB
- **BR-FILE-02:** Allowed formats: JPEG, PNG, GIF, WEBP, PDF
- **BR-FILE-03:** Avatar auto-cropped to 300x300 with face detection
- **BR-FILE-04:** Clinic images limited to 1200x800
- **BR-FILE-05:** EMR images limited to 1600x1200 for quality
- **BR-FILE-06:** Files organized in folders: `petties/avatars/`, `petties/clinics/`, `petties/emr/`

#### A.3 Sequence Diagram: Upload Avatar

```mermaid
sequenceDiagram
    actor U as User
    participant UI as Web/Mobile
    participant FC as FileController
    participant CS as CloudinaryService
    participant C as Cloudinary API
    participant UR as UserRepository
    participant DB as Database

    U->>UI: 1. Select avatar image
    activate UI
    UI->>FC: 2. POST /api/files/upload/avatar (file)
    activate FC
    FC->>CS: 3. uploadAvatar(file)
    activate CS

    CS->>CS: 4. validateFile(file)
    alt File invalid (size > 10MB or wrong format)
        CS-->>FC: 5a. throw BadRequestException
        FC-->>UI: 6a. 400 Bad Request
        UI-->>U: 7a. "File không hợp lệ"
    else File valid
        CS->>CS: 5b. checkCloudinaryConfig()
        CS->>C: 6b. upload(file, folder="petties/avatars", transformation={width:300, height:300, crop:"fill", gravity:"face"})
        activate C
        C->>C: 7b. Resize & optimize image
        C-->>CS: 8b. Upload result (url, publicId, format, dimensions)
        deactivate C

        CS->>CS: 9b. mapUploadResult()
        CS-->>FC: 10b. UploadResponse
        deactivate CS
        FC-->>UI: 11b. 200 OK (url, publicId)
        deactivate FC

        UI->>UR: 12b. Update user.avatar = url
        UR->>DB: 13b. UPDATE users SET avatar = ?
        UI-->>U: 14b. Show new avatar
        deactivate UI
    end
```

#### A.4 Sequence Diagram: Delete Old File

```mermaid
sequenceDiagram
    actor U as Clinic Owner
    participant UI as Web Dashboard
    participant FC as FileController
    participant CS as CloudinaryService
    participant C as Cloudinary API

    U->>UI: 1. Upload new clinic image
    activate UI
    UI->>UI: 2. Check if old image exists (publicId)

    alt Has old image
        UI->>FC: 3. DELETE /api/files/delete?publicId=old_image_id
        activate FC
        FC->>CS: 4. deleteFile(publicId)
        activate CS
        CS->>CS: 5. checkCloudinaryConfig()
        CS->>C: 6. destroy(publicId)
        activate C
        C-->>CS: 7. {"result": "ok"}
        deactivate C
        CS-->>FC: 8. return true
        deactivate CS
        FC-->>UI: 9. 200 OK {"message": "Deleted"}
        deactivate FC
    end

    UI->>FC: 10. POST /api/files/upload/clinic (newFile)
    FC->>CS: 11. uploadClinicImage(newFile)
    CS->>C: 12. upload(file, transformation={width:1200, height:800, crop:"limit"})
    C-->>CS: 13. Upload result
    CS-->>FC: 14. UploadResponse
    FC-->>UI: 15. 200 OK (newUrl, newPublicId)
    UI-->>U: 16. Display new clinic image
    deactivate UI
```

#### A.5 Cross-Reference to SRS

| Requirement | Description | Implementation |
|------------|-------------|----------------|
| FR-FILE-01 | Upload avatar with face crop | `CloudinaryService.uploadAvatar()` with gravity:"face" |
| FR-FILE-02 | Upload clinic images | `CloudinaryService.uploadClinicImage()` |
| FR-FILE-03 | Upload clinical photos (EMR) | `CloudinaryService.uploadEmrImage()` |
| FR-FILE-04 | Delete old files | `CloudinaryService.deleteFile()` |
| NFR-FILE-01 | Max file size 10MB | Validation in `validateFile()` |
| NFR-FILE-02 | Auto image optimization | Cloudinary transformation `quality:"auto:good"` |

---


### 4.20 AI Tool Booking Orchestration APIs

This section defines a dedicated Spring Boot API group for AI booking tool calls. The goal is to support chat-first booking, reuse the full conversation context, reduce fragile chaining across UI-oriented endpoints, and allow the AI service to prepare a booking draft in a single conversational turn whenever the user already provides enough information.

**Architecture update 2026-03-19**
- AI agent orchestration for booking follows `Semantic ReAct + Thin Validator`.
- Tool selection is driven by prompt meaning, tool description, and JSON schema instead of keyword matching.
- The post-parse validator in the AI service does not rewrite `create -> check_slots` or inject a rigid booking ladder; it only sanitizes parameters and blocks obviously missing required inputs.
- Full conversation context (`transcript`, `latest_message`) is passed into booking tools so domain APIs can resolve pet, clinic, service, date, and time hints without hardcoded agent routing.
- When the conversation already contains a clinic target, clinic resolution must prioritize that clinic and must not silently fall back to the nearest clinic only because GPS is available.
- AI service phai bo sung `deterministic booking context snapshot` truoc khi goi booking tools; snapshot duoc tao tu `latest_message`, `transcript`, runtime datetime, runtime location, va cac gia tri da resolve o turn gan nhat.
- Quy tac `latest explicit fact wins` la bat buoc cho pet, clinic, service, date, time preference, va booking type; gia tri user noi ro o turn moi nhat phai override context cu.
- Runtime current datetime theo mui gio user phai duoc dua vao prompt/context va duoc dung de resolve cac cum thoi gian tu nhien nhu `hom nay`, `ngay mai`, `thu bay nay`, `cuoi tuan nay`.
- Truong hop user da neu clinic cu the hoac dia chi text ro rang phai duoc uu tien resolve truoc; GPS la uu tien cao nhat khi co, nhung khong duoc la dieu kien bat buoc de bat dau moi flow clinic lookup.

#### 4.20.1 API Specification Table

| # | Method | Endpoint | Access | Description | Status |
|---|--------|----------|--------|-------------|--------|
| 1 | POST | /api/ai-tools/booking/context | Internal (AI Service) | Resolve pet, booking type, location, service hints, and missing fields from chat context | Planned |
| 2 | POST | /api/ai-tools/booking/clinic-options | Internal (AI Service) | Return clinics matched by distance, service compatibility, and booking type | Planned |
| 3 | POST | /api/ai-tools/booking/slot-options | Internal (AI Service) | Return exact or recommended slots for a clinic/service/date preference | Planned |
| 4 | POST | /api/ai-tools/booking/draft | Internal (AI Service) | Build booking summary and confirmation payload for chat UI | Planned |
| 5 | POST | /api/ai-tools/booking/create | Internal (AI Service) | Create a pending booking request after user confirmation | Planned |

#### 4.20.2 Class Diagram

`mermaid
classDiagram
    class AiToolBookingController {
        +resolveContext(AiBookingContextRequest) ResponseEntity
        +getClinicOptions(AiClinicOptionsRequest) ResponseEntity
        +getSlotOptions(AiSlotOptionsRequest) ResponseEntity
        +buildDraft(AiBookingDraftRequest) ResponseEntity
        +createBooking(AiCreateBookingRequest) ResponseEntity
    }

    class AiToolBookingService {
        +resolveContext(AiBookingContextRequest) AiBookingContextResponse
        +getClinicOptions(AiClinicOptionsRequest) AiClinicOptionsResponse
        +getSlotOptions(AiSlotOptionsRequest) AiSlotOptionsResponse
        +buildDraft(AiBookingDraftRequest) AiBookingDraftResponse
        +createBooking(AiCreateBookingRequest) AiCreateBookingResponse
    }

    class AiBookingContextResolver {
        +resolvePet(userId, transcript, petHint) ResolvedPet
        +resolveLocation(gps, transcript) ResolvedLocation
        +resolveBookingIntent(transcript, bookingTypeHint, serviceHint, dateHint, timeHint) BookingIntentSnapshot
    }

    class AiBookingDraftAssembler {
        +buildSummary(AiBookingDraftRequest) BookingSummaryCard
        +buildConfirmationPayload(AiBookingDraftRequest) Map
    }

    class BookingService {
        +createBooking(BookingRequest, UUID) BookingResponse
        +getAvailableSlots(UUID, LocalDate, List~UUID~) AvailableSlotsResponse
        +calculateEstimatedCompletion(UUID, EstimatedCompletionRequest) EstimatedCompletionResponse
    }

    class ClinicServiceService {
        +getPublicServicesByClinicId(UUID) List~ClinicServiceResponse~
        +getCompatibleServices(UUID, PetSpecies, Boolean) List~ClinicServiceResponse~
    }

    class PetRepository {
        <<interface>>
    }

    class ClinicRepository {
        <<interface>>
    }

    class BookingRepository {
        <<interface>>
    }

    class BookingSlotRepository {
        <<interface>>
    }

    AiToolBookingController --> AiToolBookingService
    AiToolBookingService --> AiBookingContextResolver
    AiToolBookingService --> AiBookingDraftAssembler
    AiToolBookingService --> BookingService
    AiToolBookingService --> ClinicServiceService
    AiToolBookingService --> PetRepository
    AiToolBookingService --> ClinicRepository
    AiToolBookingService --> BookingRepository
    AiToolBookingService --> BookingSlotRepository
`

#### 4.20.3 Class Specifications

**1. AiToolBookingController**
- **Responsibility:** Expose internal Swagger-documented REST endpoints under /api/ai-tools/booking/* for AI service orchestration only.
- **Key Methods:**
  - 
esolveContext(...): Return resolved booking context and missing fields.
  - getClinicOptions(...): Return candidate clinics already filtered for AI booking.
  - getSlotOptions(...): Return exact or recommended slot candidates.
  - uildDraft(...): Return booking summary payload for in-chat confirmation card.
  - createBooking(...): Create a PENDING booking request after explicit user confirmation.

**2. AiToolBookingService**
- **Responsibility:** Coordinate booking context resolution, clinic/service matching, slot selection, and booking request creation for the AI assistant.
- **Key Methods:**
  - 
esolveContext(...): Merge transcript hints with persisted user, pet, and clinic data.
  - getClinicOptions(...): Build a ranked list of clinics for the current booking intent.
  - getSlotOptions(...): Respect exact date/time when provided, otherwise compute up to three recommended slots.
  - uildDraft(...): Build a natural-language booking summary plus structured confirmation payload.
  - createBooking(...): Convert the AI draft into the existing booking domain request.

**3. AiBookingContextResolver**
- **Responsibility:** Interpret the full recent conversation and normalize booking hints before downstream matching starts.
- **Key Methods:**
  - 
esolvePet(...): Match pet name from transcript against the user's pets.
  - 
esolveLocation(...): Prefer GPS from session context and fall back to transcript-derived address.
  - 
esolveBookingIntent(...): Resolve booking type, service intent, date preference, and time preference.

**4. AiBookingDraftAssembler**
- **Responsibility:** Produce a UI-ready booking summary card and preserve the structured payload used by the final create call.
- **Key Methods:**
  - uildSummary(...): Generate the card content shown in mobile chat.
  - uildConfirmationPayload(...): Persist the normalized booking request fields for final confirmation.

#### 4.20.4 Sequence Diagram: One-Prompt Chat Booking Resolution

`mermaid
sequenceDiagram
    actor PO as Pet Owner
    participant UI as Mobile AI Chat
    participant AG as AI Agent Service
    participant AC as AiToolBookingController
    participant AS as AiToolBookingService
    participant CR as AiBookingContextResolver
    participant CSS as ClinicServiceService
    participant BS as BookingService
    participant DB as Database

    PO->>UI: 1. Send "Dat lich cho Hadine o Ngu Hanh Son sang thu bay nay"
    UI->>AG: 2. WebSocket message with transcript + GPS
    AG->>AC: 3. POST /api/ai-tools/booking/context
    AC->>AS: 4. resolveContext(request)
    AS->>CR: 5. resolvePet + resolveLocation + resolveBookingIntent
    CR->>DB: 6. Load pets and user context
    CR-->>AS: 7. Resolved context + missing fields
    AS-->>AC: 8. AiBookingContextResponse
    AC-->>AG: 9. Context response

    AG->>AC: 10. POST /api/ai-tools/booking/clinic-options
    AC->>AS: 11. getClinicOptions(request)
    AS->>CSS: 12. getCompatibleServices(clinicId, species, isHomeVisit)
    AS->>DB: 13. Load nearby clinics and pricing
    AS-->>AC: 14. Ranked clinic options
    AC-->>AG: 15. Clinic options

    AG->>AC: 16. POST /api/ai-tools/booking/slot-options
    AC->>AS: 17. getSlotOptions(request)
    AS->>BS: 18. getAvailableSlots(clinicId, date, serviceIds)
    BS->>DB: 19. Query open slots
    BS-->>AS: 20. Exact slot or recommended slots
    AS-->>AC: 21. Slot options
    AC-->>AG: 22. Slot options

    AG->>AC: 23. POST /api/ai-tools/booking/draft
    AC->>AS: 24. buildDraft(request)
    AS-->>AC: 25. Booking summary + confirmation payload
    AC-->>AG: 26. Draft response
    AG-->>UI: 27. Render clinic card, slot suggestions, and booking summary card
    UI-->>PO: 28. Show chat-first booking result in one turn
`

#### 4.20.5 Sequence Diagram: Confirm Draft and Create Pending Booking

`mermaid
sequenceDiagram
    actor PO as Pet Owner
    participant UI as Mobile AI Chat
    participant AG as AI Agent Service
    participant AC as AiToolBookingController
    participant AS as AiToolBookingService
    participant BS as BookingService
    participant DB as Database
    actor CM as Clinic Manager

    PO->>UI: 1. Tap "Xac nhan dat lich"
    UI->>AG: 2. Send confirmation action with draft payload
    AG->>AC: 3. POST /api/ai-tools/booking/create
    AC->>AS: 4. createBooking(request)
    AS->>BS: 5. createBooking(bookingRequest, petOwnerId)
    BS->>DB: 6. Save booking with status PENDING
    BS-->>AS: 7. BookingResponse
    AS-->>AC: 8. AiCreateBookingResponse
    AC-->>AG: 9. bookingId + bookingCode + managerWillConfirm=true
    AG-->>UI: 10. Stream natural-language confirmation
    UI-->>PO: 11. Show pending confirmation state
    DB-->>CM: 12. Booking appears in manager queue for final confirmation
`

#### 4.20.6 Cross-Reference to SRS

| Requirement | Description | Implementation Direction |
|------------|-------------|--------------------------|
| 3.11.1 | Chat-first AI booking in mobile assistant | AI service keeps the conversation in chat and uses internal booking APIs |
| 3.11.10 | Dedicated AI Tool Booking APIs | Spring Boot exposes /api/ai-tools/booking/* with Swagger documentation |
| 3.8.1 | Booking creation lifecycle | Final create step reuses BookingService.createBooking(...) and stores PENDING |
| 3.8.5 | Clinic manager confirms bookings | Final appointment confirmation remains in clinic manager workflow |
| BR-42 / BR-43 | AI assistance rules and booking support rules | Full transcript context, minimal follow-up questions, confirmation before create |

---
---

### 4.21 Staff AI Diagnosis in EMR Workspace

Module này bổ sung lớp hỗ trợ AI trực tiếp trong không gian làm việc EMR của `STAFF`, thay vì tách thành một màn hình quản trị AI riêng. Bác sĩ có thể dùng AI ngay trong màn hình tạo bệnh án hoặc mở AI Chat theo kiểu side panel; cả hai cách đều phải tương tác trực tiếp được với EMR đang mở.

#### 4.21.1 UX Direction

- **Primary entry:** Màn hình tạo EMR có panel AI ở cột phải.
- **Secondary entry:** AI Chat của staff mở dưới dạng side panel, dock bên phải khi đang xem booking, patient hoặc EMR.
- **Shared state:** Side panel đọc và cập nhật trực tiếp `soapDraft` của EMR hiện tại.
- **Apply actions:** Có các nút `Chèn vào Subjective`, `Chèn vào Objective`, `Chèn vào Assessment`, `Chèn vào Plan`.
- **Evidence-first:** Mỗi gợi ý phải chỉ ra nguồn `Từ ảnh`, `Từ EMR tương tự`, `Từ kho tri thức`.

#### 4.21.2 Class Diagram

```mermaid
classDiagram
    class CreateEmrPage {
        +renderEmrForm()
        +handleAnalyzeCase()
        +handleApplySuggestion(field, text)
    }

    class StaffAIChatPage {
        +openDiagnosisSidePanel()
        +bindCurrentEmrDraft()
    }

    class AIDiagnosisPanel {
        +collectDoctorInput()
        +submitDiagnosisRequest()
        +renderDiagnosisState()
    }

    class AIDiagnosisSidePanel {
        +openFromChatContext()
        +applyToEmrField(field, text)
        +syncSoapDraft()
    }

    class DiagnosisService {
        +analyzeStaffCase(request)
    }

    class StaffDiagnosisController {
        +analyzeCase(StaffDiagnosisRequest)
    }

    class StaffDiagnosisService {
        +analyzeCase(request)
        +buildGroundedResponse()
        +buildSoapGroundingBundle()
        +buildGroundedSoapSuggestions()
    }

    class GeminiVisionAdapter {
        +analyze(request)
    }

    class DiseaseMappingService {
        +mapRawLabel(text)
    }

    class EmrCaseMemorySyncService {
        +fetchConfirmedEmrs()
        +syncBatch()
    }

    class KnowledgeSearchService {
        +searchClinicalKnowledge(query)
    }

    class CaseMemoryService {
        +searchSimilarCases(query)
        +upsertCase(caseRecord)
    }

    CreateEmrPage --> AIDiagnosisPanel
    StaffAIChatPage --> AIDiagnosisSidePanel
    AIDiagnosisPanel --> DiagnosisService
    AIDiagnosisSidePanel --> DiagnosisService
    DiagnosisService --> StaffDiagnosisController
    StaffDiagnosisController --> StaffDiagnosisService
    StaffDiagnosisService --> GeminiVisionAdapter
    StaffDiagnosisService --> DiseaseMappingService
    StaffDiagnosisService --> KnowledgeSearchService
    StaffDiagnosisService --> CaseMemoryService
    EmrCaseMemorySyncService --> CaseMemoryService
    EmrCaseMemorySyncService --> DiseaseMappingService
```

#### 4.21.3 Class Specifications

> **⚠️ 2026-03-23 Update:** AI Diagnosis flow đã hoàn thành và production-ready:
> - Nguồn dữ liệu: EMR confirmed (Case Memory), Knowledge Base, Knowledge Graph
> - Case Memory: EMR-driven từ confirmed diagnoses
> - Evidence display: `supporting_evidence_from_kb`, `similar_confirmed_cases`
> - Technical documentation: [ai_diagnose_service/](D:/SEP490/petties/docs-references/ai_diagnose_service/)

**1. CreateEmrPage**
- **Responsibility:** Trang staff nhập SOAP notes, ảnh lâm sàng và hiển thị panel AI chẩn đoán ngay cạnh form bệnh án.
- **Key Methods:**
  - `handleAnalyzeCase()`: gom dữ liệu đang có trên form EMR và gọi panel AI.
  - `handleApplySuggestion(field, text)`: chèn bản nháp AI vào field tương ứng của SOAP.

**2. StaffAIChatPage**
- **Responsibility:** Không gian chat tự do với AI cho staff; có thể mở side panel chẩn đoán gắn với ca khám hiện tại.
- **Key Methods:**
  - `openDiagnosisSidePanel()`: mở panel chẩn đoán mà không rời màn chat.
  - `bindCurrentEmrDraft()`: đồng bộ draft bệnh án hiện có vào side panel.

**3. AIDiagnosisPanel / AIDiagnosisSidePanel**
- **Responsibility:** Thành phần giao diện hiển thị trạng thái AI diagnosis, input của bác sĩ và các card kết quả.
- **Key Methods:**
  - `collectDoctorInput()`: gom `doctorDescription`, `bodyPart`, `imageUrls`, `soapDraft`.
  - `submitDiagnosisRequest()`: gửi request sang AI service.
  - `applyToEmrField(field, text)`: cập nhật trực tiếp Subjective, Objective, Assessment hoặc Plan.
  - `renderDiagnosisState()`: hiển thị `idle`, `loading`, `success`, `insufficient_data`, `error`.

**4. DiagnosisService**
- **Responsibility:** API client ở web để gọi endpoint AI diagnosis mới.
- **Key Methods:**
  - `analyzeStaffCase(request)`: POST payload chuẩn hóa sang AI service.

**5. StaffDiagnosisController**
- **Responsibility:** Expose endpoint nội bộ cho luồng chẩn đoán của `STAFF`.
- **Key Methods:**
  - `analyzeCase(request)`: nhận request đã xác thực và chuyển cho service orchestration.

**6. StaffDiagnosisService**
- **Responsibility:** Điều phối toàn bộ pipeline chẩn đoán mới.
- **Key Methods:**
  - `analyzeCase(request)`: chuẩn hóa input, gọi vision nếu có ảnh, query KB và case memory.
  - `_buildSelectedOnlyResponse(requestId, request)`: tái sử dụng cached context khi bác sĩ đã chọn chẩn đoán; ưu tiên `common_prescriptions` từ EMR confirmed và fallback LLM cho `prescription_suggestions` nếu Case Memory chưa có thuốc.
  - `buildSoapGroundingBundle()`: gom bằng chứng theo từng phần SOAP từ request, KB chunks, Case Memory, protocol decision, và vision findings.
  - `buildGroundedSoapSuggestions()`: sinh SOAP draft dựa trên grounding bundle, giữ ràng buộc section-level để tránh hallucination.
  - `buildGroundedResponse()`: tổng hợp kết quả cuối cùng kèm nguồn bằng chứng và disclaimer.

**7. GeminiVisionAdapter**
- **Responsibility:** Gọi Gemini Vision qua provider hiện tại và parse structured output.
- **Key Methods:**
  - `analyze(request)`: trả về `visual_findings` và `top_conditions`.

**8. DiseaseMappingService**
- **Responsibility:** Map chẩn đoán text từ EMR hoặc vision về `canonical_code`.
- **Key Methods:**
  - `mapRawLabel(text)`: chuẩn hóa alias và map sang disease catalog.

**9. EmrCaseMemorySyncService**
- **Responsibility:** Synchronize confirmed EMR records from Spring Boot into Case Memory for future similar-case retrieval.
- **Key Methods:**
  - `sync_record(emr_record)`: receive one confirmed EMR payload pushed directly from Spring Boot and upsert it into Case Memory.
  - `_extract_protocol_pattern(emr_record, mapping_result)`: derive runtime protocol only from real EMR fields such as SOAP, `plan` or `notes`, and final prescriptions.

> **2026-04-02 Update:** The active Case Memory schema is reduced to a runtime-only projection. The service now keeps only the fields actually consumed by retrieval and grounded SOAP synthesis (`text_content`, diagnosis identity, chief complaint, clinical notes, `exam_at`, and runtime protocol pattern fields).

**10. Disease Catalog Persistence**
- **Responsibility:** Lưu canonical disease, alias theo nguồn, và thực thi autonomous canonicalization không cần daily manual review.
- **Key Methods:**
  - `refresh_from_db()`: load snapshot mapping từ PostgreSQL.
  - `map_label()`: map nhãn EMR/vision/KB về `canonical_code`.
  - `resolve_label()`: resolve unmatched labels through exact alias lookup plus autonomous canonicalization.
  - `map_with_llm()`: resolve unmatched labels against existing canonical diseases.
  - `auto_upsert_alias()`: persist learned aliases into `disease_aliases`.
  - `auto_create_canonical()`: create a new `disease_catalog` entry when no safe existing canonical match is found.

> **2026-04-02 Update:** autonomous canonicalization now reuses only `disease_catalog` and `disease_aliases`, without adding new PostgreSQL tables and without requiring daily admin alias maintenance.

#### 4.21.3A Sequence Diagram: Planned Autonomous Canonicalization (Pending Implementation)

```mermaid
sequenceDiagram
    actor Staff as Staff
    participant UI as EMR Screen
    participant Spring as EmrService
    participant Sync as EmrCaseMemorySyncService
    participant Map as DiseaseMappingService
    participant DB as Database

    Staff->>UI: 1. Save confirmed EMR
    UI->>Spring: 2. POST/PUT EMR
    Spring->>DB: 3. Save confirmed EMR
    DB-->>Spring: 4. Persisted EMR
    Spring->>Sync: 5. Push internal confirmed EMR payload
    Sync->>Map: 6. map_label(raw diagnosis)
    alt Existing alias matched
        Map-->>Sync: 7. Existing canonical_code
    else No exact alias match
        Map->>Map: 7. Retrieve nearest canonical candidates
        Map->>Map: 8. Resolve with LLM
        alt Map to existing canonical
            Map->>DB: 9. Insert learned alias into disease_aliases
            DB-->>Map: 10. Alias saved
            Map-->>Sync: 11. Canonical_code from existing disease
        else Create new canonical
            Map->>DB: 9. Insert row into disease_catalog
            DB-->>Map: 10. Canonical saved
            Map->>DB: 11. Insert first alias into disease_aliases
            DB-->>Map: 12. Alias saved
            Map-->>Sync: 13. New canonical_code
        else Keep provisional
            Map-->>Sync: 9. Provisional mapping result
        end
    end
    Sync->>Sync: 14. Build protocol_pattern and Case Memory payload
    Sync-->>Spring: 15. Sync result
```

#### 4.21.4 Sequence Diagram: Staff phân tích ca bệnh từ EMR hoặc side panel chat

```mermaid
sequenceDiagram
    actor Staff
    participant EMR as CreateEmrPage
    participant Chat as StaffAIChatPage
    participant Panel as AIDiagnosisPanel
    participant Side as AIDiagnosisSidePanel
    participant AIAPI as StaffDiagnosisController
    participant Orchestrator as StaffDiagnosisService
    participant Vision as GeminiVisionAdapter
    participant KB as KnowledgeSearchService
    participant CM as CaseMemoryService
    participant Map as DiseaseMappingService
    participant DB as Database

    alt Staff đang ở màn hình EMR
        Staff->>EMR: Nhập SOAP notes, mô tả lâm sàng, tải ảnh
        Staff->>Panel: Bấm "Phân tích ca bệnh"
        Panel->>AIAPI: POST StaffDiagnosisRequest
    else Staff đang ở màn hình chat
        Staff->>Chat: Mở side panel chẩn đoán
        Chat->>Side: Bind SOAP draft hiện tại
        Staff->>Side: Nhập thêm mô tả hoặc chọn ảnh
        Side->>AIAPI: POST StaffDiagnosisRequest
    end
    AIAPI->>Orchestrator: analyzeCase(request)
    alt Có ảnh lâm sàng
        Orchestrator->>Vision: analyze(imageUrls, doctorDescription, species, bodyPart)
        Vision-->>Orchestrator: visualFindings, topConditions
    end
    Orchestrator->>KB: searchClinicalKnowledge(query)
    KB->>DB: Query knowledge chunks and graph facts
    DB-->>KB: Retrieved knowledge evidence
    KB-->>Orchestrator: knowledgeSummary
    Orchestrator->>CM: searchSimilarCases(query)
    CM->>DB: Search similar confirmed EMR vectors
    DB-->>CM: matched case payloads
    CM-->>Orchestrator: matchedCases
    Orchestrator->>Map: mapRawLabel(...)
    Map-->>Orchestrator: canonicalCodes
    Orchestrator->>Orchestrator: Build section-level grounding bundle for S/O/A/P
    Orchestrator-->>AIAPI: grounded diagnosis response
    AIAPI-->>Panel: topDifferentials, evidence, soapSuggestions
    AIAPI-->>Side: topDifferentials, evidence, soapSuggestions
    Staff->>Panel: Chọn "Chèn vào Assessment"
    Staff->>Side: Hoặc chọn "Chèn vào Plan"
    Panel->>EMR: Cập nhật form bệnh án
    Side->>EMR: Cập nhật form bệnh án qua shared state
```

#### 4.21.5 Sequence Diagram: Confirmed EMR Sync into Case Memory

```mermaid
sequenceDiagram
    participant Spring as EmrService / AiCaseMemorySyncService
    participant Route as Internal Case Memory Route
    participant Sync as EmrCaseMemorySyncService
    participant Map as DiseaseMappingService
    participant CaseMemory as CaseMemoryService
    participant DB as Database

    Spring->>DB: Save EMR confirmed
    DB-->>Spring: Persisted EMR
    Spring->>Route: POST /api/v1/internal/case-memory/emr-sync
    Route->>Sync: sync_record(emr_payload)
    Sync->>Map: mapRawLabel(finalDiagnosisText)
    Map-->>Sync: canonicalCode
    Sync->>Sync: extract protocol_pattern from SOAP, plan/notes, and prescriptions
    Sync->>CaseMemory: upsertCase(normalizedCase)
    CaseMemory->>DB: Upsert payload + text/image vectors
    DB-->>CaseMemory: success
    CaseMemory-->>Sync: success
    Sync-->>Route: success
    Route-->>Spring: success
```

#### 4.21.6 Sequence Diagram: Full Flow from AI Diagnosis to Case Memory Persistence

```mermaid
sequenceDiagram
    actor Staff
    participant UI as EMR Workspace
    participant AIAPI as StaffDiagnosisController
    participant Service as StaffDiagnosisService
    participant Vision as GeminiVisionAdapter
    participant KB as HybridRAGEngine
    participant CM as CaseMemoryService
    participant Spring as EmrController
    participant Route as Internal Case Memory Route
    participant Sync as EmrCaseMemorySyncService
    participant DB as Database

    Staff->>UI: Enter SOAP, clinical narrative, weight, allergy context, and images
    Staff->>UI: Run AI diagnosis
    UI->>AIAPI: POST /api/v1/staff-diagnosis/analyze
    AIAPI->>Service: analyzeCase(request)
    alt Clinical images are available
        Service->>Vision: analyze(imageUrls, doctorDescription, species)
        Vision-->>Service: visualFindings, topConditions, imageDescriptions
    end
    Service->>KB: query(query, RAG + KG)
    KB->>DB: Query knowledge chunks and graph facts
    DB-->>KB: Knowledge evidence
    KB-->>Service: HybridResult
    Service->>CM: searchSimilarCases(query, imageUrls)
    CM->>DB: Search similar confirmed EMR vectors
    DB-->>CM: matched case payloads
    CM-->>Service: matchedCases
    Service->>Service: Build SOAP grounding bundle from request + KB + Case Memory + protocol
    Service-->>AIAPI: grounded diagnosis response
    AIAPI-->>UI: topDifferentials, evidence, SOAP, and prescription protocol
    Staff->>UI: Accept or manually edit SOAP and prescriptions
    Staff->>UI: Save EMR
    UI->>Spring: POST/PUT EMR
    Spring->>DB: Save EMR record
    DB-->>Spring: Saved EMR
    Spring->>Route: POST /api/v1/internal/case-memory/emr-sync
    Route->>Sync: sync_record(emr_payload)
    Sync->>Sync: map final diagnosis and build protocol_pattern
    Sync->>CM: upsertCase(normalizedCase)
    CM->>DB: Upsert payload + text/image vectors
    DB-->>CM: success
    CM-->>Sync: success
    Sync-->>Route: success or error
    Route-->>Spring: success or error
    Spring-->>UI: EMR saved
```

#### 4.21.7 Sequence Diagram: Selected diagnosis fallback prescription trong EMR

```mermaid
sequenceDiagram
    actor Staff as Staff
    participant UI as CreateEmrPage
    participant Panel as AIDiagnosisPanel
    participant C as StaffDiagnosisController
    participant S as StaffDiagnosisService
    participant KB as KnowledgeSearchService
    participant CM as CaseMemoryService
    participant DB as Database

    Staff->>UI: 1. Chọn một chẩn đoán trong Top 3
    UI->>Panel: 2. Gửi selectedDiagnosisCode và previousRequestId
    Panel->>C: 3. POST analyze (synthesis_mode=selected_only)
    C->>S: 4. analyzeCase(request)
    S->>S: 5. Load cached context theo previousRequestId
    S->>S: 6. Build protocol decision theo chẩn đoán đã chọn
    alt Case Memory đã có common_prescriptions hợp lệ
        S-->>C: 7. Trả SOAP + prescription_suggestions từ EMR confirmed pattern
    else Case Memory chưa có common_prescriptions hợp lệ
        S->>KB: 7. Reuse evidence đã có trong context
        S->>CM: 8. Reuse matched confirmed EMR cases
        S->>S: 9. Gọi LLM synthesis chỉ để fallback đơn thuốc
        S-->>C: 10. Trả SOAP + prescription_suggestions từ AI fallback + disclaimer
    end
    C-->>Panel: 11. Selected diagnosis response
    Panel-->>UI: 12. Hiển thị plan và đơn thuốc nháp để staff nhận hoặc chỉnh tay
```

#### 4.21.8 Design Notes: Continuous data-driven diagnosis

- AI Diagnose must support both image and non-image clinical cases; image analysis is optional enrichment, not a required gate.
- Medication suggests remain source-restricted: `emr_pattern` first, `llm_fallback` only when EMR patterns are unavailable.
- `DiagnosisProtocolService` serves as safety/orchestration validation layer with generic safety checks only (weight, allergy). All disease-specific hardcoded rules have been removed (2026-04-01).
- LLM synthesis may generate `safety_suggestions` for wording flexibility, but final safety outputs must pass deterministic sanitization before returning to UI.
- As confirmed EMR data grows, retrieval quality and suggestion quality are expected to improve through data updates, not through source-code drug templates.
- Quality gate is passively computed by system during confirmed EMR sync using AI suggestion context versus final EMR prescriptions; no additional doctor interaction is required.

#### 4.21.7 Swimlane Diagram: Full workflow

```mermaid
flowchart LR
    subgraph Lane1["STAFF"]
        S1["Nhập SOAP, mô tả lâm sàng, cân nặng, dị ứng, ảnh"]
        S2["Xem gợi ý AI"]
        S3["Chấp nhận hoặc chỉnh tay SOAP và đơn thuốc"]
        S4["Lưu EMR"]
    end

    subgraph Lane2["Web EMR/UI"]
        U1["Gửi StaffDiagnosisRequest"]
        U2["Hiển thị differential, evidence, SOAP, đơn thuốc"]
        U3["Gửi yêu cầu lưu EMR"]
    end

    subgraph Lane3["AI Service"]
        A1["StaffDiagnosisService nhận request"]
        A2["Gọi Gemini Vision nếu có ảnh"]
        A3["Query HybridRAGEngine (RAG + KG)"]
        A4["Query CaseMemoryService"]
        A5["Map canonical disease + áp protocol"]
        A6["Trả diagnosis response"]
        A7["EmrCaseMemorySyncService nhận batch EMR confirmed"]
        A8["Map final diagnosis + upsert case memory"]
    end

    subgraph Lane4["Spring Boot"]
        B1["Lưu EMR đã được bác sĩ xác nhận"]
        B2["Expose internal batch EMR confirmed"]
    end

    subgraph Lane5["Database"]
        D1["Knowledge Base / KG / Case Memory retrieval"]
        D2["Lưu EMR record"]
        D3["Lưu vector case memory mới"]
    end

    S1 --> U1
    U1 --> A1
    A1 --> A2
    A2 --> A3
    A3 --> D1
    D1 --> A3
    A3 --> A4
    A4 --> D1
    D1 --> A4
    A4 --> A5
    A5 --> A6
    A6 --> U2
    U2 --> S2
    S2 --> S3
    S3 --> S4
    S4 --> U3
    U3 --> B1
    B1 --> D2
    D2 --> B1
    B1 --> B2
    B2 --> A7
    A7 --> A8
    A8 --> D3
```

#### 4.21.7.1 Swimlane Diagram: Full workflow (UTF-8 clean)

```mermaid
flowchart LR
    subgraph Lane1["STAFF"]
        S1["Nhập SOAP, mô tả lâm sàng, cân nặng, dị ứng, ảnh"]
        S2["Xem gợi ý AI"]
        S3["Chấp nhận hoặc chỉnh tay SOAP và đơn thuốc"]
        S4["Lưu EMR"]
    end

    subgraph Lane2["Web EMR/UI"]
        U1["Gửi StaffDiagnosisRequest"]
        U2["Hiển thị differential, evidence, SOAP, đơn thuốc"]
        U3["Gửi yêu cầu lưu EMR"]
    end

    subgraph Lane3["AI Service"]
        A1["StaffDiagnosisService nhận request"]
        A2["Gọi Gemini Vision nếu có ảnh"]
        A3["Query HybridRAGEngine (RAG + KG)"]
        A4["Query CaseMemoryService"]
        A5["Map canonical disease + áp protocol"]
        A6["Trả diagnosis response"]
        A7["EmrCaseMemorySyncService nhận batch EMR confirmed"]
        A8["Map final diagnosis + upsert case memory"]
    end

    subgraph Lane4["Spring Boot"]
        B1["Lưu EMR đã được bác sĩ xác nhận"]
        B2["Expose internal batch EMR confirmed"]
    end

    subgraph Lane5["Database"]
        D1["Knowledge Base / KG / Case Memory retrieval"]
        D2["Lưu EMR record"]
        D3["Lưu vector case memory mới"]
    end

    S1 --> U1
    U1 --> A1
    A1 --> A2
    A2 --> A3
    A3 --> D1
    D1 --> A3
    A3 --> A4
    A4 --> D1
    D1 --> A4
    A4 --> A5
    A5 --> A6
    A6 --> U2
    U2 --> S2
    S2 --> S3
    S3 --> S4
    S4 --> U3
    U3 --> B1
    B1 --> D2
    D2 --> B1
    B1 --> B2
    B2 --> A7
    A7 --> A8
    A8 --> D3
```

#### 4.21.7.2 Auto-sync semantics

- `case_id` trong Case Memory dùng quy ước `emr:{emr_id}`.
- AI service có background worker tự polling EMR confirmed thay đổi theo `updated_from` / `updated_to`.
- Spring Boot expose feed `GET /api/internal/ai/emrs/confirmed` để AI service lấy batch EMR đã lưu bởi bác sĩ.
- Auth service-to-service ưu tiên `X-Internal-AI-Key`; nếu chưa có thì AI service mới fallback sang Bearer token/service account.
- Khi EMR confirmed đã từng sync và được cập nhật, sync lần sau sẽ overwrite cùng `case_id`.
- Nếu diagnosis map được `disease_catalog`, payload lưu `mapping_status = mapped`.
- Nếu diagnosis chưa map được catalog, payload vẫn được ingest với:
  - `mapping_status = provisional`
  - `provisional_label = final_diagnosis_text`
- Nếu confidence của autonomous canonicalization vẫn thấp, payload có thể tiếp tục với `mapping_status = provisional` mà không phụ thuộc vào review queue runtime.

#### 4.21.8 Cross-Reference to SRS

- SRS section: `3.11.11 Hỗ trợ AI chẩn đoán trong không gian làm việc EMR (UC-STAFF-11)`
- Related modules:
  - `petties-web/src/pages/staff/emr/CreateEmrPage.tsx`
  - `petties-web/src/pages/staff/StaffAIChatPage.tsx`
  - `petties-web/src/components/emr/InlineSuggestion.tsx`
  - `petties-agent-serivce/app/api/schemas/diagnosis_contracts.py`
  - `petties-agent-serivce/app/core/services/emr_case_memory_sync_service.py`
  - `petties-agent-serivce/app/core/vision/gemini_vision_adapter.py`

---

### 4.22 AI Health Summary for Pet Owner

#### 4.22.1 Overview

Feature này cho phép Pet Owner xem nhanh thông tin sức khỏe của thú cưng ngay trên Pet Detail page mà không cần hỏi chatbot. AI sẽ tự động tổng hợp:
- Thông tin pet cơ bản
- EMR gần nhất (chẩn đoán, điều trị)
- Cảnh báo mức độ nghiêm trọng
- Gợi ý hành động

#### 4.22.2 Class Diagram

```mermaid
classDiagram
    class PetDetailScreen {
        +petId: string
        +loadHealthSummary()
        +renderHealthSummaryCard()
    }

    class HealthSummaryCard {
        +petInfo: PetInfo
        +latestEmr: EmrSummary
        +warnings: HealthWarning[]
        +suggestedActions: Action[]
        +onAskAI()
        +onViewDetail()
        +onBookAppointment()
    }

    class PetHealthSummaryService {
        +getPetHealthSummary(petId, userId)
    }

    class GetPetHealthSummaryTool {
        +name: "get_pet_health_summary"
        +execute(petId, userId)
    }

    class EMRService {
        +getLatestEmr(petId)
    }

    PetDetailScreen --> HealthSummaryCard
    HealthSummaryCard --> PetHealthSummaryService
    PetHealthSummaryService --> GetPetHealthSummaryTool
    PetHealthSummaryService --> EMRService
```

### 4.23 Staff AI Chat Panel

Module này mô tả chat panel thường dùng cho `STAFF` trên web. Mục tiêu là cho phép staff hỏi đáp nghiệp vụ hằng ngày bằng dữ liệu nội bộ của phòng khám, đồng thời tự nhận context bệnh nhân đang mở nếu panel được bật từ màn Create EMR.

#### 4.23.1 Design Direction

- **Primary use case:** Hỏi nhanh danh sách bệnh nhân, tóm tắt hồ sơ, lịch sử EMR và thông tin lâm sàng liên quan.
- **Context-aware:** Khi đang ở Create EMR, panel tự đồng bộ `petId`, `bookingId`, SOAP draft và ảnh hiện tại.
- **Transparent execution:** WebSocket stream hiển thị `thinking`, `tool_call`, `tool_result` dưới dạng tóm tắt an toàn cho staff.
- **Grounded response:** Agent ưu tiên tool nội bộ và knowledge base nội bộ; không dùng `web_search` cho câu hỏi chẩn đoán dành cho staff.

#### 4.23.2 Class Diagram

```mermaid
classDiagram
    class ChatSidebar {
        +createNewSession()
        +selectSession(sessionId)
        +handleSendMessage(message, images)
        +renderTraceCards()
    }

    class AIChatStore {
        +sessionId
        +messages
        +reactTraceByMessage
        +emrDraft
        +setEmrDraft(draft)
        +updateLastMessage(content)
        +appendReactStep(messageId, step)
    }

    class CreateEmrPage {
        +syncEmrDraftToChatStore()
        +openAiChatSidepanel()
    }

    class StaffChatAgent {
        +run(messages, context)
    }

    class ContextPolicyService {
        +getAllowedTools(role, context)
        +buildSystemPrompt(...)
    }

    class MedicalTools {
        +get_staff_patients(query_name, limit)
        +get_patient_summary(pet_id)
        +get_emr_history(pet_id, limit)
    }

    class SpringBackendClient {
        +get_staff_patients(token, clinic_id, staff_id)
        +get_pet(token, pet_id)
        +get_pet_emr_history(token, pet_id)
    }

    class PetController {
        +getStaffPatients(clinicId, staffId)
        +getPet(id)
    }

    class EmrController {
        +getEmrsByPetId(petId)
    }

    CreateEmrPage --> AIChatStore
    ChatSidebar --> AIChatStore
    ChatSidebar --> StaffChatAgent
    StaffChatAgent --> ContextPolicyService
    StaffChatAgent --> MedicalTools
    MedicalTools --> SpringBackendClient
    SpringBackendClient --> PetController
    SpringBackendClient --> EmrController
```

#### 4.23.3 Class Specifications

**1. `ChatSidebar`**
- **Responsibility:** Render side panel chat cho staff, quản lý WebSocket session, hiển thị trace `thinking/tool/result`.
- **Key Methods:** `createNewSession()`, `selectSession()`, `handleSendMessage()`, `renderTraceCards()`.

**2. `AIChatStore`**
- **Responsibility:** Lưu session hiện tại, message list, trace theo message và `emrDraft` nếu chat được mở từ Create EMR.
- **Key Methods:** `setEmrDraft()`, `updateLastMessage()`, `appendReactStep()`, `clearMessages()`.

**3. `CreateEmrPage`**
- **Responsibility:** Đồng bộ context bệnh án hiện tại sang chat store để AI không phải hỏi lại dữ liệu đã có.
- **Key Methods:** `syncEmrDraftToChatStore()`, `openAiChatSidepanel()`.

**4. `StaffChatAgent`**
- **Responsibility:** Xử lý hội thoại BUSINESS_CHAT cho role `STAFF`, quyết định khi nào dùng tool hồ sơ nội bộ hoặc knowledge base.
- **Key Methods:** `run(messages, context)`.

**5. `ContextPolicyService`**
- **Responsibility:** Whitelist tool theo role/context; cho `STAFF` bật các tool `get_staff_patients`, `get_patient_summary`, `get_emr_history`.
- **Key Methods:** `getAllowedTools()`, `buildSystemPrompt()`.

**6. `MedicalTools`**
- **Responsibility:** Đóng gói các tool MCP để tra cứu bệnh nhân và EMR thật từ Spring Boot.
- **Key Methods:** `get_staff_patients()`, `get_patient_summary()`, `get_emr_history()`.

**7. `SpringBackendClient`**
- **Responsibility:** Gọi REST API từ AI service sang Spring Boot với JWT hiện tại để lấy dữ liệu đúng quyền.
- **Key Methods:** `get_staff_patients()`, `get_pet()`, `get_pet_emr_history()`.

**8. `PetController` / `EmrController`**
- **Responsibility:** Expose dữ liệu bệnh nhân và EMR cho AI tools dùng lại qua backend client.

#### 4.23.4 Sequence Diagram: Staff hỏi đáp hồ sơ bệnh nhân trong chat panel

```mermaid
sequenceDiagram
    actor Staff
    participant UI as ChatSidebar
    participant Store as AIChatStore
    participant WS as WebSocket Chat
    participant Agent as StaffChatAgent
    participant Policy as ContextPolicyService
    participant Tool as MedicalTools
    participant Backend as SpringBackendClient
    participant PetAPI as PetController
    participant EmrAPI as EmrController

    Staff->>UI: Mở chat panel từ Create EMR
    UI->>Store: setEmrDraft(petId, bookingId, soapDraft, images)
    Staff->>UI: "Tóm tắt lịch sử EMR của bé này"
    UI->>WS: send(message, sessionId, context)
    WS->>Agent: run(BUSINESS_CHAT, role=STAFF)
    Agent->>Policy: getAllowedTools(STAFF, BUSINESS_CHAT)
    Policy-->>Agent: get_patient_summary, get_emr_history, ...
    Agent-->>UI: thinking
    Agent->>Tool: get_patient_summary(pet_id from context)
    Tool->>Backend: get_pet(token, pet_id)
    Backend->>PetAPI: GET /pets/{id}
    PetAPI-->>Backend: pet info
    Tool->>Backend: get_pet_emr_history(token, pet_id)
    Backend->>EmrAPI: GET /emr/pet/{petId}
    EmrAPI-->>Backend: emr list
    Backend-->>Tool: combined data
    Tool-->>Agent: patient summary payload
    Agent-->>UI: tool_call
    Agent-->>UI: tool_result
    Agent-->>UI: final answer with react_trace
    UI-->>Staff: Hiển thị tóm tắt hồ sơ + trace
```

#### 4.23.5 Sequence Diagram: Sidebar chat hoạt động như chat thường khi không có EMR context

```mermaid
sequenceDiagram
    actor Staff
    participant UI as ChatSidebar
    participant WS as WebSocket Chat
    participant Agent as StaffChatAgent
    participant Tool as MedicalTools

    Staff->>UI: Mở chat panel ở trang Staff Patients
    Staff->>UI: "Tìm bệnh nhân tên Rocky"
    UI->>WS: send(message)
    Agent-->>UI: thinking
    Agent->>Tool: get_staff_patients(query_name="Rocky")
    Tool-->>Agent: matched patients
    Agent-->>UI: tool_call
    Agent-->>UI: tool_result
    Agent-->>UI: final answer
```

#### 4.23.6 Cross-Reference to SRS

- SRS section: `3.11.13 Staff AI Chat Panel cho hỏi đáp nghiệp vụ và hồ sơ bệnh nhân (UC-STAFF-12)`
- Related section: `3.11.11 Hỗ trợ AI chẩn đoán trong không gian làm việc EMR (UC-STAFF-11)`

#### 4.22.3 API Contracts

**Request:**
```
GET /api/v1/pets/{petId}/health-summary
Authorization: Bearer {PET_OWNER_JWT}
```

**Response:**
```json
{
  "pet_info": {
    "pet_id": "pet-123",
    "name": "Max",
    "species": "DOG",
    "breed": "Golden Retriever",
    "age_months": 36,
    "weight_kg": 25.0
  },
  "latest_emr": {
    "exam_date": "2026-03-15",
    "clinic_name": "Phòng khám ABC",
    "diagnosis": "Viêm da dị ứng",
    "treatment": "Thuốc kháng histamine + kem dưỡng ẩm",
    "next_revisit": "2026-04-14"
  },
  "health_warnings": [
    {
      "type": "RECHECK_REQUIRED",
      "message": "Cần tái khám sau 30 ngày",
      "severity": "MEDIUM"
    }
  ],
  "medication_reminders": [
    {
      "medication": "Thuốc kháng histamine",
      "dosage": "1 viên/ngày",
      "end_date": "2026-03-30"
    }
  ],
  "suggested_actions": [
    {
      "type": "BOOK_APPOINTMENT",
      "label": "Đặt lịch tái khám",
      "reason": "Đã 30 ngày kể từ lần khám gần nhất"
    }
  ],
  "disclaimer": "Thông tin chỉ mang tính tham khảo. Vui lòng consult bác sĩ để được tư vấn chính xác."
}
```

#### 4.22.4 Sequence Diagram: Pet Owner xem Health Summary

```mermaid
sequenceDiagram
    participant PO as Pet Owner
    participant Mobile as PetDetailScreen
    participant API as Backend API
    participant AI as AI Service
    participant EMR as EMR Service

    PO->>Mobile: Mở Pet Detail
    Mobile->>API: GET /pets/{petId}/health-summary
    API->>EMR: getLatestEmr(petId)
    EMR-->>API: latestEmr
    
    API->>AI: synthesizeHealthSummary(petId, latestEmr)
    AI-->>API: healthSummary with warnings
    
    API-->>Mobile: healthSummary JSON
    Mobile->>Mobile: render HealthSummaryCard
    
    alt User clicks "Hỏi AI"
        Mobile->>Mobile: openChatWithPetContext
    end
    
    alt User clicks "Đặt lịch"
        Mobile->>Mobile: navigateToBooking(petId)
    end
```

#### 4.22.5 Implementation Notes

| Component | File | Notes |
|-----------|------|-------|
| AI Tool | `medical_tools.py` | New tool `get_pet_health_summary` |
| Backend | `PetController.java` | New endpoint `/pets/{id}/health-summary` |
| Mobile UI | `pet_detail_screen.dart` | Add HealthSummaryCard |
| Web UI | Optional | For future web access |

#### 4.22.6 Cross-Reference to SRS

- SRS section: `3.11.12 AI Health Summary cho Pet Owner (UC-PO-EMR-01)`
- Related modules:
  - `petties_mobile/lib/ui/pet/pet_detail_screen.dart`
  - `petties-agent-serivce/app/core/tools/mcp_tools/medical_tools.py`
  - `backend-spring/petties/src/main/java/com/petties/petties/controller/PetController.java`

### 4.24 Historical Resolution Note for Confirmed EMR Sync

This section records the architecture decision that resolved earlier documentation drift.

Since 2026-03-19, the deployed confirmed EMR sync path is direct push from Spring Boot to the AI service.

The canonical active sequences are now documented in:

- `4.21.5 Sequence Diagram: Confirmed EMR Sync into Case Memory`
- `4.21.6 Sequence Diagram: Full Flow from AI Diagnosis to Case Memory Persistence`

Historical conclusions:

- Polling workers are not part of the deployed sync design.
- Batch or cursor-based pull feeds are not part of the deployed sync design.
- If the AI service fails during sync, Spring Boot logs a warning and must not roll back the already-saved EMR.
- `case_id` remains `emr:{emr_id}` for overwrite-safe updates.
- Legacy documents that still mention `GET /internal/ai/emrs/confirmed` or auto-sync polling should be treated as historical only.

