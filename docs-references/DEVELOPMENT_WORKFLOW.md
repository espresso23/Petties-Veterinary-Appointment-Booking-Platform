# Petties - Development Workflow

## Tổng quan kiến trúc

```
┌─────────────────────────────────────────────────────────────────┐
│                     PRODUCTION ENVIRONMENT                       │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  Vercel ──────────► petties-web.vercel.app (Frontend React)     │
│                            │                                     │
│                            ▼                                     │
│  Render ──────────► petties-backend.onrender.com (Spring Boot)  │
│                            │                                     │
│                            ▼                                     │
│  Render ──────────► petties-ai-service.onrender.com (FastAPI)   │
│                            │                                     │
│              ┌─────────────┼─────────────┐                      │
│              ▼             ▼             ▼                      │
│         Supabase      MongoDB Atlas   Qdrant Cloud              │
│        (PostgreSQL)    (NoSQL DB)    (Vector DB)                │
│                                                                  │
│  Ollama Cloud (LLM) ────── API Key ────── Render Services       │
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

## 2. Git Workflow

### Branch Strategy
```
main (production)
  └── develop (staging)
        ├── feature/feature-name
        ├── bugfix/bug-description
        └── hotfix/critical-fix
```

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

> **⚠️ Status:** Project hiện tại **chưa được deploy**. Tất cả development được thực hiện local.

### Current Status
- **Development:** Local only (localhost:8080, localhost:8000, localhost:5173)
- **Staging:** Not configured
- **Production:** Not deployed

### Planned Deployment (Khi ready)

**Automatic Deployment (CI/CD)**
- Push to `main` → Auto deploy to Production (khi setup)
- Push to `develop` → Auto deploy to Staging (khi setup)

**Manual Deployment**
```bash
# Backend/AI Service (Render) - Khi ready
# Vào Render Dashboard > Manual Deploy

# Frontend (Vercel) - Khi ready
# Vào Vercel Dashboard > Redeploy
```

**Rollback**
```bash
# Render: Chọn previous deploy và click "Rollback"
# Vercel: Chọn previous deployment và click "Promote to Production"
```

## 6. Environment Variables

### Local Development
Copy `.env.example` thành `.env` và điền values:
```bash
cp .env.example .env
```

### Production
Quản lý qua Dashboard của Render/Vercel.

**KHÔNG BAO GIỜ commit credentials vào Git!**

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

## 8. Ollama Setup (cho AI features)

### Development (Local Mode)

AI Service có thể sử dụng Ollama Local hoặc Ollama Cloud.

**Option 1: Local Ollama (Khuyến nghị cho Development)**

```bash
# Cài Ollama
# https://ollama.ai/download

# Pull models
ollama pull kimi-k2
ollama pull nomic-embed-text

# Start Ollama (chạy trong background)
ollama serve
# Chạy tại http://localhost:11434

# Verify
curl http://localhost:11434/api/tags
```

**Configuration:**
- Set `OLLAMA_BASE_URL=http://localhost:11434` trong `.env`
- Leave `OLLAMA_API_KEY` empty
- Model: `kimi-k2`

**Option 2: Ollama Cloud (Cũng có thể dùng cho Development)**

1. Đăng ký tại https://ollama.com
2. Lấy API Key
3. Set `OLLAMA_API_KEY=sk-...` trong `.env`
4. Hệ thống tự động:
   - Switch sang `https://ollama.com`
   - Chuyển model sang `kimi-k2:1t-cloud` (256K context)

### Production (Ollama Cloud - Khuyến nghị)

**Không cần setup Ollama server!**

1. Đăng ký Ollama Cloud tại https://ollama.com
2. Lấy API Key từ dashboard
3. Set `OLLAMA_API_KEY` trong Render Dashboard (Environment Variables)
4. Hệ thống tự động:
   - Switch sang `https://ollama.com`
   - Chuyển model sang `kimi-k2:1t-cloud` (256K context window)
   - Sử dụng Bearer token authentication

**Lợi ích:**
- Không cần GPU/RAM trên server
- Không cần setup tunnel/Cloudflare
- Context window lớn hơn (256K vs 128K)
- Phù hợp với Render free tier

**Note:** 
- Không cần Cloudflare Tunnel cho Ollama Cloud mode
- Ollama Cloud tự động xử lý authentication qua API key
- Không cần expose local server ra internet

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
- **Render Dashboard:** https://dashboard.render.com
- **Vercel Dashboard:** https://vercel.com
- **Supabase Dashboard:** https://supabase.com/dashboard
- **MongoDB Atlas:** https://cloud.mongodb.com
- **Qdrant Cloud:** https://cloud.qdrant.io
