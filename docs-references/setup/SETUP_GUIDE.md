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

#### Ollama Configuration (Hybrid: Local or Cloud)

**Option 1: Local Mode (Development)**

```bash
# Ollama runs on local machine
LLM_PROVIDER=ollama
OLLAMA_BASE_URL=http://localhost:11434
OLLAMA_API_KEY=  # Leave empty
OLLAMA_MODEL=kimi-k2
OLLAMA_EMBEDDING_MODEL=nomic-embed-text
```

**Option 2: Cloud Mode (Production - Recommended)**

```bash
# Uses Ollama Cloud API
LLM_PROVIDER=ollama
OLLAMA_API_KEY=sk-your-ollama-cloud-api-key  # Get from https://ollama.com
OLLAMA_BASE_URL=https://ollama.com  # Auto-set if API key provided
OLLAMA_MODEL=kimi-k2:1t-cloud  # Auto-switches if API key provided
OLLAMA_EMBEDDING_MODEL=nomic-embed-text
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

### Deployment on Render

1. **Connect Repository** to Render
2. **Deploy using `render.yaml`** (auto-detected)
3. **Set Environment Variables** in Render Dashboard:
   - `OLLAMA_API_KEY` (from https://ollama.com)
   - `QDRANT_API_KEY` (from Qdrant Cloud)
   - `DATABASE_URL` (Neon)
   - `MONGO_URI` (MongoDB Atlas)
   - `JWT_SECRET` (64+ characters)

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
| `docker-compose.prod.yml` | Production test | Test production build locally before Render deploy |

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

## Ollama Setup

### Development: Local Ollama

1. **Install Ollama:**
   - Download from https://ollama.ai/download
   - Install và start service

2. **Pull Models:**
   ```bash
   ollama pull kimi-k2
   ollama pull nomic-embed-text
   ```

3. **Verify:**
   ```bash
   curl http://localhost:11434/api/tags
   ```

### Production: Ollama Cloud

1. **Sign up** tại https://ollama.com
2. **Get API Key** từ dashboard
3. **Set in Render Dashboard:**
   - `OLLAMA_API_KEY=sk-...`
   - System auto-switches to `https://ollama.com`
   - Model auto-switches to `kimi-k2:1t-cloud`

**Benefits:**
- ✅ No GPU/RAM needed on server
- ✅ No tunnel setup required
- ✅ Larger context window (256K vs 128K)
- ✅ Perfect for Render free tier

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

### Ollama Connection Failed

**Local Mode:**
- Ensure Ollama is running: `ollama serve`
- Check `OLLAMA_BASE_URL=http://localhost:11434`
- Verify: `curl http://localhost:11434/api/tags`

**Cloud Mode:**
- Verify `OLLAMA_API_KEY` is set correctly
- Check API key at https://ollama.com
- Ensure `OLLAMA_MODEL=kimi-k2:1t-cloud` for cloud

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

