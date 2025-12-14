# Petties - Development Commands

## Quick Reference

| Môi trường | Command |
|------------|---------|
| **Full Dev (Docker)** | `.\scripts\dev-start.bat` |
| **DB Only** | `.\scripts\dev-db-only.bat` |
| **Stop All** | `.\scripts\dev-stop.bat` |
| **Test Prod** | `.\scripts\prod-test.bat` |

---

## 1. Development với Docker (Recommended)

### Option A: Chạy tất cả services trong Docker

```bash
# Start all (PostgreSQL, MongoDB, Backend, AI Service)
.\scripts\dev-start.bat

# Hoặc manually:
docker-compose -f docker-compose.dev.yml up --build -d

# View logs
docker-compose -f docker-compose.dev.yml logs -f

# View specific service logs
docker-compose -f docker-compose.dev.yml logs -f backend
docker-compose -f docker-compose.dev.yml logs -f ai-service

# Stop all
.\scripts\dev-stop.bat
```

**Services sẽ chạy tại:**
- PostgreSQL: `localhost:5432`
- MongoDB: `localhost:27017`
- Backend API: `http://localhost:8080`
- AI Service: `http://localhost:8000`
- Debug Port (Backend): `localhost:5005`
- Qdrant: **Qdrant Cloud** (remote)

### Option B: Chỉ chạy databases, services chạy ngoài Docker

```bash
# Start databases only
.\scripts\dev-db-only.bat

# Hoặc manually:
docker-compose -f docker-compose.db-only.yml up -d
```

Sau đó chạy services manually:

```bash
# Terminal 1 - Backend
cd backend-spring/petties
mvn spring-boot:run

# Terminal 2 - AI Service
cd petties-agent-serivce
python -m uvicorn app.main:app --reload --port 8000

# Terminal 3 - Frontend
cd petties-web
npm run dev

# Terminal 4 - Mobile
cd petties_mobile
flutter run
```

---

## 2. Environment Files

### Backend (Spring Boot)

| File | Profile | Mục đích |
|------|---------|----------|
| `application.properties` | Base | Config chung |
| `application-dev.properties` | dev | Local Docker DBs |
| `application-prod.properties` | prod | Cloud DBs (Neon, Atlas) |

**Cách switch profile:**
```bash
# Development (default)
SPRING_PROFILES_ACTIVE=dev mvn spring-boot:run

# Production
SPRING_PROFILES_ACTIVE=prod mvn spring-boot:run
```

### Frontend (React/Vite)

| File | Mục đích |
|------|----------|
| `.env` | Local development |
| `.env.production` | Production (Vercel) |
| `.env.example` | Template |

**Copy template:**
```bash
cd petties-web
cp .env.example .env
```

### AI Service (FastAPI)

| File | Mục đích |
|------|----------|
| `.env` | Active config |
| `.env.development` | Dev template |
| `.env.production` | Prod template |
| `.env.example` | Full template với docs |

**Copy template:**
```bash
cd petties-agent-serivce
cp .env.development .env
```

### Mobile (Flutter)

| File | Mục đích |
|------|----------|
| `lib/config/env/environment.dart` | Auto-switch dev/prod |

**Build modes:**
```bash
# Development
flutter run

# Production (uses prod URLs automatically)
flutter build apk --release
flutter build ipa --release
```

---

## 3. Database Commands

### PostgreSQL
```bash
# Access container
docker exec -it petties-dev-postgres psql -U postgres -d petties_db

# Common commands
\dt                     # List tables
\d table_name          # Describe table
SELECT * FROM users;   # Query
\q                     # Exit
```

### MongoDB
```bash
# Access container
docker exec -it petties-dev-mongodb mongosh -u admin -p admin

# Common commands
show dbs
use petties_nosql
show collections
db.collection_name.find()
exit
```

### Reset Databases (xóa hết data!)
```bash
docker-compose -f docker-compose.dev.yml down -v
docker-compose -f docker-compose.dev.yml up -d
```

---

## 4. Ollama (Local LLM)

### Setup
```bash
# Install Ollama
# https://ollama.ai/download

# Pull PRIMARY models (theo Technical Scope)
ollama pull kimi-k2              # Primary LLM (Vietnamese reasoning + tool calling)
ollama pull nomic-embed-text     # Embeddings (RAG, multilingual)

# Pull ALTERNATIVE models (optional)
ollama pull llama3               # Fallback LLM
ollama pull mistral              # Fallback LLM
ollama pull gemma                # Fallback LLM
ollama pull qwen2.5:7b           # Alternative LLM

# Start Ollama
ollama serve
# Chạy tại http://localhost:11434
```

### Test
```bash
# Test primary model
ollama run kimi-k2 "Xin chào, bạn khỏe không?"

# Test embedding model
ollama run nomic-embed-text "Test embedding"

# List models
ollama list
```

### Model Selection (theo Technical Scope)
| Model | Purpose | Khi nào dùng |
|-------|---------|--------------|
| `kimi-k2` | **Primary LLM** | Mặc định cho tất cả Agents |
| `nomic-embed-text` | **Embeddings** | RAG, Vector search |
| `llama3` | Fallback | Khi kimi-k2 không available |
| `qwen2.5:7b` | Alternative | Testing, comparison |

---

## 5. Testing

### Backend
```bash
cd backend-spring/petties
mvn test                    # Run all tests
mvn test -Dtest=UserTest   # Run specific test
```

### AI Service
```bash
cd petties-agent-serivce
pytest                      # Run all tests
pytest tests/test_api.py   # Run specific file
pytest -v                   # Verbose
```

### Frontend
```bash
cd petties-web
npm run test
npm run test:coverage
```

### Mobile
```bash
cd petties_mobile
flutter test
```

---

## 6. Build Commands

### Backend (JAR)
```bash
cd backend-spring/petties
mvn clean package -DskipTests
# Output: target/petties-0.0.1-SNAPSHOT.jar
```

### Frontend (Static)
```bash
cd petties-web
npm run build
# Output: dist/
```

### Mobile (APK/IPA)
```bash
cd petties_mobile
flutter build apk --release    # Android
flutter build ipa --release    # iOS
```

### Docker Images
```bash
# Build production images
docker-compose -f docker-compose.prod.yml build

# Build specific service
docker build -f backend-spring/petties/Dockerfile.prod -t petties-backend ./backend-spring/petties
docker build -f petties-agent-serivce/Dockerfile.prod -t petties-ai-service ./petties-agent-serivce
```

---

## 7. Useful Docker Commands

```bash
# List running containers
docker ps

# View resource usage
docker stats

# Clean up unused resources
docker system prune -a

# Rebuild specific service
docker-compose -f docker-compose.dev.yml up --build -d backend

# Restart specific service
docker-compose -f docker-compose.dev.yml restart ai-service
```

---

## 8. Production Deployment

### AWS EC2 (Backend + AI Service)
```bash
# Push to main branch triggers auto-deploy via GitHub Actions
git push origin main

# Manual deploy on EC2:
ssh -i petties-key.pem ubuntu@<EC2_IP>
cd ~/petties-backend/Petties-Veterinary-Appointment-Booking-Platform
git pull origin main
docker-compose -f docker-compose.prod.yml down
docker-compose -f docker-compose.prod.yml --env-file .env up -d --build

# Check logs
docker-compose -f docker-compose.prod.yml logs -f
```

### Vercel (Frontend)
```bash
# Push to main branch triggers auto-deploy
git push origin main

# Or use Vercel CLI
npm i -g vercel
cd petties-web
vercel --prod
```

---

## File Structure Summary

```
petties/
├── docker-compose.dev.yml      # Dev: Full services + hot-reload
├── docker-compose.prod.yml     # Prod: EC2 deployment
├── docker-compose.db-only.yml  # Dev: Databases only
│
├── backend-spring/petties/
│   ├── Dockerfile              # Unified Dockerfile (dev/prod)
│   └── src/main/resources/
│       ├── application.properties      # Base config
│       ├── application-dev.properties  # Dev profile
│       └── application-prod.properties # Prod profile
│
├── petties-agent-serivce/
│   ├── Dockerfile.dev          # Dev: hot-reload
│   ├── Dockerfile.prod         # Prod: optimized
│   ├── .env.development        # Dev template
│   └── .env.production         # Prod template
│
├── petties-web/
│   ├── .env.example            # Template
│   └── .env.production         # Prod config
│
├── petties_mobile/
│   └── lib/config/env/environment.dart  # Auto dev/prod
│
└── scripts/
    ├── dev-start.bat           # Start full dev
    ├── dev-stop.bat            # Stop all
    ├── dev-db-only.bat         # Start DBs only
    └── prod-test.bat           # Test prod locally
```
