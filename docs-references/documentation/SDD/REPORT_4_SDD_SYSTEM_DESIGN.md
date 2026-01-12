# II. Software Design Document

## TABLE OF CONTENTS
- [1. System Design](#1-system-design)
    - [1.1 System Architecture](#11-system-architecture)
- [2. Database Design](#2-database-design)
- [3. Detailed Design](#3-detailed-design)
    - [3.1 Authentication & Authorization](#31-authentication--authorization)
    - [3.2 User Profile Management](#32-user-profile-management)
    - [3.3 Staff Management](#33-staff-management)
    - [3.4 Clinic Management](#34-clinic-management)
    - [3.5 Pet Management](#35-pet-management)
    - [3.6 Vet Shift & Slot Management](#36-vet-shift--slot-management)
    - [3.7 Patient Management](#37-patient-management)
    - [3.8 Booking Management](#38-booking-management)
- [4. Technology Stack Summary](#4-technology-stack-summary)

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
        Flutter["Flutter 3.5<br/>(Mobile App)<br/>Pet Owner, Vet"]
        React["React 19<br/>(Web Dashboard)<br/>Admin, Clinic Staff, Vet"]
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
- **Vet** - Can view appointments, manage schedule, create EMR records, and access patient history (Web + Mobile)
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
| 01 | pages | **Route Page Layer** - Top-level page components mapping to routes. Each page represents a complete view for a specific role (Admin, Clinic Owner, Clinic Manager, Vet). Organized by role and feature domain. |
| 02 | pages/auth | **Authentication Pages** - Login, registration, and password recovery flows with OTP verification. Handles unauthenticated user journeys. |
| 03 | pages/admin | **Admin Dashboard Pages** - System administration views including clinic approvals, AI agent configuration, tool management, knowledge base, and system settings. |
| 04 | pages/clinic-owner | **Clinic Owner Pages** - Clinic management views for owners including profile editing, service configuration, pricing, and staff management. |
| 05 | pages/clinic-manager | **Clinic Manager Pages** - Operational views for daily clinic management including bookings, schedules, and patient records. |
| 06 | pages/vet | **Veterinarian Pages** - Vet-specific views for appointments, patient records, and schedule management. |
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
| 04 | ui/vet | **Veterinarian Screens** - Vet-specific screens for appointments, patient records, and schedule management. |
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

## 2. API DESIGN SPECIFICATIONS

> **Note:** API version prefix `/api/v1` (Backend) has been simplified to `/api`. AI Service is accessed via `/ai` prefix through NGINX.

### 2.1 Implemented Modules (Backend - Spring Boot)

> **Base Path:** `/api`
> **Access:** Requires JWT, Public for Auth/Search

#### 2.1.1 Authentication (`/auth`)
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

#### 2.1.2 User Profile (`/users`)
| Method | Endpoint | Description | Access |
|--------|----------|-------------|--------|
| GET | `/api/users/profile` | Get detailed profile | Auth |
| PUT | `/api/users/profile` | Update profile info | Auth |
| POST | `/api/users/profile/avatar` | Upload avatar | Auth |
| DELETE | `/api/users/profile/avatar` | Delete avatar | Auth |
| PUT | `/api/users/profile/password` | Change password | Auth |
| POST | `/api/users/profile/email/request-change` | Request email change (Step 1) | Auth |
| POST | `/api/users/profile/email/verify-change` | Verify email change (Step 2) | Auth |

#### 2.1.3 Clinic Management (`/clinics`)
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

#### 2.1.4 Clinic Staff Management (`/clinics/{id}/staff`)
| Method | Endpoint | Description | Access |
|--------|----------|-------------|--------|
| GET | `/api/clinics/{id}/staff` | List all staff | CM, CO, Admin |
| GET | `/api/clinics/{id}/staff/has-manager` | Check manager logic | CM, CO |
| POST | `/api/clinics/{id}/staff/invite-by-email` | Invite staff by email (Google OAuth) | CM, CO |
| PATCH | `/api/clinics/{id}/staff/{userId}/specialty` | Update staff specialty | CM, CO |
| DELETE | `/api/clinics/{id}/staff/{userId}` | Remove staff | CM, CO |

#### 2.1.5 Shift & Slot Management (`/shifts`, `/slots`)
| Method | Endpoint | Description | Access |
|--------|----------|-------------|--------|
| GET | `/api/clinics/{id}/shifts` | Get shifts in date range (Week/Month) | CM, CO, VET |
| POST | `/api/clinics/{id}/shifts` | Create shifts (Auto-gen slots, Break sync, Repeat weeks, Overnight) | CM, CO |
| GET | `/api/shifts/me` | Get shifts of logged-in vet | VET |
| GET | `/api/shifts/{id}` | Get shift detail with Slots & Bookings | CM, CO, VET |
| DELETE | `/api/shifts/{id}` | Delete individual shift (blocked if has bookings) | CM, CO |
| DELETE | `/api/shifts/bulk` | Delete multiple shifts (Bulk) | CM, CO |
| PATCH | `/api/slots/{id}/block` | Manually block slot | CM, CO |
| PATCH | `/api/slots/{id}/unblock` | Unblock slot | CM, CO |

#### 2.1.6 Clinic Services (`/services`)
| Method | Endpoint | Description | Access |
|--------|----------|-------------|--------|
| GET | `/api/services` | List own services | Clinic Owner |
| POST | `/api/services` | Create service | Clinic Owner |
| PUT | `/api/services/{id}` | Update service | Clinic Owner |
| DELETE | `/api/services/{id}` | Delete service | Clinic Owner |
| PATCH | `/api/services/{id}/status` | Toggle active | Clinic Owner |
| PATCH | `/api/services/{id}/home-visit` | Toggle Home Visit | Clinic Owner |

#### 2.1.6 File Management (`/files`)
| Method | Endpoint | Description | Access |
|--------|----------|-------------|--------|
| POST | `/api/files/upload` | Upload generic file | Auth |
| POST | `/api/files/upload/avatar` | Upload avatar (resize) | Auth |

### 2.2 Implemented Modules (AI Service - Python)

> **Base Path:** `/ai` (Mapped via NGINX to Internal Port 8000)

#### 2.2.1 Chat & Sessions (`/ai/chat`)
| Method | Endpoint | Description | Access |
|--------|----------|-------------|--------|
| POST | `/ai/chat/sessions` | Create new chat session | Auth |
| GET | `/ai/chat/sessions` | List history sessions | Auth |
| GET | `/ai/chat/sessions/{id}` | Get session details | Auth |
| WS | `/ws/chat/{session_id}` | WebSocket Real-time Chat | Auth |

#### 2.2.2 Agent Management (`/ai/agents`)
| Method | Endpoint | Description | Access |
|--------|----------|-------------|--------|
| GET | `/ai/agents` | List agents (Single/Multi) | Auth |
| GET | `/ai/agents/{id}` | Get agent detail | Auth |
| PUT | `/ai/agents/{id}` | Update config (Temp, Model, Params) | Admin |
| PUT | `/ai/agents/{id}/prompt` | Update System Prompt (Versioning) | Admin |
| GET | `/ai/agents/{id}/prompt-history` | View Prompt History | Admin |
| POST | `/ai/agents/{id}/test` | Test Agent (ReAct Trace) | Admin |

#### 2.2.3 Tool Registry (`/ai/tools`)
| Method | Endpoint | Description | Access |
|--------|----------|-------------|--------|
| POST | `/ai/tools/scan` | Scan & Sync Code-based Tools (FastMCP) | Admin |
| GET | `/ai/tools` | List Registered Tools | Admin |
| PUT | `/ai/tools/{id}/enable` | Enable/Disable Tool | Admin |
| POST | `/ai/tools/{id}/assign` | Assign tool to Agent | Admin |

#### 2.2.4 Knowledge Base RAG (`/ai/knowledge`)
| Method | Endpoint | Description | Access |
|--------|----------|-------------|--------|
| POST | `/ai/knowledge/upload` | Upload PDF/Docx | Admin |
| POST | `/ai/knowledge/documents/{id}/process` | Index to Qdrant (Cohere Embedding) | Admin |
| GET | `/ai/knowledge/documents` | List documents status | Admin |
| POST | `/ai/knowledge/query` | Test RAG Retrieval | Admin |
| GET | `/ai/knowledge/status` | KB Status & Stats | Admin |

### 2.3 Planned Modules (Backend)

#### 2.3.1 Patient Management Module

> **Status:** Design Approved. Endpoint paths finalized.

| Method | Endpoint | Description | Access |
|--------|----------|-------------|--------|
| GET | `/api/clinics/{id}/patients` | List patients of clinic | CM, VET |
| GET | `/api/patients/{id}` | Get Patient & Owner details | CM, VET |
| PUT | `/api/pets/{id}` | Update Patient Info | CM, VET |
| GET | `/api/patients/{id}/emrs` | Get EMR History (Shared) | CM, VET |
| POST | `/api/bookings/{id}/emr` | Create EMR for Booking | VET |
| PUT | `/api/emrs/{id}` | Update EMR Content | VET |
| GET | `/api/patients/{id}/vaccinations` | Get Vaccination History | CM, VET |
| POST | `/api/patients/{id}/vaccinations` | Add Vaccination Record | VET |
| PUT | `/api/vaccinations/{id}` | Edit Vaccination Record | VET |
| DELETE | `/api/vaccinations/{id}` | Delete Vaccination Record | VET |

#### 2.3.2 Booking Management Module
| Method | Endpoint | Description | Access |
|--------|----------|-------------|--------|
| POST | `/api/bookings` | Create new booking (Select slot) | Pet Owner |
| GET | `/api/bookings/my-bookings` | List own bookings | Pet Owner |
| GET | `/api/clinics/{id}/bookings` | List clinic bookings | CM, VET |
| PATCH | `/api/bookings/{id}/status` | Update booking status | CM, VET |

#### 2.3.3 Discovery & Search Module
| Method | Endpoint | Description | Access |
|--------|----------|-------------|--------|
| GET | `/api/discovery/nearby` | Find clinics by coordinates (lat, lng, radius) | Public |
| GET | `/api/discovery/search` | Search by keyword, service, area | Public |
| GET | `/api/discovery/geocoding` | Convert address to coordinates (Map API proxy) | Public |

#### 2.3.4 Vaccination History Module (Merged)
| Method | Endpoint | Description | Access |
|--------|----------|-------------|--------|
| GET | `/api/pets/{petId}/vaccinations` | Get full vaccination history | Auth |
| POST | `/api/bookings/{bookingId}/vaccinations` | Add new vaccination record (Must link to Booking) | VET |
| PUT | `/api/vaccinations/{id}` | Edit record | VET |
| DELETE | `/api/vaccinations/{id}` | Delete record | VET |

---

## 3. DETAILED DESIGN

### 3.1 Authentication & Authorization



#### 3.1.1 Class Diagram

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
        VET
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

#### 3.1.2 User Registration with OTP

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

#### 3.1.3 Login with Username/Password

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

#### 3.1.4 Sign in with Google Account

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

#### 3.1.5 Forgot & Reset Password

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

#### 3.1.6 Logout & Session Management

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

### 3.2 User Profile Management

#### 3.2.1 Class Diagram

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

#### 3.2.2 Update Profile & Avatar

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

#### 3.2.3 Change Email with OTP

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

### 3.3 Staffing & Scheduling Management

#### 3.3.1 Class Diagram

```mermaid
classDiagram
    class ClinicStaffController {
        -ClinicStaffService staffService
        +getStaff(UUID) ResponseEntity
        +hasManager(UUID) ResponseEntity
        +quickAddStaff(UUID, QuickAddStaffRequest) ResponseEntity
        +assignManager(UUID, String) ResponseEntity
        +assignVet(UUID, String) ResponseEntity
        +removeStaff(UUID, UUID) ResponseEntity
    }

    class VetShiftController {
        -VetShiftService vetShiftService
        -AuthService authService
        +createShift(UUID, VetShiftRequest) ResponseEntity
        +getClinicShifts(UUID, LocalDate, LocalDate) ResponseEntity
        +getMyShifts(LocalDate, LocalDate) ResponseEntity
        +getShiftDetail(UUID) ResponseEntity
        +deleteShift(UUID) ResponseEntity
        +bulkDeleteShifts(List~UUID~) ResponseEntity
        +blockSlot(UUID) ResponseEntity
        +unblockSlot(UUID) ResponseEntity
    }

    class ClinicStaffService {
        -ClinicRepository clinicRepository
        -UserRepository userRepository
        -AuthService authService
        -PasswordEncoder passwordEncoder
        +getClinicStaff(UUID) List~StaffResponse~
        +hasManager(UUID) boolean
        +quickAddStaff(UUID, QuickAddStaffRequest) void
        +assignManager(UUID, String) void
        +assignVet(UUID, String) void
        +removeStaff(UUID, UUID) void
    }

    class VetShiftService {
        -VetShiftRepository vetShiftRepository
        -SlotRepository slotRepository
        -ClinicRepository clinicRepository
        -UserRepository userRepository
        -NotificationService notificationService
        +createShifts(UUID, VetShiftRequest) List~VetShiftResponse~
        +getShiftsByClinic(UUID, LocalDate, LocalDate) List~VetShiftResponse~
        +getShiftsByVet(UUID, LocalDate, LocalDate) List~VetShiftResponse~
        +getShiftDetail(UUID) VetShiftResponse
        +deleteShift(UUID) void
        +bulkDeleteShifts(List~UUID~) void
        +blockSlot(UUID) SlotResponse
        +unblockSlot(UUID) SlotResponse
    }

    class UserRepository {
        <<interface>>
        +findById(UUID) Optional~User~
        +findByUsernameOrEmailOrPhone(String, String, String) Optional~User~
        +existsByPhone(String) boolean
        +existsByEmail(String) boolean
        +save(User) User
    }

    class VetShiftRepository {
        <<interface>>
        +findById(UUID) Optional~VetShift~
        +findByClinicAndWorkDateBetween(Clinic, LocalDate, LocalDate) List~VetShift~
        +save(VetShift) VetShift
        +delete(VetShift) void
    }

    class SlotRepository {
        <<interface>>
        +findById(UUID) Optional~Slot~
        +save(Slot) Slot
        +deleteAll(List~Slot~) void
    }

    ClinicStaffController --> ClinicStaffService
    VetShiftController --> VetShiftService
    ClinicStaffService --> UserRepository
    VetShiftService --> VetShiftRepository
    VetShiftService --> SlotRepository
```

#### 3.3.2 Quick Staff Addition

```mermaid
sequenceDiagram
    actor O as Clinic Owner/Manager
    participant UI as Staff List Screen
    participant SC as ClinicStaffController
    participant SS as ClinicStaffService
    participant AS as AuthService
    participant UR as UserRepository
    participant DB as Database

    O->>UI: 1. Fill staff info (Name, Phone, Role)
    UI->>SC: 2. quickAddStaff(clinicId, request)
    activate SC
    SC->>SS: 3. quickAddStaff(clinicId, request)
    activate SS
    SS->>UR: 4. existsByPhone(phone)
    activate UR
    UR->>DB: 5. Check phone exists
    activate DB
    DB-->>UR: 6. Not exists
    deactivate DB
    UR-->>SS: 7. false
    deactivate UR
    SS->>AS: 8. getCurrentUser()
    activate AS
    AS-->>SS: 9. currentUser
    deactivate AS
    SS->>SS: 10. Validate Permissions & Business Rules
    Note over SS: Check Ownership, Manager Role, Max 1 Manager
    SS->>SS: 11. Create User & set workingClinic
    SS->>UR: 12. save(New Staff)
    activate UR
    UR->>DB: 13. Insert new user
    activate DB
    DB-->>UR: 14. Inserted
    deactivate DB
    UR-->>SS: 15. Saved User Entity
    deactivate UR
    SS-->>SC: 16. StaffResponse
    deactivate SS
    SC-->>UI: 17. 201 Created
    deactivate SC
    UI-->>O: 18. New staff appears in list
```

#### 3.3.3 Clinician Roster Management (Create Shift & Auto-Slots)

```mermaid
sequenceDiagram
    actor M as Clinic Manager
    participant UI as Manager Dashboard (Web)
    participant C as VetShiftController
    participant S as VetShiftService
    participant CR as ClinicRepository
    participant VSR as VetShiftRepository
    participant SR as SlotRepository
    participant DB as Database

    M->>UI: 1. Select Vet, times and multiple Dates
    activate UI
    UI->>C: 2. createShift(clinicId, shiftRequest)
    activate C
    C->>S: 3. createShifts(clinicId, request)
    activate S
    loop For each WorkDate
        S->>CR: 4. findById(clinicId)
        activate CR
        CR->>DB: 5. Query clinic by ID
        activate DB
        DB-->>CR: 6. Clinic Entity
        deactivate DB
        CR-->>S: 7. Clinic (Get Operating Hours)
        deactivate CR
        S->>S: 8. Determine breakStart/End (Clinic Sync)
        S->>VSR: 9. findOverlappingShifts(vetId, workDate, times)
        activate VSR
        VSR->>DB: 10. Query existing shifts for vet on date
        activate DB
        DB-->>VSR: 11. Empty List (no conflicts)
        deactivate DB
        VSR-->>S: 12. []
        deactivate VSR
        S->>S: 13. generateSlots (30-min intervals)
        S->>VSR: 14. save(VetShift)
        activate VSR
        VSR->>DB: 15. Insert new vet shift
        activate DB
        DB-->>VSR: 16. Inserted
        deactivate DB
        VSR-->>S: 17. Saved VetShift
        deactivate VSR
        S->>SR: 18. saveAll(Slots)
        activate SR
        SR->>DB: 19. Batch insert slots
        activate DB
        DB-->>SR: 20. Inserted
        deactivate DB
        SR-->>S: 21. OK
        deactivate SR
    end
    S-->>C: 22. List<VetShiftResponse>
    deactivate S
    C-->>UI: 23. 201 Created
    deactivate C
    UI-->>M: 24. Display shifts on Calendar
    deactivate UI
```

#### 3.3.4 Delete Shift & Slot Operations

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

---

### 3.4 Clinic Management

#### 3.4.1 Class Diagram

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

#### 3.4.2 Create Clinic

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

#### 3.4.3 Approve Clinic (Admin)

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

#### 3.4.4 Upload Clinic Image

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
    CS->>CS: 4. Validate ownership
    CS->>Cloud: 5. uploadImage(file, "clinics")
    activate Cloud
    Cloud-->>CS: 6. UploadResponse (URL, publicId)
    deactivate Cloud
    CS->>CIR: 7. save(ClinicImage entity)
    activate CIR
    CIR-->>CS: 8. OK
    deactivate CIR
    CS-->>CC: 9. ImageResponse
    deactivate CS
    CC-->>UI: 10. ImageResponse(created)
    deactivate CC
    UI-->>Owner: 11. Display new image in gallery
    deactivate UI
```

#### 3.4.5 Search Nearby Clinics

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


### 3.5 Pet Management

#### 3.5.1 Class Diagram

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

#### 3.5.2 Create Pet

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

#### 3.5.3 Update Pet

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

#### 3.5.4 Delete Pet

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




### 3.6 Vet Shift & Slot Management

Module quản lý lịch làm việc của bác sĩ, tự động tạo các slot 30 phút khi tạo shift.

#### 3.6.1 Class Diagram (Backend)

```mermaid
classDiagram
    class VetShiftController {
        -VetShiftService vetShiftService
        +createShifts(UUID, VetShiftRequest) ResponseEntity
        +getClinicShifts(UUID, LocalDate, LocalDate) ResponseEntity
        +getMyShifts(LocalDate, LocalDate) ResponseEntity
        +deleteShift(UUID) ResponseEntity
        +blockSlot(UUID) ResponseEntity
        +unblockSlot(UUID) ResponseEntity
    }

    class VetShiftService {
        -VetShiftRepository vetShiftRepository
        -SlotRepository slotRepository
        -ClinicRepository clinicRepository
        -NotificationService notificationService
        +createShifts(UUID, VetShiftRequest) List~VetShiftResponse~
        +deleteShift(UUID) void
        +blockSlot(UUID) SlotResponse
        +generateSlots(VetShift) void
    }

    class VetShiftRepository {
        <<interface>>
        +findByVetAndWorkDate(User, LocalDate) List~VetShift~
        +save(VetShift) VetShift
        +delete(VetShift) void
    }

    class SlotRepository {
        <<interface>>
        +saveAll(Iterable) List
        +deleteByShift(VetShift) void
    }

    class VetShift {
        +UUID shiftId
        +User vet
        +Clinic clinic
        +LocalDate workDate
        +LocalTime startTime
        +LocalTime endTime
        +Boolean isOvernight
    }

    class Slot {
        +UUID slotId
        +VetShift shift
        +LocalTime startTime
        +SlotStatus status
    }

    VetShiftController --> VetShiftService
    VetShiftService --> VetShiftRepository
    VetShiftService --> SlotRepository
    VetShiftRepository ..> VetShift
    SlotRepository ..> Slot
    VetShift "1" *-- "many" Slot
```

#### 3.6.2 Entity Specifications

**VetShift Entity:**

| Field | Type | Description |
|-------|------|-------------|
| shiftId | UUID | Primary key |
| vet | User (FK) | Bác sĩ được phân công |
| clinic | Clinic (FK) | Phòng khám |
| workDate | LocalDate | Ngày làm việc |
| startTime | LocalTime | Giờ bắt đầu ca |
| endTime | LocalTime | Giờ kết thúc ca |
| breakStart | LocalTime | Giờ nghỉ bắt đầu (optional, sync từ Clinic) |
| breakEnd | LocalTime | Giờ nghỉ kết thúc (optional) |
| isOvernight | Boolean | Ca đêm - endTime sang ngày hôm sau |
| notes | String | Ghi chú (max 500 chars) |
| createdAt | LocalDateTime | Thời điểm tạo |
| updatedAt | LocalDateTime | Thời điểm cập nhật |

**Slot Entity:**

| Field | Type | Description |
|-------|------|-------------|
| slotId | UUID | Primary key |
| shift | VetShift (FK) | Ca làm việc chứa slot này |
| startTime | LocalTime | Giờ bắt đầu slot |
| endTime | LocalTime | Giờ kết thúc slot |
| status | SlotStatus | AVAILABLE, BOOKED, BLOCKED |
| createdAt | LocalDateTime | Thời điểm tạo |
| updatedAt | LocalDateTime | Thời điểm cập nhật |

**VetShiftRequest DTO:**

| Field | Type | Description |
|-------|------|-------------|
| vetId | UUID | ID bác sĩ được phân công (required) |
| workDates | List<LocalDate> | Danh sách ngày làm việc (required, max 14) |
| startTime | LocalTime | Giờ bắt đầu (required) |
| endTime | LocalTime | Giờ kết thúc (required) |
| isOvernight | Boolean | Ca đêm flag (default: false) |
| repeatWeeks | Integer | Số tuần lặp lại (1-12, default: 1) |
| forceUpdate | Boolean | Ghi đè shift cũ (default: false) |
| notes | String | Ghi chú |

**VetShiftResponse DTO:**

| Field | Type | Description |
|-------|------|-------------|
| shiftId | UUID | ID ca làm việc |
| vetId, vetName, vetAvatar | - | Thông tin bác sĩ |
| clinicId | UUID | ID phòng khám |
| workDate | LocalDate | Ngày làm việc gốc |
| displayDate | LocalDate | Ngày hiển thị (cho ca đêm tiếp tục) |
| isContinuation | Boolean | Đánh dấu phần tiếp tục của ca đêm |
| startTime, endTime | LocalTime | Thời gian ca |
| breakStart, breakEnd | LocalTime | Thời gian nghỉ |
| isOvernight | Boolean | Ca đêm |
| totalSlots, availableSlots, bookedSlots, blockedSlots | int | Thống kê slots |
| slots | List<SlotResponse> | Chi tiết từng slot (optional) |

#### 3.6.3 API Access Matrix

| Endpoint | Description | PET_OWNER | VET | CM | CO | ADMIN |
|----------|-------------|:---------:|:---:|:--:|:--:|:-----:|
| POST /api/clinics/{id}/shifts | Tạo shifts với auto-gen slots | - | - | ✓ | ✓ | - |
| GET /api/clinics/{id}/shifts | Lấy shifts theo date range | - | ✓ | ✓ | ✓ | - |
| GET /api/shifts/me | Lấy shifts của vet đang đăng nhập | - | ✓ | - | - | - |
| GET /api/shifts/{id} | Chi tiết shift + slots | - | ✓ | ✓ | ✓ | - |
| DELETE /api/shifts/{id} | Xóa shift (blocked nếu có booking) | - | - | ✓ | ✓ | - |
| DELETE /api/shifts/bulk | Xóa nhiều shifts | - | - | ✓ | ✓ | - |
| PATCH /api/slots/{id}/block | Block slot | - | - | ✓ | ✓ | - |
| PATCH /api/slots/{id}/unblock | Unblock slot | - | - | ✓ | ✓ | - |

> **Lưu ý:** VET không có quyền block/unblock slot. Nếu Vet cần block slot, phải liên hệ Manager.

#### 3.6.4 Business Rules

1. **Slot Duration:** Tự động tạo slots 30 phút khi tạo shift
2. **Break Time Sync:** Giờ nghỉ tự động lấy từ Clinic Operating Hours nếu shift nằm trong khoảng đó
3. **Overnight Shifts:** Nếu endTime < startTime (vd: 22:00 → 06:00), hệ thống tự detect và set isOvernight = true
4. **Overlap Prevention:** Mỗi vet chỉ có 1 shift/ngày. Sử dụng forceUpdate=true để ghi đè shift cũ
5. **Delete Protection:** Không thể xóa shift có slots ở trạng thái BOOKED
6. **Block Permission:** Chỉ CLINIC_OWNER và CLINIC_MANAGER được block/unblock slots
7. **Repeat Weeks:** Có thể tạo lịch lặp lại tối đa 12 tuần liên tiếp
8. **Past Date Skip:** Không tạo shift cho ngày trong quá khứ
9. **Closed Day Skip:** Không tạo shift vào ngày phòng khám đóng cửa
10. **SSE Notifications:** Gửi batch notification cho Vet khi được assign shifts mới

#### 3.6.5 Sequence Diagram: Create Shifts (with Conflict Check)

```mermaid
sequenceDiagram
    actor M as Clinic Manager
    participant UI as Manager Dashboard (Web)
    participant C as VetShiftController
    participant S as VetShiftService
    participant VSR as VetShiftRepository
    participant SR as SlotRepository
    participant NS as NotificationService
    participant DB as Database

    M->>UI: 1. Select Vet, times, multiple Dates
    M->>UI: 2. Click "Save" (forceUpdate=false)
    activate UI
    UI->>C: 3. createShifts(clinicId, request)
    activate C
    C->>S: 4. createShifts(clinicId, request)
    activate S
    loop For each WorkDate
        S->>VSR: 5. findByVetAndWorkDate(vet, date)
        activate VSR
        VSR->>DB: 6. Query vet shifts for date
        activate DB
        DB-->>VSR: 7. Existing Shifts List
        deactivate DB
        VSR-->>S: 8. List<VetShift>
        deactivate VSR
        S->>S: 9. Check Overlaps (timesOverlap helper)
    end
    alt Conflict Detected & forceUpdate=false
        S-->>C: 10a. 409 Conflict (Conflict details)
        C-->>UI: 11a. Conflict Notification
        UI-->>M: 12a. Show Conflict Warning Modal
        M->>UI: 13a. Click "Confirm Override" (forceUpdate=true)
        UI->>C: 14a. createShifts(clinicId, request, forceUpdate=true)
        C->>S: 15a. createShifts(clinicId, request)
    end
    
    loop For each WorkDate (Safe or Forced)
        S->>S: 16. Determine breakStart/End from Clinic
        S->>VSR: 17. save(VetShift)
        activate VSR
        VSR->>DB: 18. Insert new vet shift
        activate DB
        DB-->>VSR: 19. Inserted
        deactivate DB
        VSR-->>S: 20. Saved VetShift
        deactivate VSR
        S->>S: 21. generateSlots (30-min intervals, skip break)
        S->>SR: 22. saveAll(Slots)
        activate SR
        SR->>DB: 23. Batch insert slots
        activate DB
        DB-->>SR: 24. Inserted
        deactivate DB
        SR-->>S: 25. OK
        deactivate SR
    end
    S->>NS: 26. notifyVetShiftsBatchAssigned(vet, shifts)
    S-->>C: 27. List<VetShiftResponse>
    deactivate S
    C-->>UI: 28. 201 Created
    deactivate C
    UI-->>M: 29. Display shifts on Calendar
    deactivate UI
```

#### 3.6.6 Sequence Diagram: Block Slot

```mermaid
sequenceDiagram
    actor M as Clinic Manager
    participant UI as Manager Dashboard (Web)
    participant C as VetShiftController
    participant S as VetShiftService
    participant SR as SlotRepository
    participant DB as Database

    M->>UI: 1. Click lock icon on slot
    activate UI
    UI->>C: 2. blockSlot(slotId)
    activate C
    C->>S: 3. blockSlot(slotId)
    activate S
    S->>SR: 4. findById(slotId)
    activate SR
    SR->>DB: 5. Query slot by ID
    activate DB
    DB-->>SR: 6. Slot Entity
    deactivate DB
    SR-->>S: 7. Slot
    deactivate SR
    alt Slot is BOOKED
        S-->>C: 8a. throw BadRequestException
        C-->>UI: 9a. 400 Error: Cannot block booked slot
    else Slot is AVAILABLE
        S->>SR: 8b. save(slot with BLOCKED status)
        activate SR
        SR->>DB: 9b. Update slot status to BLOCKED
        activate DB
        DB-->>SR: 10b. Updated
        deactivate DB
        SR-->>S: 11b. Saved Slot
        deactivate SR
        S-->>C: 12b. SlotResponse
        deactivate S
        C-->>UI: 13b. 200 OK
        deactivate C
        UI-->>M: 14b. Update slot icon to locked
        deactivate UI
    end
```


### 3.7 Patient Management

#### 3.7.1 Class Diagram

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

#### 3.7.2 View Pet Medical History (Cross-Clinic)

```mermaid
sequenceDiagram
    actor V as Vet
    participant UI as Vet Dashboard
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

#### 3.7.3 Create EMR (EMR-2 Electronic Medical Record)

```mermaid
sequenceDiagram
    actor V as Vet
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
    PS->>PS: 9. Validate Vet is assigned
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

#### 3.7.4 Add Vaccination Record

```mermaid
sequenceDiagram
    actor V as Vet
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

#### 3.7.5 Ghi nhận Dịch vụ & Chi phí phát sinh (Incurred Items)

```mermaid
sequenceDiagram
    actor V as Vet
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
#### 3.8 Booking Management

#### 3.8.1 Class Diagram (Backend)

```mermaid
classDiagram
    class BookingController {
        -BookingService bookingService
        +createBooking(BookingRequest) ResponseEntity
        +getClinicBookings(UUID, LocalDate) ResponseEntity
        +updateBookingStatus(UUID, BookingStatus) ResponseEntity
    }

    class BookingService {
        -BookingRepository bookingRepository
        -SlotRepository slotRepository
        -PetRepository petRepository
        +createBooking(BookingRequest) BookingResponse
        +updateBookingStatus(UUID, BookingStatus) void
        +cancelBooking(UUID, String) void
    }

    class BookingRepository {
        <<interface>>
        +findById(UUID) Optional~Booking~
        +findByClinicAndAppointmentDate(Clinic, LocalDate) List~Booking~
        +save(Booking) Booking
    }

    class Booking {
        +UUID bookingId
        +Pet pet
        +Clinic clinic
        +BookingStatus status
        +LocalDate appointmentDate
        +BigDecimal totalPrice
        +BigDecimal surcharge
    }

    class BookingStatus {
        <<enumeration>>
        PENDING
        CONFIRMED
        CHECKED_IN
        COMPLETED
        CANCELLED
        NO_SHOW
    }

    BookingController --> BookingService
    BookingService --> BookingRepository
    BookingRepository ..> Booking
    Booking --> BookingStatus
```

#### 3.8.2 Create Appointment (BOK-1 Mobile Booking Wizard)

```mermaid
sequenceDiagram
    actor PO as Pet Owner
    participant UI as Mobile Wizard (5-Steps)
    participant BC as BookingController
    participant BS as BookingService
    participant SR as SlotRepository
    participant DB as Database

    PO->>UI: 1. Step 1-3: Choose Pet, Service, Vet
    UI->>BC: 2. GET /api/clinics/{id}/available-slots (filtered)
    BC-->>UI: 3. Available Slots List
    PO->>UI: 4. Step 4: Select Slot & Date
    PO->>UI: 5. Step 5: Review & Enter Address (if Home)
    activate UI
    UI->>BC: 6. createBooking(BookingRequest)
    activate BC
    BC->>BS: 7. createBooking(request)
    activate BS
    BS->>BS: 8. Validate slots (availability & distance)
    BS->>BS: 9. Calculate total price (Base + Weight + Distance)
    BS->>DB: 10. saveAll (Booking + link to Slots)
    BS->>SR: 11. Lock Slots (status=BOOKED, TTL=15m for payment)
    BS-->>BC: 12. BookingResponse
    deactivate BS
    BC-->>UI: 13. 201 Created
    deactivate BC
    UI-->>PO: 14. Show "Proceed to Payment" (Step 6)
    deactivate UI
```

#### 3.8.3 Confirm / Update Booking (Clinic Manager)

```mermaid
sequenceDiagram
    actor M as Clinic Manager
    participant UI as Manager Web Dashboard
    participant BC as BookingController
    participant BS as BookingService
    participant BR as BookingRepository
    participant DB as Database

    M->>UI: 1. View Pending Bookings
    M->>UI: 2. Click "Confirm Booking"
    activate UI
    UI->>BC: 3. updateBookingStatus(id, status=CONFIRMED)
    activate BC
    BC->>BS: 4. updateBookingStatus(id, status)
    activate BS
    BS->>BR: 5. findById(id)
    activate BR
    BR->>DB: 6. Query booking by ID
    activate DB
    DB-->>BR: 7. Booking Entity
    deactivate DB
    BR-->>BS: 8. Booking
    deactivate BR
    BS->>BR: 9. save(Updated Booking)
    activate BR
    BR->>DB: 10. Update booking status to CONFIRMED
    activate DB
    DB-->>BR: 11. Updated
    deactivate DB
    BR-->>BS: 12. OK
    deactivate BR
    BS-->>BC: 13. Updated Booking
    deactivate BS
    BC-->>UI: 14. 200 OK
    deactivate BC
    UI-->>M: 15. Refresh booking list
    deactivate UI
```

### 3.9 Real-time Location Tracking (SOS Emergency)

#### 3.9.1 Class Diagram

```mermaid
classDiagram
    class TrackingController {
        -TrackingService trackingService
        +updateLocation(LocationDto) void
    }

    class TrackingService {
        -BookingRepository bookingRepository
        -RedisTemplate redisTemplate
        -MapsService mapsService
        -SimpMessagingTemplate messagingTemplate
        +processLocationUpdate(LocationDto) void
        +getETA(BookingId) String
    }

    class MapsService {
        +getDistanceMatrix(origin, destination) DistanceMatrixResponse
    }

    TrackingController --> TrackingService
    TrackingService --> MapsService
    TrackingService --> BookingRepository
```

#### 3.9.2 Sequence Diagram

```mermaid
sequenceDiagram
    actor V as Vet (Mobile)
    participant TS as TrackingService
    participant RD as Redis
    participant MS as MapsService (Goong)
    participant O as Pet Owner (Mobile)

    loop Every 10 seconds (Status: EN_ROUTE, BookingType: SOS)
        V->>TS: 1. updateLocation(LocationDto)
        activate TS
        TS->>RD: 2. Cache current location
        TS->>MS: 3. requestETA(origin: Vet, dest: Owner)
        activate MS
        MS-->>TS: 4. ETA: 15 mins (5.2 km)
        deactivate MS
        TS->>O: 5. Broadcast {lat, lng, eta} via WebSocket
        Note right of O: UI updates Marker position & ETA toast
        deactivate TS
    end
```


### 3.10 AI Agent Assistance (Lớp thông minh)

#### 3.10.1 Class Diagram (Python AI Service)

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

#### 3.10.2 Sequence Diagram: AI ReAct Loop

```mermaid
sequenceDiagram
    actor PO as Pet Owner
    participant UI as Chat UI (Mobile)
    participant AC as AgentController
    participant AS as AgentService
    participant LG as LangGraphEngine
    participant TR as ToolRegistry
    participant RE as RAGEngine

    PO->>UI: 1. Send "Book Vet for Bella tomorrow"
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

---

## 4. TECHNOLOGY STACK SUMMARY

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
**Document Version:** 1.2.0
**Last Updated:** 2026-01-07
