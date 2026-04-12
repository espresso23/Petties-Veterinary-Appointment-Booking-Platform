# II. Release Package & User Guides

> Release date: 2026-04-12  
> Release version: `v2026.04.12`  
> Baseline commit: `033a664`

## 1. Deliverable Package

| No. | Deliverable Item | Description |
|---|---|---|
| 1 | Project Schedule/Tracking | Sprint tracking and implementation status. Main references: `PROJECT_STATUS.md`, `docs-references/documentation/WBS_PETTIES_14_SPRINTS.md`, `docs-references/documentation/SPRINT_WORKING_PLAN.md`. |
| 2 | Project Backlog | Feature scope and backlog-level planning references: `docs-references/documentation/PETTIES_Features.md`, `docs-references/documentation/JIRA_PROJECT_DESCRIPTION.md`. |
| 3 | Source Codes | Monorepo source code: `backend-spring/petties/` (Spring Boot), `petties-web/` (React), `petties_mobile/` (Flutter), `petties-agent-serivce/` (FastAPI AI service). |
| 4 | Database Script(s) | Flyway migrations for backend: `backend-spring/petties/src/main/resources/db/migration/` (latest: `V202604120001__drop_default_price_per_km_from_master_services.sql`). |
| 5 | Final Report Document | Main final technical docs: `docs-references/documentation/SRS/PETTIES_SRS.md` and `docs-references/documentation/SDD/PETTIES_SDD.md`. |
| 6 | Test Cases Document | Test and validation guides: `docs-references/testing/TEST_CASES.md`, `docs-references/testing/SYSTEM_TEST_GUIDE.md`, `docs-references/testing/TESTING_STRATEGY.md`. |
| 7 | Defects List | Defect tracking source: GitHub Issues (label `bug`) and team tracker in Jira (project scope defined in `docs-references/documentation/JIRA_PROJECT_DESCRIPTION.md`). |
| 8 | Issues List | Open issues and tasks managed via GitHub Issues and Jira board (project-level issue management). |
| 9 | Slide | Presentation materials: `docs-references/documentation/ARCHITECTURE_PRESENTATION.md`, `docs-references/documentation/SP26_Petties_Capstone.md`. |

## 2. Installation Guides

### 2.1 System Requirements

#### Common requirements (all workflows)

- OS: Windows 10/11, macOS, or Linux (64-bit)
- Docker Desktop + Docker Compose plugin
- Git

#### Option A - Dev Container workflow

- Visual Studio Code
- VS Code extension: Dev Containers (`ms-vscode-remote.remote-containers`)
- Note: Java/Node/Python toolchains are provided inside the container.

#### Option B - Native local workflow (without Dev Container)

- Java 21 + Maven 3.9+
- Node.js 20+ + npm 10+
- Python 3.12 + pip/virtualenv
- PostgreSQL 16 and Redis 7 (only if not using Docker for infra)

#### Mobile (always on host machine)

- Flutter 3.5+
- Android Studio and/or Xcode

#### External services (full feature coverage)

- OpenRouter API key
- Cohere API key
- Qdrant Cloud credentials
- Cloudinary credentials

### 2.2 Installation Instruction

#### Step 0 - Clone repository

```bash
git clone <repository-url>
cd petties
```

#### Step 1 - Environment configuration

```bash
cp .env.example .env
```

Then fill required values in `.env` (database, JWT, OpenRouter, Cloudinary, Redis, etc.).

#### Option A - Docker Compose Dev (recommended quick start)

##### A1. Start full development stack

```bash
docker-compose -f docker-compose.dev.yml up -d --build
```

Services:
- API Gateway (Nginx): `http://localhost:8080`
  - Backend API via gateway: `http://localhost:8080/api`
  - AI routes via gateway: `http://localhost:8080/api/v1`
- Backend direct port: `http://localhost:8081`
- AI service direct port: `http://localhost:8000`
- Web dev server: `http://localhost:5173`

##### A2. Start only databases (if running app services manually)

```bash
docker-compose -f docker-compose.dev.yml up -d postgres mongodb redis
```

#### Option B - Dev Container workflow

##### B1. Open in Dev Container

1. Open project folder in VS Code.
2. Press `Ctrl+Shift+P` and select `Dev Containers: Reopen in Container`.
3. Wait until container build and dependency bootstrap complete (config at `.devcontainer/devcontainer.json`).

##### B2. Run services inside Dev Container terminal

```bash
# Backend
cd backend-spring/petties
mvn spring-boot:run

# AI Service
cd ../../petties-agent-serivce
python -m uvicorn app.main:app --reload --port 8000

# Web
cd ../petties-web
npm install
npm run dev
```

- API base URL: `http://localhost:8080`
- Swagger/OpenAPI: `http://localhost:8080/swagger-ui/index.html`

#### Step 2 - Run Mobile App (host machine)

```bash
cd petties_mobile
cp .env.example .env
# Edit .env (API_BASE_URL, AI_SERVICE_URL, etc.)
# Example for Android emulator: API_BASE_URL=http://10.0.2.2:8080
flutter pub get
flutter run

# Optional: specify device
flutter run -d <device_id>
```

Notes:
- Mobile app no longer uses flavors.
- Environment is configured via `.env` and loaded in `petties_mobile/lib/main.dart`.
- If `AI_SERVICE_URL` is empty, app derives it from `API_BASE_URL` by current code behavior.

#### Step 3 - Verification commands

```bash
# Backend tests
cd backend-spring/petties
mvn test

# AI tests
cd petties-agent-serivce
python -m pytest -q

# Web tests
cd petties-web
npm run test
```

#### Step 4 - Stop stack (Docker Compose mode)

```bash
docker-compose -f docker-compose.dev.yml down
```

## Notes for this release

- Backend auto-seeding has been removed in this release. There is no `DataInitializer` / `*Seeder` runtime seeding path.
- Database schema is managed by Flyway migration scripts under `backend-spring/petties/src/main/resources/db/migration/`.
- For demo/UAT data, prepare fixtures manually (SQL import or API-driven setup).
