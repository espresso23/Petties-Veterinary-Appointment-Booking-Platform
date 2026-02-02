# II. Software Design Document

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
    - [4.1 Authentication & Onboarding](#41-authentication--onboarding)
    - [4.2 User Profile & Account Setup](#42-user-profile--account-setup)
    - [4.3 Pet Records & Health Hub](#43-pet-records--health-hub)
    - [4.4 Clinic Discovery Flow](#44-clinic-discovery-flow)
    - [4.5 Clinical Operations & Service Setup](#45-clinical-operations--service-setup)
    - [4.6 Staffing & Scheduling](#46-staffing--scheduling)
    - [4.7 Booking & Appointment Lifecycle](#47-booking--appointment-lifecycle)
    - [4.8 Electronic Medical Records (EMR)](#48-electronic-medical-records-emr)
    - [4.9 SOS Emergency Flow](#49-sos-emergency-flow)
    - [4.10 AI Assistance Flow](#410-ai-assistance-flow)
    - [4.11 Governance & Reporting Flow](#411-governance--reporting-flow)
- [5. Technology Stack Summary](#5-technology-stack-summary)

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
| 18 | db/postgres/models | **ORM Model Layer** - SQLAlchemy ORM models defining entities (Agent, Tool, ChatSession, ChatMessage, KnowledgeDocument, SystemSetting). Maps Python classes to PostgreSQL tables. |
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
    participant C as VetShiftController
    participant S as VetShiftService
    participant R as VetShiftRepository
    participant DB as Database

    CM->>UI: 1. Select the vet shift to delete
    UI->>C: 2. DELETE /api/v1/vet-shifts/{id}
    activate C
    C->>S: 3. deleteVetShift(id)
    activate S
    S->>R: 4. findById(id)
    activate R
    R->>DB: 5. Find vet shift record by ID
    
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
        DB-->>R: 6. Return vet shift record
        deactivate R
        R-->>S: 7. VetShift Entity
        S->>R: 8. softDelete(vetShift)
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
| **PostgreSQL 16** (Backend) | Relational (RDBMS) | Structured data with strict relationships | 17 tables |
| **PostgreSQL 16** (AI Service) | Relational (RDBMS) | Agent configuration, chat history, RAG | 7 tables |
| **MongoDB 7** | Document (NoSQL) | Flexible, nested, schema-less data | 4 collections |

---

### 2.1 Relational Database Design (PostgreSQL)

PostgreSQL is used as the primary relational database for both Spring Boot Backend and AI Agent Service, providing foreign keys, ACID transactions, and complex queries.

> **Database Architecture:**
> - **Shared PostgreSQL Instance**: Both services connect to the same PostgreSQL server
> - **Separate Schemas (optional)**: AI Service tables can use `ai_` prefix for logical separation
> - **Total Tables**: 24 tables (17 Backend + 7 AI Service)

#### 2.1.1 Entity Relationship Diagram (Conceptual)

> **Lưu ý:** ERD ở mức Conceptual tập trung vào **dữ liệu** và **quan hệ** giữa các đối tượng trong hệ thống, không đi sâu vào chi tiết database design (columns, types, constraints).

##### A. Core Business Entities (Dữ liệu cốt lõi)

| Entity | Description | Key Relationships |
|--------|-------------|-------------------|
| **User** | Người dùng hệ thống (Pet Owner, Staff, Manager, Owner, Admin) | 1 User → N Pets (owns), 1 User → 1 Clinic (works_at) |
| **Pet** | Thú cưng được đăng ký trong hệ thống | 1 Pet → 1 Owner, 1 Pet → N EMRs, 1 Pet → N Vaccinations |
| **Clinic** | Phòng khám thú y đã đăng ký và được duyệt | 1 Clinic → N Services, N Staff, N Bookings |
| **ClinicService** | Dịch vụ do phòng khám cung cấp | 1 Service → 1 Clinic, N Weight Prices |
| **Booking** | Lịch hẹn khám/dịch vụ | 1 Booking → 1 Pet, 1 Clinic, N Services, 1 Assigned Staff |
| **EMRRecord** | Hồ sơ bệnh án điện tử (MongoDB) | 1 EMR → 1 Pet, 1 Staff, 1 Booking (optional) |
| **Vaccination** | Sổ tiêm chủng (MongoDB) | 1 Vaccination → 1 Pet, 1 Staff |
| **StaffShift** | Lịch làm việc của nhân viên | 1 Shift → 1 Staff, 1 Clinic, N Slots |
| **Slot** | Khung giờ khám (30 phút) | 1 Slot → 1 Shift, N Bookings |
| **Agent** | AI Agent configuration | 1 Agent → N Tools, N PromptVersions, N ChatSessions |
| **Tool** | MCP Tools cho AI Agent | N Tools → M Agents (many-to-many) |
| **ChatSession** | Phiên chat với AI | 1 Session → 1 User, N Messages |
| **KnowledgeDocument** | Tài liệu RAG Knowledge Base | Standalone |

##### B. Entity Relationships Diagram (ERD)

```mermaid
erDiagram
    USER ||--o{ PET : owns
    USER ||--o{ BOOKING : creates
    USER }o--|| CLINIC : works_at
    USER ||--o{ STAFF_SHIFT : has
    USER ||--o{ CHAT_SESSION : has

    PET ||--o{ BOOKING : scheduled_for
    PET ||--o{ EMR_RECORD : has
    PET ||--o{ VACCINATION : receives

    CLINIC ||--o{ CLINIC_SERVICE : offers
    CLINIC ||--o{ STAFF_SHIFT : schedules
    CLINIC ||--o{ BOOKING : receives
    CLINIC ||--o{ MASTER_SERVICE : owns

    CLINIC_SERVICE ||--o{ SERVICE_WEIGHT_PRICE : has
    CLINIC_SERVICE }o--|| MASTER_SERVICE : inherits_from

    BOOKING ||--o{ BOOKING_SERVICE_ITEM : contains
    BOOKING }o--|| USER : assigned_to
    BOOKING ||--o{ BOOKING_SLOT : occupies

    EMR_RECORD }o--|| BOOKING : linked_to
    EMR_RECORD }o--|| USER : created_by

    VACCINATION }o--|| USER : administered_by

    STAFF_SHIFT }o--|| USER : belongs_to
    STAFF_SHIFT ||--o{ SLOT : generates

    SLOT ||--o{ BOOKING_SLOT : reserved_by

    USER ||--o{ NOTIFICATION : receives

    AGENT ||--o{ PROMPT_VERSION : has
    AGENT ||--o{ CHAT_SESSION : handles
    AGENT }o--o{ TOOL : uses

    CHAT_SESSION ||--o{ CHAT_MESSAGE : contains
```

##### C. Entity Groups by Domain

| Domain | Entities | Purpose |
|--------|----------|---------|
| **User Management** | User, RefreshToken, BlacklistedToken | Người dùng, xác thực, phân quyền |
| **Pet Health** | Pet, EMRRecord (MongoDB), Vaccination (MongoDB) | Thông tin thú cưng, hồ sơ sức khỏe |
| **Clinic Operations** | Clinic, ClinicImage, ClinicPricePerKm | Phòng khám, hình ảnh, cấu hình khoảng cách |
| **Services & Pricing** | MasterService, ClinicService, ServiceWeightPrice | Dịch vụ, bảng giá theo cân nặng |
| **Scheduling** | StaffShift, Slot | Lịch làm việc nhân viên, khung giờ |
| **Booking** | Booking, BookingServiceItem, BookingSlot, Payment | Đặt lịch, chi tiết dịch vụ, thanh toán |
| **Notifications** | Notification | Thông báo hệ thống |
| **AI Service** | Agent, Tool, PromptVersion, ChatSession, ChatMessage, KnowledgeDocument, SystemSetting | AI chatbot, RAG, cấu hình |

##### D. Detailed ERD (Database Design)

> **Note:** ERD chi tiết (với columns, types, constraints) được generate từ [dbdiagram.io](https://dbdiagram.io/).
> DBML source code: [`docs-references/database/PETTIES_DBML.dbml`](../../database/PETTIES_DBML.dbml)

**Instructions to generate Detailed ERD:**
1. Visit https://dbdiagram.io/
2. Copy content from `PETTIES_DBML.dbml`
3. Paste into editor
4. Export PNG/PDF

```
[Detailed ERD Diagram - Paste screenshot from dbdiagram.io here]
```

#### 2.1.2 Table Groups

##### Spring Boot Backend Tables (17 tables)

| Group | Tables | Description |
|-------|--------|-------------|
| **Auth & User** | users, refresh_tokens, blacklisted_tokens | User management and authentication |
| **Pet** | pets | Pet profiles |
| **Clinic** | clinics, clinic_images, clinic_price_per_km | Clinic management |
| **Services** | master_services, clinic_services, service_weight_prices | Services and pricing |
| **Scheduling** | vet_shifts, slots | Staff work schedules |
| **Booking** | bookings, booking_service_items, booking_slots, payments | Appointments and payments |
| **Notification** | notifications | System notifications |

##### AI Agent Service Tables (7 tables)

| Group | Tables | Description |
|-------|--------|-------------|
| **Agent Config** | agents, tools, prompt_versions | Single Agent and Tools configuration |
| **Chat History** | chat_sessions, chat_messages | AI chat history |
| **Knowledge Base** | knowledge_documents | RAG documents |
| **Settings** | system_settings | API keys, LLM configs |

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
| specialty | ENUM | | VET_GENERAL, VET_SURGERY, VET_DENTAL, VET_DERMATOLOGY, GROOMER |
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
| id | UUID | PK | Primary Key |
| user_id | UUID | FK→users, NOT NULL | Owner (Pet Owner) |
| name | VARCHAR(100) | NOT NULL | Pet name |
| species | VARCHAR(50) | | Species (Dog, Cat, Other) |
| breed | VARCHAR(100) | | Breed |
| date_of_birth | DATE | | Birth date |
| weight | DECIMAL(5,2) | | Weight (kg) |
| gender | VARCHAR(10) | | Gender |
| color | VARCHAR(100) | | Fur color |
| allergies | TEXT | | Allergies (if any) |
| image_url | VARCHAR(500) | | Pet image |
| image_public_id | VARCHAR(100) | | Cloudinary public ID |
| created_at | TIMESTAMP | DEFAULT now() | Created date |
| updated_at | TIMESTAMP | DEFAULT now() | Updated date |

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
| phone | VARCHAR(20) | | Phone number |
| email | VARCHAR(100) | | Contact email |
| latitude | DECIMAL(10,8) | | Latitude |
| longitude | DECIMAL(11,8) | | Longitude |
| logo | VARCHAR(500) | | Logo URL |
| operating_hours | JSONB | | Operating hours (JSON) |
| status | ENUM | NOT NULL, DEFAULT 'PENDING' | PENDING, APPROVED, REJECTED, SUSPENDED |
| rejection_reason | TEXT | | Rejection reason |
| rating_avg | DECIMAL(2,1) | DEFAULT 0.0 | Rating score |
| rating_count | INT | DEFAULT 0 | Number of ratings |
| approved_at | TIMESTAMP | | Approval date |
| created_at | TIMESTAMP | DEFAULT now() | Created date |
| updated_at | TIMESTAMP | DEFAULT now() | Updated date |
| deleted_at | TIMESTAMP | | Soft delete |

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
| clinic_id | UUID | PK, FK→clinics | 1:1 with clinics |
| price_per_km | DECIMAL(12,2) | NOT NULL | Travel price per km |
| created_at | TIMESTAMP | DEFAULT now() | Created date |
| updated_at | TIMESTAMP | DEFAULT now() | Updated date |

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
| is_custom | BOOLEAN | DEFAULT false | true=Custom, false=Inherited |
| name | VARCHAR(200) | NOT NULL | Service name |
| description | TEXT | | Description |
| base_price | DECIMAL(19,2) | | Base price |
| duration_time | INT | | Duration (minutes) |
| slots_required | INT | DEFAULT 1 | Required slots |
| is_active | BOOLEAN | DEFAULT true | Is active |
| is_home_visit | BOOLEAN | DEFAULT false | Supports Home Visit |
| price_per_km | DECIMAL(19,2) | | Travel price |
| service_category | ENUM | | GROOMING_SPA, VACCINATION, CHECK_UP, SURGERY, DENTAL, DERMATOLOGY, OTHER |
| pet_type | VARCHAR(100) | | Pet type |
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

**Table: vet_shifts**

**Description:** Work schedules for veterinarians at specific clinics. Auto-generates 30-minute slots for booking. Supports overnight shifts and break times.

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| shift_id | UUID | PK | Primary Key |
| vet_id | UUID | FK→users, NOT NULL | Veterinarian |
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

**Description:** 30-minute time blocks auto-generated from vet_shifts. Used for booking appointments. Status tracks availability.

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| slot_id | UUID | PK | Primary Key |
| shift_id | UUID | FK→vet_shifts, NOT NULL | Parent shift |
| start_time | TIME | NOT NULL | Slot start time |
| end_time | TIME | NOT NULL | Slot end time |
| status | ENUM | NOT NULL, DEFAULT 'AVAILABLE' | AVAILABLE, BOOKED, BLOCKED |
| created_at | TIMESTAMP | DEFAULT now() | Created date |
| updated_at | TIMESTAMP | DEFAULT now() | Updated date |

###### Booking Tables

**Table: bookings**

**Description:** Appointment records connecting pets, pet owners, clinics, and optional vets. Core booking entity supporting IN_CLINIC, HOME_VISIT, and SOS types.

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| booking_id | UUID | PK | Primary Key |
| booking_code | VARCHAR(20) | UNIQUE, NOT NULL | Booking code (BK-YYYYMMDD-XXXX) |
| pet_id | UUID | FK→pets, NOT NULL | Pet being treated |
| pet_owner_id | UUID | FK→users, NOT NULL | Pet owner |
| clinic_id | UUID | FK→clinics, NOT NULL | Target clinic |
| assigned_vet_id | UUID | FK→users | Assigned veterinarian |
| booking_date | DATE | NOT NULL | Appointment date |
| booking_time | TIME | NOT NULL | Appointment time |
| type | ENUM | NOT NULL, DEFAULT 'IN_CLINIC' | IN_CLINIC, HOME_VISIT, SOS |
| home_address | VARCHAR(500) | | Address (Home Visit/SOS only) |
| home_lat | DECIMAL(10,7) | | Home latitude |
| home_long | DECIMAL(10,7) | | Home longitude |
| distance_km | DECIMAL(5,2) | | Distance in km |
| distance_fee | DECIMAL(12,2) | | Travel fee |
| total_price | DECIMAL(12,2) | | Total price |
| status | ENUM | NOT NULL, DEFAULT 'PENDING' | (See State Machine below) |
| cancellation_reason | TEXT | | Cancellation reason |
| cancelled_by | UUID | | Cancelled by user |
| notes | TEXT | | Notes |
| created_at | TIMESTAMP | DEFAULT now() | Created date |

**Booking Status State Machine:**
```
PENDING → CONFIRMED → ASSIGNED → [ON_THE_WAY → ARRIVED] → CHECK_IN → IN_PROGRESS → CHECK_OUT → COMPLETED
                                        ↑ Only for HOME_VISIT/SOS
Alternative paths: CANCELLED, NO_SHOW
```

**Table: booking_service_items**

**Description:** Junction table linking bookings to specific clinic services (Many-to-Many). Captures price snapshot at booking time for historical accuracy.

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| booking_service_id | UUID | PK | Primary Key |
| booking_id | UUID | FK→bookings, NOT NULL | Parent booking |
| service_id | UUID | FK→clinic_services, NOT NULL | Clinic service |
| assigned_vet_id | UUID | FK→users | Staff assigned to this service |
| unit_price | DECIMAL(12,2) | | Price snapshot at booking time |
| base_price | DECIMAL(12,2) | | Base price |
| weight_price | DECIMAL(12,2) | | Weight-based price |
| quantity | INT | DEFAULT 1 | Quantity |
| created_at | TIMESTAMP | DEFAULT now() | Created date |

**Table: booking_slots**

**Description:** Junction table linking bookings to specific time slots (Many-to-Many). Allows services to occupy multiple consecutive slots.

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| booking_slot_id | UUID | PK | Primary Key |
| booking_id | UUID | FK→bookings, NOT NULL | Parent booking |
| slot_id | UUID | FK→slots, NOT NULL | Reserved slot |
| booking_service_id | UUID | FK→booking_service_items | Associated service item |
| created_at | TIMESTAMP | DEFAULT now() | Created date |

**Table: payments**

**Description:** Payment records with 1:1 relationship to bookings. Supports multiple payment methods (CASH, QR, CARD) with Stripe integration.

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| payment_id | UUID | PK | Primary Key |
| booking_id | UUID | FK→bookings, UNIQUE, NOT NULL | 1:1 with Booking |
| amount | DECIMAL(12,2) | NOT NULL | Payment amount |
| method | ENUM | NOT NULL, DEFAULT 'CASH' | CASH, QR, CARD |
| status | ENUM | NOT NULL, DEFAULT 'PENDING' | PENDING, PAID, REFUNDED, FAILED |
| stripe_payment_id | VARCHAR(255) | | Stripe transaction ID |
| paid_at | TIMESTAMP | | Payment timestamp |
| created_at | TIMESTAMP | DEFAULT now() | Created date |

###### Notification Table

**Table: notifications**

**Description:** In-app notifications for users about clinic approvals, shift assignments, booking updates, and medical reminders. Supports read/unread status.

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| notification_id | UUID | PK | Primary Key |
| user_id | UUID | FK→users, NOT NULL | Notification recipient |
| clinic_id | UUID | FK→clinics | Related clinic (optional) |
| shift_id | UUID | FK→vet_shifts | Related shift (optional) |
| type | ENUM | NOT NULL | (See Notification Types) |
| emr_id | VARCHAR(50) | | MongoDB ObjectId |
| message | TEXT | NOT NULL | Notification content |
| reason | TEXT | | Reason (for rejection) |
| read | BOOLEAN | DEFAULT false | Read status |
| created_at | TIMESTAMP | DEFAULT now() | Created date |

**Notification Types:**
- Clinic: APPROVED, REJECTED, PENDING, CLINIC_PENDING_APPROVAL, CLINIC_VERIFIED
- VetShift: VET_SHIFT_ASSIGNED, VET_SHIFT_UPDATED, VET_SHIFT_DELETED
- Booking: BOOKING_CREATED, BOOKING_CONFIRMED, BOOKING_ASSIGNED, BOOKING_CANCELLED, BOOKING_CHECKIN, BOOKING_COMPLETED, VET_ON_WAY
- Medical: RE_EXAMINATION_REMINDER

##### 2.1.3.2 AI Agent Service Tables

###### Table: agents

**Purpose:** Stores Single Agent configuration for the Petties AI Assistant using ReAct pattern (Reasoning + Acting). This table enables dynamic agent behavior modification through Admin Dashboard without code deployment.

| Column | Type | Constraints | Purpose & Business Context |
|--------|------|-------------|---------------------------|
| id | INT | PK, AUTO_INCREMENT | Auto-increment primary key for internal references |
| name | VARCHAR(100) | UNIQUE, NOT NULL | Unique agent identifier (e.g., "petties_agent"). Used for tool assignment and logging |
| description | TEXT | | Human-readable description of agent's capabilities for Admin Dashboard display |
| temperature | FLOAT | DEFAULT 0.7 | Controls LLM response randomness (0.0=deterministic, 1.0=creative). Lower values for factual Q&A, higher for creative suggestions |
| max_tokens | INT | DEFAULT 2000 | Maximum response length limit. Prevents excessive token usage and controls cost |
| top_p | FLOAT | DEFAULT 0.9 | Nucleus sampling parameter (0.0-1.0). Works with temperature to control output diversity |
| model | VARCHAR(100) | DEFAULT 'google/gemini-2.0-flash-exp:free' | OpenRouter model ID. Enables model switching without code changes |
| system_prompt | TEXT | | Defines agent personality, capabilities, and behavior rules. Core of ReAct pattern implementation |
| enabled | BOOLEAN | DEFAULT true | Master switch to enable/disable agent. Useful for maintenance or A/B testing |
| created_at | TIMESTAMPTZ | DEFAULT now() | Record creation timestamp for audit trail |
| updated_at | TIMESTAMPTZ | DEFAULT now() | Last modification timestamp for change tracking |

###### Table: tools

**Purpose:** Stores metadata for code-based tools decorated with `@mcp.tool`. Admin can enable/disable individual tools and assign them to specific agents. Tools provide the "Acting" capability in ReAct pattern.

| Column | Type | Constraints | Purpose & Business Context |
|--------|------|-------------|---------------------------|
| id | INT | PK, AUTO_INCREMENT | Auto-increment primary key |
| name | VARCHAR(100) | UNIQUE, NOT NULL | Unique tool identifier matching the Python function name (e.g., "check_slot", "create_booking") |
| description | TEXT | | Semantic description used by LLM to decide when to invoke this tool. Critical for accurate tool selection |
| tool_type | VARCHAR(20) | DEFAULT 'code_based' | Distinguishes `code_based` (FastMCP @mcp.tool) from `api_based` (direct Spring Boot API calls) |
| input_schema | JSON | | JSON Schema defining expected input parameters. Used for validation and LLM function calling format |
| output_schema | JSON | | JSON Schema defining output structure. Helps LLM interpret tool results correctly |
| enabled | BOOLEAN | DEFAULT false | Admin toggle to enable/disable tool. Default false - admin must explicitly enable after deployment |
| assigned_agents | JSON | | Array of agent names allowed to use this tool (e.g., ["petties_agent"]). Enables tool governance |
| created_at | TIMESTAMPTZ | DEFAULT now() | Record creation timestamp |
| updated_at | TIMESTAMPTZ | DEFAULT now() | Last modification timestamp |

**Tool Types:**
- `code_based`: FastMCP @mcp.tool decorators (default)
- `api_based`: Spring Boot API calls

###### Table: prompt_versions

**Purpose:** Version control for system prompts enabling rollback, A/B testing, and audit trail. Only one version can be active per agent at a time.

| Column | Type | Constraints | Purpose & Business Context |
|--------|------|-------------|---------------------------|
| id | INT | PK, AUTO_INCREMENT | Auto-increment primary key |
| agent_id | INT | FK→agents, NOT NULL | Foreign key to agents table. Links version to specific agent |
| version | INT | NOT NULL | Sequential version number (1, 2, 3...). Higher number = newer version |
| prompt_text | TEXT | NOT NULL | Full system prompt content. May include ReAct instructions, persona, constraints |
| is_active | BOOLEAN | DEFAULT false | Indicates currently active version. Only one active version per agent |
| created_by | VARCHAR(100) | | Admin username who created this version. For accountability |
| notes | TEXT | | Change notes describing what was modified. Helps with version comparison |
| created_at | TIMESTAMPTZ | DEFAULT now() | Version creation timestamp |

###### Table: chat_sessions

**Purpose:** Tracks conversation boundaries between users and AI agent. Groups related messages together and enables conversation history retrieval.

**Cross-Service Reference:** `user_id` references `users.user_id` from Spring Boot Backend (logical reference, not enforced FK due to separate service).

| Column | Type | Constraints | Purpose & Business Context |
|--------|------|-------------|---------------------------|
| id | INT | PK, AUTO_INCREMENT | Auto-increment primary key |
| agent_id | INT | FK→agents (SET NULL) | Foreign key to agents table. Records which agent handled this session. SET NULL on agent deletion |
| user_id | VARCHAR(100) | NOT NULL | User UUID from Spring Boot backend. Links AI conversations to pet owners |
| session_id | VARCHAR(100) | UNIQUE, NOT NULL | Unique session identifier (UUID). Used by frontend to maintain conversation context |
| started_at | TIMESTAMPTZ | DEFAULT now() | Session start timestamp. For analytics and timeout management |
| ended_at | TIMESTAMPTZ | | Session end timestamp. NULL if session still active. Used for session cleanup |

###### Table: chat_messages

**Purpose:** Stores individual messages within chat sessions including user queries, AI responses, and tool execution results. Preserves complete conversation history for context and debugging.

| Column | Type | Constraints | Purpose & Business Context |
|--------|------|-------------|---------------------------|
| id | INT | PK, AUTO_INCREMENT | Auto-increment primary key |
| session_id | INT | FK→chat_sessions, NOT NULL | Foreign key to chat_sessions. Groups messages into conversations |
| role | VARCHAR(20) | NOT NULL | Message sender type: `user` (pet owner), `assistant` (AI), `system` (instructions), `tool` (tool results) |
| content | TEXT | NOT NULL | Actual message content. For tool role, contains serialized tool output |
| message_metadata | JSON | | Additional data: tool calls made, ReAct reasoning steps, token counts, latency metrics |
| timestamp | TIMESTAMPTZ | DEFAULT now() | Message timestamp for ordering and analytics |

**Message Roles:**
- `user`: Messages from Pet Owner
- `assistant`: Responses from AI Agent
- `system`: System instructions
- `tool`: Results from tool execution

###### Table: knowledge_documents

**Purpose:** Tracks documents uploaded for RAG (Retrieval-Augmented Generation) knowledge base. Enables pet care Q&A by indexing veterinary information.

| Column | Type | Constraints | Purpose & Business Context |
|--------|------|-------------|---------------------------|
| id | INT | PK, AUTO_INCREMENT | Auto-increment primary key |
| filename | VARCHAR(255) | NOT NULL | Original uploaded filename. Displayed in Admin Dashboard |
| file_path | VARCHAR(500) | NOT NULL | Storage path (local or cloud). Used for reprocessing if needed |
| file_type | VARCHAR(10) | | File extension (pdf, docx, txt, md). Determines parsing strategy |
| file_size | INT | | File size in bytes. For storage management and upload limits |
| processed | BOOLEAN | DEFAULT false | Whether document has been chunked and embedded. False until processing completes |
| vector_count | INT | DEFAULT 0 | Number of vector embeddings created. Indicates document coverage in knowledge base |
| uploaded_by | VARCHAR(100) | | Admin username who uploaded. For audit trail |
| notes | TEXT | | Optional notes about document content or source |
| uploaded_at | TIMESTAMPTZ | DEFAULT now() | Upload timestamp |
| processed_at | TIMESTAMPTZ | | Processing completion timestamp. NULL if not yet processed |

###### Table: system_settings

**Purpose:** Runtime-configurable settings for AI service (API keys, model configs) editable via Admin Dashboard. Eliminates need for .env file changes and redeployment.

| Column | Type | Constraints | Purpose & Business Context |
|--------|------|-------------|---------------------------|
| id | INT | PK, AUTO_INCREMENT | Auto-increment primary key |
| key | VARCHAR(100) | UNIQUE, NOT NULL | Unique setting identifier (e.g., "OPENROUTER_API_KEY", "COHERE_EMBEDDING_MODEL") |
| value | TEXT | NOT NULL | Setting value. Encrypted in database if is_sensitive=true |
| category | VARCHAR(50) | DEFAULT 'general' | Groups settings: `llm` (OpenRouter), `rag` (Cohere), `embeddings`, `vector_db` (Qdrant), `general` |
| is_sensitive | BOOLEAN | DEFAULT false | If true, value is encrypted and masked in UI. Used for API keys and secrets |
| description | TEXT | | Human-readable description for Admin Dashboard tooltip |
| created_at | TIMESTAMPTZ | DEFAULT now() | Record creation timestamp |
| updated_at | TIMESTAMPTZ | DEFAULT now() | Last modification timestamp |

**Setting Categories:**
- `llm`: OpenRouter API settings
- `rag`: RAG pipeline settings
- `embeddings`: Cohere embedding settings
- `vector_db`: Qdrant Cloud settings
- `general`: General settings (JWT, etc.)

**Default Settings (seeded on init):**
```
OPENROUTER_API_KEY, OPENROUTER_DEFAULT_MODEL, OPENROUTER_FALLBACK_MODEL
DEEPSEEK_API_KEY, DEEPSEEK_MODEL, DEEPSEEK_BASE_URL
COHERE_API_KEY, COHERE_EMBEDDING_MODEL
OPENAI_API_KEY, OPENAI_EMBEDDING_MODEL
QDRANT_URL, QDRANT_API_KEY, QDRANT_COLLECTION_NAME
JWT_SECRET
```

#### 2.1.4 Enum Types Summary

##### Spring Boot Backend Enums

| Enum | Values |
|------|--------|
| **role** | PET_OWNER, STAFF, CLINIC_MANAGER, CLINIC_OWNER, ADMIN |
| **staff_specialty** | VET_GENERAL, VET_SURGERY, VET_DENTAL, VET_DERMATOLOGY, GROOMER |
| **clinic_status** | PENDING, APPROVED, REJECTED, SUSPENDED |
| **booking_type** | IN_CLINIC, HOME_VISIT, SOS |
| **booking_status** | PENDING, CONFIRMED, ASSIGNED, ON_THE_WAY, ARRIVED, CHECK_IN, IN_PROGRESS, CHECK_OUT, COMPLETED, CANCELLED, NO_SHOW |
| **slot_status** | AVAILABLE, BOOKED, BLOCKED |
| **service_category** | GROOMING_SPA, VACCINATION, CHECK_UP, SURGERY, DENTAL, DERMATOLOGY, OTHER |
| **payment_method** | CASH, QR, CARD |
| **payment_status** | PENDING, PAID, REFUNDED, FAILED |
| **notification_type** | (See full list above) |

##### AI Agent Service Enums

| Enum | Values |
|------|--------|
| **tool_type** | code_based, api_based |
| **setting_category** | llm, rag, embeddings, vector_db, general |
| **message_role** | user, assistant, system, tool |
| **file_type** | pdf, docx, txt, md |

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
| vet_shifts | idx_shift_vet_date | (vet_id, work_date) | COMPOSITE | Staff schedule lookup |
| vet_shifts | idx_shift_clinic_date | (clinic_id, work_date) | COMPOSITE | Clinic schedule |
| slots | idx_slot_shift | shift_id | B-TREE | Shift lookup |
| slots | idx_slot_status | status | B-TREE | Available slots |

##### AI Agent Service Indexes

| Table | Index Name | Columns | Type | Purpose |
|-------|------------|---------|------|---------|
| agents | idx_agents_name | name | UNIQUE | Agent lookup by name |
| tools | idx_tools_name | name | UNIQUE | Tool lookup by name |
| tools | idx_tools_enabled | enabled | B-TREE | Filter enabled tools |
| chat_sessions | idx_chat_sessions_user_id | user_id | B-TREE | User's sessions |
| chat_sessions | idx_chat_sessions_session_id | session_id | UNIQUE | Session lookup |
| system_settings | idx_system_settings_key | key | UNIQUE | Setting lookup |

##### Cross-Service References

> **Note:** AI Agent Service và Spring Boot Backend share the same PostgreSQL server nhưng có thể dùng schemas riêng biệt. Các references giữa 2 services là **logical references** (không có FK constraint).

| AI Service Table | Column | References Backend Table | Notes |
|-----------------|--------|-------------------------|-------|
| chat_sessions | user_id | users.user_id | User UUID stored as VARCHAR(100) |

#### 2.1.6 Complete ERD (All Tables)

> **Note:** Complete ERD bao gồm tất cả 24 tables (17 Backend + 7 AI Service).
> ERD này là **Database Design** chi tiết với columns, types, constraints.
> DBML source code: [`docs-references/database/PETTIES_DBML.dbml`](../../database/PETTIES_DBML.dbml)

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

#### 2.2.1 Collections Overview

```mermaid
flowchart LR
    subgraph MongoDB["MongoDB 7 (Document Store)"]
        direction TB
        EMR["emr_records<br/>Electronic Medical Records"]
        VAX["vaccination_records<br/>Vaccination History"]
        CONV["chat_conversations<br/>Chat Sessions"]
        MSG["chat_messages<br/>Messages"]
    end

    style EMR fill:#90EE90
    style VAX fill:#87CEEB
    style CONV fill:#FFB6C1
    style MSG fill:#DDA0DD
```

| Collection | Description | Avg Doc Size | Reference to PostgreSQL |
|------------|-------------|--------------|------------------------|
| emr_records | Electronic Medical Records (SOAP format) | ~2KB | pet_id, booking_id, vet_id, clinic_id |
| vaccination_records | Vaccination history | ~500B | pet_id, booking_id, vet_id |
| chat_conversations | 1-1 chat sessions | ~300B | pet_owner_id, clinic_id |
| chat_messages | Messages | ~200B | sender_id, chat_box_id (MongoDB _id) |

#### 2.2.2 Collection Descriptions

##### Collection: emr_records

**Description:** Electronic Medical Records in SOAP format (Subjective, Objective, Assessment, Plan) with embedded prescriptions and images.

**Sample Document:**
```json
{
  "_id": ObjectId("507f1f77bcf86cd799439011"),
  "pet_id": "550e8400-e29b-41d4-a716-446655440000",
  "booking_id": "550e8400-e29b-41d4-a716-446655440001",
  "vet_id": "550e8400-e29b-41d4-a716-446655440002",
  "clinic_id": "550e8400-e29b-41d4-a716-446655440003",

  "subjective": "Owner reports pet stopped eating for 2 days, lethargic, vomited once this morning.",

  "objective": "Temperature: 39.5°C (mild fever). Heart: normal. Breathing: normal. Abdomen: slightly distended, tender in epigastric region. Mucous membranes: slightly pale.",

  "assessment": "Acute gastritis. Suspected ingestion of inappropriate food.",

  "plan": "Medical treatment for 5 days. Rest, feed soft and digestible food. Follow-up in 5 days if no improvement.",

  "weight_kg": 4.5,
  "temperature_c": 39.5,

  "prescriptions": [
    {
      "medicine_name": "Amoxicillin 250mg",
      "dosage": "1 tablet",
      "frequency": "Twice daily",
      "duration_days": 5,
      "instructions": "Take after meals"
    },
    {
      "medicine_name": "Omeprazole 20mg",
      "dosage": "1/2 tablet",
      "frequency": "Once daily (morning)",
      "duration_days": 5,
      "instructions": "Take 30 minutes before meals"
    },
    {
      "medicine_name": "Metoclopramide 10mg",
      "dosage": "1/4 tablet",
      "frequency": "Three times daily",
      "duration_days": 3,
      "instructions": "Take 15 minutes before meals, stop when vomiting ceases"
    }
  ],

  "images": [
    {
      "url": "https://res.cloudinary.com/petties/emr/xray-abdomen-001.jpg",
      "description": "Abdominal X-ray - No foreign body detected"
    }
  ],

  "re_examination_date": ISODate("2025-01-31T00:00:00Z"),
  "created_at": ISODate("2025-01-26T10:30:00Z"),
  "updated_at": ISODate("2025-01-26T10:30:00Z")
}
```

**Indexes:**
- `{ pet_id: 1 }` - Find EMR by pet
- `{ booking_id: 1 }` - Find by booking
- `{ vet_id: 1, created_at: -1 }` - Staff's EMR records by time
- `{ clinic_id: 1, created_at: -1 }` - Clinic's EMR records

##### Collection: vaccination_records

**Description:** Pet vaccination history, tracking administered vaccines and booster schedules.

**Sample Document:**
```json
{
  "_id": ObjectId("507f1f77bcf86cd799439012"),
  "pet_id": "550e8400-e29b-41d4-a716-446655440000",
  "booking_id": "550e8400-e29b-41d4-a716-446655440001",
  "vet_id": "550e8400-e29b-41d4-a716-446655440002",

  "vaccine_name": "5-in-1 Vaccine (DHPP+Lepto)",
  "batch_number": "VN2025-001234",
  "manufacturer": "MSD Animal Health",

  "vaccination_date": ISODate("2025-01-26T10:00:00Z"),
  "next_due_date": ISODate("2026-01-26T00:00:00Z"),

  "dose_number": 2,
  "total_doses": 3,

  "notes": "Booster dose 2. Pet is healthy, no adverse reactions. Schedule dose 3 in 1 year.",

  "created_at": ISODate("2025-01-26T10:15:00Z")
}
```

**Indexes:**
- `{ pet_id: 1, vaccination_date: -1 }` - Pet's vaccination history
- `{ next_due_date: 1 }` - Find upcoming vaccinations

##### Collection: chat_conversations

**Description:** 1-1 chat sessions between Pet Owner and Clinic.

**Sample Document:**
```json
{
  "_id": ObjectId("507f1f77bcf86cd799439013"),
  "pet_owner_id": "550e8400-e29b-41d4-a716-446655440000",
  "clinic_id": "550e8400-e29b-41d4-a716-446655440001",

  "clinic_name": "ABC Veterinary Clinic",
  "pet_owner_name": "John Smith",
  "pet_owner_avatar": "https://res.cloudinary.com/petties/avatars/user-001.jpg",
  "clinic_logo": "https://res.cloudinary.com/petties/clinics/clinic-001-logo.jpg",

  "last_message": "Thank you doctor, I'll bring my pet tomorrow!",
  "last_message_at": ISODate("2025-01-26T15:30:00Z"),
  "last_sender_type": "PET_OWNER",

  "unread_count_pet_owner": 0,
  "unread_count_clinic": 1,

  "status": "ACTIVE",
  "created_at": ISODate("2025-01-20T08:00:00Z")
}
```

**Indexes:**
- `{ pet_owner_id: 1, last_message_at: -1 }` - Pet owner's chat list
- `{ clinic_id: 1, last_message_at: -1 }` - Clinic's chat list

##### Collection: chat_messages

**Description:** Messages within a conversation.

**Sample Document:**
```json
{
  "_id": ObjectId("507f1f77bcf86cd799439014"),
  "chat_box_id": ObjectId("507f1f77bcf86cd799439013"),

  "sender_id": "550e8400-e29b-41d4-a716-446655440000",
  "sender_type": "PET_OWNER",

  "content": "Hello, I'd like to ask about the vaccination schedule for my pet?",
  "message_type": "TEXT",

  "status": "DELIVERED",
  "is_read": true,
  "read_at": ISODate("2025-01-26T14:35:00Z"),

  "created_at": ISODate("2025-01-26T14:30:00Z")
}
```

**Message Types:** TEXT, IMAGE, SYSTEM

**Message Status:** SENT, DELIVERED, READ

**Indexes:**
- `{ chat_box_id: 1, created_at: -1 }` - Messages in conversation
- `{ sender_id: 1, created_at: -1 }` - User's messages

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
| GET | `/ai/agents` | List agents (Single/Multi) | Auth |
| GET | `/ai/agents/{id}` | Get agent detail | Auth |
| PUT | `/ai/agents/{id}` | Update config (Temp, Model, Params) | Admin |
| PUT | `/ai/agents/{id}/prompt` | Update System Prompt (Versioning) | Admin |
| GET | `/ai/agents/{id}/prompt-history` | View Prompt History | Admin |
| POST | `/ai/agents/{id}/test` | Test Agent (ReAct Trace) | Admin |

#### 3.2.3 Tool Registry (`/ai/tools`)
| Method | Endpoint | Description | Access |
|--------|----------|-------------|--------|
| POST | `/ai/tools/scan` | Scan & Sync Code-based Tools (FastMCP) | Admin |
| GET | `/ai/tools` | List Registered Tools | Admin |
| PUT | `/ai/tools/{id}/enable` | Enable/Disable Tool | Admin |
| POST | `/ai/tools/{id}/assign` | Assign tool to Agent | Admin |

#### 3.2.4 Knowledge Base RAG (`/ai/knowledge`)
| Method | Endpoint | Description | Access |
|--------|----------|-------------|--------|
| POST | `/ai/knowledge/upload` | Upload PDF/Docx | Admin |
| POST | `/ai/knowledge/documents/{id}/process` | Index to Qdrant (Cohere Embedding) | Admin |
| GET | `/ai/knowledge/documents` | List documents status | Admin |
| POST | `/ai/knowledge/query` | Test RAG Retrieval | Admin |
| GET | `/ai/knowledge/status` | KB Status & Stats | Admin |

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
n> **Status:** ✅ **IMPLEMENTED** (Sprint 6-7). Full booking lifecycle supported.

| Method | Endpoint | Description | Access |
|--------|----------|-------------|--------|
| POST | `/api/bookings` | Create new booking (Select slot) | Pet Owner |
| GET | `/api/bookings/my-bookings` | List own bookings | Pet Owner |
| GET | `/api/clinics/{id}/bookings` | List clinic bookings | CM, STAFF |
| PATCH | `/api/bookings/{id}/status` | Update booking status | CM, STAFF |

#### 3.3.3 Discovery & Search Module
n> **Status:** ✅ **IMPLEMENTED** (Sprint 4-5). Integrated with Goong Maps API.

| Method | Endpoint | Description | Access |
|--------|----------|-------------|--------|
| GET | `/api/discovery/nearby` | Find clinics by coordinates (lat, lng, radius) | Public |
| GET | `/api/discovery/search` | Search by keyword, service, area | Public |
| GET | `/api/discovery/geocoding` | Convert address to coordinates (Map API proxy) | Public |

#### 3.3.4 Vaccination History Module (Merged)
n> **Status:** ✅ **IMPLEMENTED** (Sprint 7). Fully integrated with EMR module.

| Method | Endpoint | Description | Access |
|--------|----------|-------------|--------|
| GET | `/api/pets/{petId}/vaccinations` | Get full vaccination history | Auth |
| POST | `/api/bookings/{bookingId}/vaccinations` | Add new vaccination record (Must link to Booking) | STAFF |
| PUT | `/api/vaccinations/{id}` | Edit record | STAFF |
| DELETE | `/api/vaccinations/{id}` | Delete record | STAFF |

---

## 4. DETAILED DESIGN

### 4.1 Authentication & Onboarding (UC-PO-01, UC-VT-01, UC-CM-01, UC-CO-01)

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

### 4.2 User Profile & Account Setup (UC-PO-03, UC-VT-03, UC-CM-02, UC-CO-02, UC-PO-23)

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

#### 4.2.2 Update Profile & Avatar (UC-PO-03, UC-VT-03, UC-CM-02)

```mermaid
sequenceDiagram
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
    UR-->>US: 9. OK
    deactivate UR
    US-->>UC: 10. UserResponse
    deactivate US
    UC-->>UI: 11. 200 OK (User Data)
    deactivate UC
    UI-->>U: 12. Update UI state
```

#### 4.2.3 Change Email with OTP (UC-PO-23)

```mermaid
sequenceDiagram
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
    UR-->>ECS: 17. OK
    deactivate UR
    ECS->>ORS: 18. deleteEmailChangeOtp(userId)
    ECS-->>UC: 19. UserResponse
    deactivate ECS
    UC-->>UI: 20. 200 OK (Updated Profile)
    deactivate UC
```

#### 4.2.4 Change Password Flow

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
        US-->>UC: 14b. void
        deactivate US
        UC-->>UI: 15b. 200 OK
        deactivate UC
        UI-->>U: 16b. Success Message
    end
```

### 4.3 Pet Records & Health Hub (UC-PO-04, UC-PO-11, UC-PO-26)

#### 4.3.1 Class Diagram - Pet Records

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

#### 4.3.2 Add New Pet Record (UC-PO-04)

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

#### 4.3.3 Update Pet Info (UC-PO-11)

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

#### 4.3.4 Delete Pet (UC-PO-26)

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


### 4.4 Clinic Discovery Flow (UC-PO-05)

#### 4.4.1 Class Diagram - Clinic Discovery
*(Logic maps to Clinic Service `findNearbyClinics`)*

#### 4.4.2 Search Nearby Clinics (UC-PO-05)

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

### 4.5 Clinical Operations & Service Setup (UC-CO-03, UC-CO-04, UC-CO-05)

#### 4.5.1 Class Diagram - Clinic & Services

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

#### 4.5.2 Create Clinic (UC-CO-03)

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

#### 4.5.3 Approve/Reject Clinic (Admin Approval Flow)

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

#### 4.5.4 Upload Clinic Image

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

### 4.6 Staffing & Scheduling Flow (UC-CM-03, UC-CO-06, UC-CM-04)

Tương tác quan trọng nhất là việc mời nhân viên (Staff/Manager) vào phòng khám và quản lý ca trực của họ.

#### 4.6.1 Class Diagram - Staffing & Scheduling

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

#### 4.6.2 Invite Staff by Email (UC-CM-03, UC-CO-06)

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

#### 4.6.3 Create Staff Shift (UC-CM-04, UC-CO-07)

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

#### 4.6.4 Delete Shift & Slot Operations

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
#### 4.6.5 Business Rules

1. **Staff Roles Control:** 
    - CLINIC_OWNER có quyền thêm CLINIC_MANAGER và STAFF.
    - CLINIC_MANAGER chỉ có quyền thêm Nhân viên (STAFF).
2. **Manager Limit:** Mỗi phòng khám chỉ có tối đa 1 Manager.
3. **Invitation Logic:** Hỗ trợ mời staff qua email. Nếu email chưa có tài khoản, hệ thống tạo user chờ đăng nhập qua Google OAuth. **Họ tên và Avatar sẽ được đồng bộ tự động từ Google Profile khi login lần đầu**, người mời không cần nhập. (Phone là thông tin không bắt buộc).
4. **Slot Duration:** Tự động tạo slots 30 phút khi tạo shift.
5. **Break Time Sync:** Giờ nghỉ tự động lấy từ Clinic Operating Hours nếu shift nằm trong khoảng đó.
6. **Overnight Shifts:** Nếu endTime < startTime (vd: 22:00 → 06:00), hệ thống tự detect và set isOvernight = true.
7. **Overlap Prevention:** Mỗi vet chỉ có 1 shift/ngày. Sử dụng forceUpdate=true để ghi đè shift cũ.
8. **Delete Protection:** Không thể xóa shift có slots ở trạng thái BOOKED.
9. **Block Permission:** Chỉ CLINIC_OWNER và CLINIC_MANAGER được block/unblock slots.
10. **Repeat Weeks:** Có thể tạo lịch lặp lại tối đa 12 tuần liên tiếp.
11. **Past Date Skip:** Không tạo shift cho ngày trong quá khứ.
12. **Closed Day Skip:** Không tạo shift vào ngày phòng khám đóng cửa.
13. **SSE Notifications:** Gửi batch notification cho Staff khi được assign shifts mới.

### 4.7 Booking & Appointment Lifecycle (UC-PO-06, UC-PO-07, UC-CM-06, BOK-1)

Mô tả vòng đời của một lịch hẹn từ lúc khởi tạo trên Mobile App cho đến khi hoàn tất thanh toán tại phòng khám.

**Last Updated:** 2026-01-23 (Added Sequence Diagrams: UC-PO-08, UC-PO-09, UC-VT-03, UC-VT-04, UC-VT-05, UC-VT-09, UC-CM-07, UC-CM-14, UC-CM-15, UC-CM-16)

#### 4.7.0 API Specification Table

| # | Method | Endpoint | Role | Description | Status |
|---|--------|----------|------|-------------|--------|
| 0 | GET | `/bookings/public/available-slots` | Public | Lấy danh sách slot trống (Smart Availability) | 🔨 To Implement |
| 1 | POST | `/bookings` | PET_OWNER | Tạo booking mới | ✅ Done |
| 2 | GET | `/services/by-clinic/{clinicId}` | Public | Lấy danh sách dịch vụ của phòng khám | ✅ Done |
| 3 | GET | `/bookings/clinic/{clinicId}` | MANAGER, ADMIN | Lấy danh sách booking của clinic | ✅ Done |
| 3 | GET | `/bookings/vet/{vetId}` | STAFF, MANAGER, ADMIN | Lấy booking được gán cho vet | ✅ Done |
| 4 | GET | `/bookings/{bookingId}` | All | Lấy chi tiết booking | ✅ Done |
| 5 | GET | `/bookings/code/{bookingCode}` | All | Lấy booking theo mã | ✅ Done |
| 6 | GET | `/bookings/{id}/check-vet-availability` | MANAGER, ADMIN | Kiểm tra vet availability trước confirm | ✅ Done |
| 7 | GET | `/bookings/{id}/available-vets-for-confirm` | MANAGER, ADMIN | Lấy danh sách vet cho dropdown chọn thủ công | ✅ Done |
| 8 | PATCH | `/bookings/{id}/confirm` | MANAGER, ADMIN | Xác nhận booking + auto/manual assign vet | ✅ Done |
| 9 | PATCH | `/bookings/{id}/cancel` | All | Hủy booking với lý do | ✅ Done |
| 10 | GET | `/bookings/{id}/services/{serviceId}/available-vets` | MANAGER, ADMIN | Lấy danh sách vet có thể reassign | ✅ Done |
| 11 | POST | `/bookings/{id}/services/{serviceId}/reassign` | MANAGER, ADMIN | Đổi vet cho dịch vụ | ✅ Done |
| 12 | POST | `/bookings/{id}/add-service` | STAFF, MANAGER, ADMIN | Thêm dịch vụ phát sinh | ✅ Done |
| 13 | PATCH | `/bookings/{id}/check-in` | STAFF, MANAGER | Check-in bắt đầu khám | ⏳ Pending |
| 14 | PATCH | `/bookings/{id}/check-out` | STAFF, MANAGER | Check-out kết thúc khám | ⏳ Pending |
| 15 | PATCH | `/bookings/{id}/complete` | MANAGER | Hoàn thành sau thanh toán | ⏳ Pending |

**Booking Status Flow:**
```
PENDING → CONFIRMED → ASSIGNED → CHECK_IN → IN_PROGRESS → CHECK_OUT → COMPLETED
                                                           ↓
                                                       CANCELLED / NO_SHOW
```

**Notes:**
- IN_CLINIC & HOME_VISIT: Bỏ qua ON_THE_WAY, ARRIVED (đi thẳng từ ASSIGNED → CHECK_IN)
- SOS: Sử dụng ON_THE_WAY → ARRIVED với GPS tracking tự động

#### 4.7.1 Class Diagram - Booking & Appointment

```mermaid
classDiagram
    class BookingController {
        -BookingService bookingService
        +createBooking(BookingRequest, UserDetails) ResponseEntity
        +getBookingsByClinic(UUID, BookingStatus, BookingType, Pageable) ResponseEntity
        +getBookingsByVet(UUID, BookingStatus, Pageable) ResponseEntity
        +getBookingById(UUID) ResponseEntity
        +checkVetAvailability(UUID) ResponseEntity
        +getAvailableVetsForConfirm(UUID) ResponseEntity
        +confirmBooking(UUID, BookingConfirmRequest) ResponseEntity
        +cancelBooking(UUID, String, UserDetails) ResponseEntity
        +getAvailableVetsForReassign(UUID, UUID) ResponseEntity
        +reassignVet(UUID, UUID, ReassignVetRequest) ResponseEntity
        +addServiceToBooking(UUID, AddServiceRequest) ResponseEntity
        +checkIn(UUID) ResponseEntity
        +checkOut(UUID) ResponseEntity
        +complete(UUID) ResponseEntity
    }

    class BookingService {
        -BookingRepository bookingRepository
        -VetAssignmentService vetAssignmentService
        -PricingService pricingService
        -NotificationService notificationService
        +createBooking(BookingRequest, UUID) BookingResponse
        +confirmBooking(UUID, BookingConfirmRequest) BookingResponse
        +cancelBooking(UUID, String, UUID) BookingResponse
        +checkVetAvailability(UUID) VetAvailabilityCheckResponse
        +getAvailableVetsForConfirm(UUID) List~VetOptionDTO~
        +getAvailableVetsForReassign(UUID, UUID) List~AvailableVetResponse~
        +reassignVetForService(UUID, UUID, UUID) BookingResponse
        +addServiceToBooking(UUID, UUID) BookingResponse
        +checkIn(UUID) BookingResponse
        +checkOut(UUID) BookingResponse
        +complete(UUID) BookingResponse
    }

    class VetAssignmentService {
        +checkVetAvailabilityForBooking(Booking) VetAvailabilityCheckResponse
        +getAvailableVetsForConfirm(Booking) List~VetOptionDTO~
        +assignVetsToAllServices(Booking) Map
        +assignSpecificVet(Booking, UUID) void
        +reserveSlotsForBooking(Booking) void
        +releaseSlotsForBooking(Booking) void
        +reassignVetForService(...) void
    }

    class VetOptionDTO {
        +UUID vetId
        +String fullName
        +String avatarUrl
        +String specialty
        +String specialtyLabel
        +boolean isSuggested
        +int bookingCount
        +boolean hasAvailableSlots
        +String unavailableReason
    }

    class Booking {
        +UUID bookingId
        +String bookingCode
        +Pet pet
        +User petOwner
        +Clinic clinic
        +User assignedVet
        +BookingStatus status
        +BookingType type
        +LocalDate bookingDate
        +LocalTime bookingTime
        +BigDecimal totalPrice
        +BigDecimal distanceFee
        +List~BookingServiceItem~ bookingServices
    }

    class BookingServiceItem {
        +UUID bookingServiceId
        +Booking booking
        +ClinicService service
        +User assignedVet
        +BigDecimal unitPrice
        +Integer quantity
        +LocalTime scheduledStartTime
        +LocalTime scheduledEndTime
    }

    BookingController --> BookingService
    BookingService --> VetAssignmentService
    BookingService --> BookingRepository
    VetAssignmentService --> VetOptionDTO
    Booking "1" *-- "many" BookingServiceItem
```

#### 4.7.2 Create Appointment (BOK-1 Mobile Booking Wizard)

**Smart Availability Algorithm**:
The system implements a "Smart Availability" feature that automatically filters available time slots based on:
1. Selected service(s) and their required vet specialties
2. Staff working shifts for the selected date
3. Existing bookings (to avoid double-booking)

For multi-service bookings, the algorithm ensures **consecutive slots** can be fulfilled by checking each service in sequence.

```mermaid
sequenceDiagram
    actor PO as Pet Owner
    participant UI as Mobile Booking Screen
    participant BC as BookingController
    participant BS as BookingService
    participant VAS as VetAssignmentService
    participant SR as SlotRepository
    participant DB as Database

    PO->>UI: 1. Step 1: Select Service(s)
    PO->>UI: 2. Step 2: Select Date
    activate UI
    UI->>BC: 3. GET /api/bookings/public/available-slots?clinicId&date&serviceIds[]
    activate BC
    BC->>BS: 4. getAvailableSlots(clinicId, date, serviceIds)
    activate BS
    BS->>VAS: 5. findAvailableTimeSlotsWithSmartMatching(...)
    activate VAS
    Note over VAS: Smart Availability Logic:<br/>1. Fetch all services with required specialties<br/>2. Query vets with matching specialties<br/>3. Check vet shifts for date<br/>4. Filter out booked slots<br/>5. Validate consecutive slots for multi-service
    VAS-->>BS: 6. List of valid start times
    deactivate VAS
    BS-->>BC: 7. Available slot times
    deactivate BS
    BC-->>UI: 8. JSON Array of available times
    deactivate BC
    UI-->>PO: 9. Display time grid (available slots)
    
    PO->>UI: 10. Select time slot
    PO->>UI: 11. Step 3: Review & Confirm
    UI->>BC: 12. POST /api/bookings (with serviceIds, slotIds, NO vetId)
    activate BC
    BC->>BS: 13. createBooking(request)
    activate BS
    BS->>BS: 14. Validate slots still available
    BS->>BS: 15. Calculate total price (Base + Weight + Distance)
    BS->>DB: 16. Save Booking (status=PENDING)
    BS->>SR: 17. Lock Slots (TTL=15m for payment)
    BS-->>BC: 18. BookingResponse
    deactivate BS
    BC-->>UI: 19. 201 Created
    deactivate BC
    UI-->>PO: 20. Show "Proceed to Payment"
    deactivate UI
```

**Key Technical Details**:
- **New API**: `GET /api/bookings/public/available-slots` - Returns available time slots based on service specialty matching
- **Staff Assignment**: Intentionally omitted from mobile flow. Manager assigns vet post-booking via Dashboard (Section 3.8.4)
- **Slot Reservation**: Slots are temporarily locked for 15 minutes to allow payment completion

#### 4.7.3 Online Payment & Confirmation (UC-PO-10, UC-PO-20)

```mermaid
sequenceDiagram
    actor PO as Pet Owner
    participant UI as Mobile App
    participant BC as BookingController
    participant BS as BookingService
    participant PS as PaymentService/Stripe
    participant DB as Database

    PO->>UI: 1. Click "Pay Now"
    UI->>BC: 2. GET /bookings/{id}/payment-intent
    BC->>PS: 3. Create Stripe Payment Intent
    PS-->>BC: 4. Client Secret
    BC-->>UI: 5. Client Secret
    UI->>PS: 6. Confirm Payment (Stripe SDK)
    PS-->>UI: 7. Payment Success
    UI->>BC: 8. POST /bookings/{id}/confirm-payment
    activate BC
    BC->>BS: 9. confirmPayment(id)
    activate BS
    BS->>DB: 10. Update status to CONFIRMED
    BS-->>BC: 11. BookingResponse
    deactivate BS
    BC-->>UI: 12. 200 OK
    deactivate BC
```

#### 4.7.4 Clinician Assignment with Manual Staff Selection (UC-CM-06)

Manager có thể chọn vet thủ công qua inline dropdown hoặc để hệ thống auto-assign.

```mermaid
sequenceDiagram
    actor M as Clinic Manager
    participant UI as Manager Web Dashboard
    participant BC as BookingController
    participant BS as BookingService
    participant VAS as VetAssignmentService
    participant NS as NotificationService
    participant DB as Database

    M->>UI: 1. Click "Chi tiết" on PENDING booking
    activate UI
    UI->>BC: 2. GET /bookings/{id}/available-vets-for-confirm
    activate BC
    BC->>BS: 3. getAvailableVetsForConfirm(id)
    BS->>VAS: 4. getAvailableVetsForConfirm(booking)
    VAS-->>BS: 5. List<VetOptionDTO> with isSuggested flags
    BS-->>BC: 6. VetOptionDTO list
    BC-->>UI: 7. JSON Array of vets
    deactivate BC
    UI-->>M: 8. Show inline dropdown per service (pre-select suggested)

    M->>UI: 9. (Optional) Change vet via dropdown
    M->>UI: 10. Click "Xác nhận & Gán Staff"
    UI->>BC: 11. PATCH /bookings/{id}/confirm with selectedVetId
    activate BC
    BC->>BS: 12. confirmBooking(id, request with selectedVetId)
    activate BS
    BS->>DB: 13. findById(id)
    DB-->>BS: 14. Booking Entity

    alt selectedVetId provided (Manual Selection)
        BS->>VAS: 15a. assignSpecificVet(booking, selectedVetId)
        VAS->>VAS: 16a. Validate specialty match
        VAS->>VAS: 17a. Reserve slots for selected vet
    else No selectedVetId (Auto-Assign)
        BS->>VAS: 15b. assignVetsToAllServices(booking)
        VAS-->>BS: 16b. Assignment Result
    end

    BS->>NS: 18. sendBookingAssignedNotification(booking)
    BS->>DB: 19. save(Updated Booking)
    BS-->>BC: 20. BookingResponse
    deactivate BS
    BC-->>UI: 21. 200 OK
    deactivate BC
    UI-->>M: 22. Close modal, refresh list
    deactivate UI
```

**Matching Rules (Service Category → Staff Specialty):**
| Service Category | Required Staff Specialty |
|-----------------|------------------------|
| GROOMING_SPA | VET_GROOMING, GROOMER |
| CHECK_UP, VACCINATION, INTERNAL_MEDICINE | VET_GENERAL, VET_VACCINATION |
| SURGERY | VET_SURGERY |
| DENTAL | VET_DENTAL |
| DERMATOLOGY | VET_DERMATOLOGY |
| EMERGENCY | VET_EMERGENCY |

#### 4.7.5 Check Staff Availability

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

#### 4.7.6 Reassign Staff

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

#### 4.7.7 Add-on Service During Examination

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
- Distance fee is NOT recalculated when adding services
- Price is calculated based on pet's current weight
- Only services from the same clinic can be added

#### 4.7.8 Receive Payment & Checkout (SRS Screen #46, UC-CM-10)

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
    DB-->>BS: 5. Booking Entity (Status: CHECK_OUT)
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

#### 4.7.9 View My Bookings (UC-PO-08)

```mermaid
sequenceDiagram
    actor PO as Pet Owner
    participant UI as My Bookings Screen (Mobile)
    participant API as BookingController
    participant SVC as BookingService
    participant DB as PostgreSQL

    PO->>UI: 1. Navigate to "Lịch hẹn" tab
    activate UI
    UI->>API: 2. GET /api/bookings/my
    activate API
    API->>SVC: 3. getMyBookings(userId)
    activate SVC
    SVC->>DB: 4. SELECT * FROM bookings WHERE pet_owner_id = ?
    activate DB
    DB-->>SVC: 5. List<Booking>
    deactivate DB
    SVC->>SVC: 6. Group by status (Upcoming, Completed, Cancelled)
    SVC->>SVC: 7. Sort by booking_date DESC
    SVC-->>API: 8. BookingListDTO
    deactivate SVC
    API-->>UI: 9. 200 OK + booking list
    deactivate API
    UI-->>PO: 10. Display bookings in tabs
    deactivate UI
```

**Notes:**
- Bookings are grouped into 3 tabs: Upcoming (PENDING, CONFIRMED, ASSIGNED, CHECK_IN, IN_PROGRESS), Completed (COMPLETED), Cancelled (CANCELLED, NO_SHOW)
- Empty state shown if no bookings exist
- Pet Owner can click on any booking to view details

#### 4.7.10 Cancel Booking (UC-PO-09)

```mermaid
sequenceDiagram
    actor PO as Pet Owner
    participant UI as Booking Detail Screen (Mobile)
    participant API as BookingController
    participant SVC as BookingService
    participant BR as BookingRepository
    participant SR as SlotRepository
    participant NR as NotificationRepository
    participant DB as PostgreSQL

    PO->>UI: 1. Click "Hủy lịch" button
    activate UI
    UI->>UI: 2. Show confirmation modal
    PO->>UI: 3. Confirm cancellation
    UI->>API: 4. POST /api/bookings/{id}/cancel
    activate API
    API->>SVC: 5. cancelBooking(bookingId, userId)
    activate SVC
    SVC->>BR: 6. findById(bookingId)
    activate BR
    BR->>DB: 7. SELECT * FROM bookings WHERE booking_id = ?
    activate DB
    DB-->>BR: 8. Booking entity
    deactivate DB
    BR-->>SVC: 9. Booking
    deactivate BR
    SVC->>SVC: 10. Validate: status < CHECK_IN
    alt Status < CHECK_IN
        SVC->>SVC: 11. Update booking.status = CANCELLED
        SVC->>SR: 12. findByBooking(booking)
        activate SR
        SR->>DB: 13. SELECT * FROM slots WHERE booking_id = ?
        activate DB
        DB-->>SR: 14. List<Slot>
        deactivate DB
        SR-->>SVC: 15. Slots
        deactivate SR
        SVC->>SR: 16. Update slots to AVAILABLE
        activate SR
        SR->>DB: 17. UPDATE slots SET status = 'AVAILABLE'
        activate DB
        DB-->>SR: 18. OK
        deactivate DB
        deactivate SR
        SVC->>NR: 19. Create notifications (Manager, Staff if assigned)
        activate NR
        NR->>DB: 20. INSERT INTO notifications
        activate DB
        DB-->>NR: 21. OK
        deactivate DB
        deactivate NR
        SVC->>BR: 22. save(booking)
        activate BR
        BR->>DB: 23. UPDATE bookings SET status = 'CANCELLED'
        activate DB
        DB-->>BR: 24. OK
        deactivate DB
        deactivate BR
        SVC-->>API: 25. BookingResponse (CANCELLED)
        deactivate SVC
        API-->>UI: 26. 200 OK
        deactivate API
        UI-->>PO: 27. Show success toast + update UI
    else Status >= CHECK_IN
        SVC-->>API: 11. Throw BadRequestException
        deactivate SVC
        API-->>UI: 12. 400 Bad Request
        deactivate API
        UI-->>PO: 13. Show error toast
    end
    deactivate UI
```

**Notes:**
- Only bookings with status < CHECK_IN can be cancelled
- Slots are restored to AVAILABLE status
- Notifications sent to Clinic Manager and assigned Staff (if any)
- If payment method is ONLINE, refund request is created (handled by UC-CM-07)

#### 4.7.11 View Assigned Bookings (UC-VT-03)

```mermaid
sequenceDiagram
    actor V as Staff
    participant UI as Staff Schedule Screen (Mobile/Web)
    participant API as BookingController
    participant SVC as BookingService
    participant DB as PostgreSQL

    V->>UI: 1. Navigate to "Lịch hẹn" screen
    activate UI
    UI->>API: 2. GET /api/bookings/assigned
    activate API
    API->>SVC: 3. getAssignedBookings(vetId, filters)
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
- Filters available: Today, Upcoming, Completed, All
- Status badges: ASSIGNED (yellow), CHECK_IN (blue), IN_PROGRESS (green), CHECK_OUT (purple)
- Empty state shown if no assigned bookings
- Staff can click on booking to view details and take actions

#### 4.7.12 Update Appointment Progress (UC-VT-04)

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
    V->>UI: 3. Click action button (Check-in, Start Exam, Finish)
    UI->>API: 4. POST /api/bookings/{id}/update-status
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
    SVC->>SVC: 10. Validate status transition
    alt Status transition valid
        alt New Status = CHECK_IN
            SVC->>ER: 11. createEMRShell(bookingId, petId, vetId)
            activate ER
            ER->>DB: 12. INSERT INTO emr (booking_id, pet_id, vet_id)
            activate DB
            DB-->>ER: 13. EMR created
            deactivate DB
            deactivate ER
        else New Status = CHECK_OUT
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
- Valid status transitions: ASSIGNED → CHECK_IN → IN_PROGRESS → CHECK_OUT
- EMR shell is created when status changes to CHECK_IN
- EMR must have Assessment and Plan before CHECK_OUT is allowed
- Notifications sent to Pet Owner and Clinic Manager on status changes

#### 4.7.13 Check-in Patient (UC-VT-05)

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
    DB-->>BR: 8. Booking entity (Status: ASSIGNED)
    deactivate DB
    BR-->>SVC: 9. Booking
    deactivate BR
    SVC->>SVC: 10. Validate: status = ASSIGNED
    alt Status = ASSIGNED
        SVC->>SVC: 11. Update booking.status = CHECK_IN
        SVC->>BR: 12. save(booking)
        activate BR
        BR->>DB: 13. UPDATE bookings SET status = 'CHECK_IN'
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
        SVC-->>API: 21. BookingResponse (CHECK_IN)
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
- Only bookings with status ASSIGNED can be checked in
- EMR shell is created with booking_id, pet_id, vet_id, created_at
- Notification sent to Pet Owner: "Thú cưng của bạn đang được khám"
- After check-in, Staff can start filling EMR (UC-VT-06)

#### 4.7.14 Mark Treatment Finished (UC-VT-09)

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
        SVC->>SVC: 15. Update booking.status = CHECK_OUT
        SVC->>BR: 16. save(booking)
        activate BR
        BR->>DB: 17. UPDATE bookings SET status = 'CHECK_OUT'
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
        SVC-->>API: 22. BookingResponse (CHECK_OUT)
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
- EMR must have Assessment and Plan fields filled before treatment can be marked finished
- Booking status changes from IN_PROGRESS to CHECK_OUT
- Notification sent to Clinic Manager: "Cần thanh toán & checkout"
- Notification sent to Pet Owner: "Khám xong, vui lòng thanh toán"

#### 4.7.15 Handle Cancellations & Refunds (UC-CM-07)

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
- Refund policy: Cancel >24h before appointment = 100% refund, <24h = 50% refund, <6h = no refund
- Only ONLINE payment bookings require refund processing
- CASH bookings are marked as cancelled without refund
- Notification sent to Pet Owner with refund details

#### 4.7.16 Check Staff Availability (UC-CM-14)

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
- Staff availability is checked based on:
  - Shift schedule (vet must have shift on booking date)
  - Slot availability (slots not already BOOKED)
  - Service specialty matching
  - Current workload (number of bookings assigned for the day)
- Staff are sorted by availability and workload (least busy first)
- Unavailable vets are shown with reason (No shift, Fully booked, Wrong specialty)

#### 4.7.17 Reassign Staff to Service (UC-CM-15)

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
- Reassignment reasons: Staff unavailable, Staff overloaded, Emergency, Other
- Old vet's slots are released back to AVAILABLE
- New vet's corresponding slots are marked as BOOKED
- Notifications sent to:
  - Old Staff: "Bạn đã được gỡ khỏi lịch hẹn [Booking ID]"
  - New Staff: "Bạn được phân công lịch hẹn mới [Booking ID]"
  - Pet Owner: "Nhân viên của bạn đã được thay đổi thành Dr. [Name]"

#### 4.7.18 Manage Shifts - Delete Shift (UC-CM-16)

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
- Shift can only be deleted if no slots are BOOKED
- If shift has booked slots, system shows list of affected bookings and prevents deletion
- Manager must reassign or cancel bookings before deleting shift
- All AVAILABLE and BLOCKED slots are deleted along with the shift

### 4.8 Electronic Medical Records (EMR) Flow (UC-VT-02, UC-VT-06, EMR-2)

#### 4.8.1 Class Diagram - EMR

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

#### 4.8.2 View Pet Medical History (Cross-Clinic) (UC-VT-02)

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

#### 4.8.3 Create EMR (SOAP Notes) (EMR-2, UC-VT-06)

```mermaid
sequenceDiagram
    actor V as Staff
    participant UI as EMR Form (Mobile/Web)
    participant PC as PatientController
    participant PS as PatientService
    participant BR as BookingRepository
    participant PR as PetRepository
    participant EMRR as EMRRepository
    participant DB as Database

    V->>UI: 1. Fill SOAP form (S, O, A, P + Weight)
    activate UI
    UI->>PC: 2. createEMR(bookingId, EMRRequest)
    activate PC
    PC->>PS: 3. createEMR(bookingId, request)
    activate PS
    PS->>BR: 4. findById(bookingId)
    activate BR
    BR->>DB: 5. Query booking by ID
    activate DB
    DB-->>BR: 6. Booking Entity
    deactivate DB
    BR-->>PS: 7. Booking
    deactivate BR
    PS->>PS: 8. Validate status == IN_PROGRESS
    PS->>PS: 9. Validate Staff is assigned
    PS->>EMRR: 10. save(EMR: subjective, objective, assessment, plan)
    activate EMRR
    EMRR->>DB: 11. Insert new EMR record
    activate DB
    DB-->>EMRR: 12. Inserted
    deactivate DB
    EMRR-->>PS: 13. Saved EMR
    deactivate EMRR
    PS->>PR: 14. updatePetWeight(petId, newWeight)
    activate PR
    PR->>DB: 15. Update pet weight
    activate DB
    DB-->>PR: 16. Updated
    deactivate DB
    PR-->>PS: 17. OK
    deactivate PR
    PS-->>PC: 18. EMRResponse
    deactivate PS
    PC-->>UI: 19. 201 Created
    deactivate PC
    UI-->>V: 20. Show success & update medical timeline
    deactivate UI
```

#### 4.8.4 Add Vaccination Record (UC-VT-08)

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

#### 4.8.5 Additional Service & Incurred Costs (UC-VT-10)

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

#### 4.8.6 Add Vaccination Record (UC-VT-08)

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

#### 4.8.7 Lookup Patient (UC-VT-12)

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

#### 4.8.8 View Patient List (UC-CM-08)

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

#### 4.8.9 View Patient Records (UC-CM-09)

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

### 4.9 SOS Emergency Flow (UC-PO-15, UC-PO-17, UC-VT-11)

#### 4.9.1 Class Diagram - SOS Emergency

```mermaid
classDiagram
    class SOSController {
        -SOSService sosService
        +requestSOS(SOSRequest) ResponseEntity
        +trackVetLocation(UUID) ResponseEntity
        +updateVetLocation(LocationUpdate) ResponseEntity
        +confirmArrival(UUID) ResponseEntity
    }

    class SOSService {
        -BookingRepository bookingRepository
        -UserRepository userRepository
        -NotificationService notificationService
        -LocationService locationService
        +createSOSBooking(SOSRequest) SOSResponse
        +findNearbyAvailableVets(Location) List~VetResponse~
        +updateVetLocation(UUID, Location) void
        +confirmArrival(UUID) void
        +getTrackingInfo(UUID) TrackingResponse
    }

    class LocationService {
        -GoongApiClient goongClient
        +calculateDistance(Location, Location) DistanceInfo
        +calculateETA(Location, Location) Duration
        +isWithinRadius(Location, Location, meters) boolean
    }

    class SOSBooking {
        +UUID sosId
        +Booking booking
        +User vet
        +Location ownerLocation
        +Location vetCurrentLocation
        +SOSStatus status
        +LocalDateTime requestTime
        +LocalDateTime arrivalTime
    }

    SOSController --> SOSService
    SOSService --> LocationService
    SOSService --> BookingRepository
    SOSService --> NotificationService
    SOSService ..> SOSBooking
```

#### 4.9.2 Request SOS & Staff Assignment (UC-PO-15)

```mermaid
sequenceDiagram
    actor PO as Pet Owner
    participant UI as Mobile App
    participant SC as SOSController
    participant SS as SOSService
    participant LS as LocationService
    participant UR as UserRepository
    participant BR as BookingRepository
    participant NS as NotificationService
    participant DB as Database

    PO->>UI: 1. Click "SOS Emergency"
    activate UI
    UI->>UI: 2. Get current GPS location
    UI->>SC: 3. POST /sos (SOSRequest: location, petId, symptoms)
    activate SC
    SC->>SS: 4. createSOSBooking(request)
    activate SS
    SS->>LS: 5. findNearbyVets(ownerLocation, 10km)
    activate LS
    LS->>UR: 6. findActiveVetsBySpecialty(EMERGENCY)
    activate UR
    UR->>DB: 7. Query available vets
    activate DB
    DB-->>UR: 8. List<Staff>
    deactivate DB
    UR-->>LS: 9. Staff
    deactivate UR
    LS->>LS: 10. Calculate distances & sort
    LS-->>SS: 11. Sorted vets by proximity
    deactivate LS
    SS->>SS: 12. Auto-assign nearest vet
    SS->>BR: 13. save(SOSBooking)
    activate BR
    BR-->>SS: 14. Saved
    deactivate BR
    SS->>NS: 15. sendPushNotification(vetId, SOS_ALERT)
    activate NS
    NS-->>SS: 16. Sent
    deactivate NS
    SS-->>SC: 17. SOSResponse (vetInfo, ETA)
    deactivate SS
    SC-->>UI: 18. 201 Created
    deactivate SC
    UI-->>PO: 19. Show vet info & tracking map
    deactivate UI
```

#### 4.9.3 Track Staff Location (UC-PO-17)

```mermaid
sequenceDiagram
    actor PO as Pet Owner
    participant UI as Tracking Screen
    participant SC as SOSController
    participant SS as SOSService
    participant LS as LocationService
    participant Cache as Redis

    loop Every 5 seconds
        UI->>SC: 1. GET /sos/{sosId}/track
        activate SC
        SC->>SS: 2. getTrackingInfo(sosId)
        activate SS
        SS->>Cache: 3. get("vet_location:" + vetId)
        activate Cache
        Cache-->>SS: 4. Current vet location
        deactivate Cache
        SS->>LS: 5. calculateETA(vetLocation, ownerLocation)
        activate LS
        LS-->>SS: 6. ETA (minutes, meters)
        deactivate LS
        SS-->>SC: 7. TrackingResponse
        deactivate SS
        SC-->>UI: 8. 200 OK (location, ETA)
        deactivate SC
        UI-->>PO: 9. Update map marker & ETA display
    end
```

#### 4.9.4 Staff Travel & Auto-Arrival (UC-VT-11)

```mermaid
sequenceDiagram
    actor V as Staff
    participant UI as Staff Mobile App
    participant SC as SOSController
    participant SS as SOSService
    participant LS as LocationService
    participant NS as NotificationService
    participant Cache as Redis
    participant DB as Database

    V->>UI: 1. Accept SOS & Click "Start Travel"
    activate UI
    UI->>SC: 2. POST /sos/{sosId}/start-travel
    activate SC
    SC->>SS: 3. startTravel(sosId)
    activate SS
    SS->>DB: 4. Update status = EN_ROUTE
    SS-->>SC: 5. OK
    deactivate SS
    SC-->>UI: 6. 200 OK
    deactivate SC
    UI->>UI: 7. Open external navigation (Google Maps)
    
    loop GPS Broadcast (every 3s)
        UI->>SC: 8. PUT /sos/{sosId}/location
        activate SC
        SC->>SS: 9. updateVetLocation(sosId, location)
        activate SS
        SS->>Cache: 10. set("vet_location:" + vetId, location, TTL=30s)
        SS->>LS: 11. isWithinRadius(vetLoc, ownerLoc, 100m)
        activate LS
        LS-->>SS: 12. true/false
        deactivate LS
        alt Within 100m (Auto-Arrival)
            SS->>DB: 13. Update status = ARRIVED
            SS->>NS: 14. notifyOwner(ARRIVAL_ALERT)
            SS-->>SC: 15. AutoArrivalTriggered
            SC-->>UI: 16. 200 OK (arrived: true)
            UI-->>V: 17. Show "Arrived" confirmation
        else Not yet arrived
            SS-->>SC: 15b. OK
            deactivate SS
            SC-->>UI: 16b. 200 OK
            deactivate SC
        end
    end
    deactivate UI
```

---

### 4.10 AI Assistance Flow (UC-PO-14, UC-PO-14d)

#### 4.10.1 Class Diagram - AI Service

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

#### 4.10.2 Sequence Diagram: AI ReAct Loop

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

#### 4.10.3 AI Vision Pet Health Analysis (UC-PO-14d)

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

#### 4.10.4 Class Specifications

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

#### 4.10.5 Sequence Diagram: AI Vision Analysis to Booking

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

#### 4.10.6 WebSocket Message Schemas

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

#### 4.10.7 Severity Mapping to Actions

| Severity | Description | AI Action |
|----------|-------------|-----------|
| `MILD` | Không phát hiện vấn đề nghiêm trọng | Chỉ đưa lời khuyên, không đề xuất booking |
| `MODERATE` | Vấn đề cần theo dõi | Đề xuất booking trong 24-48h |
| `SEVERE` | Vấn đề nghiêm trọng | Đề xuất booking trong ngày |
| `URGENT` | Cấp cứu | Cảnh báo mạnh + đề xuất SOS hoặc booking ngay |

---

### 4.11 Governance & Reporting Flow (UC-PO-16)

#### 4.11.1 Class Diagram - Reporting

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

#### 4.11.2 Submit Platform Violation Report (UC-PO-16)

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

#### 4.11.3 Admin Process Report

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
**Document Version:** 1.4.0
**Last Updated:** 2026-01-22
