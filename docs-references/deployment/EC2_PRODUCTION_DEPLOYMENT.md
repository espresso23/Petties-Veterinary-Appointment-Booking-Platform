# 🚀 EC2 Production Deployment Guide

Hướng dẫn chi tiết deploy Backend và AI Service lên AWS EC2.

## 📋 Tổng quan

Hệ thống sẽ được deploy trên EC2 với cấu trúc:
- **Backend API**: `https://api.petties.world/api` (Port 8080, bind to 127.0.0.1)
- **AI Service**: `https://ai.petties.world` (Port 8000, bind to 127.0.0.1)
- **Frontend**: Deploy trên Vercel tại `https://petties.world`
- **Reverse Proxy**: Nginx với SSL (Let's Encrypt)
- **CI/CD**: GitHub Actions tự động deploy khi push vào `main` branch

## 📦 Prerequisites

### Trên máy local:
- **AWS Account** với EC2 access
- **SSH key pair** (.pem file)
- **Domain name** đã mua (ví dụ: `petties.world`)
- **DNS Provider** (ví dụ: Namecheap)

### Services cần có:
- **Neon PostgreSQL** database (hoặc Supabase)
- **MongoDB Atlas** (hoặc MongoDB local)
- **Qdrant Cloud** (vector database)
- **OpenRouter API Key** (LLM provider)

## 🎯 Bước 1: Tạo EC2 Instance
### 1.1. Launch EC2 Instance

1. Vào **AWS Console** → **EC2** → **Launch Instance**
2. **AMI**: Ubuntu 22.04 LTS
3. **Instance Type**: `t3.small` (2 vCPU, 2GB RAM) hoặc cao hơn
4. **Key Pair**: Chọn hoặc tạo mới key pair (download .pem file)
5. **Network Settings**: 
   - Allow SSH (port 22) từ IP của bạn
   - Allow HTTP (port 80) từ anywhere
   - Allow HTTPS (port 443) từ anywhere
6. **Storage**: 20GB (tùy chọn)
7. **Launch Instance**

### 1.2. Lưu thông tin

- **EC2 Public IP**: `15.134.219.97` (ví dụ)
- **EC2 Host**: `ec2-15-134-219-97.ap-southeast-1.compute.amazonaws.com`
- **SSH Key**: `petties-key.pem`

## 🔐 Bước 2: Setup SSH Key Permissions (Windows)

### 2.1. Fix SSH Key Permissions

```powershell
# Navigate to key location
cd D:\SEP490\petties

# Remove inheritance
icacls petties-key.pem /inheritance:r

# Remove unwanted permissions
icacls petties-key.pem /remove "Authenticated Users" "BUILTIN\Users" "Everyone"

# Grant read permission only to current user
icacls petties-key.pem /grant:r "$env:USERNAME:R"
```

**Lưu ý**: Nếu username có ký tự đặc biệt (như `\t`), dùng single quotes:
```powershell
icacls .\petties-key.pem /grant:r 'laptop-ganufne9\tan':R
```

### 2.2. Test SSH Connection

```bash
ssh -i petties-key.pem ubuntu@15.134.219.97
```

Nếu kết nối thành công, bạn sẽ thấy prompt `ubuntu@ip-172-31-xx-xx:~$`

## 📡 Bước 3: Cấu hình DNS trên Namecheap

### 3.1. Thêm DNS Records

Vào **Namecheap** → **Domain List** → **Manage** → **Advanced DNS**

Thêm các records:

| Type | Host | Value | TTL |
|------|------|-------|-----|
| A Record | `api` | `15.134.219.97` | Automatic |
| A Record | `ai` | `15.134.219.97` | Automatic |

**Lưu ý**: Đợi 5-30 phút để DNS propagate. Kiểm tra bằng:
```bash
nslookup api.petties.world
nslookup ai.petties.world
```

## 🐳 Bước 4: Setup EC2 Instance

### 4.1. Update System

```bash
sudo apt update
sudo apt upgrade -y
```

### 4.2. Install Docker

```bash
# Install Docker
curl -fsSL https://get.docker.com -o get-docker.sh
sudo sh get-docker.sh

# Install Docker Compose plugin (docker compose)
sudo apt-get update
sudo apt-get install docker-compose-plugin -y

# Add ubuntu user to docker group
sudo usermod -aG docker ubuntu

# Verify installation
docker --version
docker compose version

# Logout and login again to apply docker group changes
exit
# SSH lại vào EC2
```

### 4.3. Ghi chú về Nginx/SSL

Với kiến trúc hiện tại, Nginx chạy trong Docker container từ `docker-compose.prod.yml` và config được render từ template. Không cần cài Nginx/Certbot trực tiếp trên host EC2.

Khuyến nghị terminate TLS ở Cloudflare hoặc AWS Load Balancer để đơn giản vận hành.

## 📂 Bước 5: Clone Repository trên EC2

### 5.1. Tạo thư mục và clone

```bash
# Tạo thư mục
mkdir -p ~/petties-backend
cd ~/petties-backend

# Clone repository
git clone https://github.com/your-username/Petties-Veterinary-Appointment-Booking-Platform.git

# Hoặc nếu dùng SSH key
# git clone git@github.com:your-username/Petties-Veterinary-Appointment-Booking-Platform.git

cd Petties-Veterinary-Appointment-Booking-Platform
```

### 5.2. Kiểm tra file deploy

Sau khi clone repo, xác nhận file `docker-compose.prod.yml` và thư mục `nginx/templates/` đã có sẵn trong project.

## ⚙️ Bước 6: Tạo File .env.prod trên EC2

### 6.1. Tạo file .env.prod

```bash
cd ~/petties-backend/Petties-Veterinary-Appointment-Booking-Platform
cp .env.prod.example .env.prod
nano .env.prod
```

### 6.2. Nội dung file .env.prod

```bash
# ============================================
# SPRING BOOT BACKEND CONFIGURATION
# ============================================
SPRING_PROFILES_ACTIVE=prod

# Database - Neon PostgreSQL
DB_HOST=ep-quiet-rice-a1qxog6z-pooler.ap-southeast-1.aws.neon.tech
DB_PORT=5432
DB_NAME=petties_db
DB_USERNAME=neondb_owner
DB_PASSWORD=your_actual_password_here

# MongoDB Atlas
MONGO_URI=mongodb+srv://username:password@cluster.mongodb.net/petties_nosql?retryWrites=true&w=majority

# AI Service (internal docker network)
AI_SERVICE_URL=http://ai-service:8000

# JWT Secret (minimum 64 characters)
JWT_SECRET=YourProductionSecretKeyMinimum64CharactersLongForSecurityPurposesChangeThisToRandomString1234567890

# CORS - Production domains
CORS_ORIGINS=https://petties.world,https://www.petties.world

# ============================================
# REDIS CLOUD CONFIGURATION
# ============================================
# Redis Cloud (Upstash/Redis Labs)
# Format: redis://default:password@host:port/0 (0 for Production)
REDIS_URL=
REDIS_HOST=
REDIS_PORT=
REDIS_PASSWORD=
REDIS_SSL=false

# ============================================
# AI SERVICE CONFIGURATION
# ============================================
ENVIRONMENT=production
APP_DEBUG=false

# Database URL for AI Service
DATABASE_URL=postgresql://neondb_owner:password@ep-quiet-rice-a1qxog6z-pooler.ap-southeast-1.aws.neon.tech:5432/petties_db?sslmode=require

# Qdrant Cloud
QDRANT_URL=https://your-cluster.qdrant.io
QDRANT_API_KEY=your-qdrant-api-key

# LLM Provider (OpenRouter - Cloud API)
LLM_PROVIDER=openrouter
OPENROUTER_API_KEY=sk-your-openrouter-api-key
PRIMARY_MODEL=google/gemini-2.0-flash-exp:free
FALLBACK_MODEL=meta-llama/llama-3.3-70b-instruct

# Embeddings (Cohere - Cloud API)
COHERE_API_KEY=your-cohere-api-key

# CORS - Production domains
CORS_ORIGINS=https://petties.world,https://www.petties.world
```

**Lưu ý**: Thay thế các giá trị `your_actual_password_here`, `your-qdrant-api-key`, v.v. bằng giá trị thực tế.

### 6.3. Set permissions

```bash
chmod 600 .env.prod
```

## 🌐 Bước 7: Nginx Template (không config thủ công)

Deployment dùng nginx container trong `docker-compose.prod.yml`. File config được render tự động từ template `nginx/templates/default.conf.template` bằng env vars, nên không cần tạo `nginx.prod.conf`/`nginx.test.conf` thủ công.

Thiết lập các biến Nginx trong `.env.prod`:

```bash
NGINX_SERVER_NAME=api.petties.world
NGINX_FRONTEND_UPSTREAM=https://www.petties.world
NGINX_FRONTEND_HOST=www.petties.world
NGINX_HOST_PORT=80
```

Lưu ý: TLS/SSL nên terminate ở Cloudflare hoặc AWS ALB/NLB. Container nginx chỉ xử lý reverse proxy nội bộ theo template.

## 🔒 Bước 8: SSL/TLS

Khuyến nghị dùng managed TLS ở tầng edge (Cloudflare/AWS) để không cần quản lý cert thủ công trên VM.

## 🚀 Bước 9: Deploy Containers

### 9.1. Build and Start

```bash
cd ~/petties-backend/Petties-Veterinary-Appointment-Booking-Platform

# Build and start containers
docker compose -p petties-prod -f docker-compose.prod.yml --env-file .env.prod up -d --build

# Check status
docker compose -p petties-prod -f docker-compose.prod.yml --env-file .env.prod ps

# View logs
docker compose -p petties-prod -f docker-compose.prod.yml --env-file .env.prod logs -f
```

### 9.2. Kiểm tra containers

```bash
# Check running containers
docker ps

# Check backend logs
docker compose -p petties-prod -f docker-compose.prod.yml --env-file .env.prod logs -f backend

# Check AI service logs
docker compose -p petties-prod -f docker-compose.prod.yml --env-file .env.prod logs -f ai-service
```

### 9.3. Test endpoints

```bash
# Test backend health
curl http://127.0.0.1:8080/api/actuator/health

# Test AI service health
curl http://127.0.0.1:8000/health

# Test through Nginx (sau khi có SSL)
curl https://api.petties.world/api/actuator/health
curl https://ai.petties.world/health
```

## 🔄 Bước 10: Setup CI/CD với GitHub Actions

### 10.1. Tạo GitHub Secrets

Vào **GitHub Repository** → **Settings** → **Secrets and variables** → **Actions** → **New repository secret**

Thêm 2 secrets:

| Name | Value |
|------|-------|
| `EC2_HOST` | `15.134.219.97` (hoặc EC2 IP của bạn) |
| `EC2_SSH_KEY` | Nội dung file `.pem` (copy toàn bộ từ `-----BEGIN RSA PRIVATE KEY-----` đến `-----END RSA PRIVATE KEY-----`) |

### 10.2. GitHub Actions Workflow

File `.github/workflows/deploy-ec2.yml` đã có sẵn trong repo. Kiểm tra:

```yaml
name: Deploy to EC2

on:
  push:
    branches:
      - main
    paths-ignore:
      - '**.md'
      - '.gitignore'
      - 'README.md'

jobs:
  deploy:
    runs-on: ubuntu-latest
    
    steps:
      - name: Checkout code
        uses: actions/checkout@v3

      - name: Deploy to EC2
        uses: appleboy/ssh-action@v1.0.0
        with:
          host: ${{ secrets.EC2_HOST }}
          username: ubuntu
          key: ${{ secrets.EC2_SSH_KEY }}
          script: |
            cd ~/petties-backend/Petties-Veterinary-Appointment-Booking-Platform
            echo "🚀 Deploying PRODUCTION environment..."
            echo "Pulling latest code from main branch..."
            git pull origin main
            echo "Stopping production containers..."
            docker compose -p petties-prod -f docker-compose.prod.yml --env-file .env.prod down
            echo "Building and starting production containers..."
            docker compose -p petties-prod -f docker-compose.prod.yml --env-file .env.prod up -d --build
            echo "Waiting for services to start..."
            sleep 10
            echo "Checking production backend health..."
            curl -f http://127.0.0.1:8080/api/actuator/health || echo "⚠️ Backend health check failed"
            echo "Checking production AI service health..."
            curl -f http://127.0.0.1:8000/health || echo "⚠️ AI service health check failed"
            echo "Showing recent logs..."
            docker compose -p petties-prod -f docker-compose.prod.yml --env-file .env.prod logs --tail=50
            echo "✅ Production Deployment complete!"
```

### 10.3. Test CI/CD

```bash
# Push commit lên main branch
git add .
git commit -m "Test deployment"
git push origin main

# Kiểm tra GitHub Actions tab để xem deployment status
```

## ✅ Bước 11: Verification

### 11.1. Test Backend API

```bash
# Health check
curl https://api.petties.world/api/actuator/health

# Hoặc từ browser
# https://api.petties.world/api/actuator/health
```

### 11.2. Test AI Service

```bash
# Health check
curl https://ai.petties.world/health

# Hoặc từ browser
# https://ai.petties.world/health
```

### 11.3. Test WebSocket

**Backend WebSocket:**
```javascript
const ws = new WebSocket('wss://api.petties.world/ws')
ws.onopen = () => console.log('✅ Backend WS connected')
```

**AI Service WebSocket:**
```javascript
const ws = new WebSocket('wss://ai.petties.world/ws/chat/test-session-123')
ws.onopen = () => console.log('✅ AI Service WS connected')
```

## 🔧 Troubleshooting

### Lỗi: 502 Bad Gateway

**Nguyên nhân**: Nginx không kết nối được backend.

**Giải pháp**:
```bash
# Kiểm tra containers
docker compose -p petties-prod -f docker-compose.prod.yml --env-file .env.prod ps

# Kiểm tra logs
docker compose -p petties-prod -f docker-compose.prod.yml --env-file .env.prod logs -f backend

# Test direct connection
curl http://127.0.0.1:8080/api/actuator/health
```

### Lỗi: Database Connection Failed

**Nguyên nhân**: Database credentials sai hoặc network issue.

**Giải pháp**:
```bash
# Kiểm tra database connection từ EC2
nc -vz ep-quiet-rice-a1qxog6z-pooler.ap-southeast-1.aws.neon.tech 5432

# Kiểm tra .env.prod file
cat .env.prod | grep DB_

# Kiểm tra backend logs
docker compose -p petties-prod -f docker-compose.prod.yml --env-file .env.prod logs backend | grep -i "database\|connection"
```

### Lỗi: Out of Memory

**Nguyên nhân**: EC2 instance quá nhỏ hoặc containers dùng quá nhiều RAM.

**Giải pháp**:
- Upgrade EC2 instance (t3.small → t3.medium)
- Hoặc giảm memory limits trong `docker-compose.prod.yml`:

```yaml
deploy:
  resources:
    limits:
      memory: 512M  # Giảm từ 768M
    reservations:
      memory: 256M  # Giảm từ 384M
```

### Lỗi: HTTPS không hoạt động

**Nguyên nhân**: cấu hình TLS ở tầng edge (Cloudflare/ALB) chưa đúng hoặc DNS chưa propagate.

**Giải pháp**:
```bash
# Kiểm tra DNS
nslookup api.petties.world
nslookup www.petties.world

# Kiểm tra HTTP từ EC2 đến container nginx
curl -I http://127.0.0.1:80
```

Sau đó kiểm tra lại SSL mode/certificate ở Cloudflare hoặc listener/certificate ở AWS Load Balancer.

## 📊 Monitoring

### Check Container Status

```bash
docker compose -p petties-prod -f docker-compose.prod.yml --env-file .env.prod ps
docker stats
```

### Check Nginx Container Status

```bash
docker compose -p petties-prod -f docker-compose.prod.yml --env-file .env.prod ps nginx
docker compose -p petties-prod -f docker-compose.prod.yml --env-file .env.prod logs -f nginx
```

### Check Disk Space

```bash
df -h
docker system df
```

### View Logs

```bash
# All services
docker compose -p petties-prod -f docker-compose.prod.yml --env-file .env.prod logs -f

# Specific service
docker compose -p petties-prod -f docker-compose.prod.yml --env-file .env.prod logs -f backend
docker compose -p petties-prod -f docker-compose.prod.yml --env-file .env.prod logs -f ai-service
```

## 🔄 Update Deployment

### Manual Update

```bash
cd ~/petties-backend/Petties-Veterinary-Appointment-Booking-Platform
git pull origin main
docker compose -p petties-prod -f docker-compose.prod.yml --env-file .env.prod down
docker compose -p petties-prod -f docker-compose.prod.yml --env-file .env.prod up -d --build
```

### Automatic Update (via GitHub Actions)

Chỉ cần push vào `main` branch, GitHub Actions sẽ tự động deploy.

## 📝 Notes

- **Ports**: Backend (8080) và AI Service (8000) bind to `127.0.0.1` để chỉ Nginx có thể access
- **Memory**: Tối ưu cho `t3.small` (2GB RAM), nếu cần có thể upgrade
- **SSL**: Certificates tự động renew mỗi 90 ngày
- **Environment Variables**: Không commit file `.env.prod` lên Git
- **Backup**: Nên backup file `.env.prod` và database thường xuyên

## 🔗 Related Documentation

- **Vercel Frontend Setup**: Xem `deployment/VERCEL_PRODUCTION_SETUP.md`
- **Nginx WebSocket Config**: Xem `infrastructure/NGINX_WEBSOCKET_CONFIG.md`
- **Environment Setup**: Xem `setup/ENVIRONMENT_SETUP_GUIDE.md`

