# QWEN.md — Petties Project Context

## Project Overview

**Petties** is a comprehensive veterinary appointment booking platform connecting pet owners with veterinary clinics. It's a monorepo project built with a clinic-centric model where pet owners book appointments and clinic managers assign appropriate veterinarians.

### Key Characteristics
- **Project Type:** Full-stack web + mobile application
- **Architecture:** Microservices (Spring Boot Backend + Python AI Service + React Web + Flutter Mobile)
- **Domain:** Veterinary healthcare booking platform
- **Timeline:** 13 Sprints (10/12/2025 - 11/03/2026)
- **Status:** ~95% complete (Post Sprint 13 - Production Hardening)

### User Roles
| Role | Platform | Description |
|------|----------|-------------|
| PET_OWNER | Mobile only | Pet owners who book appointments |
| STAFF | Mobile + Web | Veterinary staff (vets, groomers, receptionists) |
| CLINIC_MANAGER | Web only | Clinic operations and staff management |
| CLINIC_OWNER | Web only | Clinic profile and service management |
| ADMIN | Web only | Platform administration and AI configuration |

---

## Project Structure

```
petties/
├── backend-spring/petties/      # Spring Boot 3.4 + Java 21 (Core REST API)
├── petties-agent-serivce/       # FastAPI + Python 3.12 (AI Agent + ReAct)
├── petties-web/                 # React 19 + Vite + TypeScript (Admin/Clinic dashboards)
├── petties_mobile/              # Flutter 3.5 (Pet Owner + Staff mobile app)
├── docs-references/             # Project documentation (SRS, SDD, design, testing)
├── docs/                        # Additional documentation
├── nginx/                       # Nginx configuration
├── scripts/                     # Utility scripts
├── postman/                     # Postman collections for API testing
├── test-data/                   # Test data fixtures
├── docker-compose.dev.yml       # Development Docker Compose
├── docker-compose.test.yml      # Test environment Docker Compose
├── docker-compose.prod.yml      # Production Docker Compose
└── nginx.conf                   # Nginx reverse proxy configuration
```

---

## Technology Stack

### Backend & AI
| Component | Technology | Version |
|-----------|------------|---------|
| Core API | Java + Spring Boot | Java 21, Spring Boot 3.4.x |
| AI Service | Python + FastAPI | Python 3.12 |
| AI Agent Framework | LangGraph + ReAct Pattern | - |
| RAG Engine | LlamaIndex | - |
| Vector Database | Qdrant Cloud | - |
| Primary Database | PostgreSQL | 16 |
| Document Store | MongoDB | 7 |
| Cache/OTP | Redis | 7 |
| Embeddings | Cohere API | embed-multilingual-v3 |
| LLM Provider | OpenRouter Cloud API | - |
| Migration Tool | Flyway (Backend), Alembic (AI) | - |

### Frontend & Mobile
| Component | Technology | Version |
|-----------|------------|---------|
| Web Frontend | React + TypeScript + Vite | React 19, TS 5.9.x |
| State Management | Zustand | 5.x |
| Styling | Tailwind CSS | 4.x (Neobrutalism design) |
| Routing | React Router | v7 |
| Mobile App | Flutter | 3.5+ |
| Mobile State | Provider pattern | - |
| Mobile Routing | GoRouter | - |

### Infrastructure
| Component | Technology | Purpose |
|-----------|------------|---------|
| Containerization | Docker + Docker Compose | Development, Test, Production |
| CI/CD | GitHub Actions | Automated builds and deployment |
| Web Server | Nginx | API Gateway, Load Balancing |
| Frontend Hosting | Vercel | Production frontend |
| Backend Hosting | AWS EC2 | Production backend |
| Media Storage | Cloudinary | Image uploads and CDN |
| Push Notifications | Firebase | Mobile push notifications |

---

## Building and Running

### Prerequisites
- Docker Desktop
- Java 21 (for local backend development)
- Python 3.12 (for local AI service development)
- Node.js 20+ (for local web development)
- Flutter SDK 3.5+ (for mobile development)

### Quick Start (Databases Only)
```bash
docker-compose -f docker-compose.dev.yml up -d postgres mongodb redis
```

### Full Stack (Docker)
```bash
docker-compose -f docker-compose.dev.yml up -d --build
```

### Backend (Spring Boot)
```bash
cd backend-spring/petties
mvn spring-boot:run              # http://localhost:8080
mvn test                         # Run all tests
mvn test -Dtest=UserTest         # Single test class
mvn clean package -DskipTests    # Build JAR
```

### AI Service (FastAPI)
```bash
cd petties-agent-serivce
python -m venv venv && venv\Scripts\activate  # Windows
pip install -r requirements.txt
alembic upgrade head                           # Run migrations
python -m uvicorn app.main:app --reload --port 8000  # http://localhost:8000
pytest                                         # Run all tests
```

### Web Frontend (React)
```bash
cd petties-web
npm install
npm run dev          # http://localhost:5173
npm run build        # Production build
npm run lint         # ESLint
npm run type-check   # TypeScript type checking
```

### Mobile (Flutter)
```bash
cd petties_mobile
flutter pub get
flutter run                    # Development
flutter test                   # Run tests
flutter build apk              # Android release
flutter build ipa              # iOS release
```

### Docker Management
```bash
docker-compose -f docker-compose.dev.yml up --build -d   # Full stack
docker-compose -f docker-compose.dev.yml logs -f backend # Service logs
docker-compose -f docker-compose.dev.yml down -v         # Reset (deletes data)
```

---

## Development Conventions

### General Rules
1. **Vietnamese-Only UI Text:** All user-facing text MUST be in Vietnamese 100%
2. **No Browser Native Dialogs:** Do NOT use `window.alert()`, `window.confirm()`, `window.prompt()`. Use custom modal components instead
3. **Soft Neobrutalism Design:** Follow the design system with thick borders, offset shadows, specific color palette
4. **UTF-8 Encoding:** Always save files as UTF-8 without BOM

### Database Migration
- **NEVER** use `ddl-auto=update` on any environment (use `validate`)
- Flyway migration scripts: `V<Timestamp>__<description>.sql` format
- Alembic for AI service database changes
- Migrations run automatically on application startup

### AI Assistant Architecture
- **Single Agent with ReAct Pattern:** Thought → Action → Observation loop
- **Tools:** FastMCP with `@mcp.tool` decorator
- **RAG:** LlamaIndex + Qdrant Cloud + Cohere embeddings
- **LLM:** OpenRouter Cloud API only (no local models)
- **WebSocket streaming** for real-time chat responses

### Code Style
- **Backend (Java):** Standard Spring Boot conventions, layered architecture (Controller → Service → Repository)
- **Frontend (React/TypeScript):** ESLint configured, TypeScript strict mode
- **Mobile (Flutter):** Standard Flutter conventions, Provider state management
- **AI Service (Python):** FastAPI patterns, pytest for testing

---

## Key Documentation

| Document | Path | Purpose |
|----------|------|---------|
| SRS | `docs-references/documentation/SRS/PETTIES_SRS.md` | Software Requirements Specification |
| SDD | `docs-references/documentation/SDD/PETTIES_SDD.md` | System Design Document |
| Features | `docs-references/documentation/PETTIES_Features.md` | Complete feature list |
| Project Status | `PROJECT_STATUS.md` | Current implementation status |
| AI Test Guide | `docs-references/ai-agent/AI_ASSISTANT_FULL_TEST_GUIDE.md` | AI Assistant testing guide |
| Migration Guide | `docs-references/development/DATABASE_MIGRATION_GUIDE.md` | Database migration procedures |

---

## Environments

| Environment | Frontend URL | Backend URL | Branch | Database |
|-------------|--------------|-------------|--------|----------|
| Local Dev | `localhost:5173` | `localhost:8080` | `feature/*` | Docker |
| Test | `test.petties.world` | `api-test.petties.world` | `develop` | Neon Test Branch |
| Production | `www.petties.world` | `api.petties.world` | `main` | Neon Main |

---

## CI/CD Pipeline

| Workflow | Trigger | Purpose |
|----------|---------|---------|
| `ci.yml` | PR to develop/main | Build + Lint + Test |
| `deploy-test.yml` | Push to develop | Auto Deploy to Test EC2 |
| `deploy-ec2.yml` | Push to main | Auto Deploy to Production EC2 |
| `mobile-ci-cd.yml` | Manual Dispatch | Build & Deploy Mobile App |
