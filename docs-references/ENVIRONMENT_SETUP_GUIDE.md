# Environment Setup Guide - Local, UAT & Production

## Tổng quan

Hướng dẫn cấu hình môi trường cho Development (Local), UAT (User Acceptance Testing) và Production.

## Phân biệt môi trường

| Môi trường | Docker Compose | Backend URL | AI Service URL | Ports | Mục đích |
|------------|----------------|-------------|----------------|-------|----------|
| **Local** | `docker-compose.dev.yml` | `localhost:8080` | `localhost:8000` | 8080, 8000 | Development |
| **UAT** | `docker-compose.uat.yml` | `uat-api.petties.world` | `uat-ai.petties.world` | 8082, 8002 | User Acceptance Testing |
| **Production** | `docker-compose.prod.yml` | `api.petties.world` | `ai.petties.world` | 8080, 8000 | Live production |

## Frontend (React/Vite)

### Development (Local)

**Tạo file `.env.local` trong `petties-web/`:**

```bash
# petties-web/.env.local
VITE_API_BASE_URL=http://localhost:8080/api
VITE_WS_URL=ws://localhost:8080/ws
VITE_AGENT_SERVICE_URL=http://localhost:8000
```

**Chạy development server:**

```bash
cd petties-web
npm install
npm run dev
```

**Frontend tự động:**
- Đọc `.env.local` nếu có
- Nếu không có, dùng fallback: `http://localhost:8080/api`
- Debug log trong console: `🔧 Environment Config`

### Production (Vercel)

**Set Environment Variables trên Vercel:**

1. Vào **Vercel Dashboard** → Project → **Settings** → **Environment Variables**

2. Thêm các biến sau cho **Production** environment:

| Key | Value |
|-----|-------|
| `VITE_API_BASE_URL` | `https://api.petties.world/api` |
| `VITE_WS_URL` | `wss://api.petties.world/ws` |
| `VITE_AGENT_SERVICE_URL` | `https://ai.petties.world` |

3. (Tùy chọn) Thêm cho **Preview** environment nếu cần

4. **Redeploy** sau khi thêm env vars:
   - Vào **Deployments** → Chọn deployment → **Redeploy**
   - Hoặc push commit mới để trigger auto-deploy

**Frontend tự động:**
- Vite inject env vars vào code khi build
- Nếu env vars không được set, dùng production fallback từ `env.ts`
- Auto-detect: Nếu domain có `uat` → dùng UAT URLs

### UAT (Vercel Preview hoặc custom domain)

**Set Environment Variables trên Vercel cho Preview environment:**

| Key | Value |
|-----|-------|
| `VITE_API_BASE_URL` | `https://uat-api.petties.world/api` |
| `VITE_WS_URL` | `wss://uat-api.petties.world/ws` |
| `VITE_AGENT_SERVICE_URL` | `https://uat-ai.petties.world` |

**Hoặc frontend tự động detect:**
- Nếu domain có `uat` (ví dụ: `uat.petties.world`) → tự động dùng UAT URLs

## Backend (Spring Boot)

### Development (Local)

**File:** `application-dev.properties` (tự động load khi `SPRING_PROFILES_ACTIVE=dev`)

**Chạy với Docker Compose:**

```bash
docker-compose -f docker-compose.dev.yml up -d
```

**Hoặc chạy trực tiếp:**

```bash
cd backend-spring/petties
export SPRING_PROFILES_ACTIVE=dev
./mvnw spring-boot:run
```

### UAT (EC2)

**File `.env.uat` trên EC2:** `~/petties-backend/Petties-Veterinary-Appointment-Booking-Platform/.env.uat`

```bash
# Profile
SPRING_PROFILES_ACTIVE=uat

# Database (Neon PostgreSQL)
DB_HOST_UAT=ep-quiet-rice-a1qxog6z-pooler.ap-southeast-1.aws.neon.tech
DB_PORT_UAT=5432
DB_NAME_UAT=petties_db
DB_USERNAME_UAT=neondb_owner
DB_PASSWORD_UAT=your_password

# MongoDB Atlas
MONGO_URI_UAT=mongodb+srv://user:pass@cluster.mongodb.net/petties_nosql?retryWrites=true&w=majority

# AI Service
AI_SERVICE_URL=http://ai-service-uat:8000

# JWT
JWT_SECRET_UAT=UATSecretKeyForUserAcceptanceTesting123456789012345678901234

# CORS (UAT domains)
CORS_ORIGINS_UAT=https://uat-api.petties.world,https://uat-ai.petties.world,http://localhost:5173
```

**Deploy trên EC2:**

```bash
cd ~/petties-backend/Petties-Veterinary-Appointment-Booking-Platform
docker-compose -f docker-compose.uat.yml --env-file .env.uat up -d --build
```

### Production (EC2)

**File `.env` trên EC2:** `~/petties-backend/Petties-Veterinary-Appointment-Booking-Platform/.env`

```bash
# Profile
SPRING_PROFILES_ACTIVE=prod

# Database (Neon PostgreSQL)
DB_HOST=ep-quiet-rice-a1qxog6z-pooler.ap-southeast-1.aws.neon.tech
DB_PORT=5432
DB_NAME=petties_db
DB_USERNAME=neondb_owner
DB_PASSWORD=your_password

# MongoDB Atlas
MONGO_URI=mongodb+srv://user:pass@cluster.mongodb.net/petties_nosql?retryWrites=true&w=majority

# AI Service
AI_SERVICE_URL=http://ai-service:8000

# JWT
JWT_SECRET=your-64-char-secret-key

# CORS (production domains)
CORS_ORIGINS=https://petties.world,https://www.petties.world
```

**Deploy trên EC2:**

```bash
cd ~/petties-backend/Petties-Veterinary-Appointment-Booking-Platform
docker-compose -f docker-compose.prod.yml --env-file .env up -d --build
```

## AI Service (Python/FastAPI)

### Development (Local)

**Chạy với Docker Compose:**

```bash
docker-compose -f docker-compose.dev.yml up -d ai-service
```

**Hoặc chạy trực tiếp:**

```bash
cd petties-agent-serivce
export ENVIRONMENT=development
uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
```

### UAT (EC2)

**File `.env.uat` trên EC2:** 

```bash
# Environment
ENVIRONMENT=uat
APP_DEBUG=true

# Database (Neon PostgreSQL)
DATABASE_URL_UAT=postgresql://neondb_owner:password@ep-quiet-rice-a1qxog6z-pooler.ap-southeast-1.aws.neon.tech:5432/petties_db?sslmode=require

# Qdrant
QDRANT_URL_UAT=https://your-cluster.qdrant.io
QDRANT_API_KEY_UAT=your-api-key

# Ollama
OLLAMA_API_KEY_UAT=your-ollama-key
OLLAMA_MODEL_UAT=kimi-k2:1t-cloud

# CORS
CORS_ORIGINS_UAT=https://uat-api.petties.world,https://uat-ai.petties.world,http://localhost:5173
```

**Deploy trên EC2:**

```bash
cd ~/petties-backend/Petties-Veterinary-Appointment-Booking-Platform
docker-compose -f docker-compose.uat.yml --env-file .env.uat up -d --build
```

### Production (EC2)

**File `.env` trên EC2:**

```bash
# Environment
ENVIRONMENT=production
APP_DEBUG=false

# Database (Neon PostgreSQL)
DATABASE_URL=postgresql://neondb_owner:password@ep-quiet-rice-a1qxog6z-pooler.ap-southeast-1.aws.neon.tech:5432/petties_db?sslmode=require

# Qdrant
QDRANT_URL=https://your-cluster.qdrant.io
QDRANT_API_KEY=your-api-key

# Ollama
OLLAMA_API_KEY=your-ollama-key
OLLAMA_MODEL=kimi-k2:1t-cloud

# CORS
CORS_ORIGINS=https://petties.world,https://www.petties.world
```

**Deploy trên EC2:**

```bash
cd ~/petties-backend/Petties-Veterinary-Appointment-Booking-Platform
docker-compose -f docker-compose.prod.yml --env-file .env up -d --build
```

## URL Mapping

### Local (Development)

| Service | HTTP | WebSocket |
|---------|------|-----------|
| Frontend | http://localhost:5173 | - |
| Backend API | http://localhost:8080/api | ws://localhost:8080/ws |
| AI Service | http://localhost:8000 | ws://localhost:8000/ws |

### UAT (User Acceptance Testing)

| Service | HTTP | WebSocket | Domain |
|---------|------|-----------|--------|
| Frontend | https://petties.world (hoặc Vercel Preview) | - | Vercel |
| Backend API | https://uat-api.petties.world/api | wss://uat-api.petties.world/ws | EC2 + Nginx |
| AI Service | https://uat-ai.petties.world | wss://uat-ai.petties.world/ws | EC2 + Nginx |

### Production

| Service | HTTP | WebSocket | Domain |
|---------|------|-----------|--------|
| Frontend | https://petties.world | - | Vercel |
| Backend API | https://api.petties.world/api | wss://api.petties.world/ws | EC2 + Nginx |
| AI Service | https://ai.petties.world | wss://ai.petties.world/ws | EC2 + Nginx |

## WebSocket URLs

### Frontend Code

**Backend WebSocket:**
```typescript
import { env } from '../config/env'
const wsUrl = env.WS_URL  // wss://api.petties.world/ws (production)
```

**AI Service WebSocket:**
```typescript
import { createChatWebSocket } from '../services/agentService'
const ws = createChatWebSocket('session-123')
// Automatically converts https://ai.petties.world -> wss://ai.petties.world
```

## Kiểm tra Configuration

### Frontend (Development)

Mở browser console, bạn sẽ thấy:

```
🔧 Environment Config: {
  isProduction: false,
  API_BASE_URL: "http://localhost:8080/api",
  WS_URL: "ws://localhost:8080/ws",
  AGENT_SERVICE_URL: "http://localhost:8000"
}
```

### Frontend (UAT)

Mở browser console trên domain có `uat`:

```
🔧 Environment Config: {
  environment: "uat",
  hostname: "uat.petties.world",
  API_BASE_URL: "https://uat-api.petties.world/api",
  WS_URL: "wss://uat-api.petties.world/ws",
  AGENT_SERVICE_URL: "https://uat-ai.petties.world"
}
```

### Frontend (Production)

Mở browser console trên https://petties.world:

```
🔧 Environment Config: {
  environment: "production",
  hostname: "petties.world",
  API_BASE_URL: "https://api.petties.world/api",
  WS_URL: "wss://api.petties.world/ws",
  AGENT_SERVICE_URL: "https://ai.petties.world"
}
```

### Backend (Health Check)

```bash
# Development
curl http://localhost:8080/api/actuator/health

# UAT
curl https://uat-api.petties.world/api/actuator/health

# Production
curl https://api.petties.world/api/actuator/health
```

### AI Service (Health Check)

```bash
# Development
curl http://localhost:8000/health

# UAT
curl https://uat-ai.petties.world/health

# Production
curl https://ai.petties.world/health
```

## Troubleshooting

### Lỗi: `ERR_CONNECTION_REFUSED` trên Production

**Nguyên nhân:** Frontend đang dùng `localhost` thay vì production URL

**Giải pháp:**
1. Kiểm tra Vercel Environment Variables đã set chưa
2. Redeploy Vercel sau khi set env vars
3. Kiểm tra browser console để xem URL nào đang được dùng

### Lỗi: WebSocket không kết nối được

**Nguyên nhân:** Nginx chưa config WebSocket hoặc SSL chưa đúng

**Giải pháp:**
1. Xem file `NGINX_WEBSOCKET_CONFIG.md`
2. Kiểm tra Nginx config có `Upgrade` và `Connection` headers
3. Test WebSocket: `wscat -c wss://ai.petties.world/ws/chat/test`

### Lỗi: CORS error

**Nguyên nhân:** Backend chưa allow frontend domain

**Giải pháp:**
1. Cập nhật `CORS_ORIGINS` trong `.env` trên EC2
2. Restart containers
3. Kiểm tra `SecurityConfig.java` có CORS config đúng

## Checklist Deployment

### Frontend (Vercel)
- [ ] Set `VITE_API_BASE_URL` trên Vercel
- [ ] Set `VITE_WS_URL` trên Vercel
- [ ] Set `VITE_AGENT_SERVICE_URL` trên Vercel
- [ ] Redeploy sau khi set env vars
- [ ] Test register/login trên production
- [ ] Test WebSocket connection

### Backend (EC2 - Production)
- [ ] File `.env` có `SPRING_PROFILES_ACTIVE=prod`
- [ ] Database credentials đúng
- [ ] CORS_ORIGINS có production domains
- [ ] Containers đang chạy: `docker-compose -f docker-compose.prod.yml ps`
- [ ] Health check pass: `curl https://api.petties.world/api/actuator/health`
- [ ] Nginx config có WebSocket support

### Backend (EC2 - UAT)
- [ ] File `.env.uat` có `SPRING_PROFILES_ACTIVE=uat`
- [ ] Database credentials đúng
- [ ] CORS_ORIGINS_UAT có UAT domains
- [ ] Containers đang chạy: `docker-compose -f docker-compose.uat.yml ps`
- [ ] Health check pass: `curl https://uat-api.petties.world/api/actuator/health`
- [ ] Nginx config có WebSocket support cho UAT

### AI Service (EC2 - Production)
- [ ] File `.env` có đầy đủ config
- [ ] Containers đang chạy: `docker-compose -f docker-compose.prod.yml ps`
- [ ] Health check pass: `curl https://ai.petties.world/health`
- [ ] Nginx config có WebSocket support cho `/ws/`
- [ ] Test WebSocket: `wscat -c wss://ai.petties.world/ws/chat/test`

### AI Service (EC2 - UAT)
- [ ] File `.env.uat` có đầy đủ config
- [ ] Containers đang chạy: `docker-compose -f docker-compose.uat.yml ps`
- [ ] Health check pass: `curl https://uat-ai.petties.world/health`
- [ ] Nginx config có WebSocket support cho `/ws/`
- [ ] Test WebSocket: `wscat -c wss://uat-ai.petties.world/ws/chat/test`

