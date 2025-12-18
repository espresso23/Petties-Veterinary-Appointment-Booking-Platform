# 🚀 PETTIES - Setup Guide

Hướng dẫn setup chi tiết cho Development và Production environments.

## 📋 Table of Contents

1. [Prerequisites](#prerequisites)
2. [Environment Variables](#environment-variables)
3. [Development Setup](#development-setup)
4. [Production Setup](#production-setup)
5. [Docker Compose Files](#docker-compose-files)
6. [Troubleshooting](#troubleshooting)

---

## Prerequisites

### Required Software
- **Docker Desktop** (for databases)
- **Node.js 18+** (for Web Frontend)
- **Java 21** (for Spring Boot Backend)
- **Python 3.12+** (for AI Service)
- **Git**

### Optional (for Full Docker Development)
- Docker Compose (included with Docker Desktop)

---

## Environment Variables

### Create `.env` File

Copy template và tạo `.env` file:

```bash
# Copy template (nếu có .env.example)
cp .env.example .env

# Hoặc tạo manual
touch .env
```

### Required Environment Variables

#### Database Configuration

```bash
# Local Development (Docker)
POSTGRES_DB=petties_db
POSTGRES_USER=postgres
POSTGRES_PASSWORD=postgres

# MongoDB - Local
MONGO_INITDB_ROOT_USERNAME=admin
MONGO_INITDB_ROOT_PASSWORD=admin
MONGO_INITDB_DATABASE=petties_nosql
```

#### Qdrant Cloud (Vector Database)

```bash
# Get from https://cloud.qdrant.io
QDRANT_URL=https://your-cluster-id.region.cloud.qdrant.io
QDRANT_API_KEY=your-qdrant-api-key-here
```

#### Cloud AI Services Configuration (Cloud-Only)

```bash
# LLM Provider (OpenRouter)
LLM_PROVIDER=openrouter
OPENROUTER_API_KEY=sk-your-openrouter-key  # Get from https://openrouter.ai/keys
OPENROUTER_BASE_URL=https://openrouter.ai/api/v1
PRIMARY_MODEL=google/gemini-2.0-flash-exp:free
FALLBACK_MODEL=meta-llama/llama-3.3-70b-instruct

# Embeddings (Cohere)
EMBEDDING_PROVIDER=cohere
COHERE_API_KEY=your-cohere-key  # Get from https://dashboard.cohere.com/api-keys
EMBEDDING_MODEL=embed-multilingual-v3

# Web Search (Tavily)
TAVILY_API_KEY=your-tavily-key  # Get from https://tavily.com
```

#### JWT Secret

```bash
# Development (minimum 32 chars)
JWT_SECRET=devSecretKeyForLocalDevelopmentOnly123456789012345678901234

# Production (minimum 64 chars)
JWT_SECRET=YourProductionSecretKeyMinimum64CharactersLongForSecurityPurposesChangeThisToRandomString
```

#### CORS Configuration

```bash
CORS_ORIGINS=http://localhost:5173,http://localhost:3000
```

#### Spring Boot

```bash
SPRING_PROFILES_ACTIVE=dev  # or 'prod' for production
```

#### AI Service

```bash
ENVIRONMENT=development  # or 'production'
APP_DEBUG=true  # or 'false' for production
```

---

## Development Setup

### Quick Start (Recommended)

#### Step 1: Start Databases

```bash
# Windows
.\scripts\dev-db-only.bat

# Linux/Mac
docker-compose -f docker-compose.db-only.yml up -d
```

#### Step 2: Start Services (Separate Terminals)

**Terminal 1 - Backend:**
```bash
cd backend-spring/petties
mvn spring-boot:run
# Runs at http://localhost:8080
```

**Terminal 2 - AI Service:**
```bash
cd petties-agent-serivce
python -m uvicorn app.main:app --reload --port 8000
# Runs at http://localhost:8000
```

**Terminal 3 - Frontend:**
```bash
cd petties-web
npm install
npm run dev
# Runs at http://localhost:5173
```

### Full Docker Development

Nếu muốn chạy tất cả trong Docker (không có hot-reload):

```bash
docker-compose -f docker-compose.dev.yml up --build
```

---

## Production Setup

### Deployment on AWS EC2

**Current Production:** Backend and AI Service deployed on AWS EC2.

1. **EC2 Instance Setup:**
   - Instance Type: t3.small (2 vCPU, 2GB RAM)
   - OS: Ubuntu 22.04 LTS
   - Security Groups: SSH (22), HTTP (80), HTTPS (443)

2. **DNS Configuration (Namecheap):**
   - `api.petties.world` → EC2 Public IP
   - `ai.petties.world` → EC2 Public IP

3. **Set Environment Variables on EC2:**
   ```bash
   # SSH vào EC2
   ssh -i petties-key.pem ubuntu@<EC2_IP>
   
   # Edit .env file
   cd ~/petties-backend/Petties-Veterinary-Appointment-Booking-Platform
   nano .env
   
   # Required variables:
   # - OPENROUTER_API_KEY (from https://openrouter.ai)
   # - COHERE_API_KEY (from https://cohere.com)
   # - QDRANT_API_KEY (from Qdrant Cloud)
   # - TAVILY_API_KEY (from https://tavily.com)
   # - DATABASE_URL (Neon PostgreSQL)
   # - MONGO_URI (MongoDB Atlas)
   # - JWT_SECRET (64+ characters)
   # - CORS_ORIGINS (https://petties.world,https://www.petties.world)
   ```

4. **Deploy with Docker Compose:**
   ```bash
   docker-compose -f docker-compose.prod.yml --env-file .env up -d --build
   ```

**Chi tiết deployment:** Xem `docs-references/deployment/EC2_PRODUCTION_DEPLOYMENT.md`

### Frontend Deployment on Vercel

Frontend deployed tại https://petties.world

**Chi tiết setup:** Xem `docs-references/deployment/VERCEL_PRODUCTION_SETUP.md`

### Local Production Test

```bash
# Test production build locally
docker-compose -f docker-compose.prod.yml up --build
```

---

## Docker Compose Files

### File Structure

| File | Purpose | When to Use |
|------|---------|-------------|
| `docker-compose.db-only.yml` | Databases only | **Main development mode** - Run services directly with hot-reload |
| `docker-compose.dev.yml` | Full dev stack | Test entire stack in Docker (no hot-reload) |
| `docker-compose.prod.yml` | Production mode | EC2 deployment and local production testing |

### Common Commands

```bash
# Start databases
docker-compose -f docker-compose.db-only.yml up -d

# View logs
docker-compose -f docker-compose.db-only.yml logs -f

# Stop services
docker-compose -f docker-compose.db-only.yml down

# Reset databases (WARNING: deletes all data!)
docker-compose -f docker-compose.db-only.yml down -v
docker-compose -f docker-compose.db-only.yml up -d
```

---

## Cloud AI Services Setup

### Cloud-Only Architecture

Petties sử dụng Cloud APIs - **không cần cài đặt local AI services**.

### Get API Keys

| Service | Provider | URL | Free Tier |
|---------|----------|-----|----------|
| **LLM** | OpenRouter | https://openrouter.ai/keys | Free models available |
| **Embeddings** | Cohere | https://dashboard.cohere.com/api-keys | 1,000 calls/month |
| **Vector DB** | Qdrant Cloud | https://cloud.qdrant.io | 1GB storage |
| **Web Search** | Tavily | https://tavily.com | 1,000 searches/month |

### Verify API Connections

```bash
# Test OpenRouter
curl https://openrouter.ai/api/v1/models \
  -H "Authorization: Bearer $OPENROUTER_API_KEY"

# Test Cohere
curl https://api.cohere.ai/v1/embed \
  -H "Authorization: Bearer $COHERE_API_KEY" \
  -d '{"texts": ["Test"], "model": "embed-multilingual-v3"}'

# Test Qdrant
curl "$QDRANT_URL/collections" \
  -H "api-key: $QDRANT_API_KEY"
```

### Benefits of Cloud-Only Architecture

- ✅ No GPU/RAM needed on server
- ✅ Zero infrastructure management
- ✅ Deploy easily on Render/Railway free tier
- ✅ Scale automatically
- ✅ Free tiers sufficient for MVP

---

## Troubleshooting

### Database Connection Issues

```bash
# Check if databases are running
docker ps

# Check database logs
docker-compose -f docker-compose.db-only.yml logs postgres
docker-compose -f docker-compose.db-only.yml logs mongodb

# Restart databases
docker-compose -f docker-compose.db-only.yml restart
```

### Port Already in Use

```bash
# Windows: Find process using port
netstat -ano | findstr :5432

# Linux/Mac: Find process
lsof -i :5432

# Kill process (Windows)
taskkill /PID <PID> /F
```

### Cloud API Connection Issues

**OpenRouter:**
- Verify `OPENROUTER_API_KEY` is set correctly
- Check API key at https://openrouter.ai/keys
- Test: `curl https://openrouter.ai/api/v1/models -H "Authorization: Bearer $OPENROUTER_API_KEY"`

**Cohere:**
- Verify `COHERE_API_KEY` is set correctly
- Check free tier limits at https://dashboard.cohere.com

**Qdrant:**
- Verify `QDRANT_URL` and `QDRANT_API_KEY`
- Check cluster status at https://cloud.qdrant.io

### Backend/AI Service Won't Start

```bash
# Check logs
# Backend
cd backend-spring/petties
mvn spring-boot:run

# AI Service
cd petties-agent-serivce
python -m uvicorn app.main:app --reload --port 8000

# Check if databases are accessible
docker exec -it petties-postgres psql -U postgres -d petties_db -c "SELECT 1;"
```

### Environment Variables Not Loading

- Ensure `.env` file exists in project root
- Check file encoding (should be UTF-8)
- Restart services after changing `.env`
- For Docker: Pass env vars explicitly in docker-compose

---

## Next Steps

- 📖 Read [DEVELOPMENT_WORKFLOW.md](./DEVELOPMENT_WORKFLOW.md) for Git workflow
- 📖 Read [FRONTEND_BEST_PRACTICES.md](./FRONTEND_BEST_PRACTICES.md) for frontend guidelines
- 📖 Read [PETTIES_Git_Workflow_TEAM_GUIDE.md](./PETTIES_Git_Workflow_TEAM_GUIDE.md) for team collaboration

---

**Last Updated:** January 2025  
**Version:** 1.0.0

