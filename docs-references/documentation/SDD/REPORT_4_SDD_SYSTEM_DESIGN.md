# II. Software Design Document

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
        Python["Python FastAPI<br/>- AI Agent Service<br/>- Real-time Chat<br/>- RAG Pipeline"]
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
| POST | `/api/auth/login` | Email/Password login | Public |
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
| POST | `/api/clinics/{id}/staff/quick-add` | Quick add Vet/Manager | CM, CO |
| DELETE | `/api/clinics/{id}/staff/{userId}` | Remove staff | CM, CO |

#### 2.1.5 Clinic Services (`/services`)
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

#### 2.3.2 Shift & Slot Management Module
| Method | Endpoint | Description | Access |
|--------|----------|-------------|--------|
| GET | `/api/clinics/{id}/shifts` | Get shift list (filter: dateRange, vetId) | CM, CO |
| POST | `/api/clinics/{id}/shifts` | Create new shift (Auto-generate 30min slots) | CM, CO |
| PUT | `/api/shifts/{id}` | Update shift time | CM, CO |
| DELETE | `/api/shifts/{id}` | Delete shift (Delete unbooked slots) | CM, CO |
| GET | `/api/shifts/my-shifts` | View own schedule | VET |
| GET | `/api/clinics/{id}/slots` | Get slots for the day | CM, VET, Public |
| PATCH | `/api/slots/{id}/block` | Block/Unblock slot manually | CM, VET |

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

This feature provides mechanisms for account registration, user authentication (Login), session management (Refresh Token), and logout (Logout). The system utilizes JWT (JSON Web Token) to secure APIs and supports Google OAuth 2.0 sign-in.

#### 3.1.1 Class Diagram

```mermaid
classDiagram
    class AuthController {
        -AuthService authService
        -RegistrationOtpService registrationOtpService
        +register(RegisterRequest) ResponseEntity
        +sendRegistrationOtp(SendOtpRequest) ResponseEntity
        +verifyOtpAndRegister(VerifyOtpRequest) ResponseEntity
        +login(LoginRequest) ResponseEntity
        +googleLogin(GoogleLoginRequest) ResponseEntity
        +forgotPassword(ForgotPasswordRequest) ResponseEntity
        +resetPassword(ResetPasswordRequest) ResponseEntity
        +logout() ResponseEntity
    }

    class AuthService {
        -UserRepository userRepository
        -JwtTokenProvider tokenProvider
        -AuthenticationManager authenticationManager
        -RefreshTokenRepository refreshTokenRepository
        +login(LoginRequest) AuthResponse
        +register(RegisterRequest) AuthResponse
        +googleLogin(String idToken) AuthResponse
        +validatePlatformAccess(User, String) void
        +logout(String token) void
    }

    class User {
        +UUID userId
        +String username
        +String password
        +String email
        +String phone
        +String fullName
        +Role role
        +Clinic workingClinic
        +List~Clinic~ ownedClinics
    }

    class Role {
        <<enumeration>>
        PET_OWNER
        VET
        CLINIC_MANAGER
        CLINIC_OWNER
        ADMIN
    }

    class RefreshToken {
        +UUID tokenId
        +UUID userId
        +String tokenHash
        +LocalDateTime expiresAt
    }

    class BlacklistedToken {
        +UUID tokenId
        +String tokenHash
        +UUID userId
        +LocalDateTime expiresAt
    }

    AuthController --> AuthService
    AuthController --> RegistrationOtpService
    AuthService --> User
    AuthService --> RefreshToken
    User --> Role
    User --> RefreshToken
```

#### 3.1.2 User Registration with OTP

**Description:** Allow new users to create accounts with email verification via OTP.

**Class Specifications:**
- **AuthController.sendRegistrationOtp(SendOtpRequest):** Receives registration info, triggers OTP sending.
- **AuthController.verifyOtpAndRegister(VerifyOtpRequest):** Validates OTP and completes registration.
- **RegistrationOtpService:** Manages OTP generation, Redis storage (TTL 5m), and email dispatch.

**Sequence Diagram:**

```mermaid
sequenceDiagram
    actor User as Pet Owner
    participant UI as Register Screen (Mobile/Web)
    participant AC as AuthController
    participant ROS as RegistrationOtpService
    participant ORS as OtpRedisService
    participant ES as EmailService
    participant AS as AuthService
    participant DB as Database

    User->>UI: 1. Input info & click "Send OTP"
    activate UI
    UI->>AC: 2. POST /auth/register/send-otp
    activate AC
    AC->>ROS: 3. sendRegistrationOtp(Request)
    activate ROS
    ROS->>DB: 4. Check if User exists
    activate DB
    DB-->>ROS: 5. User not found
    deactivate DB
    ROS->>ORS: 6. saveOtp(email, otp)
    activate ORS
    ORS-->>ROS: 7. OK
    deactivate ORS
    ROS->>ES: 8. sendEmail(email, otp)
    activate ES
    ES-->>User: 9. Receive OTP via Email
    deactivate ES
    ROS-->>AC: 10. Success
    deactivate ROS
    AC-->>UI: 11. 200 OK (OTP Sent)
    deactivate AC
    UI-->>User: 12. Show OTP Input Screen
    deactivate UI

    User->>UI: 13. Input OTP & click "Register"
    activate UI
    UI->>AC: 14. POST /auth/register/verify-otp
    activate AC
    AC->>ROS: 15. verifyOtpAndRegister(Request)
    activate ROS
    ROS->>ORS: 16. validateOtp(email, otp)
    activate ORS
    ORS-->>ROS: 17. Valid
    deactivate ORS
    ROS->>AS: 18. register(Request)
    activate AS
    AS->>DB: 19. save(New User)
    activate DB
    DB-->>AS: 20. Saved User Entity
    deactivate DB
    AS-->>ROS: 21. AuthResponse (Tokens)
    deactivate AS
    ROS-->>AC: 22. AuthResponse
    deactivate ROS
    AC-->>UI: 23. 201 Created (Tokens)
    deactivate AC
    UI-->>User: 24. Redirect to Home Page
    deactivate UI
```

#### 3.1.3 Login with Email/Password

**Description:** Authenticate users with email and password credentials.

> **Business Rule BR-003-06:** Pet Owners can register via Web but can only log in and use the system via the Mobile app. Web portal access is blocked for this role.

**Class Specifications:**
- **AuthController.login(LoginRequest):** Receives login credentials, validates platform access, returns tokens.
- **AuthService.validatePlatformAccess(User, platform):** Enforces BR-003-06 by blocking `PET_OWNER` from Web login.
- **AuthService.generateTokenPair(User):** Creates Access Token (24h) and Refresh Token (7d).

**Sequence Diagram:**

```mermaid
sequenceDiagram
    actor User as User
    participant UI as Login Screen
    participant AC as AuthController
    participant AS as AuthService
    participant AM as AuthenticationManager
    participant JTP as JwtTokenProvider
    participant DB as Database

    User->>UI: 1. Input Email/Password & click "Login"
    UI->>AC: 2. login(email, password, platform)
    AC->>AS: 3. login(LoginRequest, platform)
    AS->>AM: 4. authenticate(credentials)
    AM-->>AS: 5. Authentication Object
    
    alt Role = PET_OWNER AND Platform = Web
        AS-->>AC: 6a. 403 Forbidden
        AC-->>UI: 7a. Error: "PET_OWNER can only login via Mobile app"
        UI-->>User: 8a. Show Mobile App Download Prompt
    else Valid Platform
        AS->>JTP: 6b. generateToken(userId, role)
        JTP-->>AS: 7b. Access Token
        AS->>JTP: 8b. generateRefreshToken(userId)
        JTP-->>AS: 9b. Refresh Token
        AS->>DB: 10b. save(RefreshTokenHash)
        DB-->>AS: 11b. Persistent OK
        AS-->>AC: 12b. AuthResponse
        AC-->>UI: 13b. AuthResponse(tokens)
        UI-->>User: 14b. Login Successful
    end
```

#### 3.1.4 Sign in with Google Account

**Description:** Allow users to authenticate using Google OAuth 2.0. Supports both login and auto-registration.

**Class Specifications:**
- **AuthController.googleLogin(GoogleLoginRequest):** Receives Google ID Token from client.
- **AuthService.googleLogin(String idToken):** Verifies token with Google API, creates user if not exists, returns JWT tokens.

**Sequence Diagram:**

```mermaid
sequenceDiagram
    actor User as User
    participant UI as Login Screen
    participant AC as AuthController
    participant AS as AuthService
    participant Google as Google OAuth API
    participant DB as Database
    participant JTP as JwtTokenProvider

    User->>UI: 1. Click "Sign in with Google"
    activate UI
    UI->>Google: 2. Redirect to Google Sign-In
    activate Google
    Google-->>UI: 3. Return ID Token
    deactivate Google
    UI->>AC: 4. googleLogin(idToken)
    activate AC
    AC->>AS: 5. googleLogin(idToken)
    activate AS
    AS->>Google: 6. Verify ID Token
    activate Google
    Google-->>AS: 7. User Info (email, name, picture)
    deactivate Google
    AS->>DB: 8. Find user by email
    activate DB
    
    alt User not exists
        DB-->>AS: 9a. Return null
        deactivate DB
        AS->>DB: 10a. Create new User (role: PET_OWNER)
        activate DB
        DB-->>AS: 11a. Saved User
        deactivate DB
    else User exists
        DB-->>AS: 9b. Existing User
        deactivate DB
    end
    
    AS->>JTP: 12. generateTokenPair(user)
    activate JTP
    JTP-->>AS: 13. Access Token + Refresh Token
    deactivate JTP
    AS-->>AC: 14. AuthResponse
    deactivate AS
    AC-->>UI: 15. AuthResponse(tokens)
    deactivate AC
    UI-->>User: 16. Login Successful
    deactivate UI
```

#### 3.1.5 Forgot & Reset Password

**Description:** Allow users to recover account access via email OTP verification.

**Class Specifications:**
- **AuthController.forgotPassword(ForgotPasswordRequest):** Initiates password reset, sends OTP to email.
- **AuthController.resetPassword(ResetPasswordRequest):** Validates OTP and updates password.

**Sequence Diagram:**

```mermaid
sequenceDiagram
    actor User as User
    participant UI as Forgot Password Screen
    participant AC as AuthController
    participant PS as PasswordResetService
    participant ORS as OtpRedisService
    participant ES as EmailService
    participant DB as Database

    User->>UI: 1. Input Email & click "Send OTP"
    activate UI
    UI->>AC: 2. forgotPassword(email)
    activate AC
    AC->>PS: 3. sendPasswordResetOtp(email)
    activate PS
    PS->>DB: 4. Check if User exists
    activate DB
    DB-->>PS: 5. User found
    deactivate DB
    PS->>ORS: 6. saveOtp(email, otp)
    activate ORS
    ORS-->>PS: 7. OK
    deactivate ORS
    PS->>ES: 8. sendEmail(email, otp)
    activate ES
    ES-->>User: 9. Receive OTP via Email
    deactivate ES
    PS-->>AC: 10. Success
    deactivate PS
    AC-->>UI: 11. OTP Sent Successfully
    deactivate AC
    UI-->>User: 12. Show Reset Password Form
    deactivate UI

    User->>UI: 13. Input OTP & New Password
    activate UI
    UI->>AC: 14. resetPassword(email, otp, newPassword)
    activate AC
    AC->>PS: 15. resetPassword(email, otp, newPassword)
    activate PS
    PS->>ORS: 16. validateOtp(email, otp)
    activate ORS
    ORS-->>PS: 17. Valid
    deactivate ORS
    PS->>DB: 18. Update password hash
    activate DB
    DB-->>PS: 19. OK
    deactivate DB
    PS->>DB: 20. Invalidate all RefreshTokens
    activate DB
    DB-->>PS: 21. OK
    deactivate DB
    PS-->>AC: 22. Success
    deactivate PS
    AC-->>UI: 23. Password Reset Success
    deactivate AC
    UI-->>User: 24. Redirect to Login
    deactivate UI
```

#### 3.1.6 Logout & Session Management

**Description:** Terminate user session and invalidate tokens.

**Class Specifications:**
- **AuthController.logout():** Receives current access token, triggers logout process.
- **AuthService.logout(String token):** Blacklists the access token and deletes refresh token from DB.

**Sequence Diagram:**

```mermaid
sequenceDiagram
    actor User as User
    participant UI as App/Web
    participant AC as AuthController
    participant AS as AuthService
    participant DB as Database

    User->>UI: 1. Click "Logout"
    activate UI
    UI->>AC: 2. logout(accessToken)
    activate AC
    AC->>AS: 3. logout(accessToken)
    activate AS
    AS->>DB: 4. Blacklist AccessToken
    activate DB
    DB-->>AS: 5. OK
    deactivate DB
    AS->>DB: 6. Delete RefreshToken
    activate DB
    DB-->>AS: 7. OK
    deactivate DB
    AS-->>AC: 8. Success
    deactivate AS
    AC-->>UI: 9. Logout Success
    deactivate AC
    UI->>UI: 10. Clear local storage
    UI-->>User: 11. Redirect to Login Screen
    deactivate UI
```


### 3.2 Clinic Management

This feature is for Clinic Owners to register and manage clinic information, and for Admins to review and approve clinic profiles.

#### 3.2.1 Class Diagram

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
        +createClinic(ClinicRequest, UUID ownerId) ClinicResponse
        +updateClinic(UUID, ClinicRequest, UUID) ClinicResponse
        +approveClinic(UUID, String) ClinicResponse
        +rejectClinic(UUID, String) ClinicResponse
        +findNearbyClinics(BigDecimal, BigDecimal, Double) List~ClinicResponse~
    }

    class Clinic {
        +UUID clinicId
        +String name
        +String description
        +String address
        +String phone
        +String email
        +BigDecimal latitude
        +BigDecimal longitude
        +ClinicStatus status
        +BigDecimal ratingAvg
        +Integer ratingCount
        +User owner
        +List~ClinicImage~ images
        +List~ClinicService~ services
        +List~OperatingHours~ operatingHours
    }

    class ClinicStatus {
        <<enumeration>>
        PENDING
        APPROVED
        REJECTED
        SUSPENDED
    }

    class ClinicImage {
        +UUID imageId
        +String imageUrl
        +String caption
        +Integer displayOrder
        +Boolean isPrimary
    }

    class ClinicServiceEntity {
        +UUID serviceId
        +String name
        +BigDecimal basePrice
        +Integer durationTime
        +Boolean isHomeVisit
        +BigDecimal pricePerKm
    }

    class MasterService {
        +UUID masterServiceId
        +String name
        +BigDecimal defaultPrice
        +Boolean isHomeVisit
    }

    class CloudinaryService {
        +uploadImage(MultipartFile, String folder) UploadResponse
        +deleteImage(String publicId) void
    }

    ClinicController --> ClinicService
    ClinicController --> CloudinaryService
    ClinicService --> Clinic
    Clinic --> ClinicStatus
    Clinic --> ClinicImage
    Clinic --> ClinicServiceEntity
    ClinicServiceEntity --> MasterService
```

#### 3.2.2 Create Clinic

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
    CS->>DB: 6. save(Clinic Entity with status=PENDING)
    activate DB
    DB-->>CS: 7. Saved Clinic
    deactivate DB
    CS-->>CC: 8. ClinicResponse
    deactivate CS
    CC-->>UI: 9. ClinicResponse(created)
    deactivate CC
    UI-->>Owner: 10. Show "Pending Approval" notification
    deactivate UI
```

#### 3.2.3 Approve Clinic (Admin)

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
    CS->>DB: 4. findById(id)
    activate DB
    DB-->>CS: 5. Clinic Entity
    deactivate DB
    CS->>CS: 6. Validate status == PENDING
    CS->>DB: 7. Update status = APPROVED
    activate DB
    DB-->>CS: 8. OK
    deactivate DB
    CS-->>CC: 9. ClinicResponse
    deactivate CS
    CC-->>UI: 10. ApproveResponse(success)
    deactivate CC
    UI-->>Admin: 11. Show "Approved" status
    deactivate UI
```

#### 3.2.4 Upload Clinic Image

```mermaid
sequenceDiagram
    actor Owner as Clinic Owner
    participant UI as Clinic Edit Screen
    participant CC as ClinicController
    participant CS as ClinicService
    participant Cloud as CloudinaryService
    participant DB as Database

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
    CS->>DB: 7. save(ClinicImage entity)
    activate DB
    DB-->>CS: 8. OK
    deactivate DB
    CS-->>CC: 9. ImageResponse
    deactivate CS
    CC-->>UI: 10. ImageResponse(created)
    deactivate CC
    UI-->>Owner: 11. Display new image in gallery
    deactivate UI
```

#### 3.2.5 Search Nearby Clinics

```mermaid
sequenceDiagram
    actor User as Pet Owner
    participant UI as Clinic Search Screen (Mobile)
    participant CC as ClinicController
    participant CS as ClinicService
    participant DB as Database

    User->>UI: 1. Allow location access
    activate UI
    UI->>UI: 2. Get current coordinates (lat, lng)
    UI->>CC: 3. findNearbyClinics(lat, lng, radius)
    activate CC
    CC->>CS: 4. findNearbyClinics(lat, lng, radius)
    activate CS
    CS->>DB: 5. Spatial Query (Haversine formula)
    activate DB
    DB-->>CS: 6. List of Clinics within radius
    deactivate DB
    CS->>CS: 7. Sort by distance ASC
    CS-->>CC: 8. List~ClinicResponse~
    deactivate CS
    CC-->>UI: 9. List<ClinicResponse>
    deactivate CC
    UI-->>User: 10. Display clinics on map & list
    deactivate UI
```


### 3.3 Pet Management

This feature allows Pet Owners to manage their pets' information, including creating, updating, and deleting pet profiles.

#### 3.3.1 Class Diagram

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
        +validateOwnership(Pet, User) void
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
        +List~EMR~ medicalRecords
        +List~Vaccination~ vaccinations
    }

    class CloudinaryService {
        +uploadImage(MultipartFile, String folder) UploadResponse
        +deleteImage(String publicId) void
    }

    PetController --> PetService
    PetService --> Pet
    PetService --> CloudinaryService
```

#### 3.3.2 Create Pet

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
    PS->>DB: 8. save(Pet Entity)
    activate DB
    DB-->>PS: 9. Saved Pet
    deactivate DB
    PS-->>PC: 10. PetResponse
    deactivate PS
    PC-->>UI: 11. PetResponse(created)
    deactivate PC
    UI-->>Owner: 12. Show new pet in list
    deactivate UI
```

#### 3.3.3 Update Pet

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

#### 3.3.4 Delete Pet

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


### 3.4 Vet Shift & Slot Management

This module manages veterinarian working schedules and automates the creation of bookable 30-minute time slots, ensuring breaks are correctly handled based on clinic operating hours.

#### 3.4.1 Class Diagram (Backend)

```mermaid
classDiagram
    class VetShiftController {
        -VetShiftService vetShiftService
        +createShift(UUID clinicId, VetShiftRequest) ResponseEntity
        +getClinicShifts(UUID clinicId, LocalDate date) ResponseEntity
        +deleteShift(UUID shiftId) ResponseEntity
    }

    class VetShiftService {
        -VetShiftRepository vetShiftRepository
        -SlotRepository slotRepository
        -SlotGenerator slotGenerator
        +createShift(VetShiftRequest) VetShiftResponse
        +getClinicShifts(UUID clinicId, LocalDate date) ResponseEntity
        +deleteShift(UUID shiftId) void
    }


    class VetShift {
        +UUID shiftId
        +User vet
        +Clinic clinic
        +LocalDate workDate
        +LocalTime startTime
        +LocalTime endTime
        +LocalTime breakStart
        +LocalTime breakEnd
        +List~Slot~ slots
    }

    class Slot {
        +UUID slotId
        +VetShift shift
        +LocalTime startTime
        +LocalTime endTime
        +SlotStatus status
    }

    class SlotGenerator {
        +generate(VetShift) List~Slot~
    }

    class SlotStatus {
        <<enumeration>>
        AVAILABLE
        BOOKED
        BLOCKED
    }

    VetShiftController --> VetShiftService
    VetShiftService --> VetShift
    VetShiftService --> SlotGenerator
    VetShift --> Slot
    Slot --> SlotStatus
```

#### 3.4.2 Create Shift & Auto-Generate Slots

```mermaid
sequenceDiagram
    actor M as Clinic Manager
    participant UI as Manager Dashboard (Web)
    participant C as VetShiftController
    participant S as VetShiftService
    participant G as SlotGenerator
    participant DB as Database

    M->>UI: 1. Input shift info & click "Save"
    activate UI
    UI->>C: 2. createShift(clinicId, shiftRequest)
    activate C
    C->>S: 3. createShift(request)
    activate S
    S->>DB: 4. Check for overlaps (vet_id, date, time)
    activate DB
    DB-->>S: 5. No overlap found
    deactivate DB
    S->>DB: 6. Save VetShift entity
    activate DB
    DB-->>S: 7. VetShift saved
    deactivate DB
    S->>G: 8. generate(savedShift)
    activate G
    G->>G: 9. Divide into 30m intervals (Skip Breaks)
    G-->>S: 10. List of Slots
    deactivate G
    S->>DB: 11. saveAll(Slots)
    activate DB
    DB-->>S: 12. Slots persisted
    deactivate DB
    S-->>C: 13. VetShiftResponse
    deactivate S
    C-->>UI: 14. VetShiftResponse(created)
    deactivate C
    UI-->>M: 15. Display shift on Calendar
    deactivate UI
```

#### 3.4.3 Delete Shift

```mermaid
sequenceDiagram
    actor M as Clinic Manager
    participant UI as Manager Dashboard (Web)
    participant C as VetShiftController
    participant S as VetShiftService
    participant DB as Database

    M->>UI: 1. Select shift & click "Delete"
    activate UI
    UI->>C: 2. deleteShift(shiftId)
    activate C
    C->>S: 3. deleteShift(id)
    activate S
    S->>DB: 4. findById(id) with slots
    activate DB
    DB-->>S: 5. VetShift with Slots
    deactivate DB
    S->>S: 6. Check all slots AVAILABLE or BLOCKED
    alt Has BOOKED slots
        S-->>C: 7a. 400 Bad Request
        deactivate S
        C-->>UI: 8a. Error: Cannot delete shift with bookings
        deactivate C
        UI-->>M: 9a. Show error message
        deactivate UI
    else All slots deletable
        S->>DB: 7b. deleteAll(slots)
        activate DB
        DB-->>S: 8b. OK
        deactivate DB
        S->>DB: 9b. delete(shift)
        activate DB
        DB-->>S: 10b. OK
        deactivate DB
        S-->>C: 11b. 204 No Content
        deactivate S
        C-->>UI: 12b. Success
        deactivate C
        UI-->>M: 13b. Remove shift from Calendar
        deactivate UI
    end
```

#### 3.4.4 Block/Unblock Slot

```mermaid
sequenceDiagram
    actor V as Vet
    participant UI as My Schedule Screen (Mobile/Web)
    participant C as SlotController
    participant S as SlotService
    participant DB as Database

    V->>UI: 1. Select slot & click "Block"
    activate UI
    UI->>C: 2. toggleBlockSlot(slotId)
    activate C
    C->>S: 3. toggleBlockSlot(id)
    activate S
    S->>DB: 4. findById(id)
    activate DB
    DB-->>S: 5. Slot Entity
    deactivate DB
    alt Status == AVAILABLE
        S->>DB: 6a. Update status = BLOCKED
        activate DB
        DB-->>S: 7a. OK
        deactivate DB
    else Status == BLOCKED
        S->>DB: 6b. Update status = AVAILABLE
        activate DB
        DB-->>S: 7b. OK
        deactivate DB
    end
    S-->>C: 8. SlotResponse
    deactivate S
    C-->>UI: 9. SlotResponse(updated)
    deactivate C
    UI-->>V: 10. Update slot display
    deactivate UI
```


### 3.5 Patient Management

This module serves as the medical record repository for all pets. Following the "EMR Central Hub" concept, it allows authorized Vets to access a pet's cumulative clinical history across different clinics.

#### 3.5.1 Class Diagram

```mermaid
classDiagram
    class PatientController {
        -PatientService patientService
        +searchPatients(UUID clinicId, String keyword) ResponseEntity
        +getPatientHistory(UUID petId) ResponseEntity
        +createEMR(UUID bookingId, EMRRequest) ResponseEntity
        +addVaccination(UUID petId, VaccinationRequest) ResponseEntity
    }

    class PatientService {
        -PetRepository petRepository
        -EMRRepository emrRepository
        -VaccinationRepository vaccinationRepository
        -BookingRepository bookingRepository
        +searchPatients(UUID clinicId, String keyword) List~PatientResponse~
        +getPetMedicalHistory(UUID petId, UUID clinicId) PetHistoryResponse
        +createEMR(UUID bookingId, EMRRequest) EMRResponse
        +addVaccination(UUID petId, VaccinationRequest) VaccinationResponse
        +checkAccessEntitlement(UUID petId, UUID clinicId) boolean
    }

    class EMR {
        +UUID emrId
        +Booking booking
        +Pet pet
        +Clinic clinic
        +User vet
        +String subjective
        +String objective
        +String assessment
        +String plan
        +LocalDateTime createdAt
    }

    class Vaccination {
        +UUID vaccinationId
        +Pet pet
        +Booking booking
        +String vaccineName
        +String manufacturer
        +String batchNumber
        +LocalDate administeredDate
        +LocalDate nextDueDate
        +User administeredBy
    }

    PatientController --> PatientService
    PatientService --> EMR
    PatientService --> Vaccination
```

#### 3.5.2 View Pet Medical History (Cross-Clinic)

> **Business Rule BR-009-03:** A Vet/Clinic can view a Pet's history only if there exists an active or past booking relationship.

```mermaid
sequenceDiagram
    actor V as Vet
    participant UI as Vet Dashboard
    participant PC as PatientController
    participant PS as PatientService
    participant DB as Database

    V->>UI: 1. Search Pet or Select from Booking
    activate UI
    UI->>PC: 2. getPetMedicalHistory(petId)
    activate PC
    PC->>PS: 3. getPetMedicalHistory(petId, clinicId)
    activate PS
    PS->>DB: 4. Check booking exists (petId, clinicId)
    activate DB
    DB-->>PS: 5. Entitlement Confirmed
    deactivate DB
    PS->>DB: 6. Fetch all EMRs & Vaccinations
    activate DB
    DB-->>PS: 7. Medical Records List
    deactivate DB
    PS-->>PC: 8. PetHistoryResponse
    deactivate PS
    PC-->>UI: 9. PetHistoryResponse
    deactivate PC
    UI-->>V: 10. Display history timeline
    deactivate UI
```

#### 3.5.3 Create EMR (Electronic Medical Record)

```mermaid
sequenceDiagram
    actor V as Vet
    participant UI as EMR Form Screen
    participant PC as PatientController
    participant PS as PatientService
    participant DB as Database

    V->>UI: 1. Fill SOAP form & click "Save"
    activate UI
    UI->>PC: 2. createEMR(bookingId, emrRequest)
    activate PC
    PC->>PS: 3. createEMR(bookingId, emrRequest)
    activate PS
    PS->>DB: 4. Find Booking
    activate DB
    DB-->>PS: 5. Booking with Pet, Clinic info
    deactivate DB
    PS->>PS: 6. Validate Vet is assigned to Booking
    PS->>DB: 7. Save EMR entity
    activate DB
    DB-->>PS: 8. Saved EMR
    deactivate DB
    PS-->>PC: 9. EMRResponse
    deactivate PS
    PC-->>UI: 10. EMRResponse(created)
    deactivate PC
    UI-->>V: 11. Show success notification
    deactivate UI
```

#### 3.5.4 Add Vaccination Record

```mermaid
sequenceDiagram
    actor V as Vet
    participant UI as Vaccination Form
    participant PC as PatientController
    participant PS as PatientService
    participant DB as Database

    V->>UI: 1. Fill vaccine info & click "Add"
    activate UI
    UI->>PC: 2. addVaccination(petId, vaccinationRequest)
    activate PC
    PC->>PS: 3. addVaccination(petId, request)
    activate PS
    PS->>DB: 4. Find Pet
    activate DB
    DB-->>PS: 5. Pet Entity
    deactivate DB
    PS->>PS: 6. Validate entitlement
    PS->>DB: 7. Save Vaccination entity
    activate DB
    DB-->>PS: 8. Saved Vaccination
    deactivate DB
    PS-->>PC: 9. VaccinationResponse
    deactivate PS
    PC-->>UI: 10. VaccinationResponse(created)
    deactivate PC
    UI-->>V: 11. Update vaccination card
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
**Last Updated:** 2026-01-02
