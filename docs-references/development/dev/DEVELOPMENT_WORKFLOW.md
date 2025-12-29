# Petties - Development Workflow

**Last Updated:** December 16, 2025

## Tổng quan kiến trúc

```
┌─────────────────────────────────────────────────────────────────┐
│                     PRODUCTION ENVIRONMENT                       │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  Vercel ──────────► petties.world (Frontend React)              │
│                            │                                     │
│                            ▼                                     │
│  AWS EC2 ─────────► api.petties.world (Spring Boot)             │
│                            │                                     │
│                            ▼                                     │
│  AWS EC2 ─────────► ai.petties.world (FastAPI)                  │
│                            │                                     │
│              ┌─────────────┼─────────────┐                      │
│              ▼             ▼             ▼                      │
│         Neon      MongoDB Atlas   Qdrant Cloud                  │
│        (PostgreSQL)    (NoSQL DB)    (Vector DB)                │
│                                                                  │
│  Cloud AI APIs ────── OpenRouter (LLM) + Cohere (Embed)         │
│                                                                  │
│  Nginx (Reverse Proxy) ─── SSL (Let's Encrypt)                  │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

## 1. Setup Development Environment

### Prerequisites
- Docker Desktop
- Java 21 (cho Backend - Spring Boot 4.0.0)
- Python 3.12+ (cho AI Service)
- Node.js 18+ (cho Frontend)
- Flutter 3.5+ (cho Mobile)

### Bước 1: Clone repository
```bash
git clone https://github.com/your-org/petties.git
cd petties
```

### Bước 2: Start databases
```bash
# Windows
.\scripts\dev-start.bat

# Linux/Mac
docker-compose -f docker-compose.db-only.yml up -d
```

### Bước 3: Start services (mở terminal riêng cho mỗi service)

**Backend (Spring Boot):**
```bash
cd backend-spring/petties
mvn spring-boot:run
# Chạy tại http://localhost:8080
```

**AI Service (FastAPI):**
```bash
cd petties-agent-serivce
pip install -r requirements.txt
python -m uvicorn app.main:app --reload --port 8000
# Chạy tại http://localhost:8000
```

**Frontend (React/Vite):**
```bash
cd petties-web
npm install
npm run dev
# Chạy tại http://localhost:5173
```

**Mobile (Flutter):**
```bash
cd petties_mobile
flutter pub get
flutter run
```

## 2. Git Workflow & CI/CD

### Branch Strategy

| Branch | Environment | Deploy Target | Trigger |
|--------|-------------|---------------|---------|
| `feature/*` | Local Dev | localhost | Manual |
| `develop` | Test | test.petties.world + api-test.petties.world | Auto on push |
| `main` | Production | www.petties.world + api.petties.world | Auto on push |

### CI/CD Pipeline (GitHub Actions)

| Workflow | Trigger | Purpose |
|----------|---------|--------|
| `ci.yml` | PR → develop, main | Build + Lint + Test (Frontend, Backend, AI Service) |
| `deploy-test.yml` | Push → develop | Auto Deploy to EC2 Test Environment |
| `deploy-ec2.yml` | Push → main | Auto Deploy to EC2 Production |
| `mobile-ci-cd.yml` | Manual Dispatch | Build & Deploy Mobile App (Android/iOS) to Firebase/TestFlight |

### Quy trình làm việc

1. **Tạo branch mới từ develop:**
```bash
git checkout develop
git pull origin develop
git checkout -b feature/ten-feature
```

2. **Commit thường xuyên:**
```bash
git add .
git commit -m "feat: mô tả ngắn gọn"
```

3. **Push và tạo Pull Request:**
```bash
git push origin feature/ten-feature
# Tạo PR trên GitHub: feature/ten-feature -> develop
```

4. **Sau khi PR được approve:**
- Merge vào develop
- CI/CD tự động deploy lên staging (nếu có)

5. **Deploy production:**
- Merge develop -> main
- CI/CD tự động deploy lên Render/Vercel

### Commit Message Convention
```
feat: thêm tính năng mới
fix: sửa lỗi
docs: cập nhật documentation
style: format code, không thay đổi logic
refactor: refactor code
test: thêm tests
chore: cập nhật dependencies, config
```

### Three Environments

| Environment | FE URL | BE URL | Docker Compose |
|-------------|--------|--------|----------------|
| **Local Dev** | `localhost:5173` | `localhost:8080` | `docker-compose.dev.yml` |
| **Test** | `test.petties.world` | `api-test.petties.world` | `docker-compose.test.yml` |
| **Production** | `www.petties.world` | `api.petties.world` | `docker-compose.prod.yml` |

## 3. Phân công công việc

### Theo module
| Member | Module | Stack |
|--------|--------|-------|
| Member 1 | Backend - Auth, User | Spring Boot |
| Member 2 | Backend - Booking, Pet | Spring Boot |
| Member 3 | AI Service | FastAPI, LangChain |
| Member 4 | Frontend | React, TypeScript |
| Member 5 | Mobile | Flutter |

### Code Review Rules
- Mỗi PR cần ít nhất 1 reviewer approve
- Reviewer không được là người viết code
- PR nên nhỏ (< 500 lines changed)

## 4. Testing

### Backend
```bash
cd backend-spring/petties
mvn test
```

### AI Service
```bash
cd petties-agent-serivce
pytest tests/
```

### Frontend
```bash
cd petties-web
npm run test
```

### Mobile
```bash
cd petties_mobile
flutter test
```

## 5. Deployment

> **✅ Status:** Project đã được deploy lên Production tại **petties.world**

### Production Environment
- **Frontend:** https://petties.world (Vercel)
- **Backend API:** https://api.petties.world (AWS EC2 + Nginx)
- **AI Service:** https://ai.petties.world (AWS EC2 + Nginx)
- **Databases:** Neon PostgreSQL, MongoDB Atlas, Qdrant Cloud

### Deployment Architecture
- **EC2 Instance:** t3.small (2 vCPU, 2GB RAM)
- **Reverse Proxy:** Nginx with SSL (Let's Encrypt)
- **Containers:** Docker Compose (Test: ports 8081/8001, Prod: 8080/8000)
- **CI/CD:** GitHub Actions auto-deploy on push to `develop` (Test) or `main` (Prod)

### Test Environment
- **Frontend:** https://test.petties.world (Vercel Preview)
- **Backend API:** https://api-test.petties.world (AWS EC2 port 8081)
- **AI Service:** https://api-test.petties.world/ai (AWS EC2 port 8001)
- **Database:** Neon PostgreSQL (Test Branch)

### Automatic Deployment (GitHub Actions)
```yaml
# Push to main → Auto deploy to EC2
git push origin main

# GitHub Actions workflow:
# 1. SSH vào EC2
# 2. Pull latest code
# 3. Rebuild Docker containers
# 4. Health check services
```

### Manual Deployment (EC2)
```bash
# SSH vào EC2
ssh -i petties-key.pem ubuntu@15.134.219.97

# Pull latest code
cd ~/petties-backend/Petties-Veterinary-Appointment-Booking-Platform
git pull origin main

# Rebuild và restart containers
docker-compose -f docker-compose.prod.yml down
docker-compose -f docker-compose.prod.yml --env-file .env up -d --build

# Check logs
docker-compose -f docker-compose.prod.yml logs -f
```

### Frontend Deployment (Vercel)
```bash
# Auto-deploy khi push to main
git push origin main

# Hoặc manual deploy từ Vercel Dashboard:
# https://vercel.com/dashboard
```

### Rollback
```bash
# EC2: Checkout previous commit
cd ~/petties-backend/Petties-Veterinary-Appointment-Booking-Platform
git checkout <previous-commit-hash>
docker-compose -f docker-compose.prod.yml down
docker-compose -f docker-compose.prod.yml --env-file .env up -d --build

# Vercel: Dashboard > Previous deployment > Promote to Production
```

## 6. Environment Variables

### Local Development
Copy `.env.example` thành `.env` và điền values:
```bash
cp .env.example .env
```

### Production (AWS EC2)
Environment variables được quản lý qua file `.env` trên EC2:

```bash
# SSH vào EC2
ssh -i petties-key.pem ubuntu@15.134.219.97

# Edit .env file
cd ~/petties-backend/Petties-Veterinary-Appointment-Booking-Platform
nano .env

# Restart containers sau khi sửa
docker-compose -f docker-compose.prod.yml down
docker-compose -f docker-compose.prod.yml --env-file .env up -d
```

**QUAN TRỌNG:**
- ❌ **KHÔNG BAO GIỜ** commit file `.env` vào Git
- ✅ Chỉ commit `.env.example` (template không có sensitive data)
- ✅ Backup file `.env` production ở nơi an toàn (1Password, AWS Secrets Manager, etc.)

### Frontend Environment (Vercel)
Quản lý qua Vercel Dashboard:
1. Vào **Settings** > **Environment Variables**
2. Thêm/sửa biến môi trường
3. Redeploy để apply changes

## 7. Troubleshooting

### Database không connect được
```bash
# Check Docker containers
docker ps

# Restart databases
docker-compose -f docker-compose.db-only.yml restart
```

### Backend không start
```bash
# Check logs
mvn spring-boot:run -X

# Clean build
mvn clean package -DskipTests
```

### AI Service lỗi import
```bash
# Reinstall dependencies
pip install -r requirements.txt --force-reinstall
```

### Mobile không connect API
- Android Emulator: Dùng `10.0.2.2` thay vì `localhost`
- iOS Simulator: Dùng `localhost`
- Physical Device: Dùng IP của máy host (cùng WiFi)

## 8. Cloud AI Setup (cho AI features)

### Cloud-Only Architecture (Khuyến nghị)

AI Service sử dụng Cloud APIs - **KHÔNG cần GPU/RAM local**.

| Service | Provider | Purpose | Free Tier |
|---------|----------|---------|-----------|
| **LLM** | OpenRouter | Chat completion | Free models available |
| **Embeddings** | Cohere | Text embeddings | 1,000/month |
| **Vector DB** | Qdrant Cloud | Vector storage | 1GB storage |

### Configuration

**File `.env`:**

```bash
# LLM Provider (OpenRouter - Cloud API)
LLM_PROVIDER=openrouter
OPENROUTER_API_KEY=sk-your-openrouter-api-key
PRIMARY_MODEL=google/gemini-2.0-flash-exp:free
FALLBACK_MODEL=meta-llama/llama-3.3-70b-instruct

# Embeddings (Cohere - Cloud API)
COHERE_API_KEY=your-cohere-api-key
EMBEDDING_MODEL=embed-multilingual-v3

# Qdrant Cloud (Vector DB)
QDRANT_URL=https://your-cluster.qdrant.io
QDRANT_API_KEY=your-qdrant-api-key
```

### Getting API Keys

1. **OpenRouter** (LLM): https://openrouter.ai/keys
2. **Cohere** (Embeddings): https://dashboard.cohere.com/api-keys
3. **Qdrant Cloud** (Vectors): https://cloud.qdrant.io

### Lợi ích Cloud-Only Architecture

- ✅ Không cần GPU/RAM local (chạy trên EC2 t3.small)
- ✅ Free tiers đủ cho MVP development
- ✅ Automatic scaling và high availability
- ✅ Deploy đơn giản - chỉ cần API keys
- ✅ Vietnamese language support (Cohere multilingual)

## 9. Useful Commands

```bash
# View logs
docker-compose -f docker-compose.db-only.yml logs -f

# Database access
# PostgreSQL
docker exec -it petties-postgres psql -U postgres -d petties_db

# MongoDB
docker exec -it petties-mongodb mongosh -u admin -p admin

# Reset databases (xóa hết data!)
docker-compose -f docker-compose.db-only.yml down -v
docker-compose -f docker-compose.db-only.yml up -d
```

Chạy docker cho dev :
docker-compose -f docker-compose.dev.yml up ai-service --build
và docker-compose -f docker-compose.dev.yml up backend --build
## 10. Contacts & Resources

- **Repository:** https://github.com/your-org/petties
- **Production URLs:**
  - Frontend: https://petties.world
  - Backend API: https://api.petties.world
  - AI Service: https://ai.petties.world
- **Deployment Platforms:**
  - EC2 Dashboard: https://console.aws.amazon.com/ec2
  - Vercel Dashboard: https://vercel.com
- **Databases:**
  - Neon PostgreSQL: https://console.neon.tech
  - MongoDB Atlas: https://cloud.mongodb.com
  - Qdrant Cloud: https://cloud.qdrant.io
- **Documentation:**
  - EC2 Deployment Guide: `docs-references/deployment/EC2_PRODUCTION_DEPLOYMENT.md`
  - Vercel Setup: `docs-references/deployment/VERCEL_PRODUCTION_SETUP.md`
  - Test Environment Setup: `docs-references/deployment/TEST_ENVIRONMENT_SETUP.md`
